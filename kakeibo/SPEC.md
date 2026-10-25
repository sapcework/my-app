# kakeibo 仕様書

Flutter 製の支出管理（家計簿）アプリ。ローカルDB（Isar）にデータを保存し、オフラインで完結する。
Web版（kakeiboWeb）とデザイン・タブ構成・主要機能を揃えている。

- 最終更新: 2026-10-25
- バージョン: 1.3.0+4（更新履歴は「家計簿について」画面の `changelog` に記載）

---

## 1. 技術スタック

| 項目 | 採用技術 |
|------|---------|
| フレームワーク | Flutter（Dart SDK >=3.3.0）/ Material 3 |
| 状態管理 | flutter_riverpod ^2.5.1 |
| ルーティング | go_router ^14.2.7 |
| ローカルDB | isar ^3.1.0+1（isar_flutter_libs） |
| モデル生成 | freezed ^2.5.2 / json_serializable |
| グラフ | fl_chart ^0.68.0 |
| 日付・数値整形 | intl ^0.20.2（flutter_localizations の固定に合わせる） |
| 日本語表示 | flutter_localizations（ロケール ja_JP 固定。標準のダイアログ・コピー貼り付けのメニュー・ライセンス画面が日本語になる） |
| ファイルパス取得 | path_provider ^2.1.3 |
| ハッシュ | crypto ^3.0.3（パスコードのPBKDF2-SHA256） |
| ファイル共有 | share_plus ^13.3.0（モバイルのエクスポート） |
| アーキテクチャ | Clean Architecture（Presentation / Domain / Data） |

### テーマ

- シードカラー: Indigo `#5C6BC0`（Web版と統一）
- ライト・ダーク両テーマ対応（`app_theme.dart`、システム設定に追従）
- **画面幅の中央寄せ**（`app.dart` の `MaterialApp.router(builder: ...)`）: Web版はモバイルファースト（`max-w-lg`=512px）で、広いウィンドウでは中央寄せになる。kakeibo も全画面を最大幅512pxに制限して中央寄せにし、Windowsデスクトップの広いウィンドウでもWeb版と同じ見た目になるようにしている（スマホ・狭いウィンドウでは実質無効）

---

## 2. 画面構成・ルーティング

### BottomNavigationBar（ShellRoute 共有・6タブ）

| Index | パス | 画面 | ファイル |
|-------|------|------|---------|
| 0 | `/` | ホーム | `home_screen.dart` |
| 1 | `/expenses` | 支出一覧 | `expense_list_screen.dart` |
| 2 | `/table` | 月別支出表 | `expense_table_screen.dart` |
| 3 | `/search` | 検索 | `search_screen.dart` |
| 4 | `/stats` | 統計 | `stats_screen.dart` |
| 5 | `/settings` | 設定 | `settings_screen.dart` |

- **戻るボタン**: タブは `context.go` で切り替えるため履歴が残らない。`_AppShell` の `PopScope` で、ホーム以外のタブではホームへ戻し、ホームでだけアプリを終了する（Android。FastNote と同じ）
- **選択年月**: `selectedMonthProvider` を全画面（ホーム・支出・統計・予算）で共有する。起動時は今月で、どの画面で切り替えても他の画面に引き継がれる（Web版と同じ。2026-10-25 にこの方針で確定）

### モーダル系ルート（BottomNavなし）

| パス | 画面 |
|------|------|
| `/expenses/add` | 支出登録フォーム |
| `/expenses/:id/edit` | 支出編集フォーム |
| `/categories` | カテゴリ管理 |
| `/budget` | 予算設定 |
| `/recurring` | 定期支出管理 |
| `/search/results` | 検索結果（戻ると検索条件に戻る） |
| `/about` | 家計簿について（バージョン・更新履歴・プライバシー・ライセンス） |
| `/calculator` | 電卓（`extra` で初期値を受け取る） |

このほか統計画面から `CategoryExpenseListScreen`（カテゴリ別明細）へ `Navigator.push` で遷移する。

---

## 3. データモデル（Domain Entities）

すべて Freezed の immutable クラス。Data 層に対応する Isar モデル（`*_model.dart`）があり、`build_runner` でスキーマ生成する。

### Expense（支出）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | int? | Isar採番。新規作成時は null |
| amount | double | 金額 |
| categoryId | int | カテゴリID（外部キー相当） |
| itemName | String? | 項目名（任意） |
| memo | String? | メモ（任意） |
| date | DateTime | 支出日 |
| createdAt | DateTime | レコード作成日時 |

