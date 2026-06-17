'use client';

import { useRef, useState } from 'react';
import { MessageWithStatus, User } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { formatMessageTime } from '@/lib/datetime';

interface Props {
  message: MessageWithStatus;
  isOwn: boolean;
  isRead: boolean;
  sender?: User;
  onDelete?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  searchQuery?: string;
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-300 text-gray-900 rounded-sm">{part}</mark>
      : part
  );
}

const STATUS_ICON: Record<string, string> = {
  sending: '🕐',
  sent: '✓',
  read: '既読',
};

export function MessageBubble({ message, isOwn, isRead, sender, onDelete, onRetry, searchQuery }: Props) {
  const isStamp = message.type === 'stamp';
  const isImage = message.type === 'image';
  const isFailed = message.status === 'failed';
  const [showMenu, setShowMenu] = useState(false);
  const canDelete = isOwn && !!onDelete && !isFailed; // 送信失敗中は削除でなく再送
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false); // 長押し直後のclick(画像オープン等)を抑制

  // 長押し（タッチ）でメニュー表示
  const startPress = () => {
    if (!canDelete) return;
    suppressClick.current = false;
    pressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setShowMenu(true);
      navigator.vibrate?.(10);
    }, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canDelete) return;
    e.preventDefault(); // PCの右クリックでメニュー
    setShowMenu(true);
  };
  const handleDelete = () => {
    setShowMenu(false);
    if (confirm('このメッセージを削除しますか？')) onDelete?.(message.id);
  };

  return (
    <div className={`flex items-end gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* アバター（相手のみ） */}
      {!isOwn && <Avatar user={sender} size="sm" />}

      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* 送信者名（相手のみ） */}
        {!isOwn && sender && (
          <span className="text-xs text-gray-500 mb-0.5 ml-1">{sender.display_name}</span>
        )}

        <div className={`flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* 吹き出し */}
          <div className="relative">
            <div
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              onContextMenu={handleContextMenu}
              className={[
                'max-w-full break-words select-none',
                isImage ? '' : 'px-3 py-2',
                isStamp ? 'text-4xl bg-transparent px-0 py-0' : '',
                isFailed ? 'opacity-60 ring-1 ring-red-300' : '',
                !isStamp && !isImage && isOwn
                  ? 'bg-[#4CAF50] text-white rounded-[18px_4px_18px_18px]'
                  : !isStamp && !isImage
                  ? 'bg-white text-gray-900 rounded-[4px_18px_18px_18px] shadow-sm'
                  : '',
              ].join(' ')}
            >
              {isImage ? (
                <img
                  src={message.content}
                  alt="画像"
                  className="max-w-[200px] max-h-[200px] rounded-xl object-cover cursor-pointer shadow-sm"
                  onClick={(e) => { e.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } if (message.content.startsWith('https://')) window.open(message.content, '_blank', 'noopener,noreferrer'); }}
                />
              ) : searchQuery ? highlightText(message.content, searchQuery) : message.content}
            </div>
            {/* 削除メニュー（長押し / 右クリックで表示） */}
            {showMenu && (
              <div className="absolute bottom-full mb-1 right-0 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10">
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm text-red-500 font-medium whitespace-nowrap hover:bg-gray-50"
                >
                  削除
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="px-4 py-2 text-sm text-gray-400 whitespace-nowrap hover:bg-gray-50 border-t border-gray-100"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>

          {/* 時刻＋既読／送信失敗 */}
          <div className={`flex flex-col text-[10px] text-gray-500 flex-shrink-0 ${isOwn ? 'items-end' : 'items-start'}`}>
            {isOwn && (
              isFailed ? (
                <button
                  onClick={() => onRetry?.(message.id)}
                  aria-label="送信に失敗しました。タップで再送"
                  className="text-red-500 font-medium whitespace-nowrap"
                >
                  ⟳ 再送
                </button>
              ) : (
                <span className={isRead ? 'text-[#4CAF50]' : ''}>
                  {isRead ? STATUS_ICON.read : STATUS_ICON[message.status]}
                </span>
              )
            )}
            {!isFailed && <span>{formatMessageTime(message.created_at)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
