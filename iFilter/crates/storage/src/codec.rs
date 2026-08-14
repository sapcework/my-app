//! 型 ↔ DB 表現の変換。
//!
//! 変換規則を `domain-model` ではなくここに置くのは、保存形式は永続化層の関心であり、
//! 判定に使う型を保存都合で歪めないため。

use domain_model::{
    CategoryId, Decision, DomainName, MatchScope, OverrideAction, OverrideScope, ProfileId,
    RecordStatus, RiskLevel, Source,
};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;
use uuid::Uuid;

use crate::error::{Result, StorageError};

fn decode_err(column: &'static str, value: &str, cause: impl Into<String>) -> StorageError {
    StorageError::Decode {
        column,
        value: value.to_owned(),
        cause: cause.into(),
    }
}

// ---- 時刻 ----

pub fn encode_time(value: OffsetDateTime) -> Result<String> {
    value.format(&Rfc3339).map_err(|err| StorageError::Encode {
        field: "timestamp",
        cause: err.to_string(),
    })
}

pub fn encode_time_opt(value: Option<OffsetDateTime>) -> Result<Option<String>> {
    value.map(encode_time).transpose()
}

pub fn decode_time(column: &'static str, value: &str) -> Result<OffsetDateTime> {
    OffsetDateTime::parse(value, &Rfc3339).map_err(|err| decode_err(column, value, err.to_string()))
}

pub fn decode_time_opt(
    column: &'static str,
    value: Option<String>,
) -> Result<Option<OffsetDateTime>> {
    value.map(|v| decode_time(column, &v)).transpose()
}

// ---- 識別子 ----

pub fn decode_uuid(column: &'static str, value: &str) -> Result<Uuid> {
    Uuid::parse_str(value).map_err(|err| decode_err(column, value, err.to_string()))
}

pub fn decode_domain(column: &'static str, value: &str) -> Result<DomainName> {
    DomainName::parse(value).map_err(|err| decode_err(column, value, err.to_string()))
}

pub fn decode_category(column: &'static str, value: &str) -> Result<CategoryId> {
    CategoryId::parse(value).map_err(|err| decode_err(column, value, err.to_string()))
}

/// プロファイル ID の保存表現。`Custom` は UUID を保つ必要がある。
pub fn encode_profile_id(value: ProfileId) -> String {
    match value {
        ProfileId::Custom(uuid) => format!("custom:{uuid}"),
        other => other.slug().to_owned(),
    }
}

pub fn decode_profile_id(column: &'static str, value: &str) -> Result<ProfileId> {
    match value {
        "beginner" => Ok(ProfileId::Beginner),
        "beginner_plus" => Ok(ProfileId::BeginnerPlus),
        "standard" => Ok(ProfileId::Standard),
        "teen" => Ok(ProfileId::Teen),
        other => match other.strip_prefix("custom:") {
            Some(uuid) => Ok(ProfileId::Custom(decode_uuid(column, uuid)?)),
            None => Err(decode_err(column, value, "未知のプロファイル ID")),
        },
    }
}

// ---- 列挙型 ----
//
// 保存表現は判定側の `slug()` と同じ文字列にしてある。
// ルール ID・ログ・DB で表記が食い違うと、追跡できなくなるため。

pub fn decode_risk(column: &'static str, value: &str) -> Result<RiskLevel> {
    match value {
        "safe" => Ok(RiskLevel::Safe),
        "low" => Ok(RiskLevel::Low),
        "medium" => Ok(RiskLevel::Medium),
        "high" => Ok(RiskLevel::High),
        "critical" => Ok(RiskLevel::Critical),
        "unknown" => Ok(RiskLevel::Unknown),
        _ => Err(decode_err(column, value, "未知のリスクレベル")),
    }
}

pub fn decode_decision(column: &'static str, value: &str) -> Result<Decision> {
    match value {
        "allow" => Ok(Decision::Allow),
        "review" => Ok(Decision::Review),
        "block" => Ok(Decision::Block),
        _ => Err(decode_err(column, value, "未知の判定")),
    }
}

pub fn encode_source(value: Source) -> &'static str {
    match value {
        Source::Bundled => "bundled",
        Source::Local => "local",
        Source::Server => "server",
        Source::Parent => "parent",
    }
}

