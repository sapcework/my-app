'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message, MessageWithStatus } from '@/lib/types';

export function useMessages(roomId: string, userId: string | null) {
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const latestIdRef = useRef<string | null>(null);

  const toWithStatus = (msg: Message): MessageWithStatus => ({
    ...msg,
    status: 'sent',
  });

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:users(*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    const fetched = (data ?? []) as Message[];
    setMessages(fetched.map(toWithStatus));
    if (fetched.length > 0) {
      latestIdRef.current = fetched[fetched.length - 1].id;
    }
    setLoading(false);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtimeで新着メッセージを購読（room単位のみ）
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          // senderを別途取得してattach
          const { data: sender } = await supabase
            .from('users')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev; // 既存なら追加しない
            return [...prev, toWithStatus({ ...newMsg, sender: sender ?? undefined })];
          });
          latestIdRef.current = newMsg.id;
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (content: string, type: 'text' | 'stamp' = 'text') => {
    if (!userId || !content.trim()) return;

    const optimistic: MessageWithStatus = {
      id: `optimistic-${Date.now()}`,
      room_id: roomId,
      sender_id: userId,
      content,
      type,
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('messages')
      .insert({ room_id: roomId, sender_id: userId, content, type })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id)); // 失敗時削除
      return;
    }

    // 楽観的更新を確定メッセージに差し替え（Realtimeで届く前に二重表示防止）
    setMessages((prev) =>
      prev.map((m) => (m.id === optimistic.id ? { ...data as Message, status: 'sent' as const } : m))
    );
  };

  return { messages, loading, sendMessage };
}
