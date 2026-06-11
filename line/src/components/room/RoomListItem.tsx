'use client';

import Link from 'next/link';
import { Room } from '@/lib/types';

interface Props {
  room: Room;
  isMember: boolean;
  onJoin?: (roomId: string) => void;
  lastMessage?: string;
  unreadCount?: number;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

export function RoomListItem({ room, isMember, onJoin, lastMessage, unreadCount }: Props) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
      {/* アイコン */}
      <div className="w-12 h-12 rounded-full bg-[#4CAF50] flex-shrink-0 flex items-center justify-center text-white font-bold text-lg">
        {room.name[0]?.toUpperCase() ?? '#'}
      </div>

      {/* 本文 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900 truncate">{room.name}</span>
          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
            {formatTime(room.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-gray-500 truncate">
            {isMember ? (lastMessage ?? '...') : '参加していません'}
          </span>
          {isMember && (unreadCount ?? 0) > 0 && (
            <span className="ml-2 flex-shrink-0 bg-[#4CAF50] text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {unreadCount! > 99 ? '99+' : unreadCount}
            </span>
          )}
          {!isMember && (
            <button
              onClick={(e) => { e.preventDefault(); onJoin?.(room.id); }}
              className="ml-2 flex-shrink-0 bg-[#4CAF50] text-white text-xs px-3 py-1 rounded-full"
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
