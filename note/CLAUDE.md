# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Simplenote ライクなメモアプリ。offline-first、クラウド同期対応、Web + デスクトップ両対応。

技術スタック: Next.js + TypeScript + IndexedDB + Tauri + Supabase

## 絶対アーキテクチャ

```
UI → StorageProvider（抽象層）→ IndexedDB / Tauri File → Sync Engine（非同期）→ Supabase
```

UIから Supabase への直接アクセス禁止。Sync Engine 経由のみ。

## 開発ルール

- `any` 型使用禁止
- 一括実装禁止（Step 分割必須: Step1 設計 → Step2 Storage → Step3 Sync → Step4 UI → Step5 Supabase認証 → Step6 Tauri）
- 勝手な機能追加禁止
- 設計なし実装禁止

## コマンド

- 開発サーバー: `npm run dev`
- ビルド: `npm run build`
- 型チェック: `npx tsc --noEmit`
- Tauri 開発: `npm run tauri dev`
- Tauri ビルド: `npm run tauri build`

## データ型

```ts
type Note = {
  id: string        // UUID
  title: string
  content: string
  createdAt: number // UNIX ms
  updatedAt: number // UNIX ms
  version: number
  userId?: string
}
```

## StorageProvider インターフェース

```ts
interface StorageProvider {
  getNotes(): Promise<Note[]>
  getNote(id: string): Promise<Note | null>
  upsertNote(note: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  search(query: string): Promise<Note[]>
  subscribe(cb: () => void): () => void
}
```

## 同期仕様

- Last Write Wins（updatedAt 基準）
- ローカルが常に正
- 起動時に必ず同期実行
- 認証済み時のみ同期動作
