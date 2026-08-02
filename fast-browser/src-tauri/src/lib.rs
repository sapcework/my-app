use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};
use tauri::{
    webview::{DownloadEvent, NewWindowResponse, PageLoadEvent},
    AppHandle, Emitter, EventTarget, LogicalPosition, LogicalSize, Manager, State, WebviewBuilder,
    WebviewUrl,
};

// タブバー 36px + ナビバー 52px。src/App.tsx の BASE_HEIGHT と必ず一致させること
// （ズレると起動直後に一瞬だけコンテンツの位置が飛ぶ）。
const BASE_TOOLBAR_HEIGHT: f64 = 88.0;
const HOME_URL: &str = "https://www.google.com";

// ─── ページ由来入力の上限値（信頼できない入力なので必ず切り詰める） ──

const MAX_TITLE_LEN: usize = 300; // タブ・履歴に表示するタイトルの最大文字数
const MAX_FAVICON_URL_LEN: usize = 2048; // favicon URL の最大長（data: URI の暴走を防ぐ）
const PAGE_CMD_MIN_INTERVAL: Duration = Duration::from_millis(250); // ページ由来コマンドの最小間隔
const ZOOM_RANGE: std::ops::RangeInclusive<f64> = 0.25..=5.0; // ズーム倍率の許容範囲
const HISTORY_SAVE_MIN_INTERVAL: Duration = Duration::from_millis(1500); // 履歴ファイル書き込みの最小間隔

// ロック毒化からの回復。パニックが一度でも起きるとアプリ全体が
// 操作不能になるのを防ぐため、毒化していても内部値を取り出して継続する。
fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

// ページが送ってくるタイトルを表示可能な範囲に正規化する。
// 制御文字（改行・タブ等）を除去し、長すぎるものは切り詰める。
fn sanitize_title(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|c| !c.is_control())
        .take(MAX_TITLE_LEN)
        .collect();
    cleaned.trim().to_string()
}

// ページが送ってくる favicon URL を検証する。
// chrome 側の <img src> にそのまま渡るため、スキームを http(s) と画像 data URI に限定する。
// （javascript: / file: / 巨大 data URI などを弾く）
fn sanitize_favicon(raw: &str) -> Option<String> {
    let s = raw.trim();
    if s.is_empty() || s.len() > MAX_FAVICON_URL_LEN {
        return None;
    }
    let parsed = url::Url::parse(s).ok()?;
    match parsed.scheme() {
        "http" | "https" => Some(parsed.to_string()),
        // data URI は画像 MIME のみ許可
        "data" if s.starts_with("data:image/") => Some(s.to_string()),
        _ => None,
    }
}

// ページ由来コマンド（fbcmd://）のレート制限。
// 悪意あるページが location.href を連打して新規タブ・ブックマークを
// 大量生成するのを防ぐ。実ユーザーのキー操作の速度は制限に掛からない。
pub struct PageCmdGate(Option<Instant>);

impl PageCmdGate {
    fn new() -> Self {
        Self(None)
    }

    fn allow(&mut self, now: Instant) -> bool {
        let ok = match self.0 {
            Some(prev) => now.duration_since(prev) >= PAGE_CMD_MIN_INTERVAL,
            None => true,
        };
        if ok {
            self.0 = Some(now);
        }
        ok
    }
}

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
            else if (key === 'j') cmd = 'toggle-downloads';
            else if (key === 'f') cmd = 'find';
            else if (key === '0') cmd = 'zoom-reset';
            if (cmd) { e.preventDefault(); e.stopPropagation(); location.href = 'fbcmd://' + cmd; }
        }
        if (e.altKey && !e.ctrlKey) {
            if (e.key === 'ArrowLeft')  { e.preventDefault(); history.back();    }
            if (e.key === 'ArrowRight') { e.preventDefault(); history.forward(); }
        }
        if (e.ctrlKey && (e.key === '+' || e.key === ';' || e.key === '=')) {
            e.preventDefault(); location.href = 'fbcmd://zoom-in';
        }
        if (e.ctrlKey && (e.key === '-' || e.key === '_')) {
            e.preventDefault(); location.href = 'fbcmd://zoom-out';
        }
        if (!e.ctrlKey && !e.altKey && e.key === 'F5') {
            e.preventDefault();
            location.href = 'fbcmd://reload';
        }
        // 検索バーが開いているときは Esc で閉じられるよう chrome へ通知
        if (e.key === 'Escape') {
            location.href = 'fbcmd://escape';
        }
    }, true);
})();
"#;

