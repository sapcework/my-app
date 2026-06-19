import { useState } from 'react'
import { PinPad } from './PinPad'
import { usePasscodeStore } from '../store/passcodeStore'

type Props = { onUnlock: () => void }

export const PasscodeLock = ({ onUnlock }: Props) => {
  const { verify } = usePasscodeStore()
  const [error, setError] = useState(false)

  const handleComplete = async (pin: string) => {
    const ok = await verify(pin)
    if (ok) { onUnlock() } else { setError(true) }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-[#090912] flex flex-col items-center justify-center px-10 gap-12">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
        <span className="text-3xl">📒</span>
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
