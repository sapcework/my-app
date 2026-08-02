import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './App.css';

// ── 定数 ──────────────────────────────────────────────────────────

const HOME = 'https://www.google.com';
const BASE_HEIGHT = 86;         // タブバー + ナビバー
const BM_BAR_HEIGHT = 32;       // ブックマークバー
const HISTORY_PANEL_HEIGHT = 320; // 履歴パネル

// ── 型定義 ────────────────────────────────────────────────────────

interface Tab {
  id: number;
  url: string;
  title: string;
  is_loading: boolean;
}

interface TabsState {
  tabs: Tab[];
  active_id: number;
}

interface Bookmark {
  id: number;
  url: string;
  title: string;
  created_at: number;
}

interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  visited_at: number;
}

const ENGINES = [
  { id: 'google',     label: 'G',   name: 'Google',     searchUrl: 'https://www.google.com/search?q='  },
  { id: 'ddg',        label: 'DDG', name: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q='        },
  { id: 'bing',       label: 'B',   name: 'Bing',       searchUrl: 'https://www.bing.com/search?q='   },
] as const;
type EngineId = typeof ENGINES[number]['id'];

// ── ユーティリティ ────────────────────────────────────────────────

function normalizeUrl(raw: string, engineId: EngineId): string {
  const s = raw.trim();
  if (!s) return HOME;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s;
  if (!s.includes('.') || s.includes(' ')) {
    const engine = ENGINES.find(e => e.id === engineId)!;
    return engine.searchUrl + encodeURIComponent(s);
  }
  return `https://${s}`;
}

function shortUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function isSecure(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('file://');
}

function formatTime(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

// ── コンポーネント ────────────────────────────────────────────────

export default function App() {
  const [tabs, setTabs]         = useState<Tab[]>([{ id: 1, url: HOME, title: 'New Tab', is_loading: true }]);
  const [activeId, setActiveId] = useState(1);
  const [address, setAddress]   = useState(HOME);
  const [focused, setFocused]   = useState(false);
  const [engine, setEngine]     = useState<EngineId>('google');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showBmBar, setShowBmBar] = useState(false);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const isFocused      = useRef(false);
  const addressBarRef  = useRef<HTMLInputElement>(null);

  const activeTab   = tabs.find(t => t.id === activeId);
  const currentBm   = bookmarks.find(b => b.url === address);
  const totalHeight = BASE_HEIGHT
    + (showBmBar ? BM_BAR_HEIGHT : 0)
    + (showHistory ? HISTORY_PANEL_HEIGHT : 0);

  // ── 初期化 ────────────────────────────────────────────────────

  useEffect(() => {
    invoke<TabsState>('get_tabs').then(s => { setTabs(s.tabs); setActiveId(s.active_id); });
    invoke<Bookmark[]>('get_bookmarks').then(setBookmarks);
  }, []);

  // ── イベントリスニング ─────────────────────────────────────────

  useEffect(() => {
    const u1 = listen<TabsState>('tabs-updated', e => {
      setTabs(e.payload.tabs);
      setActiveId(e.payload.active_id);
      if (!isFocused.current) {
        const active = e.payload.tabs.find(t => t.id === e.payload.active_id);
        if (active) setAddress(active.url);
      }
    });
    const u2 = listen<string>('url-changed', e => {
      if (!isFocused.current) setAddress(e.payload);
    });
    return () => { u1.then(f => f()); u2.then(f => f()); };
  }, []);

  // ── キーボードショートカット（Tauri イベント + ローカル） ─────────

  useEffect(() => {
    const handle = async (cmd: string) => {
      switch (cmd) {
        case 'new-tab':
          invoke('new_tab', { url: HOME }).catch(console.error);
          break;
        case 'close-tab':
          invoke('close_tab', { id: activeId }).catch(console.error);
          break;
        case 'focus-address':
          isFocused.current = true;
          setFocused(true);
          addressBarRef.current?.focus();
          addressBarRef.current?.select();
          break;
        case 'reload':
          invoke('reload').catch(console.error);
          break;
        case 'bookmark': {
          const bm = bookmarks.find(b => b.url === address);
          if (bm) {
            invoke('remove_bookmark', { id: bm.id }).catch(console.error);
            setBookmarks(prev => prev.filter(b => b.id !== bm.id));
          } else {
            const title = activeTab?.title || shortUrl(address);
            const added = await invoke<Bookmark>('add_bookmark', { url: address, title }).catch(console.error);
            if (added) setBookmarks(prev => [...prev, added]);
          }
          break;
        }
        case 'toggle-history':
          toggleHistory();
          break;
      }
    };

    // コンテンツ WebView からの fbcmd イベント
    const tauriUnlisten = listen<string>('shortcut', e => handle(e.payload));

    // ツールバーがフォーカスされているときのローカルショートカット
    const localHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 't')      { e.preventDefault(); handle('new-tab'); }
        else if (k === 'w') { e.preventDefault(); handle('close-tab'); }
        else if (k === 'l') { e.preventDefault(); handle('focus-address'); }
        else if (k === 'r') { e.preventDefault(); handle('reload'); }
        else if (k === 'd') { e.preventDefault(); handle('bookmark'); }
        else if (k === 'h') { e.preventDefault(); handle('toggle-history'); }
      }
      if (!e.ctrlKey && e.key === 'F5') { e.preventDefault(); handle('reload'); }
    };
    document.addEventListener('keydown', localHandler);

    return () => {
      tauriUnlisten.then(f => f());
      document.removeEventListener('keydown', localHandler);
    };
  }, [activeId, address, activeTab, bookmarks, showHistory]);

  // ── ブックマークバー開閉で WebView を再配置 ────────────────────

  useEffect(() => {
    document.body.style.height = `${totalHeight}px`;
    invoke('set_webview_top', { y: totalHeight }).catch(console.error);
  }, [totalHeight]);

  // ── ナビゲーション ────────────────────────────────────────────

  async function navigateTo(raw: string) {
    const url = normalizeUrl(raw, engine);
    setAddress(url);
    await invoke('navigate', { url }).catch(console.error);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      isFocused.current = false; setFocused(false);
      e.currentTarget.blur();
      navigateTo(address);
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  }

  // ── タブ操作 ──────────────────────────────────────────────────

  async function handleCloseTab(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await invoke('close_tab', { id }).catch(console.error);
  }

  async function handleSwitchTab(id: number) {
    if (id !== activeId) await invoke('switch_tab', { id }).catch(console.error);
  }

  // ── ブックマーク操作 ──────────────────────────────────────────

  async function toggleBookmark() {
    if (currentBm) {
      await invoke('remove_bookmark', { id: currentBm.id }).catch(console.error);
      setBookmarks(prev => prev.filter(b => b.id !== currentBm.id));
    } else {
      const title = activeTab?.title || shortUrl(address);
      const bm = await invoke<Bookmark>('add_bookmark', { url: address, title }).catch(console.error);
      if (bm) setBookmarks(prev => [...prev, bm]);
    }
  }

  async function removeBookmark(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await invoke('remove_bookmark', { id }).catch(console.error);
    setBookmarks(prev => prev.filter(b => b.id !== id));
  }

  // ── 履歴操作 ──────────────────────────────────────────────────

  async function toggleHistory() {
    if (!showHistory) {
      const h = await invoke<HistoryEntry[]>('get_history').catch(() => []);
      setHistory(h);
    }
    setShowHistory(v => !v);
  }

  async function removeHistoryEntry(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await invoke('remove_history_entry', { id }).catch(console.error);
    setHistory(prev => prev.filter(h => h.id !== id));
  }

  async function clearHistory() {
    await invoke('clear_history').catch(console.error);
    setHistory([]);
  }

  // ── レンダリング ──────────────────────────────────────────────

  return (
    <div id="browser-chrome" style={{ height: totalHeight }} data-tauri-drag-region>

      {/* ── タブバー ──────────────────────────────────── */}
      <div id="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab${tab.id === activeId ? ' active' : ''}`}
            onClick={() => handleSwitchTab(tab.id)}
            title={tab.url}
          >
            {tab.is_loading && <span className="tab-spinner" />}
            <span className="tab-title">{tab.title || 'New Tab'}</span>
            {tabs.length > 1 && (
              <button className="tab-close" onClick={e => handleCloseTab(tab.id, e)}>×</button>
            )}
          </div>
        ))}
        <button className="new-tab-btn" onClick={() => invoke('new_tab', { url: HOME }).catch(console.error)} title="新しいタブ">
          +
        </button>
      </div>

      {/* ── ナビゲーションバー ──────────────────────────── */}
      <div id="nav-bar">
        <button onClick={() => invoke('go_back').catch(console.error)}    title="戻る">&#8249;</button>
        <button onClick={() => invoke('go_forward').catch(console.error)} title="進む">&#8250;</button>
        <button onClick={() => invoke('reload').catch(console.error)}     title="更新">&#8635;</button>

        <div id="address-wrapper" className={focused ? 'focused' : ''}>
          <span id="secure-icon" title={isSecure(address) ? '安全な接続' : '安全でない接続'}>
            {isSecure(address) ? '🔒' : '⚠️'}
          </span>
          <input
            id="address-bar"
            ref={addressBarRef}
            type="text"
            value={focused ? address : shortUrl(address)}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={e => { isFocused.current = true; setFocused(true); e.currentTarget.select(); }}
            onBlur={() => { isFocused.current = false; setFocused(false); }}
            spellCheck={false}
            autoComplete="off"
            placeholder="URL またはキーワードを入力"
          />
          {/* ★ ブックマーク追加/削除 */}
          <button
            id="bm-star"
            className={currentBm ? 'active' : ''}
            onClick={toggleBookmark}
            title={currentBm ? 'ブックマークを削除' : 'ブックマークに追加'}
          >
            {currentBm ? '★' : '☆'}
          </button>
        </div>

        {/* ブックマークバー トグル */}
        <button
          id="bm-toggle"
          className={showBmBar ? 'active' : ''}
          onClick={() => setShowBmBar(v => !v)}
          title="ブックマークバー"
        >
          ⊞
        </button>

        {/* 履歴パネル トグル */}
        <button
          id="history-toggle"
          className={showHistory ? 'active' : ''}
          onClick={toggleHistory}
          title="履歴"
        >
          🕘
        </button>

        <select
          id="engine-select"
          value={engine}
          onChange={e => setEngine(e.target.value as EngineId)}
          title="検索エンジン"
        >
          {ENGINES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <button onClick={() => navigateTo(address)} title="移動">&#10140;</button>
      </div>

      {/* ── ブックマークバー ──────────────────────────── */}
      {showBmBar && (
        <div id="bm-bar">
          {bookmarks.length === 0
            ? <span className="bm-empty">ブックマークがありません — ☆ で追加できます</span>
            : bookmarks.map(bm => (
                <div key={bm.id} className="bm-chip" onClick={() => navigateTo(bm.url)} title={bm.url}>
                  <span className="bm-chip-title">{bm.title || shortUrl(bm.url)}</span>
                  <button className="bm-chip-del" onClick={e => removeBookmark(bm.id, e)} title="削除">×</button>
                </div>
              ))
          }
        </div>
      )}

      {/* ── 履歴パネル ──────────────────────────────── */}
      {showHistory && (
        <div id="history-panel">
          <div id="history-panel-header">
            <span>履歴</span>
            <button id="history-clear" onClick={clearHistory}>すべて削除</button>
          </div>
          <div id="history-list">
            {history.length === 0
              ? <div className="history-empty">履歴がありません</div>
              : history.map(h => (
                  <div
                    key={h.id}
                    className="history-item"
                    onClick={() => { navigateTo(h.url); setShowHistory(false); }}
                    title={h.url}
                  >
                    <span className="history-item-title">{h.title || shortUrl(h.url)}</span>
                    <span className="history-item-time">{formatTime(h.visited_at)}</span>
                    <button className="history-item-del" onClick={e => removeHistoryEntry(h.id, e)} title="削除">×</button>
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* ローディングバー */}
      {activeTab?.is_loading && <div id="loading-bar" />}

    </div>
  );
}
