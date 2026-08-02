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

## ビルド・検証コマンド

```bash
npm run verify   # 型チェック・ESLint・Vitest・clippy・cargo test を一括実行
npm test         # フロントのユニットテスト
npm run test:rust
```

## アーキテクチャ制約

- タブは単一プロセスで管理（マルチプロセスはメモリ増大のため避ける）
- タブ間のセキュリティ分離は Tauri のサンドボックス機能で実現
- ブックマーク・履歴などのデータは Tauri の `app_data_dir()` 以下に保存

### コンテンツ WebView は OS ネイティブの子ビュー（最重要）

コンテンツは `window.add_child()` で作る子 WebView で、chrome（React UI）の**上に**
OS が直接描画する。したがって:

- CSS の `z-index` や `position: absolute` で**コンテンツの上に何かを重ねることはできない**。
  ブックマークバー・履歴パネル・トースト通知はすべて、chrome の高さ（`totalHeight`）を
  増やし `set_webview_top` で WebView を押し下げて表示領域を作っている。
- `src/App.tsx` の `BASE_HEIGHT` と `lib.rs` の `BASE_TOOLBAR_HEIGHT` は必ず一致させる。

### Tauri コマンドでのデッドロック（既知の落とし穴）

同期の `#[tauri::command]` はメインスレッドで実行される。その中で
`window.inner_size()` / `scale_factor()` / `webview.position()` を呼ぶと
イベントループへの同期往復になり**自己デッドロックし、コマンドが返らない**。
症状は「エラーも出ないまま UI が反応しない」。

- ウィンドウサイズは `Layout` 状態にキャッシュし、コマンドからは問い合わせない。
- ウィンドウを触るコマンドは `async fn` にする。

### メニュー・パネルの高さ定数

`src/App.tsx` の各高さ定数と `src/App.css` の対応する `height` は必ず一致させる
（`MENU_HEIGHT` ↔ `#app-menu`、`HISTORY_PANEL_HEIGHT` ↔ `#history-panel` など）。
ズレると WebView の押し下げ量が合わず、パネルの下端が隠れる／隙間が空く。

### ページ由来の入力は信頼しない

`fbcmd://` `fbmeta://` は**任意の Web ページが `location.href` で自由に発火できる**。
新しいスキームを足す際は必ず: 入力を検証・長さ制限し（`sanitize_title` /
`sanitize_favicon`）、状態を変える操作にはレート制限（`PageCmdGate`）を掛けること。

### Tauri capability の範囲

`capabilities/default.json` は `webviews: ["main"]` で chrome だけに権限を与えている。
`windows: ["main"]` にするとその**ウィンドウ配下の全 webview**（＝任意のページを開く
`browser-content`）に権限が及ぶため、絶対に戻さないこと。
