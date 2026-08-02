---
name: tauri-setup
description: fast-browser プロジェクトの Tauri 初期化手順。Tauri CLI・Rust ツールチェーン・React フロントエンドをセットアップし、開発環境を構築する。
disable-model-invocation: false
---

# Tauri セットアップ手順

以下の順序で fast-browser の開発環境を構築する。

## 1. 前提条件の確認

```bash
rustc --version          # Rust インストール確認
cargo --version          # Cargo インストール確認
node --version           # Node.js 確認（v20+）
npm --version            # npm 確認
```

不足している場合:
- Rust: https://rustup.rs/ からインストール
- Node.js: https://nodejs.org/ からインストール

## 2. React フロントエンドの初期化

```bash
npm create vite@latest . -- --template react-ts
npm install
```

## 3. Tauri の追加

```bash
npm install --save-dev @tauri-apps/cli
npm install @tauri-apps/api
npx tauri init
```

`tauri init` の対話入力:
- App name: `fast-browser`
- Window title: `Fast Browser`
- Web assets location: `../dist`
- Dev server URL: `http://localhost:5173`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

## 4. 追加依存関係（Rust）

`src-tauri/Cargo.toml` に追加が必要な crate:
- `serde` / `serde_json` — データシリアライズ
- `tauri-plugin-shell` — シェルコマンド実行（必要に応じて）

## 5. 動作確認

```bash
npm run tauri dev    # 開発サーバー起動・ウィンドウ表示確認
```

## 6. 推奨 VS Code 拡張

- `rust-analyzer` — Rust 言語サポート
- `tauri-apps.tauri-vscode` — Tauri 支援
