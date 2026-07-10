import { describe, it, expect } from 'vitest'
import { generateSalt, hashPin } from './passcode'

describe('generateSalt', () => {
  it('16バイト分の16進文字列(32文字)を生成する', () => {
    expect(generateSalt()).toMatch(/^[0-9a-f]{32}$/)
  })

  it('毎回異なる値を生成する', () => {
    expect(generateSalt()).not.toBe(generateSalt())
  })
})

describe('hashPin', () => {
  it('同じpin・saltなら同じハッシュになる(決定的)', async () => {
    const salt = generateSalt()
    const a = await hashPin('1234', salt)
    const b = await hashPin('1234', salt)
    expect(a).toBe(b)
  })

  it('saltが違えば同じpinでも異なるハッシュになる', async () => {
    const a = await hashPin('1234', generateSalt())
    const b = await hashPin('1234', generateSalt())
    expect(a).not.toBe(b)
  })

  it('pinが違えば異なるハッシュになる', async () => {
    const salt = generateSalt()
    const a = await hashPin('1234', salt)
    const b = await hashPin('4321', salt)
    expect(a).not.toBe(b)
  })
})
