let _add: ((message: string) => void) | null = null

export function _registerToast(fn: (message: string) => void) {
  _add = fn
}

export function showToast(message: string) {
  _add?.(message)
}
