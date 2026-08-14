//! リスクレベル。

use serde::{Deserialize, Serialize};

/// ドメインの危険度。
///
/// `Unknown` は「まだ判定していない」であって「安全」ではない。
/// 比較のときは `Critical` と同じ重さで扱い、安全側に倒す。
/// この意図を型で示すため `Ord` は導出せず、[`RiskLevel::severity`] 経由で比較する。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Safe,
    Low,
    Medium,
    High,
    Critical,
    Unknown,
}

impl RiskLevel {
    /// 比較用の重さ。`Unknown` は `Critical` と同じ 4 を返す。
    pub fn severity(self) -> u8 {
        match self {
            Self::Safe => 0,
            Self::Low => 1,
            Self::Medium => 2,
            Self::High => 3,
            Self::Critical | Self::Unknown => 4, // 「わからない」を「たぶん安全」と読み替えない
        }
    }

    /// ルール ID に埋め込む識別子（例: `beginner.risk.critical` の `critical`）。
    pub fn slug(self) -> &'static str {
        match self {
            Self::Safe => "safe",
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::Critical => "critical",
            Self::Unknown => "unknown",
        }
    }

    /// 許容上限 `ceiling` を超えているか。超えていれば BLOCK すべき。
    pub fn exceeds(self, ceiling: Self) -> bool {
        self.severity() > ceiling.severity()
    }

    /// 2 つのうち危険な方を返す。1 ドメインが複数カテゴリを持つ場合に使う。
    ///
    /// `Ord` を導出していないため `Ord::max` とは別物。名前は
    /// [`crate::decision::Decision::stricter_of`] と対にしてある。
    pub fn worse_of(self, other: Self) -> Self {
        if other.severity() > self.severity() {
            other
        } else {
            self
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_は_critical_と同じ重さ() {
        assert_eq!(
            RiskLevel::Unknown.severity(),
            RiskLevel::Critical.severity()
        );
    }

    #[test]
    fn 上限判定() {
        assert!(RiskLevel::Medium.exceeds(RiskLevel::Low));
        assert!(!RiskLevel::Low.exceeds(RiskLevel::Low));
        assert!(!RiskLevel::Safe.exceeds(RiskLevel::Low));

        // BEGINNER の上限 Low では unknown も medium も止まる
        assert!(RiskLevel::Unknown.exceeds(RiskLevel::Low));
        assert!(RiskLevel::Critical.exceeds(RiskLevel::High));
    }

    #[test]
    fn 危険な方を採る() {
        assert_eq!(RiskLevel::Safe.worse_of(RiskLevel::High), RiskLevel::High);
        assert_eq!(
            RiskLevel::Critical.worse_of(RiskLevel::Low),
            RiskLevel::Critical
        );
    }
}
