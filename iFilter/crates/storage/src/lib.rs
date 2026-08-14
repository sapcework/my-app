//! iFilter のローカル永続化（SQLite）。
//!
//! **判定ロジックを持たない。** ここにあるのは保存と読み出しだけで、
//! 「このドメインを通すか」の判断は `policy-engine` の仕事
//! （docs/adr/0001-policy-engine-network-separation.md）。
//!
//! すべてのテーブルに `id` / `version` / `created_at` / `updated_at` / `deleted_at` を
//! 持たせてある。将来サーバーと差分同期するため、削除は物理削除にしない。
//!
//! ```
//! use domain_model::{Profile, ProfileId};
//! use storage::{PolicyStore, SqliteStore};
//! use time::OffsetDateTime;
//!
//! let mut store = SqliteStore::open_in_memory().unwrap();
//! store.seed_builtins(OffsetDateTime::UNIX_EPOCH).unwrap();
//!
//! let profile = store.profile(ProfileId::Beginner).unwrap().unwrap();
//! assert_eq!(profile.unknown_policy, domain_model::Decision::Block);
//! ```

pub mod codec;
pub mod error;
pub mod migrations;
pub mod sqlite;
pub mod store;

pub use error::{Result, StorageError};
pub use sqlite::SqliteStore;
pub use store::PolicyStore;
