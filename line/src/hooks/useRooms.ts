'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Room } from '@/lib/types';

export function useRooms(userId: string | null) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [memberRoomIds, setMemberRoomIds] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const memberRoomIdsRef = useRef(memberRoomIds); // Realtimeコールバック内で最新値を参照するためのref

  useEffect(() => { memberRoomIdsRef.current = memberRoomIds; }, [memberRoomIds]);

  const fetchRooms = useCallback(async () => {
    if (!userId) return;

    const [{ data: allRooms }, { data: memberships }, { data: unreadData }] = await Promise.all([
      supabase.from('rooms').select('*').order('last_message_at', { ascending: false }),
      supabase.from('room_members').select('room_id').eq('user_id', userId),
      supabase.rpc('get_unread_counts', { p_user_id: userId }),
    ]);

    setRooms((allRooms ?? []) as Room[]);
    setMemberRoomIds(new Set((memberships ?? []).map((m) => (m as { room_id: string }).room_id)));

    const counts: Record<string, number> = {};
    for (const row of (unreadData ?? []) as { room_id: string; unread_count: number }[]) {
      counts[row.room_id] = Number(row.unread_count);
    }
    setUnreadCounts(counts);
    setLoading(false);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // 新着メッセージをリアルタイムで受信 → 未読カウント増加・ルーム順序更新
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('rooms-unread-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as { room_id: string; sender_id: string };
          if (msg.sender_id === userId) return; // 自分の送信は無視
          if (!memberRoomIdsRef.current.has(msg.room_id)) return; // 非メンバーは無視

          // 未読カウントを1増やす
          setUnreadCounts((prev) => ({
            ...prev,
            [msg.room_id]: (prev[msg.room_id] ?? 0) + 1,
          }));

          // 対象ルームをリスト最上部に移動
          setRooms((prev) => {
            const idx = prev.findIndex((r) => r.id === msg.room_id);
            if (idx <= 0) return prev;
            const updated = [...prev];
            const [moved] = updated.splice(idx, 1);
            return [moved, ...updated];
          });
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return { rooms, memberRoomIds, unreadCounts, loading, createRoom, joinRoom, leaveRoom, addMember, updateRoomName, refetch: fetchRooms };
}
