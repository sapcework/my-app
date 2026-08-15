//! UI から呼べるコマンド。
//!
//! **すべて `filter-core` の薄い包み。** 判定の条件分岐をここに書かない。
//! 書いた瞬間に「UI では許可なのに DNS では遮断」が起こりうる状態になる
//! （docs/adr/0001-policy-engine-network-separation.md）。
//!
//! 設定を書き換えるものは `filter-core` 経由で行う。ポリシー版数が進み、
//! 動いているサービスが数秒以内に読み直す。DB を直接触ると版数が進まず、
//! **「許可したのに繋がらない」**になる。

use domain_model::{
    DomainName, DomainRecord, MatchScope, OverrideAction, OverrideScope, ParentOverride, Profile,
    RecordStatus, RequestSource, RiskLevel, Source, Verdict,
};
use ifilter_service::browser_policy;
use ifilter_service::config::SERVICE_NAME;
use ifilter_service::manager;
use storage::PolicyStore;
use tauri::State;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;
use uuid::Uuid;

use crate::dto::{
    BrowserPolicyStatus, CategoryRule, DailySummary, DecisionRow, DomainCheck, DomainCount,
    DomainRecordRow, FilterStatus, OverrideInput, OverrideRow,
};
use crate::grouping;
use crate::state::{ACTIVE_PROFILE_KEY, AppState, format_time, parse_profile};

type Result<T> = std::result::Result<T, String>;

/// 履歴を読む既定の件数。多すぎると画面が重くなる。
const RECENT_LIMIT: usize = 500;

fn domain_of(input: &str) -> Result<DomainName> {
    DomainName::parse(input).map_err(|err| format!("ドメインとして解釈できません: {err}"))
}

fn now() -> OffsetDateTime {
    OffsetDateTime::now_utc()
}

// ---- 状態 ----

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> Result<FilterStatus> {
    let core = state.core();
    let service = manager::summary();

    Ok(FilterStatus {
        running: service.running,
        installed: service.installed,
        profile: core.profile().id.to_string(),
        database_path: state.database_path().display().to_string(),
        browser_policies: browser_policy::is_applied()
            .into_iter()
            .map(|(browser, disabled)| BrowserPolicyStatus { browser, disabled })
            .collect(),
    })
}

/// フィルターの稼働を切り替える。**保護者だけが行える操作。**
///
/// この UI は起動時に管理者権限を要求してあるので、ここまで来た時点で
/// 保護者が UAC を通っている（docs/ARCHITECTURE.md §7-4）。
#[tauri::command]
pub fn set_filter_enabled(enabled: bool) -> Result<()> {
    if enabled {
        manager::start()
    } else {
        manager::stop()
    }
    .map_err(|err| format!("{SERVICE_NAME} を操作できません: {err}"))
}

// ---- 判定を試す ----

/// ドメインを判定する。**履歴には残さない。**
///
/// 保護者が確認のために試した操作を、子供の閲覧履歴に混ぜない。
#[tauri::command]
pub fn check_domain(
    state: State<'_, AppState>,
    domain: String,
    profile: Option<String>,
) -> Result<Verdict> {
    let target = domain_of(&domain)?;
    let mut core = state.core();

    let Some(requested) = profile.as_deref().and_then(parse_profile) else {
        return Ok(core.decide(&target, now(), RequestSource::Ui));
    };

    // 別プロファイルで試したいだけなので、確認が終わったら元に戻す
    let original = core.profile().id;
    core.switch_profile(requested, now())
        .map_err(|err| format!("プロファイルを切り替えられません: {err}"))?;
    let verdict = core.decide(&target, now(), RequestSource::Ui);
    core.switch_profile(original, now())
        .map_err(|err| format!("プロファイルを戻せません: {err}"))?;

    Ok(verdict)
}

/// 入力されたドメインを正規化して、登録できる形か返す。
#[tauri::command]
pub fn inspect_domain(domain: String) -> Result<DomainCheck> {
    Ok(DomainCheck::new(&domain_of(&domain)?))
}

// ---- プロファイル ----

#[tauri::command]
pub fn get_profiles(state: State<'_, AppState>) -> Result<Vec<Profile>> {
    state
        .core()
        .store()
        .profiles()
        .map_err(|err| format!("プロファイルを読めません: {err}"))
}

#[tauri::command]
pub fn get_active_profile(state: State<'_, AppState>) -> Result<Profile> {
    Ok(state.core().profile().clone())
}

