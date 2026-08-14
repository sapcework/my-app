//! TEST_PLAN.md §1-6: Decision Trace。
//!
//! `Verdict` はデバッグ専用ではなく保護者 UI にそのまま表示する。
//! 「なぜブロックされたか」が正しく残ることを確認する。

mod common;

use common::{Scenario, parent_allow, record, record_with_risk, scenario_for};
use domain_model::{Decision, OverrideScope, ProfileId, Reason, RiskLevel, Stage, StageOutcome};

#[test]
fn 未知ドメインの判定内容が一式そろう() {
    let verdict = Scenario::beginner().evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.unknown.block");
    assert_eq!(verdict.profile, ProfileId::Beginner);
    assert_eq!(verdict.matched_domain, None); // レコードが無いので一致ドメインも無い
}

#[test]
fn 保護者の許可の判定内容が一式そろう() {
    let verdict = Scenario::beginner()
        .with_override(parent_allow(
            "school.example.jp",
            OverrideScope::IncludeSubdomains,
        ))
        .evaluate("www.school.example.jp");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::ParentAllow);
    assert_eq!(verdict.matched_rule.as_str(), "parent.allow");
    assert_eq!(
        verdict.matched_domain.expect("一致あり").as_str(),
        "school.example.jp"
    );
}

#[test]
fn review_を_block_に落としても理由は元のまま残る() {
    // BEGINNER で news(Review) → 表示は BLOCK だが、理由は「本来は要確認」
    let verdict = Scenario::beginner()
        .with_record(record("news.example.com", &["news"]))
        .evaluate("news.example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::CategoryPolicy);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.category.news");

    // trace には落とす前の REVIEW が残る
    let step = verdict
        .trace
        .iter()
        .find(|s| s.stage == Stage::CategoryPolicy)
        .expect("段がある");
    assert_eq!(step.outcome, StageOutcome::Hit(Decision::Review));
}

#[test]
fn 確定した段までが順番どおりに並ぶ() {
    let verdict = Scenario::beginner()
        .with_record(record_with_risk(
            "example.com",
            &["education"],
            RiskLevel::Critical,
        ))
        .evaluate("example.com");

    let stages: Vec<Stage> = verdict.trace.iter().map(|s| s.stage).collect();
    assert_eq!(
        stages,
        vec![
            Stage::EmergencyBlock,
            Stage::ParentBlock,
            Stage::ForcedCategory,
            Stage::ParentAllow,
            Stage::TimeWindow,
            Stage::RiskCeiling, // ここで確定
        ]
    );

    let last = verdict.trace.last().expect("段がある");
    assert_eq!(last.outcome, StageOutcome::Hit(Decision::Block));
}

#[test]
fn 設定が無い段は_skip_該当しない段は_miss() {
    let verdict = Scenario::beginner()
        .with_override(parent_allow(
            "other.example.com",
            OverrideScope::ExactDomain,
        ))
        .evaluate("example.com");

    let outcome = |stage: Stage| {
        verdict
            .trace
            .iter()
            .find(|s| s.stage == stage)
            .map(|s| s.outcome)
            .expect("段がある")
    };

    // 緊急ブロックリストは空 → skip
    assert_eq!(outcome(Stage::EmergencyBlock), StageOutcome::Skip);
    // 保護者設定はあるが、このドメインには当たらない → miss
    assert_eq!(outcome(Stage::ParentBlock), StageOutcome::Miss);
    assert_eq!(outcome(Stage::ParentAllow), StageOutcome::Miss);
    // レコードが無いのでリスクもカテゴリも評価対象が無い → skip
    assert_eq!(outcome(Stage::RiskCeiling), StageOutcome::Skip);
    assert_eq!(outcome(Stage::CategoryPolicy), StageOutcome::Skip);
}

#[test]
fn 全段を通過する経路がある() {
    let verdict = scenario_for(ProfileId::Standard)
        .with_record(record_with_risk(
            "example.com",
            &["crypto"],
            RiskLevel::Safe,
        ))
        .evaluate("example.com");

    assert_eq!(verdict.trace.len(), 9);
    assert_eq!(verdict.reason, Reason::ProfileDefault);

    let stages: Vec<Stage> = verdict.trace.iter().map(|s| s.stage).collect();
    assert_eq!(stages, Stage::ORDER.to_vec());
}

#[test]
fn trace_は_json_にできる() {
    // 保護者 UI とログに渡すため
    let verdict = Scenario::beginner().evaluate("example.com");
    let json = serde_json::to_string(&verdict).expect("書ける");

    assert!(json.contains("unknown_domain"));
    assert!(json.contains("beginner.unknown.block"));

    let restored: domain_model::Verdict = serde_json::from_str(&json).expect("読める");
    assert_eq!(restored, verdict);
}
