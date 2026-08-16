//! TEST_PLAN.md §2: Storage の統合テスト。
//!
//! すべてインメモリ SQLite で走らせる。ファイルを作らないので後片付けが要らず、
//! 開発マシンの状態にも依存しない。

use std::collections::BTreeSet;

use domain_model::{
    AccessDecision, CategoryId, CategoryInfo, Decision, DomainName, DomainRecord, MatchScope,
    OverrideAction, OverrideScope, ParentOverride, Profile, ProfileId, RecordStatus, RiskLevel,
    RuleId, Source, bundled_records,
};
use storage::{PolicyStore, SqliteStore};
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

fn now() -> OffsetDateTime {
    OffsetDateTime::UNIX_EPOCH
}

fn domain(s: &str) -> DomainName {
    DomainName::parse(s).expect("テストのドメインは妥当")
}

fn category(s: &str) -> CategoryId {
    CategoryId::parse(s).expect("テストのカテゴリは妥当")
}

fn store() -> SqliteStore {
    SqliteStore::open_in_memory().expect("メモリ DB を開ける")
}

fn seeded() -> SqliteStore {
    let mut store = store();
    store.seed_builtins(now()).expect("同梱データを書ける");
    store
}

fn record(name: &str, categories: &[&str]) -> DomainRecord {
    DomainRecord {
        id: Uuid::new_v4(),
        domain: domain(name),
        categories: categories.iter().map(|c| category(c)).collect(),
        risk_level: RiskLevel::Unknown,
        confidence: 0.75,
        source: Source::Bundled,
        status: RecordStatus::Active,
        scope: MatchScope::Domain,
        version: 1,
        created_at: now(),
        updated_at: now(),
        deleted_at: None,
    }
}

fn override_entry(name: &str, action: OverrideAction) -> ParentOverride {
    ParentOverride {
        id: Uuid::new_v4(),
        domain: domain(name),
        action,
        scope: OverrideScope::IncludeSubdomains,
        expires_at: None,
        reason: "学校の宿題で使う".to_owned(),
        version: 1,
        created_at: now(),
        updated_at: now(),
        deleted_at: None,
    }
}

// ---- マイグレーション ----

#[test]
fn 空の_db_を開くとスキーマができる() {
    let store = store();
    assert!(store.domain_records().expect("読める").is_empty());
    assert!(store.parent_overrides().expect("読める").is_empty());
    assert!(store.categories().expect("読める").is_empty());
}

#[test]
fn 同梱データを書き込める() {
    let store = seeded();

    let categories = store.categories().expect("読める");
    assert_eq!(categories.len(), 26);
    assert!(categories.get(&category("infrastructure")).is_some());

    assert_eq!(store.profiles().expect("読める").len(), 4);

    // ドメイン分類が入っていないと、あらゆるドメインが未分類になって
    // BEGINNER では CDN もフォントも BLOCK される
    let records = store.domain_records().expect("読める");
    assert_eq!(records.len(), bundled_records(now()).len());
    assert!(!records.is_empty());
}

#[test]
fn 同梱データを二度書いても重複しない() {
    let mut store = seeded();
    let before = store.domain_records().expect("読める").len();
    store
        .seed_builtins(now() + Duration::days(1))
        .expect("再書き込みできる");

    assert_eq!(store.categories().expect("読める").len(), 26);
    assert_eq!(store.profiles().expect("読める").len(), 4);
    // 同梱ドメインの ID はドメイン名から決まるので upsert で上書きされる
    assert_eq!(store.domain_records().expect("読める").len(), before);
}

#[test]
fn 同梱の照合範囲が保たれる() {
    // Suffix が Domain に化けると cloudfront.net 配下が丸ごと未分類に戻る
    let store = seeded();
    let loaded = store.domain_records().expect("読める");

    let cloudfront = loaded
        .iter()
        .find(|r| r.domain.as_str() == "cloudfront.net")
        .expect("同梱されている");
    assert_eq!(cloudfront.scope, MatchScope::Suffix);

    let gstatic = loaded
        .iter()
        .find(|r| r.domain.as_str() == "gstatic.com")
        .expect("同梱されている");
    assert_eq!(gstatic.scope, MatchScope::Domain);
}

// ---- プロファイル ----

#[test]
fn プロファイルが往復する() {
    let mut store = store();
    let profile = Profile::beginner();
    store.upsert_profile(&profile, now()).expect("書ける");

    let loaded = store
        .profile(ProfileId::Beginner)
        .expect("読める")
        .expect("存在する");
    assert_eq!(loaded, profile);
}

