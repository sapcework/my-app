//! サービス本体。SCM から起動され、DNS プロキシを動かし続ける。

use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;
use std::sync::mpsc::Receiver;
use std::time::Duration;

use filter_core::FilterCore;
use ifilter_dns::{DnsFilter, Upstream, serve};
use storage::{PolicyStore, SqliteStore};
use time::OffsetDateTime;

use crate::config::FilterConfig;
use crate::dns_settings::{self, ORIGINAL_SETTINGS_KEY, OriginalSettings, WindowsDns};
use crate::log;

type Result<T> = std::result::Result<T, String>;

/// DNS 設定を見直す間隔。
///
/// 短くすると新しいアダプタを早く拾えるが、レジストリ読み取りが増える。
/// 30 秒なら、USB テザリングを挿してから塞がるまで最悪 30 秒。そこを完全に
/// 塞ぐのは WFP（Step 11〜12）の仕事なので、ここは軽さを優先する。
const DNS_REAPPLY_INTERVAL: Duration = Duration::from_secs(30);

/// 保護者 UI の変更を拾う間隔。
///
/// 保護者が「許可」を押してから効くまでの待ち時間になるので、DNS 設定の巡回より
/// ずっと短くする。読むのは版数 1 件だけなので 2 秒でも負担にならない。
const POLICY_POLL_INTERVAL: Duration = Duration::from_secs(2);

/// フィルターを組み立てて動かす。`shutdown` が来るまで戻らない。
///
/// `on_ready` は**問い合わせを受け取れるようになってから**呼ばれる。DB の準備に
/// 数百ミリ秒かかるので、これより早く「準備できた」と外に伝えると、直後の
/// 問い合わせが誰も居ないポートに届いて失敗する。
///
/// サービスからもコンソールからも同じ経路を通す。「サービスだと動かない」を
/// デバッグしづらい形で作り込まないため。
pub fn run(
    config: &FilterConfig,
    on_ready: impl FnOnce(SocketAddr) + Send + 'static,
    shutdown: impl std::future::Future<Output = ()>,
) -> Result<()> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|err| format!("非同期ランタイムを作れません: {err}"))?;

    runtime.block_on(async move { run_async(config, on_ready, shutdown).await })
}

async fn run_async(
    config: &FilterConfig,
    on_ready: impl FnOnce(SocketAddr) + Send + 'static,
    shutdown: impl std::future::Future<Output = ()>,
) -> Result<()> {
    let path = config.db_path()?;
    log::init(&path);
    log::write(&format!(
        "起動 listen={} upstream={} profile={} enforce_dns={}",
        config.listen,
        config.upstream,
        config.profile.as_arg(),
        config.enforce_dns
    ));

    ensure_database(&path).inspect_err(|err| log::write(err))?;
    log::write(&format!("DB を用意しました: {}", path.display()));

    let store = SqliteStore::open(&path).map_err(|err| format!("DB を開けません: {err}"))?;
    let core = FilterCore::load(
        store,
        config.profile.into(),
        config.device_id.clone(),
        OffsetDateTime::now_utc(),
    )
    .map_err(|err| format!("ポリシーを読み込めません: {err}"))
    .inspect_err(|err| log::write(err))?;
    log::write("ポリシーを読み込みました");

    let upstream = Upstream::new(config.upstream, Duration::from_secs(config.timeout));
    let filter = Arc::new(DnsFilter::new(core, upstream, config.verbose));

    // 保護者 UI は別プロセスとして DB を書き換える。定期的に見に行かないと
    // 「UI で許可したのに繋がらない」になる。読むのは版数 1 件だけなので軽い
    let watcher = tokio::spawn(watch_policy_changes(Arc::clone(&filter)));

    // DNS 設定の差し替えは、待ち受けが立ち上がってから始める。
    // 先に向けてしまうと、その隙間で端末の名前解決が丸ごと失敗する
    let enforcer = if config.enforce_dns {
        Some(tokio::spawn(enforce_dns_loop(
            path.clone(),
            config.listen.ip(),
        )))
    } else {
        None
    };

    // DoH プロバイダの IP を塞ぐ。ドメイン名の遮断は、ブラウザの DoH 設定に
    // https://1.1.1.1/dns-query と**数字で**書かれるとすり抜ける（ADR-0010）。
    //
    // 落とすと解除されるので、待ち受けのあいだ持ち続ける必要がある。
    // 名前の `_` は「使わない」ではなく「Drop のために保持している」の意味
    let _doh_blocker = if config.enforce_dns {
        block_doh_addresses()
    } else {
        None
    };

    // 実際に確保できたアドレスを残す。ここが出ていれば待ち受けは成立している。
    // 出ずに終わっているならバインドで失敗している
    let result = serve(
        filter,
        config.listen,
        |bound| {
            log::write(&format!("待ち受け開始: {bound}"));
            on_ready(bound);
        },
        shutdown,
    )
    .await
    .map_err(|err| format!("{} で待ち受けられません: {err}", config.listen))
    .inspect_err(|err| log::write(err));

    log::write("待ち受けを終了しました");
    watcher.abort();

    if let Some(handle) = enforcer {
        handle.abort();
        // 止まるときは必ず元の DNS に戻す。戻さないと名前解決ができないまま残る。
        // ここが失敗すると端末がネットに繋がらないまま残るので、記録を必ず残す
        match restore_dns(&path) {
            Ok(outcome) if outcome.is_empty() => log::write("DNS は差し替えていません"),
            Ok(outcome) => {
                if !outcome.changed.is_empty() {
                    log::write(&format!(
                        "DNS を元に戻しました: {}",
                        outcome.changed.join(", ")
                    ));
                }
                for (alias, err) in &outcome.failed {
                    log::write(&format!("DNS を戻せません（{alias}）: {err}"));
                }
            }
            Err(err) => log::write(&format!("DNS 設定を戻せませんでした: {err}")),
        }
    }

    result
}

