import { describe, it, expect } from 'vitest'
import { escapeCell, expenseDetailRows } from './csv'
import type { Expense, Category } from '../types/index'

describe('escapeCell', () => {
  it('通常の文字列はそのまま引用符で囲む', () => {
    expect(escapeCell('食費')).toBe('"食費"')
  })

  it('ダブルクォートをエスケープする', () => {
    expect(escapeCell('a"b')).toBe('"a""b"')
  })

  it.each(['=cmd', '+1', '-1', '@SUM(A1)'])(
    'CSVインジェクション対策: %s の先頭に\'を前置する',
    (value) => {
      expect(escapeCell(value)).toBe(`"'${value}"`)
    }
  )

  it('数式記号以外で始まる文字列には前置しない', () => {
    expect(escapeCell('100')).toBe('"100"')
  })
})

describe('expenseDetailRows', () => {
  const categories: Category[] = [{ id: 'c1', name: '食費', color: '#fff', icon: '🍚' }]
  const expenses: Expense[] = [
    { id: 'e2', amount: 200, categoryId: 'c1', note: '', date: '2026-07-02', createdAt: '2026-07-02T00:00:00.000Z' },
    { id: 'e1', amount: 100, categoryId: 'c1', note: '', date: '2026-07-01', createdAt: '2026-07-01T00:00:00.000Z' },
  ]

  it('ヘッダー行を先頭に持つ', () => {
    expect(expenseDetailRows(expenses, categories)[0]).toEqual(
      ['日付', 'カテゴリ', '項目名', 'メモ', '金額', '登録日時', '更新日時']
    )
  })

  it('日付の昇順に並び替える', () => {
    const rows = expenseDetailRows(expenses, categories)
    expect(rows[1][0]).toBe('2026-07-01')
    expect(rows[2][0]).toBe('2026-07-02')
  })

  it('該当カテゴリが無ければ「不明」にする', () => {
    const rows = expenseDetailRows(
      [{ id: 'e3', amount: 300, categoryId: 'unknown', note: '', date: '2026-07-03', createdAt: '2026-07-03T00:00:00.000Z' }],
      categories
    )
    expect(rows[1][1]).toBe('不明')
  })
})
