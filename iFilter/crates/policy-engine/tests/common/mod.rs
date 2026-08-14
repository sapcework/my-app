//! テスト用のデータ組み立てヘルパー。
//!
//! 統合テストはファイルごとに別クレートとしてビルドされるため、
//! 使わないヘルパーがある側では dead_code になる。

#![allow(dead_code)]

use domain_model::{
    CategoryId, DomainName, DomainRecord, MatchScope, OverrideAction, OverrideScope,
    ParentOverride, Profile, ProfileId, RecordStatus, Request, RequestSource, RiskLevel, Source,
    Verdict,
};
use policy_engine::{DomainIndex, DomainSet, OverrideSet, PolicyContext, PolicyEngine};
use time::OffsetDateTime;
use uuid::Uuid;

/// テストの基準時刻。時計に依存させないため固定値を使う。
pub fn now() -> OffsetDateTime {
    OffsetDateTime::UNIX_EPOCH
}

pub fn domain(s: &str) -> DomainName {
    DomainName::parse(s).expect("テストのドメインは妥当")
}

pub fn category(s: &str) -> CategoryId {
    CategoryId::parse(s).expect("テストのカテゴリは妥当")
}

/// 分類済みドメインを 1 件作る。リスクはカテゴリの既定値に委ねる。
pub fn record(name: &str, categories: &[&str]) -> DomainRecord {
    record_with_risk(name, categories, RiskLevel::Unknown)
}

pub fn record_with_risk(name: &str, categories: &[&str], risk: RiskLevel) -> DomainRecord {
    DomainRecord {
        id: Uuid::nil(),
        domain: domain(name),
        categories: categories.iter().map(|c| category(c)).collect(),
        risk_level: risk,
        confidence: 0.9,
        source: Source::Bundled,
        status: RecordStatus::Active,
        scope: MatchScope::Domain,
        version: 1,
        created_at: now(),
        updated_at: now(),
        deleted_at: None,
    }
}

pub fn parent_allow(name: &str, scope: OverrideScope) -> ParentOverride {
    parent_override(name, OverrideAction::Allow, scope, None)
}

pub fn parent_block(name: &str, scope: OverrideScope) -> ParentOverride {
    parent_override(name, OverrideAction::Block, scope, None)
}

pub fn parent_override(
    name: &str,
    action: OverrideAction,
    scope: OverrideScope,
    expires_at: Option<OffsetDateTime>,
) -> ParentOverride {
    ParentOverride {
        id: Uuid::nil(),
        domain: domain(name),
        action,
        scope,
        expires_at,
        reason: "テスト".to_owned(),
        version: 1,
        created_at: now(),
        updated_at: now(),
        deleted_at: None,
    }
}

/// 判定 1 回ぶんの入力をまとめたもの。
pub struct Scenario {
    pub profile: Profile,
    pub records: DomainIndex,
    pub overrides: OverrideSet,
    pub emergency: DomainSet,
}

impl Scenario {
    pub fn new(profile: Profile) -> Self {
        Self {
            profile,
            records: DomainIndex::new(),
            overrides: OverrideSet::new(),
            emergency: DomainSet::new(),
        }
    }

    pub fn beginner() -> Self {
        Self::new(Profile::beginner())
    }

    pub fn with_record(mut self, record: DomainRecord) -> Self {
        self.records.insert(record);
        self
    }

    pub fn with_records(mut self, records: impl IntoIterator<Item = DomainRecord>) -> Self {
        for record in records {
            self.records.insert(record);
        }
        self
    }

    pub fn with_override(mut self, entry: ParentOverride) -> Self {
        self.overrides.push(entry);
        self
    }

    pub fn with_emergency(mut self, name: &str) -> Self {
        self.emergency.insert(domain(name));
        self
    }

    /// 指定ドメインを基準時刻で判定する。
    pub fn evaluate(&self, name: &str) -> Verdict {
        self.evaluate_at(name, now())
    }

    pub fn evaluate_at(&self, name: &str, at: OffsetDateTime) -> Verdict {
        let profile_id = self.profile.id;
        let request = Request::new(domain(name), at, profile_id, RequestSource::Cli);
        let ctx = PolicyContext {
            profile: &self.profile,
            records: &self.records,
            parent_overrides: &self.overrides,
            emergency_blocks: &self.emergency,
        };
        PolicyEngine::evaluate(&request, &ctx)
    }
}

/// `ProfileId` からプロファイルを作る（同梱プロファイルのみ）。
pub fn scenario_for(id: ProfileId) -> Scenario {
    Scenario::new(Profile::builtin(id).expect("同梱プロファイル"))
}

/// BEGINNER を土台に一部だけ変えたプロファイルを作る。
///
/// 同梱プロファイルでは区別できない挙動（unknown と default の違いなど）を
/// 検証するために使う。
pub fn beginner_tweaked(edit: impl FnOnce(&mut Profile)) -> Profile {
    let mut profile = Profile::beginner();
    edit(&mut profile);
    profile
}

/// 厳しい順に並べた同梱プロファイル。単調性の検証に使う。
pub const PROFILES_STRICT_TO_LOOSE: [ProfileId; 4] = [
    ProfileId::Beginner,
    ProfileId::BeginnerPlus,
    ProfileId::Standard,
    ProfileId::Teen,
];
