# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要
- Android向けメモアプリ（ネイティブ、Kotlin）。個人開発ではなく、企業が実際に保守・運用できる品質を目指す。
- ローカル保存のみ。クラウド同期・サーバー・会員登録・個人情報送信は一切なし。完全オフラインで動作すること。
- 対象は Android 10 以上。将来的な iOS 対応を見据え、domain層はプラットフォーム非依存に保つこと。
- 詳細な画面/機能仕様・完成後の成果物一覧は @SPEC.md を参照。

## 技術スタック
- 言語: Kotlin
- UI: Jetpack Compose
- アーキテクチャ: MVVM + Clean Architecture + Repository Pattern
- DI: Hilt
- DB: Room Database
- 非同期: Coroutines / Flow
- 画面遷移: Navigation Compose
- 設定保存: DataStore
- ログ: Timber
- 画像: Coil
- テスト: JUnit, Mockito, Compose Test

## アーキテクチャルール
- 依存方向は `ui → domain → data` の一方向のみ。逆方向の依存は禁止。
- DAOをUIから直接呼び出さない。DBアクセスは必ずRepository経由。
- ディレクトリ構成:
  ```
  app/
    data/{database,dao,entity,repository}/
    domain/{model,repository,usecase}/
    ui/{screen,component,navigation,theme}/
    di/
    util/
  ```
- SOLID原則を守る。

## コーディング規約
- Kotlin公式コーディング規約に従う。ktlint / detekt を使用する。
- Magic Number禁止。定数として管理する。
- コメントは必要最小限。書く場合は行末に記載する（リポジトリ共通ルール）。
- Null安全を徹底する。

## テスト方針
- Repository / UseCase / ViewModel / DAO / Compose UI の各層でテストを書く。
- カバレッジ目標は80%以上。

## パフォーマンス / セキュリティ
- メモ10,000件でも快適に動作すること（LazyColumn使用、不要な再Compose禁止、Flow活用）。
- DBアクセスはIOスレッドで実行し、ANR・メモリリークを防ぐ。
- SQL Injection対策、入力チェックを行う。ログに個人情報を出力しない。

## Git規約
- コミットは小さい単位に分割する（例: "Add Room Database", "Implement Repository", "Add Home Screen"）。

## 開発フロー
新規プロジェクト構築時は以下のStepを順守する。**各Step完了時に「完了内容 / 作成ファイル一覧 / 次に行う内容」を報告し、ユーザーの承認を得てから次に進む**こと。連続して複数Stepを進めない。

1. プロジェクト構成作成
2. DB実装
3. Repository実装
4. UseCase実装
5. ViewModel実装
6. Compose UI実装
7. テスト実装
8. リファクタリング

新機能追加時も同様の層順（DB→Repository→UseCase→ViewModel→UI→テスト）で進める。`/android-layer-step` スキルを使用できる。

## 出力ルール
- コードは一度に大量出力しない。1ファイルずつ実装する。
- 変更するファイルのみ提示する。
- 常にコンパイル可能な状態を維持する。エラーは次に進む前に必ず修正する。

## 開発環境
- 開発PC: Windows 11, Intel Core i5-8500, メモリ8GB。このスペックで快適に動作する方法を採用する。
- 重いDocker環境は使用しない。Android Studioのみでビルド可能な構成にする。
- `java` / `gradle` / `ktlint` はPATHに無い。JDKはAndroid Studio同梱のJBRを使う: `C:\Program Files\Android\Android Studio\jbr` （Gradleは生成する `gradlew` を使用）
- Android SDK: `C:\Users\user\AppData\Local\Android\Sdk`
