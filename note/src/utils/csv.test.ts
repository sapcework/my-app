import { describe, it, expect } from 'vitest'
import { escapeCell } from '@/utils/csv'

describe('escapeCell', () => {
  it('通常の文字列は引用符で囲むだけ', () => {
    expect(escapeCell('メモ')).toBe('"メモ"')
  })

  it('二重引用符は "" にエスケープする', () => {
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('数式記号で始まるセルは \' を前置する（CSVインジェクション対策）', () => {
    expect(escapeCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
    expect(escapeCell('+1+1')).toBe('"\'+1+1"')
    expect(escapeCell('-cmd')).toBe('"\'-cmd"')
    expect(escapeCell('@macro')).toBe('"\'@macro"')
  })

  it('改行を含むセルも引用符内に収まる', () => {
    expect(escapeCell('a\nb')).toBe('"a\nb"')
  })
})
