import { describe, it, expect, beforeAll } from 'vitest'
import { deriveAesKey, vault } from '@/lib/crypto'
import { hashPin, hashPinLegacy } from '@/lib/passcode'

describe('vault（暗号化保管庫）', () => {
  it('鍵未設定（暗号化無効）の間は平文を素通しする', async () => {
    expect(await vault.encrypt('hello')).toBe('hello')
    expect(await vault.decrypt('hello')).toBe('hello')
  })

  describe('鍵設定後', () => {
    beforeAll(async () => {
      vault.setKey(await deriveAesKey('1234', 'test-salt'))
    })

    it('encrypt は enc:1: プレフィクス付き暗号文を返し、decrypt で元に戻る', async () => {
      const ct = await vault.encrypt('秘密のメモ')
      expect(ct.startsWith('enc:1:')).toBe(true)
      expect(ct).not.toContain('秘密のメモ')
      expect(await vault.decrypt(ct)).toBe('秘密のメモ')
    })

    it('同じ平文でも IV がランダムなため暗号文は毎回異なる', async () => {
      const a = await vault.encrypt('same')
      const b = await vault.encrypt('same')
      expect(a).not.toBe(b)
    })

    it('プレフィクスの無い文字列（平文）はそのまま返す', async () => {
      expect(await vault.decrypt('ただのテキスト')).toBe('ただのテキスト')
    })

    it('改竄された暗号文は復号に失敗する（AES-GCM の完全性検証）', async () => {
      const ct = await vault.encrypt('data')
      const [p1, p2, iv, body] = ct.split(':')
      const tampered = [p1, p2, iv, body.slice(0, -4) + 'AAAA'].join(':')
      await expect(vault.decrypt(tampered)).rejects.toThrow()
    })

    it('別のパスコードから導出した鍵では復号できない', async () => {
      const ct = await vault.encrypt('data')
      vault.setKey(await deriveAesKey('9999', 'test-salt'))
      await expect(vault.decrypt(ct)).rejects.toThrow()
    })
  })
})

describe('鍵導出のドメイン分離', () => {
  it('検証ハッシュ（v2）は旧ハッシュ（＝暗号鍵ビット列）と一致しない', async () => {
    const v2 = await hashPin('1234', 'salt')
    const legacy = await hashPinLegacy('1234', 'salt')
    expect(v2).not.toBe(legacy)
  })

  it('同じ PIN + salt なら検証ハッシュは決定的', async () => {
    expect(await hashPin('1234', 'salt')).toBe(await hashPin('1234', 'salt'))
  })

  it('PIN が違えばハッシュも違う', async () => {
    expect(await hashPin('1234', 'salt')).not.toBe(await hashPin('1235', 'salt'))
  })
})
