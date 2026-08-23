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

// ---- 別プロセスからの変更に気づくか ----
//
// 保護者 UI は DNS フィルターとは別プロセスで動き、同じ DB を書き換える。
// フィルターはポリシーをメモリに載せているので、気づく手段が無いと
// 「UI で許可したのに繋がらない」が起きる。

/// 同じ DB ファイルを見る 2 つの `FilterCore` を作る。UI とサービスに見立てる。
fn two_cores() -> (
    tempfile::TempDir,
    FilterCore<SqliteStore>,
    FilterCore<SqliteStore>,
) {
    let dir = tempfile::tempdir().expect("一時ディレクトリを作れる");
    let path = dir.path().join("ifilter.sqlite");

    let mut store = SqliteStore::open(&path).expect("開ける");
    store.seed_builtins(now()).expect("同梱データを書ける");
    drop(store);

    let service = FilterCore::load(
        SqliteStore::open(&path).expect("開ける"),
        ProfileId::Beginner,
        "service",
        now(),
    )
    .expect("読み込める");
    let ui = FilterCore::load(
        SqliteStore::open(&path).expect("開ける"),
        ProfileId::Beginner,
        "ui",
        now(),
    )
    .expect("読み込める");

    (dir, service, ui)
}

#[test]
fn 別プロセスの許可に気づいて反映する() {
    let (_dir, mut service, mut ui) = two_cores();
    let target = domain("example.com");
    assert_eq!(
        service.decide(&target, now(), RequestSource::Dns).decision,
        Decision::Block
    );

    ui.put_parent_override(&allow("example.com"), now())
        .expect("許可を書ける");

    // 気づかないまま判定を続けると「許可したのに繋がらない」になる
    assert!(
        service.reload_if_stale(now()).expect("確認できる"),
        "別プロセスの変更を検出できていない"
    );
    assert_eq!(
        service.decide(&target, now(), RequestSource::Dns).decision,
        Decision::Allow
    );
}

#[test]
fn 変更が無ければ読み直さない() {
    // 数秒ごとに呼ぶので、毎回ポリシー全体を読み直すわけにはいかない
    let (_dir, mut service, _ui) = two_cores();
    assert!(!service.reload_if_stale(now()).expect("確認できる"));
    assert!(!service.reload_if_stale(now()).expect("確認できる"));
}

#[test]
fn 自分で書いた直後は読み直さない() {
    // put_* は自分で読み直しているので、そのあと stale 扱いになるのは無駄
    let (_dir, _service, mut ui) = two_cores();
    ui.put_parent_override(&allow("example.com"), now())
        .expect("書ける");
    assert!(
        !ui.reload_if_stale(now()).expect("確認できる"),
        "自分の変更で読み直しが発生している"
    );
}

#[test]
fn 版数は書き換えのたびに進む() {
    let (_dir, _service, mut ui) = two_cores();
    let start = ui.revision();

    ui.put_parent_override(&allow("a.example.com"), now())
        .expect("書ける");
    assert_eq!(ui.revision(), start + 1);

    ui.put_domain_record(&record("b.example.com", &["kids"]), now())
        .expect("書ける");
    assert_eq!(ui.revision(), start + 2);
}

#[test]
fn 使用中でないプロファイルの変更でも版数は進む() {
    // 別プロセスがそのプロファイルを使っているかもしれない
    let (_dir, mut service, mut ui) = two_cores();
    let start = ui.revision();

    let mut other = domain_model::Profile::teen();
    other.name = "変更した".to_owned();
    ui.put_profile(&other, now()).expect("書ける");

    assert_eq!(ui.revision(), start + 1);
    assert!(
        !ui.reload_if_stale(now()).expect("確認できる"),
        "自分の書き込みで読み直しが発生している"
    );
    assert!(
        service.reload_if_stale(now()).expect("確認できる"),
        "別プロセスが変更に気づけない"
    );
}

