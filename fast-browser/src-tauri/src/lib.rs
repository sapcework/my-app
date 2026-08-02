use std::sync::Mutex;
use tauri::{
    webview::PageLoadEvent, AppHandle, Emitter, EventTarget, LogicalPosition, LogicalSize, Manager,
    State, WebviewBuilder, WebviewUrl,
};

const BASE_TOOLBAR_HEIGHT: f64 = 86.0; // タブバー 36px + ナビバー 50px
const HOME_URL: &str = "https://www.google.com";

// コンテンツ WebView に注入するキーボードショートカットスクリプト
// fbcmd:// スキームで Rust に通知し、on_navigation でキャンセルしながら処理
const SHORTCUT_INIT_SCRIPT: &str = r#"
(function () {
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
            var key = e.key.toLowerCase();
            var cmd = null;
            if      (key === 't') cmd = 'new-tab';
            else if (key === 'w') cmd = 'close-tab';
            else if (key === 'l') cmd = 'focus-address';
            else if (key === 'r') cmd = 'reload';
            else if (key === 'd') cmd = 'bookmark';
            else if (key === 'h') cmd = 'toggle-history';
            if (cmd) { e.preventDefault(); e.stopPropagation(); location.href = 'fbcmd://' + cmd; }
        }
        if (e.altKey && !e.ctrlKey) {
            if (e.key === 'ArrowLeft')  { e.preventDefault(); history.back();    }
            if (e.key === 'ArrowRight') { e.preventDefault(); history.forward(); }
        }
        if (!e.ctrlKey && !e.altKey && e.key === 'F5') {
            e.preventDefault();
            location.href = 'fbcmd://reload';
        }
    }, true);
})();
"#;

// ─── タブ データモデル ─────────────────────────────────────────────

#[derive(Clone, serde::Serialize)]
pub struct Tab {
    pub id: u32,
    pub url: String,
    pub title: String,
    pub is_loading: bool,
}

#[derive(Clone, serde::Serialize)]
pub struct TabsState {
    pub tabs: Vec<Tab>,
    pub active_id: u32,
}

// ─── ブックマーク データモデル ────────────────────────────────────

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct Bookmark {
    pub id: u32,
    pub url: String,
    pub title: String,
    pub created_at: i64,
}

// ─── 履歴 データモデル ────────────────────────────────────────────

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct HistoryEntry {
    pub id: u32,
    pub url: String,
    pub title: String,
    pub visited_at: i64,
}

// ─── タブマネージャー ─────────────────────────────────────────────

pub struct TabManager {
    tabs: Vec<Tab>,
    active_id: u32,
    next_id: u32,
}

impl TabManager {
    fn new() -> Self {
        Self {
            tabs: vec![Tab {
                id: 1,
                url: HOME_URL.to_string(),
                title: "New Tab".to_string(),
                is_loading: true,
            }],
            active_id: 1,
            next_id: 2,
        }
    }

    fn snapshot(&self) -> TabsState {
        TabsState {
            tabs: self.tabs.clone(),
            active_id: self.active_id,
        }
    }

    fn open_tab(&mut self, url: String) {
        let id = self.next_id;
        self.next_id += 1;
        self.tabs.push(Tab {
            id,
            url: url.clone(),
            title: hostname_of(&url),
            is_loading: true,
        });
        self.active_id = id;
    }

    fn close_tab(&mut self, id: u32) -> Option<String> {
        if self.tabs.len() <= 1 {
            return None;
        }
        let pos = self.tabs.iter().position(|t| t.id == id)?;
        self.tabs.remove(pos);
        if self.active_id == id {
            let new_pos = pos.min(self.tabs.len() - 1);
            self.active_id = self.tabs[new_pos].id;
            return Some(self.tabs[new_pos].url.clone());
        }
        None
    }

    fn switch_to(&mut self, id: u32) -> Option<String> {
        self.tabs.iter().find(|t| t.id == id).map(|t| {
            self.active_id = id;
            t.url.clone()
        })
    }

    fn on_navigate(&mut self, url: &str) {
        if let Some(t) = self.tabs.iter_mut().find(|t| t.id == self.active_id) {
            t.url = url.to_string();
            t.title = hostname_of(url);
            t.is_loading = true;
        }
    }

    fn on_load_finished(&mut self) {
        if let Some(t) = self.tabs.iter_mut().find(|t| t.id == self.active_id) {
            t.is_loading = false;
        }
    }
}

// ─── ブックマークストア ───────────────────────────────────────────

