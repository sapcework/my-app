//! 判定 9 段の本体。
//!
//! 上から評価し、**最初に確定した段で打ち切る**。各段の評価結果は `trace` に積む。
//! 順序と根拠は docs/POLICY_MODEL.md §3 / docs/adr/0005-decision-priority.md。

use domain_model::{
    CategoryId, Decision, DomainName, DomainRecord, OverrideAction, Profile, Reason, Request,
    RiskLevel, RuleId, Stage, StageOutcome, TraceStep, Verdict,
};

use crate::context::PolicyContext;

/// 判定器。状態を持たない純粋関数の置き場。
pub struct PolicyEngine;

impl PolicyEngine {
    /// 1 件の要求を判定する。
    ///
    /// I/O を行わず、現在時刻も見ない（`request.at` を使う）。同じ入力なら常に同じ結果になる。
    pub fn evaluate(request: &Request, ctx: &PolicyContext<'_>) -> Verdict {
        let profile = ctx.profile;
        let slug = profile.id.slug();
        let domain = &request.domain;
        let mut trace = Trace::new();

        let record = ctx.records.lookup(domain); // 階層マッチは索引側で済ませてある
        let categories: &[CategoryId] = match record {
            Some(r) => &r.categories,
            None => &[],
        };
        let record_domain = || record.map(|r| r.domain.clone());

        // 1. Emergency Block — システム定義。保護者も解除できない
        if ctx.emergency_blocks.is_empty() {
            trace.skip(Stage::EmergencyBlock);
        } else if let Some(matched) = ctx.emergency_blocks.matching(domain) {
            trace.hit(Stage::EmergencyBlock, Decision::Block);
            return finish(
                profile,
                Decision::Block,
                Reason::EmergencyBlock,
                RuleId::new("emergency.block"),
                Some(matched.clone()),
                trace,
            );
        } else {
            trace.miss(Stage::EmergencyBlock);
        }

        // 2. Parent Block — 保護者が明示的に止めたものは他のどのルールより優先する
        if ctx.parent_overrides.is_empty() {
            trace.skip(Stage::ParentBlock);
        } else if let Some(entry) =
            ctx.parent_overrides
                .most_specific(domain, request.at, OverrideAction::Block)
        {
            trace.hit(Stage::ParentBlock, Decision::Block);
            return finish(
                profile,
                Decision::Block,
                Reason::ParentBlock,
                RuleId::new("parent.block"),
                Some(entry.domain.clone()),
                trace,
            );
        } else {
            trace.miss(Stage::ParentBlock);
        }

        // 3. Forced Block Category — Parent Allow より上。MVP では集合が空なので必ず skip
        if profile.forced_block_categories.is_empty() {
            trace.skip(Stage::ForcedCategory);
        } else if let Some(category) = categories
            .iter()
            .filter(|c| profile.is_forced_block(c))
            .min()
        {
            trace.hit(Stage::ForcedCategory, Decision::Block);
            return finish(
                profile,
                Decision::Block,
                Reason::ForcedCategory,
                RuleId::new(format!("{slug}.forced.{category}")),
                record_domain(),
                trace,
            );
        } else {
            trace.miss(Stage::ForcedCategory);
        }

        // 4. Parent Allow — 期限切れは OverrideSet 側で除外済み
        if ctx.parent_overrides.is_empty() {
            trace.skip(Stage::ParentAllow);
        } else if let Some(entry) =
            ctx.parent_overrides
                .most_specific(domain, request.at, OverrideAction::Allow)
        {
            trace.hit(Stage::ParentAllow, Decision::Allow);
            return finish(
                profile,
                Decision::Allow,
                Reason::ParentAllow,
                RuleId::new("parent.allow"),
                Some(entry.domain.clone()),
                trace,
            );
        } else {
            trace.miss(Stage::ParentAllow);
        }

        // 5. Time Window — **MVP では評価しない**。段だけ用意してある（docs/ROADMAP.md）。
        //    `profile.time_rules` に値が入っていても現状は無視される
        trace.skip(Stage::TimeWindow);

        // 6. Risk Ceiling — カテゴリ判定が誤っていてもリスク評価で止める二重の安全網
        match record.and_then(effective_risk) {
            None => trace.skip(Stage::RiskCeiling), // 情報が無い。8 段目に委ねる
            Some(risk) if risk.exceeds(profile.risk_ceiling) => {
                trace.hit(Stage::RiskCeiling, Decision::Block);
                return finish(
                    profile,
                    Decision::Block,
                    Reason::RiskCeiling,
                    RuleId::new(format!("{slug}.risk.{}", risk.slug())),
                    record_domain(),
                    trace,
                );
            }
            Some(_) => trace.miss(Stage::RiskCeiling),
        }

        // 7. Category Policy — 最も制限的なカテゴリが勝つ
        let mut ruled: Vec<(&CategoryId, Decision)> = categories
            .iter()
            .filter_map(|c| profile.category_rule(c).map(|decision| (c, decision)))
            .collect();
        if ruled.is_empty() {
            if categories.is_empty() {
                trace.skip(Stage::CategoryPolicy);
            } else {
                trace.miss(Stage::CategoryPolicy); // カテゴリはあるがルールが無い
            }
        } else {
            // 制限の強い順、同点ならカテゴリ ID 順。結果を決定的にするため
            ruled.sort_by(|a, b| {
                b.1.restrictiveness()
                    .cmp(&a.1.restrictiveness())
                    .then_with(|| a.0.cmp(b.0))
            });
            let (category, decision) = ruled[0];
            trace.hit(Stage::CategoryPolicy, decision);
            return finish(
                profile,
                decision,
                Reason::CategoryPolicy,
                RuleId::new(format!("{slug}.category.{category}")),
                record_domain(),
                trace,
            );
        }

        // 8. Unknown Policy — レコードが無い、またはカテゴリが unknown だけ
        if record.is_none_or(DomainRecord::is_unclassified) {
            trace.hit(Stage::UnknownPolicy, profile.unknown_policy);
            return finish(
                profile,
                profile.unknown_policy,
                Reason::UnknownDomain,
                RuleId::new(format!("{slug}.unknown.{}", profile.unknown_policy.slug())),
                record_domain(),
                trace,
            );
        }
        trace.miss(Stage::UnknownPolicy);

        // 9. Profile Default
        trace.hit(Stage::ProfileDefault, profile.default_decision);
        finish(
            profile,
            profile.default_decision,
            Reason::ProfileDefault,
            RuleId::new(format!(
                "{slug}.default.{}",
                profile.default_decision.slug()
            )),
            None,
            trace,
        )
    }
}

