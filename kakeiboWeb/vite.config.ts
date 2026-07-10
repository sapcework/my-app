import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
  build: {
    sourcemap: false, // 本番環境でソースコードを露出させない
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/recharts'))      return 'vendor-charts'
          if (id.includes('node_modules/lucide-react'))  return 'vendor-lucide'
          if (id.includes('node_modules/react-router'))  return 'vendor-router'
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/'))        return 'vendor-react'
          if (id.includes('node_modules/zustand'))       return 'vendor-store'
        },
      },
    },
  },
})
