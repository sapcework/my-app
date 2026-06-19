import { useState, useEffect } from 'react'
import { Delete } from 'lucide-react'

type Props = {
  title: string
  onComplete: (pin: string) => void
  error?: boolean
  onErrorReset?: () => void
  compact?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export const PinPad = ({ title, onComplete, error, onErrorReset, compact }: Props) => {
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => { setPin(''); onErrorReset?.() }, 600)
    return () => clearTimeout(t)
  }, [error, onErrorReset])

  const append = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) setTimeout(() => onComplete(next), 80)
  }

  const btnH = compact ? 'h-12' : 'h-16'
  const outerGap = compact ? 'gap-5' : 'gap-8'
  const dotGap = compact ? 'gap-4' : 'gap-5'
  const dotSize = compact ? 'w-3 h-3' : 'w-4 h-4'
  const gridGap = compact ? 'gap-2' : 'gap-3'
  const numSize = compact ? 'text-lg' : 'text-xl'

  return (
    <div className={`flex flex-col items-center ${outerGap} w-full`}>
      <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</p>

      {/* 入力インジケーター（4ドット） */}
      <div className={error ? 'animate-shake' : ''}>
        <div className={`flex ${dotGap}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`${dotSize} rounded-full transition-all duration-150 ${
                i < pin.length
                  ? 'bg-indigo-600 dark:bg-indigo-400 scale-110'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* テンキー */}
      <div className={`grid grid-cols-3 ${gridGap} w-full max-w-[280px]`}>
        {KEYS.map((k, i) => {
          if (k === '') return <div key={i} />
          if (k === 'del') return (
            <button
              key={i}
              onClick={() => setPin((p) => p.slice(0, -1))}
              className={`${btnH} flex items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all`}
            >
              <Delete size={compact ? 18 : 20} />
            </button>
          )
          return (
            <button
              key={i}
              onClick={() => append(k)}
              className={`${btnH} ${numSize} font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm transition-all`}
            >
              {k}
            </button>
          )
        })}
      </div>
    </div>
  )
}
