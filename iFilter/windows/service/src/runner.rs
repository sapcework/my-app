//! サービス本体。SCM から起動され、DNS プロキシを動かし続ける。

use std::path::Path;
use std::sync::Arc;
use std::sync::mpsc::Receiver;
use std::time::Duration;

use filter_core::FilterCore;
use ifilter_dns::{DnsFilter, Upstream, serve};
use storage::{PolicyStore, SqliteStore};
use time::OffsetDateTime;

use crate::config::FilterConfig;
use crate::dns_settings::{self, ORIGINAL_SETTINGS_KEY, OriginalSettings, WindowsDns};

type Result<T> = std::result::Result<T, String>;

/// DNS 設定を見直す間隔。
///
/// 短くすると新しいアダプタを早く拾えるが、レジストリ読み取りが増える。
/// 30 秒なら、USB テザリングを挿してから塞がるまで最悪 30 秒。そこを完全に
/// 塞ぐのは WFP（Step 11〜12）の仕事なので、ここは軽さを優先する。
const DNS_REAPPLY_INTERVAL: Duration = Duration::from_secs(30);

/// フィルターを組み立てて動かす。`shutdown` が来るまで戻らない。
///
/// サービスからもコンソールからも同じ経路を通す。「サービスだと動かない」を
/// デバッグしづらい形で作り込まないため。
pub fn run(config: &FilterConfig, shutdown: impl std::future::Future<Output = ()>) -> Result<()> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|err| format!("非同期ランタイムを作れません: {err}"))?;

    runtime.block_on(async move { run_async(config, shutdown).await })
}

async fn run_async(
    config: &FilterConfig,
    shutdown: impl std::future::Future<Output = ()>,
) -> Result<()> {
    let path = config.db_path()?;
    ensure_database(&path)?;

    let store = SqliteStore::open(&path).map_err(|err| format!("DB を開けません: {err}"))?;
    let core = FilterCore::load(
        store,
        config.profile.into(),
        config.device_id.clone(),
        OffsetDateTime::now_utc(),
    )
    .map_err(|err| format!("ポリシーを読み込めません: {err}"))?;

    let upstream = Upstream::new(config.upstream, Duration::from_secs(config.timeout));
    let filter = Arc::new(DnsFilter::new(core, upstream, config.verbose));

    // DNS 設定の差し替えは、待ち受けが立ち上がってから始める。
    // 先に向けてしまうと、その隙間で端末の名前解決が丸ごと失敗する
    let enforcer = if config.enforce_dns {
        Some(tokio::spawn(enforce_dns_loop(
            path.clone(),
            config.listen.ip(),
        )))
    } else {
        None
    };

    let result = serve(filter, config.listen, |_| {}, shutdown)
        .await
        .map_err(|err| format!("{} で待ち受けられません: {err}", config.listen));

    if let Some(handle) = enforcer {
        handle.abort();
        // 止まるときは必ず元の DNS に戻す。戻さないと名前解決ができないまま残る
        if let Err(err) = restore_dns(&path) {
            eprintln!("DNS 設定を戻せませんでした: {err}");
        }
    }

    result
}

/// DB が無ければ作り、同梱データを入れる。
///
/// サービスは無人で起動するので、`init` を忘れていたら黙って落ちるのではなく
/// ここで用意する。
fn ensure_database(path: &Path) -> Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|err| format!("{} を作れません: {err}", dir.display()))?;
    }

    let mut store = SqliteStore::open(path).map_err(|err| format!("DB を開けません: {err}"))?;
    store
        .seed_builtins(OffsetDateTime::now_utc())
        .map_err(|err| format!("同梱データを書き込めません: {err}"))
}

/// DNS 設定を定期的に見直し、iFilter に向け直す。
async fn enforce_dns_loop(path: std::path::PathBuf, proxy: std::net::IpAddr) {
    loop {
        if let Err(err) = enforce_dns_once(&path, proxy) {
            // 1 回失敗しても諦めない。アダプタの入れ替え中など一時的な失敗がある
            eprintln!("DNS 設定を適用できませんでした: {err}");
        }
        tokio::time::sleep(DNS_REAPPLY_INTERVAL).await;
    }
}

fn enforce_dns_once(path: &Path, proxy: std::net::IpAddr) -> Result<()> {
    let mut store = SqliteStore::open(path).map_err(|err| format!("DB を開けません: {err}"))?;
    let mut original = load_original(&store)?;

    let changed = dns_settings::apply(&WindowsDns, proxy, &mut original)?;
    if changed.is_empty() {
        return Ok(());
    }

    save_original(&mut store, &original)?;
    println!("DNS を iFilter に向けました: {}", changed.join(", "));
    Ok(())
}

/// 記録しておいた設定に戻す。
pub fn restore_dns(path: &Path) -> Result<Vec<String>> {
    let mut store = SqliteStore::open(path).map_err(|err| format!("DB を開けません: {err}"))?;
    let original = load_original(&store)?;
    if original.is_empty() {
        return Ok(Vec::new());
    }

    let restored = dns_settings::revert(&WindowsDns, &original)?;
    // 戻し終えたら記録を消す。残しておくと次に「元の設定」を取り違える
    save_original(&mut store, &OriginalSettings::default())?;
    Ok(restored)
}

pub fn load_original(store: &impl PolicyStore) -> Result<OriginalSettings> {
    let Some(raw) = store
        .setting(ORIGINAL_SETTINGS_KEY)
        .map_err(|err| format!("設定を読めません: {err}"))?
    else {
        return Ok(OriginalSettings::default());
    };

    serde_json::from_str(&raw)
        .map_err(|err| format!("保存済みの DNS 設定を読めません（{ORIGINAL_SETTINGS_KEY}）: {err}"))
}

fn save_original(store: &mut impl PolicyStore, original: &OriginalSettings) -> Result<()> {
    let json = serde_json::to_string(original)
        .map_err(|err| format!("DNS 設定を書き出せません: {err}"))?;
    store
        .set_setting(ORIGINAL_SETTINGS_KEY, &json, OffsetDateTime::now_utc())
        .map_err(|err| format!("設定を保存できません: {err}"))
}

/// `std::sync::mpsc` の受信を待つ future。SCM の停止要求を async 側へ渡す。
pub async fn wait_for_signal(rx: Receiver<()>) {
    let _ = tokio::task::spawn_blocking(move || rx.recv()).await;
}
