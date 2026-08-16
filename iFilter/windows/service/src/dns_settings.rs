//! Windows の DNS 設定を iFilter に向ける。
//!
//! ARCHITECTURE.md §7-7 の「後から増えたインターフェースは元の DNS のまま」への対処。
//! **インターフェース個別に設定し、サービスが定期的に再適用する。** VPN・USB
//! テザリング・新しい Wi-Fi アダプタが後から現れても、次の巡回で拾う。
//!
//! 読み取りと書き込みで手段を分けてある。
//!
//! - **現状の把握はレジストリ**。日本語 Windows でも表示文字列に左右されず、
//!   30 秒ごとに呼んでも軽い（`netsh show` の出力解析はロケール依存で壊れる）
//! - **設定の変更は PowerShell の `Set-DnsClientServerAddress`**。DHCP へ戻す操作が
//!   `-ResetServerAddresses` 一発で正しくできる。変更は稀なので起動コストは問題にならない
//!
//! 巡回で「差し替えが要るか」を決める部分は OS に触らない純粋関数にしてある
//! （[`needs_redirect`]）。ここが判断を誤ると端末の名前解決が壊れるため。

use std::collections::BTreeMap;
use std::net::IpAddr;
use std::process::Command;

use serde::{Deserialize, Serialize};

/// ネットワークアダプタの設定が並ぶレジストリキー。
const INTERFACES_KEY: &str = r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces";

/// アダプタの表示名が入っているレジストリキー（ネットワークアダプタのクラス GUID）。
const CONNECTIONS_KEY: &str =
    r"SYSTEM\CurrentControlSet\Control\Network\{4D36E972-E325-11CE-BFC1-08002BE10318}";

/// 元の設定を保存する `settings` テーブルのキー。
pub const ORIGINAL_SETTINGS_KEY: &str = "dns.original_servers";

/// インターフェース 1 つぶんの DNS 設定。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InterfaceDns {
    /// レジストリ上の GUID。名前が変わっても追える。
    pub guid: String,
    /// 表示名（「イーサネット」など）。PowerShell に渡す。
    pub alias: String,
    /// 手動設定された DNS。空なら DHCP 任せ。
    pub configured: Vec<IpAddr>,
    /// DHCP が配った DNS。元に戻すときの判断に使う。
    pub from_dhcp: Vec<IpAddr>,
}

impl InterfaceDns {
    /// 実際に使われる DNS。手動設定があればそちらが優先される。
    pub fn effective(&self) -> &[IpAddr] {
        if self.configured.is_empty() {
            &self.from_dhcp
        } else {
            &self.configured
        }
    }

    /// すでに iFilter だけに向いているか。
    ///
    /// **1 件だけであることまで見る。** 予備として別の DNS が並んでいると、
    /// iFilter が遮断した瞬間にクライアントが 2 番目へ問い合わせて素通りする。
    pub fn points_only_to(&self, proxy: IpAddr) -> bool {
        self.configured.as_slice() == [proxy]
    }

    /// このインターフェースを差し替える価値があるか。
    ///
    /// DNS が 1 つも無いものは未接続・仮想アダプタなので触らない。設定しても
    /// 使われないうえ、元に戻すときの状態が増える。
    pub fn is_active(&self) -> bool {
        !self.effective().is_empty()
    }
}

/// 差し替えが必要なインターフェースを選ぶ。**OS に触らない純粋関数。**
pub fn needs_redirect(interfaces: &[InterfaceDns], proxy: IpAddr) -> Vec<&InterfaceDns> {
    interfaces
        .iter()
        .filter(|iface| iface.is_active() && !iface.points_only_to(proxy))
        .collect()
}

/// 元に戻すために保存しておく内容。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct OriginalSettings {
    /// GUID → 差し替える前の設定。
    pub by_guid: BTreeMap<String, InterfaceDns>,
}

impl OriginalSettings {
    /// まだ記録していないインターフェースだけ覚える。
    ///
    /// 上書きしないのは、2 回目の巡回で「iFilter に向いた状態」を元の設定として
    /// 記録してしまうと、二度と戻せなくなるため。
    pub fn remember(&mut self, iface: &InterfaceDns) {
        self.by_guid
            .entry(iface.guid.clone())
            .or_insert_with(|| iface.clone());
    }

