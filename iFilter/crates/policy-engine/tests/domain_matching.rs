//! TEST_PLAN.md §1-5: ドメイン正規化と階層マッチを、判定エンジン越しに確認する。
//!
//! 型そのもののテストは `domain-model` 側にある。ここでは
//! 「索引と照合を通したときに期待どおりの判定になるか」を見る。

mod common;

use common::{Scenario, record, record_with_risk};
use domain_model::{Decision, Reason, RiskLevel};

#[test]
fn 大文字や末尾ドットの違いを吸収する() {
    let scenario = Scenario::beginner().with_record(record("example.com", &["education"]));

    for input in [
        "example.com",
        "EXAMPLE.COM",
        "example.com.",
        "  Example.Com.  ",
    ] {
        assert_eq!(
            scenario.evaluate(input).decision,
            Decision::Allow,
            "入力: {input:?}"
        );
    }
}

#[test]
fn idn_は登録形式に関わらず一致する() {
    // punycode で登録し、日本語表記で問い合わせる
    let scenario = Scenario::beginner().with_record(record("xn--wgv71a.jp", &["education"]));
    assert_eq!(scenario.evaluate("日本.jp").decision, Decision::Allow);

    // 逆向き
    let scenario = Scenario::beginner().with_record(record("日本.jp", &["education"]));
    assert_eq!(scenario.evaluate("xn--wgv71a.jp").decision, Decision::Allow);
}

#[test]
fn 多段のサブドメインでも_etld_plus1_まで遡る() {
    let scenario = Scenario::beginner().with_record(record("example.co.jp", &["education"]));

    for input in ["example.co.jp", "a.example.co.jp", "www.a.example.co.jp"] {
        assert_eq!(
            scenario.evaluate(input).decision,
            Decision::Allow,
            "入力: {input}"
        );
    }
}

#[test]
fn 公開サフィックスに登録したレコードは到達不能() {
    // co.jp に education を登録しても、日本のドメインが軒並み通ることはない
    let verdict = Scenario::beginner()
        .with_record(record("co.jp", &["education"]))
        .evaluate("example.co.jp");

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
}

#[test]
fn 部分文字列一致では当たらない() {
    let scenario = Scenario::beginner().with_record(record("example.com", &["education"]));

    // ends_with で書いていると通ってしまう組み合わせ
    assert_eq!(
        scenario.evaluate("notexample.com").decision,
        Decision::Block
    );
    assert_eq!(scenario.evaluate("myexample.com").decision, Decision::Block);
}

#[test]
fn より具体的なレコードが優先される() {
    let scenario = Scenario::beginner()
        .with_record(record("example.com", &["education"]))
        .with_record(record("ads.example.com", &["adult"]));

    let allowed = scenario.evaluate("www.example.com");
    assert_eq!(allowed.decision, Decision::Allow);
    assert_eq!(
        allowed.matched_domain.expect("一致あり").as_str(),
        "example.com"
    );

    let blocked = scenario.evaluate("sub.ads.example.com");
    assert_eq!(blocked.decision, Decision::Block);
    assert_eq!(
        blocked.matched_domain.expect("一致あり").as_str(),
        "ads.example.com"
    );
}

#[test]
fn 論理削除されたレコードは上位の候補に譲る() {
    let mut deleted = record_with_risk("ads.example.com", &["adult"], RiskLevel::Critical);
    deleted.deleted_at = Some(common::now());

    let verdict = Scenario::beginner()
        .with_record(record("example.com", &["education"]))
        .with_record(deleted)
        .evaluate("ads.example.com");

    // 削除済みは飛ばして example.com の education に当たる
    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(
        verdict.matched_domain.expect("一致あり").as_str(),
        "example.com"
    );
}

#[test]
fn 無効化されたレコードも同様に飛ばす() {
    let mut disabled = record("ads.example.com", &["adult"]);
    disabled.status = domain_model::RecordStatus::Disabled;

    let verdict = Scenario::beginner()
        .with_record(record("example.com", &["education"]))
        .with_record(disabled)
        .evaluate("ads.example.com");

    assert_eq!(verdict.decision, Decision::Allow);
}

#[test]
fn 未知の_tld_でも_etld_plus1_として扱える() {
    let scenario = Scenario::beginner().with_record(record("example.invalidtld", &["education"]));
    assert_eq!(
        scenario.evaluate("www.example.invalidtld").decision,
        Decision::Allow
    );
}
