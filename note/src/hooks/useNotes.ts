'use client'

import { useEffect, useState } from 'react'
import { useStorage } from '@/context/StorageContext'
import type { Note } from '@/lib/types'

// ゴミ箱（deleted）を除外する
const visible = (notes: Note[]) => notes.filter((n) => !n.deleted)

export function useNotes() {
  const storage = useStorage()
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    storage.getNotes().then((ns) => setNotes(visible(ns)))
    const unsub = storage.subscribe(() => {
      storage.getNotes().then((ns) => setNotes(visible(ns)))
    })
    return unsub
  }, [storage])

  return notes
}

// ゴミ箱（論理削除されたノート）一覧。削除日時の新しい順。
export function useTrashedNotes() {
  const storage = useStorage()
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    const run = () =>
      storage.getNotes().then((ns) =>
        setNotes(
          ns.filter((n) => n.deleted).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
        )
      )
    run()
    return storage.subscribe(run)
  }, [storage])

  return notes
}

export function useSearch(query: string) {
  const storage = useStorage()
  const [results, setResults] = useState<Note[]>([])

  useEffect(() => {
    const run = () => {
      if (!query) {
        storage.getNotes().then((ns) => setResults(visible(ns)))
      } else {
        storage.search(query).then((ns) => setResults(visible(ns)))
      }
    }
    run()
    // ノート変更時にも検索結果を更新（編集・削除・同期反映を取りこぼさない）
    return storage.subscribe(run)
  }, [storage, query])

  return results
}
