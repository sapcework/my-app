// 画面が共通で使う小さな道具。

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './api';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

// 読み込み → 表示 → 再読み込み、をまとめる。
//
// 失敗しても画面を落とさず、メッセージを出して再試行できる状態にする。
// 保護者の設定画面が真っ白になると、何が起きたのか分からなくなる。
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // 読み込み中の表示は、効果の中ではなくここで立てる。
  // 効果の本体で setState すると余計な再描画が連鎖する
  const reload = useCallback(() => {
    setLoading(true);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false; // 画面を離れたあとに状態を書き換えない

    load()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, error, loading, reload };
}

// 入力が落ち着くまで待つ。
//
// 1 文字ごとに問い合わせると、`yahoo.co.jp` を打つ間に途中の断片
// （`y` `ya` …）まで判定され、入力中ずっと赤い注意が出続けることになる。
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer); // 次の入力が来たら前の予約は捨てる
  }, [value, delayMs]);

  return settled;
}
