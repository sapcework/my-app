'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  params: Promise<{ token: string }>;
}

export default function JoinPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const [roomName, setRoomName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'error' | 'expired'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch(`/api/rooms/join?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const d = await res.json() as { roomId?: string; roomName?: string; expiresAt?: string; error?: string };
        if (!res.ok) {
          setStatus(d.error === 'invalid_or_expired' ? 'expired' : 'error');
          setErrorMsg(d.error ?? '');
          return;
        }
        setRoomName(d.roomName ?? '');
        setExpiresAt(d.expiresAt ?? '');
        setStatus('ready');
      })
      .catch(() => { setStatus('error'); setErrorMsg('通信エラーが発生しました。'); });
  }, [token]);

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.status === 401) {
        router.push(`/login?redirect=/join/${token}`);
        return;
      }

      let d: { roomId?: string; error?: string } = {};
      try { d = await res.json() as typeof d; } catch { /* empty body */ }

      if (res.ok && d.roomId) {
        router.push(`/rooms/${d.roomId}`);
        return;
      }

      const msg = d.error === 'invalid_or_expired'
        ? '招待リンクが無効または期限切れです。'
        : d.error === 'join_failed'
        ? 'サーバーエラーが発生しました。しばらく後に再試行してください。'
        : '参加に失敗しました。';
      setErrorMsg(msg);
      setStatus('error');
    } catch {
      setErrorMsg('通信エラーが発生しました。');
      setStatus('error');
    }
  };

  const formatExpiry = (iso: string) =>
    new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#4CAF50] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-white text-4xl font-black">L</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">LINE Chat</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {status === 'loading' && (
            <p className="text-center text-gray-400 text-sm py-4">確認中...</p>
          )}

          {(status === 'ready' || status === 'joining') && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {roomName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{roomName}</p>
                  <p className="text-xs text-gray-400">グループトーク</p>
                </div>
              </div>
              {expiresAt && (
                <p className="text-xs text-gray-400 text-center mb-4">
                  有効期限: {formatExpiry(expiresAt)}
                </p>
              )}
              <button
                onClick={handleJoin}
                disabled={status === 'joining'}
                className="w-full py-3 bg-[#4CAF50] text-white font-bold rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
              >
                {status === 'joining' ? '参加中...' : `「${roomName}」に参加する`}
              </button>
            </>
          )}

          {status === 'expired' && (
            <div className="text-center py-2">
              <p className="text-gray-500 text-sm mb-1">招待リンクが無効または期限切れです。</p>
              <p className="text-xs text-gray-400">新しいリンクを発行してもらってください。</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4 space-y-3">
              <p className="text-red-500 text-sm">{errorMsg || 'エラーが発生しました。'}</p>
              <button
                onClick={() => { setStatus('ready'); setErrorMsg(''); }}
                className="text-xs text-[#4CAF50]"
              >
                再試行
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/rooms')}
          className="mt-4 w-full text-center text-sm text-[#4CAF50]"
        >
          トーク一覧に戻る
        </button>
      </div>
    </div>
  );
}
