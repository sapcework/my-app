'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 指定ルームの通知ミュート状態を管理（本人のみ）
export function useRoomMute(roomId: string, userId: string | null) {
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('room_mutes')
      .select('room_id')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .maybeSingle()
      .then(({ data }) => { setMuted(!!data); setLoading(false); });
  }, [roomId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = useCallback(async () => {
    if (!userId) return;
    if (muted) {
      setMuted(false);
      const { error } = await supabase.from('room_mutes').delete().eq('user_id', userId).eq('room_id', roomId);
      if (error) setMuted(true); // 失敗時は戻す
    } else {
      setMuted(true);
      const { error } = await supabase.from('room_mutes').insert({ user_id: userId, room_id: roomId });
      if (error) setMuted(false);
    }
  }, [muted, roomId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { muted, loading, toggleMute };
}
