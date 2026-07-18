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
      supabase.from('rooms').select('id, name, is_dm'),
      supabase.from('room_mutes').select('room_id').eq('user_id', profile.id),
    ]).then(async ([{ data: memberships }, { data: rooms }, { data: mutes }]) => {
      setMemberRoomIds(new Set((memberships ?? []).map((m) => m.room_id)));
      setMutedRoomIds(new Set((mutes ?? []).map((m) => m.room_id)));

      const roomList = (rooms ?? []) as { id: string; name: string; is_dm: boolean }[];

      // DMルームは name が空なので相手ユーザー名を解決してタイトルに使う
      const dmIds = roomList.filter((r) => r.is_dm).map((r) => r.id);
      const partnerNames: Record<string, string> = {};
      if (dmIds.length) {
        const { data: dmMembers } = await supabase
          .from('room_members').select('room_id, users(id, display_name)').in('room_id', dmIds);
        const rows = (dmMembers ?? []) as unknown as { room_id: string; users: { id: string; display_name: string } | null }[];
        for (const { room_id, users } of rows) {
          if (users && users.id !== profile.id) partnerNames[room_id] = users.display_name;
        }
      }

      const names: Record<string, string> = {};
      for (const r of roomList) names[r.id] = r.is_dm ? (partnerNames[r.id] ?? 'メッセージ') : r.name;
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
