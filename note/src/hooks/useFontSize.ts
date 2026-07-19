'use client'

import { useEffect, useState } from 'react'

export type FontSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl'

const KEY = 'simplenote-font-size'
const EVENT = 'simplenote-font-size-change'

export const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'xs',   label: '極小' },
  { value: 'sm',   label: '小' },
  { value: 'base', label: '普通' },
  { value: 'lg',   label: '大' },
  { value: 'xl',   label: '特大' },
]

export const FONT_SIZE_CLASS: Record<FontSize, string> = {
  xs:   'text-xs',
  sm:   'text-sm',
  base: 'text-base',
  lg:   'text-lg',
  xl:   'text-xl',
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSize>('base')

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as FontSize | null
    if (saved) setFontSizeState(saved)

    // 同タブ内の別フックインスタンスへ変更を伝達
    const handler = (e: Event) => setFontSizeState((e as CustomEvent<FontSize>).detail)
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])

  function setFontSize(size: FontSize) {
    setFontSizeState(size)
    localStorage.setItem(KEY, size)
    window.dispatchEvent(new CustomEvent<FontSize>(EVENT, { detail: size }))
  }

  return { fontSize, setFontSize }
}
