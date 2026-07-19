'use client'

import { useEffect } from 'react'
import { isTauri } from '@/lib/platform'

// Service Worker の登録。Web版（本番）のみで有効化する。
// - Tauri デスクトップ版では登録しない（ネイティブWebViewのため不要）
// - 開発時(localhost)も登録しない（HMRとのキャッシュ衝突を避ける）

export function PWARegister() {
  useEffect(() => {
    if (isTauri()) return
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 登録失敗は致命的ではないため無視 */
    })
  }, [])

  return null
}
