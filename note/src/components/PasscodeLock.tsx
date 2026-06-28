'use client'

import { useState } from 'react'
import { PinPad } from './PinPad'

type Props = {
  onUnlock: () => void
  unlock: (pin: string) => Promise<boolean>
}

export function PasscodeLock({ onUnlock, unlock }: Props) {
  const [error, setError] = useState(false)

  async function handleComplete(pin: string) {
    const ok = await unlock(pin)
    if (ok) onUnlock()
    else setError(true)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-10 gap-12">
      <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
        <span className="text-3xl">📝</span>
      </div>
      <PinPad
        title="パスコードを入力"
        onComplete={handleComplete}
        error={error}
        onErrorReset={() => setError(false)}
      />
    </div>
  )
}
