# kakeiboWeb 仕様書

## 概要

シンプルな個人支出管理 Web アプリ。スマートフォンでの利用を主眼に置いたモバイルファーストの PWA 対応 SPA。

- **バージョン**: 1.1.0
- **ビルド**: 2026.07
- **定数管理**: アプリ名・バージョン・ビルドは `src/constants/app.ts` で一元管理
- **リポジトリ**: `kakeiboWeb/`

---

## 技術スタック

| 分類 | ライブラリ / ツール | バージョン |
|------|-------------------|-----------|
| UI フレームワーク | React | ^19.2.5 |
| 言語 | TypeScript | ~6.0.2 |
| ビルドツール | Vite | ^8.0.10 |
| CSS | Tailwind CSS v4 | ^4.1.8 |
| ルーティング | React Router v7 | ^7.6.1 |
| 状態管理 | Zustand v5 + persist | ^5.0.4 |
| チャート | Recharts | ^3.8.1 |
| アイコン | Lucide React | ^1.16.0 |
| BaaS | Supabase (Auth + Postgres) | @supabase/supabase-js ^2.108.2 |
| テスト | Vitest | ^4.1.10 |
| デプロイ | Vercel | — |

### ビルド・開発コマンド

```bash
npm run dev       # 開発サーバー起動
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run test      # vitest run（純粋関数のユニットテスト）
npm run preview   # ビルド成果物のプレビュー
```

### CI

`.github/workflows/kakeiboweb-ci.yml`（GitHub Actions）。`kakeiboWeb/**` への push・PR を契機に、`npm ci` → `lint` → `tsc -b`（strictチェック） → `test` → `build` の順で実行する。

---

## データモデル

### Category（カテゴリ）

```ts
type Category = {
  id: string      // UUID
  name: string    // カテゴリ名
  color: string   // 表示色（hex）
  icon: string    // 絵文字アイコン
}
```

**初期データ（16件、`DEFAULT_CATEGORIES`）**

| id | name | color | icon |
|----|------|-------|------|
| 1 | 食費 | #FF9800 | 🍽️ |
| 2 | 外食 | #FF5722 | 🍜 |
| 3 | 住居 | #009688 | 🏠 |
| 4 | 光熱費 | #FFC107 | 💡 |
| 5 | 通信費 | #03A9F4 | 📱 |
| 6 | 交通費 | #2196F3 | 🚗 |
| 7 | 日用品 | #4CAF50 | 🛒 |
| 8 | 衣服・美容 | #E91E63 | 👗 |
| 9 | 医療 | #F44336 | 🏥 |
| 10 | 保険 | #607D8B | 🛡️ |
| 11 | 教育 | #3F51B5 | 📚 |
| 12 | サブスク | #9C27B0 | 💳 |
| 13 | 娯楽 | #8BC34A | 🎮 |
| 14 | 旅行 | #00BCD4 | ✈️ |
| 15 | 貯蓄・投資 | #795548 | 💰 |
| 16 | その他 | #9E9E9E | 📦 |

### Expense（支出）

```ts
type Expense = {
  id: string          // crypto.randomUUID()
  amount: number      // 金額（円）
  categoryId: string  // Category.id への参照
  itemName?: string   // 項目名（任意）
  note: string        // メモ（任意）
  date: string        // YYYY-MM-DD
  createdAt: string   // ISO 8601（自動セット）
  updatedAt?: string  // ISO 8601（更新時に自動セット）
}
```

### Budget（予算）

```ts
type Budget = {
  month: string   // YYYY-MM
  amount: number  // 予算金額（円）
}
```

### RecurringExpense（定期支出）

```ts
type RecurringExpense = {
  id: string        // UUID
  amount: number    // 金額（円）
  categoryId: string
  name: string      // 支出名（必須）
  dayOfMonth: number // 毎月の発生日（1〜31、月末調整あり）
  lastGeneratedMonth?: string // 自動登録済みの最終年月（YYYY-MM）。重複生成防止用
}
```

