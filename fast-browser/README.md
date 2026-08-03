# fast-browser

**軽さと起動の速さを最優先にした、Windows 向けのシンプルな Web ブラウザ。**

Electron を使わず [Tauri](https://tauri.app/) で作っているため、アプリ本体は約 9 MB、
インストーラーは約 2 MB に収まっています。表示エンジンは Windows 標準の WebView2
（Chrome と同じ Chromium ベース）を借りているので、ページの見え方は Chrome とほぼ同じです。

| | fast-browser | 一般的なブラウザ |
|---|---|---|
| アプリ本体 | 約 9 MB | 数百 MB |
| インストーラー | 約 2〜3 MB | 100 MB 以上 |
| 拡張機能・アカウント同期 | なし | あり |

---

## できること

- **タブ** — 切り替えてもページの状態（入力途中の文字・スクロール位置・戻る履歴）が残る
- **アドレスバー** — URL でない入力は自動で検索に切り替え（Google / DuckDuckGo / Bing）
- **ブックマーク** — バー表示、削除の取り消し付き
- **閲覧履歴** — キーワード検索、日付ごとのグループ表示、取り消し付き削除
- **ダウンロード** — 一覧、保存先フォルダを開く、同名ファイルの自動リネーム
- **ページ内検索** — 件数表示つきハイライト（Ctrl+F）
- **ズーム** — 25〜500%、設定は次回起動時も維持
- **プライベートモード** — オンの間は履歴を記録しない
- **日本語 / 英語** — OS の設定に自動追従も可能

機能の詳細・キーボードショートカット・データの保存場所は **[SPEC.md](./SPEC.md)** にまとめています。

### メモリとのトレードオフ

タブごとに表示部品を持つと状態は保たれますが、そのぶんメモリを使います。
そこで **同時に生かすタブは最大 6 枚**とし、超えたぶんは「いちばん長く見ていないタブ」を
解放して URL だけ覚えておき、戻ったときに読み込み直します（Chrome のタブ休止と同じ考え方）。
今見ているタブは決して解放されません。

---

## 使ってみる

### インストーラーから

`npm run tauri build` で生成される、いずれかを実行してください。

| ファイル | 形式 |
|---|---|
| `src-tauri/target/release/bundle/nsis/fast-browser_0.1.0_x64-setup.exe` | 一般的なインストーラー |
| `src-tauri/target/release/bundle/msi/fast-browser_0.1.0_x64_en-US.msi` | MSI（企業配布向け） |
| `src-tauri/target/release/fast-browser.exe` | インストール不要の単体実行ファイル |

> ⚠️ コード署名をしていないため、Windows の SmartScreen 警告が出ます。
> 「詳細情報」→「実行」で進められます。

### 動作環境

- Windows 10 / 11（64bit）
- WebView2 ランタイム（Windows 11 には標準で入っています）

---

## 開発

### 必要なもの

| ツール | バージョン |
|---|---|
| Node.js | 20 以上 |
| Rust | 1.77.2 以上（stable） |
| Visual Studio Build Tools | C++ ビルドツール（Tauri のビルドに必要） |

初回セットアップは [Tauri の前提条件](https://tauri.app/start/prerequisites/) を参照してください。

### コマンド

```bash
npm install            # 依存関係のインストール

npm run tauri dev      # 開発モードで起動（変更が即反映される）
npm run tauri build    # 配布用ビルド（exe / MSI / NSIS を生成）

npm run verify         # 下記の検査をまとめて実行
```

`npm run verify` の内訳:

| 検査 | コマンド |
|---|---|
| 型チェック | `npm run typecheck` |
| Lint（TS） | `npm run lint` |
| テスト（TS） | `npm test` — 31 件 |
| Lint（Rust） | `npm run lint:rust` — clippy、**警告ゼロが必須** |
| テスト（Rust） | `npm run test:rust` — 31 件 |

GitHub へ push すると、同じ検査＋フォーマット確認＋本番ビルドが
Windows ランナー上で自動実行されます（`.github/workflows/fast-browser-ci.yml`）。

### 技術スタック

| 層 | 使用技術 |
|---|---|
| 画面 | React 19 + TypeScript + Vite |
| 中身の処理 | Rust + Tauri 2 |
| 表示エンジン | WebView2（OS 標準、Chromium ベース） |
| データ保存 | JSON ファイル（`%APPDATA%\com.fastbrowser.app\`） |

外部の状態管理ライブラリや i18n ライブラリは使っていません。
「軽さ最優先」という方針のため、必要な範囲を自前の小さなコードで賄っています。

### コードを書く前に

**[CLAUDE.md](./CLAUDE.md) を読んでください。**
このプロジェクトには、知らずに踏むと原因不明のまま壊れる落とし穴がいくつかあります。

- Web ページの表示部分は OS が直接描くため、**CSS でその上に何かを重ねられない**
- ウィンドウを触る処理を同期コマンドで書くと、**エラーも出ずに固まる**
- ページから届く文字列は、`fbcmd://` を含めてすべて信用できない入力として扱う

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [SPEC.md](./SPEC.md) | 仕様書。何ができるか、どう動くのが正しいか（専門知識不要の説明） |
| [CLAUDE.md](./CLAUDE.md) | 実装規約と落とし穴。コードを書く前に読む |
