import { describe, it, expect } from 'vitest'
import { toYearMonth, formatYearMonth, prevMonth, nextMonth, formatDateWithDay, formatTableMonth, formatTimestamp } from './date'

describe('toYearMonth', () => {
  it('日付をYYYY-MM形式にする', () => {
    expect(toYearMonth(new Date(2026, 0, 15))).toBe('2026-01')
  })
})

describe('formatYearMonth', () => {
  it('YYYY-MMを日本語表記にする', () => {
    expect(formatYearMonth('2026-07')).toBe('2026年7月')
  })
})

describe('prevMonth / nextMonth', () => {
  it('年をまたいで前月を計算する', () => {
    expect(prevMonth('2026-01')).toBe('2025-12')
  })

  it('年をまたいで翌月を計算する', () => {
    expect(nextMonth('2025-12')).toBe('2026-01')
  })

  it('通常の月内では単純に増減する', () => {
    expect(prevMonth('2026-07')).toBe('2026-06')
    expect(nextMonth('2026-07')).toBe('2026-08')
  })
})

describe('formatDateWithDay', () => {
  it('曜日付きで日付を表示する', () => {
    // 2026-07-10 は金曜日
    expect(formatDateWithDay('2026-07-10')).toBe('7月10日(金)')
  })
})

describe('formatTableMonth', () => {
  it('当年は月のみ表示する', () => {
    expect(formatTableMonth('2026-07', 2026)).toBe('7月')
  })

  it('別年は年も付ける', () => {
    expect(formatTableMonth('2025-07', 2026)).toBe("7月\n'25")
  })
})

describe('formatTimestamp', () => {
  it('未定義なら空文字を返す', () => {
    expect(formatTimestamp(undefined)).toBe('')
  })

  it('ISO日時をYYYYMMDDHHmmss形式に変換する', () => {
    const iso = new Date(2026, 6, 10, 9, 5, 3).toISOString()
    expect(formatTimestamp(iso)).toBe('20260710090503')
  })
})