---

## データ永続化

**Supabase（Postgres）をデータの正としてクラウド保存**しつつ、Zustand の `persist` ミドルウェアで **localStorage にもキャッシュ**する二層構成。

| ストア | localStorage キー | Supabaseテーブル |
|--------|-----------------|-----------------|
| expenseStore | `kakeibo-expenses` | `expenses` |
| categoryStore | `kakeibo-categories` | `categories` |
| budgetStore | `kakeibo-budgets` | `budgets` |
| recurringStore | `kakeibo-recurring` | `recurring_expenses` |
| passcodeStore | `kakeibo-passcode` | — （端末ローカルのみ） |

### 同期方式（`src/lib/db.ts`）

- ログイン時・`SIGNED_IN`イベント時（`authStore.loadStores()`）に Supabase から4テーブルを並列取得し、各ストアを一括上書きする。
- 追加・更新・削除は **楽観的更新**: まずローカルstateを即座に更新し、その後 Supabase へ書き込む。書き込みが失敗した場合はローカルを元の状態に**ロールバック**し、`showToast`でエラーを通知する（`console.error`にも記録）。
- 更新・削除系のSupabaseクエリは `user_id` 条件を必ず付与し、クライアント側でも他ユーザーの行を書き換えられないよう防御している。
- カテゴリはID単位の個別行操作（insert/update/delete）で同期する（旧実装の「全削除→全挿入」は非アトミックなため廃止済み）。
- バックアップ「復元」は、**先にSupabase側を全置換（削除→再挿入）し、成功した場合のみローカルにも反映**する。クラウド書き込みが失敗した場合はローカルを変更せず、クラウドを正の状態に保つ。

### RLS（Row Level Security）

`supabase/migrations/` にポリシーをSQLとして管理する（`0001_row_level_security.sql`, `0002_recurring_last_generated_month.sql`）。各テーブルとも `auth.uid() = user_id` を条件にselect/insert/update/deleteを制限。Supabaseダッシュボード側での適用確認が必要（リポジトリのSQLはコード資産であり、実行はSupabase SQL Editorで手動）。

---

## 画面構成・ルーティング

```
/               → ホーム（HomePage）
/expenses       → 支出一覧（ExpenseListPage）
/expenses/new   → 支出追加（ExpenseFormPage）
/expenses/:id/edit → 支出編集（ExpenseFormPage）
/stats          → 統計（StatsPage）
/table          → 月別支出表（TablePage）
/settings       → 設定（SettingsPage）
/categories     → カテゴリ管理（CategoryPage）
/budget         → 予算設定（BudgetPage）
/recurring      → 定期支出（RecurringPage）
```

全ルートは `Layout` コンポーネントでラップされ、下部ナビゲーションバーが共通表示される。

### ナビゲーションバー（Navbar）

5タブ構成。アクティブタブはインジゴ色でハイライト。

| タブ | アイコン | パス |
|------|---------|------|
| ホーム | Home | / |
| 支出 | Receipt | /expenses |
| 表 | Grid3X3 | /table |
| 統計 | PieChart | /stats |
| 設定 | Settings | /settings |

※ タブ移動は `replace` 遷移（履歴を積み上げない）。

### 戻る（バック）ナビゲーション

Android のバックボタン・ブラウザの戻る・画面端スワイプに対し、**ブラウザ履歴の逆再生ではなく画面階層の上位（親）へ移動**する。実装は `src/hooks/useAppBackButton.ts`（`Layout` で有効化）。

**親（戻り先）マップ**

| 現在画面 | 戻る先 |
|---------|--------|
| ホーム（/） | 終了（下記） |
| 支出一覧・表・統計・設定 | ホーム（/） |
| 支出追加・編集 | 支出一覧（/expenses） |
| カテゴリ・予算・定期支出 | 設定（/settings） |

