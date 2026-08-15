//! 判定 9 段が仕様どおりに動くことの確認（Step 3 の受け入れ確認）。
//!
//! 網羅的なケース表は Step 4 で TEST_PLAN.md §1 に沿って追加する。

mod common;

use common::{Scenario, parent_allow, parent_block, record, record_with_risk, scenario_for};
use domain_model::{
    Decision, OverrideScope, ProfileId, Reason, RiskLevel, Stage, StageOutcome, TraceStep,
};

fn outcome_of(trace: &[TraceStep], stage: Stage) -> Option<StageOutcome> {
    trace
        .iter()
        .find(|step| step.stage == stage)
        .map(|step| step.outcome)
}

#[test]
fn 未知ドメインは_beginner_で_block() {
    let verdict = Scenario::beginner().evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.unknown.block");
    assert_eq!(verdict.matched_domain, None);
}

#[test]
fn 未知ドメインは_standard_で_review() {
    let verdict = scenario_for(ProfileId::Standard).evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Review);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
    assert_eq!(verdict.matched_rule.as_str(), "standard.unknown.review");
}

#[test]
fn 学習サイトは_beginner_でも_allow() {
    let verdict = Scenario::beginner()
        .with_record(record("school.example.jp", &["education"]))
        .evaluate("school.example.jp");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::CategoryPolicy);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.category.education");
}

#[test]
fn 成人向けは_block() {
    let verdict = Scenario::beginner()
        .with_record(record("bad.example.com", &["adult"]))
        .evaluate("bad.example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::CategoryPolicy);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.category.adult");
}

#[test]
fn リスク上限は分類が安全でも危険なドメインを止める() {
    // 「教育サイトに分類されているが、このドメイン自体はマルウェア配布が確認されている」
    // というケース。カテゴリ判定を追い越して止まるのがリスク上限の役割
    let verdict = Scenario::beginner()
        .with_record(record_with_risk(
            "school.example.jp",
            &["education"],
            RiskLevel::Critical,
        ))
        .evaluate("school.example.jp");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::RiskCeiling);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.risk.critical");
}

