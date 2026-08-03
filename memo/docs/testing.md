# テスト仕様

**286件・カバレッジ 91.9%（LINE）。全て `./gradlew test` のみで完結し、実機もエミュレータも要らない。**

```bash
./gradlew test          # 全テスト
./gradlew check         # テスト + ktlint + detekt + カバレッジ下限
./gradlew koverHtmlReportDebug   # カバレッジのHTMLレポート
```

## 方針

Compose UI テストを含め、すべて Robolectric 上の JVM で動かす。開発環境がメモリ 8GB のため、テストのたびにエミュレータを起動する構成は現実的でないと判断した。セマンティクス（表示テキスト・押せるか・状態の反映）はこれで検証できる。実機の描画そのもの（レイアウト崩れ等）は対象外で、そこは実機での目視確認に委ねる。

| 層 | 件数 | 対象の差し替え方 | 理由 |
|---|---|---|---|
| DAO | 49 | 実DB（インメモリ Room） | SQL の正しさは実際に走らせないと分からない |
| Repository | 49 | 実DB / 一時ファイル上の実 DataStore | 同上。Mapper 変換も通しで見る |
| UseCase | 34 | Mockito で Repository をモック | 分岐と異常系を狙って組める。純JVMで高速 |
| ViewModel | 66 | Mockito + `MainDispatcherRule` | 仮想時間でデバウンス境界を固定できる |
| Compose UI | 75 | Robolectric + モック ViewModel | 利用者が触れる導線を検証 |
| util | 13 | なし（純ロジック） | |

## クラス別の件数

| クラス | 件数 | 主な検証内容 |
|---|---|---|
| `MemoDaoTest` | 14 | 登録・更新・ゴミ箱・CASCADE・パージ・エクスポート |
| `MemoDaoQueryTest` | 17 | 検索・タグ絞り込み・並び替え4種・LIKEエスケープ |
| `TagDaoTest` | 18 | タグCRUD・`insertOrGet`・関連の付け外し・付与件数 |
| `MemoRepositoryImplTest` | 19 | 検索語の整形・並び順の変換・時刻注入・ドメイン変換 |
| `TagRepositoryImplTest` | 19 | 名前のトリム・同名の重複防止・存在しないidの黙殺 |
| `SettingsRepositoryImplTest` | 11 | 既定値・保存形式・**壊れた値からの復旧** |
| `SaveMemoUseCaseTest` | 7 | 新規/更新の分岐 |
| `DeleteMemoUseCaseTest` | 4 | ゴミ箱→完全削除の2段階 |
| `SaveTagUseCaseTest` | 11 | 名前の検証・正規化 |
| `SetMemoTagsUseCaseTest` | 8 | 名前解決・重複排除 |
| `PurgeExpiredTrashUseCaseTest` | 4 | 保持期間30日 |
| `MemoListViewModelTest` | 17 | 検索条件の合成・デバウンス・設定の永続化 |
| `MemoEditViewModelTest` | 21 | 自動保存・ID確定・Undo/Redo・タグ追加 |
| `TagViewModelTest` | 15 | 一覧・検証エラーの変換・ダイアログ開閉 |
| `TrashViewModelTest` | 7 | ゴミ箱表示・復元/完全削除の委譲 |
| `SettingsViewModelTest` | 6 | 設定の購読と保存 |
| `MemoListScreenTest` | 11 | 読み込み中/空/検索0件の出し分け・条件クリア |
| `MemoEditScreenTest` | 17 | 自動保存の画面反映・タグ追加・削除通知 |
| `TagScreenTest` | 14 | 一覧・作成/改名・**削除の確認フロー** |
| `TrashScreenTest` | 13 | **取り消せない操作の確認フロー** |
| `SettingsScreenTest` | 9 | 選択状態・保存 |
| `MemoCardTest` | 8 | **読み上げ内容**・クリック |
| `EmptyStateTest` | 3 | メッセージと補足 |
| `EditHistoryTest` | 13 | Undo/Redo の規則 |

## 特に守っている性質

**取り消せない操作は確認を挟む**（`TrashScreenTest` / `TagScreenTest`）。完全削除もゴミ箱を空にするも、「確認前は実行しない」「キャンセルで実行しない」「承認で実行する」の3点をそれぞれ検証する。一方、復元は取り消せるので確認を挟まない。この非対称性も明示的にテストに書いてある。