#[tauri::command]
pub fn set_active_profile(state: State<'_, AppState>, profile: String) -> Result<()> {
    let id = parse_profile(&profile).ok_or_else(|| format!("未知のプロファイル: {profile}"))?;
    let at = now();
    let mut core = state.core();

    core.switch_profile(id, at)
        .map_err(|err| format!("切り替えられません: {err}"))?;
    // サービスが次の起動でも同じプロファイルを使えるように残す
    core.put_setting(ACTIVE_PROFILE_KEY, id.slug(), at)
        .map_err(|err| format!("設定を保存できません: {err}"))
}

#[tauri::command]
pub fn update_profile(state: State<'_, AppState>, profile: Profile) -> Result<()> {
    let at = now();
    state
        .core()
        .put_profile(&profile, at)
        .map_err(|err| format!("プロファイルを保存できません: {err}"))
}

// ---- カテゴリ ----

#[tauri::command]
pub fn get_category_rules(
    state: State<'_, AppState>,
    profile: String,
) -> Result<Vec<CategoryRule>> {
    let id = parse_profile(&profile).ok_or_else(|| format!("未知のプロファイル: {profile}"))?;
    let core = state.core();

    let target = core
        .store()
        .profile(id)
        .map_err(|err| format!("プロファイルを読めません: {err}"))?
        .ok_or_else(|| format!("プロファイルが見つかりません: {profile}"))?;
    let categories = core
        .store()
        .categories()
        .map_err(|err| format!("カテゴリを読めません: {err}"))?;

    Ok(categories
        .iter()
        .map(|info| CategoryRule::new(info, target.category_rule(&info.id)))
        .collect())
}

#[tauri::command]
pub fn set_category_rule(
    state: State<'_, AppState>,
    profile: String,
    category: String,
    decision: String,
) -> Result<()> {
    let id = parse_profile(&profile).ok_or_else(|| format!("未知のプロファイル: {profile}"))?;
    let category = domain_model::CategoryId::parse(&category)
        .map_err(|err| format!("カテゴリ ID が不正です: {err}"))?;
    let decision = parse_decision(&decision)?;

    let at = now();
    let mut core = state.core();
    let mut target = core
        .store()
        .profile(id)
        .map_err(|err| format!("プロファイルを読めません: {err}"))?
        .ok_or_else(|| format!("プロファイルが見つかりません: {profile}"))?;

    target.category_rules.insert(category, decision);
    target.version += 1;
    core.put_profile(&target, at)
        .map_err(|err| format!("保存できません: {err}"))
}

fn parse_decision(raw: &str) -> Result<domain_model::Decision> {
    use domain_model::Decision;
    match raw {
        "allow" => Ok(Decision::Allow),
        "review" => Ok(Decision::Review),
        "block" => Ok(Decision::Block),
        other => Err(format!("未知の判定: {other}")),
    }
}

// ---- 保護者の許可・拒否 ----

#[tauri::command]
pub fn get_overrides(state: State<'_, AppState>) -> Result<Vec<OverrideRow>> {
    let core = state.core();
    let entries = core
        .store()
        .parent_overrides()
        .map_err(|err| format!("設定を読めません: {err}"))?;

    Ok(entries
        .into_iter()
        .filter(|entry| entry.deleted_at.is_none())
        .map(|entry| OverrideRow {
            id: entry.id.to_string(),
            domain: entry.domain.to_string(),
            action: match entry.action {
                OverrideAction::Allow => "allow".to_owned(),
                OverrideAction::Block => "block".to_owned(),
            },
            include_subdomains: entry.scope == OverrideScope::IncludeSubdomains,
            reason: entry.reason,
            expires_at: entry.expires_at.map(format_time),
        })
        .collect())
}

#[tauri::command]
pub fn add_override(state: State<'_, AppState>, input: OverrideInput) -> Result<()> {
    let domain = domain_of(&input.domain)?;
    // 公開サフィックスを許可すると、その配下すべてが通る
    if !domain.is_registrable() {
        return Err(format!(
            "{domain} は公開サフィックスなので登録できません。\
             たとえば co.jp を許可すると日本のほぼ全部のサイトが通ってしまいます。"
        ));
    }

    let action = match input.action.as_str() {
        "allow" => OverrideAction::Allow,
        "block" => OverrideAction::Block,
        other => return Err(format!("未知の動作: {other}")),
    };
    let expires_at = input
        .expires_at
        .as_deref()
        .map(|raw| OffsetDateTime::parse(raw, &Rfc3339))
        .transpose()
        .map_err(|err| format!("期限を解釈できません: {err}"))?;

    let at = now();
    let entry = ParentOverride {
        id: Uuid::new_v4(),
        domain,
        action,
        scope: if input.include_subdomains {
            OverrideScope::IncludeSubdomains
        } else {
            OverrideScope::ExactDomain
        },
        expires_at,
        reason: input.reason,
        version: 1,
        created_at: at,
        updated_at: at,
        deleted_at: None,
    };

    state
        .core()
        .put_parent_override(&entry, at)
        .map_err(|err| format!("保存できません: {err}"))
}

