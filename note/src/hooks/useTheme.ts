'use client'

import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const KEY = 'simplenote-theme'

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light',  label: 'ライト' },
  { value: 'system', label: 'システム' },
  { value: 'dark',   label: 'ダーク' },
]

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

// html 要素に .dark を付け外しする
function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? 'system'
    setThemeState(saved)
    apply(saved)

    // system 選択時、OS のテーマ変更に追従する
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (((localStorage.getItem(KEY) as Theme | null) ?? 'system') === 'system') apply('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem(KEY, t)
    apply(t)
  }

  return { theme, setTheme }
}
