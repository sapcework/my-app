import { useEffect, useRef } from 'react'

// モーダル/シート系UI共通のa11y対応（開いたら初期フォーカス移動、Escapeで閉じる）
export const useModalA11y = <T extends HTMLElement>(open: boolean, onClose: () => void) => {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return ref
}
