# Repository仕様（内部API）

`domain/repository/` の 3 つのインターフェース。`ui` と `domain` はこれだけに依存し、DAO や DataStore を直接触らない。

共通の約束:

- 時刻はすべて epoch millis（`Long`）。移植性のため `java.time` の型を境界に出さない
- `Flow` を返すものは購読中の変更を自動で流す。`suspend` のものは 1 回きり
- 時刻の採番は実装側が `TimeProvider` から行う。呼び出し側は時刻を渡さない
- 検索語の整形（トリム・LIKE エスケープ）は実装側が行う。呼び出し側は生の入力を渡してよい
- 存在しない ID を渡しても例外を投げない。黙って何もしない

## MemoRepository

実装: `MemoRepositoryImpl`（Room）

### 購読

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `observeMemos(filter: MemoFilter)` | `Flow<List<Memo>>` | 条件に一致するメモ。**ゴミ箱は含まない**。検索語はトリムとエスケープを実装側で行う |
| `observeMemo(id: Long)` | `Flow<Memo?>` | 単一メモ。存在しなければ `null` を流す |
| `observeTrash()` | `Flow<List<Memo>>` | ゴミ箱の中身を削除の新しい順で |

`observeMemos` の並び順は常に **ピン留めが最優先**で、その中で `MemoFilter.sortOrder` に従う。ピン留めは並び替えの指定より強い。

### 取得

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `findById(id: Long)` | `Memo?` | 存在しなければ `null`。ゴミ箱の中も返す |
| `findAllForExport()` | `List<Memo>` | バックアップ用。**ゴミ箱も含めた全件**を id 順で |

### 更新

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `create(title: String, content: String)` | `Long` | 採番された ID。`createdAt`/`updatedAt` に現在時刻を入れる |
| `updateContent(id, title, content)` | — | `updatedAt` を現在時刻へ進める。`createdAt` とピン留め等は保持 |
| `setPinned(id: Long, pinned: Boolean)` | — | |
| `setFavorite(id: Long, favorite: Boolean)` | — | |

`create` は空文字のタイトル・本文を拒否しない。「空なら作らない」の判断は `SaveMemoUseCase` が持つ。

### 削除

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `moveToTrash(id: Long)` | — | `deletedAt` に現在時刻を入れる（論理削除） |
| `restore(id: Long)` | — | `deletedAt` を消し、`updatedAt` を現在時刻へ進める |
| `deletePermanently(id: Long)` | — | 物理削除。**復元不可**。タグとの関連は CASCADE で消え、タグ自体は残る |
| `purgeTrashOlderThan(threshold: Long)` | `Int` | `threshold` より前に削除された行を物理削除し、件数を返す |

`purgeTrashOlderThan` は境界時刻を受け取るだけで、保持期間そのものは知らない。30 日という判断は `TrashPolicy`（domain）が持つ。ゴミ箱に入っていないメモは対象にならない。

## TagRepository

実装: `TagRepositoryImpl`（Room）

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `observeAll()` | `Flow<List<Tag>>` | 名前の昇順（大文字小文字を区別しない） |
| `search(query: String)` | `Flow<List<Tag>>` | 名前の部分一致。トリムとエスケープは実装側で行う |
| `observeMemoCount(tagId: Long)` | `Flow<Int>` | 付与件数。**ゴミ箱のメモは数えない** |
| `create(name: String)` | `Long` | 名前をトリムして作成。**同名が既にあれば既存の ID を返す**（重複を作らない） |
| `rename(id: Long, name: String)` | — | 名前をトリムして変更。`createdAt` は保持。存在しない ID は無視 |
| `delete(id: Long)` | — | タグを削除。メモとの関連は CASCADE で消え、メモ自体は残る。存在しない ID は無視 |
| `setTagsOfMemo(memoId, tagIds)` | — | メモのタグを指定内容へ**置き換える**。空リストなら全て外す |

`create` は名前の長さを検証しない。50 文字の上限は `SaveTagUseCase` が `TagPolicy` に従って課す。**編集画面からタグを作る経路も必ず `SaveTagUseCase` を通す**こと。ここを迂回すると片方の画面だけ上限が効かなくなる。

## SettingsRepository

実装: `SettingsRepositoryImpl`（DataStore）

| メンバ | 型 | 説明 |
|---|---|---|
| `settings` | `Flow<AppSettings>` | 変更を流す。読めない値は既定値へ落とす |
| `setThemeMode(mode)` | `suspend` | |
| `setFontSize(size)` | `suspend` | |
| `setListStyle(style)` | `suspend` | |
| `setSortOrder(order)` | `suspend` | |

列挙値は**名前**で保存する（`"DARK"` など）。旧バージョンの値や破損に当たっても例外を投げず既定値へ落とす。設定ひとつのために起動不能になる方が損害が大きいため。読み出しの `IOException` も同様に既定値で継続する。

既定値: テーマ=`SYSTEM`、文字サイズ=`MEDIUM`、表示形式=`LIST`、並び順=`UPDATED_DESC`。

## スレッド

Room の suspend クエリと Flow は自前の executor で IO スレッドへ切り替わるため、DAO 呼び出し自体を `withContext` で包む必要はない。

一方、**エンティティからドメインモデルへの変換は購読側のコンテキストで走る**ため、10,000 件規模ではメインスレッドを塞ぎうる。変換を含む箇所は `flowOn(ioDispatcher)` で明示的に IO へ逃がしている。`findAllForExport` は全件変換のため `withContext(ioDispatcher)` で包む。

## 関連ドキュメント

- [アーキテクチャ](architecture.md)
- [DB設計](database.md)
- [テスト仕様](testing.md)
