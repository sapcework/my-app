//! プロファイル。年齢ではなく「インターネットの慣れ」を軸にした設定の束。

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::category::CategoryId;
use crate::decision::Decision;
use crate::risk::RiskLevel;

/// プロファイルの識別子。
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProfileId {
    Beginner,
    BeginnerPlus,
    Standard,
    Teen,
    Custom(Uuid),
}

impl ProfileId {
    /// ルール ID の接頭辞（例: `beginner.unknown.block` の `beginner`）。
    pub fn slug(&self) -> &'static str {
        match self {
            Self::Beginner => "beginner",
            Self::BeginnerPlus => "beginner_plus",
            Self::Standard => "standard",
            Self::Teen => "teen",
            Self::Custom(_) => "custom",
        }
    }
}

impl fmt::Display for ProfileId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.slug())
    }
}

/// 時間帯ルール。
///
/// MVP では評価しない（段だけ用意してある）。曜日・時刻を `time` crate の型ではなく
/// 数値で持つのは、シリアライズと Android 移植を単純に保つため。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeRule {
    pub id: Uuid,
    /// 曜日のビットマスク。bit 0 = 月曜 … bit 6 = 日曜。
    pub days_mask: u8,
    /// 0 時からの経過分（0..=1440）。
    pub start_minute: u16,
    pub end_minute: u16,
    pub action: Decision,
    /// `true` なら保護者の Allow でも上書きできない（就寝時間を絶対にしたい場合）。
    /// 判定順序では 1 段目で評価する（docs/adr/0005-decision-priority.md）。
    pub hard: bool,
}

/// プロファイル本体。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile {
    pub id: ProfileId,
    pub name: String,
    /// カテゴリ別のルール。未登録のカテゴリは `unknown_policy` ではなく
    /// `default_decision` に落ちる点に注意。
    pub category_rules: BTreeMap<CategoryId, Decision>,
    /// 保護者の Allow でも解除できないカテゴリ。**MVP では空**。
    /// 集合に足すだけで「Allowlist で解除できない」挙動になる。
    pub forced_block_categories: BTreeSet<CategoryId>,
    /// これを超えるリスクは問答無用で BLOCK。
    pub risk_ceiling: RiskLevel,
    /// 情報がないドメインの扱い。
    pub unknown_policy: Decision,
    /// `true` なら最終的に REVIEW を BLOCK に落とす。
    pub review_as_block: bool,
    /// MVP では常に空。
    pub time_rules: Vec<TimeRule>,
    /// どの段にも当たらなかった場合。
    pub default_decision: Decision,
    pub version: u64,
}

impl Profile {
    pub fn category_rule(&self, id: &CategoryId) -> Option<Decision> {
        self.category_rules.get(id).copied()
    }

    pub fn is_forced_block(&self, id: &CategoryId) -> bool {
        self.forced_block_categories.contains(id)
    }

    /// 同梱プロファイルを ID から得る。`Custom` には対応しない（DB から読む）。
    pub fn builtin(id: ProfileId) -> Option<Self> {
        match id {
            ProfileId::Beginner => Some(Self::beginner()),
            ProfileId::BeginnerPlus => Some(Self::beginner_plus()),
            ProfileId::Standard => Some(Self::standard()),
            ProfileId::Teen => Some(Self::teen()),
            ProfileId::Custom(_) => None,
        }
    }

    /// 初めてインターネットを利用する小学生向け。**未知サイトは BLOCK**。
    ///
    /// 指示書 5 の初期値。保護者が変更できる前提の「初期値」であって固定値ではない。
    pub fn beginner() -> Self {
        use Decision::{Allow, Block, Review};

        Self {
            id: ProfileId::Beginner,
            name: "はじめて".to_owned(),
            category_rules: rules(&[
                ("education", Allow),
                ("kids", Allow),
                ("reference", Allow),
                ("infrastructure", Allow), // ページの部品が壊れないようにする
                ("search", Allow),         // 将来 SafeSearch 強制とあわせて運用する
                ("news", Review),
                ("video", Review),
                ("gaming", Review),
                ("shopping", Review),
                ("social", Block),
                ("forum", Block),
                ("chat", Block),
                ("dating", Block),
                ("adult", Block),
                ("gambling", Block),
                ("violence", Block),
                ("drugs", Block),
                ("weapons", Block),
                ("self_harm", Block),
                ("malware", Block),
                ("phishing", Block),
                ("fraud", Block),
                ("piracy", Block),
                // 通すと DNS フィルター自体が迂回されるので、どのプロファイルでも Block。
                // 派生プロファイル（beginner_plus / standard / teen）もこれを継承する
                ("doh", Block),
            ]),
            forced_block_categories: BTreeSet::new(), // MVP では保護者がすべて解除できる
            risk_ceiling: RiskLevel::Low,
            unknown_policy: Block,
            review_as_block: true, // BEGINNER では REVIEW を実質 BLOCK として扱う
            time_rules: Vec::new(),
            default_decision: Block,
            version: 1,
        }
    }

