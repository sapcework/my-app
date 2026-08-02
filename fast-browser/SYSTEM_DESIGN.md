# fast-browser システム設計書

## 1. プロジェクト概要

Tauri + React + Rust で構築する軽量デスクトップブラウザ。

| 項目 | 内容 |
|------|------|
| 目的 | メモリ使用量最小・高速起動の実用ブラウザ |
| 技術スタック | Tauri 2.x / React 19 / TypeScript / Rust |
| 対象 OS | Windows（WebView2）、macOS（WebKit）、Linux（WebKitGTK） |
| Electron 不使用 | OS ネイティブ WebView でオーバーヘッドを削減 |

---

## 2. 主要機能

| 機能 | 説明 |
|------|------|
| タブ管理 | 複数タブの開閉・切り替え・並び替え |
| アドレスバー | URL 入力・検索エンジン連携（Enter で遷移） |
| ブックマーク | 追加・削除・フォルダ整理・永続化 |
| ナビゲーション | 戻る・進む・更新・ホーム |
| JavaScript | OS WebView により有効（無効化不可） |

---

## 3. アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│               React フロントエンド（UI 層）         │
│  TabBar │ AddressBar │ BookmarkPanel │ Settings   │
└────────────────────┬────────────────────────────┘
                     │  Tauri IPC（invoke / emit）
┌────────────────────▼────────────────────────────┐
│               Tauri / Rust バックエンド            │
│  BrowserCore │ TabManager │ BookmarkStore        │
│  HistoryStore │ SessionStore                     │
└────────────────────┬────────────────────────────┘
                     │  OS WebView API
