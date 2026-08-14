//! TEST_PLAN.md §1-2: 保護者による上書き。

mod common;

use common::{Scenario, now, parent_allow, parent_block, parent_override, record};
use domain_model::{Decision, OverrideAction, OverrideScope, Reason};
use time::Duration;

#[test]
fn 許可は未知ドメインを通す() {
    let verdict = Scenario::beginner()
        .with_override(parent_allow("example.com", OverrideScope::ExactDomain))
        .evaluate("example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::ParentAllow);
}

#[test]
fn 拒否は学習サイトでも止める() {
    let verdict = Scenario::beginner()
        .with_record(record("school.example.jp", &["education"]))
        .with_override(parent_block(
            "school.example.jp",
            OverrideScope::ExactDomain,
        ))
        .evaluate("school.example.jp");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::ParentBlock);
}

#[test]
fn 拒否は成人向けにも当然効く() {
    let verdict = Scenario::beginner()
        .with_record(record("bad.example.com", &["adult"]))
        .with_override(parent_block("bad.example.com", OverrideScope::ExactDomain))
        .evaluate("bad.example.com");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::ParentBlock); // カテゴリより先に確定する
}

#[test]
fn 期限切れの許可は無視される() {
    let expiry = now() + Duration::hours(1);
    let scenario = Scenario::beginner().with_override(parent_override(
        "example.com",
        OverrideAction::Allow,
        OverrideScope::ExactDomain,
        Some(expiry),
    ));

    // 期限内
    let before = scenario.evaluate_at("example.com", expiry - Duration::minutes(1));
    assert_eq!(before.decision, Decision::Allow);
    assert_eq!(before.reason, Reason::ParentAllow);

    // 期限後 — 未知ドメインの扱いに戻る
    let after = scenario.evaluate_at("example.com", expiry + Duration::seconds(1));
    assert_eq!(after.decision, Decision::Block);
    assert_eq!(after.reason, Reason::UnknownDomain);
}

#[test]
fn 今回だけ許可と常に許可を期限で区別できる() {
    let far_future = now() + Duration::days(3650);

    let always = Scenario::beginner()
        .with_override(parent_allow("example.com", OverrideScope::ExactDomain))
        .evaluate_at("example.com", far_future);
    assert_eq!(always.decision, Decision::Allow, "期限なしは 10 年後も有効");

    let once = Scenario::beginner()
        .with_override(parent_override(
            "example.com",
            OverrideAction::Allow,
            OverrideScope::ExactDomain,
            Some(now() + Duration::hours(1)),
        ))
        .evaluate_at("example.com", far_future);
    assert_eq!(once.decision, Decision::Block, "期限つきは切れている");
}

#[test]
fn scope_が_exact_ならサブドメインに及ばない() {
    let scenario =
        Scenario::beginner().with_override(parent_allow("example.com", OverrideScope::ExactDomain));

    assert_eq!(scenario.evaluate("example.com").decision, Decision::Allow);
    assert_eq!(
        scenario.evaluate("sub.example.com").decision,
        Decision::Block
    );
}

#[test]
fn scope_が_subdomains_なら配下に及ぶ() {
    let scenario = Scenario::beginner().with_override(parent_allow(
        "example.com",
        OverrideScope::IncludeSubdomains,
    ));

    assert_eq!(scenario.evaluate("example.com").decision, Decision::Allow);
    assert_eq!(
        scenario.evaluate("sub.example.com").decision,
        Decision::Allow
    );
    assert_eq!(
        scenario.evaluate("a.b.example.com").decision,
        Decision::Allow
    );

    // ラベル境界で比較しているので別ドメインには及ばない
    assert_eq!(
        scenario.evaluate("notexample.com").decision,
        Decision::Block
    );
}

#[test]
fn より具体的な設定が優先される() {
    // 親ドメインを許可しつつ、特定のサブドメインだけ拒否する運用
    let verdict = Scenario::beginner()
        .with_override(parent_allow(
            "example.com",
            OverrideScope::IncludeSubdomains,
        ))
        .with_override(parent_block(
            "ads.example.com",
            OverrideScope::IncludeSubdomains,
        ))
        .evaluate("ads.example.com");

    // Parent Block が Parent Allow より上の段なので、そもそも拒否が先に確定する
    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::ParentBlock);
    assert_eq!(
        verdict.matched_domain.expect("一致あり").as_str(),
        "ads.example.com"
    );
}

#[test]
fn 同じ動作で複数一致したら最も具体的なものを選ぶ() {
    let verdict = Scenario::beginner()
        .with_override(parent_allow(
            "example.com",
            OverrideScope::IncludeSubdomains,
        ))
        .with_override(parent_allow(
            "sub.example.com",
            OverrideScope::IncludeSubdomains,
        ))
        .evaluate("sub.example.com");

    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(
        verdict.matched_domain.expect("一致あり").as_str(),
        "sub.example.com"
    );
}

#[test]
fn 公開サフィックスへの上書きは効かない() {
    // co.jp を許可しても日本の全ドメインが通ってはいけない
    let verdict = Scenario::beginner()
        .with_override(parent_allow("co.jp", OverrideScope::IncludeSubdomains))
        .evaluate("example.co.jp");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
}
