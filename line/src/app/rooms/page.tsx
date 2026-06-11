'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRooms } from '@/hooks/useRooms';
import { RoomListItem } from '@/components/room/RoomListItem';
import { BottomNav } from '@/components/ui/BottomNav';

export default function RoomsPage() {
  const router = useRouter();
  const { profile, signOut, loading: authLoading } = useAuth();
  const { rooms, memberRoomIds, loading: roomsLoading, createRoom, joinRoom } = useRooms(profile?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);

  if (authLoading) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><span className="text-gray-400">読み込み中...</span></div>;
  }

  if (!profile) {
    router.push('/login');
    return null;
  }

  const handleCreate = async () => {
    if (!roomName.trim() || creating) return;
    setCreating(true);
    const room = await createRoom(roomName.trim(), []);
    setCreating(false);
    if (room) {
      setRoomName('');
      setShowCreate(false);
      router.push(`/rooms/${room.id}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-[#4CAF50] text-white flex items-center justify-between px-4 py-3 pt-safe">
        <h1 className="text-lg font-bold">トーク</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreate(true)} className="text-white text-2xl leading-none">＋</button>
          <button
            onClick={signOut}
            className="text-xs bg-white/20 px-3 py-1 rounded-full"
          >
            {profile.display_name}
          </button>
        </div>
      </header>

      {/* ルーム一覧 */}
      <main className="flex-1 overflow-y-auto divide-y divide-gray-100 pb-16">
        {roomsLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">読み込み中...</div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <span className="text-4xl">💬</span>
            <p className="text-sm">トークがありません。＋から作成してください</p>
          </div>
        ) : (
          rooms.map((room) => (
            <RoomListItem
              key={room.id}
              room={room}
              isMember={memberRoomIds.has(room.id)}
              onJoin={joinRoom}
            />
          ))
        )}
      </main>

      <BottomNav />

      {/* ルーム作成モーダル */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full rounded-t-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">新しいトークを作成</h2>
            <input
              type="text"
              placeholder="トーク名"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#4CAF50]"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={!roomName.trim() || creating}
                className="flex-1 py-3 rounded-xl bg-[#4CAF50] text-white font-bold disabled:opacity-50"
              >
                {creating ? '作成中...' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
