//! UI へ渡す形。
//!
//! `domain-model` の型はそのまま渡せるものが多い。とくに [`domain_model::Verdict`] は
//! **加工せずに渡す**。「なぜブロックされたか」を保護者が読めることがこの製品の
//! 価値そのもので、途中で情報を落とすと意味が薄れる（docs/POLICY_MODEL.md §1-6）。
//!
//! ここに置くのは、複数の情報をまとめる必要があるものだけ。

use domain_model::{AccessDecision, CategoryInfo, Decision, DomainName};
use serde::{Deserialize, Serialize};

/// 画面上部に出す全体の状態。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterStatus {
    /// サービスが登録されていて実行中か。
    pub running: bool,
    /// サービスが登録されているか。未登録なら「まだ設置されていません」。
    pub installed: bool,
    /// 使用中のプロファイル。
    pub profile: String,
    /// 保護者に見せる DB の場所。どこを見ているか分からない状態を作らない。
    pub database_path: String,
    /// ブラウザの DoH ポリシー（表示名, 設定済みか）。
    pub browser_policies: Vec<BrowserPolicyStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserPolicyStatus {
    pub browser: String,
    pub disabled: bool,
}

/// 今日の集計。Dashboard に出す。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailySummary {
    pub allowed: usize,
    pub blocked: usize,
    pub review: usize,
    /// 遮断が多かったドメイン（上位数件）。
    pub top_blocked: Vec<DomainCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainCount {
    pub domain: String,
    pub count: usize,
}

/// 遮断された問い合わせのまとまり。許可申請の画面に出す。
///
/// **どのページ由来かは DNS からは分からない。** 時間が近いものをまとめた
/// 推測にすぎないので、画面でもそう伝える（docs/ARCHITECTURE.md §7-1）。
/// 1 件ずつ許可させると、CDN やフォントを含むページでは運用が破綻する。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockedGroup {
    /// このまとまりの先頭の時刻（RFC3339）。
    pub started_at: String,
    /// まとまりに含まれるドメイン。最初の 1 件が本命の可能性が高い。
    pub domains: Vec<BlockedDomain>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockedDomain {
    pub domain: String,
    pub category: Option<String>,
    pub rule_id: String,
    pub decision: String,
    pub timestamp: String,
    /// すでに保護者が許可しているか。二重に許可させない。
    pub already_allowed: bool,
    /// 保護者の許可では解除できないカテゴリに属するか（ADR-0009）。
    ///
    /// 真なら「まとめて許可」の既定チェックから外し、理由を画面に出す。
    /// **これは判定ではなく、`Profile.forced_block_categories` を読んだ結果**。
    /// 実際の遮断は Policy Engine の 3 段目が行うので、ここを偽にしても通らない。
    pub cannot_allow: bool,
    /// このまとまりの中で同じドメインが遮断された回数。
    ///
    /// 1 ページの読み込みで同じ配信元に何十回も問い合わせるため、
    /// **行を分けると一覧が同じ名前で埋まる**。1 行にまとめて回数だけ見せる。
    pub count: usize,
}

/// カテゴリ 1 件と、選択中プロファイルでの扱い。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRule {
    pub id: String,
    pub display_name: String,
    /// カテゴリの既定リスク。**判定には使わない**表示専用の値
    /// （docs/POLICY_MODEL.md §1-3）。
    pub default_risk: String,
    /// このプロファイルでの扱い。未設定なら `None`（プロファイルの既定に落ちる）。
    pub decision: Option<String>,
}

impl CategoryRule {
    pub fn new(info: &CategoryInfo, decision: Option<Decision>) -> Self {
        Self {
            id: info.id.to_string(),
            display_name: info.display_name.clone(),
            default_risk: info.default_risk.slug().to_owned(),
            decision: decision.map(|d| d.slug().to_owned()),
        }
    }
}

/// 判定履歴 1 件。`AccessDecision` を UI が読める形にする。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionRow {
    pub timestamp: String,
    pub domain: String,
    pub category: Option<String>,
    pub decision: String,
    pub profile: String,
    pub rule_id: String,
}

