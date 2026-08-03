// アプリ全体で共有するドメイン型。
// Rust 側（src-tauri/src/lib.rs）の serde 構造体と 1:1 で対応する。
// スネークケースのフィールド名は Rust の定義に合わせている。

export interface Tab {
  id: number;
  url: string;
  title: string;
  is_loading: boolean;
  favicon: string | null;
}

export interface TabsState {
  tabs: Tab[];
  active_id: number;
}

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  created_at: number;
}

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  visited_at: number;
  favicon: string | null;
}

export interface Download {
  id: number;
  url: string;
  file_name: string;
  path: string;
  status: 'running' | 'done' | 'failed';
  started_at: number;
}

/** 永続化される設定（Rust 側 Settings と対応）。 */
export interface Settings {
  home_url: string;
  engine_id: string;
  zoom: number;
  /** 表示言語。空文字は「OS の設定に従う」。 */
  locale: string;
}

/** 画面右下に出す通知。action があれば「元に戻す」等のボタンを表示する。 */
export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
  action?: { label: string; run: () => void };
}
