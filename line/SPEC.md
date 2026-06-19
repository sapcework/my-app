# TALK（チャットアプリ）仕様書

> 初心者向け技術解説付き。LINE風のリアルタイムチャット（アプリ名は仮称「TALK」・`src/lib/appInfo.ts` で変更可）

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
| **Supabase Auth** | 認証 | パスワードでのログイン機能。本アプリは**管理者がアカウントを発行**する方式（自己登録なし・メール不要） |
| **Supabase Realtime** | リアルタイム通信 | データベースの変更を即座に全ユーザーへ通知する仕組み |
| **Supabase Storage** | ファイル保存 | アバター画像（公開）とチャット画像（**非公開＝署名URLで配信**）をクラウドに保存する |
| **web-push (VAPID)** | プッシュ通知 | アプリ非表示時もOSの通知を送る仕組み |

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
users              ユーザー情報（is_admin / is_suspended を含む）
rooms              トーク（グループ）
room_members       どのユーザーがどのトークに参加しているか（role: owner/admin/member）
messages           メッセージ（reply_to で返信先を保持）
room_reads         既読状態
message_reactions  メッセージへのリアクション（絵文字）
room_mutes         ルーム単位の通知ミュート（ユーザーごと）
room_invites       招待リンク（トークン・7日有効）
push_subscriptions Web Push の購読情報
login_attempts     ログイン失敗の記録（ロック判定・email+ip単位）
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
| email | TEXT | メールアドレス（メール無しユーザーは `名前@talk.local` の擬似メール） |
| display_name | TEXT | 表示名 |
| avatar_url | TEXT | アバター画像のURL |
| last_seen | TIMESTAMPTZ | 最終アクセス日時 |
| is_admin | BOOLEAN | 管理者フラグ（本人では変更不可・service roleのみ） |
| is_suspended | BOOLEAN | 利用停止フラグ（同上） |

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
| content | TEXT | メッセージ本文（画像の場合は**ストレージのパス**を保持し、表示時に署名URL化） |
| type | TEXT | `text`（テキスト）/ `stamp`（スタンプ）/ `image`（画像） |
| reply_to | UUID | 返信先メッセージID（任意・元削除時はNULL） |
| created_at | TIMESTAMPTZ | 送信日時 |

#### その他の主なテーブル
| テーブル | 主なカラム | 説明 |
|---|---|---|
| room_members | room_id, user_id, **role** | role は `owner`/`admin`/`member` |
| message_reactions | message_id, user_id, emoji（複合PK） | 1ユーザー・1絵文字につき1件 |
| room_mutes | user_id, room_id（複合PK） | ミュート中ルーム |
| room_invites | room_id, token, expires_at | 招待リンク（7日有効） |

---

## 5. セキュリティ（RLS ポリシー）

> **RLS（Row Level Security）とは？**
> 「行レベルセキュリティ」。データベースの各行に対して、誰がアクセスできるかをルールで制御する仕組みです。
> 例：「自分のメッセージしか削除できない」「参加しているトークのメッセージしか見られない」

### 主なルール

| テーブル | 操作 | ルール |
|---------|------|--------|
| users | 閲覧 | 全員が見られる |
| users | 更新 | **自分の行のみ**。`is_admin`/`is_suspended` はトリガーで本人変更を拒否（service roleのみ可） |
| rooms | 閲覧 | メンバーまたは作成者のみ |
| rooms | 作成 | ログイン済みなら誰でも |
| rooms | 更新 | owner/admin のみ（グループ名変更） |
| room_members | 追加/更新/キック | **クライアント直接は不可**。すべて権限チェック付きAPI（service role）経由。退出のみ本人が直接可 |
| messages | 閲覧/作成 | 同じトークのメンバーのみ |
| messages | 削除 | 自分のメッセージのみ |
| message_reactions | 付与/解除 | 本人のみ・同室メンバーのみ参照可 |
| room_mutes | 全操作 | 本人のみ |
| storage/avatars | 閲覧/アップロード | 閲覧は全員・アップロードは自分のフォルダのみ |
| storage/chat-images | 閲覧 | **非公開**。同室メンバーのみ署名URLを発行可（公開URLは廃止） |
| storage/chat-images | アップロード/削除 | アップロードは**自分のフォルダ かつ 所属ルーム**のみ・削除は**自分がアップロードした画像のみ**（SQLポリシーで強制） |

