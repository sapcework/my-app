import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
  ?? 'https://grlvbrhsksxldmasyyg.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  ?? 'sb_publishable_FwFtezMKl2AZBMVTOQwgaQ_TWG11J7k'

export const supabase = createClient(url, key)
