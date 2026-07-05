import Link from 'next/link';
import { BottomNav } from '@/components/ui/BottomNav';

export default function NotFound() {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#121212]">
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <h1 className="text-lg font-bold flex-1">ページが見つかりません</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center pb-20 px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-[#4CAF50]/10 flex items-center justify-center mb-5"> {/* アイコン背景 */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01" /> {/* ！の点 */}
            <path d="M12 12v4" /> {/* ！の縦棒 */}
          </svg>
        </div>
        <h2 className="text-base font-bold text-gray-700 dark:text-gray-200 mb-2">404 - ページが見つかりません</h2>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          お探しのページは存在しないか、<br />
          移動した可能性があります。
        </p>
        <Link
          href="/rooms"
          className="px-6 py-2.5 bg-[#4CAF50] text-white rounded-xl font-medium text-sm" // トークに戻る導線
        >
          トークに戻る
        </Link>
      </main>

      <BottomNav />
    </div>
  );
}