**仕組み**
- 画面遷移のたび最上位へ「捕捉用」の履歴エントリを積む（戻る＝これが pop されて `popstate` 発火）
- 戻る検知時、現在画面の親を求めて `navigate(parent, { replace: true })` で遷移（履歴を逆再生しない）
- タブ移動を `replace` にし、履歴が積み上がらないようにする
- ホームで戻ると「もう一度戻ると終了します」トーストを表示し、2秒以内に再度戻るとアプリ終了（誤終了を防止）

---

## 各画面の仕様

### ホーム（HomePage）

**パス**: `/`

**表示内容**
- 月選択スイッチャー（`MonthSwitcher`）
- KPI カード
  - 今月の支出合計
  - 件数 ＋ 前月比（前月に支出がある場合のみ。増加は赤・減少は緑で `前月±¥n` 表示）
  - 予算設定時: 残額 or 超過額バッジ（緑 / 赤）
  - 予算設定時: 使用率プログレスバー（0〜79%: インジゴ、80〜99%: アンバー、超過: ローズ）
- 最近の支出リスト（直近5件、日付降順）
  - カテゴリアイコン・カテゴリ名・項目名 or メモ・日付・金額
  - タップで編集画面へ遷移
- FAB（右下固定）: 支出追加 → `/expenses/new`

---

### 支出一覧（ExpenseListPage）

**パス**: `/expenses`

**表示内容**
- 月選択スイッチャー
- キーワード検索バー（項目名・メモ・金額に対してインクリメンタル検索）
- カテゴリフィルターチップ（「すべて」＋各カテゴリ）
- 件数・合計金額サマリー
- 支出リスト（日付グループ表示、日付降順）
  - 日付ヘッダー帯: `YYYY年M月D日(曜日)` ＋ 日計金額（隣接表示）
  - 各支出アイテム: 左端にカテゴリカラー帯 → アイコン → カテゴリ名・項目名 → 金額・削除ボタン
  - アイテムタップで編集画面へ遷移
  - 削除ボタン: confirm ダイアログ後に削除
- FAB（右下固定）: 支出追加 → `/expenses/new`

---

### 支出追加・編集（ExpenseFormPage）

**パス**: `/expenses/new`, `/expenses/:id/edit`

**フォーム項目**

| フィールド | 入力方法 | 必須 |
|-----------|---------|------|
| 金額 | 電卓（Calculator）ボタン起動 | ○ |
| カテゴリ | グリッドボタン選択（4列） | ○ |
| 日付 | `<input type="date">` | ○ |
| 項目名 | テキスト入力（**選択中カテゴリで使った**項目名を使用回数順にサジェスト。打った文字で絞り込み） | — |
| メモ | テキストエリア（2行） | — |

**動作**
- 新規: `addExpense` → `createdAt` 自動セット。「追加しました」トースト表示
- 編集: `updateExpense` → `updatedAt` 自動セット。「更新しました」トースト表示
- 編集URLの支出が存在しない場合（削除済み・不正id）は「この支出は見つかりませんでした」画面を表示し、支出一覧への導線を出す
- 削除ボタン（編集時のみ）: confirm ダイアログ後に削除、前画面に戻る
- 金額が 0 の場合は送信ボタンを無効化
- デフォルト日付: 当月なら今日、それ以外なら月初1日
- 送信（追加/更新）ボタンは画面下部に固定表示（`sticky`、Navbar 直上）。カテゴリを増やしてもボタンが隠れず常に押せる

---

### 統計（StatsPage）

**パス**: `/stats`

**表示内容**
- 月選択スイッチャー
- 合計金額カード ＋ CSV 出力ボタン
- ドーナツパイチャート（recharts）
  - カテゴリ別色分け
  - タップ: カテゴリ詳細モーダル表示
  - ツールチップ: `¥{金額}`
  - 凡例表示
