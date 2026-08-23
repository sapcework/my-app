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

use windows_registry::{Key, LOCAL_MACHINE};

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
    apply_in(LOCAL_MACHINE)
}

/// ポリシーを取り消す。
pub fn revert() -> Result<Vec<String>, String> {
    revert_in(LOCAL_MACHINE)
}

/// 現在の設定状況を読む。`status` の表示に使う。
pub fn is_applied() -> Vec<(String, bool)> {
    is_applied_in(LOCAL_MACHINE)
}

fn apply_in(root: &Key) -> Result<Vec<String>, String> {
    let mut applied = Vec::new();

    for policy in POLICIES {
        let key = root
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

/// **キーごとは消さない。** 他の管理設定が同じキーに同居している場合に
/// まとめて消してしまうため、iFilter が書いた値だけを消す。
///
/// 消したあとに**読み返して確かめる**。`remove_value` の失敗を握りつぶすと
/// 「取り消しました」と言いながら設定が残る。2026-08-23 の実機確認で実際に起きた
/// （読み取り専用で開いていたためアクセス拒否になっていた）。
fn revert_in(root: &Key) -> Result<Vec<String>, String> {
    let mut reverted = Vec::new();
    let mut failed = Vec::new();

    for policy in POLICIES {
        if !remains(root, policy) {
            continue; // 元から無い
        }

        // **読み書き両方で開く。** `open` は読み取り専用なので、
        // それで開くと `remove_value` がアクセス拒否で失敗する
        if let Ok(key) = root.options().read().write().open(policy.key) {
            for name in value_names(policy) {
                let _ = key.remove_value(name); // 無い値のエラーは無視してよい
            }
        }

        if remains(root, policy) {
            failed.push(policy.label);
        } else {
            reverted.push(policy.label.to_owned());
        }
    }

    if !failed.is_empty() {
        return Err(format!(
            "{} のポリシーを取り消せませんでした（値が残っています）。\
             管理者として実行しているか確認してください。",
            failed.join(", ")
        ));
    }

    Ok(reverted)
}

fn is_applied_in(root: &Key) -> Vec<(String, bool)> {
    POLICIES
        .iter()
        .map(|policy| {
            let ok = root.open(policy.key).is_ok_and(|key| {
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

/// iFilter が書いた値がまだ 1 つでも残っているか。
///
/// 値の**中身**は見ない。取り消せたかどうかの判断なので、消えたかだけを見る。
fn remains(root: &Key, policy: &Policy) -> bool {
    root.open(policy.key).is_ok_and(|key| {
        policy
            .strings
            .iter()
            .any(|(name, _)| key.get_string(name).is_ok())
            || policy
                .dwords
                .iter()
                .any(|(name, _)| key.get_u32(name).is_ok())
    })
}

fn value_names(policy: &Policy) -> impl Iterator<Item = &'static str> {
    policy
        .strings
        .iter()
        .map(|(name, _)| *name)
        .chain(policy.dwords.iter().map(|(name, _)| *name))
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

    /// 取り消しが**本当に消えている**ことを確かめる。
    ///
    /// 2026-08-23 の実機確認では、読み取り専用で開いていたため `remove_value` が
    /// アクセス拒否で失敗し、それを握りつぶして「取り消しました」と報告していた。
    /// エラーは出ないので、保護者が解除したつもりでポリシーだけが残る。
    ///
    /// HKLM には管理者権限が要るので、HKCU の**専用の置き場**を根にして同じ道を通す。
    /// 実際のポリシーの位置ではないため、この試験がブラウザに影響することはない。
    #[test]
    fn 取り消すと値が本当に消える() {
        use windows_registry::CURRENT_USER;

        const ROOT: &str = r"Software\iFilter\test-browser-policy";
        let root = CURRENT_USER.create(ROOT).expect("作れる");

        assert_eq!(apply_in(&root).expect("書ける").len(), POLICIES.len());
        assert!(
            is_applied_in(&root).iter().all(|(_, ok)| *ok),
            "書き込みが効いていない"
        );

        let reverted = revert_in(&root).expect("取り消せる");
        assert_eq!(reverted.len(), POLICIES.len());
        for policy in POLICIES {
            assert!(
                !remains(&root, policy),
                "{} の値が残ったまま成功と報告された",
                policy.label
            );
        }

        // 元から無い状態で呼んでも落ちず、空で返る
        assert!(revert_in(&root).expect("落ちない").is_empty());

        let _ = CURRENT_USER.remove_tree(ROOT);
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
