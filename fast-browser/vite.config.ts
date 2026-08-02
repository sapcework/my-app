import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5200, strictPort: true }, // 他プロジェクトのDevサーバーと衝突しないよう固定
  clearScreen: false,
})