### Category（カテゴリ）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | int? | Isar採番 |
| name | String | カテゴリ名 |
| colorValue | int | 表示色（Color.value） |
| iconName | String | Material Icons のフィールド名（例: `restaurant`） |
| sortOrder | int | 一覧表示順（デフォルト 0） |
| createdAt | DateTime | 作成日時 |

### Budget（月次予算）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | int? | Isar採番 |
| year / month | int | 対象年月 |
| amount | double | 月次予算金額 |

### RecurringExpense（定期支出）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | int? | Isar採番 |
| name | String | 支出名（登録時にメモへ自動入力） |
| amount | double | 金額 |
| categoryId | int | カテゴリID |
| dayOfMonth | int | 毎月の登録日（1〜31） |
| isActive | bool | 有効フラグ（デフォルト true） |

---

## 4. 機能仕様

### 4.1 起動時初期化（`app_init_provider.dart`）

1. Isar を開く（`ExpenseModel` / `CategoryModel` / `BudgetModel` / `RecurringExpenseModel` の4スキーマ）
2. デフォルトカテゴリの投入（カテゴリが1件でもあればスキップ＝冪等）
3. 定期支出の今月分を自動登録

### 4.2 デフォルトカテゴリ（初回起動時に16件投入・Web版と同一）

| 名前 | 色 | アイコン |
|------|-----|---------|
| 食費 | `#FF9800` | restaurant |
| 外食 | `#FF5722` | ramen_dining |
| 住居 | `#009688` | home |
| 光熱費 | `#FFC107` | lightbulb |
| 通信費 | `#03A9F4` | smartphone |
| 交通費 | `#2196F3` | directions_car |
| 日用品 | `#4CAF50` | shopping_cart |
| 衣服・美容 | `#E91E63` | checkroom |
| 医療 | `#F44336` | local_hospital |
| 保険 | `#607D8B` | shield |
| 教育 | `#3F51B5` | menu_book |
| サブスク | `#9C27B0` | credit_card |
| 娯楽 | `#8BC34A` | sports_esports |
| 旅行 | `#00BCD4` | flight |
| 貯蓄・投資 | `#795548` | savings |
| その他 | `#9E9E9E` | inventory_2 |

※ 既存カテゴリが1件でもあれば投入しない（冪等）。既存インストールには影響しない。

### 4.3 ホーム画面

- AppBarタイトルは「家計簿」（アプリ名。Web版のH1見出しと同じ。他画面は「ホーム」ではなく画面名を表示）
- 選択月は他画面と共有の `selectedMonthProvider`。AppBar右側（タイトルと同じ行）の `MonthSwitcherBar` で任意の月に切り替えられる（Web版と同じ。以前は常に実際の「今月」固定だったが月切り替え対応に修正）
- 選択月の支出をリアルタイム監視（StreamProvider）して月間サマリーカードに表示
- サマリーカード（`monthly_summary_card.dart`）: グラデーション上部バー、予算進捗バー、予算バッジ（超過→rose / 残り→emerald）
- 合計金額は `formatYen()`（`core/utils/format.dart`）でカンマ区切りの全桁を出す。入りきらない桁数では `FittedBox` で文字を縮める（2026-10-25 に「¥1.7万」と丸める省略表示をやめた。**Web版とは異なる**）
- **前月比表示**: 選択月の前月に支出がある場合のみ「前月±¥n」を件数の横に表示（増加は赤・減少は緑）

### 4.4 支出の登録・編集（`expense_form_screen.dart`）

- 金額・カテゴリ・項目名・メモ・日付を入力
- **カテゴリは4列グリッドで選択**（Web版と同じUI。選択中はカテゴリカラーでハイライト）
- 項目名は入力欄の下にサジェストを重ねて表示（Web版と同じ）。**選択中カテゴリで使った項目名だけ**を
  使用回数の多い順に出し、打った文字で絞り込む（`getUniqueItemNames(categoryId:)`）。
  カテゴリを選び直すと候補も切り替わる
- 電卓画面（`/calculator`）と連携して金額を計算入力できる
- 新規登録時、今月以外の月を選択中なら初期日付をその月の1日に設定
- **編集対象が存在しない場合**（削除済み・不正ID）はnot-found画面を表示し、支出一覧への導線を出す
- **削除時のUndo**: 削除後にスナックバーで「元に戻す」を5秒間表示。IDを保持したまま復元する

