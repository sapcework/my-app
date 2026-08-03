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

- タブ間のセキュリティ分離は Tauri のサンドボックス機能で実現
- ブックマーク・履歴などのデータは Tauri の `app_data_dir()` 以下に保存

### タブは 1 枚につき 1 つの WebView（上限つき）

タブごとに `add_child` で WebView を作り、非アクティブなものは `hide()` で隠す。
こうしないとタブは「アドレスバーのブックマーク」でしかなく、切り替えるたびに
ページが再読込され、スクロール位置・入力途中のフォーム・戻る履歴が失われる。

メモリ最優先の要件とは正面から衝突するので、`MAX_LIVE_WEBVIEWS`（既定 6）で
生かす WebView の数に上限を設ける。超えたぶんは**最後に見てから最も時間が経った
タブ**から `close()` して URL だけを覚えておき、再訪時に作り直す（＝そのタブだけ
再読込が走る）。アクティブタブは決して捨てない。

そのため各タブは `live`（WebView が存在するか）と `last_active` を持つ。
どちらも内部状態なので `#[serde(skip)]` で chrome には送らない。

### タブを触る処理は必ず async コマンドにする

`add_child` はメインスレッドの応答を待つ。さらに `TabManager` のロックは
メインスレッド側のイベントハンドラ（`on_page_load` など）も取りに来るため、
**ロックを握ったまま WebView を生成・破棄してはいけない**。

そこで `TabManager` のメソッドは WebView を一切触らず、「何をすべきか」を
`SwitchPlan` / `ClosePlan` として返すだけにしてある。ロックを手放してから
`apply_switch` に渡すこと。この分離のおかげで TabManager 単体のテストが書ける。

### イベントは発生元のタブへ振り分ける

背景タブも読み込みを続けるので、`fbmeta://` やページ読み込み完了は
アクティブタブとは限らない。`content_webview_builder` は各ハンドラに
タブ id を捕捉させてあるので、必ずその id 宛に反映すること
（「アクティブタブを更新」と書くと別タブの閲覧中に表示が壊れる）。

- `fbcmd://` と `fbfind://` はアクティブタブからのものだけ受け付ける。
  キー操作は見えているタブにしか届かないので、背景タブからのそれは
  ページが自分で発火させたものにほかならない。
- 履歴のタイトル更新は「先頭のエントリ」ではなく URL で対象を選ぶ
  （`update_meta_for_url`）。

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

### 新規ウィンドウ・ダウンロード

- `target="_blank"` / `window.open` / 右クリックの「リンクを新しいウィンドウで開く」は
  `on_new_window` で受け、**別ウィンドウを作らず自前のタブとして開く**（`NewWindowResponse::Deny` を返す）。
  http(s) 以外のスキームは拒否し、連打はレート制限する。
- ダウンロードは `on_download` で受ける。保存名は WebView2 の提案（`Content-Disposition` 由来）を
  優先しつつ、**サーバー由来なので必ず `sanitize_file_name` を通す**（`../` でダウンロードフォルダの
  外に書き出されるのを防ぐ）。既存ファイルは `name (1).ext` として上書きを避ける。

### 戻る／進む／更新はページに乗っ取られないようにする

Tauri には戻る/進むのネイティブ API が無く `eval` に頼るしかないが、
`history.back()` を直接呼ぶと `history.back = () => {}` と上書きするだけで
無効化できてしまう。`NAV_GUARD_SCRIPT` がページより先に本来の関数を退避し、
書き換え不可の `window.__fbNav` として保持しているので、必ずそちらを使うこと。
更新はネイティブの `webview.reload()` を使う（`location.reload()` の eval は不可）。

### エラーページは自前で作らない

WebView2 の既定エラーページは日本語化済みで、原因の説明・エラーコード
（DNS_PROBE_POSSIBLE など）・再読み込みボタンを備えている。
自前のページに差し替えると、この診断情報を失って**改悪になる**。
なお失敗の検出手段自体も存在しない（`on_page_load` は失敗時も Finished を返す）。

### 右クリックメニュー

WebView2 の既定メニューがそのまま使え、日本語化もされている（戻る／更新／名前を付けて保存／
印刷／リンクを新しいウィンドウで開く など）。自前実装は不要。
なおコンテンツ WebView の上にはメニューを重ねられないため、独自 HTML での実装は不可能。

### ページ由来の入力は信頼しない

`fbcmd://` `fbmeta://` は**任意の Web ページが `location.href` で自由に発火できる**。
新しいスキームを足す際は必ず: 入力を検証・長さ制限し（`sanitize_title` /
`sanitize_favicon`）、状態を変える操作にはレート制限（`PageCmdGate`）を掛けること。

### Tauri capability の範囲

`capabilities/default.json` は `webviews: ["main"]` で chrome だけに権限を与えている。
`windows: ["main"]` にするとその**ウィンドウ配下の全 webview**（＝任意のページを開く
`browser-content`）に権限が及ぶため、絶対に戻さないこと。
