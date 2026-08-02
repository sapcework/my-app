import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// テスト設定は vitest.config.ts に分離している（tsc -b の型解決を汚さないため）
export default defineConfig({
  plugins: [react()],
  server: { port: 5200, strictPort: true }, // 他プロジェクトのDevサーバーと衝突しないよう固定
  clearScreen: false,
  build: {
    // ソースマップは配布物に含めない（chrome 側の実装詳細を出さないため）
    sourcemap: false,
  },
})
