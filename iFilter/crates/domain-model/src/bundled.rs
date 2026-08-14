//! 同梱するドメイン分類データ。
//!
//! DB が空のままだと**あらゆるドメインが未分類**になる。BEGINNER は未知を BLOCK
//! するので、CDN・フォント・証明書検証まで止まり「ページが真っ白になる」形で
//! 表面化する（docs/ARCHITECTURE.md §7-1）。初期状態で使える最低限を同梱する。
//!
//! ここは**データであって判定ロジックではない**。ドメインをカテゴリに割り当てる
//! だけで、どう扱うかは Profile が決める。
//!
//! DoH 対策の中核もここにある。既知の DoH プロバイダを `doh` カテゴリに入れると、
//! DNS 層は BLOCK を NXDOMAIN として返すだけで対策が成立する。ネットワーク層に
//! 特別扱いを書かずに済む（docs/adr/0007-doh-countermeasures-in-mvp.md）。

use time::OffsetDateTime;
use uuid::Uuid;

use crate::category::CategoryId;
use crate::domain::DomainName;
use crate::record::{DomainRecord, MatchScope, RecordStatus, Source};
use crate::risk::RiskLevel;

/// 同梱ドメインの UUID を導く名前空間（ASCII で `iFilter\0Bundled\0`）。
///
/// ドメイン名から決定的に ID を作る。`init` を何度実行しても同じ ID になるので、
/// `domain` の UNIQUE 制約と衝突せずに upsert できる。
const BUNDLED_NAMESPACE: Uuid = Uuid::from_u128(0x6946_696c_7465_7200_4275_6e64_6c65_6400);

/// 同梱データの分類確信度。人手で決めた分類なので最大にする。
const BUNDLED_CONFIDENCE: f32 = 1.0;

