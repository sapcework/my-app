'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MemberRole, RoomMemberWithUser, User } from '@/lib/types';

export function useRoomMembers(roomId: string, myUserId: string | null) {
  const [members, setMembers] = useState<RoomMemberWithUser[]>([]);
  const [myRole, setMyRole] = useState<MemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchMembers = useCallback(async () => {
    // 直接クエリ（RLS: is_room_member 経由で同室メンバーを互いに参照可。非メンバーは空が返る）
    const { data } = await supabase
      .from('room_members')
      .select('role, joined_at, user_id, users(id, display_name, avatar_url, email, last_seen, created_at)')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    const rows = (data ?? []) as unknown as { role: MemberRole; joined_at: string; user_id: string; users: User }[];
    const list = rows.map(({ role, joined_at, users }) => ({ ...users, role, joined_at }));
    setMembers(list);
    setMyRole(rows.find((r) => r.user_id === myUserId)?.role ?? null); // 自分の役割を抽出
    setLoading(false);
  }, [roomId, myUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const kickMember = useCallback(async (userId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (!error) setMembers((prev) => prev.filter((m) => m.id !== userId));
    return !error;
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeRole = useCallback(async (userId: string, role: MemberRole): Promise<boolean> => {
    const { error } = await supabase
      .from('room_members')
      .update({ role })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (!error) setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role } : m));
    return !error;
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自分の role のみ Realtime で監視（メンバーパネル未表示時も myRole を把握）
  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase
      .channel(`room-my-role-${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'room_members',
          filter: `room_id=eq.${roomId}` },
        () => { void fetchMembers(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId, myUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { members, myRole, loading, kickMember, changeRole, refetch: fetchMembers };
}
