# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Next.js (App Router) + Supabase でのLINE風リアルタイムチャットアプリ。

## 技術スタック

- **Next.js 16** (App Router, Turbopack)
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Tailwind CSS v4**
- **TypeScript** (any型禁止)

## コマンド

```bash
npm run dev       # 開発サーバー起動（http://localhost:3000）
npm run build     # プロダクションビルド
npm run lint      # ESLint（any禁止 + Hooks ルール）
npx tsc --noEmit  # 型チェックのみ
```

## 環境変数（必須）

`.env.local` に実際のSupabaseプロジェクトURLとキーを設定すること：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

未設定の場合はプレースホルダー値でビルドは通るが、機能しない。

## Supabaseセットアップ手順

1. Supabaseダッシュボードで新規プロジェクトを作成
2. `supabase/schema.sql` をSQL Editorで全て実行
3. Authentication → Providers → Email を有効化
4. `.env.local` に URL と anon key を記入

## アーキテクチャ

### ファイル構成

```
src/
├── lib/supabase/client.ts   # ブラウザ用クライアント（シングルトン）
├── lib/supabase/server.ts   # Server Component用クライアント
├── lib/types.ts             # 全型定義
├── hooks/
│   ├── useAuth.ts           # 認証＋last_seen更新（60秒ごと）
│   ├── useMessages.ts       # メッセージ取得＋Realtime購読＋楽観的更新
│   ├── useRooms.ts          # ルーム一覧取得・作成
│   ├── useReadStatus.ts     # 既読管理（last_read_message_id方式）
│   └── useOnline.ts         # オンライン状態（60秒閾値）
└── components/
    ├── chat/                # チャット画面UI
    ├── room/                # ルーム一覧UI
    └── ui/BottomNav.tsx     # LINE風下部タブナビ
```

### 既読判定方式

`room_reads.last_read_message_id` で管理。O(1)判定。

### Realtimeの購読スコープ

- メッセージ: `room_id=eq.{roomId}` フィルターでルーム単位のみ購読
- 既読: `room_id=eq.{roomId}` フィルター
- オンライン: usersテーブルの UPDATE イベント

ポーリング禁止。Supabase Realtime のみ使用。

## コーディング規約

- `any` 型禁止（SupabaseのJoinクエリ結果は `as unknown as {型}` でキャスト）
- Supabase クライアントは `lib/supabase/client.ts` に集約（直接 import 禁止）
- ロジックは hooks に分離、コンポーネントは表示のみ
- コメントはコードの右側（行末）に記載
- LINEカラー: `#4CAF50`（緑）、背景: `#b2d8ea`（青グレー）
