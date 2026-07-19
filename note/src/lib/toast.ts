export type ToastOptions = {
  actionLabel?: string      // 「元に戻す」等のアクションボタン表示
  onAction?: () => void     // アクション押下時のコールバック
  durationMs?: number       // 表示時間（省略時: アクション有 5000ms / 無 3000ms）
}

let _add: ((message: string, opts?: ToastOptions) => void) | null = null

export function _registerToast(fn: (message: string, opts?: ToastOptions) => void) {
  _add = fn
}

export function showToast(message: string, opts?: ToastOptions) {
  _add?.(message, opts)
}