### 4.5 支出一覧（`expense_list_screen.dart`）

- 月単位表示。`MonthSwitcherBar` で前月/翌月切り替え
- 月名タップで「登録済み年月一覧」の BottomSheet を表示し、任意の月へ即ジャンプ（現在選択月にチェックマーク）。年月リストは `ExpenseRepository.getAvailableMonths()`（降順）で取得
- 日付グループ表示: 日付帯ヘッダー（yyyy/MM/dd(曜日) ＋ 日計）ごとにまとめて表示
- 検索キーワード・カテゴリによるフィルター（`expenseSearchQueryProvider` / `expenseCategoryFilterProvider`）
- タイル表示（`expense_list_tile.dart`）: カテゴリ名をカテゴリカラーの太字で先頭行、項目名（項目名→メモ→カテゴリ名の優先順）を2行目に表示
- **クイック削除**: 各タイルの削除アイコンをタップすると即削除し、スナックバーで「元に戻す」を5秒間表示（Web版と同じ。ホーム画面の「最近の支出」では非表示 = `showDeleteButton: false`）

### 4.6 統計画面（`stats_screen.dart`）

- 選択月のカテゴリ別支出を円グラフ（fl_chart）と内訳リストで表示
- 合計カード・ドーナツ中央のラベルも `formatYen()` で全桁。ドーナツの穴（直径104）に入りきらない桁数では文字を縮める
- ドーナツ中央ラベル: 通常時は「合計＋金額」、カテゴリをタップ中はそのカテゴリのアイコン・名前・金額を表示
- 円グラフ下に2列のカラー凡例（色ドット＋カテゴリ名＋割合）を表示。タップでカテゴリ明細へ遷移
- カテゴリ別リストは角丸カード＋シェブロン付き（`category_breakdown_tile.dart`）
- 円グラフのセクションをタップすると該当カテゴリの明細一覧（`CategoryExpenseListScreen`）へ遷移
- タップ判定は TapDown でインデックスを記録し TapUp で確定（`touchedSectionIndex` が `-1` を返すケースをガード済み）

### 4.7 月別支出表（`expense_table_screen.dart`）

- 縦軸: カテゴリ / 横軸: 月 の2次元スクロール表
- 表示範囲: **直近12ヶ月**（データがある月＋当月。Web版 TablePage と同じ範囲）
- 文字は14px（見出し13px）、列幅108px・分類列104px。Web版の11px・72pxではスマホで小さすぎたため大きくした。金額が列に入りきらないときは `FittedBox` で縮める
- 4つの ScrollController と NotificationListener で行・列ヘッダーを本体と同期スクロール
- データは `expenseTableDataProvider`（FutureProvider.autoDispose）で構築

### 4.7.1 検索（`search/search_screen.dart` / `search_result_screen.dart`）

- 全期間の支出を条件で絞り込む（選択年月とは無関係）。Web版には未実装
- 条件（`SearchCondition`、`domain/usecases/expense/search_expenses.dart`）
  - 日付: 開始日〜終了日（日単位。終了日はその日の終わりまで含む）。どちらか片方だけでもよい
  - 金額: 最低額〜最高額（その金額を含む）
  - 分類: `FilterChip` で選ぶ。初期値は全選択。**除外した分類を持つ**（`excludedCategoryIds`）ので、後から追加した分類も自動で対象に入る
  - 項目名・メモ: キーワード（スペース区切りで複数）＋方式。空欄なら絞り込まない。大文字・小文字と全角・半角の英数字・スペースは区別しない
    - 全て含む＝すべての語を含む / 一部含む＝どれか1語 / 一致＝入力全体と完全に同じ / 含まない＝どの語も含まない（空欄の支出も当てはまる）
  - 順序: 日付の古い順・新しい順（初期値）・金額の高い順・低い順。同じ値は登録日時順で安定させる
- 日付・金額の欄は縦に並べ、右に「から／まで」「円以上／円以下」を添える（横に2つ並べると幅の狭い端末で日付が折り返し、大きな金額がはみ出したため）。日付は曜日付き1行、金額は12桁まで
- 開始日＞終了日・最低額＞最高額・分類が1つも無い場合は「検索する」を押せず、理由を表示する
- 条件は `searchConditionProvider` に持つので、結果画面から戻っても・タブを移っても残る。「条件をクリア」で初期値に戻す
- 結果画面: 件数・合計・使っている条件の要約と、`ExpenseListTile`（クイック削除あり・タップで編集）の一覧。`searchResultsProvider` が全件の Stream に条件をかけるので、編集・削除がその場で反映される

