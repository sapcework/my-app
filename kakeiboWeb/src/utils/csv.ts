import type { Expense, Category } from '../types/index'
import { formatTimestamp } from './date'

// CSVのセル1個を安全な文字列に変換する
export const escapeCell = (value: string): string => {
  let v = value ?? '' // null/undefined は空文字に
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v // 先頭が数式記号なら ' を前置（CSVインジェクション対策）
  return `"${v.replace(/"/g, '""')}"` // " を "" にエスケープして全体を引用符で囲む
}

// 支出明細CSVの行データ（ヘッダー行＋日付昇順の明細行）を生成する
export const expenseDetailRows = (expenses: Expense[], categories: Category[]): string[][] => [
  ['日付', 'カテゴリ', '項目名', 'メモ', '金額', '登録日時', '更新日時'],
  ...expenses
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const cat = categories.find((c) => c.id === e.categoryId)
      return [
        e.date,
        cat?.name ?? '不明',
        e.itemName ?? '',
        e.note ?? '',
        e.amount.toString(),
        formatTimestamp(e.createdAt),
        formatTimestamp(e.updatedAt),
      ]
    }),
]

// 2次元配列をCSV文字列に変換し、ファイルとしてダウンロードする
export const downloadCsv = (rows: string[][], filename: string): void => {
  const csv = rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') // 行・列を連結（CRLF改行）
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM付きでExcelの文字化けを防ぐ
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
