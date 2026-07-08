'use client';

import { useRouter } from 'next/navigation';
import { ToastData } from '@/hooks/useNotification';

interface Props {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function NotificationToast({ toasts, onDismiss }: Props) {
  const router = useRouter();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[calc(100%-24px)] max-w-[390px]">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => { onDismiss(toast.id); router.replace(`/rooms/${toast.roomId}`); }} // replace: 別ルーム表示中でも履歴を積み上げず戻るを1回で済ませる
          className="flex items-center gap-3 bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-100/80 px-3 py-2.5 text-left w-full animate-toast-in"
        >
          {/* LINE風アイコン */}
          <div className="w-10 h-10 rounded-full bg-[#4CAF50] flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">{toast.title}</p>
            <p className="text-[12px] text-gray-500 truncate mt-0.5">{toast.body}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
            className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </button>
      ))}
    </div>
  );
}
