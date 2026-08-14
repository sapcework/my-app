//! iFilter を Windows サービスとして常駐させる。
//!
//! UI を終了してもフィルターが動き続け、PC を起動したら子供がログインする前から
//! 効いている状態にする（docs/ROADMAP.md Step 7）。
//!
//! **ほぼすべてのサブコマンドが管理者権限を要る。** 53 番のバインド、サービス登録、
//! `HKLM` への書き込みのいずれもそう。
//!
//! ```powershell
//! # 管理者の PowerShell で
//! ifilter-service install --db C:\ProgramData\iFilter\ifilter.sqlite --upstream 192.168.10.1:53
//! ifilter-service start
//! ifilter-service status
//! ifilter-service stop
//! ifilter-service uninstall
//! ```
//!
//! DNS 設定の差し替えは `install --enforce-dns` を付けたときだけ行う。
//! 付けなければ 53 番で待ち受けるだけなので、端末の名前解決には影響しない。

use std::ffi::OsString;
use std::process::ExitCode;
use std::sync::mpsc;
use std::time::Duration;

use clap::{Parser, Subcommand};
use ifilter_service::config::{FilterConfig, SERVICE_NAME};
use ifilter_service::{browser_policy, log, manager, runner};
use windows_service::service::{
    ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus, ServiceType,
};
use windows_service::service_control_handler::{self, ServiceControlHandlerResult};
use windows_service::{define_windows_service, service_dispatcher};

/// 待ち受けに入るまで SCM に待ってもらう時間の目安。
///
/// DB の作成と同梱データの書き込みが初回だけ走る。短すぎると SCM が
/// 「応答しないサービス」と判断する。
const STARTUP_WAIT_HINT: Duration = Duration::from_secs(30);

#[derive(Debug, Parser)]
#[command(name = "ifilter-service", version, about = "iFilter を Windows サービスとして動かす", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// サービスを登録する（管理者権限が要る）
    Install {
        #[command(flatten)]
        config: FilterConfig,
    },
    /// サービスの登録を消す
    Uninstall,
    /// サービスを開始する
    Start,
    /// サービスを停止する
    Stop,
    /// サービスと各種設定の状態を表示する
    Status,
    /// SCM から呼ばれる本体。**手で実行するものではない**
    Run {
        #[command(flatten)]
        config: FilterConfig,
    },
    /// サービスにせず前面で動かす（デバッグ用）
    Console {
        #[command(flatten)]
        config: FilterConfig,
    },
    /// ブラウザの DoH をポリシーで無効にする
    ApplyBrowserPolicy,
    /// ブラウザの DoH ポリシーを取り消す
    RevertBrowserPolicy,
    /// 記録しておいた DNS 設定に戻す（フィルターを止めたのに名前が引けないとき）
    RevertDns {
        #[command(flatten)]
        config: FilterConfig,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    let result = match cli.command {
        Command::Install { config } => cmd_install(&config),
        Command::Uninstall => cmd_uninstall(),
        Command::Start => manager::start().map(|()| println!("サービスを開始しました。")),
        Command::Stop => manager::stop().map(|()| println!("サービスを停止しました。")),
        Command::Status => cmd_status(),
        Command::Run { .. } => cmd_run(),
        Command::Console { config } => cmd_console(&config),
        Command::ApplyBrowserPolicy => cmd_apply_browser_policy(),
        Command::RevertBrowserPolicy => cmd_revert_browser_policy(),
        Command::RevertDns { config } => cmd_revert_dns(&config),
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("エラー: {err}");
            ExitCode::FAILURE
        }
    }
}

fn cmd_install(config: &FilterConfig) -> Result<(), String> {
    manager::install(config)?;

    let db = config.db_path()?;
    println!("サービスを登録しました: {SERVICE_NAME}");
    println!("  DB        : {}", db.display());
    println!(
        "  ログ      : {}",
        db.with_file_name("service.log").display()
    );
    println!("  待ち受け  : {}", config.listen);
    println!("  上流      : {}", config.upstream);
    println!("  プロファイル: {}", config.profile.as_arg());

    if config.enforce_dns {
        println!();
        println!("端末の DNS 設定を iFilter に向けます（30 秒ごとに再適用）。");
        println!("戻すときは `ifilter-service revert-dns` を実行してください。");
    } else {
        println!();
        println!("端末の DNS 設定は変更しません。実際にフィルターを通すには");
        println!(
            "`--enforce-dns` を付けて登録し直すか、DNS を手動で {} に向けてください。",
            config.listen.ip()
        );
    }

    println!();
    println!("開始するには `ifilter-service start` を実行してください。");
    Ok(())
}

fn cmd_uninstall() -> Result<(), String> {
    manager::uninstall()?;
    println!("サービスの登録を消しました: {SERVICE_NAME}");
    println!("DNS 設定を差し替えていた場合は `revert-dns` で戻してください。");
    Ok(())
}

fn cmd_status() -> Result<(), String> {
    match manager::status()? {
        Some(state) => println!("サービス      : {}", describe(state)),
        None => println!("サービス      : 未登録"),
    }

    println!("ブラウザの DoH ポリシー:");
    for (label, applied) in browser_policy::is_applied() {
        println!(
            "  {label:<16} {}",
            if applied {
                "無効化済み"
            } else {
                "未設定"
            }
        );
    }

    Ok(())
}

