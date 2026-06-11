'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/rooms', label: 'トーク', icon: '💬' },
  { href: '/contacts', label: '友だち', icon: '👥' },
  { href: '/news', label: 'ニュース', icon: '📰' },
  { href: '/wallet', label: 'ウォレット', icon: '💳' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 flex z-50">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${active ? 'text-[#4CAF50]' : 'text-gray-400'}`}
          >
            <span className="text-xl">{icon}</span>
            <span className={`font-medium ${active ? 'text-[#4CAF50]' : 'text-gray-400'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
