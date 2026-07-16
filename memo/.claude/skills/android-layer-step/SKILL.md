---
name: android-layer-step
description: memoアプリ（Android/Kotlin, Clean Architecture）で新規プロジェクト構築や新機能追加を行う際、DB→Repository→UseCase→ViewModel→Compose UI→テストの順に1層ずつ実装し、各ステップごとに完了報告して承認を待つワークフロー。「新機能を追加して」「Stepを進めて」等の依頼時に使用する。
---

memoアプリでの実装は、以下の層順を1ステップずつ、必ずこの順番で進める。

1. DB実装（Entity / DAO / Migration）
2. Repository実装
3. UseCase実装
4. ViewModel実装
5. Compose UI実装
6. テスト実装

## ルール

- 1ステップにつき実装する層は1つだけ。複数層をまとめて実装しない。
- 1ファイルずつ実装し、変更するファイルのみ提示する。コードを一度に大量出力しない。
- 常にコンパイル可能な状態を維持する。エラーが出た場合は次のステップに進む前に必ず修正する。
- 依存方向は `ui → domain → data` のみ。DAOをUIから直接呼び出さない。
- 各ステップ完了時、次の3項目を報告してから停止し、ユーザーの承認を待つ。承認前に次のステップへ進まない。
  - 完了内容
  - 作成ファイル一覧
  - 次に行う内容
