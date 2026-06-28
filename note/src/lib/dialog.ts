export type DialogOptions = {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

type DialogState = DialogOptions & { resolve: (v: boolean) => void }

let _setState: ((s: DialogState | null) => void) | null = null

export function _registerDialog(fn: (s: DialogState | null) => void) {
  _setState = fn
}

export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => _setState?.({ ...options, resolve }))
}
