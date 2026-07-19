import type { StorageProvider, Note } from '@/lib/types'
import { vault } from '@/lib/crypto'

// 永続層（IndexedDB / Tauri）の手前に挟み、保存時に title/content を暗号化、
// 読み出し時に復号する透過レイヤー。暗号化が無効な間は素通しする。
// 同期エンジンや UI はこのレイヤー経由で「平文」を扱うため、クラウドへは平文が送られる。
export class EncryptedStorageProvider implements StorageProvider {
  constructor(private base: StorageProvider) {}

  private async decryptNote(n: Note): Promise<Note> {
    return { ...n, title: await vault.decrypt(n.title), content: await vault.decrypt(n.content) }
  }

  async getNotes(): Promise<Note[]> {
    await vault.ready()
    const notes = await this.base.getNotes()
    return Promise.all(notes.map((n) => this.decryptNote(n)))
  }

  async getNote(id: string): Promise<Note | null> {
    await vault.ready()
    const note = await this.base.getNote(id)
    return note ? this.decryptNote(note) : null
  }

  async upsertNote(note: Note): Promise<void> {
    await vault.ready()
    await this.base.upsertNote({
      ...note,
      title: await vault.encrypt(note.title),
      content: await vault.encrypt(note.content),
    })
  }

  async deleteNote(id: string): Promise<void> {
    await this.base.deleteNote(id)
  }

  async clear(): Promise<void> {
    await this.base.clear()
  }

  // 暗号文のままでは検索できないため、復号済みノートに対して検索する
  async search(query: string): Promise<Note[]> {
    const notes = await this.getNotes()
    const q = query.toLowerCase()
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    )
  }

  subscribe(cb: () => void): () => void {
    return this.base.subscribe(cb)
  }
}
