import type { NextConfig } from 'next'

const isTauri = process.env.TAURI_BUILD === '1'

const nextConfig: NextConfig = {
  output: isTauri ? 'export' : undefined, // Tauri ビルド時のみ静的エクスポート
  images: { unoptimized: isTauri },        // 静的エクスポートには必須
  compiler: {
    // 本番ビルドでは console を除去（error/warn は残す）
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
}

export default nextConfig
