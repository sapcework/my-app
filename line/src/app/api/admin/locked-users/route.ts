import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: me } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const lockWindow = new Date(Date.now() - LOCK_MINUTES * 60 * 1000).toISOString();

  // ロック閾値以上の失敗がある email を集計
  const { data } = await admin
    .from('login_attempts')
    .select('email')
    .gte('attempted_at', lockWindow);

  if (!data) return NextResponse.json({ lockedEmails: [] });

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.email] = (counts[row.email] ?? 0) + 1;
  }
  const lockedEmails = Object.entries(counts)
    .filter(([, c]) => c >= MAX_ATTEMPTS)
    .map(([email]) => email);

  return NextResponse.json({ lockedEmails });
}
