/**
 * 表示文字列の辞書。
 *
 * ライブラリ（i18next 等）を使わないのは、このアプリの最優先要件が
 * メモリ最小化・高速起動だから。必要なのは静的な文字列引きだけなので、
 * 型安全な辞書とごく小さなフォーマッタで足りる。
 *
 * `ja` を正とし、他の言語は同じキーを持つことを型で強制する。
 */

export const LOCALES = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
] as const;

export type Locale = (typeof LOCALES)[number]['id'];

const ja = {
  // タブ
  'tab.new': '新しいタブ',
  'tab.newAria': '新しいタブを開く (Ctrl+T)',
  'tab.closeAria': '{name} を閉じる',
  'tab.listAria': '開いているタブ',
  'tab.lastCannotClose': '最後のタブは閉じられません',

  // ナビゲーション
  'nav.back': '前のページに戻る (Alt+←)',
  'nav.forward': '次のページに進む (Alt+→)',
  'nav.reload': '再読み込み (Ctrl+R)',
  'nav.secure': '保護された接続',
  'nav.insecure': '保護されていない接続',
  'nav.insecureHint': '保護されていない接続 — 情報を入力しないでください',
  'nav.addressAria': 'アドレスバー — URL または検索語を入力',
  'nav.addressPlaceholder': 'URL またはキーワードを入力',
  'nav.addressDisplayAria': '現在のアドレス {url}。編集するには Enter または Ctrl+L',
  'nav.bookmarkAdd': 'このページをブックマーク (Ctrl+D)',
  'nav.bookmarkRemove': 'このページのブックマークを解除 (Ctrl+D)',
  'nav.menu': 'メニュー',
  'nav.history': '履歴を開く (Ctrl+H)',
  'nav.engine': '検索エンジンを選択',
  'nav.loading': 'ページを読み込み中',
  'nav.private': 'プライベート',
  'nav.privateHint': 'プライベートモード — 履歴を残していません',

  // メニュー
  'menu.newTab': '新しいタブ',
  'menu.openHome': 'ホームページを開く',
  'menu.find': 'ページ内を検索',
  'menu.history': '履歴',
  'menu.downloads': 'ダウンロード',
  'menu.zoom': 'ズーム',
  'menu.zoomIn': '拡大 (Ctrl++)',
  'menu.zoomOut': '縮小 (Ctrl+-)',
  'menu.zoomReset': 'ズームをリセット (Ctrl+0)',
  'menu.showBookmarkBar': 'ブックマークバーを表示',
  'menu.privateMode': 'プライベートモード',
  'menu.privateNote': 'オンの間は履歴を残しません',
  'menu.homePage': 'ホームページ',
  'menu.language': '表示言語',
  'menu.save': '保存',
  'menu.localeSystem': 'OS の設定に従う',

  // ブックマーク
  'bm.barAria': 'ブックマークバー',
  'bm.empty': 'ブックマークはまだありません。アドレスバーの ☆ または Ctrl+D で追加できます。',
  'bm.deleteAria': 'ブックマーク {name} を削除',
  'bm.added': '「{name}」をブックマークに追加しました',
  'bm.removed': 'ブックマークを解除しました',
  'bm.deleted': '「{name}」を削除しました',

  // 履歴
  'history.title': '履歴',
  'history.searchPlaceholder': 'タイトル・URL で絞り込み',
  'history.searchAria': '履歴を検索',
  'history.clearAll': 'すべて削除',
  'history.clearAllAria': '履歴をすべて削除（あとで元に戻せます）',
  'history.close': '履歴を閉じる',
  'history.count': '{n} 件',
  'history.countFiltered': '{shown} / {total} 件',
  'history.emptyTitle': 'まだ履歴がありません',
  'history.emptyBody': 'ページを開くと、ここに閲覧履歴が記録されます。',
  'history.noMatchTitle': '「{query}」に一致する履歴はありません',
  'history.clearFilter': '検索条件をクリア',
  'history.deleteAria': '履歴から {name} を削除',
  'history.deletedOne': '履歴を1件削除しました',
  'history.clearedAll': '履歴 {n} 件をすべて削除しました',
  'history.today': '今日',
  'history.yesterday': '昨日',
  'history.daysAgo': '{n} 日前',

  // ダウンロード
  'dl.title': 'ダウンロード',
  'dl.clearList': '一覧を消去',
  'dl.close': 'ダウンロードを閉じる',
  'dl.openFolder': 'フォルダーを開く',
  'dl.openFolderAria': '{name} の保存先フォルダーを開く',
  'dl.deleteAria': '{name} を一覧から削除',
  'dl.emptyTitle': 'ダウンロードはまだありません',
  'dl.emptyBody':
    'ファイルをダウンロードすると、ここに一覧が表示されます。保存先は OS の「ダウンロード」フォルダーです。',
  'dl.note': '「一覧から削除」してもファイル自体は消えません（表示上の履歴のみ消えます）。',
  'dl.statusRunning': 'ダウンロード中',
  'dl.statusDone': '完了',
  'dl.statusFailed': '失敗',
  'dl.started': '「{name}」のダウンロードを開始しました',
  'dl.listCleared': 'ダウンロード一覧を消去しました（ファイルは削除されていません）',

  // 検索バー
  'find.label': '検索',
  'find.placeholder': 'ページ内のテキスト',
  'find.noHit': '見つかりません',
  'find.position': '{index} / {total}',
  'find.prev': '前の一致へ',
  'find.next': '次の一致へ',
  'find.close': '検索を閉じる',

  // プライベートモード
  'private.on': 'プライベートモードをオンにしました。以降の閲覧は履歴に残りません。',
  'private.off': 'プライベートモードをオフにしました。閲覧履歴の記録を再開します。',

  // 設定
  'settings.homeSaved': 'ホームページを保存しました',
  'settings.homeInvalid': 'ホームページには http:// または https:// の URL を指定してください。',

  // 通知・エラー
  'toast.undo': '元に戻す',
  'toast.close': '通知を閉じる',
  'err.badUrl': 'URL の形式が正しくありません。入力内容を確認してください。',
  'err.notReady': 'ブラウザ画面の準備ができていません。少し待ってからもう一度お試しください。',
  'err.checkNetwork': '{action}。ネットワーク接続を確認してください。',
  'err.navigate': 'ページを開けませんでした',
  'err.new_tab': '新しいタブを開けませんでした',
  'err.close_tab': 'タブを閉じられませんでした',
  'err.switch_tab': 'タブを切り替えられませんでした',
  'err.add_bookmark': 'ブックマークを追加できませんでした',
  'err.remove_bookmark': 'ブックマークを削除できませんでした',
  'err.get_history': '履歴を読み込めませんでした',
  'err.clear_history': '履歴を削除できませんでした',
  'err.restore_history': '履歴を元に戻せませんでした',
  'err.reload': '再読み込みできませんでした',
  'err.get_downloads': 'ダウンロード一覧を読み込めませんでした',
  'err.reveal_download': '保存先フォルダーを開けませんでした',
  'err.generic': '操作に失敗しました',
} as const;

