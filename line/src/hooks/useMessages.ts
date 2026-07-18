'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { withTimeout } from '@/lib/withTimeout';
import { getCachedMessages, setCachedMessages } from '@/lib/messagesCache';
import { Message, MessageWithStatus, User } from '@/lib/types';

export function useMessages(roomId: string, userId: string | null) {
  const toWithStatus = (msg: Message): MessageWithStatus => ({
    ...msg,
    status: 'sent',
  });

  // 前回のメッセージがキャッシュにあれば、サーバー応答を待たずに即座に表示する
  // （プロフィール・トーク一覧と同じstale-while-revalidate方式）。裏側で最新化する。
  const [messages, setMessages] = useState<MessageWithStatus[]>(
    () => getCachedMessages(roomId)?.map(toWithStatus) ?? []
  );
  const [loading, setLoading] = useState(() => !getCachedMessages(roomId));
  const supabase = createClient();
  const latestIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sendersRef = useRef<Map<string, User>>(new Map()); // 既知の送信者キャッシュ（新着時のN+1クエリ回避）

  const fetchMessages = useCallback(async () => {
    // ⚠️ タイムアウトを付けないと、起動直後・スリープ復帰直後で回線が不安定な時に
    //    応答が返らないまま「読み込み中」で固まり続けるため必須。
    const { data } = await withTimeout(
      supabase
        .from('messages')
        .select('*, sender:users!messages_sender_id_fkey(*)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100),
      8000
    );

    const fetched = (data ?? []) as Message[];
    for (const m of fetched) {
      if (m.sender) sendersRef.current.set(m.sender_id, m.sender); // 送信者をキャッシュ
    }
    setMessages(fetched.map(toWithStatus));
    if (fetched.length > 0) {
      latestIdRef.current = fetched[fetched.length - 1].id;
    }
    setLoading(false);
    setCachedMessages(roomId, fetched);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      fetchMessages().catch(() => {
        // タイムアウト/通信エラー時は諦めず、接続が戻るまで自動で再試行する
        if (!cancelled) retryTimer = setTimeout(load, 4000);
      });
    };
    load();

    return () => { cancelled = true; clearTimeout(retryTimer); };
  }, [fetchMessages]);

  const deleteMessage = async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId)); // 楽観的削除
    await supabase.from('messages').delete().eq('id', messageId);
    // broadcastで他ユーザーにリアルタイム通知
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'message_deleted',
      payload: { messageId },
    });
  };

  // Realtimeで新着メッセージ・削除を購読
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as Message;

          // 既知の送信者はキャッシュから解決し、初見のみクエリ（新着ごとのN+1回避）
          let sender = sendersRef.current.get(newMsg.sender_id);
          if (!sender) {
            const { data } = await supabase
              .from('users')
              .select('*')
              .eq('id', newMsg.sender_id)
              .single();
            sender = (data as User | null) ?? undefined;
            if (sender) sendersRef.current.set(newMsg.sender_id, sender);
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev; // 既存なら追加しない
            return [...prev, toWithStatus({ ...newMsg, sender })];
          });
          latestIdRef.current = newMsg.id;
        }
      )
      .on(
        'broadcast',
        { event: 'message_deleted' },
        ({ payload }) => {
          const { messageId } = payload as { messageId: string };
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendImage = async (file: File) => {
    if (!userId) return;
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/${roomId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-images').upload(path, file);
    if (error) { console.error('image upload error:', error); return; }
    // 非公開バケットのため、公開URLではなくパスを保存（表示時に署名URLを生成）
    await sendMessage(path, 'image');
  };

  // 楽観メッセージをDBへ確定。失敗時は削除せず 'failed' にして再送できるようにする
  const insertMessage = async (optimisticId: string, content: string, type: 'text' | 'stamp' | 'image', replyTo: string | null) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({ room_id: roomId, sender_id: userId, content, type, reply_to: replyTo })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? { ...m, status: 'failed' as const } : m)));
      return;
    }

    // 楽観的更新を確定メッセージに差し替え（idも実IDへ）
    setMessages((prev) =>
      prev.map((m) => (m.id === optimisticId ? { ...data as Message, status: 'sent' as const } : m))
    );
  };

  const sendMessage = async (content: string, type: 'text' | 'stamp' | 'image' = 'text', replyTo: string | null = null) => {
    if (!userId || !content.trim()) return;

    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: MessageWithStatus = {
      id: optimisticId,
      room_id: roomId,
      sender_id: userId,
      content,
      type,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimistic]);
    await insertMessage(optimisticId, content, type, replyTo);
  };

  // 送信失敗メッセージの再送
  const retryMessage = async (messageId: string) => {
    let target: MessageWithStatus | undefined;
    setMessages((prev) => {
      target = prev.find((m) => m.id === messageId && m.status === 'failed');
      if (!target) return prev;
      return prev.map((m) => (m.id === messageId ? { ...m, status: 'sending' as const } : m));
    });
    if (!target) return;
    await insertMessage(messageId, target.content, target.type as 'text' | 'stamp' | 'image', target.reply_to ?? null);
  };

  return { messages, loading, sendMessage, sendImage, deleteMessage, retryMessage };
}
