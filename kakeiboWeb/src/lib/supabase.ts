import { createClient } from '@supabase/supabase-js'

// publishable キーはクライアントに公開される前提のキー（RLSで保護）。
// 環境変数が空文字でビルドされる事故を避けるため直接指定する。
const url = 'https://grlvbrhsksxldmvasyyg.supabase.co'
const key = 'sb_publishable_FwFtezMKl2AZBMVTOQwgaQ_TWG11J7k'

export const supabase = createClient(url, key)