> **RLSの再帰回避**：メンバー判定は `is_room_member()` という SECURITY DEFINER 関数に集約し、ポリシーの無限再帰を防いでいます。

### 認証・アカウント

- **管理者がアカウントを発行**（自己登録なし）。管理画面でユーザー名＋パスワードを作成し、内部的に `名前@talk.local` の擬似メールに写像。**メール不要で誰でも利用可能**。
- ログインは**ユーザー名**で行う（`@` を含む入力は既存メールとして後方互換）。
- **ログインロック**：同一(email+ip)で5回失敗→15分ロック＋IP単位の総量制限（DoS緩和）。失敗履歴は service role のみアクセス可。
- **停止アカウントの実効化**：表示制御だけでなく実際にログインを遮断。①ログインAPIで認証成功後に停止判定し、停止時はcookie未設定＋サーバー側signOutで403（「停止されています」を表示）。②停止操作時にSupabase Authも `ban`（解除時は `none`）し、**既存セッションのトークン更新も止める**。

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

### 認証・アカウント
- **管理者によるアカウント発行**（ユーザー名＋パスワード・メール不要）
- ユーザー名でのログイン／ログアウト／ログイン状態の維持
- ログインロック（連続失敗・(email+ip)単位）と管理者によるロック解除
- **アカウント削除（退会）**：本人の送信メッセージ等を整合的に削除
- 管理者機能：ユーザー停止/解除・ルーム削除・メッセージ監視

### トーク（ルーム）
- トーク一覧／作成／参加／退出／グループ名変更
- **グループのロール**（owner / admin / member）とメンバー管理（キック・ロール変更）
- **招待リンク**（7日有効）とメール（ユーザー）検索による直接追加
- **通知ミュート**（ルーム単位・ユーザーごと）

### メッセージ
- テキスト／スタンプ／**画像**の送受信（画像は非公開ストレージ＋署名URL）
- **楽観的更新**：送信完了を待たずに即座に表示
- **送信失敗時の再送**（失敗を保持しタップで再送）
- メッセージの削除（自分のメッセージのみ・長押し/右クリックメニュー＋確認）
- **リアクション**（絵文字・集計表示・自分のトグル）
- **リプライ／引用**（返信先の抜粋を吹き出しに表示）
- メッセージ検索・ハイライト
- 画像の**アプリ内ライトボックス**表示

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
- タブタイトルに未読件数を表示（フォーカスで自動リセット）
- **フォアグラウンド通知**：アプリ表示中の新着でトースト＋通知音＋バイブ
- **バックグラウンド通知**：アプリ非表示でも OS のプッシュ通知（Web Push / VAPID）
- ミュート中ルームは前景・背景とも通知しない

### UI / UX
- **ダークモード**（ライト / ダーク / 端末に合わせる・チラつきなし）
- アバターを名前で自動色分け
- アクセシビリティ（aria-label・キーボードフォーカスリング）
- 新着で勝手にスクロールしない＋「新着メッセージ↓」ピル
- PWA（ホーム画面に追加可能）

---

## 8. 環境変数

`.env.local` ファイルに設定（Gitには含めない）：

```
# ブラウザからも読める公開値
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxxx          # プッシュ通知用の公開鍵

# サーバー側のみ（絶対に公開しない）
SUPABASE_SERVICE_ROLE_KEY=xxxx             # RLSを越える管理操作（アカウント発行・停止など）
SUPABASE_WEBHOOK_SECRET=xxxx               # プッシュ送信Webhookの認証
VAPID_PRIVATE_KEY=xxxx                     # プッシュ通知用の秘密鍵
VAPID_EMAIL=mailto:you@example.com
```

> **service role key とは？**
> RLS（行レベルセキュリティ）を**無視できる**強力な管理者キー。サーバー側のAPIだけで使い、
> アカウント発行・停止・退会処理など権限チェック済みの操作に限定して使用します。絶対にブラウザへ出しません。

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

ダークモードでは背景 `#121212`、カード `#1e1e1e`、相手の吹き出し `#262626`、チャット背景 `#0e1c24` などに切り替わります（緑のアクセントは共通）。
