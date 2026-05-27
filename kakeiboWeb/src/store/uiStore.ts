import { create } from 'zustand'
import { toYearMonth } from '../utils/date'

type UIStore = {
  selectedMonth: string
  setSelectedMonth: (m: string) => void
}

export const useUIStore = create<UIStore>()((set) => ({
  selectedMonth: toYearMonth(new Date()),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
}))
