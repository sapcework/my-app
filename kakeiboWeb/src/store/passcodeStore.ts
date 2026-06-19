import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateSalt, hashPin } from '../utils/passcode'

type PasscodeState = {
  enabled: boolean
  hash: string | null
  salt: string | null
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
      setPasscode: async (pin) => {
        const salt = generateSalt()
        const hash = await hashPin(pin, salt)
        set({ enabled: true, hash, salt })
      },
      removePasscode: () => set({ enabled: false, hash: null, salt: null }),
      verify: async (pin) => {
        const { hash, salt } = get()
        if (!hash || !salt) return false
        return (await hashPin(pin, salt)) === hash
      },
    }),
    { name: 'kakeibo-passcode' }
  )
)
