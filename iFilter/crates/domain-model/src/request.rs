//! 判定の入力。

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

use crate::domain::DomainName;
use crate::profile::ProfileId;

/// どのネットワーク層から来た問い合わせか。
///
/// **記録用であり、判定に使ってはいけない。** 「DNS から来たときだけ緩くする」といった
/// 分岐を入れた瞬間に、Android 移植で挙動が変わる
/// （docs/adr/0001-policy-engine-network-separation.md）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RequestSource {
    Dns,
    Wfp,
    Cli,
    Ui,
    /// 将来の Android VpnService。
    Vpn,
}

/// 1 件の判定要求。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Request {
    pub domain: DomainName,
    /// 現在時刻。engine は時計を持たないので**必ず呼び出し側が渡す**。
    #[serde(with = "time::serde::rfc3339")]
    pub at: OffsetDateTime,
    pub profile_id: ProfileId,
    pub source: RequestSource,
}

impl Request {
    pub fn new(
        domain: DomainName,
        at: OffsetDateTime,
        profile_id: ProfileId,
        source: RequestSource,
    ) -> Self {
        Self {
            domain,
            at,
            profile_id,
            source,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 生成できる() {
        let req = Request::new(
            DomainName::parse("example.com").expect("妥当"),
            OffsetDateTime::UNIX_EPOCH,
            ProfileId::Beginner,
            RequestSource::Cli,
        );
        assert_eq!(req.domain.as_str(), "example.com");
        assert_eq!(req.profile_id, ProfileId::Beginner);
    }
}
