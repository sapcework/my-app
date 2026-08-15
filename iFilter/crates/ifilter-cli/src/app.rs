//! サブコマンドの定義と実行。

use std::error::Error;
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Args, Parser, Subcommand, ValueEnum};
use domain_model::{
    CategoryId, Decision, DomainName, DomainRecord, MatchScope, OverrideAction, OverrideScope,
    ParentOverride, ProfileId, RecordStatus, RequestSource, RiskLevel, Source,
};
use filter_core::FilterCore;
use storage::{PolicyStore, SqliteStore};
use time::OffsetDateTime;
use uuid::Uuid;

type AnyError = Box<dyn Error>;

/// 判定の確認と設定変更を行う CLI。
#[derive(Debug, Parser)]
#[command(name = "ifilter", version, about = "iFilter の判定を確認する", long_about = None)]
pub struct Cli {
    /// 使用する DB ファイル。省略時は %LOCALAPPDATA%\iFilter\ifilter.sqlite
    #[arg(long, global = true)]
    db: Option<PathBuf>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// DB を作り、同梱のカテゴリとプロファイルを書き込む
    Init,
    /// ドメインを判定する
    Check(CheckArgs),
    /// 保護者の許可を追加する
    Allow(OverrideArgs),
    /// 保護者の拒否を追加する
    Block(OverrideArgs),
    /// ドメインに分類を与える
    Classify(ClassifyArgs),
    /// 登録済みの設定を一覧する
    List,
    /// 判定履歴を表示する
    Log {
        /// 表示件数
        #[arg(long, default_value_t = 20)]
        limit: usize,
    },
}

#[derive(Debug, Args)]
struct CheckArgs {
    /// 判定するドメイン
    domain: String,

    /// 使用するプロファイル
    #[arg(long, value_enum, default_value_t = ProfileArg::Beginner)]
    profile: ProfileArg,

    /// 判定 9 段の経過も表示する
    #[arg(long)]
    trace: bool,

    /// JSON で出力する
    #[arg(long)]
    json: bool,

    /// 判定履歴に記録する（既定では記録しない。診断で履歴を汚さないため）
    #[arg(long)]
    log: bool,
}

#[derive(Debug, Args)]
struct OverrideArgs {
    /// 対象ドメイン
    domain: String,

    /// サブドメインには適用しない
    #[arg(long)]
    exact: bool,

    /// 設定した理由
    #[arg(long, default_value = "")]
    reason: String,
}

#[derive(Debug, Args)]
struct ClassifyArgs {
    /// 対象ドメイン
    domain: String,

    /// カテゴリ（複数指定可）
    #[arg(long = "category", required = true)]
    categories: Vec<String>,

    /// このドメイン自身の危険度。カテゴリの既定リスクとは別物
    #[arg(long, value_enum, default_value_t = RiskArg::Unknown)]
    risk: RiskArg,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum ProfileArg {
    Beginner,
    BeginnerPlus,
    Standard,
    Teen,
}

impl From<ProfileArg> for ProfileId {
    fn from(value: ProfileArg) -> Self {
        match value {
            ProfileArg::Beginner => Self::Beginner,
            ProfileArg::BeginnerPlus => Self::BeginnerPlus,
            ProfileArg::Standard => Self::Standard,
            ProfileArg::Teen => Self::Teen,
        }
    }
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum RiskArg {
    Safe,
    Low,
    Medium,
    High,
    Critical,
    Unknown,
}

impl From<RiskArg> for RiskLevel {
    fn from(value: RiskArg) -> Self {
        match value {
            RiskArg::Safe => Self::Safe,
            RiskArg::Low => Self::Low,
            RiskArg::Medium => Self::Medium,
            RiskArg::High => Self::High,
            RiskArg::Critical => Self::Critical,
            RiskArg::Unknown => Self::Unknown,
        }
    }
}

impl Cli {
    pub fn run(self) -> std::result::Result<ExitCode, AnyError> {
        let path = self.db_path()?;

        match self.command {
            Command::Init => cmd_init(&path),
            Command::Check(args) => cmd_check(&path, args),
            Command::Allow(args) => cmd_override(&path, args, OverrideAction::Allow),
            Command::Block(args) => cmd_override(&path, args, OverrideAction::Block),
            Command::Classify(args) => cmd_classify(&path, args),
            Command::List => cmd_list(&path),
            Command::Log { limit } => cmd_log(&path, limit),
        }
    }

