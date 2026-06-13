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
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [opError, setOpError] = useState('');

  useEffect(() => {
    getUsers().then((data) => { setUsers(data); setLoading(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <AdminPageLayout>
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-gray-400 text-sm">読み込み中...</span>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {opError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{opError}</p>}
          <p className="text-xs text-gray-400">{users.length}件</p>
          {users.map((user) => (
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
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
                  <p className="text-xs text-gray-300 mt-0.5">最終ログイン: {formatDate(user.last_seen)}</p>
                </div>
              </div>
              {!user.is_admin && (
                <button
                  onClick={() => handleToggleSuspend(user)}
                  disabled={updating === user.id}
                  className={`mt-3 w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
                    user.is_suspended
                      ? 'bg-green-50 text-green-600 border border-green-200'
                      : 'bg-red-50 text-red-500 border border-red-100'
                  }`}
                >
                  {updating === user.id ? '処理中...' : user.is_suspended ? '停止を解除' : 'アカウントを停止'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminPageLayout>
  );
}