// コンテンツ WebView の実ページタイトル・ファビコンを検出して Rust に通知するスクリプト
// <title> / <link rel=icon> の変更を MutationObserver で監視し、fbmeta:// スキーム経由で送信
const PAGE_META_SCRIPT: &str = r#"
(function () {
    var lastSent = '';
    var timer = null;
    function faviconUrl() {
        var link = document.querySelector('link[rel~="icon" i]');
        return (link && link.href) ? link.href : (location.origin + '/favicon.ico');
    }
    function sendMeta() {
        var payload = (document.title || '') + '|' + faviconUrl();
        // 内容が変わっていなければ通知しない（MutationObserver の空振り対策）
        if (payload === lastSent) return;
        lastSent = payload;
        location.href = 'fbmeta://update?t=' + encodeURIComponent(document.title || '')
            + '&f=' + encodeURIComponent(faviconUrl());
    }
    // タイトルをアニメーションさせるページ（"(3) 受信トレイ" 等）で
    // 通知が洪水にならないようデバウンスする
    function scheduleSend() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(sendMeta, 200);
    }
    function attach() {
        sendMeta();
        var titleEl = document.querySelector('title');
        var titleTarget = titleEl || document.head || document.documentElement;
        new MutationObserver(scheduleSend).observe(titleTarget, { childList: true, subtree: !titleEl });
        // <link rel=icon> の追加・削除・差し替え（動的favicon変更）も検知
        if (document.head) {
            new MutationObserver(scheduleSend).observe(document.head, { childList: true, subtree: true });
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();
"#;

// ページ内検索。chrome から eval で window.__fbFind を呼び、
// 結果件数は fbfind:// スキームで返す（eval に戻り値が無いため）。
const FIND_SCRIPT: &str = r#"
(function () {
    var marks = [];
    var idx = -1;
    var HI = 'background:#f9e2af;color:#11111b;';
    var CUR = 'background:#fab387;color:#11111b;';
    var MAX_MARKS = 2000; // 巨大ページで固まらないための上限

    function report() {
        location.href = 'fbfind://r?n=' + marks.length + '&i=' + (marks.length ? idx + 1 : 0);
    }

    function clearMarks() {
        for (var i = 0; i < marks.length; i++) {
            var m = marks[i], p = m.parentNode;
            if (!p) continue;
            p.replaceChild(document.createTextNode(m.textContent), m);
            p.normalize();
        }
        marks = []; idx = -1;
    }

    function focusCurrent() {
        for (var i = 0; i < marks.length; i++) {
            marks[i].style.cssText = (i === idx) ? CUR : HI;
        }
        if (marks[idx]) marks[idx].scrollIntoView({ block: 'center', inline: 'nearest' });
    }

    function textNodes() {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                var p = n.parentNode;
                if (!p) return NodeFilter.FILTER_REJECT;
                var t = p.nodeName;
                // スクリプトや入力欄の中身は検索対象にしない
                if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT' || t === 'TEXTAREA')
                    return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var out = [], n;
        while ((n = walker.nextNode())) out.push(n);
        return out;
    }

    function highlight(q) {
        clearMarks();
        if (!q || !document.body) { report(); return; }
        var needle = q.toLowerCase();
        var nodes = textNodes();
        for (var i = 0; i < nodes.length && marks.length < MAX_MARKS; i++) {
            var cur = nodes[i];
            var pos = cur.nodeValue.toLowerCase().indexOf(needle);
            while (pos >= 0 && marks.length < MAX_MARKS) {
                var hit = cur.splitText(pos);          // hit = 一致位置以降
                var rest = hit.splitText(needle.length); // hit = 一致部分ちょうど
                var mk = document.createElement('mark');
                mk.style.cssText = HI;
                hit.parentNode.replaceChild(mk, hit);
                mk.appendChild(hit);
                marks.push(mk);
                cur = rest;
                pos = cur.nodeValue.toLowerCase().indexOf(needle);
            }
        }
        if (marks.length) { idx = 0; focusCurrent(); }
        report();
    }

    function step(d) {
        if (marks.length) {
            idx = (idx + d + marks.length) % marks.length;
            focusCurrent();
        }
        report();
    }

    window.__fbFind = {
        search: highlight,
        next: function () { step(1); },
        prev: function () { step(-1); },
        clear: function () { clearMarks(); report(); }
    };
})();
"#;

// ─── タブ データモデル ─────────────────────────────────────────────

#[derive(Clone, serde::Serialize)]
pub struct Tab {
    pub id: u32,
    pub url: String,
    pub title: String,
    pub is_loading: bool,
    pub favicon: Option<String>,
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
    #[serde(default)]
    pub favicon: Option<String>,
}

// ─── 設定 ─────────────────────────────────────────────────────────

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct Settings {
    pub home_url: String,
    pub engine_id: String,
    pub zoom: f64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            home_url: HOME_URL.to_string(),
            engine_id: "google".to_string(),
            zoom: 1.0,
        }
    }
}

pub struct SettingsStore {
    settings: Settings,
    data_path: Option<std::path::PathBuf>,
}

impl SettingsStore {
    fn new() -> Self {
        Self {
            settings: Settings::default(),
            data_path: None,
        }
    }

    fn init(&mut self, data_dir: std::path::PathBuf) {
        self.data_path = Some(data_dir.join("settings.json"));
        if let Some(path) = &self.data_path {
            if let Ok(data) = std::fs::read_to_string(path) {
                if let Ok(s) = serde_json::from_str::<Settings>(&data) {
                    self.settings = s;
                }
            }
        }
        self.settings.sanitize();
    }

    fn save(&self) {
        let Some(path) = &self.data_path else { return };
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(data) = serde_json::to_string_pretty(&self.settings) {
            let _ = std::fs::write(path, data);
        }
    }

    fn get(&self) -> Settings {
        self.settings.clone()
    }

    fn replace(&mut self, mut next: Settings) -> Settings {
        next.sanitize();
        self.settings = next;
        self.save();
        self.settings.clone()
    }

    fn set_zoom(&mut self, zoom: f64) {
        self.settings.zoom = zoom;
        self.save();
    }
}

impl Settings {
    /// 保存ファイルは手で編集されうるので、読み込み時に必ず妥当な値へ丸める。
    fn sanitize(&mut self) {
        if !ZOOM_RANGE.contains(&self.zoom) || !self.zoom.is_finite() {
            self.zoom = 1.0;
        }
        // ホームには http(s) のみ許可（javascript: などを起動時に開かせない）
        let ok = url::Url::parse(&self.home_url)
            .map(|u| matches!(u.scheme(), "http" | "https"))
            .unwrap_or(false);
        if !ok {
            self.home_url = HOME_URL.to_string();
        }
    }
}

/// プライベートモード。オンの間は履歴を一切記録しない。
pub struct PrivateMode(pub bool);

// ─── ダウンロード ─────────────────────────────────────────────────

const MAX_DOWNLOAD_ENTRIES: usize = 200;

#[derive(Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Running,
    Done,
    Failed,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct Download {
    pub id: u32,
    pub url: String,
    pub file_name: String,
    pub path: String,
    pub status: DownloadStatus,
    pub started_at: i64,
}

pub struct DownloadStore {
    items: Vec<Download>, // 新しい順
    next_id: u32,
    data_path: Option<std::path::PathBuf>,
}

impl DownloadStore {
    fn new() -> Self {
        Self {
            items: vec![],
            next_id: 1,
            data_path: None,
        }
    }

    fn init(&mut self, data_dir: std::path::PathBuf) {
        self.data_path = Some(data_dir.join("downloads.json"));
        if let Some(path) = &self.data_path {
            if let Ok(data) = std::fs::read_to_string(path) {
                if let Ok(mut items) = serde_json::from_str::<Vec<Download>>(&data) {
                    // 前回の実行中に中断したものは「失敗」として復元する
                    for i in items.iter_mut() {
                        if i.status == DownloadStatus::Running {
                            i.status = DownloadStatus::Failed;
                        }
                    }
                    self.next_id = items.iter().map(|i| i.id).max().unwrap_or(0) + 1;
                    self.items = items;
                }
            }
        }
    }

    fn save(&self) {
        let Some(path) = &self.data_path else { return };
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(data) = serde_json::to_string_pretty(&self.items) {
            let _ = std::fs::write(path, data);
        }
    }

    fn start(&mut self, url: String, file_name: String, path: String) -> Download {
        let item = Download {
            id: self.next_id,
            url,
            file_name,
            path,
            status: DownloadStatus::Running,
            started_at: now_secs(),
        };
        self.next_id += 1;
        self.items.insert(0, item.clone());
        self.items.truncate(MAX_DOWNLOAD_ENTRIES);
        self.save();
        item
    }

    /// 完了通知は保存先パスで突き合わせる（同一 URL を複数回落とす場合があるため）
    fn finish(&mut self, path: &str, success: bool) {
        if let Some(item) = self
            .items
            .iter_mut()
            .find(|i| i.path == path && i.status == DownloadStatus::Running)
        {
            item.status = if success {
                DownloadStatus::Done
            } else {
                DownloadStatus::Failed
            };
            self.save();
        }
    }

    fn all(&self) -> Vec<Download> {
        self.items.clone()
    }

    fn find(&self, id: u32) -> Option<Download> {
        self.items.iter().find(|i| i.id == id).cloned()
    }

    fn remove(&mut self, id: u32) {
        self.items.retain(|i| i.id != id);
        self.save();
    }

    fn clear(&mut self) {
        self.items.clear();
        self.save();
    }
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

/// URL からダウンロードのファイル名を決める。
///
/// パス区切りや `..` を含む値をそのまま使うと保存先ディレクトリの外へ
/// 書き出せてしまうため（パストラバーサル）、必ず末尾要素だけを取り出し
/// 危険な文字を落とす。
fn file_name_from_url(url: &url::Url) -> String {
    let raw = url
        .path_segments()
        .and_then(|mut s| s.rfind(|p: &&str| !p.is_empty()))
        .unwrap_or("");
    let name = sanitize_file_name(&percent_decode(raw));
    if name.is_empty() {
        "download".to_string()
    } else {
        name
    }
}

/// ファイル名として安全な形に整える。
/// パス区切り・Windows の予約文字・制御文字を落とし、長さを制限する。
/// 空文字を返しうるので、呼び出し側でフォールバックすること。
fn sanitize_file_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .filter(|c| !c.is_control())
        .collect();
    cleaned
        .trim()
        .trim_matches('.')
        .chars()
        .take(150)
        .collect::<String>()
        .trim()
        .to_string()
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// 既存ファイルを上書きしないよう "name (1).ext" のように連番を付ける
fn unique_path(dir: &std::path::Path, file_name: &str) -> std::path::PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }
    let path = std::path::Path::new(file_name);
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "download".into());
    let ext = path.extension().map(|e| e.to_string_lossy().into_owned());
    for n in 1..1000 {
        let name = match &ext {
            Some(e) => format!("{stem} ({n}).{e}"),
            None => format!("{stem} ({n})"),
        };
        let p = dir.join(name);
        if !p.exists() {
            return p;
        }
    }
    candidate
}

