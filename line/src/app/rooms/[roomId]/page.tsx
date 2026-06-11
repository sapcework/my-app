'use client';

export const dynamic = 'force-dynamic';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useReadStatus } from '@/hooks/useReadStatus';
import { useOnlineUsers } from '@/hooks/useOnline';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { createClient } from '@/lib/supabase/client';
import { Room } from '@/lib/types';

interface Props {
  params: Promise<{ roomId: string }>;
}

export default function ChatPage({ params }: Props) {
  const { roomId } = use(params);
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { messages, loading: msgLoading, sendMessage } = useMessages(roomId, profile?.id ?? null);
  const [room, setRoom] = useState<Room | null>(null);
  const [otherLastReadMessageId, setOtherLastReadMessageId] = useState<string | null>(null);
  const onlineMap = useOnlineUsers(roomId);

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const { subscribeToReads, getOtherLastRead } = useReadStatus(roomId, profile?.id ?? null, lastMessageId);

  // ルーム情報取得
  useEffect(() => {
    const supabase = createClient();
    supabase.from('rooms').select('*').eq('id', roomId).single().then(({ data }) => {
      if (data) setRoom(data as Room);
    });
  }, [roomId]);

  // 初期既読状態を取得
  useEffect(() => {
    if (!profile) return;
    getOtherLastRead().then((id) => { if (id) setOtherLastReadMessageId(id); });
  }, [profile, getOtherLastRead]);

  // 既読状態をリアルタイム購読
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToReads((_, messageId) => {
      setOtherLastReadMessageId(messageId);
    });
    return unsub;
  }, [profile, subscribeToReads]);

  if (authLoading) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><span className="text-gray-400">読み込み中...</span></div>;
  }

  if (!profile) {
    router.push('/login');
    return null;
  }

  // 相手のオンライン状態（自分以外の最初のメンバー）
  const otherOnlineEntry = Object.entries(onlineMap).find(([uid]) => uid !== profile.id);
  const isOtherOnline = otherOnlineEntry?.[1] ?? false;

  return (
    <div className="flex flex-col h-screen bg-[#b2d8ea]">
      {/* ヘッダー */}
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <button onClick={() => router.back()} className="text-white text-xl">‹</button>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-bold truncate">{room?.name ?? '...'}</span>
          {isOtherOnline && (
            <span className="text-xs text-green-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full inline-block" />
              オンライン
            </span>
          )}
        </div>
        <button className="text-white text-xl">☰</button>
      </header>

      {/* メッセージ一覧 */}
      {msgLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-500 text-sm">読み込み中...</span>
        </div>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={profile.id}
          otherLastReadMessageId={otherLastReadMessageId}
        />
      )}

      {/* 入力バー */}
      <div className="flex-shrink-0">
        <MessageInput onSend={sendMessage} />
      </div>
    </div>
  );
}
