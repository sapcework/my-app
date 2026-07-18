'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/types';

export function useUserSearch() {
  const supabase = createClient();
  const [searching, setSearching] = useState(false);

  // メールアドレスの部分一致で候補を返す（大文字小文字無視・ブロック相手は除外）
  const searchUsersByEmail = async (query: string): Promise<User[]> => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    setSearching(true);
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`); // LIKE ワイルドカードをエスケープ
    const [{ data }, { data: blocks }] = await Promise.all([
      supabase
        .from('users')
        .select('*')
        .ilike('email', `%${escaped}%`)
        .order('email', { ascending: true })
        .limit(10),
      supabase.from('user_blocks').select('blocked_id'), // RLSにより自分のブロック行のみ返る
    ]);
    setSearching(false);
    const blockedIds = new Set((blocks ?? []).map((b) => (b as { blocked_id: string }).blocked_id));
    return ((data ?? []) as User[]).filter((u) => !blockedIds.has(u.id));
  };

  return { searchUsersByEmail, searching };
}
