import type { KeyboardEvent } from 'react'

// クリック可能な非ボタン要素（li/div）にキーボード操作（Enter/Space）を付与する共通プロパティ
export const activatable = (fn: () => void, label?: string) => ({
  role: 'button' as const, // スクリーンリーダーにボタンとして伝える
  tabIndex: 0, // Tabキーでフォーカス可能にする
  'aria-label': label, // ラベル（任意）
  onClick: fn,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault() // Spaceでのスクロールを抑止
      fn()
    }
  },
})