#[test]
fn カスタムプロファイルの_uuid_が保たれる() {
    let mut store = store();
    let id = ProfileId::Custom(Uuid::from_u128(7));
    let mut profile = Profile::beginner();
    profile.id = id;
    profile.name = "うちの子用".to_owned();

    store.upsert_profile(&profile, now()).expect("書ける");
    let loaded = store.profile(id).expect("読める").expect("存在する");

    assert_eq!(loaded.id, id);
    assert_eq!(loaded.name, "うちの子用");
}

#[test]
fn 存在しないプロファイルは_none() {
    let store = store();
    assert!(store.profile(ProfileId::Teen).expect("読める").is_none());
}

#[test]
fn プロファイルを更新できる() {
    let mut store = store();
    let mut profile = Profile::beginner();
    store.upsert_profile(&profile, now()).expect("書ける");

    profile.unknown_policy = Decision::Review;
    profile.version = 2;
    store
        .upsert_profile(&profile, now() + Duration::hours(1))
        .expect("更新できる");

    let loaded = store
        .profile(ProfileId::Beginner)
        .expect("読める")
        .expect("存在する");
    assert_eq!(loaded.unknown_policy, Decision::Review);
    assert_eq!(loaded.version, 2);
    assert_eq!(
        store.profiles().expect("読める").len(),
        1,
        "行が増えていない"
    );
}

// ---- カテゴリ ----

#[test]
fn カテゴリを後から追加できる() {
    let mut store = seeded();
    store
        .upsert_category(
            &CategoryInfo {
                id: category("crypto"),
                display_name: "暗号資産".to_owned(),
                default_risk: RiskLevel::High,
            },
            now(),
        )
        .expect("書ける");

    let categories = store.categories().expect("読める");
    assert_eq!(
        categories.default_risk(&category("crypto")),
        RiskLevel::High
    );
    assert_eq!(categories.len(), 27);
}

// ---- ドメインレコード ----

#[test]
fn ドメインレコードが往復する() {
    let mut store = store(); // 同梱データを入れると件数の検査が同梱分に引きずられる
    let record = record("example.com", &["kids", "video"]);
    store.upsert_domain_record(&record).expect("書ける");

    let loaded = store.domain_records().expect("読める");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0], record);
}

#[test]
fn 複数カテゴリが保たれる() {
    let mut store = store();
    store
        .upsert_domain_record(&record("example.com", &["kids", "video", "education"]))
        .expect("書ける");

    let loaded = store.domain_records().expect("読める");
    let categories: BTreeSet<&str> = loaded[0]
        .categories
        .iter()
        .map(CategoryId::as_str)
        .collect();
    assert_eq!(categories, BTreeSet::from(["education", "kids", "video"]));
}

#[test]
fn カテゴリの更新で古い分類が残らない() {
    let mut store = store();
    let mut record = record("example.com", &["kids", "video"]);
    store.upsert_domain_record(&record).expect("書ける");

    record.categories = vec![category("education")];
    record.version = 2;
    store.upsert_domain_record(&record).expect("更新できる");

    let loaded = store.domain_records().expect("読める");
    assert_eq!(loaded.len(), 1);
    assert_eq!(
        loaded[0].categories,
        vec![category("education")],
        "古いカテゴリが残っている"
    );
}

#[test]
fn 論理削除したレコードは判定に使われない() {
    let mut store = store();
    let mut record = record("example.com", &["adult"]);
    record.deleted_at = Some(now());
    store.upsert_domain_record(&record).expect("書ける");

    let loaded = store.domain_records().expect("読める");
    assert_eq!(loaded.len(), 1, "行は残る（同期で削除を伝えるため）");
    assert!(!loaded[0].is_usable(), "判定には使わない");
}

#[test]
fn ドメインは正規化して保存される() {
    let mut store = store();
    let mut record = record("example.com", &["education"]);
    record.domain = domain("  EXAMPLE.COM.  ");
    store.upsert_domain_record(&record).expect("書ける");

    let loaded = store.domain_records().expect("読める");
    assert_eq!(loaded[0].domain.as_str(), "example.com");
}

// ---- 保護者の上書き ----

#[test]
fn 上書き設定が往復する() {
    let mut store = store();
    let entry = override_entry("example.com", OverrideAction::Allow);
    store.upsert_parent_override(&entry).expect("書ける");

    let loaded = store.parent_overrides().expect("読める");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0], entry);
}

#[test]
fn 有効期限が往復する() {
    let mut store = store();
    let mut entry = override_entry("example.com", OverrideAction::Allow);
    let expiry = now() + Duration::hours(3);
    entry.expires_at = Some(expiry);
    store.upsert_parent_override(&entry).expect("書ける");

    let loaded = store.parent_overrides().expect("読める");
    assert_eq!(loaded[0].expires_at, Some(expiry));
    assert!(loaded[0].is_active_at(now()));
    assert!(!loaded[0].is_active_at(expiry + Duration::seconds(1)));
}

