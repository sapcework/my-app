'use client'

import { useEffect, useState } from 'react'
import { _registerToast } from '@/lib/toast'

type Toast = { id: number; message: string }

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    _registerToast((message) => {
      const id = Date.now()
      setToasts(t => [...t, { id, message }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-24 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
      {toasts.map(({ id, message }) => (
        <div
          key={id}
          className="bg-gray-900/90 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg"
        >
          {message}
        </div>
      ))}
    </div>
  )
}
