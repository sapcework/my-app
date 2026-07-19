import { describe, it, expect } from 'vitest'
import { deriveTitle, derivePreview } from '@/lib/noteText'

describe('deriveTitle', () => {
  it('1行目をタイトルとして返す', () => {
    expect(deriveTitle('買い物リスト\n牛乳\n卵')).toBe('買い物リスト')
  })

  it('先頭の空行を飛ばして最初の非空行を返す', () => {
    expect(deriveTitle('\n\n  \nメモ本文')).toBe('メモ本文')
  })

  it('前後の空白を除去する', () => {
    expect(deriveTitle('  タイトル  \n本文')).toBe('タイトル')
  })

  it('空文字列なら空を返す', () => {
    expect(deriveTitle('')).toBe('')
    expect(deriveTitle('\n\n')).toBe('')
  })
})

describe('derivePreview', () => {
  it('タイトル行より後ろを1行に詰めて返す', () => {
    expect(derivePreview('タイトル\n2行目\n3行目')).toBe('2行目 3行目')
  })

  it('連続する空白を1つにまとめる', () => {
    expect(derivePreview('T\na   b\n\n\nc')).toBe('a b c')
  })

  it('本文が無ければ空を返す', () => {
    expect(derivePreview('タイトルのみ')).toBe('')
    expect(derivePreview('')).toBe('')
  })

  it('先頭が空行でもタイトル行の次からプレビューする', () => {
    expect(derivePreview('\nタイトル\n本文')).toBe('本文')
  })
})
