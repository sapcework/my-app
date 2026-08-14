//! サービスの登録・起動・停止。SCM を相手にする。

use std::ffi::OsString;
use std::time::Duration;

use windows_service::service::{
    ServiceAccess, ServiceAction, ServiceActionType, ServiceErrorControl, ServiceFailureActions,
    ServiceInfo, ServiceStartType, ServiceState, ServiceType,
};
use windows_service::service_manager::{ServiceManager, ServiceManagerAccess};

use crate::config::{DESCRIPTION, DISPLAY_NAME, FilterConfig, SERVICE_NAME};

type Result<T> = std::result::Result<T, String>;

/// 落ちたときに待つ秒数。短すぎると失敗を繰り返して CPU を食う。
const RESTART_DELAY: Duration = Duration::from_secs(10);

/// 失敗回数の数え直し。1 日無事なら仕切り直す。
const FAILURE_RESET: Duration = Duration::from_secs(60 * 60 * 24);

fn manager(access: ServiceManagerAccess) -> Result<ServiceManager> {
    ServiceManager::local_computer(None::<&str>, access).map_err(|err| {
        format!("サービス制御マネージャに接続できません: {err}\n管理者として実行してください。")
    })
}

/// サービスを登録する。
pub fn install(config: &FilterConfig) -> Result<()> {
    let manager = manager(ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE)?;

    let executable_path = std::env::current_exe()
        .map_err(|err| format!("自分の実行ファイルの場所が分かりません: {err}"))?;

    let info = ServiceInfo {
        name: OsString::from(SERVICE_NAME),
        display_name: OsString::from(DISPLAY_NAME),
        service_type: ServiceType::OWN_PROCESS,
        // PC を起動したら子供がログインする前から動いている必要がある
        start_type: ServiceStartType::AutoStart,
        error_control: ServiceErrorControl::Normal,
        executable_path,
        launch_arguments: config.to_launch_arguments()?,
        dependencies: vec![],
        // LocalSystem で動かす。53 番のバインドと DNS 設定の変更に要る
        account_name: None,
        account_password: None,
    };

    let service = manager
        .create_service(&info, ServiceAccess::CHANGE_CONFIG | ServiceAccess::START)
        .map_err(|err| format!("サービスを登録できません: {err}"))?;

    service
        .set_description(DESCRIPTION)
        .map_err(|err| format!("説明を設定できません: {err}"))?;

    // 落ちたら自動で立ち上げ直す。フィルターが黙って止まったままだと
    // 「効いているつもりで素通り」という最悪の失敗形になる（ARCHITECTURE.md §7-3）
    let actions = ServiceFailureActions {
        reset_period: windows_service::service::ServiceFailureResetPeriod::After(FAILURE_RESET),
        reboot_msg: None,
        command: None,
        actions: Some(vec![
            ServiceAction {
                action_type: ServiceActionType::Restart,
                delay: RESTART_DELAY,
            },
            ServiceAction {
                action_type: ServiceActionType::Restart,
                delay: RESTART_DELAY,
            },
            ServiceAction {
                action_type: ServiceActionType::Restart,
                delay: RESTART_DELAY,
            },
        ]),
    };
    service
        .update_failure_actions(actions)
        .map_err(|err| format!("失敗時の動作を設定できません: {err}"))?;
    // 異常終了でなくても（終了コード != 0 でも）再起動の対象にする
    service
        .set_failure_actions_on_non_crash_failures(true)
        .map_err(|err| format!("失敗時の動作を設定できません: {err}"))?;

    Ok(())
}

/// サービスの登録を消す。動いていれば先に止める。
pub fn uninstall() -> Result<()> {
    let manager = manager(ServiceManagerAccess::CONNECT)?;
    let service = manager
        .open_service(
            SERVICE_NAME,
            ServiceAccess::QUERY_STATUS | ServiceAccess::STOP | ServiceAccess::DELETE,
        )
        .map_err(|err| format!("サービスが見つかりません: {err}"))?;

    let status = service
        .query_status()
        .map_err(|err| format!("状態を取得できません: {err}"))?;
    if status.current_state != ServiceState::Stopped {
        service
            .stop()
            .map_err(|err| format!("サービスを停止できません: {err}"))?;
        wait_for(&service, ServiceState::Stopped)?;
    }

    service
        .delete()
        .map_err(|err| format!("サービスを削除できません: {err}"))
}

/// サービスを開始する。
pub fn start() -> Result<()> {
    let manager = manager(ServiceManagerAccess::CONNECT)?;
    let service = manager
        .open_service(
            SERVICE_NAME,
            ServiceAccess::START | ServiceAccess::QUERY_STATUS,
        )
        .map_err(|err| format!("サービスが見つかりません: {err}"))?;

    service
        .start(&[] as &[&std::ffi::OsStr])
        .map_err(|err| format!("サービスを開始できません: {err}"))?;
    wait_for(&service, ServiceState::Running)
}

/// サービスを停止する。
pub fn stop() -> Result<()> {
    let manager = manager(ServiceManagerAccess::CONNECT)?;
    let service = manager
        .open_service(
            SERVICE_NAME,
            ServiceAccess::STOP | ServiceAccess::QUERY_STATUS,
        )
        .map_err(|err| format!("サービスが見つかりません: {err}"))?;

    service
        .stop()
        .map_err(|err| format!("サービスを停止できません: {err}"))?;
    wait_for(&service, ServiceState::Stopped)
}

/// 現在の状態を返す。登録されていなければ `None`。
pub fn status() -> Result<Option<ServiceState>> {
    let manager = manager(ServiceManagerAccess::CONNECT)?;
    match manager.open_service(SERVICE_NAME, ServiceAccess::QUERY_STATUS) {
        Ok(service) => Ok(Some(
            service
                .query_status()
                .map_err(|err| format!("状態を取得できません: {err}"))?
                .current_state,
        )),
        Err(_) => Ok(None),
    }
}

/// 状態が変わるまで待つ。
///
/// SCM への要求は非同期なので、戻ってきた時点ではまだ変わっていない。
/// 待たずに次の操作へ進むと「まだ動いている」と怒られる。
fn wait_for(service: &windows_service::service::Service, want: ServiceState) -> Result<()> {
    const INTERVAL: Duration = Duration::from_millis(200);
    const LIMIT: Duration = Duration::from_secs(30);

    let start = std::time::Instant::now();
    loop {
        let status = service
            .query_status()
            .map_err(|err| format!("状態を取得できません: {err}"))?;
        if status.current_state == want {
            return Ok(());
        }
        if start.elapsed() > LIMIT {
            return Err(format!(
                "{LIMIT:?} 待っても {want:?} になりません（現在: {:?}）",
                status.current_state
            ));
        }
        std::thread::sleep(INTERVAL);
    }
}
