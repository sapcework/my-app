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
    // APIルート経由で取得（adminクライアントがRLSをバイパスして全メンバーを返す）
    const res = await fetch(`/api/rooms/${roomId}/members`);
    if (!res.ok) { setLoading(false); return; }
    const d = await res.json() as {
      members: { role: MemberRole; joined_at: string; users: User }[];
      myRole: MemberRole;
    };
    const list = d.members.map(({ role, joined_at, users }) => ({ ...users, role, joined_at }));
    setMembers(list);
    setMyRole(d.myRole ?? null);
    setLoading(false);
  }, [roomId]);

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
