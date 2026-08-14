//! `filter-core` の統合テスト。
//!
//! ここで確かめるのは「保存 → 読み込み → 判定 → 記録」がつながっていること。
//! 判定そのものの正しさは `policy-engine` 側のテストが担当する。

use domain_model::{
    CategoryId, Decision, DomainName, DomainRecord, MatchScope, OverrideAction, OverrideScope,
    ParentOverride, ProfileId, Reason, RecordStatus, RequestSource, RiskLevel, Source,
};
use filter_core::{CoreError, FilterCore};
use storage::{PolicyStore, SqliteStore};
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

fn now() -> OffsetDateTime {
    OffsetDateTime::UNIX_EPOCH
}

fn domain(s: &str) -> DomainName {
    DomainName::parse(s).expect("テストのドメインは妥当")
}

fn seeded_store() -> SqliteStore {
    let mut store = SqliteStore::open_in_memory().expect("メモリ DB を開ける");
    store.seed_builtins(now()).expect("同梱データを書ける");
    store
}

fn core() -> FilterCore<SqliteStore> {
    FilterCore::load(seeded_store(), ProfileId::Beginner, "test-device", now()).expect("読み込める")
}

fn record(name: &str, categories: &[&str]) -> DomainRecord {
    DomainRecord {
        id: Uuid::new_v4(),
        domain: domain(name),
        categories: categories
            .iter()
            .map(|c| CategoryId::parse(c).expect("妥当"))
            .collect(),
        risk_level: RiskLevel::Unknown,
        confidence: 1.0,
        source: Source::Parent,
        status: RecordStatus::Active,
        scope: MatchScope::Domain,
        version: 1,
        created_at: now(),
        updated_at: now(),
        deleted_at: None,
    }
}

fn allow(name: &str) -> ParentOverride {
    ParentOverride {
        id: Uuid::new_v4(),
        domain: domain(name),
        action: OverrideAction::Allow,
        scope: OverrideScope::IncludeSubdomains,
        expires_at: None,
        reason: "テスト".to_owned(),
        version: 1,
        created_at: now(),
        updated_at: now(),
        deleted_at: None,
    }
}

#[test]
fn 同梱データだけで判定できる() {
    let verdict = core().decide(&domain("example.com"), now(), RequestSource::Cli);

    assert_eq!(verdict.decision, Decision::Block);
    assert_eq!(verdict.reason, Reason::UnknownDomain);
}

#[test]
fn 同梱データが無いと読み込みに失敗する() {
    let store = SqliteStore::open_in_memory().expect("開ける");
    // FilterCore は Debug を持たないので expect_err ではなく match で受ける
    match FilterCore::load(store, ProfileId::Beginner, "test-device", now()) {
        Err(CoreError::ProfileNotFound(ProfileId::Beginner)) => {}
        Err(other) => panic!("想定と違うエラー: {other}"),
        Ok(_) => panic!("プロファイルが無いのに読み込めてしまった"),
    }
}

#[test]
fn 設定を書くと判定に反映される() {
    let mut core = core();
    assert_eq!(
        core.decide(&domain("example.com"), now(), RequestSource::Cli)
            .decision,
        Decision::Block
    );

    core.put_parent_override(&allow("example.com"), now())
        .expect("書ける");

    let verdict = core.decide(&domain("sub.example.com"), now(), RequestSource::Cli);
    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(verdict.reason, Reason::ParentAllow);
}

#[test]
fn 分類を書くと判定に反映される() {
    let mut core = core();
    core.put_domain_record(&record("school.example.jp", &["education"]), now())
        .expect("書ける");

    let verdict = core.decide(&domain("www.school.example.jp"), now(), RequestSource::Cli);
    assert_eq!(verdict.decision, Decision::Allow);
    assert_eq!(
        verdict.matched_domain.expect("一致あり").as_str(),
        "school.example.jp"
    );
}

#[test]
fn プロファイルを切り替えられる() {
    let mut core = core();
    assert_eq!(
        core.decide(&domain("example.com"), now(), RequestSource::Cli)
            .decision,
        Decision::Block
    );

    core.switch_profile(ProfileId::Standard, now())
        .expect("切り替えられる");

    let verdict = core.decide(&domain("example.com"), now(), RequestSource::Cli);
    assert_eq!(verdict.decision, Decision::Review);
    assert_eq!(verdict.profile, ProfileId::Standard);
}

#[test]
fn 判定は既定では履歴に残らない() {
    let core = core();
    core.decide(&domain("example.com"), now(), RequestSource::Dns);

    assert!(
        core.store()
            .recent_decisions(10)
            .expect("読める")
            .is_empty()
    );
}

#[test]
fn 記録つき判定は履歴に残る() {
    let mut core = core();
    core.put_domain_record(&record("school.example.jp", &["education"]), now())
        .expect("書ける");

    core.decide_and_log(&domain("www.school.example.jp"), now(), RequestSource::Dns)
        .expect("記録できる");

    let entries = core.store().recent_decisions(10).expect("読める");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].domain.as_str(), "www.school.example.jp");
    assert_eq!(entries[0].decision, Decision::Allow);
    assert_eq!(entries[0].device_id, "test-device");
    // 判定の決め手になったカテゴリが残る
    assert_eq!(
        entries[0].category.as_ref().map(CategoryId::as_str),
        Some("education")
    );
}

#[test]
fn 分類の無いドメインの履歴はカテゴリなし() {
    let mut core = core();
    core.decide_and_log(&domain("example.com"), now(), RequestSource::Dns)
        .expect("記録できる");

    let entries = core.store().recent_decisions(10).expect("読める");
    assert_eq!(entries[0].category, None);
}

#[test]
fn 判定に使う時刻は呼び出し側が決める() {
    let mut core = core();
    let mut entry = allow("example.com");
    let expiry = now() + Duration::hours(1);
    entry.expires_at = Some(expiry);
    core.put_parent_override(&entry, now()).expect("書ける");

    let before = core.decide(
        &domain("example.com"),
        expiry - Duration::minutes(1),
        RequestSource::Cli,
    );
    assert_eq!(before.decision, Decision::Allow);

    let after = core.decide(
        &domain("example.com"),
        expiry + Duration::minutes(1),
        RequestSource::Cli,
    );
    assert_eq!(after.decision, Decision::Block, "期限切れが効いていない");
}

#[test]
fn 写しは自動では更新されない() {
    // DB を外から書き換えた場合は reload が要る。この性質を明示しておく
    let mut core = core();
    let snapshot_before = core.snapshot().overrides.len();

    core.put_parent_override(&allow("example.com"), now())
        .expect("書ける");
    assert_eq!(
        core.snapshot().overrides.len(),
        snapshot_before + 1,
        "書き込み経由なら自動反映"
    );

    core.reload(now() + Duration::hours(1)).expect("読み直せる");
    assert_eq!(core.snapshot().loaded_at, now() + Duration::hours(1));
}