- カテゴリ別リスト（金額降順）
  - アイコン・カテゴリ名・割合(%)・金額
  - タップ: カテゴリ詳細モーダル表示
- カテゴリ詳細モーダル（ボトムシート）
  - カテゴリ名・件数・合計金額
  - 支出リスト（日付降順）
  - 各アイテムタップで編集画面へ遷移

**CSV 出力**（当月分）
- ファイル名: `kakeibo_YYYY-MM.csv`
- 列: 日付, カテゴリ, 項目名, メモ, 金額, 登録日時, 更新日時
- 登録・更新日時フォーマット: `YYYYMMDDHHMMSS`（ローカル時刻）
- BOM 付き UTF-8（Excel 対応）

---

### 月別支出表（TablePage）

**パス**: `/table`

**表示内容**
- 直近12ヶ月分（支出が存在する月 ＋ 当月）の横断テーブル
- 行: カテゴリ、列: 年月 ＋ 平均列
- 合計行: 月合計（予算超過時はローズ色）
- 予算行: 月別予算額（設定がある月のみ表示）
- 平均列: 支出がある月のみで平均計算
- セルタップ: 詳細モーダル（ボトムシート）で明細一覧。金額のあるセルは `tabIndex` 付与でキーボード（Enter/Space）でも開ける
- 空データ時はプレースホルダー表示

**実装メモ**: `expenses`を1回だけ走査して「月×カテゴリ」の合計を`Map`に事前集計し、セル描画時はO(1)ルックアップにしている（件数が多い場合に毎回全件`filter`する方式を避けるため）。

---

### 設定（SettingsPage）

**パス**: `/settings`

#### データ管理セクション

| 機能 | 説明 |
|------|------|
| バックアップ | 全データ（支出・カテゴリ・予算・定期支出）を JSON ファイルに書き出し。形式は**アプリ版（Flutter）と共通の v2**（`buildBackup`）で、そのままアプリ版で復元できる |
| 復元 | JSON バックアップファイルから全ストアを上書き復元。読み込み時に `parseBackup`（`src/utils/backup.ts`）で**全行を型検証**し、1件でも不正なデータ（金額が数値でない・日付形式不正・範囲外の値など）があればファイル全体を拒否して何件目が不正かを表示する。**v2（アプリ版と共通）と v1（Web版の旧形式）の両方を読める**。検証通過後、確認ダイアログに件数を表示。**Supabase側への反映が成功した場合のみ**ローカルにも反映する（クラウドを正とするため、失敗時はローカルを変更せずエラートーストを表示） |
| 全明細 CSV 出力 | 全年月分の支出明細を1ファイルに出力（`kakeibo_all_YYYY-MM-DD.csv`）。`StatsPage`の当月CSV出力と共通の`expenseDetailRows`（`src/utils/csv.ts`）を使用 |
| 月別支出表 CSV 出力 | 行=年月・列=カテゴリの集計表（`kakeibo_monthly_YYYY-MM-DD.csv`）|

**バックアップ JSON 形式（v2 = アプリ版との共通移行フォーマット）**
```json
{
  "version": "2",
  "exportedAt": "ISO 8601",
  "app": "kakeibo-web",
  "categories": [{ "id": "1", "name": "食費", "color": "#FF9800", "icon": "🍽️", "iconName": "restaurant", "sortOrder": 0 }],
  "expenses": [{ "id": "uuid", "amount": 1200, "categoryId": "1", "itemName": "ランチ", "note": "", "date": "2026-08-04", "createdAt": "ISO 8601" }],
  "budgets": [{ "month": "2026-08", "amount": 50000 }],
  "recurring": [{ "id": "uuid", "name": "家賃", "amount": 80000, "categoryId": "1", "dayOfMonth": 27, "isActive": true }]
}
```

