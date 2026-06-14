import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { PushSubscriptionData } from '@/lib/notifications';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// VAPID未設定時は起動時に警告（サイレントフェイル防止）
const vapidEmail = process.env.VAPID_EMAIL;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidEmail && vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

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
  // Webhookシークレット必須検証（未設定時は全拒否）
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // VAPIDクレデンシャル確認
  if (!vapidEmail || !vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 });
  }

  const payload = await req.json() as WebhookPayload;
  if (payload.type !== 'INSERT' || payload.table !== 'messages') {
    return NextResponse.json({ ok: true });
  }

  const msg = payload.record;

  // UUIDバリデーション（不正な値でDBクエリしない）
  if (!UUID_RE.test(msg.room_id) || !UUID_RE.test(msg.sender_id)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

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
    .from('push_subscriptions').select('endpoint, subscription').in('user_id', memberIds);

  if (!subs?.length) return NextResponse.json({ ok: true });

  const pushPayload = JSON.stringify({ title, body, roomId: msg.room_id });

  await Promise.allSettled(
    (subs as { endpoint: string; subscription: PushSubscriptionData }[]).map(async (row) => {
      try {
        await webpush.sendNotification(
          row.subscription as unknown as webpush.PushSubscription,
          pushPayload
        );
      } catch (err) {
        // 410 = 購読が無効（再起動後など）→ DBから削除してクリーンアップ
        if ((err as { statusCode?: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        }
      }
    })
  );

  return NextResponse.json({ ok: true });
}
