'use client';

import { useState } from 'react';
import { User } from '@/lib/types';
import { useUserSearch } from '@/hooks/useUserSearch';
import { Avatar } from './Avatar';

type SearchResult = User | 'not_found' | null;

interface Props {
  selectedUsers: User[];
  onAdd: (user: User) => void;
  onRemove: (userId: string) => void;
  excludeIds: string[]; // すでにメンバーのユーザーID
}

export function UserSearchInput({ selectedUsers, onAdd, onRemove, excludeIds }: Props) {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<SearchResult>(null);
  const { searchByEmail, searching } = useUserSearch();

  const handleSearch = async () => {
    if (!email.trim()) return;
    const user = await searchByEmail(email);
    setResult(user ?? 'not_found');
  };

  const handleAdd = (user: User) => {
    onAdd(user);
    setEmail('');
    setResult(null);
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

      {/* 検索入力 */}
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="メールアドレスで検索"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setResult(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#4CAF50]"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !email.trim()}
          className="px-4 py-2 bg-[#4CAF50] text-white rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {searching ? '...' : '検索'}
        </button>
      </div>

      {/* 検索結果 */}
      {result === 'not_found' && (
        <p className="text-xs text-red-400 mt-2">ユーザーが見つかりません</p>
      )}
      {result && result !== 'not_found' && (
        <div className="mt-2 flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <Avatar user={result} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{result.display_name}</p>
            <p className="text-xs text-gray-400 truncate">{result.email}</p>
          </div>
          {excludeIds.includes(result.id) ? (
            <span className="text-xs text-gray-400 flex-shrink-0">メンバー</span>
          ) : selectedUsers.some((u) => u.id === result.id) ? (
            <span className="text-xs text-[#4CAF50] flex-shrink-0">追加済み</span>
          ) : (
            <button
              onClick={() => handleAdd(result as User)}
              className="text-xs bg-[#4CAF50] text-white px-3 py-1 rounded-full flex-shrink-0"
            >
              追加
            </button>
          )}
        </div>
      )}
    </div>
  );
}
