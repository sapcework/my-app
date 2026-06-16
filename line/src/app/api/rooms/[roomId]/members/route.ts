import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST: owner/admin が指定ユーザーをルームに追加（メール招待＝直接追加）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return NextResponse.json({ error: 'invalid_room' }, { status: 400 });

  const body = await req.json() as { userId: unknown };
  if (typeof body.userId !== 'string' || !UUID_RE.test(body.userId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 });
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

  // 呼び出し元が owner/admin かチェック
  const { data: membership } = await admin
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes((membership as { role: string }).role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 追加対象ユーザーの実在確認
  const { data: target } = await admin
    .from('users')
    .select('id')
    .eq('id', body.userId)
    .single();

  if (!target) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  // 既にメンバーなら成功扱い
  const { data: existing } = await admin
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', body.userId)
    .single();

  if (existing) return NextResponse.json({ ok: true, alreadyMember: true });

  const { error } = await admin
    .from('room_members')
    .insert({ room_id: roomId, user_id: body.userId, role: 'member' });

  if (error) return NextResponse.json({ error: 'add_failed' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
