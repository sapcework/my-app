//! iFilter の共通型定義。
//!
//! この crate は**プラットフォーム非依存**であり、Windows / Android / サーバーで共有する。
//! OS API・ファイル・ネットワーク・DB に依存するものを置いてはいけない。
//! 現在時刻も取得しない（時刻は [`request::Request::at`] として引数で渡す）
//! — docs/adr/0001-policy-engine-network-separation.md。
//!
//! 型の設計意図は docs/POLICY_MODEL.md を参照。

pub mod bundled;
pub mod category;
pub mod decision;
pub mod domain;
pub mod log;
pub mod parent;
pub mod profile;
pub mod record;
pub mod request;
pub mod risk;

pub use bundled::bundled_records;
pub use category::{CategoryId, CategoryInfo, CategoryRegistry, InvalidCategoryId};
pub use decision::{Decision, Reason, RuleId, Stage, StageOutcome, TraceStep, Verdict};
pub use domain::{DomainName, DomainParseError};
pub use log::AccessDecision;
pub use parent::{OverrideAction, OverrideScope, ParentOverride};
pub use profile::{Profile, ProfileId, TimeRule};
pub use record::{DomainRecord, MatchScope, RecordStatus, Source};
pub use request::{Request, RequestSource};
pub use risk::RiskLevel;
