import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) throw new Error('Supabase env vars are not set. Copy .env.local.example to .env.local')

export const supabase = createClient(url, key)
