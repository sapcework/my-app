'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { MessageWithStatus } from '@/lib/types';

interface Props {
  messages: MessageWithStatus[];
  currentUserId: string;
  otherLastReadMessageId: string | null;
  onDelete?: (messageId: string) => void;
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return '今日';
  if (d.toDateString() === yesterday.toDateString()) return '昨日';
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function MessageList({ messages, currentUserId, otherLastReadMessageId, onDelete }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 相手が最後に読んだメッセージのインデックス
  const lastReadIdx = otherLastReadMessageId
    ? messages.findIndex((m) => m.id === otherLastReadMessageId)
    : -1;

  // 新着メッセージで自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 bg-[#b2d8ea]">
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const showDateLabel = !prev || !isSameDay(prev.created_at, msg.created_at);
        const isOwn = msg.sender_id === currentUserId;
        const isRead = isOwn && lastReadIdx >= 0 && i <= lastReadIdx; // 自分のメッセージかつ既読範囲内

        return (
          <div key={msg.id}>
            {showDateLabel && (
              <div className="flex justify-center my-3">
                <span className="bg-black/20 text-white text-xs px-3 py-1 rounded-full">
                  {formatDateLabel(msg.created_at)}
                </span>
              </div>
            )}
            <MessageBubble
              message={msg}
              isOwn={isOwn}
              isRead={isRead}
              sender={msg.sender}
              onDelete={onDelete}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
