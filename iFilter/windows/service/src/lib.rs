//! iFilter のサービス層。
//!
//! バイナリ（`ifilter-service`）と保護者 UI の両方から使う。UI が
//! 「フィルターを止める」を実行するときも、ここの [`manager`] を通す。
//! サービス制御の手順を 2 か所に書くと、片方だけ直して食い違う。
//!
//! **判定ロジックは持たない。** 常駐・DNS 設定の差し替え・ブラウザポリシーという、
//! Windows 固有の実現手段だけを担当する（docs/ARCHITECTURE.md §2）。

pub mod browser_policy;
pub mod config;
pub mod dns_settings;
pub mod log;
pub mod manager;
pub mod runner;
