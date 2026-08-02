import { invoke } from '@tauri-apps/api/core';

/**
 * Rust コマンド呼び出しの薄いラッパー。
 *
 * 以前は各呼び出しが `.catch(console.error)` で握り潰されており、
 * 失敗してもユーザーには何も見えなかった。ここで必ず Error に正規化し、
 * 呼び出し側が UI へ通知できるようにする。
 */
export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    // 原因を cause に残し、デバッグ時に元の失敗を辿れるようにする
    throw new Error(toMessage(e), { cause: e });
  }
}

/** Tauri は文字列を投げることがあるため、表示可能なメッセージへ正規化する。 */
function toMessage(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * 技術的なエラーを、ユーザーが次の行動を取れる日本語メッセージに翻訳する。
 * 原文をそのまま出すと「何をすればよいか」が伝わらないため。
 */
export function friendlyError(cmd: string, raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('relative url') || r.includes('invalid') || r.includes('parse')) {
    return 'URL の形式が正しくありません。入力内容を確認してください。';
  }
  if (r.includes('not found') || r.includes('webview')) {
    return 'ブラウザ画面の準備ができていません。少し待ってからもう一度お試しください。';
  }
  const labels: Record<string, string> = {
    navigate: 'ページを開けませんでした',
    new_tab: '新しいタブを開けませんでした',
    close_tab: 'タブを閉じられませんでした',
    switch_tab: 'タブを切り替えられませんでした',
    add_bookmark: 'ブックマークを追加できませんでした',
    remove_bookmark: 'ブックマークを削除できませんでした',
    get_history: '履歴を読み込めませんでした',
    clear_history: '履歴を削除できませんでした',
    restore_history: '履歴を元に戻せませんでした',
    reload: '再読み込みできませんでした',
  };
  return `${labels[cmd] ?? '操作に失敗しました'}。ネットワーク接続を確認してください。`;
}
