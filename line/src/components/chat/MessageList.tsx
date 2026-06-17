'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { MessageWithStatus } from '@/lib/types';
import { ReactionMap } from '@/hooks/useReactions';

interface Props {
  messages: MessageWithStatus[];
  currentUserId: string;
  otherLastReadMessageId: string | null;
  onDelete?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onReply?: (message: MessageWithStatus) => void;
  reactions?: ReactionMap;
  onReact?: (messageId: string, emoji: string) => void;
  searchQuery?: string;
}

// 返信先メッセージの引用スニペット
function snippetOf(m: MessageWithStatus): string {
  if (m.type === 'image') return '画像';
  if (m.type === 'stamp') return 'スタンプ';
  return m.content.length > 30 ? m.content.slice(0, 30) + '…' : m.content;
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

export function MessageList({ messages, currentUserId, otherLastReadMessageId, onDelete, onRetry, onReply, reactions, onReact, searchQuery }: Props) {
  const byId = new Map(messages.map((m) => [m.id, m])); // 返信先解決用
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);          // ユーザーが最下部付近にいるか
  const prevLastIdRef = useRef<string | null>(null);
  const [showNewPill, setShowNewPill] = useState(false);

  const lastReadIdx = otherLastReadMessageId
    ? messages.findIndex((m) => m.id === otherLastReadMessageId)
    : -1;

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setShowNewPill(false);
  };

  // スクロール位置を監視（最下部から120px以内なら「最下部」とみなす）
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    atBottomRef.current = nearBottom;
    if (nearBottom) setShowNewPill(false);
  };

  // 新着時：最下部付近 or 自分の送信なら自動スクロール、それ以外は新着ピルを表示
  useEffect(() => {
    if (searchQuery) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    const firstLoad = prevLastIdRef.current === null;
    const isNew = last.id !== prevLastIdRef.current;
    prevLastIdRef.current = last.id;
    if (!isNew) return; // 既読更新等のid変化なしは無視
    const isOwn = last.sender_id === currentUserId;
    if (firstLoad || isOwn || atBottomRef.current) {
      scrollToBottom(firstLoad ? 'auto' : 'smooth');
    } else {
      setShowNewPill(true); // 履歴閲覧中に他人の新着 → やみくもにスクロールしない
    }
  }, [messages, searchQuery, currentUserId]);

  const query = searchQuery?.trim().toLowerCase() ?? '';
  const filtered = query
    ? messages.filter((m) => m.type !== 'image' && m.content.toLowerCase().includes(query))
    : messages;

  return (
    <div className="relative flex-1 min-h-0">
    <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto px-3 py-3 space-y-0.5 bg-[#b2d8ea] dark:bg-[#0e1c24]">
      {/* 検索中のバナー */}
      {query && (
        <div className="flex justify-center mb-2">
          <span className="bg-black/20 text-white text-xs px-3 py-1 rounded-full">
            {filtered.length > 0 ? `${filtered.length}件ヒット` : '該当なし'}
          </span>
        </div>
      )}

      {filtered.map((msg, i) => {
        const prev = filtered[i - 1];
        const showDateLabel = !prev || !isSameDay(prev.created_at, msg.created_at);
        const isOwn = msg.sender_id === currentUserId;
        const origIdx = messages.indexOf(msg);
        const isRead = isOwn && lastReadIdx >= 0 && origIdx <= lastReadIdx;

        // 返信先の引用プレビューをローカルのメッセージ群から解決
        const replied = msg.reply_to ? byId.get(msg.reply_to) : undefined;
        const replyPreview = replied
          ? { senderName: replied.sender?.display_name ?? '不明', snippet: snippetOf(replied) }
          : msg.reply_to ? { senderName: '', snippet: '（元のメッセージ）' } : null;

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
              onRetry={onRetry}
              onReply={onReply}
              replyPreview={replyPreview}
              reactions={reactions?.[msg.id]}
              myUserId={currentUserId}
              onReact={onReact}
              searchQuery={query}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>

      {/* 新着メッセージピル（履歴閲覧中に他人の新着が来た時のみ） */}
      {showNewPill && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#4CAF50] text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg active:scale-95 transition-transform z-10"
        >
          新着メッセージ ↓
        </button>
      )}
    </div>
  );
}
