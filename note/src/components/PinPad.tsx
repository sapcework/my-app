'use client'

import { useState, useEffect } from 'react'

type Props = {
  title: string
  onComplete: (pin: string) => void
  error?: boolean
  onErrorReset?: () => void
  compact?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

const DeleteIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
    <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
  </svg>
)

export function PinPad({ title, onComplete, error, onErrorReset, compact }: Props) {
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => { setPin(''); onErrorReset?.() }, 600)
    return () => clearTimeout(t)
  }, [error, onErrorReset])

  const append = (d: string) => {
    setPin((p) => {
      if (p.length >= 4) return p
      const next = p + d
      if (next.length === 4) setTimeout(() => onComplete(next), 80)
      return next
    })
  }

  const btnH = compact ? 'h-12' : 'h-16'
  const outerGap = compact ? 'gap-5' : 'gap-8'
  const dotGap = compact ? 'gap-4' : 'gap-5'
  const dotSize = compact ? 'w-3 h-3' : 'w-4 h-4'
  const gridGap = compact ? 'gap-2' : 'gap-3'
  const numSize = compact ? 'text-lg' : 'text-xl'

  return (
    <div className={`flex flex-col items-center ${outerGap} w-full`}>
      <p className="text-base font-semibold text-gray-700 dark:text-gray-200">{title}</p>

      {/* 入力インジケーター（4ドット） */}
      <div className={error ? 'animate-shake' : ''}>
        <div className={`flex ${dotGap}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`${dotSize} rounded-full transition-all duration-150 ${
                i < pin.length ? 'bg-blue-500 scale-110' : 'bg-gray-200 dark:bg-gray-700'
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
              className={`${btnH} flex items-center justify-center rounded-2xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all`}
              aria-label="削除"
            >
              <DeleteIcon size={compact ? 18 : 20} />
            </button>
          )
          return (
            <button
              key={i}
              onClick={() => append(k)}
              className={`${btnH} ${numSize} font-semibold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all`}
            >
              {k}
            </button>
          )
        })}
      </div>
    </div>
  )
}
