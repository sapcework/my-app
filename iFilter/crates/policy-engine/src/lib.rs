//! iFilter の判定エンジン。
//!
//! **I/O を一切持たない純粋関数**として実装する。OS API・ファイル・DB・ネットワークに
//! 触れず、現在時刻すら取得しない（時刻は [`domain_model::Request::at`] で注入する）。
//! この制約が Android 移植とテスト容易性の両方を支えている
//! （docs/adr/0001-policy-engine-network-separation.md）。
//!
//! 判定順序 9 段の仕様は docs/POLICY_MODEL.md §3 を参照。
//!
//! ```
//! use domain_model::{
//!     Decision, DomainName, Profile, ProfileId, Reason, Request, RequestSource,
//! };
//! use policy_engine::{DomainIndex, DomainSet, OverrideSet, PolicyContext, PolicyEngine};
//! use time::OffsetDateTime;
//!
//! let profile = Profile::beginner();
//! let (records, overrides, emergency) =
//!     (DomainIndex::new(), OverrideSet::new(), DomainSet::new());
//!
//! let ctx = PolicyContext {
//!     profile: &profile,
//!     records: &records,
//!     parent_overrides: &overrides,
//!     emergency_blocks: &emergency,
//! };
//! let request = Request::new(
//!     DomainName::parse("example.com").unwrap(),
//!     OffsetDateTime::UNIX_EPOCH,
//!     ProfileId::Beginner,
//!     RequestSource::Cli,
//! );
//!
//! let verdict = PolicyEngine::evaluate(&request, &ctx);
//! assert_eq!(verdict.decision, Decision::Block); // 情報のないドメインは BEGINNER では通さない
//! assert_eq!(verdict.reason, Reason::UnknownDomain);
//! assert_eq!(verdict.matched_rule.as_str(), "beginner.unknown.block");
//! ```

pub mod context;
pub mod engine;

pub use context::{DomainIndex, DomainSet, OverrideSet, PolicyContext};
pub use engine::PolicyEngine;
