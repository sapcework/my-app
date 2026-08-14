//! 保護者による個別の上書き設定。

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::domain::DomainName;

/// 保護者が指定する動作。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverrideAction {
    Allow,
    Block,
}

/// 上書きが及ぶ範囲。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverrideScope {
    /// そのドメインだけ。
    ExactDomain,
    /// サブドメインも含む。
    IncludeSubdomains,
}

/// 保護者による Allowlist / Blocklist の 1 件。
///
/// 「今回だけ許可」と「常に許可」は `expires_at` の有無で表現する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParentOverride {
    pub id: Uuid,
    pub domain: DomainName,
    pub action: OverrideAction,
    pub scope: OverrideScope,
    /// `None` なら常に有効。`Some` ならその時刻まで。
    #[serde(with = "time::serde::rfc3339::option", default)]
    pub expires_at: Option<OffsetDateTime>,
    pub reason: String,
    pub version: u64,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    /// 論理削除。物理削除にすると、他の端末へ「消したこと」を同期できない。
    #[serde(with = "time::serde::rfc3339::option", default)]
    pub deleted_at: Option<OffsetDateTime>,
}

impl ParentOverride {
    /// 時刻 `at` の時点で有効か。
    ///
    /// 現在時刻は**引数で受け取る**。判定に関わる型が時計を持たないようにするため
    /// （docs/adr/0001-policy-engine-network-separation.md）。
    pub fn is_active_at(&self, at: OffsetDateTime) -> bool {
        self.deleted_at.is_none() && self.expires_at.is_none_or(|expiry| at < expiry)
    }

    /// `target` にこの上書きが適用されるか。`scope` と有効期限の両方を見る。
    pub fn applies_to(&self, target: &DomainName, at: OffsetDateTime) -> bool {
        if !self.is_active_at(at) {
            return false;
        }
        match self.scope {
            OverrideScope::ExactDomain => *target == self.domain,
            OverrideScope::IncludeSubdomains => target.is_subdomain_of(&self.domain),
        }
    }
}

#[cfg(test)]
mod tests {
    use time::Duration;

    use super::*;

    fn d(s: &str) -> DomainName {
        DomainName::parse(s).expect("妥当")
    }

    fn ov(
        domain: &str,
        scope: OverrideScope,
        expires_at: Option<OffsetDateTime>,
    ) -> ParentOverride {
        ParentOverride {
            id: Uuid::nil(),
            domain: d(domain),
            action: OverrideAction::Allow,
            scope,
            expires_at,
            reason: "学校の宿題で使う".to_owned(),
            version: 1,
            created_at: OffsetDateTime::UNIX_EPOCH,
            updated_at: OffsetDateTime::UNIX_EPOCH,
            deleted_at: None,
        }
    }

    #[test]
    fn 期限なしは常に有効() {
        let o = ov("example.com", OverrideScope::ExactDomain, None);
        assert!(o.is_active_at(OffsetDateTime::UNIX_EPOCH));
        assert!(o.is_active_at(OffsetDateTime::UNIX_EPOCH + Duration::days(3650)));
    }

    #[test]
    fn 期限切れは無視される() {
        let expiry = OffsetDateTime::UNIX_EPOCH + Duration::hours(1);
        let o = ov("example.com", OverrideScope::ExactDomain, Some(expiry));

        assert!(o.applies_to(&d("example.com"), OffsetDateTime::UNIX_EPOCH));
        assert!(!o.applies_to(&d("example.com"), expiry + Duration::seconds(1)));
    }

    #[test]
    fn scope_でサブドメインへの波及が変わる() {
        let exact = ov("example.com", OverrideScope::ExactDomain, None);
        let subs = ov("example.com", OverrideScope::IncludeSubdomains, None);
        let now = OffsetDateTime::UNIX_EPOCH;

        assert!(exact.applies_to(&d("example.com"), now));
        assert!(!exact.applies_to(&d("sub.example.com"), now));

        assert!(subs.applies_to(&d("example.com"), now));
        assert!(subs.applies_to(&d("sub.example.com"), now));

        // ラベル境界で比較しているので別ドメインには及ばない
        assert!(!subs.applies_to(&d("notexample.com"), now));
    }

    #[test]
    fn 論理削除された設定は適用されない() {
        let mut o = ov("example.com", OverrideScope::ExactDomain, None);
        o.deleted_at = Some(OffsetDateTime::UNIX_EPOCH);

        assert!(!o.is_active_at(OffsetDateTime::UNIX_EPOCH));
        assert!(!o.applies_to(&d("example.com"), OffsetDateTime::UNIX_EPOCH));
    }
}
