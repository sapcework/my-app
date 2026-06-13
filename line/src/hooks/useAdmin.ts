'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Room, Message } from '@/lib/types';

export interface AdminStats {
  userCount: number;
  roomCount: number;
  messageCount: number;
}

export function useAdmin() {
  const supabase = createClient();

  const getStats = useCallback(async (): Promise<AdminStats> => {
    const [users, rooms, messages] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
    ]);
    return {
      userCount: users.count ?? 0,
      roomCount: rooms.count ?? 0,
      messageCount: messages.count ?? 0,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getUsers = useCallback(async (): Promise<User[]> => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('last_seen', { ascending: false });
    return (data ?? []) as User[];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const suspendUser = useCallback(async (userId: string, suspended: boolean) => {
    await supabase.from('users').update({ is_suspended: suspended }).eq('id', userId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getRooms = useCallback(async (): Promise<Room[]> => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });
    return (data ?? []) as Room[];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getMemberCounts = useCallback(async (roomIds: string[]): Promise<Record<string, number>> => {
    if (!roomIds.length) return {};
    const { data } = await supabase
      .from('room_members')
      .select('room_id')
      .in('room_id', roomIds);
    const counts: Record<string, number> = {};
    for (const row of (data ?? [])) {
      counts[row.room_id] = (counts[row.room_id] ?? 0) + 1;
    }
    return counts;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteRoom = useCallback(async (roomId: string) => {
    await supabase.from('rooms').delete().eq('id', roomId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getMessages = useCallback(async (roomId: string): Promise<Message[]> => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:users(*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(200);
    return (data ?? []) as unknown as Message[];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteMessage = useCallback(async (messageId: string) => {
    await supabase.from('messages').delete().eq('id', messageId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { getStats, getUsers, suspendUser, getRooms, getMemberCounts, deleteRoom, getMessages, deleteMessage };
}
