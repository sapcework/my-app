import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RoomInvite } from '@/lib/types';

// GET: トークンからルーム情報を取得（参加前プレビュー用）
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from('room_invites')
    .select('*, room:rooms(id, name)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!invite) return NextResponse.json({ error: 'invalid_or_expired' }, { status: 404 });

  const inv = invite as RoomInvite & { room: { id: string; name: string } };
  return NextResponse.json({ roomId: inv.room_id, roomName: inv.room.name, expiresAt: inv.expires_at });
}

// POST: トークンでルームに参加
export async function POST(req: NextRequest) {
  const body = await req.json() as { token: unknown };
  if (typeof body.token !== 'string' || !body.token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
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

  // トークン検証
  const { data: invite } = await admin
    .from('room_invites')
    .select('room_id')
    .eq('token', body.token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!invite) return NextResponse.json({ error: 'invalid_or_expired' }, { status: 404 });

  const { room_id } = invite as { room_id: string };

  // 既にメンバーなら room_id だけ返す
  const { data: existing } = await admin
    .from('room_members')
    .select('room_id')
    .eq('room_id', room_id)
    .eq('user_id', user.id)
    .single();

  if (existing) return NextResponse.json({ roomId: room_id, alreadyMember: true });

  // メンバー追加（admin クライアントで RLS バイパス）
  const { error } = await admin
    .from('room_members')
    .insert({ room_id, user_id: user.id, role: 'member' });

  if (error) return NextResponse.json({ error: 'join_failed' }, { status: 500 });

  return NextResponse.json({ roomId: room_id });
}
