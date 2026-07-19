import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }, // tsconfig の paths と揃える
  },
  test: {
    environment: 'node', // WebCrypto は Node の globalThis.crypto を使用
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
})