/// 上書き設定を取り消す。
///
/// **物理削除しない。** 消したことを他の端末へ伝えるには、行が残っていないと
/// 表現できない（docs/POLICY_MODEL.md §5）。
#[tauri::command]
pub fn remove_override(state: State<'_, AppState>, id: String) -> Result<()> {
    let id = Uuid::parse_str(&id).map_err(|err| format!("ID が不正です: {err}"))?;
    let at = now();
    let mut core = state.core();

    let mut entry = core
        .store()
        .parent_overrides()
        .map_err(|err| format!("設定を読めません: {err}"))?
        .into_iter()
        .find(|e| e.id == id)
        .ok_or("その設定は見つかりません")?;

    entry.deleted_at = Some(at);
    entry.updated_at = at;
    entry.version += 1;

    core.put_parent_override(&entry, at)
        .map_err(|err| format!("保存できません: {err}"))
}

// ---- ドメインの分類 ----

#[tauri::command]
pub fn get_domain_records(state: State<'_, AppState>) -> Result<Vec<DomainRecordRow>> {
    let core = state.core();
    let records = core
        .store()
        .domain_records()
        .map_err(|err| format!("分類を読めません: {err}"))?;

    Ok(records
        .into_iter()
        .filter(|record| record.deleted_at.is_none())
        .map(|record| DomainRecordRow {
            id: record.id.to_string(),
            domain: record.domain.to_string(),
            categories: record.categories.iter().map(ToString::to_string).collect(),
            risk_level: record.risk_level.slug().to_owned(),
            scope: match record.scope {
                MatchScope::Domain => "domain".to_owned(),
                MatchScope::Suffix => "suffix".to_owned(),
            },
            source: match record.source {
                Source::Bundled => "bundled".to_owned(),
                Source::Local => "local".to_owned(),
                Source::Server => "server".to_owned(),
                Source::Parent => "parent".to_owned(),
            },
            // 同梱データは編集させない。次の更新で上書きされて混乱するため
            editable: record.source == Source::Parent || record.source == Source::Local,
        })
        .collect())
}

#[tauri::command]
pub fn classify_domain(
    state: State<'_, AppState>,
    domain: String,
    categories: Vec<String>,
    risk: String,
) -> Result<()> {
    let domain = domain_of(&domain)?;
    if categories.is_empty() {
        return Err("カテゴリを 1 つ以上選んでください".to_owned());
    }

    let mut parsed = Vec::new();
    for raw in &categories {
        parsed.push(
            domain_model::CategoryId::parse(raw)
                .map_err(|err| format!("カテゴリ ID が不正です: {err}"))?,
        );
    }
    let risk_level = parse_risk(&risk)?;

    let at = now();
    let mut core = state.core();

    // 同じドメインの既存レコードがあれば ID と照合範囲を引き継ぐ。
    // ID を引き継がないと UNIQUE(domain) に衝突する
    let existing = core
        .store()
        .domain_records()
        .map_err(|err| format!("分類を読めません: {err}"))?
        .into_iter()
        .find(|r| r.domain == domain);

    let (id, created_at, version, scope) = existing
        .as_ref()
        .map_or((Uuid::new_v4(), at, 1, MatchScope::Domain), |r| {
            (r.id, r.created_at, r.version + 1, r.scope)
        });

    // Domain スコープで公開サフィックスを登録しても、階層マッチが eTLD+1 で
    // 止まるため一度もヒットしない（docs/adr/0008）
    if scope == MatchScope::Domain && !domain.is_registrable() {
        return Err(format!(
            "{domain} は公開サフィックスなので分類できません。\
             登録しても配下のドメインには適用されません。"
        ));
    }

    let record = DomainRecord {
        id,
        domain,
        categories: parsed,
        risk_level,
        confidence: 1.0,
        source: Source::Parent,
        status: RecordStatus::Active,
        scope,
        version,
        created_at,
        updated_at: at,
        deleted_at: None,
    };

    core.put_domain_record(&record, at)
        .map_err(|err| format!("保存できません: {err}"))
}

fn parse_risk(raw: &str) -> Result<RiskLevel> {
    match raw {
        "safe" => Ok(RiskLevel::Safe),
        "low" => Ok(RiskLevel::Low),
        "medium" => Ok(RiskLevel::Medium),
        "high" => Ok(RiskLevel::High),
        "critical" => Ok(RiskLevel::Critical),
        "unknown" => Ok(RiskLevel::Unknown),
        other => Err(format!("未知の危険度: {other}")),
    }
}

