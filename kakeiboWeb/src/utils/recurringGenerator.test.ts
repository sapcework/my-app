import { describe, it, expect } from 'vitest'
import { isRecurringDue, targetDayOf, daysInMonth } from './recurringGenerator'
import type { RecurringExpense } from '../types/index'

const makeRecurring = (overrides: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id: 'r1',
  amount: 1000,
  categoryId: 'c1',
  name: 'サブスク',
  dayOfMonth: 5,
  ...overrides,
})

describe('daysInMonth', () => {
  it('2月(平年)は28日', () => {
    expect(daysInMonth(2025, 2)).toBe(28)
  })

  it('2月(閏年)は29日', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
  })
})

describe('targetDayOf', () => {
  it('31日指定でも2月なら月末に丸められる', () => {
    const r = makeRecurring({ dayOfMonth: 31 })
    expect(targetDayOf(r, new Date(2025, 1, 10))).toBe(28) // 2025年2月
  })

  it('日数が足りる月ではそのままの日にちになる', () => {
    const r = makeRecurring({ dayOfMonth: 15 })
    expect(targetDayOf(r, new Date(2026, 6, 1))).toBe(15)
  })
})

describe('isRecurringDue', () => {
  it('今月分が生成済みならfalse', () => {
    const r = makeRecurring({ dayOfMonth: 5, lastGeneratedMonth: '2026-07' })
    expect(isRecurringDue(r, new Date(2026, 6, 20))).toBe(false)
  })

  it('発生日にまだ達していなければfalse', () => {
    const r = makeRecurring({ dayOfMonth: 20 })
    expect(isRecurringDue(r, new Date(2026, 6, 10))).toBe(false)
  })

  it('発生日を過ぎていて未生成ならtrue', () => {
    const r = makeRecurring({ dayOfMonth: 5 })
    expect(isRecurringDue(r, new Date(2026, 6, 10))).toBe(true)
  })

  it('31日指定・2月でも月末に達していればtrue', () => {
    const r = makeRecurring({ dayOfMonth: 31 })
    expect(isRecurringDue(r, new Date(2025, 1, 28))).toBe(true)
  })
})
