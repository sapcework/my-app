//! 判定履歴。
//!
//! # 保存してよいものは、この型のフィールドがすべて
//!
//! `timestamp` `device_id` `domain` `category` `decision` `profile` `rule_id` だけ。
//!
//! **保存してはいけない**: ページ本文・入力フォームの内容・パスワード・検索語・
//! 通信本文・Cookie・個人メッセージ。
//!
//! ログの目的は監視ではなく、「何が・なぜ・どのルールでブロックされたか」を
//! 保護者が確認できるようにすること。フィールドを増やすときは
//! docs/POLICY_MODEL.md §5 のプライバシー方針を必ず読むこと。

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

use crate::category::CategoryId;
use crate::decision::Verdict;
use crate::decision::{Decision, RuleId};
use crate::domain::DomainName;
use crate::profile::ProfileId;
use crate::request::Request;

/// 判定 1 件の記録。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AccessDecision {
    #[serde(with = "time::serde::rfc3339")]
    pub timestamp: OffsetDateTime,
    pub device_id: String,
    pub domain: DomainName,
    /// 判定の決め手になったカテゴリ。分類が無い場合は `None`。
    pub category: Option<CategoryId>,
    pub decision: Decision,
    pub profile: ProfileId,
    pub rule_id: RuleId,
}

impl AccessDecision {
    /// 判定結果から記録を作る。
    ///
    /// `category` は呼び出し側が渡す。`Verdict` はルール ID の中にしか
    /// カテゴリを持たないため、文字列を解析して取り出すことはしない。
    pub fn from_verdict(
        request: &Request,
        verdict: &Verdict,
        device_id: impl Into<String>,
        category: Option<CategoryId>,
    ) -> Self {
        Self {
            timestamp: request.at,
            device_id: device_id.into(),
            domain: request.domain.clone(),
            category,
            decision: verdict.decision,
            profile: verdict.profile,
            rule_id: verdict.matched_rule.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::decision::Reason;
    use crate::request::RequestSource;

    #[test]
    fn 判定結果から記録を作れる() {
        let request = Request::new(
            DomainName::parse("example.com").expect("妥当"),
            OffsetDateTime::UNIX_EPOCH,
            ProfileId::Beginner,
            RequestSource::Dns,
        );
        let verdict = Verdict {
            decision: Decision::Block,
            reason: Reason::UnknownDomain,
            matched_rule: RuleId::new("beginner.unknown.block"),
            profile: ProfileId::Beginner,
            matched_domain: None,
            trace: Vec::new(),
        };

        let entry = AccessDecision::from_verdict(&request, &verdict, "device-1", None);

        assert_eq!(entry.domain.as_str(), "example.com");
        assert_eq!(entry.decision, Decision::Block);
        assert_eq!(entry.rule_id.as_str(), "beginner.unknown.block");
        assert_eq!(entry.timestamp, OffsetDateTime::UNIX_EPOCH); // 判定時刻をそのまま使う
    }

    #[test]
    fn json_と往復できる() {
        let entry = AccessDecision {
            timestamp: OffsetDateTime::UNIX_EPOCH,
            device_id: "device-1".to_owned(),
            domain: DomainName::parse("example.com").expect("妥当"),
            category: Some(CategoryId::parse("education").expect("妥当")),
            decision: Decision::Allow,
            profile: ProfileId::Beginner,
            rule_id: RuleId::new("beginner.category.education"),
        };

        let json = serde_json::to_string(&entry).expect("書ける");
        let restored: AccessDecision = serde_json::from_str(&json).expect("読める");
        assert_eq!(entry, restored);
    }
}
