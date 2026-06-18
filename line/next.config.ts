import type { NextConfig } from 'next';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }; // バージョン取得

// gitコミット短縮ハッシュ（Vercelビルド時は環境変数優先、無ければgit、最後はdev）
function buildCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; }
}

const nextConfig: NextConfig = {
  serverExternalPackages: ['web-push'],
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,            // 例: 0.1.0
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit(),         // 例: 9663c82
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(), // ビルド日時
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "font-src 'self'",
              "worker-src 'self'",        // Service Worker は同一オリジンのみ
              "object-src 'none'",        // <object>/<embed> 等の危険な埋め込みを禁止
              "base-uri 'self'",          // <base> によるURL書き換えを防止
              "form-action 'self'",       // フォーム送信先を自サイトに限定
              "frame-ancestors 'none'",   // クリックジャッキング対策（iframe埋め込み禁止）
              "upgrade-insecure-requests", // http参照を自動でhttpsに格上げ
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
