import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) throw new Error('Supabase env vars are not set. Copy .env.local.example to .env.local')

const TIMEOUT_MS = 10_000 // 通信ハング防止のための打ち切り時間

export const supabase = createClient(url, key, {
  global: {
    // ネットワーク停止時に同期処理が無限待機しないようタイムアウトを付与する
    // （supabase-js が独自に signal を渡す場合はそれを尊重する）
    fetch: (input, init) =>
      fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) }),
  },
})