fn describe(state: ServiceState) -> &'static str {
    match state {
        ServiceState::Stopped => "停止",
        ServiceState::StartPending => "開始中",
        ServiceState::StopPending => "停止中",
        ServiceState::Running => "実行中",
        ServiceState::ContinuePending => "再開中",
        ServiceState::PausePending => "一時停止中",
        ServiceState::Paused => "一時停止",
    }
}

fn cmd_console(config: &FilterConfig) -> Result<(), String> {
    println!("前面で実行します（Ctrl+C で終了）。");
    runner::run(config, |bound| println!("待ち受け開始: {bound}"), async {
        let _ = tokio::signal::ctrl_c().await;
        println!("終了します。");
    })
}

fn cmd_apply_browser_policy() -> Result<(), String> {
    let applied = browser_policy::apply()?;
    println!("DoH を無効にしました: {}", applied.join(", "));
    println!("反映にはブラウザの再起動が要ります。");
    Ok(())
}

fn cmd_revert_browser_policy() -> Result<(), String> {
    let reverted = browser_policy::revert()?;
    if reverted.is_empty() {
        println!("取り消す設定はありませんでした。");
    } else {
        println!("DoH のポリシーを取り消しました: {}", reverted.join(", "));
    }
    Ok(())
}

fn cmd_revert_dns(config: &FilterConfig) -> Result<(), String> {
    let restored = runner::restore_dns(&config.db_path()?)?;
    if restored.is_empty() {
        println!("戻すべき記録はありませんでした。");
    } else {
        println!("DNS 設定を元に戻しました: {}", restored.join(", "));
    }
    Ok(())
}

// ---- SCM との受け答え ----

define_windows_service!(ffi_service_main, service_main);

fn cmd_run() -> Result<(), String> {
    service_dispatcher::start(SERVICE_NAME, ffi_service_main).map_err(|err| {
        format!(
            "サービスとして開始できません: {err}\n\
             `run` は SCM が呼ぶためのものです。手で動かすなら `console` を使ってください。"
        )
    })
}

/// SCM から呼ばれる入口。
///
/// 引数はここではなく**プロセスの起動引数**から読む。SCM は ImagePath に
/// 登録した引数でプロセスを起動するので、`install` が書いた設定がそのまま届く。
fn service_main(_arguments: Vec<OsString>) {
    if let Err(err) = run_service() {
        // サービスからは標準出力が見えない。ここで書き残さないと原因が追えない
        log::write(&format!("サービスの実行に失敗しました: {err}"));
    }
}

fn run_service() -> Result<(), String> {
    let Command::Run { config } = Cli::parse().command else {
        return Err("`run` として起動されていません".to_owned());
    };
    // 待ち受けに入る前の失敗も残せるよう、ここで書き込み先を決めておく
    log::init(&config.db_path()?);

    let (shutdown_tx, shutdown_rx) = mpsc::channel();
    let handle = service_control_handler::register(SERVICE_NAME, move |control| match control {
        ServiceControl::Stop | ServiceControl::Shutdown => {
            let _ = shutdown_tx.send(());
            ServiceControlHandlerResult::NoError
        }
        // 状態を聞かれているだけ。今の状態を返せばよい
        ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
        _ => ServiceControlHandlerResult::NotImplemented,
    })
    .map_err(|err| format!("制御ハンドラを登録できません: {err}"))?;

    let report = |state: ServiceState, exit: ServiceExitCode, wait_hint: Duration| ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: state,
        // PC のシャットダウンでも止める。止め損ねると次回起動時に 53 番が空かない
        controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
        exit_code: exit,
        checkpoint: 0,
        wait_hint,
        process_id: None,
    };

    // まずは「開始中」。DB の準備に数百ミリ秒かかるので、ここで Running と
    // 報告してしまうと `start` の直後に投げた問い合わせが**まだ誰も居ないポート**へ
    // 届いて失敗する（Windows では ICMP が返り WSAECONNRESET になる）
    handle
        .set_service_status(report(
            ServiceState::StartPending,
            ServiceExitCode::Win32(0),
            STARTUP_WAIT_HINT,
        ))
        .map_err(|err| format!("状態を報告できません: {err}"))?;

    // 待ち受けが立ち上がってから「実行中」にする
    let ready_handle = handle;
    let on_ready = move |_bound| {
        let _ = ready_handle.set_service_status(report(
            ServiceState::Running,
            ServiceExitCode::Win32(0),
            Duration::default(),
        ));
    };

    let result = runner::run(&config, on_ready, runner::wait_for_signal(shutdown_rx));

    // 失敗を終了コードで伝える。0 以外なら SCM が再起動を試みる
    let exit = if result.is_ok() {
        ServiceExitCode::Win32(0)
    } else {
        ServiceExitCode::ServiceSpecific(1)
    };
    let _ = handle.set_service_status(report(ServiceState::Stopped, exit, Duration::default()));

    result
}
