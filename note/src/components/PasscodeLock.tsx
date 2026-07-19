'use client'

import { useEffect, useState } from 'react'
import { PinPad } from './PinPad'

type Props = {
  onUnlock: () => void
  unlock: (pin: string) => Promise<boolean>
  lockRemaining: () => number // 連続失敗ロックの残り時間（ms）
}

export function PasscodeLock({ onUnlock, unlock, lockRemaining }: Props) {
  const [error, setError] = useState(false)
  const [remainingSec, setRemainingSec] = useState(() => Math.ceil(lockRemaining() / 1000))

  // ロック中は 1 秒ごとに残り時間を更新する
  useEffect(() => {
    if (remainingSec <= 0) return
    const t = setInterval(() => setRemainingSec(Math.ceil(lockRemaining() / 1000)), 1000)
    return () => clearInterval(t)
  }, [remainingSec > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleComplete(pin: string) {
    const ok = await unlock(pin)
    if (ok) { onUnlock(); return }
    setError(true)
    setRemainingSec(Math.ceil(lockRemaining() / 1000)) // 失敗でロックが発生したら表示を開始
  }

  const isLocked = remainingSec > 0

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-10 gap-12" role="dialog" aria-modal="true" aria-label="パスコードロック">
      <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
        <span className="text-3xl" aria-hidden="true">📝</span>
      </div>
      <div className="flex flex-col items-center gap-4 w-full">
        <PinPad
          title="パスコードを入力"
          onComplete={handleComplete}
          error={error}
          onErrorReset={() => setError(false)}
          disabled={isLocked}
        />
        <p
          className={`text-xs text-red-500 min-h-[1rem] text-center ${isLocked ? '' : 'invisible'}`}
          role="alert"
        >
          {isLocked ? `試行回数が上限に達しました。あと ${remainingSec} 秒お待ちください` : ''}
        </p>
      </div>
    </div>
  )
}
