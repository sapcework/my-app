import { create } from 'zustand'

export type ConfirmOptions = {
  title?: string // 見出し（任意）
  message: string // 本文（\n で改行可）
  confirmLabel?: string // 実行ボタンの文言（既定: OK）
  cancelLabel?: string // キャンセルボタンの文言（既定: キャンセル）
  danger?: boolean // 破壊的操作なら true（実行ボタンを赤系に）
}

type DialogState = {
  options: ConfirmOptions | null // 表示中の内容（null で非表示）
  resolve: ((ok: boolean) => void) | null // 応答を返すための解決関数
  confirm: (options: ConfirmOptions) => Promise<boolean> // 確認を開いて結果を待つ
  handle: (ok: boolean) => void // ユーザーの選択を確定してダイアログを閉じる
}

export const useDialogStore = create<DialogState>((set, get) => ({
  options: null,
  resolve: null,
  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({ options, resolve }) // 表示状態にして解決関数を保持
    }),
  handle: (ok) => {
    get().resolve?.(ok) // 待っている Promise に結果を返す
    set({ options: null, resolve: null }) // 閉じる
  },
}))

// コンポーネント外（イベントコールバック等）からも呼べる確認関数
export const confirmDialog = (options: ConfirmOptions) => useDialogStore.getState().confirm(options)
