import { openDB, IDBPDatabase } from 'idb'
import type { Note, StorageProvider } from '@/lib/types'

const DB_NAME = 'simplenote-db'
const STORE_NAME = 'notes'
const DB_VERSION = 1

type NoteDB = {
  [STORE_NAME]: {
    key: string
    value: Note
    indexes: { updatedAt: number }
  }
}

let dbPromise: Promise<IDBPDatabase<NoteDB>> | null = null

function getDB(): Promise<IDBPDatabase<NoteDB>> {
  // 接続を1回だけ開いて使い回す（毎操作で openDB しない）
  if (!dbPromise) {
    dbPromise = openDB<NoteDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      },
    })
  }
  return dbPromise
}

export class IndexedDBProvider implements StorageProvider {
  private listeners = new Set<() => void>()
  private channel = new BroadcastChannel('simplenote-sync') // タブ間同期

  constructor() {
    this.channel.onmessage = () => this.notify()
  }

  async getNotes(): Promise<Note[]> {
    const db = await getDB()
    const notes = await db.getAllFromIndex(STORE_NAME, 'updatedAt')
    return notes.reverse() // 新しい順
  }

  async getNote(id: string): Promise<Note | null> {
    const db = await getDB()
    return (await db.get(STORE_NAME, id)) ?? null
  }

  async upsertNote(note: Note): Promise<void> {
    const db = await getDB()
    await db.put(STORE_NAME, note)
    this.notify()
    this.channel.postMessage('updated')
  }

  async deleteNote(id: string): Promise<void> {
    const db = await getDB()
    await db.delete(STORE_NAME, id)
    this.notify()
    this.channel.postMessage('updated')
  }

  async clear(): Promise<void> {
    const db = await getDB()
    await db.clear(STORE_NAME)
    this.notify()
    this.channel.postMessage('updated')
  }

  async search(query: string): Promise<Note[]> {
    const notes = await this.getNotes()
    const q = query.toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    )
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify() {
    this.listeners.forEach((cb) => cb())
  }
}