### 4.8 予算管理（`budget_setting_screen.dart`）

- 選択月は他画面と共有の `selectedMonthProvider`。AppBar右側（タイトルと同じ行。Web版と同じ）の `MonthSwitcherBar` で月を切り替えると、その月の予算をフォームへ再読込する
- 金額入力は電卓画面（`/calculator`）と連携
- 保存してもページ遷移せず留まる（Web版と同じ挙動）。保存後はスナックバーで「YYYY年M月の予算を保存しました」と通知
- 予算設定済みの月には進捗カードを表示: 支出額・予算額・使用率プログレスバー（0〜79%: primary、80〜99%: amber、超過: red）・残り/超過バッジ
- ホームのサマリーカードにも同様の進捗バー・超過/残額バッジとして反映

### 4.9 定期支出（`recurring_expense_screen.dart`）

- 名前・金額・カテゴリ・毎月の登録日・有効/無効を管理（追加・編集は共通ダイアログ）
- 追加ボタンはAppBarヘッダー右上の「追加」ピルボタン（Web版・カテゴリ画面と同じ配置。以前はFAB）
- 各行は角丸カード＋カテゴリカラーのアイコン枠。1行目に色付きカテゴリ名、2行目に支出名、3行目に「毎月n日」を表示（`expense_list_tile.dart`と同じパターン。以前は汎用のリピートアイコンのみだった）
- 金額入力は電卓画面（`/calculator`）と連携
- 一覧上部に**月間合計バー**を表示（Web版と同じ）
- 空状態はリピートアイコン＋「定期支出がありません」を表示
- アプリ起動時に当月分を自動で支出登録。`lastRegisteredYear` / `lastRegisteredMonth`（Isarモデル側）で冪等管理し重複登録を防止

### 4.10 カテゴリ管理（`category_screen.dart`）

- カテゴリの追加・**編集**・削除（名前・色・アイコンを選択、`category_icons.dart` に候補定義）
- 追加ボタンはAppBarヘッダー右上の「追加」ピルボタン（Web版と同じ配置。以前はFAB）
- 各行は角丸カード＋カテゴリカラーで着色した名前＋編集(鉛筆)・削除(ゴミ箱)アイコンを表示（Web版と同じ見た目）
- **編集**: 行タップまたは鉛筆アイコンでダイアログに内容を読み込み「更新」で保存
- **削除時の警告**: 使用中の支出件数がある場合、確認ダイアログに件数と「削除後も支出データは残り、カテゴリ表示が『不明』になる」旨を表示
- 並び順は `sortOrder` で管理

### 4.11 電卓（`calculator_screen.dart`）

- 四則演算対応の電卓。初期値を受け取り、確定した値を支出フォームへ返す
- 小数点1個まで・12桁の入力制限、整数は小数部を省いて表示

### 4.12 設定画面（`settings_screen.dart`）

**データ管理**（バックアップ・CSV出力とも、書き出し前に対象ファイル名を表示する確認ダイアログを挟む。Web版と同じ）
- バックアップ: 全データ（支出・カテゴリ・予算・定期支出）を JSON で Documents に保存。ファイル名 `kakeibo_backup_yyyyMMdd_HHmmss.json`（復元時に一覧から選べるよう日時まで含める。Web版はブラウザダウンロードのため日付のみ）。形式は **Web版と共通の v2**（`data/backup/backup_serializer.dart`）で、そのまま Web版で復元できる
- 復元: **「ファイルを選ぶ…」（file_selector）または Documents 内のバックアップ一覧**から選択 → **全行を型検証**（`data/backup/backup_parser.dart`。金額が数値でない・日付形式不正・範囲外の値などが1件でもあればファイル全体を拒否し、何件目が不正かを表示）→ **確認ダイアログにファイル名と各データの件数を表示** → **復元の直前に今のデータを `kakeibo_backup_<日時>_before_restore.json` へ自動で書き出す**（書き出せなければ復元を中止。一覧に出るので、それを選べば元に戻せる）→ 1つのトランザクションで全テーブルをクリアして復元（途中で失敗しても元のまま）。**v2（Web版と共通）と v1（このアプリの旧形式）の両方を読める**。読むファイルは20MBまで
  - Android ではダウンロードフォルダ等をアプリから直接見られないため、Web版から持ってきた JSON は「ファイルを選ぶ…」で取り込む
  - 形式の詳細・ID の振り直し規則・変換で失われる項目は `docs/backup-format-v2.md` を参照
