'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const SIGNED_TTL = 60 * 60 * 24;        // 署名URLの有効期限（24時間）
const cache = new Map<string, string>(); // path → 署名URL（再署名を避ける）

// chat-images の複数パスをまとめて1回のAPI呼び出しで署名URL化する。
// メッセージごとに個別リクエストすると画像枚数分の往復が発生し、
// 特にスマホ回線でルームを開く体感速度が悪化するため、画面単位でバッチ化する。
export function useSignedUrls(paths: (string | undefined)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.filter(Boolean).join(',');

  useEffect(() => {
    const targets = Array.from(new Set(paths.filter((p): p is string => !!p)));
    if (targets.length === 0) return;

    const fromCache: Record<string, string> = {};
    const uncached: string[] = [];
    for (const p of targets) {
      if (p.startsWith('http')) fromCache[p] = p;       // 旧来の公開URLはそのまま
      else if (cache.has(p)) fromCache[p] = cache.get(p)!;
      else uncached.push(p);
    }
    if (Object.keys(fromCache).length > 0) {
      setUrls((prev) => ({ ...prev, ...fromCache }));
    }
    if (uncached.length === 0) return;

    let active = true;
    createClient().storage.from('chat-images').createSignedUrls(uncached, SIGNED_TTL)
      .then(({ data }) => {
        if (!active || !data) return;
        const next: Record<string, string> = {};
        for (const item of data as { path: string | null; signedUrl: string }[]) {
          if (item.path && item.signedUrl) { cache.set(item.path, item.signedUrl); next[item.path] = item.signedUrl; }
        }
        if (Object.keys(next).length > 0) setUrls((prev) => ({ ...prev, ...next }));
      });
    return () => { active = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return urls;
}
