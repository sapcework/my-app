import { createClient } from '@supabase/supabase-js'

// publishable キーはクライアントに公開される前提のキー（RLSで保護）。
// 環境変数（.env.local / Vercelの環境変数）を優先し、未設定時のみ本番既定値にフォールバックする
// （Vercel側で環境変数が未設定でもビルドが壊れないための保険）。
const url = import.meta.env.VITE_SUPABASE_URL || 'https://grlvbrhsksxldmvasyyg.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_FwFtezMKl2AZBMVTOQwgaQ_TWG11J7k'

// ローカル開発で .env.local を用意し忘れると、気づかないまま本番データを操作してしまう危険があるため
// 開発サーバー起動時にだけ目立つ警告を出す（本番ビルドの挙動は変えない）
if (import.meta.env.DEV && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.warn(
    '[kakeiboWeb] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定のため、本番用Supabaseプロジェクトに接続します。\n' +
      'ローカル開発用のプロジェクトを使う場合は .env.local を作成してください。'
  )
}

export const supabase = createClient(url, key)
