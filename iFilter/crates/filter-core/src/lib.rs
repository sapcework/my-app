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
pub use snapshot::{PolicySnapshot, REVISION_KEY, bump_revision, read_revision};

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

    /// **別プロセスの変更があったときだけ**読み直す。読み直したら `true`。
    ///
    /// 保護者 UI は別プロセスとして DB を書き換えるので、それに気づく手段が要る。
    /// 無いと「UI で許可したのに繋がらない」が起きる。
    ///
    /// 読むのは版数 1 件だけなので、数秒ごとに呼んでも負担にならない。
    /// ポリシー全体を読み直すのは実際に変わっていたときだけ。
    pub fn reload_if_stale(&mut self, at: OffsetDateTime) -> Result<bool> {
        let current = snapshot::read_revision(&self.store)?;
        if current == self.snapshot.revision {
            return Ok(false);
        }
        self.reload(at)?;
        Ok(true)
    }

    /// 読み込んである写しの版数。
    pub fn revision(&self) -> u64 {
        self.snapshot.revision
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

    /// 保護者の上書き設定をそのまま保存し、判定に反映する。
    ///
    /// **行を増やしてよいのは、呼ぶ側が id を決めているときだけ。** 保護者が
    /// 画面や CLI から追加するときは [`Self::set_parent_override`] を使う。
    pub fn put_parent_override(
        &mut self,
        entry: &ParentOverride,
        at: OffsetDateTime,
    ) -> Result<()> {
        self.store.upsert_parent_override(entry)?;
        self.commit(at)
    }

    /// 保護者の上書き設定を追加する。**同じドメイン・同じ動作なら行を増やさず置き換える。**
    ///
    /// 保存は `id` の衝突でしか上書きされないので、追加のたびに新しい id を振ると
    /// 同じ設定が何行も並ぶ。判定は変わらない（`most_specific` が決定的に選ぶ）が、
    /// **取り消しで 1 件消しても残りが効き続ける** —— 「許可を取り消したのに、
    /// まだ通る」という、画面からは分からない形で出る。開発機の DB には
    /// 同じ許可が実際に 4 件並んでいた。
    ///
    /// 取り消しは既存の行を書き換える操作なので [`Self::put_parent_override`] を使う。
    pub fn set_parent_override(
        &mut self,
        entry: &ParentOverride,
        at: OffsetDateTime,
    ) -> Result<()> {
        let existing = self.store.parent_overrides()?.into_iter().find(|e| {
            e.deleted_at.is_none() && e.domain == entry.domain && e.action == entry.action
        });

        let mut entry = entry.clone();
        if let Some(old) = existing {
            // 既存の行を書き換える。作成日時は最初に設定したときのものを残す
            entry.id = old.id;
            entry.created_at = old.created_at;
            entry.version = old.version + 1;
        }
        self.put_parent_override(&entry, at)
    }

    /// 指定ドメインの上書き設定を取り消し、取り消した件数を返す。
    ///
    /// **物理削除しない。** 消したことを他の端末へ伝えるには行が残っている必要がある
    /// （docs/POLICY_MODEL.md §5）。
    ///
    /// 同じドメインに複数の行があれば**許可も拒否もまとめて**取り消す。1 件だけ
    /// 消すと残りが効き続け、「消したのに変わらない」になる。
    pub fn clear_parent_overrides(
        &mut self,
        domain: &DomainName,
        at: OffsetDateTime,
    ) -> Result<usize> {
        let targets: Vec<ParentOverride> = self
            .store
            .parent_overrides()?
            .into_iter()
            .filter(|e| e.deleted_at.is_none() && &e.domain == domain)
            .collect();

        for entry in &targets {
            let mut entry = entry.clone();
            entry.deleted_at = Some(at);
            entry.updated_at = at;
            entry.version += 1;
            self.store.upsert_parent_override(&entry)?;
        }

        // 版数を進めるのは最後に一度でよい。動いているサービスは版数だけを見ており、
        // 1 行ごとに進めると、その途中の状態を読み込ませることになる
        if !targets.is_empty() {
            self.commit(at)?;
        }
        Ok(targets.len())
    }

    /// ドメインの分類を保存し、判定に反映する。
    pub fn put_domain_record(&mut self, record: &DomainRecord, at: OffsetDateTime) -> Result<()> {
        self.store.upsert_domain_record(record)?;
        self.commit(at)
    }

    /// プロファイルを保存し、使用中のものなら判定に反映する。
    ///
    /// 使用中でなくても版数は進める。別プロセスが**そのプロファイルを使っている**
    /// 可能性があるため。
    pub fn put_profile(&mut self, profile: &Profile, at: OffsetDateTime) -> Result<()> {
        self.store.upsert_profile(profile, at)?;
        if profile.id == self.snapshot.profile.id {
            self.commit(at)
        } else {
            // 使っていないプロファイルなので写しの中身は変わらない。版数だけ
            // 合わせておく。放っておくと次の `reload_if_stale` が自分の書き込みに
            // 反応して、意味のない読み直しが走る
            self.snapshot.revision = snapshot::bump_revision(&mut self.store, at)?;
            Ok(())
        }
    }

    /// 設定値を保存する。
    ///
    /// 使用中プロファイルのように**判定に影響しうる**値が入るので、版数も進める。
    /// 進めないと、動いているフィルターが古い設定のまま動き続ける。
    pub fn put_setting(&mut self, key: &str, value: &str, at: OffsetDateTime) -> Result<()> {
        self.store.set_setting(key, value, at)?;
        self.snapshot.revision = snapshot::bump_revision(&mut self.store, at)?;
        Ok(())
    }

    /// 書き換えたあとの共通処理。版数を進めてから読み直す。
    ///
    /// 順序が逆だと、進める前の版数を写しに取り込んでしまい、
    /// 次の `reload_if_stale` が「変わっている」と誤判定して無駄に読み直す。
    fn commit(&mut self, at: OffsetDateTime) -> Result<()> {
        snapshot::bump_revision(&mut self.store, at)?;
        self.reload(at)
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
