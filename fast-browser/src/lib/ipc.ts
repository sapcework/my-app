import { invoke } from '@tauri-apps/api/core';
import { translate, type Locale, type MessageKey } from '../i18n/messages';

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
export function friendlyError(locale: Locale, cmd: string, raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('relative url') || r.includes('invalid') || r.includes('parse')) {
    return translate(locale, 'err.badUrl');
  }
  if (r.includes('not found') || r.includes('webview')) {
    return translate(locale, 'err.notReady');
  }
  const key = `err.${cmd}` as MessageKey;
  const known = key in MESSAGE_KEYS ? key : 'err.generic';
  return translate(locale, 'err.checkNetwork', { action: translate(locale, known) });
}

// コマンド名に対応する専用メッセージがあるかを判定するための集合
const MESSAGE_KEYS: Record<string, true> = {
  'err.navigate': true,
  'err.new_tab': true,
  'err.close_tab': true,
  'err.switch_tab': true,
  'err.add_bookmark': true,
  'err.remove_bookmark': true,
  'err.get_history': true,
  'err.clear_history': true,
  'err.restore_history': true,
  'err.reload': true,
  'err.get_downloads': true,
  'err.reveal_download': true,
};