    pub fn is_empty(&self) -> bool {
        self.by_guid.is_empty()
    }
}

/// DNS 設定の読み書き。テストで差し替えられるようにトレイトにしてある。
pub trait DnsAdapter {
    fn interfaces(&self) -> Result<Vec<InterfaceDns>, String>;
    fn set_servers(&self, iface: &InterfaceDns, servers: &[IpAddr]) -> Result<(), String>;
    fn reset_to_dhcp(&self, iface: &InterfaceDns) -> Result<(), String>;
}

/// 実際の Windows を相手にする実装。
pub struct WindowsDns;

impl DnsAdapter for WindowsDns {
    fn interfaces(&self) -> Result<Vec<InterfaceDns>, String> {
        read_interfaces()
    }

    fn set_servers(&self, iface: &InterfaceDns, servers: &[IpAddr]) -> Result<(), String> {
        let list = servers
            .iter()
            .map(|ip| format!("'{ip}'"))
            .collect::<Vec<_>>()
            .join(",");
        run_powershell(&format!(
            "Set-DnsClientServerAddress -InterfaceAlias {} -ServerAddresses {list}",
            quote(&iface.alias)
        ))
    }

    fn reset_to_dhcp(&self, iface: &InterfaceDns) -> Result<(), String> {
        run_powershell(&format!(
            "Set-DnsClientServerAddress -InterfaceAlias {} -ResetServerAddresses",
            quote(&iface.alias)
        ))
    }
}

/// インターフェースごとの成否。
///
/// **1 つの失敗で全体を止めない**ために、成功と失敗を分けて持つ。
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Outcome {
    /// 処理できたインターフェースの表示名。
    pub changed: Vec<String>,
    /// できなかったものと、その理由。
    pub failed: Vec<(String, String)>,
}

impl Outcome {
    pub fn is_empty(&self) -> bool {
        self.changed.is_empty() && self.failed.is_empty()
    }
}

/// 全インターフェースを iFilter に向け、元の設定を `original` に足す。
///
/// **1 件失敗しても残りを続ける。** レジストリには、いま存在しないアダプタの記録が
/// 残っていることがある（一度接続した USB イーサネットなど）。そこへの設定は
/// 「オブジェクトが見つかりません」で失敗するが、そこで打ち切ると
/// **本命の Wi-Fi に到達しないまま黙って終わる**。
pub fn apply(
    adapter: &impl DnsAdapter,
    proxy: IpAddr,
    original: &mut OriginalSettings,
) -> Result<Outcome, String> {
    let interfaces = adapter.interfaces()?;
    let mut outcome = Outcome::default();

    for iface in needs_redirect(&interfaces, proxy) {
        match adapter.set_servers(iface, &[proxy]) {
            Ok(()) => {
                // 成功したものだけ覚える。失敗したものを覚えると、
                // 戻すときに存在しないアダプタへ延々と試し続けることになる
                original.remember(iface);
                outcome.changed.push(iface.alias.clone());
            }
            Err(err) => outcome.failed.push((iface.alias.clone(), err)),
        }
    }

    Ok(outcome)
}

/// 記録しておいた設定に戻す。
///
/// 現在の状態ではなく**記録した内容**を基準にする。iFilter に向いた状態を
/// 「元の設定」と読み違えないため。
///
/// ここも 1 件の失敗で打ち切らない。戻せないものが 1 つあるせいで、
/// **他のアダプタが iFilter を向いたまま残る**ほうが害が大きい。
pub fn revert(adapter: &impl DnsAdapter, original: &OriginalSettings) -> Result<Outcome, String> {
    let mut outcome = Outcome::default();

    for iface in original.by_guid.values() {
        let result = if iface.configured.is_empty() {
            adapter.reset_to_dhcp(iface) // 元は DHCP 任せだった
        } else {
            adapter.set_servers(iface, &iface.configured)
        };

        match result {
            Ok(()) => outcome.changed.push(iface.alias.clone()),
            Err(err) => outcome.failed.push((iface.alias.clone(), err)),
        }
    }

    Ok(outcome)
}

