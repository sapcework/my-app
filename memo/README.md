# Memo

ローカル保存のみで動作する、シンプルで高速な Android メモアプリ。

クラウド同期・サーバー・会員登録は不要で、完全にオフラインで動作します。データ送信は一切行いません。

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

## ドキュメント

- 機能仕様: [SPEC.md](SPEC.md)
- 開発ルール: [CLAUDE.md](CLAUDE.md)
