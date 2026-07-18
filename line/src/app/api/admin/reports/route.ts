import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 呼び出し元が管理者か検証（reports は RLS デフォルト拒否のため service role 経由必須）
async function requireAdmin(admin: SupabaseClient): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: me } = await admin.from('users').select('is_admin').eq('id', user.id).single();
  return !!(me as { is_admin: boolean } | null)?.is_admin;
}

// GET: 通報一覧（通報者・通報対象ユーザーをjoinして返す）
export async function GET() {
  const admin = createAdminClient();
  if (!(await requireAdmin(admin))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data, error } = await admin
    .from('reports')
    .select('*, reporter:users!reports_reporter_id_fkey(id, display_name, email), reported_user:users!reports_reported_user_id_fkey(id, display_name, email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}

// PATCH: 通報のステータス変更（open <-> resolved）
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { reportId: unknown; status: unknown };
  if (typeof body.reportId !== 'string' || !UUID_RE.test(body.reportId)) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 });
  }
  if (body.status !== 'open' && body.status !== 'resolved') {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await requireAdmin(admin))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error } = await admin
    .from('reports')
    .update({ status: body.status })
    .eq('id', body.reportId);

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
