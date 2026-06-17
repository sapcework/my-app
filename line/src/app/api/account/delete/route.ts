import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST: ログイン中ユーザーが自分自身のアカウントを削除（退会）
export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // 関連データを整合的に削除（SECURITY DEFINER 関数・自分のidのみ）
  const { error: rpcError } = await admin.rpc('delete_user_account', { p_uid: user.id });
  if (rpcError) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });

  // 認証ユーザー本体を削除
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) return NextResponse.json({ error: 'auth_delete_failed' }, { status: 500 });

  // ログイン試行履歴の掃除（email基準・任意）
  if (user.email) await admin.from('login_attempts').delete().eq('email', user.email);

  return NextResponse.json({ ok: true });
}