- 全明細CSV: 全期間の明細を `kakeibo_all_yyyy-MM-dd.csv` に出力（ヘッダー: 日付,カテゴリ,項目名,メモ,金額,登録日時）
- 月別支出表CSV: 表画面と同じカテゴリ×月のマトリクスを `kakeibo_monthly_yyyy-MM-dd.csv` に出力
- CSV は Excel 対応のため BOM 付き UTF-8

**書き出し後の受け渡し**（`core/utils/file_export.dart`）
- 保存先はどのプラットフォームでも `getApplicationDocumentsDirectory()`
- **Android / iOS**: 保存先がアプリ専用の非公開領域でファイルマネージャから見えないため、
  書き出し直後に共有シート（share_plus）を開いて任意のアプリへ渡せるようにする。
  共有をキャンセルしてもファイルは保存済みで、アプリ内の復元からは読める
- **デスクトップ**: `Documents` 直下に保存されそのまま開けるため、SnackBar に保存先パスを表示
- 統計画面の選択月CSV（`export_csv_usecase.dart`）も同じ扱い

**管理**
- カテゴリ（件数表示）→ `/categories`
- 予算設定 → `/budget`
- 定期支出（件数表示）→ `/recurring`

**セキュリティ**
- パスコードロック: 4桁PINでアプリ起動時にロック画面を表示（`passcode_lock_screen.dart` / `pin_pad.dart`）
  - ハッシュ化は PBKDF2-SHA256・20万回イテレーション（`core/utils/passcode_hash.dart`、isolateで実行）
  - 設定は `getApplicationSupportDirectory()/passcode.json` に保存（enabled / salt / hash / failedAttempts / lockedUntil）
  - **5回連続で間違えると一時ロック**し、カウントダウンを表示。待ち時間はロックされるたびに 30秒→1分→5分→15分→30分（以後30分）と延び、解錠に成功すると最初に戻る（FastNote と同じ。4桁PINの総当たり対策）
  - **アプリを1分以上裏に回して戻ると再ロック**（`AppLifecycleListener` の onHide/onShow）。起動直後のロックは専用の MaterialApp、使っている途中の再ロックは `/lock` ルートを上に重ねるので、入力途中のフォームなどは消えない。`/lock` では戻るボタンでロックを外せない（アプリを閉じる）
  - パスコードはのぞき見防止で、DB自体は暗号化していない（Windows では Documents の DB ファイルを直接読める）
  - 設定画面から有効化（新PINを2回入力）・解除（現PINを検証）

**このアプリについて**
- 「家計簿について」（`about_screen.dart`）へ進む1行。行にはバージョンを表示（`package_info_plus` で実際の版を取得）
- 「家計簿について」画面は FastNote と同じ構成: アイコン・バージョン・説明 / プライバシー / データ件数・保存場所 / 更新履歴 / オープンソースライセンス・開発者・パッケージ名（Androidのみ）
- 版を上げたら `pubspec.yaml` の `version` と `about_screen.dart` の `changelog` を両方更新する

---

## 5. ディレクトリ構成

```
lib/
  main.dart / app.dart（パスコード有効時は解錠までロック画面を表示）
  core/
    constants/      app_strings.dart, category_icons.dart
    theme/          app_theme.dart
    utils/          passcode_hash.dart（PBKDF2-SHA256）, format.dart（formatYen）,
                    file_export.dart（書き出し後の共有シート／パス表示の出し分け）
  domain/
    entities/       expense.dart, category.dart, budget.dart, recurring_expense.dart
    repositories/   expense_repository.dart, category_repository.dart,
                    budget_repository.dart, recurring_expense_repository.dart
    usecases/       expense/（add, update, delete, get, get_monthly, export_csv）
                    category/（get, add, update, delete）
                    budget/（get, set）
                    recurring/（get, add, update, delete）
  data/
    backup/         backup_parser.dart（バックアップJSONの型検証・v1/v2読み込み）,
                    backup_serializer.dart（v2書き出し）,
                    category_icon_map.dart（絵文字⇔Material Icons名・色⇔#RRGGBB）
    models/         expense_model.dart, category_model.dart,
                    budget_model.dart, recurring_expense_model.dart（Isarコレクション）
    repositories/   各リポジトリ実装（*_repository_impl.dart）
  presentation/
    providers/      isar_provider, app_init_provider, repository_providers,
                    expense_providers, category_providers, budget_providers,
                    recurring_expense_providers, expense_table_provider,
                    passcode_provider, search_providers
    router/         app_router.dart
    widgets/        month_switcher_bar.dart, pin_pad.dart
    screens/        home/ expense/ search/ stats/ table/ budget/ recurring/ settings/
                    category/ calculator/ lock/
```

