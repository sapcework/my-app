//! メモリ上に載せたポリシー一式。

use domain_model::{CategoryRegistry, Profile, ProfileId};
use policy_engine::{DomainIndex, DomainSet, OverrideSet};
use storage::PolicyStore;
use time::OffsetDateTime;

use crate::error::{CoreError, Result};

/// ある時点のポリシーの写し。
///
/// DNS の問い合わせは 1 ページ表示ごとに何十件も飛ぶため、そのたびに DB を
/// 読むわけにはいかない。設定変更時にまとめて読み直す。
pub struct PolicySnapshot {
    pub profile: Profile,
    pub records: DomainIndex,
    pub overrides: OverrideSet,
    pub emergency: DomainSet,
    /// この写しを作った時刻。UI で「最終更新」を出すために持つ。
    pub loaded_at: OffsetDateTime,
    /// カテゴリの表示名。判定には使わないが、保護者への説明に要る
    /// （docs/POLICY_MODEL.md §1-3）。
    pub categories: CategoryRegistry,
}

impl PolicySnapshot {
    pub fn load<S: PolicyStore>(
        store: &S,
        profile_id: ProfileId,
        at: OffsetDateTime,
    ) -> Result<Self> {
        let profile = store
            .profile(profile_id)?
            .ok_or(CoreError::ProfileNotFound(profile_id))?;

        Ok(Self {
            profile,
            records: store.domain_records()?.into_iter().collect(),
            overrides: store.parent_overrides()?.into_iter().collect(),
            emergency: store.emergency_blocks()?.into_iter().collect(),
            categories: store.categories()?,
            loaded_at: at,
        })
    }
}
