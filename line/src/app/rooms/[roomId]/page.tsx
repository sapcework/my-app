'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useReactions } from '@/hooks/useReactions';
import { useRoomMute } from '@/hooks/useRoomMute';
import { useReadStatus } from '@/hooks/useReadStatus';
import { useOnlineUsers } from '@/hooks/useOnline';
import { useRooms } from '@/hooks/useRooms';
import { useRoomMembers } from '@/hooks/useRoomMembers';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { MembersPanel } from '@/components/room/MembersPanel';
import { createClient } from '@/lib/supabase/client';
import { useTabNotification } from '@/hooks/useTabNotification';
import { Room, MessageWithStatus } from '@/lib/types';

interface Props {
  params: Promise<{ roomId: string }>;
}

export default function ChatPage({ params }: Props) {
  const { roomId } = use(params);
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { messages, loading: msgLoading, sendMessage, sendImage, deleteMessage, retryMessage } = useMessages(roomId, profile?.id ?? null);
  const { reactions, toggleReaction } = useReactions(roomId, profile?.id ?? null);
  const { muted, toggleMute } = useRoomMute(roomId, profile?.id ?? null);
  const { leaveRoom, updateRoomName } = useRooms(profile?.id ?? null);
  const { members, myRole, loading: membersLoading, kickMember, changeRole, addMember, refetch: refetchMembers } = useRoomMembers(roomId, profile?.id ?? null);
  const [rejoining, setRejoining] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [otherLastReadMessageId, setOtherLastReadMessageId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<MessageWithStatus | null>(null);

  // 返信付き送信（送信後に返信状態を解除）
  const handleSendText = (content: string, type: 'text' | 'stamp') => {
    sendMessage(content, type, replyingTo?.id ?? null);
    setReplyingTo(null);
  };
  const replySnippet = (m: MessageWithStatus) =>
    m.type === 'image' ? '画像' : m.type === 'stamp' ? 'スタンプ' : (m.content.length > 30 ? m.content.slice(0, 30) + '…' : m.content);
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
      if (data) { setRoom(data as Room); setBaseTitle(`${(data as Room).name || 'トーク'} | LINE Chat`); }
    });
  }, [roomId, setBaseTitle]);

  // DMはメンバー確定後に相手名をタブタイトルへ反映
  useEffect(() => {
    if (!room?.is_dm || !profile) return;
    const partner = members.find((m) => m.id !== profile.id);
    if (partner) setBaseTitle(`${partner.display_name} | LINE Chat`);
  }, [room?.is_dm, members, profile, setBaseTitle]);

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

  const handleFetchInvite = async (forceNew = false) => {
    setInviteLoading(true);
    const method = forceNew ? 'DELETE' : 'GET';
    const res = await fetch(`/api/rooms/${roomId}/invite`, { method });
    if (res.ok) {
      const d = await res.json() as { invite: { token: string } };
      const base = window.location.origin;
      setInviteUrl(`${base}/join/${d.invite.token}`);
    }
    setInviteLoading(false);
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

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
  }, [authLoading, profile, router]);

  // メンバーでない場合に作成者として自動再参加
  useEffect(() => {
    if (!profile || membersLoading || myRole !== null || rejoining) return;
    setRejoining(true);
    fetch(`/api/rooms/${roomId}/rejoin`, { method: 'POST' })
      .then(async (res) => {
        if (res.ok) {
          await refetchMembers(); // 再参加後にメンバー情報を再取得
        } else {
          router.push('/rooms'); // 作成者でない → 一覧に戻る
        }
        setRejoining(false);
      })
      .catch(() => { router.push('/rooms'); setRejoining(false); });
  }, [profile, membersLoading, myRole, rejoining, roomId, refetchMembers, router]);

  if (authLoading || !profile || rejoining || (membersLoading && myRole === null)) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><span className="text-gray-400">読み込み中...</span></div>;
  }

  // 相手のオンライン状態（自分以外の最初のメンバー）
  const otherOnlineEntry = Object.entries(onlineMap).find(([uid]) => uid !== profile.id);
  const isOtherOnline = otherOnlineEntry?.[1] ?? false;

  // DMの場合は相手（自分以外のメンバー）の名前をタイトルに使う
  const isDm = room?.is_dm ?? false;
  const dmPartner = isDm ? members.find((m) => m.id !== profile.id) : undefined;
  const headerTitle = dmPartner ? dmPartner.display_name : (room?.name ?? '...');

  return (
    <div className="flex flex-col h-screen bg-[#b2d8ea] dark:bg-[#0e1c24] max-w-lg mx-auto">
      {/* ヘッダー */}
      <header className="bg-[#4CAF50] text-white flex items-center gap-2 px-3 py-2 pt-safe shadow-sm flex-shrink-0">
        <button onClick={() => router.back()} aria-label="戻る" className="text-white p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <div className="flex flex-col flex-1 min-w-0 ml-1">
          <span className="font-bold text-[15px] truncate">{headerTitle}</span>
          {isOtherOnline && (
            <span className="text-[11px] text-green-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full inline-block" />
              オンライン
            </span>
          )}
        </div>
        {/* 通話アイコン（視覚のみ） */}
        <button aria-label="音声通話" className="text-white/80 p-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </button>
        {/* ビデオアイコン（視覚のみ） */}
        <button aria-label="ビデオ通話" className="text-white/80 p-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        </button>
        {/* 検索 */}
        <button onClick={() => { setShowSearch((v) => !v); setSearchQuery(''); }} aria-label="メッセージを検索" className="text-white/80 p-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>
        {/* メニュー */}
        <button onClick={() => setShowMenu(true)} aria-label="メニュー" className="text-white/80 p-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </header>

      {/* 検索バー */}
      {showSearch && (
        <div className="bg-[#4CAF50] px-3 pb-2 flex-shrink-0">
          <input
            type="search"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="メッセージを検索..."
            className="w-full rounded-xl px-4 py-2 text-sm outline-none bg-white text-gray-900 placeholder-gray-400"
          />
        </div>
      )}

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
          onRetry={retryMessage}
          onReply={setReplyingTo}
          reactions={reactions}
          onReact={toggleReaction}
          searchQuery={showSearch ? searchQuery : undefined}
        />
      )}

      {/* 入力バー */}
      <div className="flex-shrink-0">
        <MessageInput
          onSend={handleSendText}
          onSendImage={sendImage}
          replyingTo={replyingTo ? { senderName: replyingTo.sender?.display_name ?? '', snippet: replySnippet(replyingTo) } : null}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>

      {/* サイドメニュー */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowMenu(false)}>
          <div className="flex-1" />
          <div className="w-64 bg-white dark:bg-[#1e1e1e] h-full shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#4CAF50] text-white px-4 py-4">
              <p className="font-bold text-lg truncate">{headerTitle}</p>
            </div>
            <div className="flex-1 p-4">
              {/* owner/admin のみ（DMではグループ管理を非表示） */}
              {!isDm && (myRole === 'owner' || myRole === 'admin') && (
                <>
                  <button
                    onClick={() => { setShowMenu(false); setShowMembers(true); if (!inviteUrl) handleFetchInvite(); }}
                    className="w-full text-left text-gray-700 dark:text-gray-200 font-medium py-3 border-b border-gray-100 dark:border-gray-800"
                  >
                    メンバー管理・招待
                  </button>
                  <button
                    onClick={handleRenameOpen}
                    className="w-full text-left text-gray-700 dark:text-gray-200 font-medium py-3 border-b border-gray-100 dark:border-gray-800"
                  >
                    グループ名を変更
                  </button>
                </>
              )}
              <button
                onClick={toggleMute}
                className="w-full text-left text-gray-700 dark:text-gray-200 font-medium py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"
              >
                <span>通知をミュート</span>
                <span className={`text-xs ${muted ? 'text-[#4CAF50]' : 'text-gray-400'}`}>{muted ? 'ON' : 'OFF'}</span>
              </button>
              {/* DMは退出＝membership削除で重複DMが生じるため無効化（グループのみ退出可） */}
              {!isDm && (
                <button
                  onClick={() => { setShowMenu(false); setShowLeaveConfirm(true); }}
                  className="w-full text-left text-red-500 font-medium py-3 border-b border-gray-100"
                >
                  トークを退出
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* メンバー管理パネル */}
      {showMembers && (
        <MembersPanel
          roomId={roomId}
          myRole={myRole}
          members={members}
          onKick={kickMember}
          onChangeRole={changeRole}
          onAddMember={addMember}
          onClose={() => setShowMembers(false)}
          onInvite={() => handleFetchInvite(!!inviteUrl)}
          inviteUrl={inviteUrl}
          inviteLoading={inviteLoading}
        />
      )}

      {/* グループ名変更ダイアログ */}
      {editingName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 w-full max-w-sm">
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
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 w-full max-w-sm">
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
