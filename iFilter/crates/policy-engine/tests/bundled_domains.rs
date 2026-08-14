//! 同梱ドメインが**実在のホスト名に効くか**を確かめる。
//!
//! 分類を登録しただけでは足りない。CDN の多くは Public Suffix List に載っており、
//! 階層マッチが eTLD+1 で打ち切られるせいで「登録してあるのに一度もヒットしない」
//! という失敗が起きる（docs/adr/0008-infrastructure-suffix-records.md）。
//!
//! ブラウザが実際に引くホスト名で照合し、判定まで通して確認する。

mod common;

use common::{Scenario, category, domain, now, record};
use domain_model::{Decision, DomainName, Profile, ProfileId, RecordStatus, bundled_records};

fn bundled() -> Scenario {
    Scenario::beginner().with_records(bundled_records(now()))
}

/// (ブラウザが実際に引くホスト名, ヒットしてほしい同梱レコード)
///
/// CDN のホスト名は顧客ごとのランダム文字列なので、形だけ真似た代表値を使う。
const SAMPLES: &[(&str, &str)] = &[
    // 静的資源・フォント
    ("fonts.gstatic.com", "gstatic.com"),
    ("ajax.googleapis.com", "googleapis.com"),
    ("lh3.googleusercontent.com", "googleusercontent.com"),
    ("cdn.jsdelivr.net", "jsdelivr.net"),
    // CDN。ここが効かないと許可したページが部品の BLOCK で崩れる
    ("d111abcdef8.cloudfront.net", "cloudfront.net"),
    ("e1234.a.akamaiedge.net", "akamaiedge.net"),
    ("a1.akamai.net", "akamai.net"),
    ("example.akamaized.net", "akamaized.net"),
    ("freetls.fastly.net", "fastly.net"),
    ("example.azureedge.net", "azureedge.net"),
    // 証明書の失効確認
    ("ocsp.digicert.com", "digicert.com"),
    // 逆引き。止めても閲覧は防げず、名前解決が遅くなるだけ
    ("1.0.0.127.in-addr.arpa", "in-addr.arpa"),
    // 学習・検索
    ("ja.wikipedia.org", "wikipedia.org"),
    ("www.google.com", "google.com"),
    // DoH。ここが効かないと DNS フィルターごと素通りされる
    ("use-application-dns.net", "use-application-dns.net"),
    ("mozilla.cloudflare-dns.com", "cloudflare-dns.com"),
    ("dns.google", "dns.google"),
    ("one.one.one.one", "one.one.one.one"),
];

#[test]
fn 実在のホスト名が同梱レコードにヒットする() {
    let scenario = bundled();

    let mut misses = Vec::new();
    for (queried, expected) in SAMPLES {
        match scenario.records.lookup(&domain(queried)) {
            Some(found) if found.domain.as_str() == *expected => {}
            Some(found) => misses.push(format!("{queried} → {}（期待: {expected}）", found.domain)),
            None => misses.push(format!("{queried} → ヒットなし（期待: {expected}）")),
        }
    }

    assert!(
        misses.is_empty(),
        "同梱レコードが実在のホスト名に効いていない:\n  {}",
        misses.join("\n  ")
    );
}

#[test]
fn 基盤ドメインは_beginner_でも通る() {
    // ARCHITECTURE.md §7-1 の中心。ここが通らないと「ページは開くが崩れる」になる
    let scenario = bundled();
    let infrastructure = category("infrastructure");

    for (queried, _) in SAMPLES {
        let Some(found) = scenario.records.lookup(&domain(queried)) else {
            continue;
        };
        if found.categories.contains(&infrastructure) {
            assert_eq!(
                scenario.evaluate(queried).decision,
                Decision::Allow,
                "{queried} が BEGINNER で通らない"
            );
        }
    }
}

#[test]
fn doh_はどのプロファイルでも遮断される() {
    // 1 つでも通ると、ブラウザが DoH に切り替えて DNS フィルターに何も届かなくなる
    let names = ["use-application-dns.net", "dns.google", "one.one.one.one"];

    for id in common::PROFILES_STRICT_TO_LOOSE {
        let scenario =
            Scenario::new(Profile::builtin(id).expect("同梱")).with_records(bundled_records(now()));
        for name in names {
            assert_eq!(
                scenario.evaluate(name).decision,
                Decision::Block,
                "{id} で {name} が遮断されていない"
            );
        }
    }
}

#[test]
fn 未成年に見せたくないカテゴリは同梱データでも遮断される() {
    // 同梱データを増やしたときに、うっかり緩めていないことの確認
    let scenario = bundled();
    assert_eq!(
        scenario.evaluate("adguard-dns.com").decision,
        Decision::Block
    );
}

#[test]
fn サフィックス許可は個別の分類に負ける() {
    // cloudfront.net を一括許可しても、その配下に付けた分類のほうが勝つ。
    // 逆だと「CDN 上の有害サイト」を個別に止められなくなる
    let scenario = bundled().with_record(record("evil.cloudfront.net", &["adult"]));

    assert_eq!(
        scenario.evaluate("evil.cloudfront.net").decision,
        Decision::Block
    );
    assert_eq!(
        scenario.evaluate("safe.cloudfront.net").decision,
        Decision::Allow,
        "無関係なホスト名まで巻き添えにしている"
    );
}

#[test]
fn サフィックス照合はラベル境界で行う() {
    // `ends_with` で実装すると notcloudfront.net が cloudfront.net にヒットする
    let scenario = bundled();
    assert!(
        scenario
            .records
            .lookup(&domain("notcloudfront.net"))
            .is_none(),
        "別ドメインが CDN の許可を横取りしている"
    );
    assert!(
        scenario
            .records
            .lookup(&domain("cloudfront.net.example.com"))
            .is_none()
    );
}

#[test]
fn 無効化したサフィックスレコードは使われない() {
    let mut disabled = bundled_records(now())
        .into_iter()
        .find(|r| r.domain == DomainName::parse("cloudfront.net").expect("妥当"))
        .expect("同梱されている");
    disabled.status = RecordStatus::Disabled;

    let scenario = bundled().with_record(disabled);
    assert!(
        scenario
            .records
            .lookup(&domain("d111abcdef8.cloudfront.net"))
            .is_none()
    );
}

#[test]
fn 同梱にないドメインは未知のまま() {
    // 同梱データが増えても「未知は BLOCK」の既定が壊れていないこと
    let scenario = bundled();
    assert!(
        scenario
            .records
            .lookup(&domain("some-unclassified-site.com"))
            .is_none()
    );

    let verdict = scenario.evaluate("some-unclassified-site.com");
    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(scenario.profile.id, ProfileId::Beginner);
}
