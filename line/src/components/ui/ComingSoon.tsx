import { BottomNav } from '@/components/ui/BottomNav';

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#121212]">
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <h1 className="text-lg font-bold flex-1">{title}</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center pb-20 px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-[#4CAF50]/10 flex items-center justify-center mb-5"> {/* アイコン背景 */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" /> {/* 時計の針 */}
          </svg>
        </div>
        <h2 className="text-base font-bold text-gray-700 dark:text-gray-200 mb-2">準備中です</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          「{title}」機能は現在開発中です。<br />
          もうしばらくお待ちください。
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