┌────────────────────▼────────────────────────────┐
│  WebView2（Win）/ WebKit（mac）/ WebKitGTK（Linux）│
│  ← 実際のウェブコンテンツ表示はここで行われる        │
└─────────────────────────────────────────────────┘
```

### 重要な制約

- **シングルプロセス**: タブごとに独立プロセスを作らず単一プロセスで全タブを管理（メモリ最小化）
- **WebView は 1 インスタンス**: 表示エリアを仮想的に切り替える形でタブを実現（詳細は §4）
- **セキュリティ分離**: Tauri の `allowlist` で IPC コマンドを制限

---

## 4. タブ管理の設計

Tauri では 1 ウィンドウに WebView を複数配置するのが困難なため、以下のアプローチを採用。

### アプローチ: Rust 側でタブ状態を管理、フォアグラウンド切り替え

```
[タブ 1] URL=https://example.com  状態=バックグラウンド（キャッシュ）
[タブ 2] URL=https://google.com   状態=フォアグラウンド（表示中）  ← WebView はここを表示
[タブ 3] URL=https://github.com   状態=バックグラウンド（未ロード）
```

- アクティブタブの URL を WebView に `navigate()` で渡す
- バックグラウンドタブは URL・タイトル・スクロール位置などの状態のみ Rust 側で保持
- タブ切り替えは WebView ナビゲーション（一瞬リロードが発生）

> **メモリへの影響**: バックグラウンドタブは WebView プロセスに展開されないためメモリを消費しない。ただしタブ切り替え時に再ロードが発生するトレードオフあり。

---

## 5. ディレクトリ構成

```
fast-browser/
├── src/                        # React フロントエンド
│   ├── components/
│   │   ├── TabBar/             # タブバーコンポーネント
│   │   ├── AddressBar/         # アドレスバー
│   │   ├── BookmarkPanel/      # ブックマークパネル
│   │   └── Toolbar/            # 戻る・進む・更新ボタン
│   ├── store/                  # Zustand 状態管理
│   │   ├── tabStore.ts         # タブ状態
│   │   └── bookmarkStore.ts    # ブックマーク状態
│   ├── hooks/                  # カスタムフック
│   ├── types/                  # TypeScript 型定義
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs             # エントリポイント
│   │   ├── lib.rs              # Tauri アプリ定義
│   │   ├── browser/
│   │   │   ├── mod.rs
│   │   │   ├── tab_manager.rs  # タブ管理ロジック
│   │   │   └── navigation.rs   # WebView ナビゲーション
│   │   └── storage/
│   │       ├── bookmarks.rs    # ブックマーク永続化
│   │       └── history.rs      # 閲覧履歴
│   └── Cargo.toml
├── CLAUDE.md
└── SYSTEM_DESIGN.md
```

---

## 6. データモデル

### Tab（Rust 側）

```rust
pub struct Tab {
    pub id: u32,
    pub url: String,
    pub title: String,
    pub favicon: Option<String>,
    pub is_loading: bool,
    pub scroll_y: f64,          // タブ切り替え時に復元
}
```

### Bookmark

```rust
pub struct Bookmark {
    pub id: u32,
    pub url: String,
    pub title: String,
    pub folder_id: Option<u32>,
    pub created_at: i64,        // Unix タイムスタンプ
}
```

### BookmarkFolder

```rust
pub struct BookmarkFolder {
    pub id: u32,
    pub name: String,
    pub parent_id: Option<u32>, // 階層構造
}
```

---

## 7. Tauri IPC コマンド

React → Rust の呼び出し一覧（`invoke()`）。

| コマンド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `navigate` | `{tab_id, url}` | `()` | 指定タブで URL を開く |
| `new_tab` | `{url?}` | `Tab` | 新しいタブを作成 |
| `close_tab` | `{tab_id}` | `()` | タブを閉じる |
| `switch_tab` | `{tab_id}` | `()` | アクティブタブを切り替え |
| `get_tabs` | なし | `Vec<Tab>` | 全タブ一覧を取得 |
| `add_bookmark` | `{url, title, folder_id?}` | `Bookmark` | ブックマーク追加 |
| `get_bookmarks` | なし | `Vec<Bookmark>` | ブックマーク一覧 |
| `delete_bookmark` | `{id}` | `()` | ブックマーク削除 |

Tauri イベント（Rust → React、`emit()`）:

| イベント | ペイロード | 説明 |
|---------|-----------|------|
| `tab-updated` | `Tab` | タイトル・URL・loading 状態が変化 |
| `navigation-started` | `{tab_id, url}` | ページ遷移開始 |
| `navigation-finished` | `{tab_id}` | ページ遷移完了 |

---

## 8. 状態管理（React 側）

Zustand を使用（kakeiboWeb と同一パターン）。

```typescript
interface TabStore {
  tabs: Tab[];
  activeTabId: number | null;
  newTab: (url?: string) => void;
  closeTab: (id: number) => void;
  switchTab: (id: number) => void;
  updateTab: (tab: Tab) => void;
}
```

- タブ状態は Rust が正とし、React はキャッシュとして保持
- `tab-updated` イベントで Rust からの更新を受け取り Zustand を更新

---

## 9. データ永続化

Tauri の `app_data_dir()` 以下に JSON ファイルで保存。

```
%APPDATA%/fast-browser/          # Windows
~/Library/Application Support/fast-browser/   # macOS
~/.local/share/fast-browser/     # Linux
  ├── bookmarks.json
  ├── history.json
  └── settings.json
```

---

## 10. パフォーマンス戦略

| 戦略 | 実装方法 |
|------|---------|
| 起動速度 | Tauri のコールドスタートは ~100ms 台（Electron の約 1/5） |
| メモリ | シングル WebView プロセス。タブはメタデータのみ保持 |
| レンダリング | React の仮想 DOM + Vite バンドル最小化 |
| 履歴検索 | SQLite（`tauri-plugin-sql`）への移行を将来検討 |

---

## 11. 開発ロードマップ

| Phase | 内容 |
|-------|------|
| Phase 1 | Tauri プロジェクト初期化・単一タブでの基本ナビゲーション |
| Phase 2 | タブバー実装（複数タブ・切り替え・閉じる） |
| Phase 3 | アドレスバー（URL 入力・検索エンジン連携） |
| Phase 4 | ブックマーク機能（追加・削除・永続化） |
| Phase 5 | UI 仕上げ・パフォーマンス計測・リリースビルド |
