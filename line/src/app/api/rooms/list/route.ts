import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// GET: メンバーであるルーム + 自分が作成したルームを返す（admin で RLS バイパス）
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // メンバーシップ取得
  const { data: memberships } = await admin
    .from('room_members')
    .select('room_id')
    .eq('user_id', user.id);

  const memberRoomIds = (memberships ?? []).map((m) => (m as { room_id: string }).room_id);

  // 自分が作成したルームの ID 取得
  const { data: createdRoomRows } = await admin
    .from('rooms')
    .select('id')
    .eq('created_by', user.id);

  const createdRoomIds = (createdRoomRows ?? []).map((r) => (r as { id: string }).id);

  // 両方を合わせてユニークな ID リスト
  const allRoomIds = [...new Set([...memberRoomIds, ...createdRoomIds])];

  if (allRoomIds.length === 0) {
    return NextResponse.json({ rooms: [], memberRoomIds: [] });
  }

  // ルーム情報を取得
  const { data: rooms } = await admin
    .from('rooms')
    .select('*')
    .in('id', allRoomIds)
    .order('last_message_at', { ascending: false });

  return NextResponse.json({ rooms: rooms ?? [], memberRoomIds });
}
