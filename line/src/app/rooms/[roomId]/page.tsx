'use client';

export const dynamic = 'force-dynamic';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useReadStatus } from '@/hooks/useReadStatus';
import { useOnlineUsers } from '@/hooks/useOnline';
import { useRooms } from '@/hooks/useRooms';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { createClient } from '@/lib/supabase/client';
import { useTabNotification } from '@/hooks/useTabNotification';
import { UserSearchInput } from '@/components/ui/UserSearchInput';
import { Room, User } from '@/lib/types';

interface Props {
  params: Promise<{ roomId: string }>;
}

export default function ChatPage({ params }: Props) {
  const { roomId } = use(params);
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { messages, loading: msgLoading, sendMessage, sendImage, deleteMessage } = useMessages(roomId, profile?.id ?? null);
  const { leaveRoom, updateRoomName, addMember } = useRooms(profile?.id ?? null);
  const [room, setRoom] = useState<Room | null>(null);
  const [otherLastReadMessageId, setOtherLastReadMessageId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberUsers, setAddMemberUsers] = useState<User[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const { notify, setBaseTitle } = useTabNotification();
  const initializedRef = useRef(false);
  const prevMsgCountRef = useRef(0);
  const onlineMap = useOnlineUsers(roomId);

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const { subscribeToReads, getOtherLastRead } = useReadStatus(roomId, profile?.id ?? null, lastMessageId);

  // ルーム情報取得
  useEffect(() => {
    const supabase = createClient();
    supabase.from('rooms').select('*').eq('id', roomId).single().then(({ data }) => {
      if (data) { setRoom(data as Room); setBaseTitle(`${(data as Room).name} | LINE Chat`); }
    });
  }, [roomId, setBaseTitle]);

  // 他ユーザーのメッセージ到着時にタブ通知
  useEffect(() => {
    if (msgLoading) return;
    if (!initializedRef.current) { // 初回ロード時はカウントのみ記録
      initializedRef.current = true;
      prevMsgCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMsgCountRef.current) {
      const added = messages.slice(prevMsgCountRef.current);
      if (added.some((m) => m.sender_id !== profile?.id)) notify();
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, msgLoading, profile?.id, notify]);

  // 初期既読状態を取得
  useEffect(() => {
    if (!profile) return;
    getOtherLastRead().then((id) => { if (id) setOtherLastReadMessageId(id); });
  }, [profile, getOtherLastRead]);

  // 既読状態をリアルタイム購読
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToReads((_, messageId) => {
      setOtherLastReadMessageId(messageId);
    });
    return unsub;
  }, [profile, subscribeToReads]);

  const handleLeave = async () => {
    setLeaving(true);
    await leaveRoom(roomId);
    setLeaving(false);
    router.push('/rooms');
  };

  const handleAddMembers = async () => {
    if (!addMemberUsers.length) return;
    setAddingMembers(true);
    await Promise.all(addMemberUsers.map((u) => addMember(roomId, u.id)));
    setAddingMembers(false);
    setAddMemberUsers([]);
    setShowAddMember(false);
  };

  const handleRenameOpen = () => {
    setNewRoomName(room?.name ?? '');
    setEditingName(true);
    setShowMenu(false);
  };

  const handleRenameSave = async () => {
    if (!newRoomName.trim()) return;
    setSavingName(true);
    const ok = await updateRoomName(roomId, newRoomName);
    if (ok) setRoom((prev) => prev ? { ...prev, name: newRoomName.trim() } : prev);
    setSavingName(false);
    setEditingName(false);
  };

  if (authLoading) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><span className="text-gray-400">読み込み中...</span></div>;
  }

  if (!profile) {
    router.push('/login');
    return null;
  }

  // 相手のオンライン状態（自分以外の最初のメンバー）
  const otherOnlineEntry = Object.entries(onlineMap).find(([uid]) => uid !== profile.id);
  const isOtherOnline = otherOnlineEntry?.[1] ?? false;

  return (
    <div className="flex flex-col h-screen bg-[#b2d8ea]">
      {/* ヘッダー */}
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <button onClick={() => router.back()} className="text-white text-xl">‹</button>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-bold truncate">{room?.name ?? '...'}</span>
          {isOtherOnline && (
            <span className="text-xs text-green-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full inline-block" />
              オンライン
            </span>
          )}
        </div>
        <button onClick={() => setShowMenu(true)} className="text-white text-xl">☰</button>
      </header>

      {/* メッセージ一覧 */}
      {msgLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-500 text-sm">読み込み中...</span>
        </div>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={profile.id}
          otherLastReadMessageId={otherLastReadMessageId}
          onDelete={deleteMessage}
        />
      )}

      {/* 入力バー */}
      <div className="flex-shrink-0">
        <MessageInput onSend={sendMessage} onSendImage={sendImage} />
      </div>

      {/* サイドメニュー */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowMenu(false)}>
          <div className="flex-1" />
          <div className="w-64 bg-white h-full shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#4CAF50] text-white px-4 py-4">
              <p className="font-bold text-lg truncate">{room?.name ?? '...'}</p>
            </div>
            <div className="flex-1 p-4">
              <button
                onClick={() => { setShowMenu(false); setShowAddMember(true); }}
                className="w-full text-left text-gray-700 font-medium py-3 border-b border-gray-100"
              >
                メンバーを追加
              </button>
              <button
                onClick={handleRenameOpen}
                className="w-full text-left text-gray-700 font-medium py-3 border-b border-gray-100"
              >
                グループ名を変更
              </button>
              <button
                onClick={() => { setShowMenu(false); setShowLeaveConfirm(true); }}
                className="w-full text-left text-red-500 font-medium py-3 border-b border-gray-100"
              >
                トークを退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メンバー追加ダイアログ */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">メンバーを追加</h2>
            <UserSearchInput
              selectedUsers={addMemberUsers}
              onAdd={(u) => setAddMemberUsers((prev) => [...prev, u])}
              onRemove={(id) => setAddMemberUsers((prev) => prev.filter((u) => u.id !== id))}
              excludeIds={profile ? [profile.id] : []}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowAddMember(false); setAddMemberUsers([]); }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddMembers}
                disabled={addingMembers || !addMemberUsers.length}
                className="flex-1 py-3 rounded-xl bg-[#4CAF50] text-white font-bold disabled:opacity-50"
              >
                {addingMembers ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* グループ名変更ダイアログ */}
      {editingName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">グループ名を変更</h2>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSave()}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#4CAF50]"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setEditingName(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleRenameSave}
                disabled={savingName || !newRoomName.trim()}
                className="flex-1 py-3 rounded-xl bg-[#4CAF50] text-white font-bold disabled:opacity-50"
              >
                {savingName ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 退出確認ダイアログ */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">トークを退出</h2>
            <p className="text-gray-500 text-sm mb-6">このトークから退出しますか？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50"
              >
                {leaving ? '退出中...' : '退出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
