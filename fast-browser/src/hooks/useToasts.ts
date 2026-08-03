import { useCallback, useRef, useState } from 'react';
import type { Toast } from '../types';
import { call, friendlyError } from '../lib/ipc';
import type { Locale } from '../i18n/messages';

/** コマンド失敗を表す番兵。null / undefined は正常な戻り値なので使えない。 */
export const FAILED = Symbol('command-failed');

const AUTO_DISMISS_MS = 5000;
const AUTO_DISMISS_WITH_ACTION_MS = 8000; // 「元に戻す」は押す時間が要るので長めに出す

/**
 * 画面右下の通知キューを管理する。
 *
 * 併せて `run()` を提供し、Rust コマンドの失敗を必ず可視化する。
 * これがないと通信・IO エラーがユーザーに一切伝わらない。
 */
export function useToasts(locale: Locale) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: Toast['kind'], message: string, action?: Toast['action']) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message, action }]);
      const ms = action ? AUTO_DISMISS_WITH_ACTION_MS : AUTO_DISMISS_MS;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
      return id;
    },
    [dismiss],
  );

  /**
   * Rust コマンドを実行し、失敗したら通知を出す。
   *
   * 失敗は `FAILED` シンボルで表す。null を失敗の印にすると、
   * 値を返さないコマンド（remove_bookmark など）の正常終了と
   * 区別できず、UI が更新されないまま状態がずれる。
   */
  const run = useCallback(
    async <T>(cmd: string, args?: Record<string, unknown>): Promise<T | typeof FAILED> => {
      try {
        return await call<T>(cmd, args);
      } catch (e) {
        push('error', friendlyError(locale, cmd, e instanceof Error ? e.message : String(e)));
        return FAILED;
      }
    },
    [push, locale],
  );

  return { toasts, push, dismiss, run };
}