---

## 6. 実装メモ

### 日本語カレンダー（`widgets/japanese_date_picker.dart` / `core/utils/japanese_holidays.dart`）
- 支出の登録・編集と検索の日付は `showJapaneseDatePicker` で選ぶ（標準の `showDatePicker` は日ごとの色分けができないため自前）
- 日曜始まり。**日曜・祝日・振替休日・国民の休日は赤**（祝日は太字）、**土曜は青**、今日は枠、選んだ日は塗りつぶし
- 上部に選んだ日と祝日名、下部に表示中の月の祝日一覧。月名タップで年・月の一覧、左右になぞっても月を切り替えられる。「今日」ボタンあり
- 祝日は通信せずに計算する（2000年以降の祝日法。春分・秋分は2099年まで有効な近似式。2019年の即位関連と2020・2021年の五輪特例を反映）。**将来の法改正には追従できない**ので、変わったら `_compute` を直す
- テストは `test/japanese_holidays_test.dart`（2024〜2026年の全祝日などと照合）と `integration_test/date_picker_test.dart`

- **Isar 初期化**: `Isar.open([ExpenseModelSchema, CategoryModelSchema, BudgetModelSchema, RecurringExpenseModelSchema])`。DBパスは `path_provider` で取得
- **ファイル保存先**: `getApplicationDocumentsDirectory()`（Windows では `C:\Users\<user>\Documents\`。
  Android では `/data/data/com.sapcework.kakeibo/app_flutter/` というアプリ専用の非公開領域になり、
  ファイルマネージャから見えないため書き出し後に共有シートを開く。詳細は `docs/android-setup.md`）
- **fl_chart の注意**: `touchedSectionIndex` が `-1` を返すことがあるため `>= 0` ガードが必要
- **DropdownButtonFormField.value の deprecated 警告**: 支出フォームはグリッド選択化で解消。add_recurring_expense_dialog.dart は `// ignore: deprecated_member_use` で抑制中
- **パスコードのハッシュ計算**: 20万回イテレーションは重いため `compute()`（isolate）で実行し、UIのジャンクを防ぐ
- **コード生成**: モデル変更時は `dart run build_runner build --delete-conflicting-outputs` を実行

---

## 7. Web版とのUI比較テスト（`integration_test/` + `ui-compare/`）

kakeiboWeb（React）と見た目・挙動を突き合わせるためのスクリーンショット自動取得の仕組み。
Playwrightはブラウザ専用でネイティブWindowsアプリを操作できないため、kakeibo側はFlutterの
`integration_test` で実際に画面遷移させ、その瞬間をPowerShellでウィンドウキャプチャする方式にしている。

| | Web側 | kakeibo側 |
|---|---|---|
| ツール | Playwright（`ui-compare/`に配置、kakeibo/kakeiboWeb本体には影響しない） | `flutter test integration_test` + PowerShell |
| ナビゲーション | URLへ直接 `page.goto()` | `tester.tap()` でウィジェットをタップして画面遷移 |
| キャプチャ | `page.screenshot()` | `tool/capture_window.ps1`（ウィンドウの実ピクセルをキャプチャ） |
| 出力先 | `ui-compare/screenshots/web/*.png` | `ui-compare/screenshots/app/*.png` |

**実行手順**
1. （初回のみ）`cd ui-compare && npm install && npx playwright install chromium`
2. （初回のみ）`npm run login` → 開いたブラウザで手動ログイン → `auth.json` にセッション保存（Gitには含めない）
3. `npm run shots`（Web側スクリーンショット取得）
4. kakeibo側で `flutter test integration_test/screenshot_test.dart -d windows`（画面遷移しながらキャプチャ）
5. `ui-compare/screenshots/web/*.png` と `screenshots/app/*.png` の同名ファイルを見比べる