- 仕様の詳細（ID の振り直し規則・変換で失われる項目）は `kakeibo/docs/backup-format-v2.md` を参照
- アイコンは絵文字（Web版）と Material Icons 名（アプリ版）の両方を書き出す。対応表は `src/utils/categoryIcon.ts`
- 取り込み時、支出・定期支出の ID が UUID でなければ採番し直す（Supabase の uuid 型カラムに備えるため）。カテゴリ ID はそのまま使う
- `isActive: false` の定期支出は Web版に「無効」の概念が無いため取り込まない
- `lastGeneratedMonth`（最後に自動生成した月）は両アプリで往復する。これが欠けるとアプリ版で復元直後に当月分が二重登録される
- version:"1" でもアプリ版の旧形式（ID が整数・`colorValue`/`memo` を持つ）は判別して「取り直してほしい」旨のエラーを返す

**全明細 CSV 列**: 日付, カテゴリ, 項目名, メモ, 金額, 登録日時, 更新日時

**月別支出表 CSV 列**: 年月, [使用カテゴリ名...], 合計

#### 管理セクション

| メニュー | 遷移先 |
|---------|--------|
| カテゴリ | /categories |
| 予算設定 | /budget |
| 定期支出 | /recurring |

#### セキュリティセクション

| 機能 | 説明 |
|------|------|
| パスコードロック | 4桁PINでアプリ起動時に画面ロック（`PasscodeLock`/`PinPad`）。ハッシュ化はPBKDF2-SHA256・20万回イテレーション（`src/utils/passcode.ts`）。**5回連続で入力を間違えると30秒間ロックし、カウントダウンを表示**する（ブルートフォース対策、`passcodeStore`の`failedAttempts`/`lockedUntil`） |

#### バージョン情報セクション

| 項目 | 値 |
|------|---|
| バージョン | 1.0.0 |
| ビルド | 2026.07 |
| プラットフォーム | Web (PWA対応) |
| データ保存 | Supabase（クラウド）＋ ローカルキャッシュ（localStorage） |

---

### カテゴリ管理（CategoryPage）

**パス**: `/categories`（設定 → カテゴリから遷移）

**機能**
- カテゴリ一覧表示（アイコン・色・名前）
- 新規追加: 名前・絵文字アイコン・カラーピッカー入力。追加時にトースト表示
- 編集: リストのカテゴリをタップするとフォームに内容を読み込み、「更新する」で保存（`updateCategory`）。編集中カテゴリを削除した場合はフォームを閉じる
- 削除: ゴミ箱ボタン。確認ダイアログに、削除対象カテゴリを使用している支出件数がある場合はその件数と「削除後も支出データ自体は残り、カテゴリ表示が『不明』になる」旨を表示する
- 戻るボタン → `/settings`

---

### 予算設定（BudgetPage）

**パス**: `/budget`（設定 → 予算設定から遷移）

**機能**
- 月選択スイッチャー
- 当月の支出合計・予算残額・使用率プログレスバー表示
- 予算金額入力（電卓起動ボタン）
- 保存ボタン（保存時に「YYYY年M月の予算を保存しました」トースト表示）
- 戻るボタン → `/settings`

---

### 定期支出（RecurringPage）

**パス**: `/recurring`（設定 → 定期支出から遷移）

**機能**
- 登録済み定期支出リスト（カテゴリ・名前・金額・毎月何日）
- 追加ボタン → ボトムシートフォーム
  - カテゴリ選択グリッド
  - 支出名入力
  - 金額入力（電卓起動ボタン）
  - 毎月何日（1〜31）入力。「アプリを開いたときに自動登録されます」と注記表示
- 削除: ゴミ箱ボタン
- 戻るボタン → `/settings`

