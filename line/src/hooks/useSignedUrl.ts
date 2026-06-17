'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const SIGNED_TTL = 60 * 60 * 24;        // 署名URLの有効期限（24時間）
const cache = new Map<string, string>(); // path → 署名URL（再署名を避ける）

// chat-images のパスから署名URLを得る。後方互換: 既にURL(http)ならそのまま返す。
export function useSignedUrl(path?: string, enabled = true): string | undefined {
  const [url, setUrl] = useState<string | undefined>(
    path && (path.startsWith('http') ? path : cache.get(path))
  );

  useEffect(() => {
    if (!enabled || !path) return;
    if (path.startsWith('http')) { setUrl(path); return; }  // 旧来の公開URL
    const cached = cache.get(path);
    if (cached) { setUrl(cached); return; }

    let active = true;
    createClient().storage.from('chat-images').createSignedUrl(path, SIGNED_TTL)
      .then(({ data }) => {
        if (active && data?.signedUrl) { cache.set(path, data.signedUrl); setUrl(data.signedUrl); }
      });
    return () => { active = false; };
  }, [path, enabled]);

  return url;
}
