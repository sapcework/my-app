'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 自分がブロックしたユーザーの管理（RLSで本人の行のみ読み書き可）
export function useBlocks(userId: string | null) {
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchBlocks = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    setBlockedIds(new Set((data ?? []).map((r) => (r as { blocked_id: string }).blocked_id)));
    setLoading(false);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchBlocks(); }, [fetchBlocks]);

  const block = useCallback(async (targetId: string): Promise<boolean> => {
    if (!userId || targetId === userId) return false;
    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: userId, blocked_id: targetId });
    if (error && error.code !== '23505') return false; // 既にブロック済み(23505)は成功扱い
    setBlockedIds((prev) => new Set(prev).add(targetId));
    return true;
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const unblock = useCallback(async (targetId: string): Promise<boolean> => {
    if (!userId) return false;
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', targetId);
    if (error) return false;
    setBlockedIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    return true;
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { blockedIds, loading, block, unblock, refetch: fetchBlocks };
}
