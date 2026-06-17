'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useNotification } from '@/hooks/useNotification';
import { NotificationToast } from './NotificationToast';

export function GlobalNotificationProvider() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [memberRoomIds, setMemberRoomIds] = useState<Set<string>>(new Set());
  const [mutedRoomIds, setMutedRoomIds] = useState<Set<string>>(new Set());
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const supabase = createClient();

  // /rooms/[roomId] のときだけ currentRoomId をセット（自ルームの通知は除外するため）
  const roomIdMatch = pathname.match(/^\/rooms\/([^/]+)$/);
  const currentRoomId = roomIdMatch ? roomIdMatch[1] : null;

  useEffect(() => {
    if (!profile?.id) return;

    Promise.all([
      supabase.from('room_members').select('room_id').eq('user_id', profile.id),
      supabase.from('rooms').select('id, name'),
      supabase.from('room_mutes').select('room_id').eq('user_id', profile.id),
    ]).then(([{ data: memberships }, { data: rooms }, { data: mutes }]) => {
      setMemberRoomIds(new Set((memberships ?? []).map((m) => m.room_id)));
      setMutedRoomIds(new Set((mutes ?? []).map((m) => m.room_id)));
      const names: Record<string, string> = {};
      for (const r of (rooms ?? []) as { id: string; name: string }[]) names[r.id] = r.name;
      setRoomNames(names);
    });

    // ミュート変更をリアルタイム反映
    const ch = supabase
      .channel(`mutes:${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'room_mutes', filter: `user_id=eq.${profile.id}` },
        () => {
          supabase.from('room_mutes').select('room_id').eq('user_id', profile.id!)
            .then(({ data }) => setMutedRoomIds(new Set((data ?? []).map((m) => m.room_id))));
        })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ミュート中のルームは通知対象から除外
  const notifyRoomIds = new Set([...memberRoomIds].filter((id) => !mutedRoomIds.has(id)));

  const { toasts, dismissToast } = useNotification({
    userId: profile?.id ?? null,
    currentRoomId,
    memberRoomIds: notifyRoomIds,
    roomNames,
  });

  return <NotificationToast toasts={toasts} onDismiss={dismissToast} />;
}
