import type { StorageProvider, Note } from '@/lib/types'

export interface RemoteProvider {
  fetchAll(userId: string): Promise<Note[]>
  upsert(note: Note): Promise<void>
  delete(noteId: string, userId: string): Promise<void>
}

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error'

const DEBOUNCE_MS = 2000
const MAX_RETRIES = 5
const OP_TIMEOUT_MS = 15000 // 1件の送信がこれ以上かかったら失敗扱い（同期中で固まらせない）

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

  // 保留中の変更を破棄して初期状態に戻す（クラウドへは何も送らない）。
  // ローカルデータを丸ごと消去する操作（ログアウト等）に合わせて呼ぶ想定。
  reset() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.queue.clear()
    this.backoff = 0
    this.syncing = false
    this.setStatus(this.userId ? 'idle' : 'offline')
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

    let hasError = false
    try {
      const entries = [...this.queue.entries()]
      this.queue.clear()
      for (const [noteId, action] of entries) {
        const ok = await this.pushOnce(noteId, action)
        if (!ok) {
          this.queue.set(noteId, action) // 失敗は再キュー（1件の失敗で他をブロックしない）
          hasError = true
        }
      }
    } catch (e) {
      // 想定外の例外でも syncing を必ず解除し、固まらせない
      console.warn('[SyncEngine] flush error:', e instanceof Error ? e.message : JSON.stringify(e))
      hasError = true
    } finally {
      this.syncing = false
    }

    if (hasError) {
      // 失敗が残っている → 指数バックオフで自動再試行（最大30秒間隔で張り付き）
      this.setStatus('error')
      const delay = Math.min(Math.pow(2, this.backoff) * 1000, 30000)
      this.backoff = Math.min(this.backoff + 1, MAX_RETRIES)
      this.scheduleFlush(delay)
    } else if (this.queue.size > 0) {
      // flush 中に来た新規変更が残存 → 通常デバウンスで処理
      this.scheduleFlush()
    } else {
      this.backoff = 0
      this.setStatus('idle')
    }
  }

  // 1回だけ送信を試みる（内部リトライなし）。失敗は flush 側で再キュー・再試行する。
  // ハードタイムアウトを掛け、ネットワーク以外のハング（鍵待ち等）でも固まらせない。
  private async pushOnce(noteId: string, action: 'upsert' | 'delete'): Promise<boolean> {
    if (!this.remote || !this.userId) return false
    try {
      await this.withTimeout(this.doPush(noteId, action), OP_TIMEOUT_MS)
      return true
    } catch (e) {
      console.warn('[SyncEngine] push failed (will retry):', noteId, e instanceof Error ? e.message : JSON.stringify(e))
      return false
    }
  }

  private async doPush(noteId: string, action: 'upsert' | 'delete'): Promise<void> {
    if (action === 'upsert') {
      const note = await this.storage.getNote(noteId)
      if (note && this.remote && this.userId) await this.remote.upsert({ ...note, userId: this.userId })
    } else if (this.remote && this.userId) {
      await this.remote.delete(noteId, this.userId)
    }
  }

  // 指定ミリ秒で必ず決着する（タイムアウト時は reject）
  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('operation timeout')), ms)
    })
    return Promise.race([p.finally(() => clearTimeout(timer)), timeout])
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
