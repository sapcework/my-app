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
    const { data } = await supabase
      .from('room_members')
      .select('role, joined_at, users(id, display_name, avatar_url, email, last_seen, created_at)')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (!data) return;
    const list = (data as unknown as { role: MemberRole; joined_at: string; users: User }[])
      .map(({ role, joined_at, users }) => ({ ...users, role, joined_at }));
    setMembers(list);
    if (myUserId) {
      setMyRole(list.find((m) => m.id === myUserId)?.role ?? null);
    }
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

  return { members, myRole, loading, kickMember, changeRole, refetch: fetchMembers };
}
