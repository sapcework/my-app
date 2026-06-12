# LINE Chat アプリ 仕様書

> 初心者向け技術解説付き

---

## 1. アプリ概要

LINEのようなリアルタイムチャットアプリです。
ブラウザで動作し、複数のユーザーが同時にメッセージをやり取りできます。

**公開URL:** https://line-flax-nine.vercel.app

---

## 2. 使用技術（技術スタック）

### フロントエンド（画面を作る部分）

| 技術 | 役割 | 初心者向け説明 |
|------|------|----------------|
| **Next.js 16** | Webアプリのフレームワーク | Reactをもっと使いやすくしたもの。ページ遷移や画面描画を管理する |
| **React 19** | UI ライブラリ | 画面のパーツ（コンポーネント）を組み合わせてUIを作るJavaScriptライブラリ |
| **TypeScript** | プログラミング言語 | JavaScriptに「型」を追加したもの。変数の型ミスをコンパイル時に検出できる |
| **Tailwind CSS v4** | スタイリング | CSSクラスを直接HTMLに書くスタイル手法。`className="text-green-500"` のように使う |

### バックエンド（データを管理する部分）

| 技術 | 役割 | 初心者向け説明 |
|------|------|----------------|
| **Supabase** | バックエンドサービス | データベース・認証・リアルタイム通信をまとめて提供するサービス |
| **PostgreSQL** | データベース | データを表形式で保存するシステム（Supabaseの中で動いている） |
| **Supabase Auth** | 認証 | メールアドレス＋パスワードでのログイン・サインアップ機能 |
| **Supabase Realtime** | リアルタイム通信 | データベースの変更を即座に全ユーザーへ通知する仕組み |
| **Supabase Storage** | ファイル保存 | アバター画像などのファイルをクラウドに保存する |

### デプロイ（公開する部分）

| 技術 | 役割 | 初心者向け説明 |
|------|------|----------------|
| **Vercel** | ホスティング | Next.jsを作ったチームが運営するサービス。GitHubにpushすると自動でデプロイされる |
| **GitHub** | ソースコード管理 | コードのバージョン管理。変更履歴を記録し、Vercelと連携する |

---

## 3. ファイル構成

```
line/
├── src/
│   ├── app/                    # ページ（URLと対応）
│   │   ├── page.tsx            # トップページ（/rooms にリダイレクト）
│   │   ├── login/page.tsx      # ログイン・サインアップ画面
│   │   ├── rooms/
│   │   │   ├── page.tsx        # トーク一覧画面
│   │   │   └── [roomId]/
│   │   │       └── page.tsx    # チャット画面（[roomId]は動的なID）
│   │   └── settings/page.tsx   # 設定画面
│   │
│   ├── hooks/                  # ロジック（データ取得・更新）
│   │   ├── useAuth.ts          # ログイン状態の管理
│   │   ├── useMessages.ts      # メッセージの取得・送信・削除
│   │   ├── useRooms.ts         # トームの取得・作成・参加・退出
│   │   ├── useReadStatus.ts    # 既読状態の管理
│   │   ├── useOnline.ts        # オンライン状態の管理
│   │   ├── useProfile.ts       # アバター・表示名の更新
│   │   ├── useUserSearch.ts    # ユーザー検索
│   │   └── useTabNotification.ts # タブタイトルの通知
│   │
│   ├── components/             # 再利用できるUIパーツ
│   │   ├── chat/
│   │   │   ├── MessageBubble.tsx  # メッセージの吹き出し
│   │   │   ├── MessageList.tsx    # メッセージ一覧
│   │   │   └── MessageInput.tsx   # メッセージ入力欄
│   │   ├── room/
│   │   │   └── RoomListItem.tsx   # トーク一覧の各行
│   │   └── ui/
│   │       ├── Avatar.tsx         # アバター画像
│   │       ├── BottomNav.tsx      # 下部タブナビ
│   │       └── UserSearchInput.tsx # ユーザー検索入力
│   │
│   └── lib/
│       ├── types.ts            # 型定義（TypeScriptの型）
│       └── supabase/
│           ├── client.ts       # ブラウザ用Supabaseクライアント
│           └── server.ts       # サーバー用Supabaseクライアント
│
├── supabase/
│   └── schema.sql              # データベースのテーブル定義
│
├── .env.local                  # 環境変数（Supabaseの接続情報）
└── CLAUDE.md                   # 開発ルール
```

> **hooks とは？**
> React の「カスタムフック」です。`use` で始まる関数で、データ取得やリアルタイム購読などのロジックをコンポーネントから分離して再利用できます。

---

## 4. データベース設計

### テーブル一覧

```
users          ユーザー情報
rooms          トーク（グループ）
room_members   どのユーザーがどのトークに参加しているか
messages       メッセージ
room_reads     既読状態
```

### テーブルの関係

```
users ──< room_members >── rooms
users ──< messages >──── rooms
users ──< room_reads >── rooms
```

`<` は「1対多」を表します（1つのroomに複数のmembersがいる、など）

### 各テーブルの詳細

#### users（ユーザー）
| カラム | 型 | 説明 |
|--------|----|----|
| id | UUID | ユーザーID（自動生成） |
| email | TEXT | メールアドレス |
| display_name | TEXT | 表示名 |
| avatar_url | TEXT | アバター画像のURL |
| last_seen | TIMESTAMPTZ | 最終アクセス日時 |

#### rooms（トーク）
| カラム | 型 | 説明 |
|--------|----|----|
| id | UUID | トームID |
| name | TEXT | トーク名 |
| created_by | UUID | 作成者のユーザーID |
| last_message_at | TIMESTAMPTZ | 最後のメッセージ日時 |

