//! ドメインの分類情報。

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::category::CategoryId;
use crate::domain::DomainName;
use crate::risk::RiskLevel;

/// 分類情報の出所。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    /// アプリに同梱した初期データ。
    Bundled,
    /// この端末で判定・登録したもの。
    Local,
    /// 将来のサーバー同期で受け取ったもの。
    Server,
    /// 保護者が登録したもの。
    Parent,
}

/// レコードの状態。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordStatus {
    Active,
    Disabled,
}

/// ドメイン 1 件の分類情報。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DomainRecord {
    /// サーバー同期のための安定 ID。
    pub id: Uuid,
    pub domain: DomainName,
    /// **複数持てる。** 子供向け動画は `kids` かつ `video`
    /// （docs/adr/0006-domain-matching-and-categories.md）。
    pub categories: Vec<CategoryId>,
    pub risk_level: RiskLevel,
    /// 分類の確信度（0.0..=1.0）。
    pub confidence: f32,
    pub source: Source,
    pub status: RecordStatus,
    /// サーバーとの差分同期用。
    pub version: u64,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    /// 論理削除。同期で削除を伝えるために物理削除しない。
    #[serde(with = "time::serde::rfc3339::option", default)]
    pub deleted_at: Option<OffsetDateTime>,
}

impl DomainRecord {
    /// 判定に使ってよいレコードか。
    pub fn is_usable(&self) -> bool {
        self.status == RecordStatus::Active && self.deleted_at.is_none()
    }

    /// カテゴリが 1 つも無い、または `unknown` のみなら「未分類」とみなす。
    pub fn is_unclassified(&self) -> bool {
        let unknown = CategoryId::unknown();
        self.categories.is_empty() || self.categories.iter().all(|c| *c == unknown)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(categories: &[&str], status: RecordStatus) -> DomainRecord {
        let now = OffsetDateTime::UNIX_EPOCH;
        DomainRecord {
            id: Uuid::nil(),
            domain: DomainName::parse("example.com").expect("妥当"),
            categories: categories
                .iter()
                .map(|c| CategoryId::parse(c).expect("妥当"))
                .collect(),
            risk_level: RiskLevel::Safe,
            confidence: 0.9,
            source: Source::Bundled,
            status,
            version: 1,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }

    #[test]
    fn 無効化と論理削除は判定に使わない() {
        assert!(record(&["education"], RecordStatus::Active).is_usable());
        assert!(!record(&["education"], RecordStatus::Disabled).is_usable());

        let mut deleted = record(&["education"], RecordStatus::Active);
        deleted.deleted_at = Some(OffsetDateTime::UNIX_EPOCH);
        assert!(!deleted.is_usable());
    }

    #[test]
    fn 未分類の判定() {
        assert!(record(&[], RecordStatus::Active).is_unclassified());
        assert!(record(&["unknown"], RecordStatus::Active).is_unclassified());
        assert!(!record(&["kids"], RecordStatus::Active).is_unclassified());
        assert!(!record(&["unknown", "kids"], RecordStatus::Active).is_unclassified());
    }

    #[test]
    fn 複数カテゴリを保持できる() {
        let r = record(&["kids", "video"], RecordStatus::Active);
        assert_eq!(r.categories.len(), 2);
    }

    #[test]
    fn json_と往復できる() {
        let original = record(&["kids", "video"], RecordStatus::Active);
        let json = serde_json::to_string(&original).expect("書ける");
        let restored: DomainRecord = serde_json::from_str(&json).expect("読める");
        assert_eq!(original, restored);
    }
}