/// (ドメイン, カテゴリ, **そのドメイン自身**のリスク)
///
/// リスクはカテゴリの既定値を流し込まず 1 件ずつ書く。混ぜるとリスク上限（6 段目）が
/// カテゴリ別ルール（7 段目）を追い越す（CLAUDE.md「リスク上限にカテゴリ由来の
/// 危険度を混ぜない」）。
type Entry = (&'static str, &'static [&'static str], RiskLevel);

/// 基盤ドメイン。単体では閲覧対象にならず、止めると他のページが壊れるもの。
const INFRASTRUCTURE: &[Entry] = &[
    // Google が配信する静的資源。fonts.gstatic.com などを含む
    ("gstatic.com", &["infrastructure"], RiskLevel::Safe),
    (
        "googleusercontent.com",
        &["infrastructure"],
        RiskLevel::Safe,
    ),
    ("gvt1.com", &["infrastructure"], RiskLevel::Safe),
    ("gvt2.com", &["infrastructure"], RiskLevel::Safe),
    ("ggpht.com", &["infrastructure"], RiskLevel::Safe),
    ("cloudflare.com", &["infrastructure"], RiskLevel::Safe),
    ("jsdelivr.net", &["infrastructure"], RiskLevel::Safe),
    ("unpkg.com", &["infrastructure"], RiskLevel::Safe),
    ("bootstrapcdn.com", &["infrastructure"], RiskLevel::Safe),
    ("typekit.net", &["infrastructure"], RiskLevel::Safe),
    // 証明書の失効確認。止めると HTTPS の接続確立そのものが遅くなる・失敗する
    ("digicert.com", &["infrastructure"], RiskLevel::Safe),
    ("globalsign.com", &["infrastructure"], RiskLevel::Safe),
    ("sectigo.com", &["infrastructure"], RiskLevel::Safe),
    ("letsencrypt.org", &["infrastructure"], RiskLevel::Safe),
    // OS・ブラウザの更新と接続性チェック。止めると Windows が「インターネットなし」と表示する
    ("windowsupdate.com", &["infrastructure"], RiskLevel::Safe),
    ("msftconnecttest.com", &["infrastructure"], RiskLevel::Safe),
    ("msftncsi.com", &["infrastructure"], RiskLevel::Safe),
    ("mozilla.net", &["infrastructure"], RiskLevel::Safe),
    // 時刻同期。ずれると証明書が「期限切れ」に見えて HTTPS が全部壊れる
    ("ntp.org", &["infrastructure"], RiskLevel::Safe),
];

/// 配下すべてに及ぶ基盤ドメイン（[`MatchScope::Suffix`]）。
///
/// これらは Public Suffix List に載っているため、通常の階層マッチでは
/// **一度もヒットしない**（`d111abc.cloudfront.net` の eTLD+1 は自分自身）。
/// しかもホスト名は顧客ごとのランダム文字列なので個別登録もできない。
///
/// 配下に任意のコンテンツを置ける点は承知のうえで許可している。ランダムな
/// ホスト名を知らないと到達できないため、「`co.jp` を許可」とは危険度が異なる
/// （docs/adr/0008-infrastructure-suffix-records.md）。
///
/// **ここに足してよいのは基盤配信専用のドメインだけ。** `blogspot.com` や
/// `github.io` のように人が読めるサブドメインを第三者が取得できるものは、
/// 同じ公開サフィックスでも足してはいけない。
const INFRASTRUCTURE_SUFFIXES: &[Entry] = &[
    ("googleapis.com", &["infrastructure"], RiskLevel::Safe),
    ("cloudflare.net", &["infrastructure"], RiskLevel::Safe),
    ("akamai.net", &["infrastructure"], RiskLevel::Safe),
    ("akamaiedge.net", &["infrastructure"], RiskLevel::Safe),
    ("akamaihd.net", &["infrastructure"], RiskLevel::Safe),
    ("akamaized.net", &["infrastructure"], RiskLevel::Safe),
    ("edgekey.net", &["infrastructure"], RiskLevel::Safe),
    ("edgesuite.net", &["infrastructure"], RiskLevel::Safe),
    ("fastly.net", &["infrastructure"], RiskLevel::Safe),
    ("fastlylb.net", &["infrastructure"], RiskLevel::Safe),
    ("cloudfront.net", &["infrastructure"], RiskLevel::Safe),
    ("azureedge.net", &["infrastructure"], RiskLevel::Safe),
    ("azurefd.net", &["infrastructure"], RiskLevel::Safe),
    // 逆引き（IP → 名前）。IANA 管理で第三者が登録できず、閲覧経路にならない。
    // 止めると OS やアプリの名前解決が無用に遅くなるだけなので通す
    ("in-addr.arpa", &["infrastructure"], RiskLevel::Safe),
    ("ip6.arpa", &["infrastructure"], RiskLevel::Safe),
];

/// 検索。SafeSearch の強制は将来の課題で、ここでは分類だけ行う。
const SEARCH: &[Entry] = &[
    ("google.com", &["search"], RiskLevel::Low),
    ("google.co.jp", &["search"], RiskLevel::Low),
    ("bing.com", &["search"], RiskLevel::Low),
    ("duckduckgo.com", &["search"], RiskLevel::Low),
];

/// 学習・辞書。BEGINNER でも許可される想定のもの。
const LEARNING: &[Entry] = &[
    ("wikipedia.org", &["reference"], RiskLevel::Low),
    ("wikimedia.org", &["reference"], RiskLevel::Low),
    ("weblio.jp", &["reference"], RiskLevel::Low),
    ("kotobank.jp", &["reference"], RiskLevel::Low),
    ("mext.go.jp", &["education"], RiskLevel::Safe),
    ("khanacademy.org", &["education"], RiskLevel::Safe),
    ("scratch.mit.edu", &["education", "kids"], RiskLevel::Safe),
    ("code.org", &["education", "kids"], RiskLevel::Safe),
];

/// DoH プロバイダと Firefox の canary ドメイン。
///
/// canary は「NXDOMAIN が返ってきたら DoH を使わない」という Firefox の規約なので、
/// BLOCK → NXDOMAIN がそのまま正しい応答になる。
///
/// IP 直打ち（`8.8.8.8` など）はここでは塞げない。DNS を経由しないため。
/// WFP（Step 11〜12）の担当。
const DOH: &[Entry] = &[
    ("use-application-dns.net", &["doh"], RiskLevel::High),
    ("dns.google", &["doh"], RiskLevel::High),
    ("cloudflare-dns.com", &["doh"], RiskLevel::High),
    ("one.one.one.one", &["doh"], RiskLevel::High),
    ("quad9.net", &["doh"], RiskLevel::High),
    ("opendns.com", &["doh"], RiskLevel::High),
    ("nextdns.io", &["doh"], RiskLevel::High),
    ("adguard-dns.com", &["doh"], RiskLevel::High),
    ("cleanbrowsing.org", &["doh"], RiskLevel::High),
    ("controld.com", &["doh"], RiskLevel::High),
    ("dnscrypt.info", &["doh"], RiskLevel::High),
    ("doh.sb", &["doh"], RiskLevel::High),
];

/// 同梱データ全体を照合範囲つきで返す。
fn entries() -> impl Iterator<Item = (&'static Entry, MatchScope)> {
    INFRASTRUCTURE
        .iter()
        .chain(SEARCH)
        .chain(LEARNING)
        .chain(DOH)
        .map(|entry| (entry, MatchScope::Domain))
        .chain(
            INFRASTRUCTURE_SUFFIXES
                .iter()
                .map(|entry| (entry, MatchScope::Suffix)),
        )
}

/// 同梱ドメインを [`DomainRecord`] にして返す。
///
/// `at` は作成・更新時刻として入る。時刻を取得しないのがこの crate の制約
/// （docs/adr/0001-policy-engine-network-separation.md）。
///
/// ```
/// use domain_model::bundled_records;
/// use time::OffsetDateTime;
///
/// let records = bundled_records(OffsetDateTime::UNIX_EPOCH);
/// // 同じ入力なら ID も同じ。init を繰り返しても行が増えない
/// assert_eq!(records[0].id, bundled_records(OffsetDateTime::UNIX_EPOCH)[0].id);
/// ```
pub fn bundled_records(at: OffsetDateTime) -> Vec<DomainRecord> {
    entries()
        .map(|((domain, categories, risk_level), scope)| {
            let domain = DomainName::parse(domain).expect("同梱ドメインは妥当");
            DomainRecord {
                id: Uuid::new_v5(&BUNDLED_NAMESPACE, domain.as_str().as_bytes()),
                domain,
                categories: categories
                    .iter()
                    .map(|c| CategoryId::parse(c).expect("同梱カテゴリの ID は妥当"))
                    .collect(),
                risk_level: *risk_level,
                confidence: BUNDLED_CONFIDENCE,
                source: Source::Bundled,
                status: RecordStatus::Active,
                scope,
                version: 1,
                created_at: at,
                updated_at: at,
                deleted_at: None,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;
    use crate::category::CategoryRegistry;
    use crate::decision::Decision;
    use crate::profile::Profile;

    fn records() -> Vec<DomainRecord> {
        bundled_records(OffsetDateTime::UNIX_EPOCH)
    }

    #[test]
    fn すべてのドメインが解釈できる() {
        assert_eq!(records().len(), entries().count()); // parse で panic しない
    }

    #[test]
    fn ドメインが重複していない() {
        let records = records();
        let unique: HashSet<_> = records.iter().map(|r| r.domain.clone()).collect();
        assert_eq!(unique.len(), records.len(), "同じドメインが 2 回入っている");
    }

    #[test]
    fn id_はドメインから決定的に決まる() {
        // init を繰り返しても行が重複しないことの根拠
        let first = records();
        let second = bundled_records(OffsetDateTime::from_unix_timestamp(1_000_000).expect("妥当"));
        for (a, b) in first.iter().zip(&second) {
            assert_eq!(a.id, b.id, "{} の ID が実行ごとに変わる", a.domain);
        }
    }

    #[test]
    fn 未登録のカテゴリを使っていない() {
        let registry = CategoryRegistry::builtin();
        for record in records() {
            for category in &record.categories {
                assert!(
                    registry.get(category).is_some(),
                    "{} が未登録のカテゴリ {category} を使っている",
                    record.domain
                );
            }
        }
    }

    #[test]
    fn 公開サフィックスは_suffix_スコープでしか登録しない() {
        // Domain スコープで公開サフィックスを登録しても `match_candidates` が空になり、
        // 配下のドメインには**一度もヒットしない**。同梱した意味がなくなる
        let offenders: Vec<_> = records()
            .into_iter()
            .filter(|r| r.scope == MatchScope::Domain && !r.domain.is_registrable())
            .map(|r| r.domain.to_string())
            .collect();
        assert!(
            offenders.is_empty(),
            "公開サフィックスを Domain スコープで登録している: {}",
            offenders.join(", ")
        );
    }

    #[test]
    fn suffix_スコープは基盤カテゴリだけ() {
        // 配下すべてに及ぶ強い設定なので、対象を基盤配信に限る。
        // adult や search をサフィックスで登録すると影響範囲が読めなくなる
        let infrastructure = CategoryId::parse("infrastructure").expect("妥当");
        for record in records() {
            if record.scope == MatchScope::Suffix {
                assert_eq!(
                    record.categories,
                    vec![infrastructure.clone()],
                    "{} が infrastructure 以外で Suffix スコープになっている",
                    record.domain
                );
            }
        }
    }

    #[test]
    fn 分類済みとして扱われる() {
        // unknown だけのレコードがあると未知扱いに落ちて同梱した意味がなくなる
        for record in records() {
            assert!(!record.is_unclassified(), "{} が未分類扱い", record.domain);
        }
    }

    #[test]
    fn doh_はすべてのプロファイルで_block() {
        // 1 つでも通ると DNS フィルターごと素通りされる
        let doh = CategoryId::parse("doh").expect("妥当");
        for profile in [
            Profile::beginner(),
            Profile::beginner_plus(),
            Profile::standard(),
            Profile::teen(),
        ] {
            assert_eq!(
                profile.category_rule(&doh),
                Some(Decision::Block),
                "{} で doh が BLOCK になっていない",
                profile.id
            );
        }
    }

    #[test]
    fn firefox_の_canary_ドメインが入っている() {
        // これが無いと Firefox は既定で DoH を有効にし、DNS フィルターに何も届かない
        let canary = DomainName::parse("use-application-dns.net").expect("妥当");
        let record = records()
            .into_iter()
            .find(|r| r.domain == canary)
            .expect("canary ドメインが同梱されていない");
        assert!(
            record
                .categories
                .contains(&CategoryId::parse("doh").expect("妥当"))
        );
    }

    #[test]
    fn 基盤ドメインは_beginner_のリスク上限を超えない() {
        // 超えるとリスク上限（6 段目）で BLOCK され、カテゴリ Allow に到達しない
        let ceiling = Profile::beginner().risk_ceiling;
        let infrastructure = CategoryId::parse("infrastructure").expect("妥当");
        for record in records() {
            if record.categories.contains(&infrastructure) {
                assert!(
                    !record.risk_level.exceeds(ceiling),
                    "{} のリスクが BEGINNER の上限を超えている",
                    record.domain
                );
            }
        }
    }
}
