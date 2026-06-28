'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { generateSalt, hashPin } from '@/lib/passcode'
import { deriveAesKey, vault } from '@/lib/crypto'
import { PasscodeLock } from '@/components/PasscodeLock'

type Stored = { enabled: boolean; hash: string | null; salt: string | null }

const KEY = 'simplenote-passcode'

function read(): Stored {
  if (typeof window === 'undefined') return { enabled: false, hash: null, salt: null }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { enabled: false, hash: null, salt: null }
    return JSON.parse(raw) as Stored
  } catch {
    return { enabled: false, hash: null, salt: null }
  }
}

function write(s: Stored) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

type PasscodeContextValue = {
  enabled: boolean
  setPasscode: (pin: string) => Promise<void>
  removePasscode: () => void
  verify: (pin: string) => Promise<boolean>
  unlock: (pin: string) => Promise<boolean> // 検証成功時に暗号鍵も導出する
  lock: () => void
}

const PasscodeContext = createContext<PasscodeContextValue | null>(null)

export function PasscodeProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<Stored>({ enabled: false, hash: null, salt: null })
  const [locked, setLocked] = useState(false)
  const [ready, setReady] = useState(false)

  // 初回マウント時に localStorage から読み込み、有効ならロック状態で開始
  useEffect(() => {
    const s = read()
    setStored(s)
    setLocked(s.enabled)
    setReady(true)
  }, [])

  async function setPasscode(pin: string) {
    const salt = generateSalt()
    const hash = await hashPin(pin, salt)
    const next: Stored = { enabled: true, hash, salt }
    write(next)
    setStored(next)
    // 暗号鍵を導出して保管庫にセット（以降の保存は暗号化される）
    vault.setKey(await deriveAesKey(pin, salt))
  }

  function removePasscode() {
    const next: Stored = { enabled: false, hash: null, salt: null }
    write(next)
    setStored(next)
    setLocked(false)
    vault.disable() // 暗号化を無効化し鍵を破棄
  }

  async function verify(pin: string): Promise<boolean> {
    if (!stored.hash || !stored.salt) return false
    return (await hashPin(pin, stored.salt)) === stored.hash
  }

  async function unlock(pin: string): Promise<boolean> {
    if (!stored.salt) return false
    const ok = await verify(pin)
    if (!ok) return false
    vault.setKey(await deriveAesKey(pin, stored.salt)) // 解除時に復号鍵を生成
    return true
  }

  function lock() {
    if (stored.enabled) setLocked(true)
  }

  if (!ready) return null // 判定前は何も描画せず、未ロック画面のちらつきを防ぐ

  return (
    <PasscodeContext.Provider value={{ enabled: stored.enabled, setPasscode, removePasscode, verify, unlock, lock }}>
      {children}
      {locked && <PasscodeLock onUnlock={() => setLocked(false)} unlock={unlock} />}
    </PasscodeContext.Provider>
  )
}

export function usePasscode(): PasscodeContextValue {
  const ctx = useContext(PasscodeContext)
  if (!ctx) throw new Error('usePasscode must be used within PasscodeProvider')
  return ctx
}