**カードの読み上げは1つにまとめる**（`MemoCardTest`）。`clearAndSetSemantics` で内部テキストを個別に読ませない設計のため、「内部のテキストが個別に読み上げられないこと」まで固定している。これを外すと読み上げが細切れになり、一覧を追う操作が著しく遅くなる。

**デバウンスは性能要件**（`MemoListViewModelTest` / `MemoEditViewModelTest`）。検索250ms・自動保存500msの境界を仮想時間で固定する。打鍵ごとに全走査すると10,000件規模で実用に耐えず、打鍵ごとに履歴を積むとUndo1回で1文字しか戻らない。

**保持期間は実装を写さない**（`PurgeExpiredTrashUseCaseTest`）。境界時刻を `TrashPolicy` で計算せず「現在時刻 - 30日」とテスト側に直接書く。実装を写すとルール変更に追随してしまい検証にならない。

## テストを書くときの注意

このプロジェクトで実際に踏んだ落とし穴。

**`advanceTimeBy(n)` は「現在時刻 + n **未満**」のタスクしか実行しない。** `debounce(500)` にちょうど500を渡しても発火しない。境界を跨ぐには +1 する（`advancePastAutoSave()`）。これに気づかないと「デバウンスが効いていない」と誤診するうえ、**テストが偽の成功になる**。実際、保存失敗時の検証が「保存自体が走っていないので例外も起きない」状態で通っていた。

**Compose テストでは `Dispatchers.Main` を差し替えていない**ため、`advanceTimeBy` ではなく Robolectric の Looper を進める（`shadowOf(Looper.getMainLooper()).idleFor(...)`）。同じ「デバウンスを待つ」でも層によって手段が違う。

**`stateIn(WhileSubscribed)` は購読者がいないと何も動かない。** ViewModel テストでは `backgroundScope` で collect し続けて `uiState.value` を読む。Turbine の `test { }` は未消費の emission があるとエラーになるため、購読の維持が目的なら向かない。

**ダイアログは背後の画面を隠さない。** `onNodeWithText("仕事")` が一覧項目とダイアログ内の入力欄の2箇所にマッチしうる。入力欄は `hasSetTextAction()` やプレースホルダで一意に指す。

**ViewModel テストは「UI から触れるか」を見ない。** 実際に `onClearFilters()` は完璧に動いていたが、どの画面からも呼ばれていなかった。カバレッジ91.9%でもこの型の欠落は数字に現れない。**利用者が押せること**を Screen テストで確認する。

**「関数が呼ばれた」と「操作が完了した」は別。** `saveTag` が呼ばれたことだけを見ていたため、保存後にダイアログが閉じない不具合を見逃していた。

## カバレッジ

`./gradlew check` に 80% の下限が組み込まれており（`koverCachedVerify`）、下回るとビルドが落ちる。

| 指標 | 値 |
|---|---|
| LINE | 91.9% |
| INSTRUCTION | 88.8% |
| BRANCH | 69.9% |

計測から除外しているもの:

- **生成コード** — Room の `*_Impl`、Hilt の `*_Factory` 等。我々が書いたものではない
- **`di` / `ui.navigation`** — 分岐を持たない宣言だけの層。テストしても Hilt と Navigation の動作確認にしかならず、指標を薄める

`@Composable` は**除外していない**。UI を対象から外した数字は実態を表さないため。`data.database` と `MainActivity` も数字は低いが除外していない（前者は Migration という将来ロジックが入る場所）。

## 未実装

- **Migration テスト** — DB が version 1 のみで移行元が存在しない。v2 を切る際に追加する
- **実機/エミュレータでの自動テスト** — `androidTest` は未使用。実機確認は手動で行う

## 既知の制約

Robolectric 4.16.1 の対応上限が SDK 36 のため、`app/src/test/resources/robolectric.properties` で実行 SDK を 36 に固定している（アプリの targetSdk は 37）。Room/SQLite の挙動はこの2世代で差がないため DAO テストの妥当性には影響しない。Maven Central には Android 17 用の jar が既にあるので、Robolectric 4.17 の正式リリース後にこの固定は外せる。

## 関連ドキュメント

- [アーキテクチャ](architecture.md)
- [DB設計](database.md)
- [Repository仕様](repository-api.md)
