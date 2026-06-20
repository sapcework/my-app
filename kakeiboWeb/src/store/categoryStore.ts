import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Category } from '../types'

type CategoryStore = {
  categories: Category[]
  addCategory: (category: Omit<Category, 'id'>) => void
  updateCategory: (id: string, data: Partial<Category>) => void
  deleteCategory: (id: string) => void
  restoreCategories: (categories: Category[]) => void
}

export const useCategoryStore = create<CategoryStore>()(
  persist(
    (set) => ({
      categories: [
        { id: '1',  name: '食費',     color: '#FF9800', icon: '🍽️' },
        { id: '2',  name: '外食',     color: '#FF5722', icon: '🍜' },
        { id: '3',  name: '住居',     color: '#009688', icon: '🏠' },
        { id: '4',  name: '光熱費',   color: '#FFC107', icon: '💡' },
        { id: '5',  name: '通信費',   color: '#03A9F4', icon: '📱' },
        { id: '6',  name: '交通費',   color: '#2196F3', icon: '🚗' },
        { id: '7',  name: '日用品',   color: '#4CAF50', icon: '🛒' },
        { id: '8',  name: '衣服・美容', color: '#E91E63', icon: '👗' },
        { id: '9',  name: '医療',     color: '#F44336', icon: '🏥' },
        { id: '10', name: '保険',     color: '#607D8B', icon: '🛡️' },
        { id: '11', name: '教育',     color: '#3F51B5', icon: '📚' },
        { id: '12', name: 'サブスク', color: '#9C27B0', icon: '💳' },
        { id: '13', name: '娯楽',     color: '#8BC34A', icon: '🎮' },
        { id: '14', name: '旅行',     color: '#00BCD4', icon: '✈️' },
        { id: '15', name: '貯蓄・投資', color: '#795548', icon: '💰' },
        { id: '16', name: 'その他',   color: '#9E9E9E', icon: '📦' },
      ],
      addCategory: (data) =>
        set((s) => ({
          categories: [...s.categories, { ...data, id: crypto.randomUUID() }],
        })),
      updateCategory: (id, data) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),
      deleteCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),
      restoreCategories: (categories) => set({ categories }),
    }),
    { name: 'kakeibo-categories' }
  )
)
