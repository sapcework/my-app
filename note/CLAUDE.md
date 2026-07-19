# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Simplenote ライクなメモアプリ「**LumiNote**」。offline-first、クラウド同期、Web + PWA + デスクトップ対応。

技術スタック: Next.js + TypeScript + IndexedDB + Tauri + Supabase + Tailwind CSS
公開URL: https://myluminote.vercel.app （Vercel、`note/` を Root Directory に指定）

## 絶対アーキテクチャ

```
UI → SyncedStorageProvider → EncryptedStorageProvider（暗号層）→ IndexedDB / Tauri File
                                                              ↘ Sync Engine（非同期）→ Supabase
```

- UIから Supabase への直接アクセス禁止。Sync Engine 経由のみ。
- 暗号層は透過的（パスコードONのときのみ title/content を AES-256-GCM で暗号化）。同期は復号済み＝クラウドは平文。
- 起動時同期は await せずバックグラウンド実行（UIをブロックしない）。StorageContext の import は静的（分割チャンク失敗回避）。

## 開発ルール

- `any` 型使用禁止
- 一括実装禁止（Step 分割必須: Step1 設計 → Step2 Storage → Step3 Sync → Step4 UI → Step5 Supabase認証 → Step6 Tauri）
- 勝手な機能追加禁止
- 設計なし実装禁止

## コマンド

- 開発サーバー: `npm run dev`
- ビルド: `npm run build`
- 型チェック: `npm run typecheck`（= `tsc --noEmit`）
- テスト: `npm test`（Vitest。監視モードは `npm run test:watch`）
- Tauri 開発: `npm run tauri dev`
- Tauri ビルド: `npm run tauri build`

## データ型

```ts
type Note = {
  id: string        // UUID
  title: string     // 本文の1行目を自動保存（専用タイトル欄は無い / noteText.ts で導出）
  content: string   // 本文（1行目を含む全文）
  createdAt: number // UNIX ms
  updatedAt: number // UNIX ms
  version: number
  userId?: string
  pinned?: boolean  // ピン留め（updatedAt を変えない）
  deleted?: boolean // 論理削除（ゴミ箱）。物理削除せず同期で伝播
  deletedAt?: number
}
```

注意: localStorage / IndexedDB のキー（`simplenote-*`, DB名 `simplenote-db`）は互換のため変更しないこと（変えると既存データが消える）。

## パスコード / 暗号化（重要な互換ルール）

- 保存形式は v2（`{ v: 2, enabled, hash, salt }`）。検証ハッシュは `salt + '|verify'` でドメイン分離した PBKDF2。
  v1（`v` 無し）は検証ハッシュ＝AES鍵と同一ビット列だった旧形式で、解錠成功時に v2 へ自動移行される。
- **暗号鍵の導出（`deriveAesKey`: salt をそのまま使用）は変更禁止**。変えると既存の暗号化済みノートが復号不能になる。
- PIN 連続5回失敗で 30秒〜最大5分のロックアウト（`simplenote-passcode-attempts`）。成功でリセット。

## UI/UX の既定パターン

- ノート削除（ゴミ箱へ）は確認ダイアログを出さず、「元に戻す」付きトーストで Undo 可能にする。
  確認ダイアログは不可逆操作（完全削除・ゴミ箱を空にする・ログアウト）のみ。
- エディタは 500ms デバウンス保存＋「戻る / ノート切替 / visibilitychange / pagehide」で即時 flush（入力消失防止）。
- 共有アイコンは `components/icons.tsx`、環境判定（`isTauri`）は `lib/platform.ts` に集約。重複定義しない。
- ショートカット: Ctrl/Cmd+K・`/` = 検索フォーカス、Ctrl/Cmd+Alt+N = 新規ノート。

## テスト

- Vitest（`vitest.config.ts`、setup: `src/test/setup.ts` が localStorage スタブを提供）。
- テストは対象と同じディレクトリに `*.test.ts` で配置（noteText / csv / sortOrder / crypto / passcode / SyncEngine）。
- 暗号・同期・パスコードなど重要ロジックを変更したら対応するテストも更新すること。

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
- 起動時に同期（バックグラウンド）
- 認証済み時のみ同期動作
- 1件の送信は15秒でタイムアウト＋失敗は指数バックオフ再試行（同期中で固まらせない）
- push 時に remote が新しければ上書きしない（LWWガード）

## Supabase / RLS

- `notes` テーブルは RLS 有効。select/insert/update/delete すべて `auth.uid() = user_id`。
- UPDATE は `using` + `with check` 両方必須（user_id 付け替え防止 / migration 004）。
- マイグレーション: `supabase/migrations/*.sql`（列追加時は本番DBで実行が必要）。

## デプロイ / PWA

- Web は Vercel（GitHub push で自動デプロイ）。
- PWA: `public/manifest.webmanifest` + `public/sw.js`（network-first）。SWは本番Webのみ登録（Tauri/開発は無効）。
- ホーム画面追加の案内バナー: `components/InstallPrompt.tsx`。Android/PC は beforeinstallprompt→ネイティブ起動、iOS は手順案内。閉じたら `simplenote-install-prompt-dismissed` に記録し再表示しない（standalone/Tauri では非表示）。
- SWのアセットfetch失敗時はHTMLを返さない（モジュール破損防止）。キャッシュ名を上げると旧キャッシュ一掃。
