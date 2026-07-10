import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dbAddCategory, dbUpdateCategory, dbDeleteCategory } from '../lib/db'
import { showToast } from './toastStore'
import type { Category } from '../types/index'

type CategoryStore = {
  categories: Category[]
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  restoreCategories: (categories: Category[]) => void
}

const SYNC_FAILED = 'カテゴリの保存に失敗しました。通信状況を確認してください'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1',  name: '食費',      color: '#FF9800', icon: '🍽️' },
  { id: '2',  name: '外食',      color: '#FF5722', icon: '🍜' },
  { id: '3',  name: '住居',      color: '#009688', icon: '🏠' },
  { id: '4',  name: '光熱費',    color: '#FFC107', icon: '💡' },
  { id: '5',  name: '通信費',    color: '#03A9F4', icon: '📱' },
  { id: '6',  name: '交通費',    color: '#2196F3', icon: '🚗' },
  { id: '7',  name: '日用品',    color: '#4CAF50', icon: '🛒' },
  { id: '8',  name: '衣服・美容', color: '#E91E63', icon: '👗' },
  { id: '9',  name: '医療',      color: '#F44336', icon: '🏥' },
  { id: '10', name: '保険',      color: '#607D8B', icon: '🛡️' },
  { id: '11', name: '教育',      color: '#3F51B5', icon: '📚' },
  { id: '12', name: 'サブスク',  color: '#9C27B0', icon: '💳' },
  { id: '13', name: '娯楽',      color: '#8BC34A', icon: '🎮' },
  { id: '14', name: '旅行',      color: '#00BCD4', icon: '✈️' },
  { id: '15', name: '貯蓄・投資', color: '#795548', icon: '💰' },
  { id: '16', name: 'その他',    color: '#9E9E9E', icon: '📦' },
]

export const useCategoryStore = create<CategoryStore>()(
  persist(
    (set, get) => ({
      categories: DEFAULT_CATEGORIES,
      addCategory: async (data) => {
        const prev = get().categories
        const newCategory: Category = { ...data, id: crypto.randomUUID() }
        set({ categories: [...prev, newCategory] })
        const { error } = await dbAddCategory(newCategory, prev.length)
        if (error) {
          console.error('addCategory failed', error)
          set({ categories: prev })
          showToast({ message: SYNC_FAILED })
        }
      },
      updateCategory: async (id, data) => {
        const prev = get().categories
        const next = prev.map((c) => (c.id === id ? { ...c, ...data } : c))
        set({ categories: next })
        const updated = next.find((c) => c.id === id)
        if (!updated) return
        const { error } = await dbUpdateCategory(updated)
        if (error) {
          console.error('updateCategory failed', error)
          set({ categories: prev })
          showToast({ message: SYNC_FAILED })
        }
      },
      deleteCategory: async (id) => {
        const prev = get().categories
        set({ categories: prev.filter((c) => c.id !== id) })
        const { error } = await dbDeleteCategory(id)
        if (error) {
          console.error('deleteCategory failed', error)
          set({ categories: prev })
          showToast({ message: SYNC_FAILED })
        }
      },
      restoreCategories: (categories) => set({ categories }),
    }),
    {
      name: 'kakeibo-categories',
      version: 2,
      migrate: (state, version) => {
        const s = state as CategoryStore
        if (version < 2) {
          const existingIds = new Set(s.categories.map((c) => c.id))
          const missing = DEFAULT_CATEGORIES.filter((c) => !existingIds.has(c.id))
          return { ...s, categories: [...s.categories, ...missing] }
        }
        return s
      },
    }
  )
)
