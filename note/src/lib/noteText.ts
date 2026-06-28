// 本文（content）からタイトル・プレビューを導出する（Simplenote 方式：1行目＝タイトル）

// 最初の非空行をタイトルとして取り出す
export function deriveTitle(content: string): string {
  const line = content.split('\n').find((l) => l.trim() !== '')
  return (line ?? '').trim()
}

// タイトル行より後ろをプレビュー（1行に詰めて返す）
export function derivePreview(content: string): string {
  const lines = content.split('\n')
  const titleIdx = lines.findIndex((l) => l.trim() !== '')
  if (titleIdx === -1) return ''
  return lines.slice(titleIdx + 1).join(' ').replace(/\s+/g, ' ').trim()
}
