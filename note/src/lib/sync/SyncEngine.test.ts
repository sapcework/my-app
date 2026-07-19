import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncEngine } from '@/lib/sync/SyncEngine'
import type { RemoteProvider } from '@/lib/sync/SyncEngine'
import type { Note, StorageProvider } from '@/lib/types'

const note = (id: string, over: Partial<Note> = {}): Note => ({
  id, title: id, content: `content-${id}`, createdAt: 0, updatedAt: 0, version: 1, ...over,
})

// メモリ上の StorageProvider フェイク
function makeStorage(initial: Note[] = []) {
  const map = new Map(initial.map(n => [n.id, n]))
  const storage: StorageProvider & { map: Map<string, Note> } = {
    map,
    getNotes: async () => [...map.values()],
    getNote: async (id) => map.get(id) ?? null,
    upsertNote: async (n) => { map.set(n.id, n) },
    deleteNote: async (id) => { map.delete(id) },
    search: async () => [],
    subscribe: () => () => {},
    clear: async () => { map.clear() },
  }
  return storage
}

function makeRemote(notes: Note[] = []) {
  return {
    fetchAll: vi.fn<(userId: string) => Promise<Note[]>>(async () => notes),
    upsert: vi.fn<(note: Note) => Promise<void>>(async () => {}),
    delete: vi.fn<(noteId: string, userId: string) => Promise<void>>(async () => {}),
  } satisfies RemoteProvider
}

describe('SyncEngine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('startupSync: remote の方が新しければローカルを上書きする（LWW）', async () => {
    const storage = makeStorage([note('a', { updatedAt: 100, content: 'local' })])
    const remote = makeRemote([note('a', { updatedAt: 200, content: 'remote' })])
    const engine = new SyncEngine(storage, remote)
    engine.setAuth('user-1')

    await engine.startupSync()

    expect(storage.map.get('a')?.content).toBe('remote')
  })

  it('startupSync: ローカルの方が新しければ上書きせず push キューへ入れる', async () => {
    const storage = makeStorage([note('a', { updatedAt: 300, content: 'local-newer' })])
    const remote = makeRemote([note('a', { updatedAt: 200, content: 'remote-old' })])
    const engine = new SyncEngine(storage, remote)
    engine.setAuth('user-1')

    await engine.startupSync()
    expect(storage.map.get('a')?.content).toBe('local-newer') // ローカル維持

    await vi.advanceTimersByTimeAsync(2500) // デバウンス経過で flush
    expect(remote.upsert).toHaveBeenCalledTimes(1)
    expect(remote.upsert.mock.calls[0][0].content).toBe('local-newer')
  })

  it('startupSync: リモートに無いローカルノートは push される', async () => {
    const storage = makeStorage([note('local-only', { updatedAt: 100 })])
    const remote = makeRemote([])
    const engine = new SyncEngine(storage, remote)
    engine.setAuth('user-1')

    await engine.startupSync()
    await vi.advanceTimersByTimeAsync(2500)

    expect(remote.upsert).toHaveBeenCalledTimes(1)
    expect(remote.upsert.mock.calls[0][0].id).toBe('local-only')
  })

  it('未ログイン時は enqueue しても送信しない', async () => {
    const storage = makeStorage([note('a')])
    const remote = makeRemote()
    const engine = new SyncEngine(storage, remote)

    engine.enqueue('a', 'upsert')
    await vi.advanceTimersByTimeAsync(10_000)

    expect(remote.upsert).not.toHaveBeenCalled()
  })

  it('送信失敗したノートは再キューされ、バックオフ後に再送される', async () => {
    const storage = makeStorage([note('a', { updatedAt: 100 })])
    const remote = makeRemote()
    remote.upsert.mockRejectedValueOnce(new Error('network down')) // 1回目のみ失敗
    const engine = new SyncEngine(storage, remote)
    engine.setAuth('user-1')

    const statuses: string[] = []
    engine.subscribeStatus(s => statuses.push(s))

    engine.enqueue('a', 'upsert')
    await vi.advanceTimersByTimeAsync(2500) // 1回目 → 失敗
    expect(statuses).toContain('error')

    await vi.advanceTimersByTimeAsync(5000) // バックオフ後の自動再試行 → 成功
    expect(remote.upsert).toHaveBeenCalledTimes(2)
    expect(statuses[statuses.length - 1]).toBe('idle')
  })

  it('delete アクションは remote.delete を呼ぶ', async () => {
    const storage = makeStorage()
    const remote = makeRemote()
    const engine = new SyncEngine(storage, remote)
    engine.setAuth('user-1')

    engine.enqueue('gone', 'delete')
    await vi.advanceTimersByTimeAsync(2500)

    expect(remote.delete).toHaveBeenCalledWith('gone', 'user-1')
  })

  it('reset は保留中の変更を破棄する', async () => {
    const storage = makeStorage([note('a')])
    const remote = makeRemote()
    const engine = new SyncEngine(storage, remote)
    engine.setAuth('user-1')

    engine.enqueue('a', 'upsert')
    engine.reset()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(remote.upsert).not.toHaveBeenCalled()
  })
})
