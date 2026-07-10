import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateSalt, hashPin } from '../utils/passcode'

const MAX_ATTEMPTS = 5 // この回数連続で失敗するとロック
const LOCK_DURATION_MS = 30_000 // ロック時間

type PasscodeState = {
  enabled: boolean
  hash: string | null
  salt: string | null
  failedAttempts: number
  lockedUntil: number | null
  setPasscode: (pin: string) => Promise<void>
  removePasscode: () => void
  verify: (pin: string) => Promise<boolean>
}

export const usePasscodeStore = create<PasscodeState>()(
  persist(
    (set, get) => ({
      enabled: false,
      hash: null,
      salt: null,
      failedAttempts: 0,
      lockedUntil: null,
      setPasscode: async (pin) => {
        const salt = generateSalt()
        const hash = await hashPin(pin, salt)
        set({ enabled: true, hash, salt, failedAttempts: 0, lockedUntil: null })
      },
      removePasscode: () => set({ enabled: false, hash: null, salt: null, failedAttempts: 0, lockedUntil: null }),
      verify: async (pin) => {
        const { hash, salt, lockedUntil, failedAttempts } = get()
        if (lockedUntil && Date.now() < lockedUntil) return false // ロック中は検証すらしない
        if (!hash || !salt) return false
        const ok = (await hashPin(pin, salt)) === hash
        if (ok) {
          set({ failedAttempts: 0, lockedUntil: null })
          return true
        }
        const attempts = failedAttempts + 1
        if (attempts >= MAX_ATTEMPTS) {
          set({ failedAttempts: 0, lockedUntil: Date.now() + LOCK_DURATION_MS })
        } else {
          set({ failedAttempts: attempts })
        }
        return false
      },
    }),
    {
      name: 'kakeibo-passcode',
      version: 2,
      // v0（SHA-256単発でハッシュ化した旧形式）は新方式(PBKDF2)と互換性がないため、
      // 旧ハッシュを破棄してパスコードを解除する。利用者は設定画面で再設定できる。
      migrate: (state, version) => {
        if (version < 1) return { enabled: false, hash: null, salt: null, failedAttempts: 0, lockedUntil: null }
        if (version < 2) return { ...(state as PasscodeState), failedAttempts: 0, lockedUntil: null }
        return state as PasscodeState
      },
    }
  )
)