#[test]
fn リスク上限はカテゴリ別ルールを潰さない() {
    // BEGINNER_PLUS は video を Allow と定めている。リスク上限がカテゴリ由来の危険度を
    // 見ていた頃は、この設定が 6 段目で潰されて永久に効かなかった
    let verdict = scenario_for(ProfileId::BeginnerPlus)
        .with_record(record("video.example.com", &["video"]))
        .evaluate("video.example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::CategoryPolicy);
}

#[test]
fn standard_の_social_は_review_のまま届く() {
    let verdict = scenario_for(ProfileId::Standard)
        .with_record(record("sns.example.com", &["social"]))
        .evaluate("sns.example.com");

    assert_eq!(verdict.decision, Decision::Review);
    assert_eq!(verdict.reason, Reason::CategoryPolicy);
}

#[test]
fn 階層マッチでサブドメインにも分類が及ぶ() {
    let verdict = Scenario::beginner()
        .with_record(record("example.jp", &["education"]))
        .evaluate("www.lesson.example.jp");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(
        verdict.matched_domain.expect("一致あり").as_str(),
        "example.jp"
    );
}

#[test]
fn 別ドメインには及ばない() {
    // notexample.jp は example.jp のサブドメインではない
    let verdict = Scenario::beginner()
        .with_record(record("example.jp", &["education"]))
        .evaluate("notexample.jp");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
}

#[test]
fn 複数カテゴリは最も制限的なものが勝つ() {
    // kids(Allow) かつ video(Review) → Review。BEGINNER なので最終的に Block へ落ちる
    let verdict = Scenario::beginner()
        .with_record(record_with_risk(
            "kids.example.com",
            &["kids", "video"],
            RiskLevel::Safe,
        ))
        .evaluate("kids.example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::CategoryPolicy);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.category.video");

    // trace には落とす前の REVIEW が残っている
    assert_eq!(
        outcome_of(&verdict.trace, Stage::CategoryPolicy),
        Some(StageOutcome::Hit(Decision::Review))
    );
}

#[test]
fn 保護者の許可は未知ドメインより優先する() {
    let verdict = Scenario::beginner()
        .with_override(parent_allow(
            "example.com",
            OverrideScope::IncludeSubdomains,
        ))
        .evaluate("sub.example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::ParentAllow);
    assert_eq!(verdict.matched_rule.as_str(), "parent.allow");
}

#[test]
fn 保護者の拒否は許可より優先する() {
    let verdict = Scenario::beginner()
        .with_record(record("example.com", &["education"]))
        .with_override(parent_allow("example.com", OverrideScope::ExactDomain))
        .with_override(parent_block("example.com", OverrideScope::ExactDomain))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::ParentBlock);
}

#[test]
fn 緊急ブロックは保護者の許可より優先する() {
    let verdict = Scenario::beginner()
        .with_emergency("example.com")
        .with_override(parent_allow(
            "example.com",
            OverrideScope::IncludeSubdomains,
        ))
        .evaluate("sub.example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::EmergencyBlock);
}

#[test]
fn 基盤ドメインは_beginner_でも通る() {
    // これが通らないと、許可したページが CDN やフォントの遮断で崩れる
    let verdict = Scenario::beginner()
        .with_record(record("cdn.example.net", &["infrastructure"]))
        .evaluate("cdn.example.net");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(
        verdict.matched_rule.as_str(),
        "beginner.category.infrastructure"
    );
}

#[test]
fn trace_に_9_段すべてが並ぶ() {
    // どの段にも当たらず 9 段目まで到達する状況を作る
    let verdict = scenario_for(ProfileId::Standard)
        .with_record(record_with_risk(
            "example.com",
            &["crypto"],
            RiskLevel::Safe,
        ))
        .evaluate("example.com");

    assert_eq!(verdict.reason, Reason::ProfileDefault);
    assert_eq!(verdict.matched_rule.as_str(), "standard.default.review");
    assert_eq!(verdict.trace.len(), 9);

    let stages: Vec<Stage> = verdict.trace.iter().map(|s| s.stage).collect();
    assert_eq!(stages, Stage::ORDER.to_vec(), "段の順序が仕様と違う");
}

#[test]
fn 確定した段より後ろは_trace_に載らない() {
    let verdict = Scenario::beginner()
        .with_override(parent_allow("example.com", OverrideScope::ExactDomain))
        .evaluate("example.com");

    // 4 段目で確定するので 5 段目以降は評価していない
    assert_eq!(verdict.trace.len(), 4);
    assert_eq!(outcome_of(&verdict.trace, Stage::TimeWindow), None);
}

#[test]
fn 時間帯ルールは_mvp_では評価されない() {
    // 段は必ず skip になる。ここが変わるときは docs/ROADMAP.md Step 5 も更新する
    let verdict = Scenario::beginner().evaluate("example.com");
    assert_eq!(
        outcome_of(&verdict.trace, Stage::TimeWindow),
        Some(StageOutcome::Skip)
    );
}

#[test]
fn 強制ブロックカテゴリは_doh_以外では該当しない() {
    // 集合には doh が入っている（ADR-0009）ので段は評価される。
    // 関係ないドメインは通り抜けて次の段へ進む
    let verdict = Scenario::beginner().evaluate("example.com");
    assert_eq!(
        outcome_of(&verdict.trace, Stage::ForcedCategory),
        Some(StageOutcome::Miss)
    );
}

#[test]
fn 強制ブロックカテゴリは_doh_で該当する() {
    let verdict = Scenario::beginner()
        .with_record(record("dns.google", &["doh"]))
        .evaluate("dns.google");
    assert_eq!(
        outcome_of(&verdict.trace, Stage::ForcedCategory),
        Some(StageOutcome::Hit(Decision::Block))
    );
    assert_eq!(verdict.matched_rule.as_str(), "beginner.forced.doh");
}

#[test]
fn 判定は決定的() {
    let scenario = Scenario::beginner().with_record(record("example.com", &["kids", "video"]));
    let first = scenario.evaluate("example.com");
    let second = scenario.evaluate("example.com");
    assert_eq!(first, second);
}
