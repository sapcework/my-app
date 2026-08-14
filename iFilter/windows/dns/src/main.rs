//! DNS プロキシをコンソールで動かす。
//!
//! 既定の待ち受けは `127.0.0.1:15353`。**53 番は管理者権限が要る**ので、
//! 開発中は高位ポートで動かして動作を確かめる。53 番での常駐は
//! Windows サービス（Step 7）の担当。
//!
//! ```powershell
//! cargo run -p ifilter-dns -- --db <path> --upstream 192.168.10.1:53
//! nslookup -port=15353 example.com 127.0.0.1
//! ```

use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Duration;

use clap::{Parser, ValueEnum};
use domain_model::ProfileId;
use filter_core::FilterCore;
use ifilter_dns::{DnsFilter, Upstream, serve};
use storage::SqliteStore;
use time::OffsetDateTime;

#[derive(Debug, Parser)]
#[command(name = "ifilter-dns", version, about = "iFilter のローカル DNS プロキシ", long_about = None)]
struct Cli {
    /// 使用する DB ファイル。省略時は %LOCALAPPDATA%\iFilter\ifilter.sqlite
    #[arg(long)]
    db: Option<PathBuf>,

    /// 待ち受けアドレス。53 番にするには管理者権限が要る
    #[arg(long, default_value = "127.0.0.1:15353")]
    listen: SocketAddr,

    /// 転送先の DNS サーバー。家庭内の名前を引くならルータを指定する
    #[arg(long, default_value = "1.1.1.1:53")]
    upstream: SocketAddr,

    /// 上流の応答を待つ秒数
    #[arg(long, default_value_t = 3)]
    timeout: u64,

    /// 使用するプロファイル
    #[arg(long, value_enum, default_value_t = ProfileArg::Beginner)]
    profile: ProfileArg,

    /// この端末の識別子。判定履歴に残る
    #[arg(long, default_value = "local")]
    device_id: String,

    /// 許可した問い合わせもすべて表示する
    #[arg(long)]
    verbose: bool,
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

impl Cli {
    fn db_path(&self) -> Result<PathBuf, Box<dyn std::error::Error>> {
        if let Some(path) = &self.db {
            return Ok(path.clone());
        }
        let base = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .ok_or("DB の置き場所を決められません。--db で指定してください")?;
        Ok(base.join("iFilter").join("ifilter.sqlite"))
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("エラー: {err}");
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let path = cli.db_path()?;

    if !path.exists() {
        return Err(format!(
            "DB がありません: {}\n先に `ifilter --db {} init` を実行してください",
            path.display(),
            path.display()
        )
        .into());
    }

    let profile: ProfileId = cli.profile.into();
    let core = FilterCore::load(
        SqliteStore::open(&path)?,
        profile,
        cli.device_id.clone(),
        OffsetDateTime::now_utc(),
    )?;

    let upstream = Upstream::new(cli.upstream, Duration::from_secs(cli.timeout));
    let filter = Arc::new(DnsFilter::new(core, upstream, cli.verbose));

    println!("iFilter DNS プロキシ");
    println!("  DB        : {}", path.display());
    println!("  プロファイル: {profile}");
    println!("  待ち受け  : {}", cli.listen);
    println!("  上流      : {}", cli.upstream);
    println!("Ctrl+C で終了します。");

    serve(
        filter,
        cli.listen,
        |bound| {
            if bound != cli.listen {
                println!("  実際の待ち受け: {bound}");
            }
        },
        async {
            // Ctrl+C を受け取れなくなっても異常終了はさせない。
            // その場合は待ち受けを続け、プロセス終了で止める
            let _ = tokio::signal::ctrl_c().await;
            println!("終了します。");
        },
    )
    .await?;

    Ok(())
}
