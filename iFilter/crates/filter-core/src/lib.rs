//! iFilter の中核。
//!
//! ネットワーク層（DNS / WFP / 将来の VpnService）から見た**唯一の入口**。
//! 保存済みのポリシーを読み込んで判定エンジンに渡し、結果を返す。
//!
//! ここも OS 固有 API には触れない。DNS 応答の組み立てやサービス登録は
//! `windows/` 側の仕事（docs/adr/0001-policy-engine-network-separation.md）。
//!
//! ```
//! use domain_model::{Decision, DomainName, ProfileId, RequestSource};
//! use filter_core::FilterCore;
//! use storage::SqliteStore;
//! use time::OffsetDateTime;
//!
//! let mut store = SqliteStore::open_in_memory().unwrap();
//! store.seed_builtins(OffsetDateTime::UNIX_EPOCH).unwrap();
//!
//! let core = FilterCore::load(store, ProfileId::Beginner, "device-1", OffsetDateTime::UNIX_EPOCH)
//!     .unwrap();
//!
//! let domain = DomainName::parse("example.com").unwrap();
//! let verdict = core.decide(&domain, OffsetDateTime::UNIX_EPOCH, RequestSource::Cli);
//! assert_eq!(verdict.decision, Decision::Block);
//! ```

mod error;
mod snapshot;

use domain_model::{
    AccessDecision, CategoryId, DomainName, DomainRecord, ParentOverride, Profile, ProfileId,
    Request, RequestSource, Verdict,
};
use policy_engine::{PolicyContext, PolicyEngine};
use storage::PolicyStore;
use time::OffsetDateTime;

pub use error::{CoreError, Result};
pub use snapshot::PolicySnapshot;

/// 判定の入口。
///
/// ポリシーはメモリ上の [`PolicySnapshot`] に載せてある。DNS の問い合わせごとに
/// DB を読むと遅すぎるため。設定を変えたときは内部で自動的に読み直す。
pub struct FilterCore<S: PolicyStore> {
    store: S,
    snapshot: PolicySnapshot,
    device_id: String,
}

impl<S: PolicyStore> FilterCore<S> {
    /// 保存済みポリシーを読み込む。
    ///
    /// 指定したプロファイルが DB に無ければ [`CoreError::ProfileNotFound`]。
    /// 同梱プロファイルは `SqliteStore::seed_builtins` で書き込んでおく。
    pub fn load(
        store: S,
        profile_id: ProfileId,
        device_id: impl Into<String>,
        at: OffsetDateTime,
    ) -> Result<Self> {
        let snapshot = PolicySnapshot::load(&store, profile_id, at)?;
        Ok(Self {
            store,
            snapshot,
            device_id: device_id.into(),
        })
    }

    /// DB から読み直す。外部から DB を書き換えた場合に使う。
    pub fn reload(&mut self, at: OffsetDateTime) -> Result<()> {
        self.snapshot = PolicySnapshot::load(&self.store, self.snapshot.profile.id, at)?;
        Ok(())
    }

    /// 使用するプロファイルを切り替える。
    pub fn switch_profile(&mut self, profile_id: ProfileId, at: OffsetDateTime) -> Result<()> {
        self.snapshot = PolicySnapshot::load(&self.store, profile_id, at)?;
        Ok(())
    }

    /// 1 件判定する。**履歴には残さない。**
    pub fn decide(
        &self,
        domain: &DomainName,
        at: OffsetDateTime,
        source: RequestSource,
    ) -> Verdict {
        let request = Request::new(domain.clone(), at, self.snapshot.profile.id, source);
        let ctx = PolicyContext {
            profile: &self.snapshot.profile,
            records: &self.snapshot.records,
            parent_overrides: &self.snapshot.overrides,
            emergency_blocks: &self.snapshot.emergency,
        };
        PolicyEngine::evaluate(&request, &ctx)
    }

    /// 判定して履歴に残す。実際のフィルターはこちらを使う。
    pub fn decide_and_log(
        &mut self,
        domain: &DomainName,
        at: OffsetDateTime,
        source: RequestSource,
    ) -> Result<Verdict> {
        let verdict = self.decide(domain, at, source);
        let entry = self.log_entry(domain, at, &verdict);
        self.store.record_decision(&entry)?;
        Ok(verdict)
    }

    /// 判定に使われたドメインの主カテゴリ。履歴に残すために使う。
    fn primary_category(&self, domain: &DomainName) -> Option<CategoryId> {
        self.snapshot
            .records
            .lookup(domain)
            .and_then(|record| record.categories.first().cloned())
    }

    fn log_entry(
        &self,
        domain: &DomainName,
        at: OffsetDateTime,
        verdict: &Verdict,
    ) -> AccessDecision {
        let request = Request::new(
            domain.clone(),
            at,
            self.snapshot.profile.id,
            RequestSource::Dns,
        );
        AccessDecision::from_verdict(
            &request,
            verdict,
            self.device_id.clone(),
            self.primary_category(domain),
        )
    }

    /// 保護者の上書き設定を保存し、判定に反映する。
    pub fn put_parent_override(
        &mut self,
        entry: &ParentOverride,
        at: OffsetDateTime,
    ) -> Result<()> {
        self.store.upsert_parent_override(entry)?;
        self.reload(at)
    }

    /// ドメインの分類を保存し、判定に反映する。
    pub fn put_domain_record(&mut self, record: &DomainRecord, at: OffsetDateTime) -> Result<()> {
        self.store.upsert_domain_record(record)?;
        self.reload(at)
    }

    /// プロファイルを保存し、使用中のものなら判定に反映する。
    pub fn put_profile(&mut self, profile: &Profile, at: OffsetDateTime) -> Result<()> {
        self.store.upsert_profile(profile, at)?;
        if profile.id == self.snapshot.profile.id {
            self.reload(at)?;
        }
        Ok(())
    }

    pub fn profile(&self) -> &Profile {
        &self.snapshot.profile
    }

    pub fn snapshot(&self) -> &PolicySnapshot {
        &self.snapshot
    }

    pub fn device_id(&self) -> &str {
        &self.device_id
    }

    /// 読み出し専用の DB アクセス。履歴や設定の閲覧に使う。
    pub fn store(&self) -> &S {
        &self.store
    }
}
