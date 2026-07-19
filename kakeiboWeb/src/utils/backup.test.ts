import { describe, it, expect } from 'vitest'
import { parseBackup } from './backup'

const validExpense = {
  id: 'e1',
  amount: 1200,
  categoryId: '1',
  itemName: 'スーパー',
  note: '',
  date: '2026-07-15',
  createdAt: '2026-07-15T10:00:00.000Z',
}

const validBackup = {
  version: '1',
  exportedAt: '2026-07-19T00:00:00.000Z',
  expenses: [validExpense],
  categories: [{ id: '1', name: '食費', color: '#FF9800', icon: '🍽️' }],
  budgets: [{ month: '2026-07', amount: 50000 }],
  recurring: [{ id: 'r1', amount: 80000, categoryId: '3', name: '家賃', dayOfMonth: 27 }],
}

describe('parseBackup', () => {
  it('正しいバックアップを受理する', () => {
    const r = parseBackup(JSON.stringify(validBackup))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.expenses).toHaveLength(1)
      expect(r.data.budgets[0].amount).toBe(50000)
    }
  })

  it('budgets/recurring が無い旧形式も受理する', () => {
    const rest: Record<string, unknown> = { ...validBackup }
    delete rest.budgets
    delete rest.recurring
    const r = parseBackup(JSON.stringify(rest))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.budgets).toEqual([])
      expect(r.data.recurring).toEqual([])
    }
  })

  it('JSONでないファイルを拒否する', () => {
    const r = parseBackup('not json at all')
    expect(r.ok).toBe(false)
  })

  it('金額が文字列の支出を拒否する', () => {
    const bad = { ...validBackup, expenses: [{ ...validExpense, amount: '1200' }] }
    const r = parseBackup(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('支出データ')
  })

  it('負の金額を拒否する', () => {
    const bad = { ...validBackup, expenses: [{ ...validExpense, amount: -100 }] }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })

  it('日付形式が不正な支出を拒否し、何件目かを示す', () => {
    const bad = { ...validBackup, expenses: [validExpense, { ...validExpense, id: 'e2', date: '2026/07/15' }] }
    const r = parseBackup(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('2件目')
  })

  it('カテゴリ名が空のカテゴリを拒否する', () => {
    const bad = { ...validBackup, categories: [{ id: '1', name: '', color: '#fff', icon: '🍽️' }] }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })

  it('dayOfMonth が範囲外の定期支出を拒否する', () => {
    const bad = { ...validBackup, recurring: [{ ...validBackup.recurring[0], dayOfMonth: 32 }] }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })

  it('expenses が配列でない場合を拒否する', () => {
    const bad = { ...validBackup, expenses: 'x' }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })
})