#[test]
fn 別プロセスの分類変更にも気づく() {
    let (_dir, mut service, mut ui) = two_cores();
    let target = domain("shop.example.com");

    ui.put_domain_record(&record("shop.example.com", &["education"]), now())
        .expect("書ける");

    assert!(service.reload_if_stale(now()).expect("確認できる"));
    assert_eq!(
        service.decide(&target, now(), RequestSource::Dns).decision,
        Decision::Allow
    );
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

fn block(name: &str) -> ParentOverride {
    ParentOverride {
        action: OverrideAction::Block,
        ..allow(name)
    }
}

/// 保存は id の衝突でしか上書きされない。追加のたびに新しい id を振ると行が増える。
#[test]
fn 同じ許可を繰り返しても行は増えない() {
    let mut core = core();

    for _ in 0..4 {
        core.set_parent_override(&allow("example.com"), now())
            .expect("書ける");
    }

    let live: Vec<_> = core
        .store()
        .parent_overrides()
        .expect("読める")
        .into_iter()
        .filter(|e| e.deleted_at.is_none())
        .collect();
    assert_eq!(live.len(), 1, "同じ許可が複数行に増えている");
    assert_eq!(live[0].version, 4, "版数が進んでいない");
}

/// 増えたまま放置すると、1 件消しても残りが効き続ける。
/// **画面には「取り消した」と出るのに、通り続ける。**
#[test]
fn 許可を取り消したら本当に通らなくなる() {
    let mut core = core();
    let target = domain("example.com");

    for _ in 0..4 {
        core.set_parent_override(&allow("example.com"), now())
            .expect("書ける");
    }
    assert_eq!(
        core.decide(&target, now(), RequestSource::Cli).decision,
        Decision::Allow
    );

    assert_eq!(
        core.clear_parent_overrides(&target, now()).expect("消せる"),
        1
    );
    assert_eq!(
        core.decide(&target, now(), RequestSource::Cli).decision,
        Decision::Block,
        "取り消したのに通っている"
    );
}

/// 許可と拒否は別の設定なので、片方を足しても他方は残す。
#[test]
fn 許可と拒否は別の行として持つ() {
    let mut core = core();
    core.set_parent_override(&allow("example.com"), now())
        .expect("書ける");
    core.set_parent_override(&block("example.com"), now())
        .expect("書ける");

    let live = core
        .store()
        .parent_overrides()
        .expect("読める")
        .into_iter()
        .filter(|e| e.deleted_at.is_none())
        .count();
    assert_eq!(live, 2);

    // 保護者の拒否は 2 段目、許可は 4 段目。競合したら必ず拒否が勝つ
    assert_eq!(
        core.decide(&domain("example.com"), now(), RequestSource::Cli)
            .decision,
        Decision::Block
    );
}

/// 取り消しは許可も拒否もまとめて消す。片方だけ残ると意図が読めない。
#[test]
fn 取り消しは許可と拒否の両方を消す() {
    let mut core = core();
    core.set_parent_override(&allow("example.com"), now())
        .expect("書ける");
    core.set_parent_override(&block("example.com"), now())
        .expect("書ける");

    assert_eq!(
        core.clear_parent_overrides(&domain("example.com"), now())
            .expect("消せる"),
        2
    );
    let live = core
        .store()
        .parent_overrides()
        .expect("読める")
        .into_iter()
        .filter(|e| e.deleted_at.is_none())
        .count();
    assert_eq!(live, 0);
}

/// **物理削除しない。** 消したことを他の端末へ伝えるには行が残っている必要がある。
#[test]
fn 取り消しても行は残る() {
    let mut core = core();
    core.set_parent_override(&allow("example.com"), now())
        .expect("書ける");
    core.clear_parent_overrides(&domain("example.com"), now())
        .expect("消せる");

    let all = core.store().parent_overrides().expect("読める");
    assert_eq!(all.len(), 1);
    assert!(all[0].deleted_at.is_some(), "行ごと消えている");
}

/// 無いものを消しても版数を進めない。進めると全サービスが無駄に読み直す。
#[test]
fn 対象が無ければ版数は進めない() {
    let mut core = core();
    let start = core.revision();

    assert_eq!(
        core.clear_parent_overrides(&domain("example.com"), now())
            .expect("消せる"),
        0
    );
    assert_eq!(core.revision(), start);
}

/// 複数行をまとめて消しても、版数は 1 回だけ進める。
/// 1 行ごとに進めると、途中の状態を別プロセスに読み込ませることになる。
#[test]
fn まとめて消しても版数は一度だけ進む() {
    let mut core = core();
    core.set_parent_override(&allow("example.com"), now())
        .expect("書ける");
    core.set_parent_override(&block("example.com"), now())
        .expect("書ける");

    let start = core.revision();
    core.clear_parent_overrides(&domain("example.com"), now())
        .expect("消せる");
    assert_eq!(core.revision(), start + 1);
}
