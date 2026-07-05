'use client';

import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallPrompt() {
  const { platform, show, promptInstall, dismiss } = useInstallPrompt();

  if (!show) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto z-40 px-3 pb-2">
      <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#4CAF50] flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {platform === 'ios' ? (
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-snug">
              共有ボタン<span className="mx-0.5">⬆</span>から「ホーム画面に追加」でアプリのように使えます
            </p>
          ) : (
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-snug">
              ホーム画面に追加すると、アプリのように使えます
            </p>
          )}
        </div>
        {platform === 'android' && (
          <button
            onClick={promptInstall}
            className="text-xs font-bold text-white bg-[#4CAF50] rounded-lg px-3 py-1.5 flex-shrink-0"
          >
            追加
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="閉じる"
          className="text-gray-300 dark:text-gray-500 flex-shrink-0 p-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