// ---- Windows 固有の読み書き ----

fn read_interfaces() -> Result<Vec<InterfaceDns>, String> {
    let hklm = windows_registry::LOCAL_MACHINE;
    let interfaces = hklm
        .open(INTERFACES_KEY)
        .map_err(|err| format!("{INTERFACES_KEY} を開けません: {err}"))?;

    let mut out = Vec::new();
    for guid in interfaces.keys().map_err(|err| err.to_string())? {
        let Ok(key) = interfaces.open(&guid) else {
            continue;
        };
        // 表示名が引けないものは実体のあるアダプタではない（トンネル等）
        let Some(alias) = connection_name(&guid) else {
            continue;
        };

        out.push(InterfaceDns {
            configured: parse_servers(key.get_string("NameServer").ok().as_deref()),
            from_dhcp: parse_servers(key.get_string("DhcpNameServer").ok().as_deref()),
            guid,
            alias,
        });
    }

    Ok(out)
}

fn connection_name(guid: &str) -> Option<String> {
    windows_registry::LOCAL_MACHINE
        .open(format!(r"{CONNECTIONS_KEY}\{guid}\Connection"))
        .ok()?
        .get_string("Name")
        .ok()
        .filter(|name| !name.is_empty())
}

/// レジストリの DNS サーバー一覧を解釈する。
///
/// 区切りは項目によって違う（`NameServer` はカンマ、`DhcpNameServer` は空白）。
/// 両方受け付けて、解釈できない値は落とす。
fn parse_servers(raw: Option<&str>) -> Vec<IpAddr> {
    raw.unwrap_or_default()
        .split([',', ' ', '\t'])
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse().ok())
        .collect()
}

/// PowerShell の文字列リテラルとして安全に埋める。
fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn run_powershell(script: &str) -> Result<(), String> {
    // 出力を UTF-8 に固定する。既定では日本語 Windows のコードページで返るため、
    // そのままログに載せると**エラーの内容が読めない**（Step 10 で遭遇した）
    let script = format!("[Console]::OutputEncoding=[Text.Encoding]::UTF8; {script}");

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|err| format!("PowerShell を起動できません: {err}"))?;

    if output.status.success() {
        return Ok(());
    }
    Err(format!(
        "DNS 設定の変更に失敗しました: {}",
        first_line(&String::from_utf8_lossy(&output.stderr))
    ))
}

