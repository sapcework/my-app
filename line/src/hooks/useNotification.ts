'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message } from '@/lib/types';
import { playNotificationSound, warmUpAudio } from '@/lib/sound';
import { requestNotificationPermission, subscribeToPush } from '@/lib/notifications';

export interface ToastData {
  id: string;
  title: string;
  body: string;
  roomId: string;
}

interface Params {
  userId: string | null;
  currentRoomId?: string | null;
  memberRoomIds?: Set<string>;
  roomNames?: Record<string, string>;
}

export function useNotification({
  userId,
  currentRoomId = null,
  memberRoomIds,
  roomNames = {},
}: Params) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const supabase = createClient();
  const memberRoomIdsRef = useRef(memberRoomIds);
  const roomNamesRef = useRef(roomNames);
  const currentRoomIdRef = useRef(currentRoomId);

  useEffect(() => { memberRoomIdsRef.current = memberRoomIds; }, [memberRoomIds]);
  useEffect(() => { roomNamesRef.current = roomNames; }, [roomNames]);
  useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);

  // タッチ・フォーカス復帰で AudioContext を事前 resume（モバイル autoplay policy 対策）
  useEffect(() => {
    const warm = () => warmUpAudio();
    const onVisible = () => { if (document.visibilityState === 'visible') warmUpAudio(); };
    window.addEventListener('touchstart', warm, { passive: true });
    window.addEventListener('click', warm, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('touchstart', warm);
      window.removeEventListener('click', warm);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Push通知許可 + 購読登録（初回のみ）
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') return;
      const sub = await subscribeToPush();
      if (!sub) return;
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });
    })();
  }, [userId]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // グローバル新着メッセージ購読
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id === userId) return; // 自分は無視
          if (msg.room_id === currentRoomIdRef.current) return; // 同じルームは無視
          if (memberRoomIdsRef.current && !memberRoomIdsRef.current.has(msg.room_id)) return; // 非メンバーは無視

          await playNotificationSound(); // resume を待ってから再生
          navigator.vibrate?.(100);

          // ルーム名（キャッシュ優先、なければDB取得）
          let title = roomNamesRef.current[msg.room_id];
          if (!title) {
            const { data } = await supabase.from('rooms').select('name').eq('id', msg.room_id).single();
            title = (data as { name: string } | null)?.name ?? '新着メッセージ';
          }

          const bodyText =
            msg.type === 'stamp' ? 'スタンプ' :
            msg.type === 'image' ? '画像' :
            msg.content.length > 40 ? msg.content.slice(0, 40) + '…' : msg.content;

          const toast: ToastData = { id: msg.id, title, body: bodyText, roomId: msg.room_id };
          setToasts((prev) => [...prev, toast]);
          setTimeout(() => dismissToast(msg.id), 4000);
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { toasts, dismissToast };
}
