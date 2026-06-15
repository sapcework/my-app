import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RoomInvite } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuthUser(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET: 現在の有効な招待リンクを取得（なければ作成）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return NextResponse.json({ error: 'invalid_room' }, { status: 400 });

  const cookieStore = await cookies();
  const user = await getAuthUser(cookieStore);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // owner/admin チェック
  const { data: membership } = await admin
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes((membership as { role: string }).role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 既存の有効な招待を返す（最新1件）
  const { data: existing } = await admin
    .from('room_invites')
    .select('*')
    .eq('room_id', roomId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ invite: existing as RoomInvite });
  }

  // なければ新規作成
  const { data: created, error } = await admin
    .from('room_invites')
    .insert({ room_id: roomId, created_by: user.id })
    .select()
    .single();

  if (error || !created) return NextResponse.json({ error: 'create_failed' }, { status: 500 });

  return NextResponse.json({ invite: created as RoomInvite });
}

// DELETE: 招待リンクを無効化（新しいトークンで再生成）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return NextResponse.json({ error: 'invalid_room' }, { status: 400 });

  const cookieStore = await cookies();
  const user = await getAuthUser(cookieStore);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'admin'].includes((membership as { role: string }).role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 既存の招待を削除して新規作成
  await admin.from('room_invites').delete().eq('room_id', roomId);

  const { data: created, error } = await admin
    .from('room_invites')
    .insert({ room_id: roomId, created_by: user.id })
    .select()
    .single();

  if (error || !created) return NextResponse.json({ error: 'create_failed' }, { status: 500 });

  return NextResponse.json({ invite: created as RoomInvite });
}