pub struct BookmarkStore {
    bookmarks: Vec<Bookmark>,
    next_id: u32,
    data_path: Option<std::path::PathBuf>,
}

impl BookmarkStore {
    fn new() -> Self {
        Self {
            bookmarks: vec![],
            next_id: 1,
            data_path: None,
        }
    }

    fn init(&mut self, data_dir: std::path::PathBuf) {
        let path = data_dir.join("bookmarks.json");
        self.data_path = Some(path);
        self.load();
    }

    fn load(&mut self) {
        let Some(path) = &self.data_path else { return };
        let Ok(data) = std::fs::read_to_string(path) else {
            return;
        };
        let Ok(bms) = serde_json::from_str::<Vec<Bookmark>>(&data) else {
            return;
        };
        self.next_id = bms.iter().map(|b| b.id).max().unwrap_or(0) + 1;
        self.bookmarks = bms;
    }

    fn save(&self) {
        let Some(path) = &self.data_path else { return };
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(data) = serde_json::to_string_pretty(&self.bookmarks) {
            let _ = std::fs::write(path, data);
        }
    }

    fn add(&mut self, url: String, title: String) -> Bookmark {
        let bm = Bookmark {
            id: self.next_id,
            url,
            title,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64,
        };
        self.next_id += 1;
        self.bookmarks.push(bm.clone());
        self.save();
        bm
    }

    fn remove(&mut self, id: u32) {
        self.bookmarks.retain(|b| b.id != id);
        self.save();
    }

    fn find_by_url(&self, url: &str) -> Option<Bookmark> {
        self.bookmarks.iter().find(|b| b.url == url).cloned()
    }

    fn all(&self) -> Vec<Bookmark> {
        self.bookmarks.clone()
    }
}

// ─── 履歴ストア ───────────────────────────────────────────────────

const MAX_HISTORY_ENTRIES: usize = 1000; // 肥大化防止の上限

pub struct HistoryStore {
    entries: Vec<HistoryEntry>, // 新しい順（先頭が最新）
    next_id: u32,
    data_path: Option<std::path::PathBuf>,
}

impl HistoryStore {
    fn new() -> Self {
        Self {
            entries: vec![],
            next_id: 1,
            data_path: None,
        }
    }

    fn init(&mut self, data_dir: std::path::PathBuf) {
        let path = data_dir.join("history.json");
        self.data_path = Some(path);
        self.load();
    }

    fn load(&mut self) {
        let Some(path) = &self.data_path else { return };
        let Ok(data) = std::fs::read_to_string(path) else {
            return;
        };
        let Ok(entries) = serde_json::from_str::<Vec<HistoryEntry>>(&data) else {
            return;
        };
        self.next_id = entries.iter().map(|e| e.id).max().unwrap_or(0) + 1;
        self.entries = entries;
    }

    fn save(&self) {
        let Some(path) = &self.data_path else { return };
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(data) = serde_json::to_string_pretty(&self.entries) {
            let _ = std::fs::write(path, data);
        }
    }

    // 直前の訪問と同じ URL なら時刻だけ更新（リロード連打での重複を防ぐ）
    fn visit(&mut self, url: String, title: String) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        if let Some(last) = self.entries.first_mut() {
            if last.url == url {
                last.visited_at = now;
                self.save();
                return;
            }
        }
        let id = self.next_id;
        self.next_id += 1;
        self.entries.insert(
            0,
            HistoryEntry {
                id,
                url,
                title,
                visited_at: now,
            },
        );
        self.entries.truncate(MAX_HISTORY_ENTRIES);
        self.save();
    }

    fn remove(&mut self, id: u32) {
        self.entries.retain(|e| e.id != id);
        self.save();
    }

    fn clear(&mut self) {
        self.entries.clear();
        self.save();
    }

    fn all(&self) -> Vec<HistoryEntry> {
        self.entries.clone()
    }
}

// ─── ツールバー高さ共有状態 ───────────────────────────────────────

pub struct ToolbarHeight(pub f64);

// ─── ユーティリティ ───────────────────────────────────────────────

fn hostname_of(url: &str) -> String {
    url::Url::parse(url)
        .ok()
        .and_then(|u| {
            u.host_str()
                .map(|h| h.trim_start_matches("www.").to_string())
        })
        .unwrap_or_else(|| "New Tab".to_string())
}

// 検索クエリ正規化は React 側で処理。ここではスキーム補完のみ。
fn normalize_url(url: &str) -> String {
    let s = url.trim();
    if s.starts_with("http://") || s.starts_with("https://") || s.starts_with("file://") {
        s.to_string()
    } else {
        format!("https://{}", s)
    }
}

