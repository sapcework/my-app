//! 判定に必要なデータをまとめた入力。
//!
//! ここに置くのは**すでにメモリ上にあるデータへの参照だけ**。DB から読む・
//! ファイルを開くといった操作は呼び出し側（`filter-core`）の責務であり、
//! この crate には持ち込まない（docs/adr/0001-policy-engine-network-separation.md）。

use std::collections::{BTreeSet, HashMap};

use domain_model::{DomainName, DomainRecord, MatchScope, OverrideAction, ParentOverride, Profile};
use time::OffsetDateTime;

/// ドメイン → 分類情報の索引。
///
/// 照合範囲ごとに 2 つに分けて持つ。サフィックスは件数が少なく、階層マッチで
/// 引けないので線形に見る（`DomainName::is_within`）。
#[derive(Debug, Clone, Default)]
pub struct DomainIndex {
    by_domain: HashMap<DomainName, DomainRecord>,
    suffixes: Vec<DomainRecord>,
}

impl DomainIndex {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, record: DomainRecord) {
        match record.scope {
            MatchScope::Domain => {
                self.by_domain.insert(record.domain.clone(), record);
            }
            MatchScope::Suffix => {
                // 同じドメインの登録は差し替える。upsert と挙動をそろえる
                self.suffixes.retain(|r| r.domain != record.domain);
                self.suffixes.push(record);
            }
        }
    }

    pub fn len(&self) -> usize {
        self.by_domain.len() + self.suffixes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_domain.is_empty() && self.suffixes.is_empty()
    }

    /// 階層をたどって**最も具体的な**レコードを返す。
    ///
    /// 候補は eTLD+1 までで打ち切られる（`DomainName::match_candidates`）。
    /// 無効化・論理削除されたレコードは飛ばして、より上位の候補を見る。
    ///
    /// 階層マッチで当たらなかったときだけサフィックス登録を見る。順序が逆だと
    /// `cloudfront.net` の一括許可が、その配下に付けた個別の分類を握りつぶす。
    pub fn lookup(&self, domain: &DomainName) -> Option<&DomainRecord> {
        domain
            .match_candidates()
            .iter()
            .find_map(|candidate| self.by_domain.get(candidate).filter(|r| r.is_usable()))
            .or_else(|| self.lookup_suffix(domain))
    }

    /// サフィックス登録のうち、**最も長い（＝具体的な）** ものを返す。
    ///
    /// 長さが同じなら文字列順で決める。結果を決定的にするため。
    fn lookup_suffix(&self, domain: &DomainName) -> Option<&DomainRecord> {
        self.suffixes
            .iter()
            .filter(|r| r.is_usable() && domain.is_within(&r.domain))
            .max_by_key(|r| (r.domain.as_str().len(), r.domain.as_str()))
    }
}

impl FromIterator<DomainRecord> for DomainIndex {
    fn from_iter<T: IntoIterator<Item = DomainRecord>>(iter: T) -> Self {
        let mut index = Self::new();
        for record in iter {
            index.insert(record);
        }
        index
    }
}

/// 保護者の Allowlist / Blocklist。
#[derive(Debug, Clone, Default)]
pub struct OverrideSet {
    entries: Vec<ParentOverride>,
}

impl OverrideSet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, entry: ParentOverride) {
        self.entries.push(entry);
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// 指定の動作で `domain` に適用される、**最も具体的な**設定を返す。
    ///
    /// 同じ動作で複数一致した場合はドメインが長い方（＝より具体的な方）を採る。
    /// 長さが同じなら文字列順で決める（結果を決定的にするため）。
    pub fn most_specific(
        &self,
        domain: &DomainName,
        at: OffsetDateTime,
        action: OverrideAction,
    ) -> Option<&ParentOverride> {
        self.entries
            .iter()
            .filter(|entry| entry.action == action && entry.applies_to(domain, at))
            .max_by_key(|entry| (entry.domain.as_str().len(), entry.domain.as_str()))
    }
}

impl FromIterator<ParentOverride> for OverrideSet {
    fn from_iter<T: IntoIterator<Item = ParentOverride>>(iter: T) -> Self {
        Self {
            entries: iter.into_iter().collect(),
        }
    }
}

/// ドメインの集合。緊急ブロックリストに使う。
#[derive(Debug, Clone, Default)]
pub struct DomainSet {
    domains: BTreeSet<DomainName>,
}

impl DomainSet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, domain: DomainName) {
        self.domains.insert(domain);
    }

    pub fn len(&self) -> usize {
        self.domains.len()
    }

    pub fn is_empty(&self) -> bool {
        self.domains.is_empty()
    }

    /// 階層をたどって一致するドメインを返す。サブドメインにも及ぶ。
    pub fn matching(&self, target: &DomainName) -> Option<&DomainName> {
        target
            .match_candidates()
            .iter()
            .find_map(|candidate| self.domains.get(candidate))
    }
}

impl FromIterator<DomainName> for DomainSet {
    fn from_iter<T: IntoIterator<Item = DomainName>>(iter: T) -> Self {
        Self {
            domains: iter.into_iter().collect(),
        }
    }
}

/// 判定 1 回に必要なデータ一式。
#[derive(Debug, Clone, Copy)]
pub struct PolicyContext<'a> {
    pub profile: &'a Profile,
    pub records: &'a DomainIndex,
    pub parent_overrides: &'a OverrideSet,
    /// システム定義の緊急ブロック。保護者も解除できない。**MVP では空**。
    pub emergency_blocks: &'a DomainSet,
}
