import type { StorageProvider, Note } from '@/lib/types'

const NOTES_FILE = 'notes.json'
const TMP_FILE = 'notes.json.tmp'

type NotesStore = Record<string, Note>

async function readStore(): Promise<NotesStore> {
  const { readTextFile, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')

  let content: string
  try {
    content = await readTextFile(NOTES_FILE, { baseDir: BaseDirectory.AppData })
  } catch {
    return {} // ファイル未作成
  }

  try {
    return JSON.parse(content) as NotesStore
  } catch {
    // 破損していたら、空で続行する前に内容を退避（上書きで失わないように）
    try {
      await writeTextFile(`notes.corrupt-${Date.now()}.json`, content, { baseDir: BaseDirectory.AppData })
    } catch { /* 退避失敗時も処理は続行 */ }
    return {}
  }
}

// 一時ファイルへ書いてから rename することで、書き込み途中のクラッシュでも
// notes.json が壊れない（アトミック書き込み）
async function writeStore(store: NotesStore): Promise<void> {
  const { writeTextFile, rename, BaseDirectory, mkdir } = await import('@tauri-apps/plugin-fs')
  await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
  await writeTextFile(TMP_FILE, JSON.stringify(store), { baseDir: BaseDirectory.AppData })
  await rename(TMP_FILE, NOTES_FILE, {
    oldPathBaseDir: BaseDirectory.AppData,
    newPathBaseDir: BaseDirectory.AppData,
  })
}

// 連続する read-modify-write を直列化し、lost update（並行書き込みでの上書き消失）を防ぐ
let writeChain: Promise<void> = Promise.resolve()
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task)
  writeChain = run.then(() => undefined, () => undefined)
  return run
}

export class TauriProvider implements StorageProvider {
  private listeners = new Set<() => void>()

  async getNotes(): Promise<Note[]> {
    const store = await readStore()
    return Object.values(store).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getNote(id: string): Promise<Note | null> {
    const store = await readStore()
    return store[id] ?? null
  }

  async upsertNote(note: Note): Promise<void> {
    await serialize(async () => {
      const store = await readStore()
      store[note.id] = note
      await writeStore(store)
    })
    this.notify()
  }

  async deleteNote(id: string): Promise<void> {
    await serialize(async () => {
      const store = await readStore()
      delete store[id]
      await writeStore(store)
    })
    this.notify()
  }

  async clear(): Promise<void> {
    await serialize(async () => {
      await writeStore({})
    })
    this.notify()
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
