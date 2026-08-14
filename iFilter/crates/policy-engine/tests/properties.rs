//! TEST_PLAN.md §1-7: プロパティテスト。
//!
//! 個別のケース表では拾えない「表を編集したときの事故」を捕まえる。

mod common;

use common::{PROFILES_STRICT_TO_LOOSE, Scenario, record_with_risk, scenario_for};
use domain_model::{Decision, ProfileId, RiskLevel};
use proptest::prelude::*;

/// プロファイルにルールがあるカテゴリ。合成の対象になるもの。
const CATEGORIES: &[&str] = &[
    "education",
    "kids",
    "reference",
    "search",
    "infrastructure",
    "news",
    "video",
    "gaming",
    "shopping",
    "social",
    "forum",
    "chat",
    "dating",
    "adult",
    "gambling",
    "violence",
    "drugs",
    "weapons",
    "self_harm",
    "malware",
    "phishing",
    "fraud",
    "piracy",
    "unknown",
];

const RISKS: &[RiskLevel] = &[
    RiskLevel::Safe,
    RiskLevel::Low,
    RiskLevel::Medium,
    RiskLevel::High,
    RiskLevel::Critical,
    RiskLevel::Unknown,
];

/// パースできるドメイン名を生成する。
fn arb_domain() -> impl Strategy<Value = String> {
    (
        prop::collection::vec("[a-z][a-z0-9]{0,7}", 1..4),
        prop::sample::select(vec!["com", "jp", "net", "co.jp", "example"]),
    )
        .prop_map(|(labels, tld)| format!("{}.{tld}", labels.join(".")))
}

fn arb_categories() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(
        prop::sample::select(CATEGORIES).prop_map(str::to_owned),
        0..4,
    )
}

fn arb_risk() -> impl Strategy<Value = RiskLevel> {
    prop::sample::select(RISKS)
}

/// 反例の保存先。統合テストは lib.rs を持たないため、proptest の既定では
/// 保存先を見つけられず警告が出る。明示すると反例が記録され、次回以降まず再現される。
fn config() -> ProptestConfig {
    ProptestConfig {
        failure_persistence: Some(Box::new(
            proptest::test_runner::FileFailurePersistence::Direct(
                "tests/proptest-regressions/properties.txt",
            ),
        )),
        ..ProptestConfig::default()
    }
}

proptest! {
    #![proptest_config(config())]

    /// 厳しいプロファイルの判定が、緩いプロファイルより緩くなることはない。
    ///
    /// カテゴリ表やリスク上限を編集したときの事故をこれ 1 本で捕まえる。
    #[test]
    fn プロファイルの厳しさは単調(
        domain in arb_domain(),
        categories in arb_categories(),
        risk in arb_risk(),
    ) {
        let refs: Vec<&str> = categories.iter().map(String::as_str).collect();

        let decisions: Vec<Decision> = PROFILES_STRICT_TO_LOOSE
            .iter()
            .map(|profile| {
                scenario_for(*profile)
                    .with_record(record_with_risk(&domain, &refs, risk))
                    .evaluate(&domain)
                    .decision
            })
            .collect();

        for (index, pair) in decisions.windows(2).enumerate() {
            prop_assert!(
                pair[0].restrictiveness() >= pair[1].restrictiveness(),
                "{} が {} より緩い（domain={domain}, categories={categories:?}, risk={:?}）",
                PROFILES_STRICT_TO_LOOSE[index],
                PROFILES_STRICT_TO_LOOSE[index + 1],
                risk,
            );
        }
    }

    /// 同じ入力なら常に同じ結果になる。
    #[test]
    fn 判定は決定的(
        domain in arb_domain(),
        categories in arb_categories(),
        risk in arb_risk(),
    ) {
        let refs: Vec<&str> = categories.iter().map(String::as_str).collect();
        let scenario = Scenario::beginner().with_record(record_with_risk(&domain, &refs, risk));

        prop_assert_eq!(scenario.evaluate(&domain), scenario.evaluate(&domain));
    }

    /// BEGINNER は、保護者の設定が無いかぎり ALLOW を出さない…
    /// ということはない（education などは通る）。ただし **REVIEW は決して出さない**。
    #[test]
    fn beginner_は_review_を返さない(
        domain in arb_domain(),
        categories in arb_categories(),
        risk in arb_risk(),
    ) {
        let refs: Vec<&str> = categories.iter().map(String::as_str).collect();
        let verdict = Scenario::beginner()
            .with_record(record_with_risk(&domain, &refs, risk))
            .evaluate(&domain);

        prop_assert_ne!(verdict.decision, Decision::Review, "review_as_block が効いていない");
    }

    /// 分類情報が無いドメインは、BEGINNER では必ず BLOCK になる。
    #[test]
    fn beginner_では未知は必ず_block(domain in arb_domain()) {
        let verdict = Scenario::beginner().evaluate(&domain);
        prop_assert_eq!(verdict.decision, Decision::Block);
        prop_assert_eq!(verdict.reason, domain_model::Reason::UnknownDomain);
    }

    /// 判定には必ず理由とルール ID が付く。保護者に説明できない判定を作らない。
    #[test]
    fn 判定には必ず理由が付く(
        domain in arb_domain(),
        categories in arb_categories(),
        risk in arb_risk(),
        profile in prop::sample::select(PROFILES_STRICT_TO_LOOSE.to_vec()),
    ) {
        let refs: Vec<&str> = categories.iter().map(String::as_str).collect();
        let verdict = scenario_for(profile)
            .with_record(record_with_risk(&domain, &refs, risk))
            .evaluate(&domain);

        prop_assert!(!verdict.matched_rule.as_str().is_empty());
        prop_assert!(!verdict.trace.is_empty());
        prop_assert!(verdict.trace.len() <= 9);
    }
}

#[test]
fn 単調性の前提となるプロファイル順が正しい() {
    // PROFILES_STRICT_TO_LOOSE の並びが実際に厳しい順であることを、
    // リスク上限と未知ポリシーの両面で確認する
    assert_eq!(PROFILES_STRICT_TO_LOOSE[0], ProfileId::Beginner);
    assert_eq!(PROFILES_STRICT_TO_LOOSE[3], ProfileId::Teen);

    let ceilings: Vec<u8> = PROFILES_STRICT_TO_LOOSE
        .iter()
        .map(|id| {
            domain_model::Profile::builtin(*id)
                .expect("同梱")
                .risk_ceiling
                .severity()
        })
        .collect();

    for pair in ceilings.windows(2) {
        assert!(pair[0] <= pair[1], "リスク上限が厳しい順になっていない");
    }
}
