'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRooms } from '@/hooks/useRooms';
import { RoomListItem } from '@/components/room/RoomListItem';
import { BottomNav } from '@/components/ui/BottomNav';
import { Avatar } from '@/components/ui/Avatar';
import { UserSearchInput } from '@/components/ui/UserSearchInput';
import { User } from '@/lib/types';

export default function RoomsPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { rooms, memberRoomIds, unreadCounts, dmPartners, loading: roomsLoading, createRoom, createDm } = useRooms(profile?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'dm' | 'group'>('dm'); // モーダルの種別（1対1 / グループ）
  const [roomName, setRoomName] = useState('');
  const [inviteUsers, setInviteUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [startingDm, setStartingDm] = useState(false);

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
  }, [authLoading, profile, router]);

  if (authLoading || !profile) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><span className="text-gray-400">読み込み中...</span></div>;
  }

  const handleCreate = async () => {
    if (!roomName.trim() || creating) return;
    setCreating(true);
    const room = await createRoom(roomName.trim(), inviteUsers.map((u) => u.id));
    setCreating(false);
    if (room) {
      setRoomName('');
      setInviteUsers([]);
      setShowCreate(false);
      router.push(`/rooms/${room.id}`);
    } else {
      alert('グループの作成に失敗しました。通信環境を確認して再度お試しください。'); // 失敗を無言にしない
    }
  };

  // 1対1トーク：ユーザーを選んだ瞬間にDMを開く（既存があれば再利用）
  const handleStartDm = async (u: User) => {
    if (startingDm) return;
    setStartingDm(true);
    const room = await createDm(u.id);
    setStartingDm(false);
    if (room) {
      setShowCreate(false);
      router.push(`/rooms/${room.id}`);
    } else {
      alert('このユーザーとはトークを開始できません'); // ブロック関係・通信エラー等
    }
  };

  const closeCreate = () => {
    setShowCreate(false);
    setRoomName('');
    setInviteUsers([]);
    setCreateMode('dm');
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#121212] max-w-lg mx-auto">
      {/* ヘッダー */}
      <header className="bg-[#4CAF50] text-white flex items-center justify-between px-4 py-3 pt-safe flex-shrink-0">
        <h1 className="text-[17px] font-bold">トーク</h1>
        <div className="flex items-center gap-4">
          {/* 検索アイコン */}
          <button className="text-white opacity-90">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </button>
          {/* 新規作成 */}
          <button onClick={() => setShowCreate(true)} className="text-white opacity-90">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
          {/* アバター */}
          <button onClick={() => router.push('/settings')}>
            <Avatar user={profile} size="sm" className="ring-2 ring-white/70" />
          </button>
        </div>
      </header>

      {/* ルーム一覧 */}
      <main className="flex-1 overflow-y-auto pb-16 bg-white dark:bg-[#121212]">
        {roomsLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">読み込み中...</div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="opacity-30">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
            <p className="text-sm">トークがありません</p>
            <p className="text-xs">＋ボタンから作成してください</p>
          </div>
        ) : (
          rooms.map((room) => (
            <RoomListItem
              key={room.id}
              room={room}
              isMember={memberRoomIds.has(room.id)}
              onJoin={(id) => router.push(`/rooms/${id}`)}
              unreadCount={unreadCounts[room.id] ?? 0}
              dmPartner={room.is_dm ? dmPartners[room.id] : undefined}
            />
          ))
        )}
      </main>

      <BottomNav />

      {/* トーク作成モーダル（1対1 / グループ 切替） */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={closeCreate}>
          <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-lg mx-auto rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-5" />

            {/* 種別切替 */}
            <div className="flex bg-gray-100 dark:bg-[#2a2a2a] rounded-xl p-1 mb-5">
              <button
                onClick={() => setCreateMode('dm')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${createMode === 'dm' ? 'bg-white dark:bg-[#3a3a3a] text-[#4CAF50] shadow-sm' : 'text-gray-500'}`}
              >
                1対1トーク
              </button>
              <button
                onClick={() => setCreateMode('group')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${createMode === 'group' ? 'bg-white dark:bg-[#3a3a3a] text-[#4CAF50] shadow-sm' : 'text-gray-500'}`}
              >
                グループ
              </button>
            </div>

            {createMode === 'dm' ? (
              /* 1対1: ユーザーを検索してタップで即トーク開始 */
              <>
                <h2 className="text-[17px] font-bold mb-2 dark:text-gray-100">ユーザーを検索してトーク</h2>
                <p className="text-xs text-gray-400 mb-3">名前やメールアドレスで相手を探して、1対1トークを始めます</p>
                <UserSearchInput
                  selectedUsers={[]}
                  onAdd={handleStartDm}
                  onRemove={() => {}}
                  excludeIds={[profile.id]}
                  actionLabel={startingDm ? '...' : 'トーク'}
                />
                <button
                  onClick={closeCreate}
                  className="w-full mt-5 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm"
                >
                  キャンセル
                </button>
              </>
            ) : (
              /* グループ: 名前＋メンバーを指定して作成 */
              <>
                <h2 className="text-[17px] font-bold mb-4 dark:text-gray-100">新しいグループを作成</h2>
                <input
                  type="text"
                  placeholder="グループ名"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-[#2a2a2a] dark:text-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#4CAF50] mb-4"
                />
                <p className="text-xs text-gray-400 mb-2">メンバーを招待（任意）</p>
                <UserSearchInput
                  selectedUsers={inviteUsers}
                  onAdd={(u) => setInviteUsers((prev) => [...prev, u])}
                  onRemove={(id) => setInviteUsers((prev) => prev.filter((u) => u.id !== id))}
                  excludeIds={[profile.id]}
                />
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={closeCreate}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!roomName.trim() || creating}
                    className="flex-1 py-3 rounded-xl bg-[#4CAF50] text-white font-bold text-sm disabled:opacity-50"
                  >
                    {creating ? '作成中...' : '作成'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
