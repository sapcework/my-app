'use client';

import { colorFromString } from '@/lib/color';

interface Props {
  user?: { display_name: string; avatar_url: string | null } | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<string, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-20 h-20 text-2xl',
};

export function Avatar({ user, size = 'md', className = '' }: Props) {
  const name = user?.display_name ?? '';
  const bg = name ? colorFromString(name) : '#9e9e9e'; // 名前から決定的に色分け
  return (
    <div
      style={{ backgroundColor: user?.avatar_url ? undefined : bg }}
      className={`${SIZE[size]} rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white overflow-hidden ${className}`}
    >
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt={name || 'ユーザー'} loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        name[0]?.toUpperCase() ?? '?'
      )}
    </div>
  );
}
