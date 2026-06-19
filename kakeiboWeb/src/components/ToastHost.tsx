import { useToastStore } from '../store/toastStore'

export const ToastHost = () => {
  const { toasts, dismiss } = useToastStore()
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-24 left-0 right-0 z-[55] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex items-center gap-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl px-4 py-3 shadow-lg max-w-sm w-full"
        >
          <span className="text-sm flex-1">{t.message}</span>
          {t.actionLabel && (
            <button
              onClick={() => { t.onAction?.(); dismiss(t.id) }} // アクション実行後にトーストを閉じる
              className="text-sm font-semibold text-indigo-300 hover:text-indigo-200 flex-shrink-0"
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
