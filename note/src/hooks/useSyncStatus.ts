'use client'

import { useCallback, useContext, useEffect, useState } from 'react'
import { StorageContext } from '@/context/StorageContext'
import type { SyncStatus } from '@/lib/sync/SyncEngine'

export function useSyncStatus(): SyncStatus {
  const ctx = useContext(StorageContext)
  const [status, setStatus] = useState<SyncStatus>('offline')

  useEffect(() => {
    if (!ctx) return
    return ctx.sync.subscribeStatus(setStatus)
  }, [ctx])

  return status
}

// 手動再同期トリガー（同期エラーからの復帰用）
export function useManualSync(): () => Promise<void> {
  const ctx = useContext(StorageContext)
  return useCallback(async () => {
    if (ctx) await ctx.sync.manualSync()
  }, [ctx])
}
