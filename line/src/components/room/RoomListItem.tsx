'use client';

import Link from 'next/link';
import { Room } from '@/lib/types';
import { formatListTime } from '@/lib/datetime';

interface Props {
  room: Room;
  isMember: boolean;
  onJoin?: (roomId: string) => void;
  unreadCount?: number;
}

export function RoomListItem({ room, isMember, onJoin, unreadCount = 0 }: Props) {
  const preview = isMember
    ? (room.last_message_preview ?? '')
    : '参加していません';

  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 active:bg-gray-100 transition-colors">
      {/* アバター */}
      <div className="w-[52px] h-[52px] rounded-full bg-[#6db36e] flex-shrink-0 flex items-center justify-center text-white font-bold text-xl shadow-sm">
        {room.name[0]?.toUpperCase() ?? '#'}
      </div>

      {/* 本文 */}
      <div className="flex-1 min-w-0 border-b border-gray-100 pb-3 pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-[15px] text-gray-900 truncate">{room.name}</span>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{formatListTime(room.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between mt-[3px]">
          <span className="text-[13px] text-gray-400 truncate leading-snug">{preview}</span>
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
