'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { AdminPageLayout } from '@/components/admin/AdminPageLayout';
import { User } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminUsersPage() {
  const { getUsers, suspendUser } = useAdmin();
  const [users, setUsers] = useState<User[]>([]);
  const [lockedEmails, setLockedEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [opError, setOpError] = useState('');

  // 新規ユーザー作成フォーム
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [createErr, setCreateErr] = useState('');

  const refreshUsers = () => getUsers().then(setUsers);

  useEffect(() => {
    Promise.all([
      getUsers(),
      fetch('/api/admin/locked-users').then((r) => r.json() as Promise<{ lockedEmails: string[] }>),
    ]).then(([userData, lockData]) => {
      setUsers(userData);
      setLockedEmails(new Set(lockData.lockedEmails ?? []));
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr('');
    setCreateMsg('');
    setCreating(true);
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, password: newPassword, displayName: newDisplayName }),
    });
    const data = await res.json() as { ok?: boolean; error?: string; username?: string };
    setCreating(false);
    if (data.ok) {
      setCreateMsg(`「${data.username}」を作成しました（ログインはこのユーザー名で）`);
      setNewUsername(''); setNewDisplayName(''); setNewPassword('');
      await refreshUsers();
    } else {
      setCreateErr(
        data.error === 'username_taken' ? 'そのユーザー名は既に使われています'
        : data.error === 'invalid_username' ? 'ユーザー名は英小文字・数字・_ の3〜20文字'
        : data.error === 'invalid_password' ? 'パスワードは6文字以上'
        : '作成に失敗しました'
      );
    }
  };

  const handleToggleSuspend = async (user: User) => {
    setUpdating(user.id);
    const ok = await suspendUser(user.id, !user.is_suspended);
    if (ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_suspended: !u.is_suspended } : u));
    } else {
      setOpError('操作に失敗しました');
      setTimeout(() => setOpError(''), 3000);
    }
    setUpdating(null);
  };

  const handleUnlock = async (user: User) => {
    setUpdating(`unlock-${user.id}`);
    const res = await fetch('/api/admin/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });
    if (res.ok) {
      setLockedEmails((prev) => { const s = new Set(prev); s.delete(user.email); return s; });
    } else {
      setOpError('ロック解除に失敗しました');
      setTimeout(() => setOpError(''), 3000);
    }
    setUpdating(null);
  };

  return (
    <AdminPageLayout>
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-gray-400 text-sm">読み込み中...</span>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* 新規ユーザー作成（メール不要・ユーザー名で発行） */}
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <p className="font-medium text-sm mb-1">新規ユーザーを作成</p>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="ユーザー名（英小文字・数字・_ / 3〜20字）"
              autoCapitalize="none"
              autoCorrect="off"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4CAF50]"
            />
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="表示名（任意・未入力ならユーザー名）"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4CAF50]"
            />
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="初期パスワード（6文字以上）"
              minLength={6}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4CAF50]"
            />
            {createErr && <p className="text-xs text-red-500">{createErr}</p>}
            {createMsg && <p className="text-xs text-green-600">{createMsg}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2 rounded-lg text-sm font-medium bg-[#4CAF50] text-white disabled:opacity-50"
            >
              {creating ? '作成中...' : 'アカウントを発行'}
            </button>
          </form>

          {opError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{opError}</p>}
          <p className="text-xs text-gray-400">{users.length}件</p>
          {users.map((user) => {
            const isLocked = lockedEmails.has(user.email);
            return (
              <div key={user.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#4CAF50] flex items-center justify-center text-white font-bold flex-shrink-0">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{user.display_name}</p>
                      {user.is_admin && (
                        <span className="text-xs bg-green-100 text-[#4CAF50] px-1.5 py-0.5 rounded">管理者</span>
                      )}
                      {user.is_suspended && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">停止中</span>
                      )}
                      {isLocked && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">ロック中</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
                    <p className="text-xs text-gray-300 mt-0.5">最終ログイン: {formatDate(user.last_seen)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {isLocked && (
                    <button
                      onClick={() => handleUnlock(user)}
                      disabled={updating === `unlock-${user.id}`}
                      className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors bg-orange-50 text-orange-600 border border-orange-200"
                    >
                      {updating === `unlock-${user.id}` ? '処理中...' : 'ログインロックを解除'}
                    </button>
                  )}
                  {!user.is_admin && (
                    <button
                      onClick={() => handleToggleSuspend(user)}
                      disabled={updating === user.id}
                      className={`w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
                        user.is_suspended
                          ? 'bg-green-50 text-green-600 border border-green-200'
                          : 'bg-red-50 text-red-500 border border-red-100'
                      }`}
                    >
                      {updating === user.id ? '処理中...' : user.is_suspended ? '停止を解除' : 'アカウントを停止'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminPageLayout>
  );
}
