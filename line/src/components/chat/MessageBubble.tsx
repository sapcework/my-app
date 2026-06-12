'use client';

import { MessageWithStatus, User } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';

interface Props {
  message: MessageWithStatus;
  isOwn: boolean;
  isRead: boolean;
  sender?: User;
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

export function MessageBubble({ message, isOwn, isRead, sender }: Props) {
  const isStamp = message.type === 'stamp';

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
          <div
            className={[
              'px-3 py-2 max-w-full break-words',
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
