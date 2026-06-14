import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { PushSubscriptionData } from '@/lib/notifications';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? '',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
);

interface WebhookPayload {
  type: string;
  table: string;
  record: {
    id: string;
    room_id: string;
    sender_id: string;
    content: string;
    type: string;
  };
}

export async function POST(req: NextRequest) {
  // Supabase webhookシークレット検証
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const payload = await req.json() as WebhookPayload;
  if (payload.type !== 'INSERT' || payload.table !== 'messages') {
    return NextResponse.json({ ok: true });
  }

  const msg = payload.record;
  const supabase = createAdminClient();

  // ルーム名取得
  const { data: room } = await supabase
    .from('rooms').select('name').eq('id', msg.room_id).single();
  const title = (room as { name: string } | null)?.name ?? '新着メッセージ';

  // 本文プレビュー
  const body =
    msg.type === 'stamp' ? 'スタンプ' :
    msg.type === 'image' ? '画像' :
    msg.content.length > 40 ? msg.content.slice(0, 40) + '…' : msg.content;

  // 送信者以外のメンバーのPush購読を取得
  const { data: members } = await supabase
    .from('room_members').select('user_id')
    .eq('room_id', msg.room_id).neq('user_id', msg.sender_id);

  if (!members?.length) return NextResponse.json({ ok: true });

  const memberIds = (members as { user_id: string }[]).map((m) => m.user_id);
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription').in('user_id', memberIds);

  if (!subs?.length) return NextResponse.json({ ok: true });

  const pushPayload = JSON.stringify({ title, body, roomId: msg.room_id });

  await Promise.allSettled(
    (subs as { subscription: PushSubscriptionData }[]).map((row) =>
      webpush.sendNotification(
        row.subscription as unknown as webpush.PushSubscription,
        pushPayload
      )
    )
  );

  return NextResponse.json({ ok: true });
}
