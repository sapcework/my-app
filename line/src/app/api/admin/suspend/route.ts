import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST: 管理者が指定ユーザーの停止/解除を切り替え（is_suspended は service role のみ変更可）
export async function POST(req: NextRequest) {
  const body = await req.json() as { userId: unknown; suspended: unknown };
  if (typeof body.userId !== 'string' || !UUID_RE.test(body.userId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 });
  }
  if (typeof body.suspended !== 'boolean') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // 呼び出し元が管理者かチェック
  const { data: me } = await admin.from('users').select('is_admin').eq('id', user.id).single();
  if (!(me as { is_admin: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 管理者同士の停止は禁止（誤操作・乗っ取り耐性）
  const { data: target } = await admin.from('users').select('is_admin').eq('id', body.userId).single();
  if (!target) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  if ((target as { is_admin: boolean }).is_admin) {
    return NextResponse.json({ error: 'cannot_suspend_admin' }, { status: 403 });
  }

  const { error } = await admin
    .from('users')
    .update({ is_suspended: body.suspended })
    .eq('id', body.userId);

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  // Auth側もban/解除（既存セッションのトークン更新を止め、再ログインも遮断する）
  const { error: banError } = await admin.auth.admin.updateUserById(body.userId, {
    ban_duration: body.suspended ? '876000h' : 'none', // 停止=約100年、解除=ban解除
  });
  if (banError) return NextResponse.json({ error: 'ban_failed' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
