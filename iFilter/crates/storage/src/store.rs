//! 永続化の入口となるトレイト。
//!
//! `policy-engine` の `DomainIndex` などをここで組み立てないのは、
//! `storage` が判定側に依存しないようにするため。索引の組み立ては `filter-core` が行う。

use std::collections::BTreeMap;

use domain_model::{
    AccessDecision, CategoryInfo, CategoryRegistry, DomainName, DomainRecord, ParentOverride,
    Profile, ProfileId,
};
use time::OffsetDateTime;

use crate::error::Result;

/// ローカルに保存したポリシーの読み書き。
///
/// 実装は [`crate::SqliteStore`]。トレイトにしてあるのは、
/// 将来サーバー同期版やテスト用のダミーを差し替えられるようにするため。
pub trait PolicyStore {
    fn profile(&self, id: ProfileId) -> Result<Option<Profile>>;
    fn profiles(&self) -> Result<Vec<Profile>>;
    fn upsert_profile(&mut self, profile: &Profile, at: OffsetDateTime) -> Result<()>;

    fn categories(&self) -> Result<CategoryRegistry>;
    fn upsert_category(&mut self, info: &CategoryInfo, at: OffsetDateTime) -> Result<()>;

    /// 論理削除済みも含めて返す。判定に使う前に `is_usable()` で絞ること。
    fn domain_records(&self) -> Result<Vec<DomainRecord>>;
    fn upsert_domain_record(&mut self, record: &DomainRecord) -> Result<()>;

    /// 論理削除済みも含めて返す。有効期限と削除の判定は `applies_to()` が行う。
    fn parent_overrides(&self) -> Result<Vec<ParentOverride>>;
    fn upsert_parent_override(&mut self, entry: &ParentOverride) -> Result<()>;

    fn emergency_blocks(&self) -> Result<Vec<DomainName>>;
    fn upsert_emergency_block(&mut self, domain: &DomainName, at: OffsetDateTime) -> Result<()>;

    /// 判定履歴を 1 件追加する。保存されるのは
    /// [`AccessDecision`] のフィールドだけ（docs/POLICY_MODEL.md §5）。
    fn record_decision(&mut self, entry: &AccessDecision) -> Result<()>;
    /// 新しい順に取り出す。
    fn recent_decisions(&self, limit: usize) -> Result<Vec<AccessDecision>>;

    fn setting(&self, key: &str) -> Result<Option<String>>;
    fn set_setting(&mut self, key: &str, value: &str, at: OffsetDateTime) -> Result<()>;
    fn settings(&self) -> Result<BTreeMap<String, String>>;
}
