'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/types';

export function useUserSearch() {
  const supabase = createClient();
  const [searching, setSearching] = useState(false);

  // 表示名またはメールアドレスの部分一致で候補を返す（大文字小文字無視・ブロック相手は除外）
  const searchUsers = async (query: string): Promise<User[]> => {
    const q = query.trim();
    if (!q) return [];
    setSearching(true);
    // LIKEワイルドカードをエスケープし、PostgRESTのor()構文を壊す区切り文字は除去
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, '');
    if (!escaped) { setSearching(false); return []; }
    const [{ data }, { data: blocks }] = await Promise.all([
      supabase
        .from('users')
        .select('*')
        .or(`display_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
        .order('display_name', { ascending: true })
        .limit(10),
      supabase.from('user_blocks').select('blocked_id'), // RLSにより自分のブロック行のみ返る
    ]);
    setSearching(false);
    const blockedIds = new Set((blocks ?? []).map((b) => (b as { blocked_id: string }).blocked_id));
    return ((data ?? []) as User[]).filter((u) => !blockedIds.has(u.id));
  };

  return { searchUsers, searching };
}
