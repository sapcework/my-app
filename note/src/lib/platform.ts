// 実行環境の判定（StorageContext / PWARegister で共有）

// Tauri デスクトップ版の WebView 内で動いているか
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
