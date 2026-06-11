'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/types';

const ONLINE_THRESHOLD_MS = 60_000; // 60秒以内ならオンライン

export function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}

export function useOnlineUsers(roomId: string) {
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('room_members')
        .select('users(*)')
        .eq('room_id', roomId);

      const map: Record<string, boolean> = {};
      (data ?? []).forEach((d) => {
        const user = (d as unknown as { users: User }).users;
        if (user) map[user.id] = isOnline(user.last_seen);
      });
      setOnlineMap(map);
    };

    fetchMembers();

    // usersのlast_seenをリアルタイム購読
    const channel = supabase
      .channel(`online:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        (payload) => {
          const user = payload.new as User;
          setOnlineMap((prev) => ({ ...prev, [user.id]: isOnline(user.last_seen) }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  return onlineMap;
}
