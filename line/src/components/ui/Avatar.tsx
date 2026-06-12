'use client';

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
  return (
    <div className={`${SIZE[size]} rounded-full bg-[#4CAF50] flex-shrink-0 flex items-center justify-center font-bold text-white overflow-hidden ${className}`}>
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
      ) : (
        user?.display_name?.[0]?.toUpperCase() ?? '?'
      )}
    </div>
  );
}
