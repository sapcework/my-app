import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// URLが未設定の場合はプレースホルダーを使用（ビルド時クラッシュ防止）
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : 'https://placeholder.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key';

let client: SupabaseClient | null = null; // シングルトン保持

export function createClient() {
  if (!client) { // 初回のみ生成し、以降は同一インスタンスを返す
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
