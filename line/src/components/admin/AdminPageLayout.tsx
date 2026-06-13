'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const TABS = [
  { label: 'ダッシュボード', href: '/admin' },
  { label: 'ユーザー', href: '/admin/users' },
  { label: 'ルーム', href: '/admin/rooms' },
];

interface Props {
  children: React.ReactNode;
}

export function AdminPageLayout({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <button onClick={() => router.push('/rooms')} className="text-white text-xl">‹</button>
        <h1 className="text-lg font-bold flex-1">管理者画面</h1>
      </header>

      <nav className="bg-white border-b border-gray-200 flex flex-shrink-0">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 py-3 text-center text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[#4CAF50] text-[#4CAF50]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