/// ポップアップ（window.open / target=_blank）の連打を抑えるゲート。
/// fbcmd 用とは別インスタンスにして、互いの制限が干渉しないようにする。
pub struct PopupGate(PageCmdGate);

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
                favicon: None,
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
            favicon: None,
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
            t.favicon = None; // 新しいページ用に前ページのファビコンをクリア
        }
    }

    fn on_load_finished(&mut self) {
        if let Some(t) = self.tabs.iter_mut().find(|t| t.id == self.active_id) {
            t.is_loading = false;
        }
    }

    fn set_active_meta(&mut self, title: String, favicon: Option<String>) {
        if let Some(t) = self.tabs.iter_mut().find(|t| t.id == self.active_id) {
            t.title = title;
            t.favicon = favicon;
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
    dirty: bool,                 // 未保存の変更があるか
    last_saved: Option<Instant>, // 直近でディスクへ書いた時刻
}

impl HistoryStore {
    fn new() -> Self {
        Self {
            entries: vec![],
            next_id: 1,
            data_path: None,
            dirty: false,
            last_saved: None,
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

    // 実際にディスクへ書き込む。呼び出し側は save_throttled / flush を使うこと。
    fn write_to_disk(&mut self) {
        let Some(path) = &self.data_path else { return };
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(data) = serde_json::to_string_pretty(&self.entries) {
            let _ = std::fs::write(path, data);
        }
        self.dirty = false;
        self.last_saved = Some(Instant::now());
    }

    // 変更を記録し、前回書き込みから十分時間が経っていれば保存する。
    // ページ遷移・タイトル更新のたびに全件を JSON 化して同期書き込みすると
    // ナビゲーションが詰まるため、書き込み頻度に上限を設ける。
    fn save_throttled(&mut self) {
        self.dirty = true;
        let due = match self.last_saved {
            Some(prev) => prev.elapsed() >= HISTORY_SAVE_MIN_INTERVAL,
            None => true,
        };
        if due {
            self.write_to_disk();
        }
    }

    // 未保存の変更があれば確実に書き出す（終了時・明示操作時に使う）
    fn flush(&mut self) {
        if self.dirty {
            self.write_to_disk();
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
                self.save_throttled();
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
                favicon: None,
            },
        );
        self.entries.truncate(MAX_HISTORY_ENTRIES);
        self.save_throttled();
    }

    fn remove(&mut self, id: u32) {
        self.entries.retain(|e| e.id != id);
        self.write_to_disk(); // 明示的なユーザー操作は即座に永続化する
    }

    fn clear(&mut self) {
        self.entries.clear();
        self.write_to_disk();
    }

    fn all(&self) -> Vec<HistoryEntry> {
        self.entries.clone()
    }

    // 取り消し操作用の復元。訪問時刻の降順を保ち、id 採番が衝突しないよう詰め直す。
    fn restore(&mut self, entries: Vec<HistoryEntry>) {
        for e in entries {
            if !self.entries.iter().any(|x| x.id == e.id) {
                self.entries.push(e);
            }
        }
        self.entries
            .sort_by_key(|e| std::cmp::Reverse(e.visited_at));
        self.entries.truncate(MAX_HISTORY_ENTRIES);
        self.next_id = self.entries.iter().map(|e| e.id).max().unwrap_or(0) + 1;
        self.write_to_disk();
    }

    // 直近訪問（先頭）エントリのタイトル・ファビコンを実ページ情報で更新する。
    // 内容が変わっていなければ何もしない（無駄な書き込みを避ける）。
    fn update_latest_meta(&mut self, title: String, favicon: Option<String>) {
        if let Some(last) = self.entries.first_mut() {
            if last.title == title && last.favicon == favicon {
                return;
            }
            last.title = title;
            last.favicon = favicon;
            self.save_throttled();
        }
    }
}

// ─── ツールバー高さ共有状態 ───────────────────────────────────────

/// chrome の高さとウィンドウの論理サイズを保持する共有状態。
///
/// サイズをここにキャッシュしておくのが重要。コマンドから
/// `window.inner_size()` / `scale_factor()` を呼ぶとイベントループへの
/// 同期往復が発生し、条件によって返ってこなくなる（＝パネルが開かない）。
/// 値は setup と resize イベント（どちらもイベントループ側）で更新する。
pub struct Layout {
    pub toolbar_height: f64,
    pub win_w: f64,
    pub win_h: f64,
}

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
        let mut mgr = lock(&tabs);
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
        let mut mgr = lock(&tabs);
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
        let mut mgr = lock(&tabs);
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
        let mut mgr = lock(&tabs);
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
    lock(&tabs).snapshot()
}

// ─── ブックマーク コマンド ────────────────────────────────────────

#[tauri::command]
fn add_bookmark(url: String, title: String, store: State<'_, Mutex<BookmarkStore>>) -> Bookmark {
    lock(&store).add(url, title)
}

#[tauri::command]
fn remove_bookmark(id: u32, store: State<'_, Mutex<BookmarkStore>>) {
    lock(&store).remove(id);
}

#[tauri::command]
fn get_bookmarks(store: State<'_, Mutex<BookmarkStore>>) -> Vec<Bookmark> {
    lock(&store).all()
}

#[tauri::command]
fn get_bookmark_for_url(url: String, store: State<'_, Mutex<BookmarkStore>>) -> Option<Bookmark> {
    lock(&store).find_by_url(&url)
}

// ─── 履歴 コマンド ────────────────────────────────────────────────

#[tauri::command]
fn get_history(store: State<'_, Mutex<HistoryStore>>) -> Vec<HistoryEntry> {
    lock(&store).all()
}

#[tauri::command]
fn remove_history_entry(id: u32, store: State<'_, Mutex<HistoryStore>>) -> Option<HistoryEntry> {
    let mut s = lock(&store);
    let removed = s.all().into_iter().find(|e| e.id == id);
    s.remove(id);
    removed
}

// 削除した項目を返すことで、フロント側が「元に戻す」を提供できるようにする
#[tauri::command]
fn clear_history(store: State<'_, Mutex<HistoryStore>>) -> Vec<HistoryEntry> {
    let mut s = lock(&store);
    let removed = s.all();
    s.clear();
    removed
}

#[tauri::command]
fn restore_history(entries: Vec<HistoryEntry>, store: State<'_, Mutex<HistoryStore>>) {
    lock(&store).restore(entries);
}

// ─── 設定 コマンド ────────────────────────────────────────────────

#[tauri::command]
fn get_settings(store: State<'_, Mutex<SettingsStore>>) -> Settings {
    lock(&store).get()
}

/// 設定を保存し、丸めたあとの実際の値を返す（不正値はサーバー側で補正される）
#[tauri::command]
fn save_settings(settings: Settings, store: State<'_, Mutex<SettingsStore>>) -> Settings {
    lock(&store).replace(settings)
}

// ─── プライベートモード コマンド ──────────────────────────────────

#[tauri::command]
fn set_private_mode(on: bool, state: State<'_, Mutex<PrivateMode>>) {
    lock(&state).0 = on;
    log::info!("private mode: {}", on);
}

// ─── ズーム コマンド ──────────────────────────────────────────────

#[tauri::command]
async fn set_zoom(
    factor: f64,
    app: AppHandle,
    store: State<'_, Mutex<SettingsStore>>,
) -> Result<f64, String> {
    let f = if factor.is_finite() {
        factor.clamp(*ZOOM_RANGE.start(), *ZOOM_RANGE.end())
    } else {
        1.0
    };
    let webview = app.get_webview("browser-content").ok_or("not found")?;
    webview.set_zoom(f).map_err(|e| e.to_string())?;
    lock(&store).set_zoom(f);
    Ok(f)
}

// ─── ページ内検索 コマンド ────────────────────────────────────────

/// 検索語は JSON 文字列リテラルとして埋め込む。
/// 文字列連結で JS を組み立てると、引用符を含む検索語でスクリプトが壊れる。
fn eval_find(app: &AppHandle, js: &str) -> Result<(), String> {
    let webview = app.get_webview("browser-content").ok_or("not found")?;
    webview.eval(js).map_err(|e| e.to_string())
}

#[tauri::command]
async fn find_in_page(query: String, app: AppHandle) -> Result<(), String> {
    let literal = serde_json::to_string(&query).map_err(|e| e.to_string())?;
    eval_find(&app, &format!("window.__fbFind&&window.__fbFind.search({literal})"))
}

#[tauri::command]
async fn find_step(forward: bool, app: AppHandle) -> Result<(), String> {
    let fnname = if forward { "next" } else { "prev" };
    eval_find(&app, &format!("window.__fbFind&&window.__fbFind.{fnname}()"))
}

#[tauri::command]
async fn find_clear(app: AppHandle) -> Result<(), String> {
    eval_find(&app, "window.__fbFind&&window.__fbFind.clear()")
}

// ─── ダウンロード コマンド ────────────────────────────────────────

#[tauri::command]
fn get_downloads(store: State<'_, Mutex<DownloadStore>>) -> Vec<Download> {
    lock(&store).all()
}

#[tauri::command]
fn remove_download(id: u32, store: State<'_, Mutex<DownloadStore>>) {
    lock(&store).remove(id);
}

#[tauri::command]
fn clear_downloads(store: State<'_, Mutex<DownloadStore>>) {
    lock(&store).clear();
}

/// 保存先フォルダをエクスプローラーで開き、該当ファイルを選択する。
///
/// パスは自前で決めたものだけを使い、ID 経由でしか参照させない
/// （フロントから任意のパスを渡せるようにするとコマンド実行の踏み台になる）。
#[tauri::command]
fn reveal_download(id: u32, store: State<'_, Mutex<DownloadStore>>) -> Result<(), String> {
    let item = lock(&store).find(id).ok_or("ダウンロードが見つかりません")?;
    let path = std::path::PathBuf::from(&item.path);
    if !path.exists() {
        return Err("ファイルが見つかりません（移動または削除された可能性があります）".into());
    }
    #[cfg(windows)]
    {
        // 引数は個別に渡す（シェルを経由しないため文字列連結による注入は起きない）
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        return Err("この環境では未対応です".into());
    }
    #[allow(unreachable_code)]
    Ok(())
}

// ─── WebView 位置調整 ─────────────────────────────────────────────

/// chrome（ツールバー）の高さ変化に合わせてコンテンツ WebView を押し下げる。
///
/// **async である必要がある。** Tauri v2 では同期コマンドはメインスレッドで実行され、
/// その中で `inner_size()` / `scale_factor()` を呼ぶとイベントループへの
/// ブロッキング往復になり自己デッドロックする（＝コマンドが返らず、
/// ブックマークバーや履歴パネルが永久に表示されない）。
/// async にすると別スレッドで実行されるため安全に問い合わせできる。
#[tauri::command]
async fn set_webview_top(
    y: f64,
    app: AppHandle,
    layout: State<'_, Mutex<Layout>>,
) -> Result<(), String> {
    // キャッシュ済みのサイズだけを使う（イベントループへ問い合わせない）
    let (lw, lh) = {
        let mut l = lock(&layout);
        l.toolbar_height = y;
        (l.win_w, l.win_h)
    };
    let webview = app.get_webview("browser-content").ok_or("not found")?;
    webview
        .set_position(LogicalPosition::new(0.0, y))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(lw, (lh - y).max(0.0)))
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
        .manage(Mutex::new(Layout {
            toolbar_height: BASE_TOOLBAR_HEIGHT,
            win_w: 0.0,
            win_h: 0.0,
        }))
        .manage(Mutex::new(PageCmdGate::new()))
        .manage(Mutex::new(SettingsStore::new()))
        .manage(Mutex::new(PrivateMode(false)))
        .manage(Mutex::new(DownloadStore::new()))
        .manage(Mutex::new(PopupGate(PageCmdGate::new())))
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
                lock(&state).init(data_dir);
            }

            // 履歴ストアを初期化（データディレクトリをセット＆ロード）
            {
                let data_dir = app.path().app_data_dir()?;
                let state = app.state::<Mutex<HistoryStore>>();
                lock(&state).init(data_dir);
            }

            // ダウンロード履歴を初期化
            {
                let data_dir = app.path().app_data_dir()?;
                let state = app.state::<Mutex<DownloadStore>>();
                lock(&state).init(data_dir);
            }

            // 設定を読み込む（ホーム・検索エンジン・ズームの永続化）
            let settings = {
                let data_dir = app.path().app_data_dir()?;
                let state = app.state::<Mutex<SettingsStore>>();
                let mut s = lock(&state);
                s.init(data_dir);
                s.get()
            };

            // スロットリングで保留になった履歴を定期的に書き出す。
            // これが無いと「最後の1回」がディスクに届かず、異常終了時に失われる。
            {
                let app_flush = app.handle().clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(HISTORY_SAVE_MIN_INTERVAL);
                    lock(&app_flush.state::<Mutex<HistoryStore>>()).flush();
                });
            }

            let window = app.get_window("main").ok_or("main window not found")?;
            let window_size = window.inner_size()?;
            let scale = window.scale_factor()?;
            let lw = window_size.width as f64 / scale;
            let lh = window_size.height as f64 / scale;

            // 初期サイズをキャッシュへ入れる（以後コマンド側は問い合わせ不要）
            {
                let state = app.state::<Mutex<Layout>>();
                let mut l = lock(&state);
                l.win_w = lw;
                l.win_h = lh;
            }

            // 起動時は設定のホームページを開く（sanitize 済みなので http(s) のみ）
            let start_url: url::Url = settings
                .home_url
                .parse()
                .unwrap_or_else(|_| HOME_URL.parse().expect("HOME_URL は妥当な URL"));

            let app_shortcuts = app.handle().clone();
            let app_popup = app.handle().clone();
            let app_dl = app.handle().clone();
            let content_builder =
                WebviewBuilder::new("browser-content", WebviewUrl::External(start_url))
                    .initialization_script(SHORTCUT_INIT_SCRIPT)
                    .initialization_script(PAGE_META_SCRIPT)
                    .initialization_script(FIND_SCRIPT)
                    .on_new_window(move |url, _features| {
                        // target="_blank" / window.open。単一 WebView 構成のため
                        // 実際の別ウィンドウは作らず、自前のタブとして開く。
                        if !matches!(url.scheme(), "http" | "https") {
                            log::warn!("blocked popup with unsupported scheme: {}", url);
                            return NewWindowResponse::Deny;
                        }
                        let gate = app_popup.state::<Mutex<PopupGate>>();
                        if !lock(&gate).0.allow(Instant::now()) {
                            log::warn!("popup throttled: {}", url);
                            return NewWindowResponse::Deny;
                        }
                        let target = url.to_string();
                        let snapshot = {
                            let state = app_popup.state::<Mutex<TabManager>>();
                            let mut mgr = lock(&state);
                            mgr.open_tab(target.clone());
                            mgr.snapshot()
                        };
                        let _ = navigate_webview(&app_popup, &target);
                        emit_tabs(&app_popup, &snapshot);
                        NewWindowResponse::Deny
                    })
                    .on_download(move |_wv, event| match event {
                        DownloadEvent::Requested { url, destination } => {
                            let Ok(dir) = app_dl.path().download_dir() else {
                                log::error!("download dir not available");
                                return false;
                            };
                            // WebView2 が提案するファイル名（Content-Disposition 由来）を優先する。
                            // ただしサーバー由来の値なので必ず検証してから使う。
                            let suggested = destination
                                .file_name()
                                .map(|s| sanitize_file_name(&s.to_string_lossy()))
                                .filter(|s| !s.is_empty());
                            let name = suggested.unwrap_or_else(|| file_name_from_url(&url));
                            let target = unique_path(&dir, &name);
                            let final_name = target
                                .file_name()
                                .map(|s| s.to_string_lossy().into_owned())
                                .unwrap_or_else(|| name.clone());
                            *destination = target.clone();

                            let item = lock(&app_dl.state::<Mutex<DownloadStore>>()).start(
                                url.to_string(),
                                final_name,
                                target.to_string_lossy().into_owned(),
                            );
                            let _ = app_dl.emit_to(
                                EventTarget::webview_window("main"),
                                "download-started",
                                item,
                            );
                            true
                        }
                        DownloadEvent::Finished { url, path, success } => {
                            let key = path
                                .map(|p| p.to_string_lossy().into_owned())
                                .unwrap_or_default();
                            lock(&app_dl.state::<Mutex<DownloadStore>>()).finish(&key, success);
                            log::info!("download finished: {} success={}", url, success);
                            let _ = app_dl.emit_to(
                                EventTarget::webview_window("main"),
                                "downloads-updated",
                                (),
                            );
                            true
                        }
                        _ => true,
                    })
                    .on_navigation(move |url| {
                // ページ内容は信頼できない入力。fbcmd:// / fbmeta:// はいずれも
                // 任意の Web ページが location.href で自由に発火できる点に注意。
                if url.scheme() == "fbcmd" {
                    // 実ユーザーのキー操作を装った連打（タブ・ブックマークの大量生成）を抑止
                    let gate = app_shortcuts.state::<Mutex<PageCmdGate>>();
                    let allowed = lock(&gate).allow(Instant::now());
                    if !allowed {
                        log::warn!("page-originated command throttled: {}", url);
                        return false;
                    }
                    let cmd = url.host_str().unwrap_or("").to_string();
                    let _ =
                        app_shortcuts.emit_to(EventTarget::webview_window("main"), "shortcut", cmd);
                    return false; // ナビゲーションをキャンセル
                }
                // fbmeta:// は実ページタイトル・ファビコン通知。アクティブタブと履歴の最新エントリに反映。
                if url.scheme() == "fbmeta" {
                    let mut title = String::new();
                    let mut favicon = String::new();
                    for (k, v) in url.query_pairs() {
                        match &*k {
                            "t" => title = v.into_owned(),
                            "f" => favicon = v.into_owned(),
                            _ => {}
                        }
                    }
                    // ページ由来の文字列は必ず検証・切り詰めてから内部状態に取り込む
                    let title = sanitize_title(&title);
                    let favicon_opt = sanitize_favicon(&favicon);
                    if !title.is_empty() {
                        let snapshot = {
                            let state = app_shortcuts.state::<Mutex<TabManager>>();
                            let mut mgr = lock(&state);
                            mgr.set_active_meta(title.clone(), favicon_opt.clone());
                            mgr.snapshot()
                        };
                        emit_tabs(&app_shortcuts, &snapshot);
                        // プライベートモード中は履歴へ書き戻さない
                        if !lock(&app_shortcuts.state::<Mutex<PrivateMode>>()).0 {
                            lock(&app_shortcuts.state::<Mutex<HistoryStore>>())
                                .update_latest_meta(title, favicon_opt);
                        }
                    }
                    return false; // ナビゲーションをキャンセル
                }
                // fbfind:// はページ内検索の結果件数。chrome 側の検索バーへ転送する。
                if url.scheme() == "fbfind" {
                    let mut total = 0usize;
                    let mut index = 0usize;
                    for (k, v) in url.query_pairs() {
                        match &*k {
                            "n" => total = v.parse().unwrap_or(0),
                            "i" => index = v.parse().unwrap_or(0),
                            _ => {}
                        }
                    }
                    let _ = app_shortcuts.emit_to(
                        EventTarget::webview_window("main"),
                        "find-result",
                        (total, index),
                    );
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
                            let mut mgr = lock(&state);
                            mgr.on_navigate(&url);
                            mgr.snapshot()
                        };
                        emit_tabs(app, &snapshot);
                        // プライベートモード中は訪問を記録しない
                        if !lock(&app.state::<Mutex<PrivateMode>>()).0 {
                            let state = app.state::<Mutex<HistoryStore>>();
                            lock(&state).visit(url.clone(), hostname_of(&url));
                        }
                        let _ =
                            app.emit_to(EventTarget::webview_window("main"), "url-changed", url);
                    }
                    PageLoadEvent::Finished => {
                        let snapshot = {
                            let state = app.state::<Mutex<TabManager>>();
                            let mut mgr = lock(&state);
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
                            // このハンドラはイベントループ側で動くため scale_factor() は安全
                            if let Ok(scale) = win.scale_factor() {
                                let lw = size.width as f64 / scale;
                                let lh = size.height as f64 / scale;
                                // 新しいサイズをキャッシュへ反映し、現在の chrome 高さで再配置する
                                let th = {
                                    let state = app_resize.state::<Mutex<Layout>>();
                                    let mut l = lock(&state);
                                    l.win_w = lw;
                                    l.win_h = lh;
                                    l.toolbar_height
                                };
                                let _ = wv.set_position(LogicalPosition::new(0.0, th));
                                let _ = wv.set_size(LogicalSize::new(lw, (lh - th).max(0.0)));
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
            restore_history,
            get_settings,
            save_settings,
            set_private_mode,
            set_zoom,
            find_in_page,
            find_step,
            find_clear,
            get_downloads,
            remove_download,
            clear_downloads,
            reveal_download,
            set_webview_top
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // スロットリングで保留中の履歴が終了時に失われないよう確実に書き出す
            if let tauri::RunEvent::Exit = event {
                lock(&app.state::<Mutex<HistoryStore>>()).flush();
            }
        });
}

// ─── ユニットテスト ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // --- URL ユーティリティ ---

    #[test]
    fn hostname_strips_www_and_falls_back() {
        assert_eq!(hostname_of("https://www.example.com/a/b?q=1"), "example.com");
        assert_eq!(hostname_of("https://sub.example.co.jp/"), "sub.example.co.jp");
        assert_eq!(hostname_of("not a url"), "New Tab"); // パース不能時のフォールバック
    }

    #[test]
    fn normalize_url_only_completes_scheme() {
        assert_eq!(normalize_url("example.com"), "https://example.com");
        assert_eq!(normalize_url("  example.com  "), "https://example.com");
        assert_eq!(normalize_url("http://a.test"), "http://a.test"); // 既存スキームは保持
        assert_eq!(normalize_url("file:///c:/x.html"), "file:///c:/x.html");
    }

    // --- ページ由来入力のサニタイズ ---

    #[test]
    fn sanitize_title_strips_control_chars_and_caps_length() {
        assert_eq!(sanitize_title("  Hello\n\tWorld  "), "HelloWorld");
        let long = "あ".repeat(MAX_TITLE_LEN + 500);
        assert_eq!(sanitize_title(&long).chars().count(), MAX_TITLE_LEN);
    }

    #[test]
    fn sanitize_favicon_allows_only_safe_schemes() {
        assert!(sanitize_favicon("https://a.test/f.ico").is_some());
        assert!(sanitize_favicon("http://a.test/f.ico").is_some());
        assert!(sanitize_favicon("data:image/png;base64,AAAA").is_some());
        // 危険・無意味なスキームは拒否する
        assert!(sanitize_favicon("javascript:alert(1)").is_none());
        assert!(sanitize_favicon("file:///c:/windows/system.ini").is_none());
        assert!(sanitize_favicon("data:text/html,<script>").is_none());
        assert!(sanitize_favicon("").is_none());
        // 長すぎる data URI はメモリ・保存領域の浪費になるため拒否
        let huge = format!("data:image/png;base64,{}", "A".repeat(MAX_FAVICON_URL_LEN));
        assert!(sanitize_favicon(&huge).is_none());
    }

    // --- ページ由来コマンドのレート制限 ---

    #[test]
    fn page_cmd_gate_throttles_rapid_bursts() {
        let mut gate = PageCmdGate::new();
        let t0 = Instant::now();
        assert!(gate.allow(t0), "初回は許可される");
        assert!(!gate.allow(t0), "同時刻の連打は拒否される");
        assert!(
            gate.allow(t0 + PAGE_CMD_MIN_INTERVAL),
            "十分な間隔が空けば許可される"
        );
    }

    // --- タブ管理 ---

    #[test]
    fn closing_the_last_tab_is_rejected() {
        let mut m = TabManager::new();
        assert_eq!(m.tabs.len(), 1);
        assert!(m.close_tab(1).is_none());
        assert_eq!(m.tabs.len(), 1, "最後の1枚は閉じられない");
    }

    #[test]
    fn closing_active_tab_activates_neighbor() {
        let mut m = TabManager::new();
        m.open_tab("https://a.test/".into()); // id=2
        m.open_tab("https://b.test/".into()); // id=3（アクティブ）
        assert_eq!(m.active_id, 3);
        let nav = m.close_tab(3);
        assert_eq!(nav.as_deref(), Some("https://a.test/"));
        assert_eq!(m.active_id, 2, "閉じたら隣のタブがアクティブになる");
    }

    #[test]
    fn closing_inactive_tab_keeps_active_and_does_not_navigate() {
        let mut m = TabManager::new();
        m.open_tab("https://a.test/".into()); // id=2（アクティブ）
        let nav = m.close_tab(1);
        assert!(nav.is_none(), "非アクティブを閉じても再ナビゲートしない");
        assert_eq!(m.active_id, 2);
    }

    #[test]
    fn navigating_clears_stale_favicon() {
        let mut m = TabManager::new();
        m.set_active_meta("Old".into(), Some("https://a.test/f.ico".into()));
        m.on_navigate("https://b.test/");
        let tab = &m.snapshot().tabs[0];
        assert_eq!(tab.favicon, None, "前ページのファビコンが残ってはいけない");
        assert_eq!(tab.title, "b.test");
    }

    // --- 履歴 ---

    fn history_in(dir: &std::path::Path) -> HistoryStore {
        let mut h = HistoryStore::new();
        h.init(dir.to_path_buf());
        h
    }

    #[test]
    fn repeated_visits_to_same_url_do_not_duplicate() {
        let tmp = std::env::temp_dir().join("fb_test_hist_dup");
        let _ = std::fs::remove_dir_all(&tmp);
        let mut h = history_in(&tmp);
        h.visit("https://a.test/".into(), "A".into());
        h.visit("https://a.test/".into(), "A".into());
        h.visit("https://b.test/".into(), "B".into());
        assert_eq!(h.all().len(), 2, "連続する同一 URL はまとめられる");
        assert_eq!(h.all()[0].url, "https://b.test/");
    }

    #[test]
    fn history_is_capped_to_max_entries() {
        let tmp = std::env::temp_dir().join("fb_test_hist_cap");
        let _ = std::fs::remove_dir_all(&tmp);
        let mut h = history_in(&tmp);
        for i in 0..(MAX_HISTORY_ENTRIES + 50) {
            h.visit(format!("https://a.test/{}", i), "x".into());
        }
        assert_eq!(h.all().len(), MAX_HISTORY_ENTRIES);
    }

    #[test]
    fn update_latest_meta_is_noop_when_unchanged() {
        let tmp = std::env::temp_dir().join("fb_test_hist_meta");
        let _ = std::fs::remove_dir_all(&tmp);
        let mut h = history_in(&tmp);
        h.visit("https://a.test/".into(), "a.test".into());
        h.flush();
        h.update_latest_meta("Title".into(), None);
        assert!(h.dirty || h.last_saved.is_some());
        h.flush();
        assert!(!h.dirty);
        // 同じ値での再更新は dirty を立てない
        h.update_latest_meta("Title".into(), None);
        assert!(!h.dirty, "内容が同じなら再保存しない");
    }

    #[test]
    fn history_survives_reload_from_disk() {
        let tmp = std::env::temp_dir().join("fb_test_hist_persist");
        let _ = std::fs::remove_dir_all(&tmp);
        {
            let mut h = history_in(&tmp);
            h.visit("https://a.test/".into(), "A".into());
            h.flush();
        }
        let reloaded = history_in(&tmp);
        assert_eq!(reloaded.all().len(), 1);
        assert_eq!(reloaded.all()[0].url, "https://a.test/");
        assert_eq!(reloaded.next_id, 2, "id 採番が重複しないよう復元される");
    }

    // --- ダウンロードのファイル名 ---

    fn fname(u: &str) -> String {
        file_name_from_url(&url::Url::parse(u).unwrap())
    }

    #[test]
    fn download_name_uses_last_path_segment() {
        assert_eq!(fname("https://a.test/files/report.pdf"), "report.pdf");
        assert_eq!(fname("https://a.test/a/b/c.zip?x=1#f"), "c.zip");
        assert_eq!(fname("https://a.test/files/"), "files");
    }

    #[test]
    fn download_name_decodes_percent_escapes() {
        assert_eq!(fname("https://a.test/%E8%B3%87%E6%96%99.pdf"), "資料.pdf");
        assert_eq!(fname("https://a.test/my%20file.txt"), "my file.txt");
    }

    #[test]
    fn download_name_blocks_path_traversal() {
        // %2F / %5C はデコードするとパス区切りになる。保存先の外へ出られてはいけない。
        for u in [
            "https://a.test/..%2F..%2Fwindows%2Fsystem32%2Fevil.exe",
            "https://a.test/..%5C..%5Cevil.exe",
        ] {
            let n = fname(u);
            assert!(!n.contains('/'), "{n} にスラッシュが残っている");
            assert!(!n.contains('\\'), "{n} に円記号が残っている");
            assert!(!n.starts_with('.'), "{n} が . で始まっている");
        }
    }

    #[test]
    fn download_name_strips_windows_reserved_chars_and_falls_back() {
        assert_eq!(fname("https://a.test/a%3Ab%2Ac%3Fd.txt"), "abcd.txt");
        assert_eq!(fname("https://a.test/"), "download");
        assert_eq!(fname("https://a.test/..."), "download");
    }

    #[test]
    fn sanitize_file_name_blocks_traversal_from_content_disposition() {
        // Content-Disposition のファイル名はサーバー由来。保存先の外に出せてはいけない。
        assert_eq!(sanitize_file_name("../../evil.exe"), "evil.exe");
        assert_eq!(sanitize_file_name("..\\..\\evil.exe"), "evil.exe");
        assert_eq!(sanitize_file_name("C:\\Windows\\system.ini"), "CWindowssystem.ini");
        assert_eq!(sanitize_file_name("  ..  "), "");
        assert_eq!(sanitize_file_name("ok.txt"), "ok.txt");
    }

    #[test]
    fn download_name_is_length_capped() {
        let long = "x".repeat(400);
        assert!(fname(&format!("https://a.test/{long}")).chars().count() <= 150);
    }

    #[test]
    fn unique_path_avoids_overwriting_existing_files() {
        let dir = std::env::temp_dir().join("fb_test_dl");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let first = unique_path(&dir, "a.txt");
        assert_eq!(first.file_name().unwrap(), "a.txt");
        std::fs::write(&first, b"x").unwrap();

        let second = unique_path(&dir, "a.txt");
        assert_eq!(second.file_name().unwrap(), "a (1).txt", "既存ファイルは上書きしない");
        std::fs::write(&second, b"x").unwrap();

        let third = unique_path(&dir, "a.txt");
        assert_eq!(third.file_name().unwrap(), "a (2).txt");

        // 拡張子が無い場合も連番が付く
        let noext = unique_path(&dir, "b");
        std::fs::write(&noext, b"x").unwrap();
        assert_eq!(unique_path(&dir, "b").file_name().unwrap(), "b (1)");
    }

    // --- 設定 ---

    #[test]
    fn settings_sanitize_rejects_unsafe_home_url() {
        let mut s = Settings {
            home_url: "javascript:alert(1)".into(),
            engine_id: "google".into(),
            zoom: 1.0,
        };
        s.sanitize();
        assert_eq!(s.home_url, HOME_URL, "危険なスキームは既定値へ戻す");

        let mut s2 = Settings {
            home_url: "file:///c:/secret.txt".into(),
            ..Settings::default()
        };
        s2.sanitize();
        assert_eq!(s2.home_url, HOME_URL);

        let mut ok = Settings {
            home_url: "https://example.test/start".into(),
            ..Settings::default()
        };
        ok.sanitize();
        assert_eq!(ok.home_url, "https://example.test/start", "http(s) は保持する");
    }

    #[test]
    fn settings_sanitize_clamps_zoom() {
        for bad in [0.0, -3.0, 99.0, f64::NAN, f64::INFINITY] {
            let mut s = Settings {
                zoom: bad,
                ..Settings::default()
            };
            s.sanitize();
            assert_eq!(s.zoom, 1.0, "範囲外の倍率 {bad} は 1.0 に戻す");
        }
        let mut ok = Settings {
            zoom: 1.5,
            ..Settings::default()
        };
        ok.sanitize();
        assert_eq!(ok.zoom, 1.5);
    }

    #[test]
    fn settings_roundtrip_through_disk() {
        let tmp = std::env::temp_dir().join("fb_test_settings");
        let _ = std::fs::remove_dir_all(&tmp);
        {
            let mut s = SettingsStore::new();
            s.init(tmp.clone());
            s.replace(Settings {
                home_url: "https://a.test/".into(),
                engine_id: "ddg".into(),
                zoom: 1.25,
            });
        }
        let mut reloaded = SettingsStore::new();
        reloaded.init(tmp.clone());
        let got = reloaded.get();
        assert_eq!(got.home_url, "https://a.test/");
        assert_eq!(got.engine_id, "ddg");
        assert_eq!(got.zoom, 1.25);
    }

    // --- ブックマーク ---

    #[test]
    fn bookmarks_roundtrip_through_disk() {
        let tmp = std::env::temp_dir().join("fb_test_bm");
        let _ = std::fs::remove_dir_all(&tmp);
        let created = {
            let mut b = BookmarkStore::new();
            b.init(tmp.clone());
            b.add("https://a.test/".into(), "A".into())
        };
        let mut reloaded = BookmarkStore::new();
        reloaded.init(tmp.clone());
        assert_eq!(reloaded.all().len(), 1);
        assert!(reloaded.find_by_url("https://a.test/").is_some());
        reloaded.remove(created.id);
        assert!(reloaded.all().is_empty());
    }
}
