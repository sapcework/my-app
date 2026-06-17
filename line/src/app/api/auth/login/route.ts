import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const MAX_ATTEMPTS = 5;      // (email+ip) ごとの最大失敗回数
const IP_MAX_ATTEMPTS = 30;  // 同一IPからの総失敗回数の上限（スタッフィング緩和）
const LOCK_MINUTES = 15;     // ロック時間（分）

export async function POST(req: NextRequest) {
  const body = await req.json() as { email: unknown; password: unknown };

  if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.email || !body.password) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  const password = body.password;
  // 送信元IP（Vercel等のプロキシ経由は x-forwarded-for の先頭）
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim())
    || req.headers.get('x-real-ip')
    || 'unknown';
  const admin = createAdminClient();
  const lockWindow = new Date(Date.now() - LOCK_MINUTES * 60 * 1000).toISOString();

  // 同一IPからの総失敗回数（全アカウント横断）— クレデンシャルスタッフィング対策
  const { count: ipCount } = await admin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('attempted_at', lockWindow);

  if ((ipCount ?? 0) >= IP_MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'locked', remainingMinutes: LOCK_MINUTES }, { status: 429 });
  }

  // このアカウントへの「同一IPからの」失敗件数（別IPの攻撃で正規ユーザーをロックしない）
  const { count } = await admin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .eq('ip', ip)
    .gte('attempted_at', lockWindow);

  const failCount = count ?? 0;

  if (failCount >= MAX_ATTEMPTS) {
    // ロック解除時刻（最も古い失敗から15分後）
    const { data: oldest } = await admin
      .from('login_attempts')
      .select('attempted_at')
      .eq('email', email)
      .eq('ip', ip)
      .gte('attempted_at', lockWindow)
      .order('attempted_at', { ascending: true })
      .limit(1)
      .single();

    const unlockAt = oldest
      ? new Date(new Date((oldest as { attempted_at: string }).attempted_at).getTime() + LOCK_MINUTES * 60 * 1000)
      : new Date(Date.now() + LOCK_MINUTES * 60 * 1000);

    const remainingMinutes = Math.max(1, Math.ceil((unlockAt.getTime() - Date.now()) / 60000));
    return NextResponse.json({ error: 'locked', remainingMinutes }, { status: 429 });
  }

  // Supabase認証（サーバーサイドでcookieを設定）
  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          list.forEach((c) => pendingCookies.push(c as typeof pendingCookies[number]));
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 失敗を記録（IPも残す）
    await admin.from('login_attempts').insert({ email, ip });

    // 24時間以上古いレコードを非同期で削除
    void admin
      .from('login_attempts')
      .delete()
      .lt('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const remaining = MAX_ATTEMPTS - (failCount + 1);
    return NextResponse.json({
      error: 'invalid_credentials',
      remaining: Math.max(0, remaining),
    }, { status: 401 });
  }

  // 成功：cookieをレスポンスに付与して返却
  const res = NextResponse.json({ ok: true });
  pendingCookies.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
  });
  return res;
}
