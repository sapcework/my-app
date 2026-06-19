import { useEffect, useRef } from 'react'
import { useDialogStore } from '../store/dialogStore'

export const ConfirmDialog = () => {
  const { options, handle } = useDialogStore()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!options) return
    confirmRef.current?.focus() // 開いたら実行ボタンにフォーカス
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handle(false) // Escでキャンセル
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options, handle])

  if (!options) return null

  const { title, message, confirmLabel = 'OK', cancelLabel = 'キャンセル', danger } = options

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '確認'}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => handle(false)} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        {title && (
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 mb-2">{title}</h2>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => handle(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={() => handle(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
