'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Room } from '@/lib/types';

export function useRooms(userId: string | null) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [memberRoomIds, setMemberRoomIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRooms = useCallback(async () => {
    if (!userId) return;

    const [{ data: allRooms }, { data: memberships }] = await Promise.all([
      supabase.from('rooms').select('*').order('last_message_at', { ascending: false }),
      supabase.from('room_members').select('room_id').eq('user_id', userId),
    ]);

    setRooms((allRooms ?? []) as Room[]);
    setMemberRoomIds(new Set((memberships ?? []).map((m) => (m as { room_id: string }).room_id)));
    setLoading(false);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const createRoom = async (name: string, memberIds: string[]) => {
    if (!userId) return null;

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ name, created_by: userId })
      .select()
      .single();

    if (error || !room) { console.error('rooms insert error:', error); return null; }

    const members = [...new Set([userId, ...memberIds])].map((uid) => ({
      room_id: room.id,
      user_id: uid,
    }));
    await supabase.from('room_members').insert(members);
    await fetchRooms();
    return room as Room;
  };

  const joinRoom = async (roomId: string) => {
    if (!userId) return;
    await supabase.from('room_members').insert({ room_id: roomId, user_id: userId });
    await fetchRooms();
  };

  const leaveRoom = async (roomId: string) => {
    if (!userId) return;
    await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
    await fetchRooms();
  };

  const addMember = async (roomId: string, targetUserId: string): Promise<boolean> => {
    if (!userId) return false;
    const { error } = await supabase.from('room_members').insert({ room_id: roomId, user_id: targetUserId });
    if (error) { console.error('add member error:', error); return false; }
    return true;
  };

  const updateRoomName = async (roomId: string, name: string): Promise<boolean> => {
    if (!userId || !name.trim()) return false;
    const { error } = await supabase.from('rooms').update({ name: name.trim() }).eq('id', roomId);
    if (error) { console.error('room name update error:', error); return false; }
    await fetchRooms();
    return true;
  };

  return { rooms, memberRoomIds, loading, createRoom, joinRoom, leaveRoom, addMember, updateRoomName, refetch: fetchRooms };
}