`tool/capture_window.ps1` はプロセス名 `kakeibo` の可視ウィンドウを前面化してから画面キャプチャする。
複数の `kakeibo.exe` が起動していると意図しない方を掴むことがあるため、実行前に他のインスタンスを終了しておく
（`flutter run` の停止はCLIプロセスのみを止め、起動済みウィンドウ自体は残ることがある点に注意）。

---

## 8. Android ビルド

| 項目 | 値 |
|---|---|
| applicationId | `com.sapcework.kakeibo` |
| アプリ表示名 | 家計簿 |
| minSdk / targetSdk | 24（Android 7.0）/ 36 |
| 対応 ABI | arm64-v8a / armeabi-v7a / x86_64 |
| リリース署名 | `android/key.properties` があれば使用、無ければデバッグ署名にフォールバック |

セットアップと配布の全手順は `docs/android-setup.md` を参照。

### アイコン
- 原本は `icon/*.svg`（背景・前景・単色・旧形式）。白を基調に、薄い黄緑の家計簿ノートと ¥ の金貨
- `flutter test icon/render_icons_test.dart` で Android の mipmap（アダプティブアイコン＋Android 13 のテーマアイコン）・Windows の `app_icon.ico`・アプリ内の `assets/icon/app_icon.png`（512px）をまとめて作る。切り抜きを再現したプレビューが `build/icon_preview/` に出る

### Isar 3.1.0 に対する回避策（`android/build.gradle.kts`）

Isar 3.1.0 は 2023 年以降メンテされておらず、そのままでは Android ビルドが通らない。
root の `subprojects` ブロックで次の2点を補っている。

1. AGP 8 以降で必須の `namespace` を宣言していない → プラグインの `group` から補完
2. `compileSdk 30` 固定で、依存する androidx（fragment 1.7.1 等）が要求する 34+ を満たさない → 36 に引き上げ

**このブロックは `evaluationDependsOn(":app")` より前に置くこと。**
後ろだと `Cannot run Project.afterEvaluate(Action) when the project is already evaluated` で落ちる。

また Windows では Kotlin のインクリメンタルコンパイルのキャッシュを閉じられずビルドが落ちるため、
`android/gradle.properties` に `kotlin.incremental=false` を設定している。

長期的にはメンテされている fork（isar_community 等）への移行を検討する価値がある。

---

## 8.5 セキュリティ・エラー処理の方針（2026-10-25 の総合レビューで整理）

- 通信しない（INTERNET 権限なし）。サーバー・認証・Cookie が無いので XSS / CSRF / SQLi / SSRF / JWT などは対象外。Isar は型付きクエリで文字列からクエリを組み立てない
- Android の自動バックアップ・端末間転送から除外（`allowBackup="false"` と `res/xml/data_extraction_rules.xml`）。機種変更は「バックアップ」で書き出したファイルで移す
- CSV は `escapeCsvCell`（`export_csv_usecase.dart`）1つで書き出す。カンマ・引用符・改行（\n と \r）を引用符で囲み、`= + - @ タブ CR` で始まる値は先頭に `'` を付けて Excel の数式実行を防ぐ（CSV インジェクション対策）
- エラーは、画面に「次にすること」が分かる文だけを出し、内部の例外は `debugPrint` で開発用ログに出す。起動に失敗したときは `StartupErrorScreen`（もう一度試す）
- 支出の保存は成功時に「追加しました／更新しました」、失敗時は入力を残したまま理由を表示
- アイコンだけのボタンには `tooltip` を付ける（TalkBack の読み上げ名になる）
- 予算の超過／残り・前月比の色は `core/theme/status_colors.dart` を使う（ダークモード対応。色を直書きしない）
- CI: `.github/workflows/kakeibo-ci.yml`（`flutter analyze` と `flutter test`）。`integration_test/` は Windows 実機で手元実行

## 9. 今後の候補

1. Android 実機での動作確認（USBデバッグ → `flutter install`。共有シートの実挙動確認が主目的）
2. 定期支出フォームのカテゴリ選択もグリッド化（deprecated警告の完全解消）
3. グラフ強化（月別推移など）
4. 通知（定期支出の登録通知等）
5. ダークモードの手動トグル（Web版は light/system/dark の3択トグルUIあり。kakeiboは`ThemeMode.system`固定）
