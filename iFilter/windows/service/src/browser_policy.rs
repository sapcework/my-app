//! ブラウザの DoH をポリシーで無効にする。
//!
//! 同梱データによる遮断（`doh` カテゴリ）と**二重**にかける。役割が違う。
//!
//! - 同梱データ: 既知の DoH プロバイダを名前で止める。知らないプロバイダは抜ける
//! - ここのポリシー: ブラウザに「DoH を使うな」と設定させる。プロバイダを問わず効く
//!
//! Firefox の canary ドメイン（`use-application-dns.net`）は既定を覆すだけで、
//! 利用者が明示的に有効にした DoH は止められない。ポリシーなら固定できる。
//!
//! いずれも `HKLM\SOFTWARE\Policies` 配下なので**管理者権限が要る**。
//! 子供のアカウントを標準ユーザーにしてあれば書き換えられない（ARCHITECTURE.md §7-4）。

use windows_registry::LOCAL_MACHINE;

/// 1 つのブラウザに対する設定。
struct Policy {
    label: &'static str,
    key: &'static str,
    /// (値の名前, 文字列値)
    strings: &'static [(&'static str, &'static str)],
    /// (値の名前, 数値)
    dwords: &'static [(&'static str, u32)],
}

const POLICIES: &[Policy] = &[
    Policy {
        label: "Google Chrome",
        key: r"SOFTWARE\Policies\Google\Chrome",
        strings: &[("DnsOverHttpsMode", "off")],
        dwords: &[],
    },
    Policy {
        label: "Microsoft Edge",
        key: r"SOFTWARE\Policies\Microsoft\Edge",
        strings: &[("DnsOverHttpsMode", "off")],
        dwords: &[],
    },
    Policy {
        // Firefox は専用のサブキーで、Locked を立てないと利用者が戻せてしまう
        label: "Mozilla Firefox",
        key: r"SOFTWARE\Policies\Mozilla\Firefox\DNSOverHTTPS",
        strings: &[],
        dwords: &[("Enabled", 0), ("Locked", 1)],
    },
];

/// DoH を無効にするポリシーを書き込む。
///
/// 戻り値は設定できたブラウザの名前。
pub fn apply() -> Result<Vec<String>, String> {
    let mut applied = Vec::new();

    for policy in POLICIES {
        let key = LOCAL_MACHINE
            .create(policy.key)
            .map_err(|err| access_error(policy, &err))?;

        for (name, value) in policy.strings {
            key.set_string(name, value)
                .map_err(|err| access_error(policy, &err))?;
        }
        for (name, value) in policy.dwords {
            key.set_u32(name, *value)
                .map_err(|err| access_error(policy, &err))?;
        }
        applied.push(policy.label.to_owned());
    }

    Ok(applied)
}

/// ポリシーを取り消す。
///
/// **キーごとは消さない。** 他の管理設定が同じキーに同居している場合に
/// まとめて消してしまうため、iFilter が書いた値だけを消す。
pub fn revert() -> Result<Vec<String>, String> {
    let mut reverted = Vec::new();

    for policy in POLICIES {
        let Ok(key) = LOCAL_MACHINE.open(policy.key) else {
            continue; // 元から無い
        };

        let names = policy
            .strings
            .iter()
            .map(|(name, _)| *name)
            .chain(policy.dwords.iter().map(|(name, _)| *name));
        for name in names {
            // 無い値を消そうとしたときのエラーは無視してよい
            let _ = key.remove_value(name);
        }
        reverted.push(policy.label.to_owned());
    }

    Ok(reverted)
}

/// 現在の設定状況を読む。`status` の表示に使う。
pub fn is_applied() -> Vec<(String, bool)> {
    POLICIES
        .iter()
        .map(|policy| {
            let ok = LOCAL_MACHINE.open(policy.key).is_ok_and(|key| {
                policy
                    .strings
                    .iter()
                    .all(|(name, value)| key.get_string(name).is_ok_and(|got| got == *value))
                    && policy
                        .dwords
                        .iter()
                        .all(|(name, value)| key.get_u32(name).is_ok_and(|got| got == *value))
            });
            (policy.label.to_owned(), ok)
        })
        .collect()
}

fn access_error(policy: &Policy, err: &impl std::fmt::Display) -> String {
    format!(
        "{} のポリシーを設定できません（{}）: {err}\n\
         管理者として実行しているか確認してください。",
        policy.label, policy.key
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 主要ブラウザを網羅している() {
        // 1 つでも抜けると、そのブラウザだけ DoH で素通りする
        let labels: Vec<_> = POLICIES.iter().map(|p| p.label).collect();
        assert!(labels.contains(&"Google Chrome"));
        assert!(labels.contains(&"Microsoft Edge"));
        assert!(labels.contains(&"Mozilla Firefox"));
    }

    #[test]
    fn すべて_hklm_の_policies_配下に書く() {
        // HKCU に書くと子供のアカウントから書き換えられる
        for policy in POLICIES {
            assert!(
                policy.key.starts_with(r"SOFTWARE\Policies\"),
                "{} が Policies 配下ではない: {}",
                policy.label,
                policy.key
            );
        }
    }

    #[test]
    fn 設定する値を必ず持つ() {
        for policy in POLICIES {
            assert!(
                !policy.strings.is_empty() || !policy.dwords.is_empty(),
                "{} に設定する値が無い",
                policy.label
            );
        }
    }

    #[test]
    fn firefox_は_locked_を立てる() {
        // Locked が無いと利用者が about:config から戻せる
        let firefox = POLICIES
            .iter()
            .find(|p| p.label == "Mozilla Firefox")
            .expect("ある");
        assert!(firefox.dwords.contains(&("Enabled", 0)));
        assert!(firefox.dwords.contains(&("Locked", 1)));
    }
}
