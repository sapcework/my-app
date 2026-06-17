'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/rooms',
    label: 'トーク',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      </svg>
    ),
  },
  {
    href: '/voom',
    label: 'VOOM',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
      </svg>
    ),
  },
  {
    href: '/news',
    label: 'ニュース',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 12H7v-2h8v2zm3-4H7v-2h11v2zm0-4H7V6h11v2z" />
      </svg>
    ),
  },
  {
    href: '/wallet',
    label: 'ウォレット',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'マイページ',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-gray-700 flex z-50">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${active ? 'text-[#4CAF50]' : 'text-gray-400'}`}
          >
            {icon}
            <span className={`text-[10px] font-medium mt-0.5 ${active ? 'text-[#4CAF50]' : 'text-gray-400'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