/// PowerShell のエラーは十数行に及ぶ。ログに載せるのは要点の 1 行だけにする。
fn first_line(stderr: &str) -> String {
    stderr
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("(詳細なし)")
        .to_owned()
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().expect("妥当な IP")
    }

    fn iface(alias: &str, configured: &[&str], dhcp: &[&str]) -> InterfaceDns {
        InterfaceDns {
            guid: format!("{{{alias}}}"),
            alias: alias.to_owned(),
            configured: configured.iter().map(|s| ip(s)).collect(),
            from_dhcp: dhcp.iter().map(|s| ip(s)).collect(),
        }
    }

    /// 呼ばれた操作を記録するだけの偽アダプタ。
    #[derive(Default)]
    struct FakeDns {
        interfaces: Vec<InterfaceDns>,
        calls: RefCell<Vec<String>>,
        /// この表示名への設定は失敗させる。実在しないアダプタを模す
        failing: Vec<String>,
    }

    impl FakeDns {
        fn fail_on(&self, iface: &InterfaceDns) -> Result<(), String> {
            if self.failing.contains(&iface.alias) {
                // Windows が実際に返すのと同じ形の失敗
                Err(format!(
                    "プロパティ 'InterfaceAlias' が '{}' のオブジェクトが見つかりません",
                    iface.alias
                ))
            } else {
                Ok(())
            }
        }
    }

    impl DnsAdapter for FakeDns {
        fn interfaces(&self) -> Result<Vec<InterfaceDns>, String> {
            Ok(self.interfaces.clone())
        }

        fn set_servers(&self, iface: &InterfaceDns, servers: &[IpAddr]) -> Result<(), String> {
            self.fail_on(iface)?;
            let list = servers
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join(",");
            self.calls
                .borrow_mut()
                .push(format!("set {} = {list}", iface.alias));
            Ok(())
        }

        fn reset_to_dhcp(&self, iface: &InterfaceDns) -> Result<(), String> {
            self.fail_on(iface)?;
            self.calls
                .borrow_mut()
                .push(format!("dhcp {}", iface.alias));
            Ok(())
        }
    }

    #[test]
    fn 存在しないアダプタで失敗しても残りを差し替える() {
        // レジストリには、いま存在しないアダプタの記録が残っていることがある。
        // そこで打ち切ると**本命の Wi-Fi に到達しないまま黙って終わる**。
        // 実機ではこれで DNS がまったく差し替わっていなかった
        let adapter = FakeDns {
            interfaces: vec![
                iface("イーサネット 2", &[], &["192.168.1.1"]), // 記録だけ残る幽霊
                iface("Wi-Fi 2", &[], &["192.168.10.1"]),       // 本命
            ],
            failing: vec!["イーサネット 2".to_owned()],
            ..Default::default()
        };

        let mut original = OriginalSettings::default();
        let outcome = apply(&adapter, ip("127.0.0.1"), &mut original).expect("一覧は読める");

        assert_eq!(outcome.changed, ["Wi-Fi 2"], "本命が差し替わっていない");
        assert_eq!(outcome.failed.len(), 1);
        assert_eq!(outcome.failed[0].0, "イーサネット 2");
    }

    #[test]
    fn 失敗したアダプタは元の設定として覚えない() {
        // 覚えてしまうと、戻すときに存在しないアダプタへ延々と試し続ける
        let adapter = FakeDns {
            interfaces: vec![iface("幽霊", &[], &["192.168.1.1"])],
            failing: vec!["幽霊".to_owned()],
            ..Default::default()
        };

        let mut original = OriginalSettings::default();
        apply(&adapter, ip("127.0.0.1"), &mut original).expect("一覧は読める");

        assert!(original.is_empty(), "失敗したものを記録している");
    }

    #[test]
    fn 戻すときも一件の失敗で打ち切らない() {
        // 戻せないものが 1 つあるせいで、他が iFilter を向いたまま残るほうが害が大きい
        let adapter = FakeDns {
            failing: vec!["幽霊".to_owned()],
            ..Default::default()
        };

        let mut original = OriginalSettings::default();
        original.remember(&iface("幽霊", &[], &["192.168.1.1"]));
        original.remember(&iface("Wi-Fi 2", &["8.8.8.8"], &[]));

        let outcome = revert(&adapter, &original).expect("戻せる");

        assert_eq!(outcome.changed, ["Wi-Fi 2"]);
        assert_eq!(outcome.failed.len(), 1);
    }

    #[test]
    fn 手動設定が_dhcp_より優先される() {
        let iface = iface("Wi-Fi", &["8.8.8.8"], &["192.168.10.1"]);
        assert_eq!(iface.effective(), [ip("8.8.8.8")]);
    }

    #[test]
    fn 手動設定が無ければ_dhcp_の値を見る() {
        let iface = iface("Wi-Fi", &[], &["192.168.10.1"]);
        assert_eq!(iface.effective(), [ip("192.168.10.1")]);
    }

    #[test]
    fn 予備の_dns_が並んでいたら差し替える() {
        // iFilter が遮断した瞬間に 2 番目へ問い合わせて素通りするため、
        // 「1 件目が iFilter」では不十分
        let iface = iface("Wi-Fi", &["127.0.0.1", "8.8.8.8"], &[]);
        assert!(!iface.points_only_to(ip("127.0.0.1")));
        assert_eq!(
            needs_redirect(std::slice::from_ref(&iface), ip("127.0.0.1")).len(),
            1
        );
    }

    #[test]
    fn すでに向いているものは触らない() {
        let iface = iface("Wi-Fi", &["127.0.0.1"], &[]);
        assert!(iface.points_only_to(ip("127.0.0.1")));
        assert!(needs_redirect(&[iface], ip("127.0.0.1")).is_empty());
    }

    #[test]
    fn 未接続のアダプタは触らない() {
        // 設定しても使われず、元に戻すときの状態が増えるだけ
        let idle = iface("Bluetooth ネットワーク接続", &[], &[]);
        assert!(!idle.is_active());
        assert!(needs_redirect(&[idle], ip("127.0.0.1")).is_empty());
    }

    #[test]
    fn 後から増えたアダプタを次の巡回で拾う() {
        // ARCHITECTURE.md §7-7 の中心。USB テザリングや VPN が後から現れる
        let mut adapter = FakeDns {
            interfaces: vec![iface("イーサネット", &["127.0.0.1"], &[])],
            ..Default::default()
        };
        let mut original = OriginalSettings::default();

        assert!(
            apply(&adapter, ip("127.0.0.1"), &mut original)
                .expect("適用できる")
                .is_empty(),
            "すでに向いているのに書き換えている"
        );

        adapter
            .interfaces
            .push(iface("USB テザリング", &[], &["192.168.42.129"]));

        let outcome = apply(&adapter, ip("127.0.0.1"), &mut original).expect("適用できる");
        assert_eq!(outcome.changed, ["USB テザリング"]);
    }

    #[test]
    fn 元の設定を上書きしない() {
        // 2 回目の巡回で「iFilter に向いた状態」を元の設定として記録すると
        // 二度と戻せなくなる
        let mut original = OriginalSettings::default();
        let before = iface("Wi-Fi", &["8.8.8.8"], &[]);
        original.remember(&before);
        original.remember(&iface("Wi-Fi", &["127.0.0.1"], &[]));

        assert_eq!(
            original.by_guid.get(&before.guid).expect("記録済み"),
            &before
        );
    }

    #[test]
    fn 元が_dhcp_なら_dhcp_に戻す() {
        let adapter = FakeDns {
            interfaces: vec![iface("Wi-Fi", &[], &["192.168.10.1"])],
            ..Default::default()
        };
        let mut original = OriginalSettings::default();
        apply(&adapter, ip("127.0.0.1"), &mut original).expect("適用できる");
        revert(&adapter, &original).expect("戻せる");

        assert_eq!(
            *adapter.calls.borrow(),
            vec!["set Wi-Fi = 127.0.0.1", "dhcp Wi-Fi"]
        );
    }

    #[test]
    fn 元が手動設定なら同じ値に戻す() {
        let adapter = FakeDns {
            interfaces: vec![iface("Wi-Fi", &["8.8.8.8", "8.8.4.4"], &[])],
            ..Default::default()
        };
        let mut original = OriginalSettings::default();
        apply(&adapter, ip("127.0.0.1"), &mut original).expect("適用できる");
        revert(&adapter, &original).expect("戻せる");

        assert_eq!(
            *adapter.calls.borrow(),
            vec!["set Wi-Fi = 127.0.0.1", "set Wi-Fi = 8.8.8.8,8.8.4.4"]
        );
    }

    #[test]
    fn 記録は_json_で往復する() {
        // サービスを再起動しても戻せるように settings テーブルへ保存する
        let mut original = OriginalSettings::default();
        original.remember(&iface("Wi-Fi", &["8.8.8.8"], &["192.168.10.1"]));

        let json = serde_json::to_string(&original).expect("書ける");
        let restored: OriginalSettings = serde_json::from_str(&json).expect("読める");
        assert_eq!(restored, original);
    }

    #[test]
    fn レジストリの区切り文字を両方受け付ける() {
        // NameServer はカンマ区切り、DhcpNameServer は空白区切り
        assert_eq!(
            parse_servers(Some("192.168.10.1,8.8.8.8")),
            vec![ip("192.168.10.1"), ip("8.8.8.8")]
        );
        assert_eq!(
            parse_servers(Some("192.168.10.1 8.8.8.8")),
            vec![ip("192.168.10.1"), ip("8.8.8.8")]
        );
        assert!(parse_servers(None).is_empty());
        assert!(parse_servers(Some("")).is_empty());
        assert!(parse_servers(Some("あいうえお")).is_empty());
    }

    #[test]
    fn 表示名を_powershell_に安全に埋める() {
        // アダプタ名は利用者が変更でき、アポストロフィを含みうる
        assert_eq!(quote("Wi-Fi"), "'Wi-Fi'");
        assert_eq!(quote("Bob's Wi-Fi"), "'Bob''s Wi-Fi'");
    }
}
