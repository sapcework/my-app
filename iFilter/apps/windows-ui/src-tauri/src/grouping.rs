//! 遮断された問い合わせを「同じページ由来かもしれないもの」でまとめる。
//!
//! 1 つの Web ページは CDN・フォント・API など多数の第三者ドメインを引く。
//! 保護者に 1 件ずつ許可させると、ページ 1 つのために何度も操作させることになり
//! 運用が破綻する（docs/ARCHITECTURE.md §7-1）。
//!
//! **しかし DNS の問い合わせには「どのページ由来か」の情報が無い。**
//! ここでやっているのは**時間の近さによる推測**であって、事実ではない。
//! 画面でもそう伝えること。
//!
//! OS API にも DB にも触らない純粋な変換なので、そのままテストできる。

use domain_model::AccessDecision;
use time::Duration;

use crate::dto::{BlockedDomain, BlockedGroup};

/// この間隔より離れていたら別のまとまりとみなす。
///
/// 1 ページの読み込みで飛ぶ問い合わせはほぼ同時に来る。長くすると無関係な
/// 閲覧が混ざり、保護者が「これも許可するのか」と迷う。短くすると
/// 遅れて来る問い合わせが取り残されて、まとめる意味が薄れる。
const GROUP_GAP: Duration = Duration::seconds(5);

/// 1 つのまとまりに入れる上限。
///
/// 広告や計測が多いページでは数十件になる。全部並べると読めないので切る。
const MAX_PER_GROUP: usize = 20;

/// 新しい順に並んだ履歴を、時間の近さでまとめる。
///
/// `is_allowed` には「そのドメインをすでに保護者が許可しているか」を渡す。
/// 済みのものを許可候補として出し続けないため。
pub fn group_blocked(
    entries: &[AccessDecision],
    format_time: impl Fn(&AccessDecision) -> String,
    is_allowed: impl Fn(&AccessDecision) -> bool,
) -> Vec<BlockedGroup> {
    let mut groups: Vec<BlockedGroup> = Vec::new();
    let mut previous: Option<time::OffsetDateTime> = None;

    for entry in entries {
        let timestamp = format_time(entry);
        let row = BlockedDomain {
            domain: entry.domain.to_string(),
            category: entry.category.as_ref().map(ToString::to_string),
            rule_id: entry.rule_id.to_string(),
            decision: entry.decision.slug().to_owned(),
            timestamp: timestamp.clone(),
            already_allowed: is_allowed(entry),
        };

        // 新しい順に来るので、前の 1 件との差が開いたら区切る
        let continues = previous
            .map(|prev| prev - entry.timestamp <= GROUP_GAP)
            .unwrap_or(false);

        match groups.last_mut() {
            Some(group) if continues && group.domains.len() < MAX_PER_GROUP => {
                group.domains.push(row);
            }
            _ => groups.push(BlockedGroup {
                started_at: timestamp,
                domains: vec![row],
            }),
        }

        previous = Some(entry.timestamp);
    }

    groups
}

#[cfg(test)]
mod tests {
    use domain_model::{CategoryId, Decision, DomainName, ProfileId, RuleId};
    use time::OffsetDateTime;

    use super::*;

    fn entry(domain: &str, offset_secs: i64) -> AccessDecision {
        AccessDecision {
            timestamp: OffsetDateTime::UNIX_EPOCH + Duration::seconds(offset_secs),
            device_id: "test".to_owned(),
            domain: DomainName::parse(domain).expect("妥当"),
            category: Some(CategoryId::unknown()),
            decision: Decision::Block,
            profile: ProfileId::Beginner,
            rule_id: RuleId::new("beginner.unknown.block"),
        }
    }

    fn group(entries: &[AccessDecision]) -> Vec<BlockedGroup> {
        group_blocked(
            entries,
            |e| e.timestamp.unix_timestamp().to_string(),
            |_| false,
        )
    }

    fn domains_of(group: &BlockedGroup) -> Vec<&str> {
        group.domains.iter().map(|d| d.domain.as_str()).collect()
    }

    #[test]
    fn 近い時刻のものはまとまる() {
        // 1 ページの読み込みで飛ぶ問い合わせはほぼ同時に来る
        let entries = [
            entry("example.com", 100),
            entry("cdn.example.net", 99),
            entry("fonts.example.org", 98),
        ];
        let groups = group(&entries);

        assert_eq!(groups.len(), 1);
        assert_eq!(
            domains_of(&groups[0]),
            ["example.com", "cdn.example.net", "fonts.example.org"]
        );
    }

    #[test]
    fn 時間が開いたら別のまとまりになる() {
        // 無関係な閲覧を混ぜると「これも許可するのか」と迷わせる
        let entries = [entry("example.com", 100), entry("other.example", 50)];
        let groups = group(&entries);

        assert_eq!(groups.len(), 2);
        assert_eq!(domains_of(&groups[0]), ["example.com"]);
        assert_eq!(domains_of(&groups[1]), ["other.example"]);
    }

    #[test]
    fn 境界ちょうどは同じまとまり() {
        let entries = [entry("example.com", 100), entry("cdn.example.net", 95)];
        assert_eq!(group(&entries).len(), 1);

        let apart = [entry("example.com", 100), entry("cdn.example.net", 94)];
        assert_eq!(group(&apart).len(), 2);
    }

    #[test]
    fn 数珠つなぎでも間隔で判断する() {
        // 直前の 1 件との差で見る。先頭からの差で見ると、少しずつずれた列が
        // 延々と 1 つのまとまりに入り続ける
        let entries = [
            entry("a.example", 100),
            entry("b.example", 96),
            entry("c.example", 92),
        ];
        assert_eq!(group(&entries).len(), 1);
    }

    #[test]
    fn 多すぎるまとまりは打ち切る() {
        // 広告や計測が多いページでは数十件になる。全部並べると読めない
        let entries: Vec<_> = (0..30)
            .map(|i| entry(&format!("d{i}.example"), 1000 - i))
            .collect();
        let groups = group(&entries);

        assert_eq!(groups[0].domains.len(), MAX_PER_GROUP);
        assert!(groups.len() > 1, "あふれたぶんが捨てられている");
    }

    #[test]
    fn 許可済みかどうかを引き継ぐ() {
        // 済みのものを許可候補として出し続けない
        let entries = [entry("allowed.example", 100), entry("blocked.example", 100)];
        let groups = group_blocked(
            &entries,
            |_| String::new(),
            |e| e.domain.as_str() == "allowed.example",
        );

        assert!(groups[0].domains[0].already_allowed);
        assert!(!groups[0].domains[1].already_allowed);
    }

    #[test]
    fn 空の履歴では空を返す() {
        assert!(group(&[]).is_empty());
    }
}
