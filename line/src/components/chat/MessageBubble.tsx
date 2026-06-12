'use client';

import { useState } from 'react';
import { MessageWithStatus, User } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';

interface Props {
  message: MessageWithStatus;
  isOwn: boolean;
  isRead: boolean;
  sender?: User;
  onDelete?: (messageId: string) => void;
}

const STATUS_ICON: Record<string, string> = {
  sending: '🕐',
  sent: '✓',
  read: '既読',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, isOwn, isRead, sender, onDelete }: Props) {
  const isStamp = message.type === 'stamp';
  const [showMenu, setShowMenu] = useState(false);

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
              onClick={() => isOwn && onDelete && setShowMenu((v) => !v)}
              className={[
                'px-3 py-2 max-w-full break-words',
                isOwn && onDelete ? 'cursor-pointer' : '',
                isStamp ? 'text-4xl bg-transparent px-0 py-0' : '',
                !isStamp && isOwn
                  ? 'bg-[#4CAF50] text-white rounded-[18px_4px_18px_18px]'
                  : !isStamp
                  ? 'bg-white text-gray-900 rounded-[4px_18px_18px_18px] shadow-sm'
                  : '',
              ].join(' ')}
            >
              {message.content}
            </div>
            {/* 削除メニュー */}
            {showMenu && (
              <div className="absolute bottom-full mb-1 right-0 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10">
                <button
                  onClick={() => { onDelete?.(message.id); setShowMenu(false); }}
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

          {/* 時刻＋既読 */}
          <div className={`flex flex-col text-[10px] text-gray-400 flex-shrink-0 ${isOwn ? 'items-end' : 'items-start'}`}>
            {isOwn && (
              <span className={isRead ? 'text-[#4CAF50]' : ''}>
                {isRead ? STATUS_ICON.read : STATUS_ICON[message.status]}
              </span>
            )}
            <span>{formatTime(message.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