export type MessageKey = keyof typeof ja;

// 各言語は ja と同じキーを必ず持つ（欠けると型エラーになる）
const en: Record<MessageKey, string> = {
  'tab.new': 'New tab',
  'tab.newAria': 'Open a new tab (Ctrl+T)',
  'tab.closeAria': 'Close {name}',
  'tab.listAria': 'Open tabs',
  'tab.lastCannotClose': 'The last tab cannot be closed',

  'nav.back': 'Go back (Alt+Left)',
  'nav.forward': 'Go forward (Alt+Right)',
  'nav.reload': 'Reload (Ctrl+R)',
  'nav.secure': 'Secure connection',
  'nav.insecure': 'Not secure',
  'nav.insecureHint': 'Not secure — do not enter sensitive information',
  'nav.addressAria': 'Address bar — enter a URL or search term',
  'nav.addressPlaceholder': 'Enter a URL or search term',
  'nav.addressDisplayAria': 'Current address {url}. Press Enter or Ctrl+L to edit',
  'nav.bookmarkAdd': 'Bookmark this page (Ctrl+D)',
  'nav.bookmarkRemove': 'Remove bookmark (Ctrl+D)',
  'nav.menu': 'Menu',
  'nav.history': 'Open history (Ctrl+H)',
  'nav.engine': 'Choose search engine',
  'nav.loading': 'Loading page',
  'nav.private': 'Private',
  'nav.privateHint': 'Private mode — history is not being saved',

  'menu.newTab': 'New tab',
  'menu.openHome': 'Open home page',
  'menu.find': 'Find in page',
  'menu.history': 'History',
  'menu.downloads': 'Downloads',
  'menu.zoom': 'Zoom',
  'menu.zoomIn': 'Zoom in (Ctrl++)',
  'menu.zoomOut': 'Zoom out (Ctrl+-)',
  'menu.zoomReset': 'Reset zoom (Ctrl+0)',
  'menu.showBookmarkBar': 'Show bookmarks bar',
  'menu.privateMode': 'Private mode',
  'menu.privateNote': 'History is not saved while this is on',
  'menu.homePage': 'Home page',
  'menu.language': 'Language',
  'menu.save': 'Save',
  'menu.localeSystem': 'Follow system setting',

  'bm.barAria': 'Bookmarks bar',
  'bm.empty': 'No bookmarks yet. Use ☆ in the address bar or Ctrl+D to add one.',
  'bm.deleteAria': 'Delete bookmark {name}',
  'bm.added': 'Added “{name}” to bookmarks',
  'bm.removed': 'Bookmark removed',
  'bm.deleted': 'Deleted “{name}”',

  'history.title': 'History',
  'history.searchPlaceholder': 'Filter by title or URL',
  'history.searchAria': 'Search history',
  'history.clearAll': 'Clear all',
  'history.clearAllAria': 'Clear all history (can be undone)',
  'history.close': 'Close history',
  'history.count': '{n} items',
  'history.countFiltered': '{shown} of {total}',
  'history.emptyTitle': 'No history yet',
  'history.emptyBody': 'Pages you visit will appear here.',
  'history.noMatchTitle': 'No history matches “{query}”',
  'history.clearFilter': 'Clear filter',
  'history.deleteAria': 'Remove {name} from history',
  'history.deletedOne': 'Removed 1 item from history',
  'history.clearedAll': 'Cleared all {n} history items',
  'history.today': 'Today',
  'history.yesterday': 'Yesterday',
  'history.daysAgo': '{n} days ago',

  'dl.title': 'Downloads',
  'dl.clearList': 'Clear list',
  'dl.close': 'Close downloads',
  'dl.openFolder': 'Show in folder',
  'dl.openFolderAria': 'Show {name} in its folder',
  'dl.deleteAria': 'Remove {name} from the list',
  'dl.emptyTitle': 'No downloads yet',
  'dl.emptyBody': 'Files you download will be listed here, saved to your Downloads folder.',
  'dl.note': 'Removing an item from this list does not delete the file itself.',
  'dl.statusRunning': 'Downloading',
  'dl.statusDone': 'Completed',
  'dl.statusFailed': 'Failed',
  'dl.started': 'Started downloading “{name}”',
  'dl.listCleared': 'Download list cleared (files were not deleted)',

  'find.label': 'Find',
  'find.placeholder': 'Text on this page',
  'find.noHit': 'No matches',
  'find.position': '{index} of {total}',
  'find.prev': 'Previous match',
  'find.next': 'Next match',
  'find.close': 'Close find bar',

  'private.on': 'Private mode is on. Pages you visit will not be saved to history.',
  'private.off': 'Private mode is off. History is being saved again.',

  'settings.homeSaved': 'Home page saved',
  'settings.homeInvalid': 'The home page must be an http:// or https:// URL.',

  'toast.undo': 'Undo',
  'toast.close': 'Dismiss notification',
  'err.badUrl': 'That URL is not valid. Please check what you entered.',
  'err.notReady': 'The browser view is not ready yet. Please try again in a moment.',
  'err.checkNetwork': '{action}. Please check your network connection.',
  'err.navigate': 'Could not open the page',
  'err.new_tab': 'Could not open a new tab',
  'err.close_tab': 'Could not close the tab',
  'err.switch_tab': 'Could not switch tabs',
  'err.add_bookmark': 'Could not add the bookmark',
  'err.remove_bookmark': 'Could not remove the bookmark',
  'err.get_history': 'Could not load history',
  'err.clear_history': 'Could not clear history',
  'err.restore_history': 'Could not restore history',
  'err.reload': 'Could not reload',
  'err.get_downloads': 'Could not load downloads',
  'err.reveal_download': 'Could not open the containing folder',
  'err.generic': 'The operation failed',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { ja, en };

/** OS のロケールから既定言語を推定する。未対応の言語は英語にする。 */
export function detectLocale(): Locale {
  const langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
  for (const l of langs) {
    if (!l) continue;
    const base = l.toLowerCase().split('-')[0];
    const hit = LOCALES.find((x) => x.id === base);
    if (hit) return hit.id;
  }
  return 'en';
}

/**
 * メッセージを取得し、`{name}` 形式のプレースホルダを差し替える。
 * 未知のキーはキー名をそのまま返す（画面が空白になるより原因が分かる）。
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const table = MESSAGES[locale] ?? MESSAGES.ja;
  const raw = table[key] ?? MESSAGES.ja[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
