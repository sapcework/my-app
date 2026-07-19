// CSVセルを安全な文字列に変換する（CSVインジェクション対策 + Excelの文字化け対策）
export const escapeCell = (value: string): string => {
  let v = value ?? ''
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v // 先頭が数式記号なら ' を前置
  return `"${v.replace(/"/g, '""')}"` // " を "" にエスケープして全体を引用符で囲む
}

// 2次元配列をCSVファイルとしてダウンロードする（BOM付きでExcelの文字化けを防ぐ）
export function downloadCsv(rows: string[][], filename: string): void {
  const csv = rows.map(r => r.map(escapeCell).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
