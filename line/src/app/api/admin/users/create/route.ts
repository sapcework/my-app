import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { USERNAME_RE, normalizeUsername, usernameToEmail } from '@/lib/username';

// POST: 管理者がユーザー名＋パスワードでアカウントを発行（メール不要・擬似メールで作成）
export async function POST(req: NextRequest) {
  const body = await req.json() as { username: unknown; password: unknown; displayName: unknown };

  if (typeof body.username !== 'string' || !USERNAME_RE.test(normalizeUsername(body.username))) {
    return NextResponse.json({ error: 'invalid_username' }, { status: 400 }); // 英小文字/数字/_ 3〜20字
  }
  if (typeof body.password !== 'string' || body.password.length < 6) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 400 }); // 6文字以上
  }
  const displayName = typeof body.displayName === 'string' && body.displayName.trim()
    ? body.displayName.trim()
    : normalizeUsername(body.username);

  // 呼び出し元が管理者かチェック
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('users').select('is_admin').eq('id', user.id).single();
  if (!(me as { is_admin: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const email = usernameToEmail(body.username);

  // アカウント作成（email_confirm:true で即ログイン可。display_name はトリガーが metadata から拾う）
  const { error } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return NextResponse.json(
      { error: taken ? 'username_taken' : 'create_failed' },
      { status: taken ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, username: normalizeUsername(body.username) });
}