    fn db_path(&self) -> std::result::Result<PathBuf, AnyError> {
        if let Some(path) = &self.db {
            return Ok(path.clone());
        }

        // 既定はユーザーのローカルデータ領域。非管理者でも書けて、
        // プロジェクトのディレクトリを汚さない
        let base = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
            })
            .ok_or("DB の置き場所を決められません。--db で指定してください")?;

        let dir = base.join("iFilter");
        std::fs::create_dir_all(&dir)?;
        Ok(dir.join("ifilter.sqlite"))
    }
}

fn now() -> OffsetDateTime {
    // ローカル時刻が取れない環境（タイムゾーン未設定など）では UTC で続行する。
    // 判定に使う時刻は必ず引数で渡す設計なので、ここが唯一の時計
    OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc())
}

fn open(path: &PathBuf) -> std::result::Result<SqliteStore, AnyError> {
    Ok(SqliteStore::open(path)?)
}

fn parse_domain(input: &str) -> std::result::Result<DomainName, AnyError> {
    Ok(DomainName::parse(input)?)
}

fn cmd_init(path: &PathBuf) -> std::result::Result<ExitCode, AnyError> {
    let mut store = open(path)?;
    store.seed_builtins(now())?;

    println!("DB を用意しました: {}", path.display());
    println!("カテゴリ: {} 件", store.categories()?.len());
    println!("プロファイル: {} 件", store.profiles()?.len());
    println!("同梱ドメイン: {} 件", store.domain_records()?.len());
    Ok(ExitCode::SUCCESS)
}

fn cmd_check(path: &PathBuf, args: CheckArgs) -> std::result::Result<ExitCode, AnyError> {
    let domain = parse_domain(&args.domain)?;
    let at = now();
    let mut core = FilterCore::load(open(path)?, args.profile.into(), "cli", at)?;

    let verdict = if args.log {
        core.decide_and_log(&domain, at, RequestSource::Cli)?
    } else {
        core.decide(&domain, at, RequestSource::Cli)
    };

    if args.json {
        println!("{}", serde_json::to_string_pretty(&verdict)?);
    } else {
        print!(
            "{}",
            crate::format::render(domain.as_str(), &verdict, args.trace)
        );
    }

    // 終了コードで判定を返す。スクリプトから使えるようにするため
    Ok(match verdict.decision {
        Decision::Allow => ExitCode::SUCCESS,
        Decision::Review => ExitCode::from(3),
        Decision::Block => ExitCode::from(1),
    })
}

fn cmd_override(
    path: &PathBuf,
    args: OverrideArgs,
    action: OverrideAction,
) -> std::result::Result<ExitCode, AnyError> {
    let domain = parse_domain(&args.domain)?;
    if !domain.is_registrable() {
        return Err(format!(
            "{domain} は公開サフィックスなので登録できません（例: co.jp を許可すると\
             日本のほぼ全ドメインが通ってしまいます）"
        )
        .into());
    }

    let at = now();
    let mut core = FilterCore::load(open(path)?, ProfileId::Beginner, "cli", at)?;

    let entry = ParentOverride {
        id: Uuid::new_v4(),
        domain: domain.clone(),
        action,
        scope: if args.exact {
            OverrideScope::ExactDomain
        } else {
            OverrideScope::IncludeSubdomains
        },
        expires_at: None,
        reason: args.reason,
        version: 1,
        created_at: at,
        updated_at: at,
        deleted_at: None,
    };
    core.put_parent_override(&entry, at)?;

    if action == OverrideAction::Allow {
        warn_if_forced_block(&core, &domain);
    }

    let label = match action {
        OverrideAction::Allow => "許可",
        OverrideAction::Block => "拒否",
    };
    let scope = if args.exact {
        "このドメインのみ"
    } else {
        "サブドメインを含む"
    };
    println!("{domain} を{label}に設定しました（{scope}）");
    Ok(ExitCode::SUCCESS)
}

/// 許可しても解除できないカテゴリなら、その旨を伝える。
///
/// 登録自体は拒否しない。**判定は Policy Engine の 3 段目が単独で行う**ので、
/// ここが黙っていても素通りにはならない（ADR-0009）。防いでいるのは
/// 「許可したのに繋がらない」と保護者が悩む時間のほう。
///
/// 判定の再実装ではなく、`Profile.forced_block_categories` を引くだけ。
fn warn_if_forced_block<S: PolicyStore>(core: &FilterCore<S>, domain: &DomainName) {
    let snapshot = core.snapshot();
    let Some(record) = snapshot.records.lookup(domain) else {
        return;
    };

    let forced = crate::format::forced_categories(&snapshot.profile, &record.categories);
    if forced.is_empty() {
        return;
    }

    eprintln!(
        "警告: {domain} は保護者の許可では解除できないカテゴリ（{}）に含まれます。",
        forced.join(", ")
    );
    eprintln!("      登録はしましたが、判定は遮断のままです。この種類のサイトを通すと");
    eprintln!("      フィルター自体が働かなくなるためです（ADR-0009）。");
}

