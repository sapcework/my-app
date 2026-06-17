import Link from 'next/link';
import { ReactNode } from 'react';

// 法務/情報ページ共通シェル（戻るは設定へ。静的表示のためサーバーコンポーネント）
export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <Link href="/settings" className="text-white text-xl">‹</Link>
        <h1 className="text-lg font-bold flex-1">{title}</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-5 py-6 text-sm text-gray-700 leading-relaxed">
        {children}
      </main>
    </div>
  );
}
