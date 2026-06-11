'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useReadStatus(roomId: string, userId: string | null, lastMessageId: string | null) {
  const supabase = createClient();

  // 既読をupsert（O(1)）
  const markAsRead = useCallback(async (messageId: string) => {
    if (!userId || !messageId) return;
    await supabase.from('room_reads').upsert(
      { room_id: roomId, user_id: userId, last_read_message_id: messageId, updated_at: new Date().toISOString() },
      { onConflict: 'room_id,user_id' }
    );
  }, [roomId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 最新メッセージが来たら自動既読
  useEffect(() => {
    if (lastMessageId) markAsRead(lastMessageId);
  }, [lastMessageId, markAsRead]);

  // 相手の初期既読状態を取得
  const getOtherLastRead = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    const { data } = await supabase
      .from('room_reads')
      .select('last_read_message_id')
      .eq('room_id', roomId)
      .neq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    return (data as { last_read_message_id: string | null } | null)?.last_read_message_id ?? null;
  }, [roomId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 相手の既読状態をリアルタイムで購読
  const subscribeToReads = useCallback(
    (onUpdate: (userId: string, messageId: string) => void) => {
      const channel = supabase
        .channel(`reads:${roomId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'room_reads', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const row = payload.new as { user_id: string; last_read_message_id: string };
            if (row.user_id !== userId) onUpdate(row.user_id, row.last_read_message_id);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    },
    [roomId, userId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { markAsRead, subscribeToReads, getOtherLastRead };
}