#[test]
fn 論理削除した上書きは適用されない() {
    let mut store = store();
    let mut entry = override_entry("example.com", OverrideAction::Allow);
    entry.deleted_at = Some(now());
    store.upsert_parent_override(&entry).expect("書ける");

    let loaded = store.parent_overrides().expect("読める");
    assert_eq!(loaded.len(), 1, "行は残る");
    assert!(!loaded[0].applies_to(&domain("example.com"), now()));
}

// ---- 緊急ブロック ----

#[test]
fn 緊急ブロックが往復する() {
    let mut store = store();
    store
        .upsert_emergency_block(&domain("bad.example.com"), now())
        .expect("書ける");
    store
        .upsert_emergency_block(&domain("bad.example.com"), now())
        .expect("二度目も書ける");

    let loaded = store.emergency_blocks().expect("読める");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].as_str(), "bad.example.com");
}

// ---- 判定履歴 ----

#[test]
fn 判定履歴を追加して新しい順に読める() {
    let mut store = store();

    for (index, name) in ["a.example.com", "b.example.com", "c.example.com"]
        .iter()
        .enumerate()
    {
        store
            .record_decision(&AccessDecision {
                timestamp: now() + Duration::minutes(index as i64),
                device_id: "device-1".to_owned(),
                domain: domain(name),
                category: Some(category("education")),
                decision: Decision::Block,
                profile: ProfileId::Beginner,
                rule_id: RuleId::new("beginner.unknown.block"),
            })
            .expect("書ける");
    }

    let recent = store.recent_decisions(2).expect("読める");
    assert_eq!(recent.len(), 2);
    assert_eq!(recent[0].domain.as_str(), "c.example.com", "新しい順");
    assert_eq!(recent[1].domain.as_str(), "b.example.com");
}

#[test]
fn 判定履歴のカテゴリは省略できる() {
    let mut store = store();
    store
        .record_decision(&AccessDecision {
            timestamp: now(),
            device_id: "device-1".to_owned(),
            domain: domain("example.com"),
            category: None, // 分類が無いドメイン
            decision: Decision::Block,
            profile: ProfileId::Beginner,
            rule_id: RuleId::new("beginner.unknown.block"),
        })
        .expect("書ける");

    let recent = store.recent_decisions(10).expect("読める");
    assert_eq!(recent[0].category, None);
    assert_eq!(recent[0].rule_id.as_str(), "beginner.unknown.block");
}

// ---- 設定 ----

#[test]
fn 設定が往復し上書きできる() {
    let mut store = store();
    assert!(store.setting("filter_enabled").expect("読める").is_none());

    store
        .set_setting("filter_enabled", "true", now())
        .expect("書ける");
    assert_eq!(
        store.setting("filter_enabled").expect("読める").as_deref(),
        Some("true")
    );

    store
        .set_setting("filter_enabled", "false", now() + Duration::hours(1))
        .expect("上書きできる");
    assert_eq!(
        store.setting("filter_enabled").expect("読める").as_deref(),
        Some("false")
    );
    assert_eq!(store.settings().expect("読める").len(), 1);
}

// ---- 判定エンジンとの接続 ----

#[test]
fn 保存した内容で判定できる() {
    // storage は policy-engine に依存しないが、読み出した値がそのまま
    // 判定に使えることをここで確かめる（filter-core が行う組み立ての先取り）
    use policy_engine::{DomainIndex, DomainSet, OverrideSet, PolicyContext, PolicyEngine};

    let mut store = seeded();
    store
        .upsert_domain_record(&record("school.example.jp", &["education"]))
        .expect("書ける");
    store
        .upsert_parent_override(&override_entry("games.example.com", OverrideAction::Block))
        .expect("書ける");

    let profile = store
        .profile(ProfileId::Beginner)
        .expect("読める")
        .expect("存在する");
    let records: DomainIndex = store
        .domain_records()
        .expect("読める")
        .into_iter()
        .collect();
    let overrides: OverrideSet = store
        .parent_overrides()
        .expect("読める")
        .into_iter()
        .collect();
    let emergency: DomainSet = store
        .emergency_blocks()
        .expect("読める")
        .into_iter()
        .collect();

    let ctx = PolicyContext {
        profile: &profile,
        records: &records,
        parent_overrides: &overrides,
        emergency_blocks: &emergency,
    };

    let evaluate = |name: &str| {
        let request = domain_model::Request::new(
            domain(name),
            now(),
            ProfileId::Beginner,
            domain_model::RequestSource::Cli,
        );
        PolicyEngine::evaluate(&request, &ctx)
    };

    assert_eq!(evaluate("www.school.example.jp").decision, Decision::Allow);
    assert_eq!(evaluate("games.example.com").decision, Decision::Block);
    assert_eq!(evaluate("unknown.example.org").decision, Decision::Block);
}
