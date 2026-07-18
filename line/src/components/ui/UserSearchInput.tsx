'use client';

import { useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { useUserSearch } from '@/hooks/useUserSearch';
import { Avatar } from './Avatar';

interface Props {
  selectedUsers: User[];
  onAdd: (user: User) => void;
  onRemove: (userId: string) => void;
  excludeIds: string[]; // すでにメンバーのユーザーID
  actionLabel?: string; // 各候補のアクションボタン文言（既定: 追加）
}

export function UserSearchInput({ selectedUsers, onAdd, onRemove, excludeIds, actionLabel = '追加' }: Props) {
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searched, setSearched] = useState(false); // 一度でも検索したか（該当なし表示の制御）
  const { searchUsersByEmail, searching } = useUserSearch();

  // 入力に応じてデバウンス検索（部分一致）
  useEffect(() => {
    const q = email.trim();
    if (!q) { setResults([]); setSearched(false); return; }
    const timer = setTimeout(async () => {
      const users = await searchUsersByEmail(q);
      setResults(users);
      setSearched(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = (user: User) => {
    onAdd(user);
    setEmail('');
    setResults([]);
    setSearched(false);
  };

  return (
    <div>
      {/* 選択済みユーザー */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-1 bg-[#4CAF50]/10 rounded-full px-2 py-1">
              <span className="text-xs text-[#4CAF50] font-medium">{u.display_name}</span>
              <button onClick={() => onRemove(u.id)} className="text-gray-400 text-xs ml-0.5 leading-none">×</button>
            </div>
          ))}
        </div>
      )}

      {/* 検索入力（部分一致・入力中に候補表示） */}
      <div className="relative">
        <input
          type="text"
          inputMode="email"
          placeholder="メールアドレスの一部で検索"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#4CAF50]"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">検索中...</span>
        )}
      </div>

      {/* 検索結果リスト */}
      {searched && results.length === 0 && !searching && (
        <p className="text-xs text-red-400 mt-2">該当するユーザーが見つかりません</p>
      )}
      {results.length > 0 && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-100">
          {results.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50">
              <Avatar user={u} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.display_name}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              {excludeIds.includes(u.id) ? (
                <span className="text-xs text-gray-400 flex-shrink-0">メンバー</span>
              ) : selectedUsers.some((s) => s.id === u.id) ? (
                <span className="text-xs text-[#4CAF50] flex-shrink-0">追加済み</span>
              ) : (
                <button
                  onClick={() => handleAdd(u)}
                  className="text-xs bg-[#4CAF50] text-white px-3 py-1 rounded-full flex-shrink-0"
                >
                  {actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
