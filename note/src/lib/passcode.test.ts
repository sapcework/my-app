import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeLockMs, registerFailedAttempt, clearAttempts, attemptLockRemaining,
  PASSCODE_ATTEMPT_KEY,
} from '@/lib/passcode'

describe('computeLockMs（連続失敗ロック）', () => {
  it('5回未満はロックしない', () => {
    expect(computeLockMs(0)).toBe(0)
    expect(computeLockMs(4)).toBe(0)
  })

  it('5回で30秒、以降は倍々', () => {
    expect(computeLockMs(5)).toBe(30_000)
    expect(computeLockMs(6)).toBe(60_000)
    expect(computeLockMs(7)).toBe(120_000)
  })

  it('最大5分で頭打ち', () => {
    expect(computeLockMs(10)).toBe(300_000)
    expect(computeLockMs(100)).toBe(300_000)
  })
})

describe('試行回数の記録', () => {
  beforeEach(() => clearAttempts())

  it('4回失敗まではロックされない', () => {
    const now = 1_000_000
    for (let i = 0; i < 4; i++) registerFailedAttempt(now)
    expect(attemptLockRemaining(now)).toBe(0)
  })

  it('5回目の失敗で30秒ロックされ、時間経過で解除される', () => {
    const now = 1_000_000
    for (let i = 0; i < 5; i++) registerFailedAttempt(now)
    expect(attemptLockRemaining(now)).toBe(30_000)
    expect(attemptLockRemaining(now + 30_000)).toBe(0)
  })

  it('clearAttempts でリセットされる', () => {
    const now = 1_000_000
    for (let i = 0; i < 6; i++) registerFailedAttempt(now)
    clearAttempts()
    expect(attemptLockRemaining(now)).toBe(0)
    expect(localStorage.getItem(PASSCODE_ATTEMPT_KEY)).toBeNull()
  })

  it('壊れた保存データがあっても安全に初期値へフォールバックする', () => {
    localStorage.setItem(PASSCODE_ATTEMPT_KEY, '{{{invalid json')
    expect(attemptLockRemaining()).toBe(0)
  })
})