/// DoH プロバイダの IP を塞ぐ。塞げなくても待ち受けは続ける。
///
/// **失敗を理由に止めない。** ここが効かなくてもドメイン名による遮断は働いており、
/// サービスごと落とすと DNS フィルタまで失う。害の大きいほうを避ける。
/// ただし黙って進むと「効いているつもり」になるので、必ずログに残す。
fn block_doh_addresses() -> Option<ifilter_wfp::AddressBlocker> {
    let addresses = domain_model::bundled_doh_addresses();
    match ifilter_wfp::AddressBlocker::block(&addresses) {
        Ok(blocker) => {
            log::write(&format!(
                "DoH プロバイダの IP を {} 件塞ぎました",
                blocker.filter_count()
            ));
            Some(blocker)
        }
        Err(err) => {
            log::write(&format!(
                "DoH プロバイダの IP を塞げません（ドメイン名の遮断は有効です）: {err}"
            ));
            None
        }
    }
}

/// DB が無ければ作り、同梱データを入れる。
///
/// サービスは無人で起動するので、`init` を忘れていたら黙って落ちるのではなく
/// ここで用意する。
fn ensure_database(path: &Path) -> Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|err| format!("{} を作れません: {err}", dir.display()))?;
    }

    let mut store = SqliteStore::open(path).map_err(|err| format!("DB を開けません: {err}"))?;
    store
        .seed_builtins(OffsetDateTime::now_utc())
        .map_err(|err| format!("同梱データを書き込めません: {err}"))
}

/// 保護者 UI の変更を拾ってポリシーを読み直す。
async fn watch_policy_changes(filter: Arc<DnsFilter<SqliteStore>>) {
    loop {
        tokio::time::sleep(POLICY_POLL_INTERVAL).await;

        // ロックを握るのは版数を読むあいだだけ。判定は止めない
        match tokio::task::block_in_place(|| filter.reload_if_stale()) {
            Ok(true) => log::write("設定の変更を検出しました。ポリシーを読み直しました"),
            Ok(false) => {}
            // 読めなくても諦めない。DB が一時的に使えないだけかもしれない
            Err(err) => log::write(&format!("設定の確認に失敗しました: {err}")),
        }
    }
}

/// 巡回ごとのログを「前回から変わったこと」だけに絞る。**OS に触らない。**
///
/// レジストリには実在しないアダプタの記録が残っていることがあり（一度挿した USB
/// イーサネットなど）、そこへの差し替えは**毎回必ず失敗する**。30 秒ごとに毎回書くと
/// 1 行 250 バイト × 120 行/時で、[`log`] の上限 1MB に 2 日足らずで達する。
/// 上限に達したログは作り直されるので、**起動時の記録ごと消える** —
/// 「サービスは実行中なのに効いていない」を追う手段が無くなる。
///
/// かといって黙らせると、**本命のアダプタが落ちた合図**まで失う。そこで顔ぶれか
/// 理由が変わったときだけ書く。繰り返しだけが減り、新しい失敗とその解消は残る。
#[derive(Default)]
struct DnsReporter {
    /// 直近の巡回で記録した失敗（表示名 → 理由）。
    failures: std::collections::BTreeMap<String, String>,
    /// 巡回そのものが失敗していたときの理由。
    blocked: Option<String>,
    /// 1 巡でも終えたか。
    passed: bool,
}

