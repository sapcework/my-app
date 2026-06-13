'use client';

export const dynamic = 'force-dynamic';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { createClient } from '@/lib/supabase/client';
import { Room, Message } from '@/lib/types';

interface Props {
  params: Promise<{ roomId: string }>;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminMessagesPage({ params }: Props) {
  const { roomId } = use(params);
  const router = useRouter();
  const { getMessages, deleteMessage } = useAdmin();
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [opError, setOpError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      getMessages(roomId),
      supabase.from('rooms').select('*').eq('id', roomId).single(),
    ]).then(([msgs, { data }]) => {
      setMessages(msgs);
      if (data) setRoom(data as Room);
      setLoading(false);
    });
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (messageId: string) => {
    setDeleting(messageId);
    const ok = await deleteMessage(messageId);
    if (ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } else {
      setOpError('削除に失敗しました');
      setTimeout(() => setOpError(''), 3000);
    }
    setDeleting(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <button onClick={() => router.back()} className="text-white text-xl">‹</button>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{room?.name ?? '...'}</p>
          <p className="text-xs text-green-200">メッセージ監視</p>
        </div>
        <span className="text-xs text-green-200">{messages.length}件</span>
      </header>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <span className="text-gray-400 text-sm">読み込み中...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <span className="text-gray-400 text-sm">メッセージなし</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {opError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{opError}</p>}
          {messages.map((msg) => (
            <div key={msg.id} className="bg-white rounded-xl shadow-sm p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#4CAF50] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {(msg.sender?.display_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-gray-600">{msg.sender?.display_name ?? '不明'}</span>
                  <span className="text-xs text-gray-300">{formatDateTime(msg.created_at)}</span>
                </div>
                {msg.type === 'image' ? (
                  <img
                    src={msg.content}
                    alt="画像"
                    className="max-w-[120px] rounded-lg mt-1"
                  />
                ) : (
                  <p className="text-sm text-gray-800 break-words">{msg.content}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(msg.id)}
                disabled={deleting === msg.id}
                className="text-red-400 text-xs flex-shrink-0 px-1 disabled:opacity-40"
              >
                {deleting === msg.id ? '...' : '削除'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
