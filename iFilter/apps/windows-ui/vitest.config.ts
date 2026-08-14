// テスト設定は vite.config.ts と分けてある。
// vitest が同梱する Vite と、ビルドに使う Vite 8 でプラグインの型が食い違うため。
// ここではプラグインを読まないので衝突しない（テストは素の TypeScript で書く）。

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