impl DnsReporter {
    /// 1 巡ぶんの結果から、今回書くべき行を返す。
    fn lines_for(&mut self, result: &Result<dns_settings::Outcome>) -> Vec<String> {
        let outcome = match result {
            Ok(outcome) => outcome,
            // 一覧そのものが読めなかった場合。次の巡回で拾い直すので、
            // 理由が同じあいだは黙る
            Err(err) => {
                self.passed = true;
                if self.blocked.as_ref() == Some(err) {
                    return Vec::new();
                }
                self.blocked = Some(err.clone());
                return vec![format!("DNS 設定を適用できませんでした: {err}")];
            }
        };

        let mut lines = Vec::new();
        if self.blocked.take().is_some() {
            lines.push("DNS 設定を読めるようになりました".to_owned());
        }

        if !self.passed && outcome.is_empty() {
            // 対象が 1 つも無いまま始まるのは、掴めていない可能性がある。
            // **黙って進むと「効いているつもり」になる**
            lines
                .push("DNS の差し替え対象がありません（すでに iFilter を向いています）".to_owned());
        }
        self.passed = true;

        if !outcome.changed.is_empty() {
            lines.push(format!(
                "DNS を iFilter に向けました: {}",
                outcome.changed.join(", ")
            ));
        }

        let current: std::collections::BTreeMap<String, String> =
            outcome.failed.iter().cloned().collect();

        // 解消を先に書く。あとに続く失敗の行がそのまま「いまの状態」になる
        for alias in self.failures.keys() {
            // 差し替えに成功したのなら、すぐ上の行がそれを伝えている
            if !current.contains_key(alias) && !outcome.changed.contains(alias) {
                lines.push(format!("DNS の差し替え失敗が解消しました（{alias}）"));
            }
        }

        for (alias, err) in &current {
            if self.failures.get(alias) != Some(err) {
                lines.push(format!("DNS を差し替えられません（{alias}）: {err}"));
            }
        }

        self.failures = current;
        lines
    }
}

/// DNS 設定を定期的に見直し、iFilter に向け直す。
async fn enforce_dns_loop(path: std::path::PathBuf, proxy: std::net::IpAddr) {
    let mut reporter = DnsReporter::default();
    loop {
        for line in reporter.lines_for(&enforce_dns_once(&path, proxy)) {
            log::write(&line);
        }
        tokio::time::sleep(DNS_REAPPLY_INTERVAL).await;
    }
}

fn enforce_dns_once(path: &Path, proxy: std::net::IpAddr) -> Result<dns_settings::Outcome> {
    let mut store = SqliteStore::open(path).map_err(|err| format!("DB を開けません: {err}"))?;
    let mut original = load_original(&store)?;

    let outcome = dns_settings::apply(&WindowsDns, proxy, &mut original)?;
    if !outcome.changed.is_empty() {
        save_original(&mut store, &original)?;
    }
    Ok(outcome)
}

/// 記録しておいた設定に戻す。
pub fn restore_dns(path: &Path) -> Result<dns_settings::Outcome> {
    let mut store = SqliteStore::open(path).map_err(|err| format!("DB を開けません: {err}"))?;
    let original = load_original(&store)?;
    if original.is_empty() {
        return Ok(dns_settings::Outcome::default());
    }

    let outcome = dns_settings::revert(&WindowsDns, &original)?;
    // 戻し終えたら記録を消す。残しておくと次に「元の設定」を取り違える
    save_original(&mut store, &OriginalSettings::default())?;
    Ok(outcome)
}

pub fn load_original(store: &impl PolicyStore) -> Result<OriginalSettings> {
    let Some(raw) = store
        .setting(ORIGINAL_SETTINGS_KEY)
        .map_err(|err| format!("設定を読めません: {err}"))?
    else {
        return Ok(OriginalSettings::default());
    };

    serde_json::from_str(&raw)
        .map_err(|err| format!("保存済みの DNS 設定を読めません（{ORIGINAL_SETTINGS_KEY}）: {err}"))
}

fn save_original(store: &mut impl PolicyStore, original: &OriginalSettings) -> Result<()> {
    let json = serde_json::to_string(original)
        .map_err(|err| format!("DNS 設定を書き出せません: {err}"))?;
    store
        .set_setting(ORIGINAL_SETTINGS_KEY, &json, OffsetDateTime::now_utc())
        .map_err(|err| format!("設定を保存できません: {err}"))
}

