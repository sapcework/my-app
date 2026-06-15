import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET: ルームの全メンバーを取得（adminクライアントでRLSバイパス）
export async function GET(
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

  // 呼び出し元がメンバーかチェック
  const { data: membership } = await admin
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single();

  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // 全メンバーをユーザー情報付きで取得
  const { data, error } = await admin
    .from('room_members')
    .select('role, joined_at, users(id, display_name, avatar_url, email, last_seen, created_at)')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });

  return NextResponse.json({ members: data ?? [], myRole: (membership as { role: string }).role });
}
