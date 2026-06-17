'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageReaction } from '@/lib/types';

// メッセージID → リアクション配列 のマップ
export type ReactionMap = Record<string, MessageReaction[]>;

export function useReactions(roomId: string, userId: string | null) {
  const [reactions, setReactions] = useState<ReactionMap>({});
  const supabase = createClient();
  const reactionsRef = useRef<ReactionMap>({});
  reactionsRef.current = reactions;

  const fetchReactions = useCallback(async () => {
    const { data } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .eq('room_id', roomId);
    const map: ReactionMap = {};
    for (const r of (data ?? []) as MessageReaction[]) {
      (map[r.message_id] ??= []).push(r);
    }
    setReactions(map);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchReactions(); }, [fetchReactions]);

  // ローカル状態の追加/削除（重複排除つき）
  const applyAdd = (r: MessageReaction) => setReactions((prev) => {
    const list = prev[r.message_id] ?? [];
    if (list.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) return prev;
    return { ...prev, [r.message_id]: [...list, r] };
  });
  const applyRemove = (r: MessageReaction) => setReactions((prev) => {
    const list = prev[r.message_id] ?? [];
    return { ...prev, [r.message_id]: list.filter((x) => !(x.user_id === r.user_id && x.emoji === r.emoji)) };
  });

  // Realtime購読（INSERT/DELETE）
  useEffect(() => {
    const channel = supabase
      .channel(`reactions:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `room_id=eq.${roomId}` },
        (payload) => applyAdd(payload.new as MessageReaction))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions', filter: `room_id=eq.${roomId}` },
        (payload) => applyRemove(payload.old as MessageReaction))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 付与/解除のトグル（楽観的更新＋失敗時リフェッチ）
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    const mine: MessageReaction = { message_id: messageId, user_id: userId, emoji };
    const had = (reactionsRef.current[messageId] ?? []).some((x) => x.user_id === userId && x.emoji === emoji);

    if (had) {
      applyRemove(mine);
      const { error } = await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji);
      if (error) void fetchReactions();
    } else {
      applyAdd(mine);
      const { error } = await supabase.from('message_reactions')
        .insert({ message_id: messageId, room_id: roomId, user_id: userId, emoji });
      if (error) void fetchReactions();
    }
  }, [roomId, userId, fetchReactions]); // eslint-disable-line react-hooks/exhaustive-deps

  return { reactions, toggleReaction };
}