pub fn decode_source(column: &'static str, value: &str) -> Result<Source> {
    match value {
        "bundled" => Ok(Source::Bundled),
        "local" => Ok(Source::Local),
        "server" => Ok(Source::Server),
        "parent" => Ok(Source::Parent),
        _ => Err(decode_err(column, value, "未知の出所")),
    }
}

pub fn encode_status(value: RecordStatus) -> &'static str {
    match value {
        RecordStatus::Active => "active",
        RecordStatus::Disabled => "disabled",
    }
}

pub fn decode_status(column: &'static str, value: &str) -> Result<RecordStatus> {
    match value {
        "active" => Ok(RecordStatus::Active),
        "disabled" => Ok(RecordStatus::Disabled),
        _ => Err(decode_err(column, value, "未知の状態")),
    }
}

/// ドメイン分類の照合範囲。保護者の [`OverrideScope`] とは別物なので名前を分けてある。
pub fn encode_match_scope(value: MatchScope) -> &'static str {
    match value {
        MatchScope::Domain => "domain",
        MatchScope::Suffix => "suffix",
    }
}

pub fn decode_match_scope(column: &'static str, value: &str) -> Result<MatchScope> {
    match value {
        "domain" => Ok(MatchScope::Domain),
        "suffix" => Ok(MatchScope::Suffix),
        _ => Err(decode_err(column, value, "未知の照合範囲")),
    }
}

pub fn encode_action(value: OverrideAction) -> &'static str {
    match value {
        OverrideAction::Allow => "allow",
        OverrideAction::Block => "block",
    }
}

pub fn decode_action(column: &'static str, value: &str) -> Result<OverrideAction> {
    match value {
        "allow" => Ok(OverrideAction::Allow),
        "block" => Ok(OverrideAction::Block),
        _ => Err(decode_err(column, value, "未知の動作")),
    }
}

pub fn encode_scope(value: OverrideScope) -> &'static str {
    match value {
        OverrideScope::ExactDomain => "exact",
        OverrideScope::IncludeSubdomains => "subdomains",
    }
}

pub fn decode_scope(column: &'static str, value: &str) -> Result<OverrideScope> {
    match value {
        "exact" => Ok(OverrideScope::ExactDomain),
        "subdomains" => Ok(OverrideScope::IncludeSubdomains),
        _ => Err(decode_err(column, value, "未知の適用範囲")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn プロファイル_id_が往復する() {
        let cases = [
            ProfileId::Beginner,
            ProfileId::BeginnerPlus,
            ProfileId::Standard,
            ProfileId::Teen,
            ProfileId::Custom(Uuid::from_u128(42)),
        ];

        for id in cases {
            let encoded = encode_profile_id(id);
            let decoded = decode_profile_id("id", &encoded).expect("読める");
            assert_eq!(decoded, id, "encoded={encoded}");
        }
    }

    #[test]
    fn 未知の値は読み取りエラーになる() {
        // スキーマとコードがずれたときに黙って誤動作しないこと
        assert!(decode_risk("risk_level", "とても危険").is_err());
        assert!(decode_decision("decision", "maybe").is_err());
        assert!(decode_profile_id("id", "grown_up").is_err());
        assert!(decode_scope("scope", "everything").is_err());
        assert!(decode_status("status", "archived").is_err());
        assert!(decode_source("source", "ai").is_err());
        assert!(decode_match_scope("scope", "wildcard").is_err());
    }

    #[test]
    fn 照合範囲が往復する() {
        for scope in [MatchScope::Domain, MatchScope::Suffix] {
            let encoded = encode_match_scope(scope);
            assert_eq!(
                decode_match_scope("scope", encoded).expect("読める"),
                scope,
                "encoded={encoded}"
            );
        }
    }

    #[test]
    fn 時刻が往復する() {
        let now = OffsetDateTime::UNIX_EPOCH;
        let encoded = encode_time(now).expect("書ける");
        assert_eq!(decode_time("created_at", &encoded).expect("読める"), now);
    }

    #[test]
    fn 保存表現が判定側の_slug_と一致する() {
        for risk in [
            RiskLevel::Safe,
            RiskLevel::Low,
            RiskLevel::Medium,
            RiskLevel::High,
            RiskLevel::Critical,
            RiskLevel::Unknown,
        ] {
            assert_eq!(decode_risk("r", risk.slug()).expect("読める"), risk);
        }

        for decision in [Decision::Allow, Decision::Review, Decision::Block] {
            assert_eq!(
                decode_decision("d", decision.slug()).expect("読める"),
                decision
            );
        }
    }
}
