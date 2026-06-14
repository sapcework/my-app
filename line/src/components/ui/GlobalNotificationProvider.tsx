'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useNotification } from '@/hooks/useNotification';
import { NotificationToast } from './NotificationToast';

export function GlobalNotificationProvider() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [memberRoomIds, setMemberRoomIds] = useState<Set<string>>(new Set());
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const supabase = createClient();
  const fetchedRef = useRef(false);

  // /rooms/[roomId] のときだけ currentRoomId をセット（自ルームの通知は除外するため）
  const roomIdMatch = pathname.match(/^\/rooms\/([^/]+)$/);
  const currentRoomId = roomIdMatch ? roomIdMatch[1] : null;

  useEffect(() => {
    if (!profile?.id) return;
    fetchedRef.current = false; // userId変化で再取得

    Promise.all([
      supabase.from('room_members').select('room_id').eq('user_id', profile.id),
      supabase.from('rooms').select('id, name'),
    ]).then(([{ data: memberships }, { data: rooms }]) => {
      setMemberRoomIds(new Set((memberships ?? []).map((m) => m.room_id)));
      const names: Record<string, string> = {};
      for (const r of (rooms ?? []) as { id: string; name: string }[]) names[r.id] = r.name;
      setRoomNames(names);
    });
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { toasts, dismissToast } = useNotification({
    userId: profile?.id ?? null,
    currentRoomId,
    memberRoomIds,
    roomNames,
  });

  return <NotificationToast toasts={toasts} onDismiss={dismissToast} />;
}