// ---- 履歴 ----

#[tauri::command]
pub fn get_recent_decisions(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<DecisionRow>> {
    let core = state.core();
    let entries = core
        .store()
        .recent_decisions(limit.unwrap_or(RECENT_LIMIT).min(RECENT_LIMIT))
        .map_err(|err| format!("履歴を読めません: {err}"))?;

    Ok(entries
        .iter()
        .map(|entry| DecisionRow::new(entry, format_time(entry.timestamp)))
        .collect())
}

/// 遮断されたものを、同じページ由来かもしれないまとまりにして返す。
#[tauri::command]
pub fn get_blocked_groups(state: State<'_, AppState>) -> Result<Vec<crate::dto::BlockedGroup>> {
    use domain_model::Decision;

    let core = state.core();
    let entries = core
        .store()
        .recent_decisions(RECENT_LIMIT)
        .map_err(|err| format!("履歴を読めません: {err}"))?;

    let blocked: Vec<_> = entries
        .into_iter()
        .filter(|entry| entry.decision != Decision::Allow)
        .collect();

    let snapshot = core.snapshot();
    Ok(grouping::group_blocked(
        &blocked,
        |entry| format_time(entry.timestamp),
        |entry| {
            snapshot
                .overrides
                .most_specific(&entry.domain, now(), OverrideAction::Allow)
                .is_some()
        },
        // 判定はしていない。プロファイルの解除不可カテゴリ集合を引くだけ（ADR-0009）
        |entry| {
            snapshot
                .records
                .lookup(&entry.domain)
                .is_some_and(|record| {
                    record
                        .categories
                        .iter()
                        .any(|category| snapshot.profile.is_forced_block(category))
                })
        },
    ))
}

#[tauri::command]
pub fn get_daily_summary(state: State<'_, AppState>) -> Result<DailySummary> {
    use std::collections::HashMap;

    use domain_model::Decision;

    let core = state.core();
    let entries = core
        .store()
        .recent_decisions(RECENT_LIMIT)
        .map_err(|err| format!("履歴を読めません: {err}"))?;

    let since = now() - time::Duration::days(1);
    let mut summary = DailySummary::default();
    let mut counts: HashMap<String, usize> = HashMap::new();

    for entry in entries.iter().filter(|e| e.timestamp >= since) {
        match entry.decision {
            Decision::Allow => summary.allowed += 1,
            Decision::Review => summary.review += 1,
            Decision::Block => {
                summary.blocked += 1;
                *counts.entry(entry.domain.to_string()).or_default() += 1;
            }
        }
    }

    let mut top: Vec<_> = counts
        .into_iter()
        .map(|(domain, count)| DomainCount { domain, count })
        .collect();
    // 件数の多い順。同数ならドメイン名順にして表示を安定させる
    top.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.domain.cmp(&b.domain)));
    top.truncate(5);
    summary.top_blocked = top;

    Ok(summary)
}

// ---- ブラウザの DoH ポリシー ----

#[tauri::command]
pub fn set_browser_doh_disabled(disabled: bool) -> Result<Vec<String>> {
    if disabled {
        browser_policy::apply()
    } else {
        browser_policy::revert()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 判定名を解釈できる() {
        use domain_model::Decision;
        assert_eq!(parse_decision("allow").expect("妥当"), Decision::Allow);
        assert_eq!(parse_decision("review").expect("妥当"), Decision::Review);
        assert_eq!(parse_decision("block").expect("妥当"), Decision::Block);
        assert!(parse_decision("maybe").is_err());
    }

    #[test]
    fn 判定名は_slug_と一致する() {
        // UI・DB・ルール ID で表記が食い違うと追跡できなくなる
        use domain_model::Decision;
        for decision in [Decision::Allow, Decision::Review, Decision::Block] {
            assert_eq!(parse_decision(decision.slug()).expect("妥当"), decision);
        }
    }

    #[test]
    fn 危険度名は_slug_と一致する() {
        for risk in [
            RiskLevel::Safe,
            RiskLevel::Low,
            RiskLevel::Medium,
            RiskLevel::High,
            RiskLevel::Critical,
            RiskLevel::Unknown,
        ] {
            assert_eq!(parse_risk(risk.slug()).expect("妥当"), risk);
        }
        assert!(parse_risk("とても危険").is_err());
    }

    #[test]
    fn ドメインは正規化される() {
        assert_eq!(
            domain_of("  EXAMPLE.COM.  ").expect("妥当").as_str(),
            "example.com"
        );
        assert!(domain_of("").is_err());
    }
}
