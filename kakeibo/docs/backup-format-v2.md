# バックアップ形式 v2（kakeibo ⇔ kakeiboWeb 共通）

アプリ版（Flutter / `kakeibo`）と Web 版（React / `kakeiboWeb`）で、
支出・カテゴリ・予算・定期支出のすべてを相互に移行するための共通形式。

- 書き出し: 両アプリとも **v2 で書き出す**
- 読み込み: 両アプリとも **v2 と自分の v1 を読める**（相手側の v1 は読めないので、その旨を案内して拒否する）
- 取り込みは **全置き換え**。既存データをすべて消してファイルの内容に入れ替える
- 1件でも不正な行があればファイル全体を拒否する（部分復元による不整合を防ぐため）

実装:

| | アプリ版（Flutter） | Web版 |
|---|---|---|
| 書き出し | `lib/data/backup/backup_serializer.dart` | `src/utils/backup.ts` の `buildBackup` |
| 読み込み | `lib/data/backup/backup_parser.dart` | `src/utils/backup.ts` の `parseBackup` |
| アイコン対応表 | `lib/data/backup/category_icon_map.dart` | `src/utils/categoryIcon.ts` |

## 構造

```jsonc
{
  "version": "2",
  "exportedAt": "2026-08-04T12:34:56.000Z", // ISO 8601
  "app": "kakeibo-flutter",                 // または "kakeibo-web"（参考情報。検証しない）
  "categories": [
    {
      "id": "1",                 // 必須・非空文字列
      "name": "食費",            // 必須・非空
      "color": "#FF9800",        // 必須・#RRGGBB
      "icon": "🍽️",              // 絵文字（Web版が使う）
      "iconName": "restaurant",  // Material Icons 名（アプリ版が使う）
      "sortOrder": 0,            // 任意・整数（表示順）
      "createdAt": "2026-08-04T09:00:00.000" // 任意・ISO 8601
    }
  ],
  "expenses": [
    {
      "id": "10",                // 必須・非空文字列
      "amount": 1200,            // 必須・0〜10億
      "categoryId": "1",         // 必須・categories[].id を参照
      "itemName": "ランチ",      // 任意（空文字は「無し」扱い）
      "note": "メモ",            // 任意（アプリ版のメモ欄。空文字は「無し」扱い）
      "date": "2026-08-04",      // 必須・YYYY-MM-DD
      "createdAt": "2026-08-04T09:00:00.000", // 必須・ISO 8601
      "updatedAt": "..."         // 任意（Web版のみ保持）
    }
  ],
  "budgets": [
    { "month": "2026-08", "amount": 50000 } // month は YYYY-MM
  ],
  "recurring": [
    {
      "id": "5",
      "name": "家賃",
      "amount": 80000,
      "categoryId": "1",
      "dayOfMonth": 27,               // 1〜31
      "isActive": true,               // 任意・既定 true（アプリ版のみ保持）
      "lastGeneratedMonth": "2026-07" // 任意・YYYY-MM。最後に自動登録した月（両アプリが保持）
    }
  ]
}
```

`icon` と `iconName` は**どちらか一方があればよい**。無い側は対応表から変換し、
対応表に無ければ `📦` / `inventory_2` にフォールバックする。

## ID の扱い

ID の型は両アプリで異なる（Web版 = UUID 文字列 / アプリ版 = Isar の整数）。
そこで v2 では **ID を「ファイル内でのみ有効な参照キー（文字列）」と定義**し、
取り込む側が自分の ID 体系へ振り直したうえで `categoryId` の参照を付け替える。

- **アプリ版へ取り込むとき**: 整数として読める ID（`"1"` など）はその値を維持し、
  UUID には空いている番号を採番する。参照先カテゴリが見つからない支出は
  `categoryId = 0`（画面上は「不明」）として取り込み、行そのものは捨てない
- **Web版へ取り込むとき**: 支出・定期支出の ID は UUID でなければ採番し直す
  （Supabase 側の列が uuid 型でも通るようにするため）。カテゴリ ID は既定カテゴリが
  `'1'`〜`'16'` で運用されている＝テキスト型と分かっているのでそのまま使う

## 変換で失われるもの

| 項目 | 挙動 |
|---|---|
| 支出の時刻 | `date` は日付のみ。アプリ版の `DateTime` は 0 時に丸められる |
| `updatedAt` | アプリ版は保持しない。アプリ版→Web版の往復で消える |
| `isActive: false` の定期支出 | Web版は「無効」の概念が無いため**取り込まない**（Web版からの書き出しは常に `true`） |
| カテゴリの色・アイコン | 定義済みの一覧外の値でも `#RRGGBB` は保たれる。アイコンは対応表に無い場合のみフォールバックする |

## 定期支出の二重登録を防ぐ

アプリ版は起動時に `autoRegisterForCurrentMonth()` で当月分の定期支出を登録し、
重複を `lastRegisteredYear/Month` だけで防いでいる。この値がバックアップに載っていないと、
**復元した直後の起動で当月分がもう一度登録されて支出が二重になる**。
そのため v2 では `lastGeneratedMonth`（Web版と同じ意味）として書き出し・取り込みの両方で扱う。

## 移行のしかた

**Web版 → アプリ版**: Web版の設定 →「バックアップ」で JSON をダウンロード →
アプリ版の設定 →「復元」→「ファイルを選ぶ…」でその JSON を選ぶ。

**アプリ版 → Web版**: アプリ版の設定 →「バックアップ」→ 共有シートで JSON を端末外へ出す
（Windows 版は Documents に保存される）→ Web版の設定 →「復元」でその JSON を選ぶ。
