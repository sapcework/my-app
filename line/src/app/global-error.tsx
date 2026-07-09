'use client';

import { useEffect } from 'react';
import './globals.css';

// ルートレイアウト自体が例外を投げた場合に発火する最後の砦。
// 通常のerror.tsxと違い<html>/<body>から自前で描画する必要がある。
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ja">
      <body className="antialiased">
        <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center bg-gray-50">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-5">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-base font-bold text-gray-700 mb-2">アプリの読み込みに失敗しました</h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            お手数ですが、もう一度お試しください。
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-[#4CAF50] text-white rounded-xl font-medium text-sm"
          >
            再試行
          </button>
        </div>
      </body>
    </html>
  );
}
