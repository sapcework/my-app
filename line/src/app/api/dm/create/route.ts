import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST: 相手ユーザーとの1対1トーク（DM）を開く。
//   既に2人のDMルームがあればそれを返し、無ければ新規作成する（find-or-create）。
export async function POST(req: NextRequest) {
  const body = await req.json() as { otherUserId: unknown };
  if (typeof body.otherUserId !== 'string' || !UUID_RE.test(body.otherUserId)) {
    return NextResponse.json({ error: 'invalid_user' }, { status: 400 });
  }
  const otherUserId = body.otherUserId;

  // 認証確認（呼び出し元）
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (otherUserId === user.id) { // 自分自身とのDMは不可
    return NextResponse.json({ error: 'cannot_dm_self' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 相手ユーザーの実在確認
  const { data: target } = await admin
    .from('users')
    .select('id')
    .eq('id', otherUserId)
    .single();
  if (!target) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  // 参加者2人を昇順連結した正規化キー（rooms.dm_key の部分ユニークインデックスと一致）
  const dmKey = [user.id, otherUserId].sort().join(':');

  // 既存DMの検索：dm_key で一意に特定
  const { data: existingRoom } = await admin
    .from('rooms')
    .select('*')
    .eq('is_dm', true)
    .eq('dm_key', dmKey)
    .maybeSingle();
  if (existingRoom) {
    return NextResponse.json({ room: existingRoom, existing: true }); // 既存トークを再利用
  }

  // 新規DMルーム作成（name は空文字。表示名は相手から動的解決する）
  const { data: room, error: roomError } = await admin
    .from('rooms')
    .insert({ name: '', created_by: user.id, is_dm: true, dm_key: dmKey })
    .select()
    .single();

  if (roomError || !room) {
    // 23505 = unique_violation（同時作成の競合）→ 相手プロセスが作成済みのはずなので取り直す
    if ((roomError as { code?: string } | null)?.code === '23505') {
      const { data: raced } = await admin
        .from('rooms').select('*').eq('is_dm', true).eq('dm_key', dmKey).single();
      if (raced) return NextResponse.json({ room: raced, existing: true });
    }
    return NextResponse.json({ error: roomError?.message ?? 'failed' }, { status: 500 });
  }

  // 2人をメンバー追加（DMではロール差はないため両者 member）
  const { error: membersError } = await admin
    .from('room_members')
    .insert([
      { room_id: room.id, user_id: user.id, role: 'member' },
      { room_id: room.id, user_id: otherUserId, role: 'member' },
    ]);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  return NextResponse.json({ room, existing: false });
}
