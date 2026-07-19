'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { StorageProvider } from '@/lib/types'
import { SyncEngine } from '@/lib/sync/SyncEngine'
import { SyncedStorageProvider } from '@/lib/storage/SyncedStorageProvider'
import { EncryptedStorageProvider } from '@/lib/storage/EncryptedStorageProvider'
import { IndexedDBProvider } from '@/lib/storage/IndexedDBProvider'
import { TauriProvider } from '@/lib/storage/TauriProvider'
import { SupabaseRemoteProvider } from '@/lib/supabase/SupabaseRemoteProvider'
import { supabase } from '@/lib/supabase/client'
import { isTauri } from '@/lib/platform'

type ContextValue = {
  storage: StorageProvider
  sync: SyncEngine
}

export const StorageContext = createContext<ContextValue | null>(null)

export function StorageProviderComponent({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<ContextValue | null>(null)

  useEffect(() => {
    // 環境に応じて永続層を切り替え（静的importなので分割チャンク取得に失敗して固まらない）
    const raw: StorageProvider = isTauri() ? new TauriProvider() : new IndexedDBProvider()
    const base = new EncryptedStorageProvider(raw) // 暗号層（無効時は素通し）
    const remote = new SupabaseRemoteProvider(supabase)
    const sync = new SyncEngine(base, remote)
    const storage = new SyncedStorageProvider(base, sync)

    // 同期はバックグラウンドで実行し、UI表示をブロックしない（オフラインファースト）
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          sync.setAuth(session.user.id)
          sync.startupSync().catch(() => { /* 同期失敗でもアプリは使える */ })
        }
      })
      .catch(() => { /* セッション取得失敗でもアプリは表示する */ })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      const userId = s?.user?.id ?? null
      sync.setAuth(userId)
      if (userId) sync.startupSync().catch(() => {})
    })

    setValue({ storage, sync }) // 常に即座にアプリを表示（読込中で固まらせない）

    return () => subscription.unsubscribe()
  }, [])

  if (!value) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3 text-gray-300 dark:text-gray-600">
          <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          <span className="text-xs">読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  )
}

export function useStorage(): StorageProvider {
  const ctx = useContext(StorageContext)
  if (!ctx) throw new Error('useStorage must be used within StorageProviderComponent')
  return ctx.storage
}
