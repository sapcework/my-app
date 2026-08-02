import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';

import type { Tab, TabsState, Bookmark, HistoryEntry } from './types';
import { HOME, type EngineId, normalizeUrl, shortUrl, sameUrl } from './lib/url';
import { useToasts, FAILED } from './hooks/useToasts';
import { TabBar } from './components/TabBar';
import { NavBar } from './components/NavBar';
import { BookmarkBar } from './components/BookmarkBar';
import { HistoryPanel } from './components/HistoryPanel';
import { Toasts } from './components/Toasts';

// chrome（ツールバー）領域の各段の高さ。
// コンテンツ WebView は OS ネイティブの子ビューとして下に並ぶため、
// パネルを開くぶんだけ chrome を高くし、WebView を押し下げる必要がある。
const BASE_HEIGHT = 88;
const BM_BAR_HEIGHT = 34;
const HISTORY_PANEL_HEIGHT = 360;
// 通知はコンテンツ WebView（OS ネイティブの子ビュー）に隠れてしまうため、
// 重ねて表示することができない。表示中はその分だけ chrome の高さを確保する。
const TOAST_ROW_HEIGHT = 46;
const MAX_VISIBLE_TOASTS = 3;

const INITIAL_TAB: Tab = { id: 1, url: HOME, title: '新しいタブ', is_loading: true, favicon: null };

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([INITIAL_TAB]);
  const [activeId, setActiveId] = useState(1);
  const [address, setAddress] = useState(HOME);
  const [focused, setFocused] = useState(false);
  const [engine, setEngine] = useState<EngineId>('google');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showBmBar, setShowBmBar] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');

  const { toasts, push, dismiss, run } = useToasts();

  // アドレスバー編集中はページ側の URL 更新で入力を上書きしない
  const isEditing = useRef(false);
  const addressBarRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeId);
  const currentBm = bookmarks.find((b) => sameUrl(b.url, address));
  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS);
  const totalHeight =
    BASE_HEIGHT +
    (showBmBar ? BM_BAR_HEIGHT : 0) +
    (showHistory ? HISTORY_PANEL_HEIGHT : 0) +
    visibleToasts.length * TOAST_ROW_HEIGHT;

  // ── 初期ロード ──────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      const s = await run<TabsState>('get_tabs');
      if (s !== FAILED) {
        setTabs(s.tabs);
        setActiveId(s.active_id);
      }
      const bms = await run<Bookmark[]>('get_bookmarks');
      if (bms !== FAILED) setBookmarks(bms);
    })();
  }, [run]);

  // ── Rust からの状態同期 ─────────────────────────────────────

  useEffect(() => {
    const subs = [
      listen<TabsState>('tabs-updated', (e) => {
        setTabs(e.payload.tabs);
        setActiveId(e.payload.active_id);
        if (!isEditing.current) {
          const active = e.payload.tabs.find((t) => t.id === e.payload.active_id);
          if (active) setAddress(active.url);
        }
      }),
      listen<string>('url-changed', (e) => {
        if (!isEditing.current) setAddress(e.payload);
      }),
    ];
    return () => {
      subs.forEach((p) => void p.then((off) => off()));
    };
  }, []);

  // ── 操作ハンドラ ────────────────────────────────────────────

  const navigateTo = useCallback(
    async (raw: string) => {
      const url = normalizeUrl(raw, engine);
      setAddress(url);
      await run('navigate', { url });
    },
    [engine, run],
  );

  const focusAddressBar = useCallback(() => {
    isEditing.current = true;
    setFocused(true);
  }, []);

  // 表示モードから入力モードへ切り替わった直後に実フォーカスを移す
  useLayoutEffect(() => {
    if (focused) {
      addressBarRef.current?.focus();
      addressBarRef.current?.select();
    }
  }, [focused]);

  const loadHistory = useCallback(async () => {
    const h = await run<HistoryEntry[]>('get_history');
    if (h !== FAILED) setHistory(h);
  }, [run]);

  const toggleHistory = useCallback(async () => {
    if (!showHistory) await loadHistory();
    else setHistoryQuery('');
    setShowHistory((v) => !v);
  }, [showHistory, loadHistory]);

  const toggleBookmark = useCallback(async () => {
    if (currentBm) {
      const ok = await run<void>('remove_bookmark', { id: currentBm.id });
      if (ok !== FAILED) {
        setBookmarks((prev) => prev.filter((b) => b.id !== currentBm.id));
        push('info', 'ブックマークを解除しました', {
          label: '元に戻す',
          run: () => {
            void (async () => {
              const bm = await run<Bookmark>('add_bookmark', {
                url: currentBm.url,
                title: currentBm.title,
              });
              if (bm !== FAILED) setBookmarks((prev) => [...prev, bm]);
            })();
          },
        });
      }
    } else {
      const title = activeTab?.title || shortUrl(address);
      const bm = await run<Bookmark>('add_bookmark', { url: address, title });
      if (bm !== FAILED) {
        setBookmarks((prev) => [...prev, bm]);
        push('success', `「${title}」をブックマークに追加しました`);
      }
    }
  }, [currentBm, activeTab, address, run, push]);

  const removeBookmark = useCallback(
    async (bm: Bookmark) => {
      const ok = await run<void>('remove_bookmark', { id: bm.id });
      if (ok === FAILED) return;
      setBookmarks((prev) => prev.filter((b) => b.id !== bm.id));
      push('info', `「${bm.title || shortUrl(bm.url)}」を削除しました`, {
        label: '元に戻す',
        run: () => {
          void (async () => {
            const re = await run<Bookmark>('add_bookmark', { url: bm.url, title: bm.title });
            if (re !== FAILED) setBookmarks((prev) => [...prev, re]);
          })();
        },
      });
    },
    [run, push],
  );

  const removeHistoryEntry = useCallback(
    async (entry: HistoryEntry) => {
      const removed = await run<HistoryEntry | null>('remove_history_entry', { id: entry.id });
      if (removed === FAILED) return;
      setHistory((prev) => prev.filter((h) => h.id !== entry.id));
      push('info', '履歴を1件削除しました', {
        label: '元に戻す',
        run: () => {
          void (async () => {
            await run('restore_history', { entries: [entry] });
            await loadHistory();
          })();
        },
      });
    },
    [run, push, loadHistory],
  );

  const clearHistory = useCallback(async () => {
    // 確認ダイアログの代わりに取り消し可能にする（操作を止めずに誤操作を救う）
    const removed = await run<HistoryEntry[]>('clear_history');
    if (removed === FAILED) return;
    setHistory([]);
    push('info', `履歴 ${removed.length} 件をすべて削除しました`, {
      label: '元に戻す',
      run: () => {
        void (async () => {
          await run('restore_history', { entries: removed });
          await loadHistory();
        })();
      },
    });
  }, [run, push, loadHistory]);

  // ── キーボードショートカット ────────────────────────────────
  //
  // ハンドラを ref 経由で呼ぶことで、リスナーの購読は初回マウント時の 1 回だけにする。
  // （以前は address などを依存配列に入れており、1 文字入力するたびに
  //   Tauri イベントの購読と解除が走っていた）

  const handleCommand = useCallback(
    (cmd: string) => {
      switch (cmd) {
        case 'new-tab':
          void run('new_tab', { url: HOME });
          break;
        case 'close-tab':
          if (tabs.length <= 1) {
            push('info', '最後のタブは閉じられません');
            return;
          }
          void run('close_tab', { id: activeId });
          break;
        case 'focus-address':
          focusAddressBar();
          break;
        case 'reload':
          void run('reload');
          break;
        case 'bookmark':
          void toggleBookmark();
          break;
        case 'toggle-history':
          void toggleHistory();
          break;
      }
    },
    [tabs.length, activeId, run, push, focusAddressBar, toggleBookmark, toggleHistory],
  );

  // 最新のハンドラを ref に保持する（購読側の依存配列を空に保つため）
  const commandRef = useRef(handleCommand);
  useEffect(() => {
    commandRef.current = handleCommand;
  }, [handleCommand]);

  useEffect(() => {
    const dispatch = (cmd: string) => commandRef.current(cmd);

    // コンテンツ WebView 側（fbcmd://）から届くショートカット
    const unlisten = listen<string>('shortcut', (e) => dispatch(e.payload));

    // chrome 側にフォーカスがあるときのショートカット
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        const map: Record<string, string> = {
          t: 'new-tab',
          w: 'close-tab',
          l: 'focus-address',
          r: 'reload',
          d: 'bookmark',
          h: 'toggle-history',
        };
        const cmd = map[e.key.toLowerCase()];
        if (cmd) {
          e.preventDefault();
          dispatch(cmd);
          return;
        }
      }
      if (!e.ctrlKey && e.key === 'F5') {
        e.preventDefault();
        dispatch('reload');
      }
      // Escape で開いているパネルを閉じる（一般的な期待どおりの挙動）
      if (e.key === 'Escape') {
        setShowHistory((v) => (v ? false : v));
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      void unlisten.then((off) => off());
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // ── chrome の高さ変化を WebView 位置へ反映 ──────────────────

  useEffect(() => {
    document.body.style.height = `${totalHeight}px`;
    void run('set_webview_top', { y: totalHeight });
  }, [totalHeight, run]);

  // ── 描画 ────────────────────────────────────────────────────

  return (
    <div id="browser-chrome" style={{ height: totalHeight }}>
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSwitch={(id) => {
          if (id !== activeId) void run('switch_tab', { id });
        }}
        onClose={(id) => void run('close_tab', { id })}
        onNew={() => void run('new_tab', { url: HOME })}
      />

      <NavBar
        ref={addressBarRef}
        address={address}
        focused={focused}
        bookmarked={!!currentBm}
        engine={engine}
        showBmBar={showBmBar}
        showHistory={showHistory}
        canGoBack
        onAddressChange={setAddress}
        onSubmit={() => {
          isEditing.current = false;
          setFocused(false);
          void navigateTo(address);
        }}
        onRequestFocus={focusAddressBar}
        onBlur={() => {
          isEditing.current = false;
          setFocused(false);
        }}
        onBack={() => void run('go_back')}
        onForward={() => void run('go_forward')}
        onReload={() => void run('reload')}
        onToggleBookmark={() => void toggleBookmark()}
        onToggleBmBar={() => setShowBmBar((v) => !v)}
        onToggleHistory={() => void toggleHistory()}
        onEngineChange={setEngine}
      />

      {showBmBar && (
        <BookmarkBar
          bookmarks={bookmarks}
          onOpen={(url) => void navigateTo(url)}
          onRemove={(bm) => void removeBookmark(bm)}
        />
      )}

      {showHistory && (
        <HistoryPanel
          entries={history}
          query={historyQuery}
          onQueryChange={setHistoryQuery}
          onOpen={(url) => {
            void navigateTo(url);
            setShowHistory(false);
            setHistoryQuery('');
          }}
          onRemove={(e) => void removeHistoryEntry(e)}
          onClearAll={() => void clearHistory()}
          onClose={() => {
            setShowHistory(false);
            setHistoryQuery('');
          }}
        />
      )}

      {activeTab?.is_loading && <div id="loading-bar" role="progressbar" aria-label="ページを読み込み中" />}

      <Toasts toasts={visibleToasts} onDismiss={dismiss} />
    </div>
  );
}
