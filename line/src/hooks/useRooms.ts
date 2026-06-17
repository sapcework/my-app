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

    // 直接クエリ（RLS: rooms_select_member で所属ルーム、rooms_select_creator で作成ルームを取得）
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

  // 自分のメンバーシップ変化を購読 → 招待・退出時にトーク一覧へ即反映
  useEffect(() => {
    if (!userId) return;

    // (1) 自分の room_members 行の変化（招待=INSERT は本人に届く）
    const pgChannel = supabase
      .channel(`rooms-membership-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members', filter: `user_id=eq.${userId}` },
        () => { void fetchRooms(); }
      )
      .subscribe();

    // (2) キック通知のブロードキャスト（DELETE は RLS で本人に届かないため別経路）
    const bcChannel = supabase
      .channel(`membership:${userId}`)
      .on('broadcast', { event: 'changed' }, () => { void fetchRooms(); })
      .subscribe();

    return () => {
      void supabase.removeChannel(pgChannel);
      void supabase.removeChannel(bcChannel);
    };
  }, [userId, fetchRooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const createRoom = async (name: string, memberIds: string[]) => {
    if (!userId) return null;

    // API 経由で作成（admin クライアントで room_members も確実に追加）
    const res = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, memberIds }),
    });
    if (!res.ok) { console.error('createRoom failed:', await res.text()); return null; }

    const { room } = await res.json() as { room: Room };
    await fetchRooms();
    return room;
  };

  const joinRoom = async (roomId: string): Promise<boolean> => {
    if (!userId) return false;
    const res = await fetch(`/api/rooms/${roomId}/rejoin`, { method: 'POST' }); // 作成者再参加API（owner ロールを復元）
    if (!res.ok) return false;
    await fetchRooms();
    return true;
  };

  const leaveRoom = async (roomId: string) => {
    if (!userId) return;
    await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
    await fetchRooms();
  };

  const updateRoomName = async (roomId: string, name: string): Promise<boolean> => {
    if (!userId || !name.trim()) return false;
    const { error } = await supabase.from('rooms').update({ name: name.trim() }).eq('id', roomId);
    if (error) { console.error('room name update error:', error); return false; }
    await fetchRooms();
    return true;
  };

  return { rooms, memberRoomIds, unreadCounts, loading, createRoom, joinRoom, leaveRoom, updateRoomName, refetch: fetchRooms };
}
