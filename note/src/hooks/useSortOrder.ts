'use client'

import { useEffect, useState } from 'react'
import type { Note } from '@/lib/types'

export type SortOrder =
  | 'updated-desc'
  | 'updated-asc'
  | 'created-desc'
  | 'created-asc'
  | 'name-asc'
  | 'name-desc'

const KEY = 'simplenote-sort-order'

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'updated-desc', label: '更新日：最新' },
  { value: 'updated-asc',  label: '更新日：最も古い' },
  { value: 'created-desc', label: '作成日：最新' },
  { value: 'created-asc',  label: '作成日：最も古い' },
  { value: 'name-asc',     label: '名前：A-Z' },
  { value: 'name-desc',    label: '名前：Z-A' },
]

export function useSortOrder() {
  const [sortOrder, setSortOrderState] = useState<SortOrder>('updated-desc')

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as SortOrder | null
    if (saved) setSortOrderState(saved)
  }, [])

  function setSortOrder(order: SortOrder) {
    setSortOrderState(order)
    localStorage.setItem(KEY, order)
  }

  return { sortOrder, setSortOrder }
}

export function applySortOrder(notes: Note[], order: SortOrder): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1 // ピン済みは常に先頭
    if (!a.pinned && b.pinned) return 1
    switch (order) {
      case 'updated-desc': return b.updatedAt - a.updatedAt
      case 'updated-asc':  return a.updatedAt - b.updatedAt
      case 'created-desc': return b.createdAt - a.createdAt
      case 'created-asc':  return a.createdAt - b.createdAt
      case 'name-asc':     return (a.title || '').localeCompare(b.title || '', 'ja')
      case 'name-desc':    return (b.title || '').localeCompare(a.title || '', 'ja')
    }
  })
}