fn emit_tabs(app: &AppHandle, state: &TabsState) {
    let _ = app.emit_to(
        EventTarget::webview_window("main"),
        "tabs-updated",
        state.clone(),
    );
}

fn navigate_webview(app: &AppHandle, url: &str) -> Result<(), String> {
    let webview = app
        .get_webview("browser-content")
        .ok_or("browser webview not found")?;
    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    webview.navigate(parsed).map_err(|e| e.to_string())
}

// ─── タブ コマンド ────────────────────────────────────────────────

#[tauri::command]
fn navigate(url: String, app: AppHandle, tabs: State<'_, Mutex<TabManager>>) -> Result<(), String> {
    let normalized = normalize_url(&url);
    let snapshot = {
        let mut mgr = tabs.lock().unwrap();
        mgr.on_navigate(&normalized);
        mgr.snapshot()
    };
    navigate_webview(&app, &normalized)?;
    emit_tabs(&app, &snapshot);
    Ok(())
}

#[tauri::command]
fn go_back(app: AppHandle) -> Result<(), String> {
    app.get_webview("browser-content")
        .ok_or("not found")?
        .eval("history.back()")
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn go_forward(app: AppHandle) -> Result<(), String> {
    app.get_webview("browser-content")
        .ok_or("not found")?
        .eval("history.forward()")
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn reload(app: AppHandle) -> Result<(), String> {
    app.get_webview("browser-content")
        .ok_or("not found")?
        .eval("location.reload()")
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn new_tab(url: String, app: AppHandle, tabs: State<'_, Mutex<TabManager>>) -> Result<(), String> {
    let normalized = normalize_url(&url);
    let snapshot = {
        let mut mgr = tabs.lock().unwrap();
        mgr.open_tab(normalized.clone());
        mgr.snapshot()
    };
    navigate_webview(&app, &normalized)?;
    emit_tabs(&app, &snapshot);
    Ok(())
}

#[tauri::command]
fn close_tab(id: u32, app: AppHandle, tabs: State<'_, Mutex<TabManager>>) -> Result<(), String> {
    let (snapshot, nav_url) = {
        let mut mgr = tabs.lock().unwrap();
        let nav = mgr.close_tab(id);
        (mgr.snapshot(), nav)
    };
    if let Some(url) = nav_url {
        navigate_webview(&app, &url)?;
    }
    emit_tabs(&app, &snapshot);
    Ok(())
}

#[tauri::command]
fn switch_tab(id: u32, app: AppHandle, tabs: State<'_, Mutex<TabManager>>) -> Result<(), String> {
    let (snapshot, url) = {
        let mut mgr = tabs.lock().unwrap();
        let url = mgr.switch_to(id);
        (mgr.snapshot(), url)
    };
    if let Some(url) = url {
        navigate_webview(&app, &url)?;
    }
    emit_tabs(&app, &snapshot);
    Ok(())
}

#[tauri::command]
fn get_tabs(tabs: State<'_, Mutex<TabManager>>) -> TabsState {
    tabs.lock().unwrap().snapshot()
}

// ─── ブックマーク コマンド ────────────────────────────────────────

#[tauri::command]
fn add_bookmark(url: String, title: String, store: State<'_, Mutex<BookmarkStore>>) -> Bookmark {
    store.lock().unwrap().add(url, title)
}

#[tauri::command]
fn remove_bookmark(id: u32, store: State<'_, Mutex<BookmarkStore>>) {
    store.lock().unwrap().remove(id);
}

#[tauri::command]
fn get_bookmarks(store: State<'_, Mutex<BookmarkStore>>) -> Vec<Bookmark> {
    store.lock().unwrap().all()
}

#[tauri::command]
fn get_bookmark_for_url(url: String, store: State<'_, Mutex<BookmarkStore>>) -> Option<Bookmark> {
    store.lock().unwrap().find_by_url(&url)
}

// ─── 履歴 コマンド ────────────────────────────────────────────────

#[tauri::command]
fn get_history(store: State<'_, Mutex<HistoryStore>>) -> Vec<HistoryEntry> {
    store.lock().unwrap().all()
}

#[tauri::command]
fn remove_history_entry(id: u32, store: State<'_, Mutex<HistoryStore>>) {
    store.lock().unwrap().remove(id);
}

#[tauri::command]
fn clear_history(store: State<'_, Mutex<HistoryStore>>) {
    store.lock().unwrap().clear();
}

// ─── WebView 位置調整 ─────────────────────────────────────────────

#[tauri::command]
fn set_webview_top(
    y: f64,
    app: AppHandle,
    toolbar_height: State<'_, Mutex<ToolbarHeight>>,
) -> Result<(), String> {
    toolbar_height.lock().unwrap().0 = y;
    let webview = app.get_webview("browser-content").ok_or("not found")?;
    let window = app.get_webview_window("main").ok_or("not found")?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let lw = size.width as f64 / scale;
    let lh = size.height as f64 / scale;
    webview
        .set_position(LogicalPosition::new(0.0, y))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(lw, lh - y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── エントリポイント ─────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(TabManager::new()))
        .manage(Mutex::new(BookmarkStore::new()))
        .manage(Mutex::new(HistoryStore::new()))
        .manage(Mutex::new(ToolbarHeight(BASE_TOOLBAR_HEIGHT)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // ブックマークストアを初期化（データディレクトリをセット＆ロード）
            {
                let data_dir = app.path().app_data_dir()?;
                let state = app.state::<Mutex<BookmarkStore>>();
                state.lock().unwrap().init(data_dir);
            }

            // 履歴ストアを初期化（データディレクトリをセット＆ロード）
            {
                let data_dir = app.path().app_data_dir()?;
                let state = app.state::<Mutex<HistoryStore>>();
                state.lock().unwrap().init(data_dir);
            }

            let window = app.get_window("main").ok_or("main window not found")?;
            let window_size = window.inner_size()?;
            let scale = window.scale_factor()?;
            let lw = window_size.width as f64 / scale;
            let lh = window_size.height as f64 / scale;

            let app_shortcuts = app.handle().clone();
            let content_builder = WebviewBuilder::new(
                "browser-content",
                WebviewUrl::External(HOME_URL.parse().unwrap()),
            )
            .initialization_script(SHORTCUT_INIT_SCRIPT)
            .on_navigation(move |url| {
                // fbcmd:// はキーボードショートカットシグナル。キャンセルしてイベントを送信。
                if url.scheme() == "fbcmd" {
                    let cmd = url.host_str().unwrap_or("").to_string();
                    let _ =
                        app_shortcuts.emit_to(EventTarget::webview_window("main"), "shortcut", cmd);
                    return false; // ナビゲーションをキャンセル
                }
                true
            })
            .on_page_load(|webview, payload| {
                let app = webview.app_handle();
                match payload.event() {
                    PageLoadEvent::Started => {
                        let url = payload.url().to_string();
                        let snapshot = {
                            let state = app.state::<Mutex<TabManager>>();
                            let mut mgr = state.lock().unwrap();
                            mgr.on_navigate(&url);
                            mgr.snapshot()
                        };
                        emit_tabs(app, &snapshot);
                        {
                            let state = app.state::<Mutex<HistoryStore>>();
                            state.lock().unwrap().visit(url.clone(), hostname_of(&url));
                        }
                        let _ =
                            app.emit_to(EventTarget::webview_window("main"), "url-changed", url);
                    }
                    PageLoadEvent::Finished => {
                        let snapshot = {
                            let state = app.state::<Mutex<TabManager>>();
                            let mut mgr = state.lock().unwrap();
                            mgr.on_load_finished();
                            mgr.snapshot()
                        };
                        emit_tabs(app, &snapshot);
                    }
                }
            });

            window.add_child(
                content_builder,
                LogicalPosition::new(0.0, BASE_TOOLBAR_HEIGHT),
                LogicalSize::new(lw, lh - BASE_TOOLBAR_HEIGHT),
            )?;

            let app_resize = app.handle().clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Resized(size) = event {
                    if let Some(wv) = app_resize.get_webview("browser-content") {
                        if let Some(win) = app_resize.get_webview_window("main") {
                            if let Ok(scale) = win.scale_factor() {
                                let lw = size.width as f64 / scale;
                                let lh = size.height as f64 / scale;
                                // 現在のツールバー高さを参照してリサイズ
                                let th =
                                    app_resize.state::<Mutex<ToolbarHeight>>().lock().unwrap().0;
                                let _ = wv.set_position(LogicalPosition::new(0.0, th));
                                let _ = wv.set_size(LogicalSize::new(lw, lh - th));
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            navigate,
            go_back,
            go_forward,
            reload,
            new_tab,
            close_tab,
            switch_tab,
            get_tabs,
            add_bookmark,
            remove_bookmark,
            get_bookmarks,
            get_bookmark_for_url,
            get_history,
            remove_history_entry,
            clear_history,
            set_webview_top
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
