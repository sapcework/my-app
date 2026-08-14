//! TEST_PLAN.md §1-4: 1 ドメインが複数カテゴリを持つ場合の合成。
//!
//! **最も制限的なカテゴリが勝つ。** カテゴリ登録の粒度が荒くても危険側に倒れる。

mod common;

use common::{Scenario, beginner_tweaked, record};
use domain_model::{Decision, Reason};

/// REVIEW を BLOCK に落とさない BEGINNER。合成結果をそのまま観測するため。
fn scenario() -> Scenario {
    Scenario::new(beginner_tweaked(|p| p.review_as_block = false))
}

fn decide(categories: &[&str]) -> Decision {
    scenario()
        .with_record(record("site.example.com", categories))
        .evaluate("site.example.com")
        .decision
}

#[test]
fn allow_と_review_なら_review() {
    // kids(Allow) + video(Review)
    assert_eq!(decide(&["kids", "video"]), Decision::Review);
}

#[test]
fn allow_と_block_なら_block() {
    // education(Allow) + adult(Block)
    assert_eq!(decide(&["education", "adult"]), Decision::Block);
}

#[test]
fn review_と_block_なら_block() {
    // news(Review) + adult(Block)
    assert_eq!(decide(&["news", "adult"]), Decision::Block);
}

#[test]
fn allow_同士なら_allow() {
    assert_eq!(decide(&["education", "kids", "reference"]), Decision::Allow);
}

#[test]
fn カテゴリの並び順で結果が変わらない() {
    assert_eq!(decide(&["kids", "video"]), decide(&["video", "kids"]));
    assert_eq!(
        decide(&["education", "adult"]),
        decide(&["adult", "education"])
    );
}

#[test]
fn ルールの無いカテゴリは合成に加わらない() {
    // crypto にはルールが無いので kids(Allow) だけで決まる
    assert_eq!(decide(&["kids", "crypto"]), Decision::Allow);
}

#[test]
fn 勝ったカテゴリがルール_id_に出る() {
    let verdict = scenario()
        .with_record(record("site.example.com", &["kids", "video"]))
        .evaluate("site.example.com");

    assert_eq!(verdict.reason, Reason::CategoryPolicy);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.category.video");
}

#[test]
fn 同点なら_id_順で決まり結果が安定する() {
    // adult も malware も Block。どちらが選ばれるかは常に同じでなければならない
    let first = scenario()
        .with_record(record("site.example.com", &["malware", "adult"]))
        .evaluate("site.example.com");
    let second = scenario()
        .with_record(record("site.example.com", &["adult", "malware"]))
        .evaluate("site.example.com");

    assert_eq!(first.matched_rule, second.matched_rule);
    assert_eq!(first.matched_rule.as_str(), "beginner.category.adult"); // ID 順で adult < malware
}