/// リスク上限の判定に使う危険度を求める。
///
/// **そのドメイン自身に対する評価（`record.risk_level`）だけを見る。**
/// カテゴリの既定リスクは混ぜない。混ぜると「カテゴリ別ルール」と「リスク上限」が
/// 二重計上になり、カテゴリ別ルールが永久に到達不能になるため
/// （例: `video` の既定リスク Medium が BEGINNER の上限 Low を超え、
/// プロファイルが `video → Review` と定めていても 6 段目で止まってしまう）。
///
/// リスク上限が担うのは「教育サイトに分類されているが、この特定のドメインは
/// マルウェア配布が確認されている」といった、**分類とは独立した危険度**の遮断。
///
/// `Unknown`（評価が無い）なら `None` を返し、6 段目を skip して
/// カテゴリ判定と 8 段目（Unknown Policy）に判断を委ねる。ここで `Unknown` を
/// BLOCK にすると理由が `RiskCeiling` になり、保護者に「なぜ止まったか」が伝わらない。
fn effective_risk(record: &DomainRecord) -> Option<RiskLevel> {
    match record.risk_level {
        RiskLevel::Unknown => None,
        explicit => Some(explicit),
    }
}

/// `Verdict` を組み立て、必要なら REVIEW を BLOCK に落とす。
///
/// `trace` には**落とす前**の判定が残る。保護者 UI で「本来は要確認だった」と示せるようにするため。
fn finish(
    profile: &Profile,
    decision: Decision,
    reason: Reason,
    matched_rule: RuleId,
    matched_domain: Option<DomainName>,
    trace: Trace,
) -> Verdict {
    let verdict = Verdict {
        decision,
        reason,
        matched_rule,
        profile: profile.id,
        matched_domain,
        trace: trace.into_steps(),
    };

    if profile.review_as_block {
        verdict.downgrade_review_to_block()
    } else {
        verdict
    }
}

/// 各段の評価結果を積む入れ物。
struct Trace(Vec<TraceStep>);

impl Trace {
    fn new() -> Self {
        Self(Vec::with_capacity(Stage::ORDER.len()))
    }

    fn push(&mut self, stage: Stage, outcome: StageOutcome) {
        self.0.push(TraceStep { stage, outcome });
    }

    fn miss(&mut self, stage: Stage) {
        self.push(stage, StageOutcome::Miss);
    }

    fn skip(&mut self, stage: Stage) {
        self.push(stage, StageOutcome::Skip);
    }

    fn hit(&mut self, stage: Stage, decision: Decision) {
        self.push(stage, StageOutcome::Hit(decision));
    }

    fn into_steps(self) -> Vec<TraceStep> {
        self.0
    }
}