impl DecisionRow {
    pub fn new(entry: &AccessDecision, timestamp: String) -> Self {
        Self {
            timestamp,
            domain: entry.domain.to_string(),
            category: entry.category.as_ref().map(ToString::to_string),
            decision: entry.decision.slug().to_owned(),
            profile: entry.profile.to_string(),
            rule_id: entry.rule_id.to_string(),
        }
    }
}

/// 許可・拒否を足すときの入力。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverrideInput {
    pub domain: String,
    /// `"allow"` または `"block"`。
    pub action: String,
    /// サブドメインにも適用するか。
    pub include_subdomains: bool,
    pub reason: String,
    /// 期限（RFC3339）。無ければ「常に」。
    pub expires_at: Option<String>,
}

/// 保護者の上書き 1 件。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverrideRow {
    pub id: String,
    pub domain: String,
    pub action: String,
    pub include_subdomains: bool,
    pub reason: String,
    pub expires_at: Option<String>,
}

/// ドメインの分類 1 件。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainRecordRow {
    pub id: String,
    pub domain: String,
    pub categories: Vec<String>,
    pub risk_level: String,
    /// `"domain"` か `"suffix"`。Suffix は同梱の基盤ドメイン専用。
    pub scope: String,
    pub source: String,
    pub editable: bool,
}

/// 判定できるドメインか確かめた結果。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainCheck {
    pub normalized: String,
    /// 公開サフィックス（`co.jp` など）は登録できない。
    pub registrable: bool,
}

impl DomainCheck {
    pub fn new(domain: &DomainName) -> Self {
        Self {
            normalized: domain.to_string(),
            registrable: domain.is_registrable(),
        }
    }
}

#[cfg(test)]
mod tests {
    use domain_model::{Reason, Stage};

    /// UI 側が日本語を引くために使っている識別子。
    ///
    /// これが変わると画面には生の識別子がそのまま出る。エラーにはならず
    /// 静かに読みにくくなるだけなので、ここで固定しておく。
    /// 変えるときは `src/labels.ts` も一緒に直すこと。
    #[test]
    fn serde_の名前が変わっていない() {
        let stages: Vec<String> = Stage::ORDER
            .iter()
            .map(|stage| serde_json::to_string(stage).expect("書ける"))
            .collect();

        assert_eq!(
            stages,
            [
                "\"emergency_block\"",
                "\"parent_block\"",
                "\"forced_category\"",
                "\"parent_allow\"",
                "\"time_window\"",
                "\"risk_ceiling\"",
                "\"category_policy\"",
                "\"unknown_policy\"",
                "\"profile_default\"",
            ],
            "Stage の名前が変わっている。src/labels.ts の stageLabel も直すこと"
        );

        for (reason, expected) in [
            (Reason::EmergencyBlock, "\"emergency_block\""),
            (Reason::ParentBlock, "\"parent_block\""),
            (Reason::ForcedCategory, "\"forced_category\""),
            (Reason::ParentAllow, "\"parent_allow\""),
            (Reason::TimeWindow, "\"time_window\""),
            (Reason::RiskCeiling, "\"risk_ceiling\""),
            (Reason::CategoryPolicy, "\"category_policy\""),
            (Reason::UnknownDomain, "\"unknown_domain\""),
            (Reason::ProfileDefault, "\"profile_default\""),
        ] {
            assert_eq!(
                serde_json::to_string(&reason).expect("書ける"),
                expected,
                "Reason の名前が変わっている。src/labels.ts の reasonLabel も直すこと"
            );
        }
    }

    /// 判定の経過は入れ子のまま UI へ渡している。形が変わると表示が壊れる。
    #[test]
    fn 判定の経過の形が変わっていない() {
        use domain_model::{Decision, StageOutcome, TraceStep};

        let hit = TraceStep {
            stage: Stage::RiskCeiling,
            outcome: StageOutcome::Hit(Decision::Block),
        };
        assert_eq!(
            serde_json::to_string(&hit).expect("書ける"),
            r#"{"stage":"risk_ceiling","outcome":{"outcome":"hit","decision":"block"}}"#
        );

        let skip = TraceStep {
            stage: Stage::TimeWindow,
            outcome: StageOutcome::Skip,
        };
        assert_eq!(
            serde_json::to_string(&skip).expect("書ける"),
            r#"{"stage":"time_window","outcome":{"outcome":"skip"}}"#
        );
    }
}
