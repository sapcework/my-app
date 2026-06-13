'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAdmin, AdminStats } from '@/hooks/useAdmin';
import { AdminPageLayout } from '@/components/admin/AdminPageLayout';
import { User } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminDashboard() {
  const { getStats, getUsers } = useAdmin();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getUsers()]).then(([s, u]) => {
      setStats(s);
      setRecentUsers(u.slice(0, 5)); // 最新5件のみ表示
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AdminPageLayout>
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-gray-400 text-sm">読み込み中...</span>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 統計カード */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'ユーザー', value: stats?.userCount ?? 0 },
              { label: 'ルーム', value: stats?.roomCount ?? 0 },
              { label: 'メッセージ', value: stats?.messageCount ?? 0 },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-[#4CAF50]">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* 最近のユーザー */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">最近のユーザー</h2>
            </div>
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-[#4CAF50] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.display_name}</p>
                  <p className="text-xs text-gray-400 truncate">{formatDate(user.last_seen)}</p>
                </div>
                {user.is_suspended && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">停止中</span>
                )}
                {user.is_admin && (
                  <span className="text-xs bg-green-100 text-[#4CAF50] px-2 py-0.5 rounded-full">管理者</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
