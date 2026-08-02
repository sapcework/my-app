import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';

import type { Tab, TabsState, Bookmark, HistoryEntry, Settings } from './types';
import { HOME, type EngineId, normalizeUrl, shortUrl, sameUrl } from './lib/url';
import { useToasts, FAILED } from './hooks/useToasts';
import { TabBar } from './components/TabBar';
import { NavBar } from './components/NavBar';
import { BookmarkBar } from './components/BookmarkBar';
import { HistoryPanel } from './components/HistoryPanel';
import { AppMenu } from './components/AppMenu';
import { FindBar } from './components/FindBar';
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
const MENU_HEIGHT = 348; // App.css の #app-menu の height と一致させること
const FIND_BAR_HEIGHT = 40;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

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
  const [showMenu, setShowMenu] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState({ total: 0, index: 0 });
  const [zoom, setZoom] = useState(1);
  const [privateMode, setPrivateMode] = useState(false);
  const [homeUrl, setHomeUrl] = useState(HOME);

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
    (showFind ? FIND_BAR_HEIGHT : 0) +
    (showMenu ? MENU_HEIGHT : 0) +
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
      const cfg = await run<Settings>('get_settings');
      if (cfg !== FAILED) {
        setHomeUrl(cfg.home_url);
        setEngine(cfg.engine_id as EngineId);
        setZoom(cfg.zoom);
        // 保存済みのズームを起動時のページへ適用する
        if (cfg.zoom !== 1) void run('set_zoom', { factor: cfg.zoom });
      }
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

  // ── 設定・ズーム・プライベートモード ────────────────────────

  const persistSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next: Settings = {
        home_url: patch.home_url ?? homeUrl,
        engine_id: patch.engine_id ?? engine,
        zoom: patch.zoom ?? zoom,
      };
      const saved = await run<Settings>('save_settings', { settings: next });
      if (saved === FAILED) return null;
      // Rust 側で不正値が補正されるため、返ってきた値を正とする
      setHomeUrl(saved.home_url);
      setEngine(saved.engine_id as EngineId);
      return saved;
    },
    [homeUrl, engine, zoom, run],
  );

  const applyZoom = useCallback(
    async (factor: number) => {
      const applied = await run<number>('set_zoom', { factor });
      if (applied !== FAILED) setZoom(applied);
    },
    [run],
  );

  const stepZoom = useCallback(
    (dir: 1 | -1) => {
      const i = ZOOM_STEPS.findIndex((z) => Math.abs(z - zoom) < 0.001);
      const base = i >= 0 ? i : ZOOM_STEPS.indexOf(1);
      const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, base + dir))];
      void applyZoom(next);
    },
    [zoom, applyZoom],
  );

  const togglePrivate = useCallback(async () => {
    const next = !privateMode;
    const ok = await run<void>('set_private_mode', { on: next });
    if (ok === FAILED) return;
    setPrivateMode(next);
    push(
      'info',
      next
        ? 'プライベートモードをオンにしました。以降の閲覧は履歴に残りません。'
        : 'プライベートモードをオフにしました。閲覧履歴の記録を再開します。',
    );
  }, [privateMode, run, push]);

  const saveHome = useCallback(
    async (url: string) => {
      const saved = await persistSettings({ home_url: url });
      if (!saved) return;
      if (saved.home_url !== url) {
        push('error', 'ホームページには http:// または https:// の URL を指定してください。');
      } else {
        push('success', 'ホームページを保存しました');
      }
    },
    [persistSettings, push],
  );

  // ── ページ内検索 ────────────────────────────────────────────

  const closeFind = useCallback(() => {
    setShowFind(false);
    setFindQuery('');
    setFindResult({ total: 0, index: 0 });
    void run('find_clear');
  }, [run]);

  // 入力のたびに全文走査すると重いので、少し待ってから検索する
  useEffect(() => {
    if (!showFind) return;
    const t = setTimeout(() => void run('find_in_page', { query: findQuery }), 180);
    return () => clearTimeout(t);
  }, [findQuery, showFind, run]);

  useEffect(() => {
    const sub = listen<[number, number]>('find-result', (e) => {
      setFindResult({ total: e.payload[0], index: e.payload[1] });
    });
    return () => void sub.then((off) => off());
  }, []);

  // ── キーボードショートカット ────────────────────────────────
  //
  // ハンドラを ref 経由で呼ぶことで、リスナーの購読は初回マウント時の 1 回だけにする。
  // （以前は address などを依存配列に入れており、1 文字入力するたびに
  //   Tauri イベントの購読と解除が走っていた）

  const handleCommand = useCallback(
    (cmd: string) => {
      switch (cmd) {
        case 'new-tab':
          void run('new_tab', { url: homeUrl });
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
        case 'find':
          setShowMenu(false);
          setShowFind(true);
          break;
        case 'zoom-in':
          stepZoom(1);
          break;
        case 'zoom-out':
          stepZoom(-1);
          break;
        case 'zoom-reset':
          void applyZoom(1);
          break;
        case 'escape':
          // コンテンツ側で Esc が押された。開いているものを1つ閉じる。
          if (showFind) closeFind();
          else if (showMenu) setShowMenu(false);
          else if (showHistory) setShowHistory(false);
          break;
      }
    },
    [
      tabs.length,
      activeId,
      homeUrl,
      run,
      push,
      focusAddressBar,
      toggleBookmark,
      toggleHistory,
      stepZoom,
      applyZoom,
      showFind,
      showMenu,
      showHistory,
      closeFind,
    ],
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
          f: 'find',
        };
        const cmd = map[e.key.toLowerCase()];
        if (cmd) {
          e.preventDefault();
          dispatch(cmd);
          return;
        }
        // ズームは配列レイアウトによって記号が変わるため個別に拾う
        if (e.key === '+' || e.key === '=' || e.key === ';') {
          e.preventDefault();
          dispatch('zoom-in');
          return;
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          dispatch('zoom-out');
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          dispatch('zoom-reset');
          return;
        }
      }
      if (!e.ctrlKey && e.key === 'F5') {
        e.preventDefault();
        dispatch('reload');
      }
      // Escape で開いているものを1つ閉じる（一般的な期待どおりの挙動）
      if (e.key === 'Escape') {
        dispatch('escape');
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
        onNew={() => void run('new_tab', { url: homeUrl })}
      />

      <NavBar
        ref={addressBarRef}
        address={address}
        focused={focused}
        bookmarked={!!currentBm}
        engine={engine}
        showMenu={showMenu}
        showHistory={showHistory}
        privateMode={privateMode}
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
        onToggleMenu={() => setShowMenu((v) => !v)}
        onToggleHistory={() => void toggleHistory()}
        onEngineChange={(id) => {
          setEngine(id);
          void persistSettings({ engine_id: id });
        }}
      />

      {showFind && (
        <FindBar
          query={findQuery}
          total={findResult.total}
          index={findResult.index}
          onQueryChange={setFindQuery}
          onStep={(forward) => void run('find_step', { forward })}
          onClose={closeFind}
        />
      )}

      {showMenu && (
        <AppMenu
          key={homeUrl}
          zoom={zoom}
          privateMode={privateMode}
          showBmBar={showBmBar}
          homeUrl={homeUrl}
          onZoomIn={() => stepZoom(1)}
          onZoomOut={() => stepZoom(-1)}
          onZoomReset={() => void applyZoom(1)}
          onTogglePrivate={() => void togglePrivate()}
          onToggleBmBar={() => setShowBmBar((v) => !v)}
          onOpenHistory={() => {
            setShowMenu(false);
            void toggleHistory();
          }}
          onOpenFind={() => {
            setShowMenu(false);
            setShowFind(true);
          }}
          onNewTab={() => {
            setShowMenu(false);
            void run('new_tab', { url: homeUrl });
          }}
          onGoHome={() => {
            setShowMenu(false);
            void navigateTo(homeUrl);
          }}
          onSaveHome={(url) => void saveHome(url)}
          onClose={() => setShowMenu(false)}
        />
      )}

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
