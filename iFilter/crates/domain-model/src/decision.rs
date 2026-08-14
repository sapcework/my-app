//! 判定結果と、その理由を追跡するための型。
//!
//! [`Verdict`] はデバッグ専用ではなく**保護者 UI にそのまま表示する**。
//! 「なぜブロックされたか」を保護者が理解できることが、この製品の価値そのもの。

use std::fmt;

use serde::{Deserialize, Serialize};

use crate::domain::DomainName;
use crate::profile::ProfileId;

/// 最終的な判定。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Decision {
    /// 安全と判断され、アクセスを許可する。
    Allow,
    /// 子供だけではアクセスできず、保護者の判断が必要。
    Review,
    /// アクセスを拒否する。
    Block,
}

impl Decision {
    /// 制限の強さ。`Allow` < `Review` < `Block`。
    pub fn restrictiveness(self) -> u8 {
        match self {
            Self::Allow => 0,
            Self::Review => 1,
            Self::Block => 2,
        }
    }

    /// 2 つのうち制限が強い方を返す。
    pub fn stricter_of(self, other: Self) -> Self {
        if other.restrictiveness() > self.restrictiveness() {
            other
        } else {
            self
        }
    }

    /// ルール ID に埋め込む識別子（例: `beginner.unknown.block` の `block`）。
    pub fn slug(self) -> &'static str {
        match self {
            Self::Allow => "allow",
            Self::Review => "review",
            Self::Block => "block",
        }
    }

    /// 複数のうち最も制限が強いものを返す。
    ///
    /// 1 ドメインが複数カテゴリを持つときに使う（`kids` かつ `video` なら `Review`）。
    /// カテゴリ登録の粒度が荒くても危険側に倒れる。
    pub fn most_restrictive(decisions: impl IntoIterator<Item = Self>) -> Option<Self> {
        decisions.into_iter().reduce(Self::stricter_of)
    }
}

impl fmt::Display for Decision {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Allow => "ALLOW",
            Self::Review => "REVIEW",
            Self::Block => "BLOCK",
        };
        f.write_str(s)
    }
}

/// 判定順序の各段。docs/POLICY_MODEL.md §3 と 1 対 1 で対応する。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Stage {
    EmergencyBlock,
    ParentBlock,
    ForcedCategory,
    ParentAllow,
    TimeWindow,
    RiskCeiling,
    CategoryPolicy,
    UnknownPolicy,
    ProfileDefault,
}

impl Stage {
    /// 評価する順序。上から評価し、最初に確定した段で打ち切る。
    pub const ORDER: [Self; 9] = [
        Self::EmergencyBlock,
        Self::ParentBlock,
        Self::ForcedCategory,
        Self::ParentAllow,
        Self::TimeWindow,
        Self::RiskCeiling,
        Self::CategoryPolicy,
        Self::UnknownPolicy,
        Self::ProfileDefault,
    ];
}

/// ある段を評価した結果。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "outcome", content = "decision")]
pub enum StageOutcome {
    /// 判定が確定した。
    Hit(Decision),
    /// 該当しなかった。
    Miss,
    /// 評価対象そのものが無い（ルール未設定・情報不足）。
    Skip,
}

/// 1 段ぶんの評価記録。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TraceStep {
    pub stage: Stage,
    pub outcome: StageOutcome,
}

/// 判定が確定した理由。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Reason {
    EmergencyBlock,
    ParentBlock,
    ForcedCategory,
    ParentAllow,
    TimeWindow,
    RiskCeiling,
    CategoryPolicy,
    UnknownDomain,
    ProfileDefault,
}

/// 判定に使われたルールの安定 ID（例: `beginner.unknown.block`）。
///
/// ログと保護者 UI の両方で使うため、表示文言ではなく安定した ID を持たせる。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct RuleId(String);

impl RuleId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for RuleId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// 判定の最終結果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Verdict {
    pub decision: Decision,
    pub reason: Reason,
    pub matched_rule: RuleId,
    pub profile: ProfileId,
    /// 階層マッチでどのドメインに当たったか。未一致なら `None`。
    pub matched_domain: Option<DomainName>,
    pub trace: Vec<TraceStep>,
}

impl Verdict {
    /// `REVIEW` を `BLOCK` に落とす（`profile.review_as_block` 用）。
    ///
    /// `reason` は元の値を保持する。保護者 UI で「本来は要確認」と示せるようにするため。
    pub fn downgrade_review_to_block(mut self) -> Self {
        if self.decision == Decision::Review {
            self.decision = Decision::Block;
        }
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 制限の強さ() {
        assert!(Decision::Block.restrictiveness() > Decision::Review.restrictiveness());
        assert!(Decision::Review.restrictiveness() > Decision::Allow.restrictiveness());
    }

    #[test]
    fn 最も制限的なものが勝つ() {
        // kids(Allow) + video(Review) → Review
        assert_eq!(
            Decision::most_restrictive([Decision::Allow, Decision::Review]),
            Some(Decision::Review)
        );
        // education(Allow) + adult(Block) → Block
        assert_eq!(
            Decision::most_restrictive([Decision::Allow, Decision::Block]),
            Some(Decision::Block)
        );
        // news(Review) + adult(Block) → Block
        assert_eq!(
            Decision::most_restrictive([Decision::Review, Decision::Block]),
            Some(Decision::Block)
        );
        assert_eq!(Decision::most_restrictive([]), None);
    }

    #[test]
    fn 段の順序が_9_段ある() {
        assert_eq!(Stage::ORDER.len(), 9);
        assert_eq!(Stage::ORDER[0], Stage::EmergencyBlock);
        assert_eq!(Stage::ORDER[8], Stage::ProfileDefault);
    }

    #[test]
    fn review_を_block_に落としても理由は残る() {
        let verdict = Verdict {
            decision: Decision::Review,
            reason: Reason::CategoryPolicy,
            matched_rule: RuleId::new("beginner.category.news"),
            profile: ProfileId::Beginner,
            matched_domain: None,
            trace: Vec::new(),
        };

        let downgraded = verdict.downgrade_review_to_block();
        assert_eq!(downgraded.decision, Decision::Block);
        assert_eq!(downgraded.reason, Reason::CategoryPolicy); // 「本来は要確認」と示せる
    }
}
