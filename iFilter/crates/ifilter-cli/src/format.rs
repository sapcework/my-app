//! 判定結果の表示。
//!
//! **保護者が読んで理解できること**を優先する。内部の識別子をそのまま出すのではなく、
//! 「なぜ止まったのか」が伝わる日本語を添える。

use domain_model::{CategoryId, Decision, Profile, Reason, Stage, StageOutcome, Verdict};
use time::OffsetDateTime;

/// そのドメインのカテゴリのうち、保護者の許可では解除できないものを返す。
///
/// **判定ではない。** 遮断は Policy Engine の 3 段目が単独で行う（ADR-0009）。
/// ここは「許可しても効かない」と伝えるための表示用。
pub fn forced_categories(profile: &Profile, categories: &[CategoryId]) -> Vec<String> {
    categories
        .iter()
        .filter(|category| profile.is_forced_block(category))
        .map(ToString::to_string)
        .collect()
}

/// 履歴一覧に出す時刻。
///
/// `OffsetDateTime` の既定表示は秒の小数部とオフセットまで出て読みにくい。
/// 保護者が眺める画面なので秒までに切り詰める。
pub fn timestamp(value: OffsetDateTime) -> String {
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        value.year(),
        u8::from(value.month()),
        value.day(),
        value.hour(),
        value.minute(),
        value.second()
    )
}

/// 判定の一行説明。
pub fn reason_text(reason: Reason) -> &'static str {
    match reason {
        Reason::EmergencyBlock => "緊急ブロックリストに登録されています",
        Reason::ParentBlock => "保護者が見せない設定にしています",
        Reason::ForcedCategory => "解除できないカテゴリに分類されています",
        Reason::ParentAllow => "保護者が許可しています",
        Reason::TimeWindow => "いまは使える時間帯ではありません",
        Reason::RiskCeiling => "このサイト自体が危険と判断されています",
        Reason::CategoryPolicy => "サイトの種類に対する設定によるものです",
        Reason::UnknownDomain => "安全性を確認できていないサイトです",
        Reason::ProfileDefault => "どの設定にも当てはまらなかったため既定の扱いです",
    }
}

/// 段の日本語名。
pub fn stage_text(stage: Stage) -> &'static str {
    match stage {
        Stage::EmergencyBlock => "緊急ブロック",
        Stage::ParentBlock => "保護者の拒否",
        Stage::ForcedCategory => "解除不可カテゴリ",
        Stage::ParentAllow => "保護者の許可",
        Stage::TimeWindow => "時間帯",
        Stage::RiskCeiling => "リスク上限",
        Stage::CategoryPolicy => "カテゴリ別ルール",
        Stage::UnknownPolicy => "未知サイトの扱い",
        Stage::ProfileDefault => "既定",
    }
}

/// 端末上での表示幅。日本語は 1 文字で 2 桁ぶんを占める。
///
/// `{:<18}` のような書式指定は**文字数**で数えるため、日本語混じりの表で桁が崩れる。
fn display_width(text: &str) -> usize {
    text.chars().map(|c| if c.is_ascii() { 1 } else { 2 }).sum()
}

/// 表示幅で右側を埋める。
fn pad_right(text: &str, width: usize) -> String {
    let padding = width.saturating_sub(display_width(text));
    format!("{text}{}", " ".repeat(padding))
}

fn outcome_text(outcome: StageOutcome) -> String {
    match outcome {
        StageOutcome::Hit(decision) => format!("該当 → {decision}"),
        StageOutcome::Miss => "非該当".to_owned(),
        StageOutcome::Skip => "評価対象なし".to_owned(),
    }
}

