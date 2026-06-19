import { create } from 'zustand'

export type Toast = {
  id: string
  message: string
  actionLabel?: string // アクションボタンの文言（例: 元に戻す）
  onAction?: () => void // アクション実行時の処理
}

type ToastState = {
  toasts: Toast[]
  show: (toast: Omit<Toast, 'id'>, duration?: number) => void // トーストを表示（既定4秒で自動消滅）
  dismiss: (id: string) => void // 指定トーストを消す
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast, duration = 4000) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    setTimeout(() => get().dismiss(id), duration) // 一定時間後に自動で消す
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// コンポーネント外からも呼べる表示関数
export const showToast = (toast: Omit<Toast, 'id'>, duration?: number) =>
  useToastStore.getState().show(toast, duration)
