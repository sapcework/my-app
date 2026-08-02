# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Tauri + React + TypeScript + Rust の軽量デスクトップブラウザ。Electron は使用しない。

**最優先要件:** メモリ使用量最小化・高速起動

## エンジン

Tauri は OS ネイティブ WebView を使用するためプラットフォーム依存がある:
- Windows: WebView2（Chromium ベース）
- macOS: WebKit
- Linux: WebKitGTK

## ビルドコマンド

```bash
npm run tauri dev              # 開発サーバー起動
npm run tauri build            # 本番ビルド
cargo clippy -- -D warnings    # Rust lint（警告ゼロ必須）
```

## Rust 規約

- `cargo fmt` でフォーマット（保存時 Hook で自動実行）
- `cargo clippy -- -D warnings` でエラー 0 を維持
- `unsafe` ブロックは必ず理由をコメントで記載

## アーキテクチャ制約

- タブは単一プロセスで管理（マルチプロセスはメモリ増大のため避ける）
- タブ間のセキュリティ分離は Tauri のサンドボックス機能で実現
- ブックマーク・履歴などのデータは Tauri の `app_data_dir()` 以下に保存
