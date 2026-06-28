import type { StorageProvider, Note } from '@/lib/types'

export interface RemoteProvider {
  fetchAll(userId: string): Promise<Note[]>
  upsert(note: Note): Promise<void>
  delete(noteId: string, userId: string): Promise<void>
}

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error'

const DEBOUNCE_MS = 2000
const MAX_RETRIES = 5

export class SyncEngine {
  private queue = new Map<string, 'upsert' | 'delete'>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private userId: string | null = null
  private syncing = false
  private backoff = 0 // 連続失敗時のバックオフ指数
  private status: SyncStatus = 'offline'
  private statusListeners = new Set<(s: SyncStatus) => void>()

  constructor(
    private storage: StorageProvider,
    private remote: RemoteProvider | null
  ) {}

  subscribeStatus(cb: (s: SyncStatus) => void): () => void {
    this.statusListeners.add(cb)
    cb(this.status)
    return () => this.statusListeners.delete(cb)
  }

  private setStatus(s: SyncStatus) {
    this.status = s
    this.statusListeners.forEach((cb) => cb(s))
  }

  setAuth(userId: string | null) {
    this.userId = userId
    this.setStatus(userId ? 'idle' : 'offline')
    if (userId && this.queue.size > 0) this.scheduleFlush()
  }

  async startupSync(): Promise<void> {
    if (!this.remote || !this.userId) return
    this.setStatus('syncing')
    try {
      const [remoteNotes, localNotes] = await Promise.all([
        this.remote.fetchAll(this.userId),
        this.storage.getNotes(),
      ])
      await this.mergeWithLWW(localNotes, remoteNotes)
      this.setStatus('idle')
    } catch (e) {
      console.warn('[SyncEngine] startupSync failed:', e)
      this.setStatus('error')
    }
  }

  enqueue(noteId: string, action: 'upsert' | 'delete') {
    this.queue.set(noteId, action)
    this.scheduleFlush()
  }

  // エラー時にユーザーが手動で再同期するための入口
  async manualSync(): Promise<void> {
    this.backoff = 0
    await this.startupSync() // 再取得して整合（ローカルが新しいものは再キュー）
    await this.flush()       // 保留分を即送信
  }

  private scheduleFlush(delay = DEBOUNCE_MS) {
    if (!this.remote || !this.userId) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), delay)
  }

  private async flush() {
    if (this.syncing || !this.remote || !this.userId) return
    this.syncing = true
    this.setStatus('syncing')

    const entries = [...this.queue.entries()]
    this.queue.clear()

    let hasError = false
    for (const [noteId, action] of entries) {
      const ok = await this.pushOnce(noteId, action)
      if (!ok) {
        this.queue.set(noteId, action) // 失敗は再キュー（1件の失敗で他をブロックしない）
        hasError = true
      }
    }

    this.syncing = false

    if (this.queue.size === 0) {
      this.backoff = 0
      this.setStatus('idle')
      return
    }

    if (hasError) {
      // 失敗が残っている → 指数バックオフで自動再試行（最大30秒間隔で張り付き）
      this.setStatus('error')
      const delay = Math.min(Math.pow(2, this.backoff) * 1000, 30000)
      this.backoff = Math.min(this.backoff + 1, MAX_RETRIES)
      this.scheduleFlush(delay)
    } else {
      // flush 中に来た新規変更のみ残存 → 通常デバウンスで処理
      this.scheduleFlush()
    }
  }

  // 1回だけ送信を試みる（内部リトライなし）。失敗は flush 側で再キュー・再試行する。
  private async pushOnce(noteId: string, action: 'upsert' | 'delete'): Promise<boolean> {
    if (!this.remote || !this.userId) return false
    try {
      if (action === 'upsert') {
        const note = await this.storage.getNote(noteId)
        if (note) await this.remote.upsert({ ...note, userId: this.userId })
      } else {
        await this.remote.delete(noteId, this.userId)
      }
      return true
    } catch (e) {
      console.warn('[SyncEngine] push failed (will retry):', noteId, e instanceof Error ? e.message : JSON.stringify(e))
      return false
    }
  }

  private async mergeWithLWW(local: Note[], remote: Note[]): Promise<void> {
    const localMap = new Map(local.map((n) => [n.id, n]))
    for (const remoteNote of remote) {
      const localNote = localMap.get(remoteNote.id)
      if (!localNote || remoteNote.updatedAt > localNote.updatedAt) {
        await this.storage.upsertNote(remoteNote)
      } else if (localNote.updatedAt > remoteNote.updatedAt) {
        this.enqueue(localNote.id, 'upsert')
      }
      localMap.delete(remoteNote.id)
    }
    for (const [, note] of localMap) {
      this.enqueue(note.id, 'upsert')
    }
  }
}