    /// BEGINNER に少し慣れた段階。未知サイトは BLOCK のまま、動画・ゲームを REVIEW で残す。
    pub fn beginner_plus() -> Self {
        use Decision::{Allow, Block, Review};

        let mut profile = Self::beginner();
        profile.id = ProfileId::BeginnerPlus;
        profile.name = "すこし慣れた".to_owned();
        profile.category_rules.extend(rules(&[
            ("video", Allow),
            ("gaming", Review),
            ("news", Allow),
            ("shopping", Review),
            ("forum", Block),
        ]));
        profile.risk_ceiling = RiskLevel::Low;
        profile.unknown_policy = Block;
        profile.review_as_block = false; // 保護者に判断を回せるようにする
        profile
    }

    /// 標準。未知サイトは REVIEW。
    pub fn standard() -> Self {
        use Decision::{Allow, Block, Review};

        let mut profile = Self::beginner();
        profile.id = ProfileId::Standard;
        profile.name = "標準".to_owned();
        profile.category_rules.extend(rules(&[
            ("news", Allow),
            ("video", Allow),
            ("gaming", Allow),
            ("shopping", Allow),
            ("social", Review),
            ("forum", Review),
            ("chat", Review),
            ("dating", Block),
        ]));
        profile.risk_ceiling = RiskLevel::Medium;
        profile.unknown_policy = Review;
        profile.review_as_block = false;
        profile.default_decision = Review;
        profile
    }

    /// 中高生向け。未知サイトは REVIEW。
    pub fn teen() -> Self {
        use Decision::{Allow, Block, Review};

        let mut profile = Self::standard();
        profile.id = ProfileId::Teen;
        profile.name = "中高生".to_owned();
        profile.category_rules.extend(rules(&[
            ("social", Allow),
            ("forum", Allow),
            ("chat", Allow),
            ("gambling", Block),
            ("dating", Block),
        ]));
        profile.risk_ceiling = RiskLevel::High;
        profile.unknown_policy = Review;
        profile.default_decision = Review;
        profile
    }
}

fn rules(pairs: &[(&str, Decision)]) -> BTreeMap<CategoryId, Decision> {
    pairs
        .iter()
        .map(|(id, decision)| {
            (
                CategoryId::parse(id).expect("同梱プロファイルのカテゴリ ID は妥当"),
                *decision,
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cat(id: &str) -> CategoryId {
        CategoryId::parse(id).expect("妥当")
    }

    #[test]
    fn beginner_は未知を_block_し_review_も_block_に落とす() {
        let profile = Profile::beginner();
        assert_eq!(profile.unknown_policy, Decision::Block);
        assert!(profile.review_as_block);
        assert_eq!(profile.default_decision, Decision::Block);
    }

    #[test]
    fn beginner_のカテゴリ初期値() {
        let profile = Profile::beginner();
        assert_eq!(
            profile.category_rule(&cat("education")),
            Some(Decision::Allow)
        );
        assert_eq!(profile.category_rule(&cat("kids")), Some(Decision::Allow));
        assert_eq!(profile.category_rule(&cat("adult")), Some(Decision::Block));
        assert_eq!(profile.category_rule(&cat("social")), Some(Decision::Block));
        assert_eq!(profile.category_rule(&cat("news")), Some(Decision::Review));
    }

    #[test]
    fn 基盤カテゴリは_beginner_でも許可する() {
        // これが Block だと、許可したページが CDN やフォントの遮断で崩れる
        let profile = Profile::beginner();
        assert_eq!(
            profile.category_rule(&cat("infrastructure")),
            Some(Decision::Allow)
        );
    }

    #[test]
    fn 強制ブロックカテゴリは_mvp_では空() {
        // 空にしてあることで「保護者がすべて解除できる」という MVP 要件を満たす
        for profile in [Profile::beginner(), Profile::standard(), Profile::teen()] {
            assert!(profile.forced_block_categories.is_empty());
        }
    }

    #[test]
    fn standard_と_teen_は未知を_review_にする() {
        assert_eq!(Profile::standard().unknown_policy, Decision::Review);
        assert_eq!(Profile::teen().unknown_policy, Decision::Review);
    }

    #[test]
    fn 厳しい順にリスク上限が緩む() {
        let ceilings = [
            Profile::beginner().risk_ceiling,
            Profile::standard().risk_ceiling,
            Profile::teen().risk_ceiling,
        ];
        for pair in ceilings.windows(2) {
            assert!(
                pair[0].severity() <= pair[1].severity(),
                "厳しい順が逆転している"
            );
        }
    }

    #[test]
    fn 時間ルールは_mvp_では空() {
        assert!(Profile::beginner().time_rules.is_empty());
    }

    #[test]
    fn builtin_は_custom_を返さない() {
        assert!(Profile::builtin(ProfileId::Custom(Uuid::nil())).is_none());
        assert!(Profile::builtin(ProfileId::Beginner).is_some());
    }
}
