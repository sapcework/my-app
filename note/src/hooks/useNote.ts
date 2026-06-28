'use client'

import { useCallback } from 'react'
import { useStorage } from '@/context/StorageContext'
import type { Note } from '@/lib/types'

function generateId(): string {
  return crypto.randomUUID()
}

export function useNote() {
  const storage = useStorage()

  // Note オブジェクトを返すだけ（ストレージに触れない＝ハングしない）。
  // 実体は最初の編集時に updateNote が作成・保存する。空のまま離れたノートは保存されず破棄される。
  const createNote = useCallback((): Note => {
    const now = Date.now()
    return { id: generateId(), title: '', content: '', createdAt: now, updatedAt: now, version: 0 }
  }, [])

  // 無ければ作成、有れば更新（upsert セマンティクス）。新規ノートの取りこぼしを防ぐ。
  const updateNote = useCallback(
    async (id: string, patch: Partial<Pick<Note, 'title' | 'content'>>) => {
      const existing = await storage.getNote(id)
      const base: Note = existing ?? {
        id, title: '', content: '', createdAt: Date.now(), updatedAt: Date.now(), version: 0,
      }
      const updated: Note = {
        ...base,
        ...patch,
        updatedAt: Date.now(),
        version: base.version + 1,
      }
      await storage.upsertNote(updated)
    },
    [storage]
  )

  // 論理削除（ゴミ箱へ）。物理削除せず deleted フラグを立てて upsert することで、
  // 通常の同期（LWW）に乗せて削除を他端末へ伝播させる。
  const trashNote = useCallback(
    async (id: string) => {
      const existing = await storage.getNote(id)
      if (!existing) return
      const now = Date.now()
      await storage.upsertNote({
        ...existing,
        deleted: true,
        deletedAt: now,
        updatedAt: now,             // LWW で削除が最新になるよう更新日時を進める
        version: existing.version + 1,
      })
    },
    [storage]
  )

  // ゴミ箱から復元。deleted を下ろし updatedAt を進めて同期で復元を伝播させる。
  const restoreNote = useCallback(
    async (id: string) => {
      const existing = await storage.getNote(id)
      if (!existing) return
      const now = Date.now()
      await storage.upsertNote({
        ...existing,
        deleted: false,
        deletedAt: undefined,
        updatedAt: now,
        version: existing.version + 1,
      })
    },
    [storage]
  )

  // 物理削除（完全削除）。ローカル削除 + リモートへ delete を送る。
  const deleteNote = useCallback(
    async (id: string) => {
      await storage.deleteNote(id)
    },
    [storage]
  )

  // ゴミ箱を空にする（論理削除済みを全件物理削除）。
  const emptyTrash = useCallback(async () => {
    const all = await storage.getNotes()
    for (const n of all.filter((n) => n.deleted)) {
      await storage.deleteNote(n.id)
    }
  }, [storage])

  // updatedAt・version を変更しない（Simplenote と同じ動作）
  const togglePin = useCallback(
    async (id: string) => {
      const existing = await storage.getNote(id)
      if (!existing) return
      await storage.upsertNote({ ...existing, pinned: !existing.pinned })
    },
    [storage]
  )

  return { createNote, updateNote, trashNote, restoreNote, deleteNote, emptyTrash, togglePin }
}