fn cmd_classify(path: &PathBuf, args: ClassifyArgs) -> std::result::Result<ExitCode, AnyError> {
    let domain = parse_domain(&args.domain)?;
    let at = now();
    let mut core = FilterCore::load(open(path)?, ProfileId::Beginner, "cli", at)?;

    let mut categories = Vec::new();
    for raw in &args.categories {
        categories.push(CategoryId::parse(raw)?);
    }

    // 同じドメインの既存レコードがあれば id を引き継ぐ。
    // 引き継がないと UNIQUE(domain) に衝突する
    let existing = core
        .store()
        .domain_records()?
        .into_iter()
        .find(|r| r.domain == domain);
    // 照合範囲は既存レコードから引き継ぐ。CLI からは Suffix を新規作成できない。
    // 1 件で配下すべてに及ぶ強い設定なので、同梱データだけが持つ
    // （docs/adr/0008-infrastructure-suffix-records.md）
    let (id, created_at, version, scope) = existing
        .as_ref()
        .map_or((Uuid::new_v4(), at, 1, MatchScope::Domain), |r| {
            (r.id, r.created_at, r.version + 1, r.scope)
        });

    // Domain スコープで公開サフィックスを登録しても、階層マッチが eTLD+1 で
    // 止まるため一度もヒットしない。黙って無効なレコードを作らせない
    if scope == MatchScope::Domain && !domain.is_registrable() {
        return Err(format!(
            "{domain} は公開サフィックスなので分類できません\
             （登録しても配下のドメインには一度も適用されません）"
        )
        .into());
    }

    let record = DomainRecord {
        id,
        domain: domain.clone(),
        categories,
        risk_level: args.risk.into(),
        confidence: 1.0,
        source: Source::Parent,
        status: RecordStatus::Active,
        scope,
        version,
        created_at,
        updated_at: at,
        deleted_at: None,
    };
    core.put_domain_record(&record, at)?;

    println!("{domain} を分類しました: {}", args.categories.join(", "));
    Ok(ExitCode::SUCCESS)
}

fn cmd_list(path: &PathBuf) -> std::result::Result<ExitCode, AnyError> {
    let store = open(path)?;

    let overrides = store.parent_overrides()?;
    println!("保護者の設定: {} 件", overrides.len());
    for entry in &overrides {
        let action = match entry.action {
            OverrideAction::Allow => "許可",
            OverrideAction::Block => "拒否",
        };
        let scope = match entry.scope {
            OverrideScope::ExactDomain => "単体",
            OverrideScope::IncludeSubdomains => "配下含む",
        };
        let state = if entry.deleted_at.is_some() {
            "（削除済み）"
        } else {
            ""
        };
        println!("  {action} {:<32} {scope}{state}", entry.domain.as_str());
    }

    let records = store.domain_records()?;
    println!("\n分類済みドメイン: {} 件", records.len());
    for record in &records {
        let categories: Vec<&str> = record.categories.iter().map(CategoryId::as_str).collect();
        println!(
            "  {:<32} [{}] risk={}",
            record.domain.as_str(),
            categories.join(", "),
            record.risk_level.slug()
        );
    }

    let emergency = store.emergency_blocks()?;
    println!("\n緊急ブロック: {} 件", emergency.len());
    for domain in &emergency {
        println!("  {domain}");
    }

    Ok(ExitCode::SUCCESS)
}

fn cmd_log(path: &PathBuf, limit: usize) -> std::result::Result<ExitCode, AnyError> {
    let store = open(path)?;
    let entries = store.recent_decisions(limit)?;

    if entries.is_empty() {
        println!("判定履歴はまだありません（check に --log を付けると記録されます）");
        return Ok(ExitCode::SUCCESS);
    }

    for entry in entries {
        println!(
            "{} {:<7} {:<32} {}",
            crate::format::timestamp(entry.timestamp),
            entry.decision.to_string(),
            entry.domain.as_str(),
            entry.rule_id
        );
    }
    Ok(ExitCode::SUCCESS)
}
