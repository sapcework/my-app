import { createClient } from '@supabase/supabase-js'

// publishable キーはクライアントに公開される前提のキー（RLSで保護）。
// 環境変数（.env.local / Vercelの環境変数）を優先し、未設定時のみ本番既定値にフォールバックする。
const url = import.meta.env.VITE_SUPABASE_URL || 'https://grlvbrhsksxldmvasyyg.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_FwFtezMKl2AZBMVTOQwgaQ_TWG11J7k'

export const supabase = createClient(url, key)