/// `std::sync::mpsc` の受信を待つ future。SCM の停止要求を async 側へ渡す。
pub async fn wait_for_signal(rx: Receiver<()>) {
    let _ = tokio::task::spawn_blocking(move || rx.recv()).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn outcome(changed: &[&str], failed: &[(&str, &str)]) -> Result<dns_settings::Outcome> {
        Ok(dns_settings::Outcome {
            changed: changed.iter().map(|s| (*s).to_owned()).collect(),
            failed: failed
                .iter()
                .map(|(alias, err)| ((*alias).to_owned(), (*err).to_owned()))
                .collect(),
        })
    }

    /// レジストリに残った実在しないアダプタで実際に起きた形。
    ///
    /// 30 秒ごとに同じ失敗を書き続けると、ログの上限に達して
    /// **起動時の記録ごと消える**。
    #[test]
    fn 同じ失敗を繰り返しても_2_度目からは書かない() {
        let mut reporter = DnsReporter::default();
        let 失敗 = outcome(&["Wi-Fi 2"], &[("イーサネット 2", "見つかりません")]);

        let 初回 = reporter.lines_for(&失敗);
        assert!(初回.iter().any(|line| line.contains("イーサネット 2")));

        for _ in 0..100 {
            assert!(
                reporter
                    .lines_for(&outcome(&[], &[("イーサネット 2", "見つかりません")]))
                    .is_empty()
            );
        }
    }

    /// 黙らせすぎない。理由が変わったのは状況が変わった合図。
    #[test]
    fn 失敗の理由が変われば書き直す() {
        let mut reporter = DnsReporter::default();
        reporter.lines_for(&outcome(&[], &[("Wi-Fi", "見つかりません")]));

        let lines = reporter.lines_for(&outcome(&[], &[("Wi-Fi", "アクセスが拒否されました")]));
        assert_eq!(
            lines,
            ["DNS を差し替えられません（Wi-Fi）: アクセスが拒否されました"]
        );
    }

    /// **本命のアダプタが落ちた合図**を取りこぼさない。
    #[test]
    fn 新しいアダプタの失敗は途中からでも書く() {
        let mut reporter = DnsReporter::default();
        reporter.lines_for(&outcome(&[], &[("イーサネット 2", "見つかりません")]));

        let lines = reporter.lines_for(&outcome(
            &[],
            &[
                ("Wi-Fi", "見つかりません"),
                ("イーサネット 2", "見つかりません"),
            ],
        ));
        assert_eq!(lines, ["DNS を差し替えられません（Wi-Fi）: 見つかりません"]);
    }

    /// 失敗の行だけが残ると、直ったあとも「いま失敗している」ように読める。
    #[test]
    fn 失敗が消えたら解消を書く() {
        let mut reporter = DnsReporter::default();
        reporter.lines_for(&outcome(&[], &[("イーサネット 2", "見つかりません")]));

        let lines = reporter.lines_for(&outcome(&[], &[]));
        assert_eq!(
            lines,
            ["DNS の差し替え失敗が解消しました（イーサネット 2）"]
        );
    }

    /// 差し替えに成功したときは「向けました」がそれを伝えている。
    #[test]
    fn 差し替えに成功したら解消を二重に書かない() {
        let mut reporter = DnsReporter::default();
        reporter.lines_for(&outcome(&[], &[("Wi-Fi", "見つかりません")]));

        let lines = reporter.lines_for(&outcome(&["Wi-Fi"], &[]));
        assert_eq!(lines, ["DNS を iFilter に向けました: Wi-Fi"]);
    }

    /// 巡回そのものが失敗する経路も、同じ理由で埋まらないようにする。
    #[test]
    fn 巡回の失敗も繰り返しては書かない() {
        let mut reporter = DnsReporter::default();
        let 失敗: Result<dns_settings::Outcome> = Err("DB を開けません".to_owned());

        assert_eq!(
            reporter.lines_for(&失敗),
            ["DNS 設定を適用できませんでした: DB を開けません"]
        );
        assert!(reporter.lines_for(&失敗).is_empty());

        // 読めるようになったことは残す。書かないと「まだ壊れている」に見える
        assert_eq!(
            reporter.lines_for(&outcome(&[], &[])),
            ["DNS 設定を読めるようになりました"]
        );
    }

    /// 対象が 1 つも無いのは、掴めていない可能性がある。**初回だけは必ず残す。**
    #[test]
    fn 対象が無いことは初回だけ書く() {
        let mut reporter = DnsReporter::default();

        assert_eq!(
            reporter.lines_for(&outcome(&[], &[])),
            ["DNS の差し替え対象がありません（すでに iFilter を向いています）"]
        );
        assert!(reporter.lines_for(&outcome(&[], &[])).is_empty());
    }
}
