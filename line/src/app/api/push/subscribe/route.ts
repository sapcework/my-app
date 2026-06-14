import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { PushSubscriptionData } from '@/lib/notifications';

function isValidSubscription(sub: unknown): sub is PushSubscriptionData {
  if (!sub || typeof sub !== 'object') return false;
  const s = sub as Record<string, unknown>;
  return (
    typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') &&
    typeof s.keys === 'object' && s.keys !== null &&
    typeof (s.keys as Record<string, unknown>).p256dh === 'string' &&
    typeof (s.keys as Record<string, unknown>).auth === 'string'
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { subscription: unknown };

  if (!isValidSubscription(body.subscription)) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  const subscription = body.subscription;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint: subscription.endpoint, subscription },
      { onConflict: 'endpoint' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
