'use client'

import { useEffect, useState } from 'react'
import { _registerDialog } from '@/lib/dialog'
import type { DialogOptions } from '@/lib/dialog'

type State = DialogOptions & { resolve: (v: boolean) => void }

export function ConfirmDialogHost() {
  const [dialog, setDialog] = useState<State | null>(null)

  useEffect(() => { _registerDialog(setDialog) }, [])

  if (!dialog) return null

  const confirm = () => { dialog.resolve(true);  setDialog(null) }
  const cancel  = () => { dialog.resolve(false); setDialog(null) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={cancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-xs shadow-xl">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{dialog.title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line mb-5">{dialog.message}</p>
        <div className="flex gap-3">
          <button
            onClick={cancel}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={confirm}
            className={`flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${
              dialog.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {dialog.confirmLabel ?? '確認'}
          </button>
        </div>
      </div>
    </div>
  )
}
