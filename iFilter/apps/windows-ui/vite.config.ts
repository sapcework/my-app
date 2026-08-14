import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Tauri が固定ポートで待つので、空いていなければ失敗させる（別ポートに逃げない）
  server: { port: 1421, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'esnext' },
});
