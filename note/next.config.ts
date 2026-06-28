import type { NextConfig } from 'next'

const isTauri = process.env.TAURI_BUILD === '1'

const nextConfig: NextConfig = {
  output: isTauri ? 'export' : undefined, // Tauri ビルド時のみ静的エクスポート
  images: { unoptimized: isTauri },        // 静的エクスポートには必須
}

export default nextConfig
