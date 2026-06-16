'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/types';

export function useUserSearch() {
  const supabase = createClient();
  const [searching, setSearching] = useState(false);

  // メールアドレスの部分一致で候補を返す（大文字小文字無視）
  const searchUsersByEmail = async (query: string): Promise<User[]> => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    setSearching(true);
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`); // LIKE ワイルドカードをエスケープ
    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('email', `%${escaped}%`)
      .order('email', { ascending: true })
      .limit(10);
    setSearching(false);
    return (data ?? []) as User[];
  };

  return { searchUsersByEmail, searching };
}
