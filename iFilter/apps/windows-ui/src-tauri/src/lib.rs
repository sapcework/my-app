//! iFilter の保護者向け管理 UI（Tauri 側）。
//!
//! **判定ロジックを持たない。** 画面に出すのは `filter-core` が返した結果だけで、
//! 「このカテゴリなら遮断」のような条件分岐はここにも React 側にも書かない。
//! 書くと「UI では許可なのに DNS では遮断」という食い違いが起きる
//! （docs/adr/0001-policy-engine-network-separation.md）。
//!
//! 設定の書き換えは必ず `filter-core` 経由で行う。ポリシー版数が進み、
//! 動いているサービスが数秒以内に読み直す。

mod commands;
mod dto;
mod grouping;
mod state;

use state::{AppState, default_database_path};

/// アプリを起動する。
///
/// DB を開けない場合はウィンドウを出す前に止める。中身の無い画面を出しても
/// 保護者が何をすればよいか分からない。
pub fn run() {
    let path = match default_database_path() {
        Ok(path) => path,
        Err(err) => {
            report_fatal(&err);
            return;
        }
    };

    let app_state = match AppState::load(&path) {
        Ok(state) => state,
        Err(err) => {
            report_fatal(&err);
            return;
        }
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::set_filter_enabled,
            commands::check_domain,
            commands::inspect_domain,
            commands::get_profiles,
            commands::get_active_profile,
            commands::set_active_profile,
            commands::update_profile,
            commands::get_category_rules,
            commands::set_category_rule,
            commands::get_overrides,
            commands::add_override,
            commands::remove_override,
            commands::get_domain_records,
            commands::classify_domain,
            commands::get_recent_decisions,
            commands::get_blocked_groups,
            commands::get_daily_summary,
            commands::set_browser_doh_disabled,
        ])
        .run(tauri::generate_context!())
        .expect("iFilter の管理画面を起動できませんでした");
}

/// 起動前の失敗を伝える。
///
/// この時点では画面が無いので標準エラーへ出す。管理者権限が要ることが
/// 大半の原因なので、そう読める文言にしてある。
fn report_fatal(message: &str) {
    eprintln!("iFilter の管理画面を開始できません。\n{message}");
}
