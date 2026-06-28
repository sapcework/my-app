'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { StorageProvider } from '@/lib/types'
import type { SyncEngine } from '@/lib/sync/SyncEngine'
import { supabase } from '@/lib/supabase/client'

type ContextValue = {
  storage: StorageProvider
  sync: SyncEngine
}

export const StorageContext = createContext<ContextValue | null>(null)

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function StorageProviderComponent({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<ContextValue | null>(null)

  useEffect(() => {
    async function init() {
      const { SyncEngine } = await import('@/lib/sync/SyncEngine')
      const { SyncedStorageProvider } = await import('@/lib/storage/SyncedStorageProvider')
      const { EncryptedStorageProvider } = await import('@/lib/storage/EncryptedStorageProvider')
      const { SupabaseRemoteProvider } = await import('@/lib/supabase/SupabaseRemoteProvider')

      // 環境に応じて永続層を切り替え
      let raw: StorageProvider
      if (isTauri()) {
        const { TauriProvider } = await import('@/lib/storage/TauriProvider')
        raw = new TauriProvider()
      } else {
        const { IndexedDBProvider } = await import('@/lib/storage/IndexedDBProvider')
        raw = new IndexedDBProvider()
      }

      // 暗号層で包む（保存=暗号 / 読み出し=復号、無効時は素通し）
      const base = new EncryptedStorageProvider(raw)

      const remote = new SupabaseRemoteProvider(supabase)
      const sync = new SyncEngine(base, remote)
      const storage = new SyncedStorageProvider(base, sync)

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        sync.setAuth(session.user.id)
        await sync.startupSync()
      }

      supabase.auth.onAuthStateChange(async (_event, s) => {
        const userId = s?.user?.id ?? null
        sync.setAuth(userId)
        if (userId) await sync.startupSync()
      })

      setValue({ storage, sync })
    }
    init()
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