**自動登録の仕組み**（`src/utils/recurringGenerator.ts`）
- サーバー側cronは使わず、ログイン・アプリ起動のたびにクライアント側で判定する（`authStore.loadStores()`から呼び出し）。
- 対象: `today.getDate() >= min(dayOfMonth, 当月の日数)` かつ `lastGeneratedMonth !== 当月` の定期支出。31日指定でも2月なら月末に生成されるよう調整する。
- 過去に遡っての一括生成（バックフィル）はしない。生成後は `lastGeneratedMonth` を当月に更新し、二重生成を防ぐ。
- 既知の限界: 支出の追加と `lastGeneratedMonth` の更新は別々のSupabase書き込みのため、片方だけ失敗すると次回起動時に重複生成される可能性がある（トランザクション化はスコープ外）。

---

## コンポーネント仕様

### Calculator

**ファイル**: `src/components/Calculator.tsx`

フルスクリーンオーバーレイ（`fixed inset-0 z-50`）のボトムシート型電卓。

| Props | 型 | 説明 |
|-------|----|------|
| initialValue | number (任意) | 初期表示値 |
| onConfirm | (value: number) => void | = ボタン押下時、`Math.round()` した整数値を返す |
| onClose | () => void | 背景タップまたはキャンセル時 |

- 四則演算（+, −, ×, ÷）対応
- 演算式を上段に表示
- AC（全クリア）・バックスペースボタン
- 現在アクティブな演算子をインジゴ色でハイライト
- 結果は整数に丸め（`Math.round`）
- 物理キーボード対応: 数字・`.`・`+ - * /`・Enter/`=`（確定）・Backspace（1文字削除）・Delete（AC）
- a11y: `role="dialog"` `aria-modal="true"`、開いた瞬間にパネルへフォーカス移動、Escapeで閉じる（`src/hooks/useModalA11y.ts`を使用。`DatePicker`のカレンダーパネル・設定画面のPINシート・`StatsPage`/`TablePage`の詳細モーダルも同じフックで統一）

### PasscodeLock / PinPad

**ファイル**: `src/components/PasscodeLock.tsx`, `src/components/PinPad.tsx`

アプリ起動時の4桁PIN入力画面と、テンキーUI本体。物理キーボード（数字・Backspace）にも対応。`usePasscodeStore`の`verify()`が5回連続失敗で30秒ロックを返すため、ロック中は`PinPad`を表示せず「◯秒後に再試行できます」というカウントダウン表示に切り替える。

### ErrorBoundary

**ファイル**: `src/components/ErrorBoundary.tsx`

`main.tsx`で`<App />`全体をラップするクラスコンポーネント。レンダリング中の例外を捕捉し、白画面化を防いで「予期しないエラーが発生しました／再読み込みしてください」という復旧画面を表示する。

### MonthSwitcher

**ファイル**: `src/components/MonthSwitcher.tsx`

`◀ YYYY年M月 ▶` 形式の月切り替えコンポーネント。

| Props | 型 | 説明 |
|-------|----|------|
| month | string | YYYY-MM 形式 |
| onChange | (month: string) => void | 月変更時コールバック |

### Layout

**ファイル**: `src/components/Layout.tsx`

全ページ共通ラッパー。`<Outlet>` + `<Navbar>` を組み合わせ、下部ナビゲーションを固定配置。Android の戻る対応（`useAppBackButton`）もここで有効化する。

---

## ストア仕様

すべての追加・更新・削除アクションは非同期（`Promise<void>`）で、ローカルstateを楽観的に更新した後にSupabaseへ書き込む。書き込みが失敗した場合はローカルをロールバックし、`showToast`でユーザーに通知・`console.error`でログ出力する（詳細は「データ永続化」章）。

### expenseStore

| アクション | 説明 |
|-----------|------|
| `addExpense(data)` | id・createdAt を自動付与して追加 |
| `updateExpense(id, data)` | updatedAt を自動セットして更新 |
| `deleteExpense(id)` | 指定 id を削除 |
| `insertExpense(expense)` | id 付きのExpenseをそのまま追加（一覧の削除取り消し・定期支出の自動登録で使用） |
| `getMonthlyExpenses(month)` | YYYY-MM 形式で当月分をフィルタ |
| `restoreExpenses(expenses)` | バックアップ復元・クラウドからの再読み込み用（ローカルのみ上書き、Supabaseへは書き込まない） |

