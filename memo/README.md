# Memo

ローカル保存のみで動作する、シンプルで高速な Android メモアプリ。

クラウド同期・サーバー・会員登録は不要で、完全にオフラインで動作します。データ送信は一切行いません。

## 主な機能

| 機能 | 内容 |
|---|---|
| メモ | 作成・編集・自動保存・Undo/Redo・文字数表示 |
| 整理 | ピン留め・お気に入り・タグ（複数付与） |
| 検索 | 全文/タイトル検索、タグ・お気に入りとの複合検索、5種の並び替え |
| ゴミ箱 | 30日間保持して復元可能。期限切れは起動時に自動削除 |
| 表示 | ライト/ダーク/システム追従、文字サイズ4段階、リスト/タイル切替 |

## 動作環境

| 項目 | 値 |
|---|---|
| 対象OS | Android 10 以上（minSdk 29） |
| compileSdk / targetSdk | 37 |
| JDK | 17 |

## 技術スタック

Kotlin / Jetpack Compose / MVVM + Clean Architecture / Hilt / Room / Coroutines + Flow / Navigation Compose / DataStore / Timber / Coil

## ビルド手順

### 前提

- Android Studio（同梱の JBR を JDK として使用）
- Android SDK Platform 37（未導入の場合は SDK Manager から導入）

`local.properties` に SDK のパスを記述します（リポジトリには含まれません）。

```properties
sdk.dir=C\:\\Users\\<ユーザー名>\\AppData\\Local\\Android\\Sdk
```

### Android Studio から

`memo/` をプロジェクトとして開き、Gradle Sync 後に Run します。

### コマンドラインから

`java` に PATH が通っていない場合は、Android Studio 同梱の JBR を指定します。

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"

./gradlew :app:assembleDebug   # デバッグAPKを生成
./gradlew ktlintCheck detekt   # 静的解析
./gradlew ktlintFormat         # 自動整形
./gradlew test                 # ユニットテスト
```

生成物は `app/build/outputs/apk/debug/app-debug.apk` に出力されます。

## バージョン方針

`gradle/libs.versions.toml` で一元管理しています。以下の制約があるため、個別に引き上げないでください。

- AGP 9.0 以降は Kotlin が組み込みとなり、`kotlin-android` プラグインは**適用禁止**です。
- AGP 9.3.0 の内蔵 KGP は 2.2.10 ですが、その世代の KSP（`2.2.10-2.0.2`）は生成コードを `kotlin.sourceSets` 経由で登録するため組み込み Kotlin と非互換です。このため KSP2 世代の **2.3.10** を使用し、Kotlin / Compose コンパイラプラグインも 2.3.10 に揃えています。
- **KSP のバージョンは Kotlin と完全に一致**させる必要があります。Room と Hilt が KSP に依存するため、ずれるとビルドが破綻します。

## 低スペック環境向けの設定

`gradle.properties` で Gradle デーモンを 2GB、Kotlin デーモンを 1GB に制限し、Android Studio との共存を優先しています。メモリに余裕がある場合は引き上げると高速化します。

## テスト

286件。Compose UI テストを含めすべて Robolectric 上の JVM で動くため、**実機もエミュレータも不要**です。

```bash
./gradlew test    # 全テスト
./gradlew check   # テスト + ktlint + detekt + カバレッジ下限(80%)
```

カバレッジは 91.9%（LINE）。下限を下回るとビルドが落ちます。詳細は [テスト仕様](docs/testing.md) を参照してください。

## ドキュメント

| 文書 | 内容 |
|---|---|
| [アーキテクチャ](docs/architecture.md) | 層の構成・データの流れ・クラス図・画面遷移 |
| [DB設計](docs/database.md) | ER図・テーブル定義・検索方針・Migration方針 |
| [Repository仕様](docs/repository-api.md) | 内部APIの契約 |
| [テスト仕様](docs/testing.md) | テスト方針・カバレッジ・落とし穴 |
| [機能仕様](SPEC.md) | 画面/機能の要件 |
| [開発ルール](CLAUDE.md) | コーディング規約・開発フロー |
