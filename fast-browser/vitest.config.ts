import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 現状のテスト対象は純粋関数のみ。DOM が必要になったら jsdom へ切り替える。
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**'],
    },
  },
})
