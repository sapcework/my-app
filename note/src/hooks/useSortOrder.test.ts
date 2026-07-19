import { describe, it, expect } from 'vitest'
import { applySortOrder } from '@/hooks/useSortOrder'
import type { Note } from '@/lib/types'

const note = (id: string, over: Partial<Note> = {}): Note => ({
  id, title: id, content: '', createdAt: 0, updatedAt: 0, version: 1, ...over,
})

describe('applySortOrder', () => {
  it('ピン留めは並び順に関わらず常に先頭', () => {
    const notes = [
      note('a', { updatedAt: 300 }),
      note('b', { updatedAt: 200, pinned: true }),
      note('c', { updatedAt: 100 }),
    ]
    expect(applySortOrder(notes, 'updated-desc').map(n => n.id)).toEqual(['b', 'a', 'c'])
  })

  it('updated-desc は更新日の新しい順', () => {
    const notes = [note('old', { updatedAt: 1 }), note('new', { updatedAt: 2 })]
    expect(applySortOrder(notes, 'updated-desc').map(n => n.id)).toEqual(['new', 'old'])
  })

  it('created-asc は作成日の古い順', () => {
    const notes = [note('b', { createdAt: 2 }), note('a', { createdAt: 1 })]
    expect(applySortOrder(notes, 'created-asc').map(n => n.id)).toEqual(['a', 'b'])
  })

  it('name-asc はタイトルの昇順（日本語ロケール）', () => {
    const notes = [note('2', { title: 'かき' }), note('1', { title: 'あい' })]
    expect(applySortOrder(notes, 'name-asc').map(n => n.title)).toEqual(['あい', 'かき'])
  })

  it('元配列を破壊しない', () => {
    const notes = [note('a', { updatedAt: 1 }), note('b', { updatedAt: 2 })]
    applySortOrder(notes, 'updated-desc')
    expect(notes.map(n => n.id)).toEqual(['a', 'b'])
  })
})
