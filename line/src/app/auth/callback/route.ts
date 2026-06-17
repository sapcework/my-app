import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// メール確認リンクの戻り先。code を session に交換して cookie を確立し /rooms へ。
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/rooms';
  const dest = next.startsWith('/') ? next : '/rooms'; // オープンリダイレクト防止

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  // 失敗時はエラー表示付きでログインへ
  return NextResponse.redirect(new URL('/login?confirm=failed', req.url));
}
