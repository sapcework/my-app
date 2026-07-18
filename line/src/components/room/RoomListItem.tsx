'use client';

import Link from 'next/link';
import { Room, User } from '@/lib/types';
import { formatListTime } from '@/lib/datetime';
import { colorFromString } from '@/lib/color';
import { Avatar } from '@/components/ui/Avatar';

interface Props {
  room: Room;
  isMember: boolean;
  onJoin?: (roomId: string) => void;
  unreadCount?: number;
  dmPartner?: User; // DMルームの場合の相手ユーザー（表示名・アバターに使用）
}

export function RoomListItem({ room, isMember, onJoin, unreadCount = 0, dmPartner }: Props) {
  const preview = isMember
    ? (room.last_message_preview ?? '')
    : '参加していません';
  const title = dmPartner ? dmPartner.display_name : room.name; // DMは相手名を表示

  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 active:bg-gray-100 dark:active:bg-white/5 transition-colors">
      {/* アバター（DMは相手アバター、グループはルーム名から色分け） */}
      {dmPartner ? (
        <Avatar user={dmPartner} size="lg" className="!w-[52px] !h-[52px] !text-xl shadow-sm" />
      ) : (
        <div
          style={{ backgroundColor: colorFromString(room.name) }}
          className="w-[52px] h-[52px] rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xl shadow-sm"
        >
          {room.name[0]?.toUpperCase() ?? '#'}
        </div>
      )}

      {/* 本文 */}
      <div className="flex-1 min-w-0 border-b border-gray-100 dark:border-gray-800 pb-3 pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 truncate">{title}</span>
          <span className="text-[11px] text-gray-500 flex-shrink-0">{formatListTime(room.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between mt-[3px]">
          <span className="text-[13px] text-gray-500 truncate leading-snug">{preview}</span>
          {isMember && unreadCount > 0 && (
            <span className="ml-2 flex-shrink-0 bg-[#e53935] text-white text-[11px] font-bold rounded-full min-w-[19px] h-[19px] flex items-center justify-center px-1.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          {!isMember && (
            <button
              onClick={(e) => { e.preventDefault(); onJoin?.(room.id); }}
              className="ml-2 flex-shrink-0 text-[#4CAF50] text-xs border border-[#4CAF50] px-3 py-1 rounded-full"
            >
              参加
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return isMember
    ? <Link href={`/rooms/${room.id}`}>{inner}</Link>
    : <div>{inner}</div>;
}
