import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '') as string
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string

if (!url) console.error('[Supabase] VITE_SUPABASE_URL が未設定です')
if (!key) console.error('[Supabase] VITE_SUPABASE_ANON_KEY が未設定です')

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder'
)