/// 人が読む形式で 1 件の判定を出力する。
pub fn render(domain: &str, verdict: &Verdict, with_trace: bool) -> String {
    let mut out = String::new();

    out.push_str(&format!("{}\n", verdict.decision));
    out.push_str(&format!("サイト  : {domain}\n"));
    out.push_str(&format!("理由    : {}\n", reason_text(verdict.reason)));
    out.push_str(&format!("ルール  : {}\n", verdict.matched_rule));
    out.push_str(&format!("設定    : {}\n", verdict.profile));

    if let Some(matched) = &verdict.matched_domain {
        out.push_str(&format!("一致先  : {matched}\n"));
    }

    // REVIEW が BLOCK に落ちた場合は、そうと分かるようにする。
    // 保護者が「本当は相談してよい種類のサイト」と判断できるようにするため
    let downgraded = verdict.decision == Decision::Block
        && verdict
            .trace
            .last()
            .is_some_and(|step| step.outcome == StageOutcome::Hit(Decision::Review));
    if downgraded {
        out.push_str("補足    : 本来は「保護者に相談」の扱いですが、\n");
        out.push_str("          いまの設定では見せない扱いになっています\n");
    }

    if with_trace {
        out.push_str("\n判定の経過:\n");
        for (index, step) in verdict.trace.iter().enumerate() {
            out.push_str(&format!(
                "  {} {} … {}\n",
                index + 1,
                pad_right(stage_text(step.stage), 20),
                outcome_text(step.outcome)
            ));
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use domain_model::{ProfileId, RuleId, TraceStep};

    use super::*;

    fn verdict(decision: Decision, reason: Reason, trace: Vec<TraceStep>) -> Verdict {
        Verdict {
            decision,
            reason,
            matched_rule: RuleId::new("beginner.unknown.block"),
            profile: ProfileId::Beginner,
            matched_domain: None,
            trace,
        }
    }

    fn category(id: &str) -> CategoryId {
        CategoryId::parse(id).expect("妥当")
    }

    #[test]
    fn 解除できないカテゴリだけを拾う() {
        // doh を許可しても効かないことを保護者に伝えるための材料（ADR-0009）
        let profile = Profile::beginner();
        let forced = forced_categories(&profile, &[category("doh"), category("search")]);

        assert_eq!(forced, ["doh"]);
    }

    #[test]
    fn 解除できるカテゴリでは何も返さない() {
        // adult は保護者が解除できる。ここで拾うと余計な警告が出る
        let profile = Profile::beginner();
        let forced = forced_categories(&profile, &[category("adult"), category("gambling")]);

        assert!(forced.is_empty());
    }

    #[test]
    fn 基本の出力に必要な項目がそろう() {
        let text = render(
            "example.com",
            &verdict(Decision::Block, Reason::UnknownDomain, Vec::new()),
            false,
        );

        assert!(text.starts_with("BLOCK"));
        assert!(text.contains("example.com"));
        assert!(text.contains("安全性を確認できていないサイトです"));
        assert!(text.contains("beginner.unknown.block"));
    }

    #[test]
    fn trace_を付けると経過が出る() {
        let trace = vec![
            TraceStep {
                stage: Stage::EmergencyBlock,
                outcome: StageOutcome::Skip,
            },
            TraceStep {
                stage: Stage::UnknownPolicy,
                outcome: StageOutcome::Hit(Decision::Block),
            },
        ];
        let text = render(
            "example.com",
            &verdict(Decision::Block, Reason::UnknownDomain, trace),
            true,
        );

        assert!(text.contains("判定の経過"));
        assert!(text.contains("緊急ブロック"));
        assert!(text.contains("評価対象なし"));
        assert!(text.contains("該当 → BLOCK"));
    }

    #[test]
    fn review_から落ちた場合は補足が出る() {
        let trace = vec![TraceStep {
            stage: Stage::CategoryPolicy,
            outcome: StageOutcome::Hit(Decision::Review),
        }];
        let text = render(
            "news.example.com",
            &verdict(Decision::Block, Reason::CategoryPolicy, trace),
            false,
        );

        assert!(text.contains("本来は「保護者に相談」の扱い"));
    }

    #[test]
    fn 日本語混じりでも桁がそろう() {
        // 書式指定の `{:<n}` は文字数で数えるため、日本語の表では桁が崩れる
        assert_eq!(display_width("緊急ブロック"), 12);
        assert_eq!(display_width("abc"), 3);

        let lines: Vec<String> = [
            Stage::EmergencyBlock,
            Stage::TimeWindow,
            Stage::CategoryPolicy,
        ]
        .iter()
        .map(|stage| pad_right(stage_text(*stage), 20))
        .collect();

        let widths: Vec<usize> = lines.iter().map(|line| display_width(line)).collect();
        assert_eq!(widths, vec![20, 20, 20]);
    }

    #[test]
    fn 通常の_block_では補足を出さない() {
        let trace = vec![TraceStep {
            stage: Stage::UnknownPolicy,
            outcome: StageOutcome::Hit(Decision::Block),
        }];
        let text = render(
            "example.com",
            &verdict(Decision::Block, Reason::UnknownDomain, trace),
            false,
        );

        assert!(!text.contains("本来は"));
    }
}
