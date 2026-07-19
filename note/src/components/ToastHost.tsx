'use client'

import { useEffect, useState } from 'react'
import { _registerToast } from '@/lib/toast'
import type { ToastOptions } from '@/lib/toast'

type Toast = { id: number; message: string; actionLabel?: string; onAction?: () => void }

let seq = 0 // 同一ミリ秒での ID 衝突を防ぐ連番

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    _registerToast((message, opts?: ToastOptions) => {
      const id = ++seq
      setToasts(t => [...t, { id, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction }])
      const duration = opts?.durationMs ?? (opts?.actionLabel ? 5000 : 3000)
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
    })
  }, [])

  return (
    // 空でも描画し続けることで aria-live リージョンとして機能させる
    <div
      className="fixed bottom-24 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map(({ id, message, actionLabel, onAction }) => (
        <div
          key={id}
          className="bg-gray-900/90 text-white text-sm pl-4 pr-2 py-2 rounded-xl shadow-lg flex items-center gap-2 pointer-events-auto"
        >
          <span className="py-0.5">{message}</span>
          {actionLabel && (
            <button
              onClick={() => { onAction?.(); setToasts(t => t.filter(x => x.id !== id)) }}
              className="shrink-0 px-2.5 py-1 text-sm font-semibold text-blue-300 hover:text-blue-200 hover:bg-white/10 rounded-lg transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
