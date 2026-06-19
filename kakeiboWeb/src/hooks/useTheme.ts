import { useEffect } from 'react'
import { useThemeStore } from '../store/themeStore'

const applyDark = (dark: boolean) =>
  document.documentElement.classList.toggle('dark', dark)

export const useTheme = () => {
  const { theme } = useThemeStore()

  useEffect(() => {
    if (theme === 'dark') { applyDark(true); return }
    if (theme === 'light') { applyDark(false); return }

    const mq = window.matchMedia('(prefers-color-scheme: dark)') // システム設定連動
    applyDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => applyDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])
}
