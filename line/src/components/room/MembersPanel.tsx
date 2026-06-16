'use client';

import { useEffect, useState } from 'react';
import { MemberRole, RoomMemberWithUser } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { UserSearchInput } from '@/components/ui/UserSearchInput';

interface Props {
  roomId: string;
  myRole: MemberRole | null;
  members: RoomMemberWithUser[];
  onKick: (userId: string) => Promise<boolean>;
  onChangeRole: (userId: string, role: MemberRole) => Promise<boolean>;
  onAddMember: (userId: string) => Promise<boolean>;
  onClose: () => void;
  onInvite: () => void;
  inviteUrl: string | null;
  inviteLoading: boolean;
}

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'オーナー',
  admin: '管理者',
  member: 'メンバー',
};

const ROLE_COLOR: Record<MemberRole, string> = {
  owner: 'bg-yellow-100 text-yellow-700',
  admin: 'bg-blue-100 text-blue-600',
  member: 'bg-gray-100 text-gray-500',
};

export function MembersPanel({
  myRole, members, onKick, onChangeRole, onAddMember, onClose, onInvite, inviteUrl, inviteLoading,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [addError, setAddError] = useState(false);

  const handleAddMember = async (userId: string) => {
    setAddError(false);
    const ok = await onAddMember(userId);
    if (!ok) setAddError(true);
  };

  useEffect(() => { if (inviteUrl) setCopied(false); }, [inviteUrl]);

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleKick = async (userId: string) => {
    if (!confirm('このメンバーを退出させますか？')) return;
    setActionUserId(userId);
    await onKick(userId);
    setActionUserId(null);
  };

  const handleRoleChange = async (userId: string, current: MemberRole) => {
    const next: MemberRole = current === 'admin' ? 'member' : 'admin';
    const label = next === 'admin' ? '管理者に昇格' : '管理者を解除';
    if (!confirm(`${label}しますか？`)) return;
    setActionUserId(userId);
    await onChangeRole(userId, next);
    setActionUserId(null);
  };

  const canManage = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-72 bg-white h-full shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-[#4CAF50] text-white px-4 py-4 flex items-center justify-between flex-shrink-0">
          <p className="font-bold text-base">メンバー管理</p>
          <button onClick={onClose} className="text-white/80">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 招待リンク（owner/admin のみ） */}
          {canManage && (
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-2 font-medium">招待リンク</p>
              {inviteUrl ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 break-all">{inviteUrl}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-[#4CAF50] text-white"
                    >
                      {copied ? 'コピーしました ✓' : 'リンクをコピー'}
                    </button>
                    <button
                      onClick={onInvite}
                      className="py-2 px-3 rounded-lg text-xs font-medium border border-gray-200 text-gray-500"
                      title="リンクを再生成"
                    >
                      🔄
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={onInvite}
                  disabled={inviteLoading}
                  className="w-full py-2 rounded-lg text-xs font-medium border border-[#4CAF50] text-[#4CAF50] disabled:opacity-50"
                >
                  {inviteLoading ? '生成中...' : '招待リンクを生成'}
                </button>
              )}
            </div>
          )}

          {/* メールで招待（owner/admin のみ・直接追加） */}
          {canManage && (
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-2 font-medium">メールで招待</p>
              <UserSearchInput
                selectedUsers={[]}
                onAdd={(u) => { void handleAddMember(u.id); }}
                onRemove={() => {}}
                excludeIds={members.map((m) => m.id)}
              />
              {addError && (
                <p className="text-xs text-red-400 mt-2">追加に失敗しました。権限をご確認ください。</p>
              )}
            </div>
          )}

          {/* メンバー一覧 */}
          <div className="px-4 py-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">{members.length}人のメンバー</p>
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Avatar user={m} size="sm" className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.display_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLOR[m.role]}`}>
                      {ROLE_LABEL[m.role]}
                    </span>
                  </div>
                  {/* owner/admin の操作メニュー（自分以外 / owner は操作不可） */}
                  {canManage && m.role !== 'owner' && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {myRole === 'owner' && (
                        <button
                          onClick={() => handleRoleChange(m.id, m.role)}
                          disabled={actionUserId === m.id}
                          className="text-[10px] px-2 py-0.5 rounded border border-blue-200 text-blue-500 disabled:opacity-50"
                        >
                          {m.role === 'admin' ? '解除' : '管理者'}
                        </button>
                      )}
                      <button
                        onClick={() => handleKick(m.id)}
                        disabled={actionUserId === m.id}
                        className="text-[10px] px-2 py-0.5 rounded border border-red-100 text-red-400 disabled:opacity-50"
                      >
                        退出
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
