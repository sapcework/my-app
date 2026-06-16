import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 呼び出し元の認証＋ルーム内ロールを取得（owner/admin 操作の共通前処理）
async function getCaller(roomId: string, admin: SupabaseClient) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null }; // 未認証

  const { data: membership } = await admin
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single();

  return { user, role: (membership as { role: string } | null)?.role ?? null }; // 自分のロール
}

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

  const admin = createAdminClient();

  // 呼び出し元が owner/admin かチェック
  const { user, role } = await getCaller(roomId, admin);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!role || !['owner', 'admin'].includes(role)) {
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

// DELETE: owner/admin が指定メンバーを退出させる（owner は退出不可）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return NextResponse.json({ error: 'invalid_room' }, { status: 400 });

  const body = await req.json() as { userId: unknown };
  if (typeof body.userId !== 'string' || !UUID_RE.test(body.userId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { user, role } = await getCaller(roomId, admin);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!role || !['owner', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 対象メンバーのロールを確認（owner は退出させられない）
  const { data: target } = await admin
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', body.userId)
    .single();

  if (!target) return NextResponse.json({ ok: true, notMember: true }); // 既に非メンバー
  if ((target as { role: string }).role === 'owner') {
    return NextResponse.json({ error: 'cannot_kick_owner' }, { status: 403 });
  }

  const { error } = await admin
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', body.userId);

  if (error) return NextResponse.json({ error: 'kick_failed' }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// PATCH: owner が指定メンバーのロールを変更（admin <-> member、owner は対象外）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return NextResponse.json({ error: 'invalid_room' }, { status: 400 });

  const body = await req.json() as { userId: unknown; role: unknown };
  if (typeof body.userId !== 'string' || !UUID_RE.test(body.userId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 });
  }
  if (body.role !== 'admin' && body.role !== 'member') {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { user, role } = await getCaller(roomId, admin);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'owner') { // ロール変更は owner のみ
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 対象が owner なら変更不可
  const { data: target } = await admin
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', body.userId)
    .single();

  if (!target) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  if ((target as { role: string }).role === 'owner') {
    return NextResponse.json({ error: 'cannot_change_owner' }, { status: 403 });
  }

  const { error } = await admin
    .from('room_members')
    .update({ role: body.role })
    .eq('room_id', roomId)
    .eq('user_id', body.userId);

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