### categoryStore

| アクション | 説明 |
|-----------|------|
| `addCategory(data)` | id を自動付与して追加。Supabase側も対象カテゴリ1行のみinsert |
| `updateCategory(id, data)` | 指定フィールドを更新。Supabase側も対象カテゴリ1行のみupdate |
| `deleteCategory(id)` | 指定 id を削除。Supabase側も対象カテゴリ1行のみdelete |
| `restoreCategories(categories)` | バックアップ復元・クラウドからの再読み込み用（ローカルのみ上書き） |

### budgetStore

| アクション | 説明 |
|-----------|------|
| `setBudget(month, amount)` | 月別予算を設定（upsert） |
| `getBudget(month)` | 月別予算取得（未設定時は 0） |
| `restoreBudgets(budgets)` | バックアップ復元・クラウドからの再読み込み用（ローカルのみ上書き） |

### recurringStore

| アクション | 説明 |
|-----------|------|
| `addRecurring(data)` | id を自動付与して追加 |
| `updateRecurring(id, data)` | 指定フィールドを更新（`lastGeneratedMonth`の更新にも使用） |
| `deleteRecurring(id)` | 指定 id を削除 |
| `restoreRecurring(recurring)` | バックアップ復元・クラウドからの再読み込み用（ローカルのみ上書き） |

### passcodeStore

| 状態/アクション | 説明 |
|-----------|------|
| `enabled` / `hash` / `salt` | パスコード設定状態とPBKDF2ハッシュ・ソルト |
| `failedAttempts` / `lockedUntil` | 連続失敗回数とロック解除時刻（タイムスタンプ）。5回失敗で30秒ロック |
| `setPasscode(pin)` | 新しいPINを設定（失敗カウントもリセット） |
| `removePasscode()` | パスコードを解除 |
| `verify(pin)` | 検証。ロック中は検証自体を行わずfalseを返す。成功時は失敗カウントをリセット |

### authStore

| 状態/アクション | 説明 |
|-----------|------|
| `user` / `loading` | Supabaseセッションのユーザー情報とロード状態 |
| `init()` | セッション復元＋`onAuthStateChange`購読。ログイン成立時に`loadStores()`でクラウドから4テーブルを取得しストアへ反映、続けて定期支出の自動登録（`generateDueRecurringExpenses`）を実行 |
| `signIn(email, password)` | パスワードログイン（新規登録機能はなし、アカウントは管理者が発行） |
| `signOut()` | ログアウト。ローカルの全ストアも消去（前ユーザーのデータ残存防止） |

### uiStore

| 状態 | 型 | 初期値 | 説明 |
|------|----|----- --|------|
| selectedMonth | string | 当月（YYYY-MM） | 全画面共通の選択月 |
| setSelectedMonth | (month: string) => void | — | 月切り替え |

---

## セキュリティ設定（Vercel）

`vercel.json` で全レスポンスに以下のセキュリティヘッダーを付与。

| ヘッダー | 値 |
|---------|---|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 0 |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=() |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| Cross-Origin-Opener-Policy | same-origin |
| Cross-Origin-Resource-Policy | same-origin |
| Content-Security-Policy | default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://\<project\>.supabase.co wss://\<project\>.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; |

SPA ルーティング: すべてのパスを `/index.html` にリライト。

ビルド設定: `sourcemap: false`（ソースコード非露出）。

検索エンジン対策: 管理者発行アカウント制のプライベートアプリのため、`index.html` に `<meta name="robots" content="noindex, nofollow">` を設定（意図的に検索避け）。

---

## 認証・データベース（Supabase）

**ファイル**: `src/lib/supabase.ts`, `src/lib/db.ts`, `src/store/authStore.ts`

