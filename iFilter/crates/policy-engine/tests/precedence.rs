//! TEST_PLAN.md §1-3: 判定順序。
//!
//! 各段が「1 つ上の段に負ける」ことを 1 ケースずつ確認する。
//! 順序を組み替えるとここが落ちる。

mod common;

use common::{
    Scenario, beginner_tweaked, category, parent_allow, parent_block, record, record_with_risk,
};
use domain_model::{Decision, OverrideScope, Reason, RiskLevel, TimeRule};
use uuid::Uuid;

#[test]
fn 緊急ブロック_が_保護者の許可_に勝つ() {
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
fn 保護者の拒否_が_保護者の許可_に勝つ() {
    let verdict = Scenario::beginner()
        .with_override(parent_allow("example.com", OverrideScope::ExactDomain))
        .with_override(parent_block("example.com", OverrideScope::ExactDomain))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::ParentBlock);
}

#[test]
fn 強制ブロックカテゴリ_が_保護者の許可_に勝つ() {
    // MVP では集合が空なので保護者はすべて解除できる。
    // 集合に足すだけで解除不可になることを確認する（docs/adr/0005-decision-priority.md）
    let profile = beginner_tweaked(|p| {
        p.forced_block_categories.insert(category("adult"));
    });

    let verdict = Scenario::new(profile)
        .with_record(record("bad.example.com", &["adult"]))
        .with_override(parent_allow("bad.example.com", OverrideScope::ExactDomain))
        .evaluate("bad.example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::ForcedCategory);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.forced.adult");
}

#[test]
fn 強制ブロックが空なら保護者が解除できる() {
    // 上のテストの対。MVP の要件そのもの
    let verdict = Scenario::beginner()
        .with_record(record("bad.example.com", &["adult"]))
        .with_override(parent_allow("bad.example.com", OverrideScope::ExactDomain))
        .evaluate("bad.example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::ParentAllow);
}

#[test]
fn 保護者の許可_が_時間帯ルール_に勝つ() {
    // 時間帯ルールは MVP では評価されないが、段の位置は今のうちに固定しておく。
    // 実装が入ったときにこのテストが順序を守らせる
    let profile = beginner_tweaked(|p| {
        p.time_rules.push(TimeRule {
            id: Uuid::nil(),
            days_mask: 0b0111_1111, // 全曜日
            start_minute: 0,
            end_minute: 1440,
            action: Decision::Block,
            hard: false,
        });
    });

    let verdict = Scenario::new(profile)
        .with_override(parent_allow("example.com", OverrideScope::ExactDomain))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::ParentAllow);
}

#[test]
fn 保護者の許可_が_リスク上限_に勝つ() {
    let verdict = Scenario::beginner()
        .with_record(record_with_risk(
            "example.com",
            &["education"],
            RiskLevel::Critical,
        ))
        .with_override(parent_allow("example.com", OverrideScope::ExactDomain))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::ParentAllow);
}

#[test]
fn リスク上限_が_カテゴリ別ルール_に勝つ() {
    // education は Allow だが、このドメイン自身の危険度が critical
    let verdict = Scenario::beginner()
        .with_record(record_with_risk(
            "example.com",
            &["education"],
            RiskLevel::Critical,
        ))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::RiskCeiling);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.risk.critical");
}

#[test]
fn カテゴリ別ルール_が_未知ポリシー_に勝つ() {
    let verdict = Scenario::beginner()
        .with_record(record("example.com", &["education"]))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::CategoryPolicy); // UnknownDomain ではない
}

#[test]
fn 未知ポリシー_が_プロファイル既定_に勝つ() {
    // 両者の結果を変えて、どちらで確定したかを区別できるようにする
    let profile = beginner_tweaked(|p| {
        p.unknown_policy = Decision::Allow;
        p.default_decision = Decision::Block;
        p.review_as_block = false;
    });

    let verdict = Scenario::new(profile).evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.unknown.allow");
}

#[test]
fn 分類済みなら未知ポリシーには落ちない() {
    // ルールの無いカテゴリ。未分類ではないので 8 段目を素通りして 9 段目へ
    let profile = beginner_tweaked(|p| {
        p.unknown_policy = Decision::Allow;
        p.default_decision = Decision::Block;
        p.review_as_block = false;
    });

    let verdict = Scenario::new(profile)
        .with_record(record("example.com", &["crypto"]))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::ProfileDefault);
}

#[test]
fn カテゴリが_unknown_だけなら未分類として扱う() {
    let verdict = Scenario::beginner()
        .with_record(record("example.com", &["unknown"]))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
}
