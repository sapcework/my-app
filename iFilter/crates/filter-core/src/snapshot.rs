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
    /// この写しを作った時点のポリシー版数。
    ///
    /// **別プロセスの変更に気づくために持つ。** UI が DB を書き換えても、
    /// サービスはメモリ上の写しを見続けるので、これが無いと
    /// 「許可したのに繋がらない」が起きる。
    pub revision: u64,
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
            revision: read_revision(store)?,
            loaded_at: at,
        })
    }
}

/// ポリシー版数を保存する `settings` のキー。
pub const REVISION_KEY: &str = "policy.revision";

/// 現在のポリシー版数を読む。未設定なら 0。
///
/// 読めない値が入っていても 0 として扱う。版数が壊れていることを理由に
/// フィルターを止めると、設定の不整合がそのまま通信断になる。
pub fn read_revision<S: PolicyStore>(store: &S) -> Result<u64> {
    Ok(store
        .setting(REVISION_KEY)?
        .and_then(|raw| raw.parse().ok())
        .unwrap_or(0))
}

/// ポリシー版数を 1 つ進める。**設定を書き換えたら必ず呼ぶ。**
pub fn bump_revision<S: PolicyStore>(store: &mut S, at: OffsetDateTime) -> Result<u64> {
    let next = read_revision(store)?.wrapping_add(1);
    store.set_setting(REVISION_KEY, &next.to_string(), at)?;
    Ok(next)
}
