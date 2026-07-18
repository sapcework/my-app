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

  const suspendUser = useCallback(async (userId: string, suspended: boolean): Promise<boolean> => {
    // is_suspended は service role のみ変更可のため admin API 経由（RLS+トリガーで直接更新は不可）
    const res = await fetch('/api/admin/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, suspended }),
    });
    return res.ok;
  }, []);

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

  // 指定ルームの参加者表示名を取得（DMルームの「誰と誰か」表示用）
  const getRoomMemberNames = useCallback(async (roomIds: string[]): Promise<Record<string, string[]>> => {
    if (!roomIds.length) return {};
    const { data } = await supabase
      .from('room_members')
      .select('room_id, users(display_name)')
      .in('room_id', roomIds);
    const rows = (data ?? []) as unknown as { room_id: string; users: { display_name: string } | null }[];
    const names: Record<string, string[]> = {};
    for (const { room_id, users } of rows) {
      if (users) (names[room_id] ??= []).push(users.display_name);
    }
    return names;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteRoom = useCallback(async (roomId: string): Promise<boolean> => {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    return !error;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getMessages = useCallback(async (roomId: string): Promise<Message[]> => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(200);
    return (data ?? []) as unknown as Message[];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    return !error;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { getStats, getUsers, suspendUser, getRooms, getMemberCounts, getRoomMemberNames, deleteRoom, getMessages, deleteMessage };
}