- **認証方式**: Supabase Auth のメール＋パスワードログインのみ。**自己登録（サインアップ）機能はなく、アカウントは管理者が発行**する（`LoginPage`にもその旨を明記）。
- **接続設定**: `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（`.env.local`）を優先し、未設定時は本番用の既定値にフォールバックする（Vercel側で環境変数が未設定でもビルドが壊れないための保険）。publishableキーはクライアントに公開される前提の設計で、実際の保護はRLSに依存する。
- **テーブル**: `expenses` / `categories` / `budgets` / `recurring_expenses`（いずれも`user_id`列を持ち、RLSで`auth.uid() = user_id`に制限）。
- **マイグレーション**: `supabase/migrations/`にRLSポリシー・スキーマ変更をSQLとして保存（Supabase SQL Editorで手動実行、CLIでのマイグレーション適用はしていない）。

---

## ユーティリティ関数（`src/utils/date.ts`）

| 関数 | 説明 |
|------|------|
| `toYearMonth(date)` | Date → `YYYY-MM` |
| `firstDayOfMonth(month)` | `YYYY-MM` → `YYYY-MM-01` |
| `formatDateWithDay(date)` | `YYYY-MM-DD` → `YYYY年M月D日(曜)` |
| `formatYearMonth(month)` | `YYYY-MM` → `YYYY年M月` |
| `formatTableMonth(month, currentYear)` | テーブル用短縮表示 |

---

## エラーハンドリング

- **画面全体のクラッシュ防止**: `src/components/ErrorBoundary.tsx`が`<App />`全体をラップし、レンダリング時例外による白画面化を防ぐ。
- **クラウド書き込み失敗時**: 各ストア（expense/category/budget/recurring）は楽観的更新後にSupabaseへ書き込み、失敗時はローカルをロールバックしつつ`showToast`でユーザーに通知、`console.error`でログ出力する（外部監視サービスは未導入）。
- **バックアップ復元**: クラウド書き込みが失敗した場合はローカルへの反映も行わず、クラウド・ローカルの不整合を避ける（詳細は「データ永続化」章）。

---

## テスト

`src/utils/`配下の副作用のない純粋関数を対象に、Vitestでユニットテストを実施（コンポーネント/ストアのテストは未導入）。

| テストファイル | 対象 |
|---------------|------|
| `date.test.ts` | 年またぎの月加減算、曜日付き日付表示など |
| `format.test.ts` | `formatWan`の1万円境界・小数丸め |
| `recurringGenerator.test.ts` | `isRecurringDue`/`targetDayOf`（発生日判定・月末調整） |
| `passcode.test.ts` | `hashPin`の決定性（同一pin/saltで同一ハッシュ、salt違いで異なるハッシュ） |
| `csv.test.ts` | `escapeCell`のCSVインジェクション対策、`expenseDetailRows`の整形 |
| `backup.test.ts` | `parseBackup`/`buildBackup`（v1・v2の受理、不正JSON・型不正・範囲外値の拒否、v2のID振り直しとアイコン変換、書き出し→読み戻しの往復） |

`npm test`（`vitest run`）で実行。CI（`.github/workflows/kakeiboweb-ci.yml`）にも組み込み済み。

---

## UI デザイン原則

- **モバイルファースト**: 最大幅 `max-w-lg`、下部ナビゲーション固定
- **ダークモード**: システム設定に自動追従（Tailwind `dark:` クラス使用）
- **カラースキーム**: インジゴ（#4F46E5）をプライマリ、カテゴリ別のカスタムカラーを各所で使用
- **タイポグラフィ**: `tabular-nums` で金額を等幅表示、`tracking-tight` で見出し
- **インタラクション**: `active:scale-95` によるタップフィードバック、`transition-colors` によるホバー遷移
- **FAB**: 右下固定（`bottom-20 right-4`）、支出追加への導線
- **ボトムシート**: 詳細・電卓表示に使用（`fixed inset-0 z-50 flex flex-col justify-end`）
