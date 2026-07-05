'use client';

import { useAppBackButton } from '@/hooks/useAppBackButton';

export function AppBackButtonProvider() {
  const { showExitToast } = useAppBackButton();

  if (!showExitToast) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-black/80 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none">
      もう一度戻ると終了します
    </div>
  );
}
