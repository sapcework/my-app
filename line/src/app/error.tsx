'use client';

import { useEffect } from 'react';
import { BottomNav } from '@/components/ui/BottomNav';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#121212]">
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <h1 className="text-lg font-bold flex-1">エラーが発生しました</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center pb-20 px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-5">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-gray-700 dark:text-gray-200 mb-2">予期しないエラーが発生しました</h2>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          お手数ですが、もう一度お試しください。<br />
          解決しない場合はアプリを再起動してください。
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-[#4CAF50] text-white rounded-xl font-medium text-sm"
        >
          再試行
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
