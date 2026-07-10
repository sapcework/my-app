import { describe, it, expect } from 'vitest'
import { formatWan } from './format'

describe('formatWan', () => {
  it('1万円未満はそのままカンマ区切りで表示する', () => {
    expect(formatWan(9999)).toBe('¥9,999')
  })

  it('ちょうど1万円は万表記になる', () => {
    expect(formatWan(10000)).toBe('¥1万')
  })

  it('端数は小数第1位まで表示する', () => {
    expect(formatWan(12345)).toBe('¥1.2万')
  })

  it('割り切れる場合は整数で表示する', () => {
    expect(formatWan(150000)).toBe('¥15万')
  })
})
