//! TEST_PLAN.md §1-1: Profile × カテゴリのケース表。

mod common;

use common::{PROFILES_STRICT_TO_LOOSE, Scenario, record, scenario_for};
use domain_model::{Decision, ProfileId, Reason};

/// 指定プロファイルで、そのカテゴリに分類されたドメインを判定する。
fn decide(profile: ProfileId, category: &str) -> Decision {
    scenario_for(profile)
        .with_record(record("site.example.com", &[category]))
        .evaluate("site.example.com")
        .decision
}

#[test]
fn beginner_の全カテゴリ判定() {
    use Decision::{Allow, Block};

    // BEGINNER は review_as_block = true なので REVIEW は BLOCK に落ちる
    const CASES: &[(&str, Decision)] = &[
        ("education", Allow),
        ("kids", Allow),
        ("reference", Allow),
        ("search", Allow),
        ("infrastructure", Allow),
        ("news", Block),
        ("video", Block),
        ("gaming", Block),
        ("shopping", Block),
        ("social", Block),
        ("forum", Block),
        ("chat", Block),
        ("dating", Block),
        ("adult", Block),
        ("gambling", Block),
        ("violence", Block),
        ("drugs", Block),
        ("weapons", Block),
        ("self_harm", Block),
        ("malware", Block),
        ("phishing", Block),
        ("fraud", Block),
        ("piracy", Block),
    ];

    for (category, expected) in CASES {
        assert_eq!(
            decide(ProfileId::Beginner, category),
            *expected,
            "カテゴリ: {category}"
        );
    }
}

#[test]
fn 未知ドメインのプロファイル別の扱い() {
    const CASES: &[(ProfileId, Decision)] = &[
        (ProfileId::Beginner, Decision::Block),
        (ProfileId::BeginnerPlus, Decision::Block),
        (ProfileId::Standard, Decision::Review),
        (ProfileId::Teen, Decision::Review),
    ];

    for (profile, expected) in CASES {
        let verdict = scenario_for(*profile).evaluate("example.com");
        assert_eq!(verdict.decision, *expected, "プロファイル: {profile}");
        assert_eq!(verdict.reason, Reason::UnknownDomain);
    }
}

#[test]
fn 危険なカテゴリはどのプロファイルでも_block() {
    // 年齢が上がっても解除されないカテゴリ
    for category in ["adult", "dating", "malware", "phishing", "fraud"] {
        for profile in PROFILES_STRICT_TO_LOOSE {
            assert_eq!(
                decide(profile, category),
                Decision::Block,
                "プロファイル {profile} / カテゴリ {category}"
            );
        }
    }
}

#[test]
fn 学習系はどのプロファイルでも_allow() {
    for category in ["education", "kids", "reference", "search", "infrastructure"] {
        for profile in PROFILES_STRICT_TO_LOOSE {
            assert_eq!(
                decide(profile, category),
                Decision::Allow,
                "プロファイル {profile} / カテゴリ {category}"
            );
        }
    }
}

#[test]
fn 慣れるにつれて動画とゲームが緩む() {
    assert_eq!(decide(ProfileId::Beginner, "video"), Decision::Block);
    assert_eq!(decide(ProfileId::BeginnerPlus, "video"), Decision::Allow);
    assert_eq!(decide(ProfileId::Standard, "video"), Decision::Allow);

    assert_eq!(decide(ProfileId::Beginner, "gaming"), Decision::Block);
    assert_eq!(decide(ProfileId::BeginnerPlus, "gaming"), Decision::Review);
    assert_eq!(decide(ProfileId::Standard, "gaming"), Decision::Allow);
}

#[test]
fn sns_は_teen_で初めて_allow_になる() {
    assert_eq!(decide(ProfileId::Beginner, "social"), Decision::Block);
    assert_eq!(decide(ProfileId::BeginnerPlus, "social"), Decision::Block);
    assert_eq!(decide(ProfileId::Standard, "social"), Decision::Review);
    assert_eq!(decide(ProfileId::Teen, "social"), Decision::Allow);
}

#[test]
fn プロファイルに知らないカテゴリはルールに当たらない() {
    // サーバーから新カテゴリが降ってきて、プロファイル側にまだルールが無い状態。
    // 8 段目にも当たらない（未分類ではない）ので 9 段目の既定に落ちる
    let verdict = Scenario::beginner()
        .with_record(record("example.com", &["crypto"]))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::ProfileDefault);
    assert_eq!(verdict.matched_rule.as_str(), "beginner.default.block");
}