#### messages（メッセージ）
| カラム | 型 | 説明 |
|--------|----|----|
| id | UUID | メッセージID |
| room_id | UUID | どのトークのメッセージか |
| sender_id | UUID | 送信者のユーザーID |
| content | TEXT | メッセージ本文 |
| type | TEXT | `text`（テキスト）or `stamp`（スタンプ） |
| created_at | TIMESTAMPTZ | 送信日時 |

---

## 5. セキュリティ（RLS ポリシー）

> **RLS（Row Level Security）とは？**
> 「行レベルセキュリティ」。データベースの各行に対して、誰がアクセスできるかをルールで制御する仕組みです。
> 例：「自分のメッセージしか削除できない」「参加しているトークのメッセージしか見られない」

### 主なルール

| テーブル | 操作 | ルール |
|---------|------|--------|
| users | 閲覧 | 全員が見られる |
| users | 更新 | 自分のデータのみ |
| rooms | 閲覧 | メンバーまたは作成者のみ |
| rooms | 作成 | ログイン済みなら誰でも |
| rooms | 更新 | メンバーなら誰でも（グループ名変更） |
| messages | 閲覧 | 同じトームのメンバーのみ |
| messages | 作成 | 同じトームのメンバーのみ |
| messages | 削除 | 自分のメッセージのみ |
| room_reads | 閲覧 | 同じトームのメンバーのみ |
| storage/avatars | 閲覧 | 全員 |
| storage/avatars | アップロード | 自分のフォルダのみ |

---

## 6. リアルタイム通信の仕組み

Supabase Realtime を使い、ポーリング（定期的にサーバーを確認する）なしで即座に更新を反映します。

### 使用している Realtime の種類

#### postgres_changes（データベース変更の監視）
データベースへの INSERT/UPDATE/DELETE を自動検知します。

```
[ユーザーAがメッセージ送信]
     ↓
[messages テーブルに INSERT]
     ↓
[Supabase が変更を検知]
     ↓
[ユーザーBの画面に即座に反映]
```

用途：
- メッセージの新着通知（INSERT）
- 既読状態の更新（UPDATE）
- オンライン状態の更新（UPDATE）

#### broadcast（ブロードキャスト）
データベースを経由せず、接続中のユーザーに直接メッセージを送ります。

```
[ユーザーAがメッセージ削除]
     ↓
[channel.send('message_deleted', { messageId })]
     ↓
[ユーザーBの画面から即座にメッセージが消える]
```

用途：
- メッセージ削除の即時反映

---

## 7. 実装済み機能一覧

### 認証
- メールアドレス＋パスワードでのサインアップ・ログイン
- ログアウト
- 自動ログイン状態の維持

### トーク（ルーム）
- トーク一覧の表示
- 新しいトークの作成
- 参加していないトークへの参加
- トークからの退出
- グループ名の変更

### メッセージ
- テキストメッセージの送受信
- スタンプ（絵文字）の送信
- **楽観的更新**：送信完了を待たずに即座に表示
- メッセージの削除（自分のメッセージのみ）

> **楽観的更新とは？**
> サーバーの応答を待たずに、まず画面に表示してしまう手法。
> サーバーで失敗した場合は表示を取り消します。体感速度が向上します。

### 既読表示
- 相手がメッセージを読んだら「既読」と表示
- `room_reads` テーブルの `last_read_message_id` で管理（O(1)判定）

> **O(1)とは？**
> 「メッセージ数に関係なく、常に一定の速度で判定できる」という意味。
> 既読かどうかを確認するのに、全メッセージを調べる必要がない効率的な設計。

### オンライン状態
- 60秒ごとに `last_seen` を更新
- 60秒以内に更新があれば「オンライン」と判定

### プロフィール・アバター
- アバター画像のアップロード・変更（Supabase Storage）
- 表示名の変更
- 設定ページ（/settings）

### ユーザー招待
- メールアドレスでユーザーを検索
- トーク作成時にメンバーを招待
- 既存トークへのメンバー追加

### 通知
- 他ユーザーからメッセージが届いたとき、タブタイトルに件数を表示
  例：`(2) room 1 | LINE Chat`
- タブにフォーカスが戻ると自動リセット

---

## 8. 環境変数

`.env.local` ファイルに設定（Gitには含めない）：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
```

> **NEXT_PUBLIC_ とは？**
> Next.js の規則で、`NEXT_PUBLIC_` で始まる環境変数はブラウザからも読み取れます。
> ビルド時にコードに埋め込まれます。
> `NEXT_PUBLIC_` がない変数はサーバーサイドのみで使用できます。

> **anon key とは？**
> Supabaseへのアクセスに使う公開キー。RLSポリシーで保護されているため、公開しても安全です。

---

## 9. 開発・デプロイの流れ

```
1. コードを編集（VS Code等）
       ↓
2. ローカルで確認（npm run dev → http://localhost:3000）
       ↓
3. git commit（変更を記録）
       ↓
4. git push（GitHubへアップロード）
       ↓
5. Vercelが自動検知してビルド・デプロイ
       ↓
6. https://line-flax-nine.vercel.app に反映
```

### 開発コマンド

```bash
npm run dev       # 開発サーバー起動
npm run build     # 本番ビルド（エラーチェックも兼ねる）
npm run lint      # コード品質チェック
npx tsc --noEmit  # TypeScriptの型チェックのみ
```

---

## 10. デザインカラー

| 用途 | カラーコード |
|------|------------|
| メインカラー（ヘッダー・ボタン） | `#4CAF50`（緑） |
| チャット背景 | `#b2d8ea`（青グレー） |
| 自分のメッセージ | `#4CAF50`（緑） |
| 相手のメッセージ | `#FFFFFF`（白） |
