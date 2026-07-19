import type { StorageProvider, Note } from '@/lib/types'
import type { SyncEngine } from '@/lib/sync/SyncEngine'

// StorageProvider をラップし、書き込み時に SyncEngine へ通知する
export class SyncedStorageProvider implements StorageProvider {
  constructor(
    private base: StorageProvider,
    private sync: SyncEngine
  ) {}

  getNotes(): Promise<Note[]> { return this.base.getNotes() }
  getNote(id: string): Promise<Note | null> { return this.base.getNote(id) }
  search(query: string): Promise<Note[]> { return this.base.search(query) }
  subscribe(cb: () => void): () => void { return this.base.subscribe(cb) }

  async upsertNote(note: Note): Promise<void> {
    await this.base.upsertNote(note)
    this.sync.enqueue(note.id, 'upsert')
  }

  async deleteNote(id: string): Promise<void> {
    await this.base.deleteNote(id)
    this.sync.enqueue(id, 'delete')
  }

  // ローカルコピーの消去のみ。クラウドへは伝播させないため sync キューも破棄する。
  async clear(): Promise<void> {
    await this.base.clear()
    this.sync.reset()
  }
}
