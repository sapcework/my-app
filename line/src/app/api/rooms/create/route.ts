import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST: ルームを作成し、メンバーを追加（admin クライアントで RLS バイパス）
export async function POST(req: NextRequest) {
  const body = await req.json() as { name: unknown; memberIds: unknown };
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  const memberIds = Array.isArray(body.memberIds)
    ? (body.memberIds as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // ルーム作成
  const { data: room, error: roomError } = await admin
    .from('rooms')
    .insert({ name: body.name.trim(), created_by: user.id })
    .select()
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  // メンバー追加（作成者は owner）
  const allIds = [...new Set([user.id, ...memberIds])];
  const members = allIds.map((uid) => ({
    room_id: (room as { id: string }).id,
    user_id: uid,
    role: uid === user.id ? 'owner' : 'member',
  }));

  const { error: memberError } = await admin.from('room_members').insert(members);

  if (memberError) {
    // メンバー追加に失敗したらルームごと削除してロールバック
    await admin.from('rooms').delete().eq('id', (room as { id: string }).id);
    return NextResponse.json({ error: 'member_failed' }, { status: 500 });
  }

  return NextResponse.json({ room });
}
