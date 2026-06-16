import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST: ルームを退出した作成者が再参加する（owner ロールを復元）
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!UUID_RE.test(roomId)) return NextResponse.json({ error: 'invalid_room' }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // ルームの作成者を確認
  const { data: room } = await admin
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .single();

  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // 作成者なら owner、それ以外は招待リンクが必要
  const isCreator = (room as { created_by: string }).created_by === user.id;
  if (!isCreator) return NextResponse.json({ error: 'need_invite' }, { status: 403 });

  // 既にメンバーなら roomId を返すだけ
  const { data: existing } = await admin
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single();

  if (existing) return NextResponse.json({ roomId, alreadyMember: true });

  // owner ロールで再追加
  const { error } = await admin
    .from('room_members')
    .insert({ room_id: roomId, user_id: user.id, role: 'owner' });

  if (error) return NextResponse.json({ error: 'join_failed' }, { status: 500 });

  return NextResponse.json({ roomId });
}
