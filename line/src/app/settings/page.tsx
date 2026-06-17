'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/ui/Avatar';
import { BottomNav } from '@/components/ui/BottomNav';
import { requestNotificationPermission, subscribeToPush } from '@/lib/notifications';
import { APP_INFO, appVersionLabel, appCopyright, formatBuildDate } from '@/lib/appInfo';
import { Theme, getStoredTheme, applyTheme } from '@/lib/theme';

export default function SettingsPage() {
  const router = useRouter();
  const { profile, loading, signOut } = useAuth();
  const { uploadAvatar, updateDisplayName } = useProfile(profile?.id ?? null);
  const [displayName, setDisplayName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => { setTheme(getStoredTheme()); }, []);
  const handleTheme = (t: Theme) => { setTheme(t); applyTheme(t); };
  const [avatarError, setAvatarError] = useState('');
  const [notifStatus, setNotifStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ページ表示時にブラウザの実際の許可状態を反映
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') setNotifStatus('granted');
    else if (Notification.permission === 'denied') setNotifStatus('denied');
  }, []);

  const handleEnableNotification = async () => {
    setNotifStatus('requesting');
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') { setNotifStatus('denied'); return; }
    const sub = await subscribeToPush();
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });
      setNotifStatus('granted');
    } else {
      setNotifStatus('denied');
    }
  };

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name);
  }, [profile]);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
  }, [loading, profile, router]);

  if (loading || !profile) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><span className="text-gray-400">読み込み中...</span></div>;
  }

  const displayUser = {
    display_name: displayName || profile.display_name,
    avatar_url: previewUrl ?? profile.avatar_url,
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { // 5MB上限
      setAvatarError('画像は5MB以下にしてください');
      return;
    }
    setAvatarError('');
    setPreviewUrl(URL.createObjectURL(file)); // アップロード前のローカルプレビュー
    setUploading(true);
    const url = await uploadAvatar(file);
    if (url) setPreviewUrl(url);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    await updateDisplayName(displayName);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteAccount = async () => {
    if (!confirm('アカウントを削除すると、あなたの送信メッセージやアカウント情報がすべて削除され、元に戻せません。本当に削除しますか？')) return;
    if (!confirm('最終確認：本当にアカウントを削除しますか？')) return;
    setDeleting(true);
    const res = await fetch('/api/account/delete', { method: 'POST' });
    if (res.ok) {
      await signOut();
      window.location.assign('/login'); // セッション破棄後にログインへ
    } else {
      setDeleting(false);
      alert('削除に失敗しました。時間をおいて再度お試しください。');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#121212]">
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <button onClick={() => router.back()} className="text-white text-xl">‹</button>
        <h1 className="text-lg font-bold flex-1">設定</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {/* アバター */}
        <div className="flex flex-col items-center py-8 bg-white dark:bg-[#1e1e1e] mb-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative"
          >
            <Avatar user={displayUser} size="lg" className={uploading ? 'opacity-50' : ''} />
            <span className="absolute bottom-0 right-0 w-7 h-7 bg-[#4CAF50] rounded-full flex items-center justify-center text-white text-sm shadow border-2 border-white">
              {uploading ? '…' : '📷'}
            </span>
          </button>
          {avatarError
            ? <p className="text-xs text-red-500 mt-3">{avatarError}</p>
            : <p className="text-xs text-gray-400 mt-3">タップして変更</p>
          }
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* 表示名 */}
        <div className="bg-white dark:bg-[#1e1e1e] px-4 py-4 mb-3">
          <p className="text-xs text-gray-400 mb-1">表示名</p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-[#4CAF50]"
          />
          <button
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
            className="mt-3 w-full py-2 bg-[#4CAF50] text-white rounded-xl font-medium text-sm disabled:opacity-50"
          >
            {saved ? '保存しました ✓' : saving ? '保存中...' : '保存'}
          </button>
        </div>

        {/* 管理者リンク */}
        {profile.is_admin && (
          <div className="bg-white dark:bg-[#1e1e1e] px-4 py-4 mb-3">
            <button
              onClick={() => router.push('/admin')}
              className="w-full py-3 text-[#4CAF50] font-medium text-sm text-center border border-[#4CAF50]/30 rounded-xl"
            >
              管理者画面
            </button>
          </div>
        )}

        {/* 通知設定 */}
        <div className="bg-white dark:bg-[#1e1e1e] px-4 py-4 mb-3">
          <p className="text-xs text-gray-400 mb-2">プッシュ通知</p>
          <button
            onClick={handleEnableNotification}
            disabled={notifStatus === 'requesting' || notifStatus === 'granted'}
            className="w-full py-3 rounded-xl font-medium text-sm disabled:opacity-50 border border-[#4CAF50]/30 text-[#4CAF50]"
          >
            {notifStatus === 'granted' ? '通知が有効化されています' :
             notifStatus === 'denied' ? '通知が拒否されています（端末設定から変更）' :
             notifStatus === 'requesting' ? '許可を確認中...' :
             '通知を有効にする'}
          </button>
        </div>

        {/* テーマ */}
        <div className="bg-white dark:bg-[#1e1e1e] px-4 py-4 mb-3">
          <p className="text-xs text-gray-400 mb-2">テーマ</p>
          <div className="flex gap-2">
            {([['light','ライト'],['dark','ダーク'],['system','端末に合わせる']] as [Theme, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => handleTheme(val)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  theme === val
                    ? 'bg-[#4CAF50] text-white border-[#4CAF50]'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* アプリ情報 */}
        <div className="bg-white dark:bg-[#1e1e1e] mb-3">
          <p className="text-xs text-gray-400 px-4 pt-4 pb-1">アプリ情報</p>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-600">バージョン</span>
            <span className="text-sm text-gray-400">{appVersionLabel}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-600">ビルド</span>
            <span className="text-sm text-gray-400">{APP_INFO.commit}{formatBuildDate() && ` · ${formatBuildDate()}`}</span>
          </div>
          <a href={`mailto:${APP_INFO.contactEmail}`} className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-600">お問い合わせ</span>
            <span className="text-gray-300">›</span>
          </a>
        </div>

        {/* ログアウト */}
        <div className="bg-white dark:bg-[#1e1e1e] px-4 py-4">
          <button
            onClick={signOut}
            className="w-full py-3 text-red-500 font-medium text-sm text-center"
          >
            ログアウト
          </button>
        </div>

        {/* アカウント削除（危険ゾーン） */}
        <div className="px-4 py-4 mt-2">
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="w-full py-3 text-xs text-gray-400 text-center underline disabled:opacity-50"
          >
            {deleting ? '削除中...' : 'アカウントを削除（退会）'}
          </button>
        </div>

        {/* フッター（アプリ名・バージョン・著作権） */}
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">{APP_INFO.name} {appVersionLabel}</p>
          <p className="text-[10px] text-gray-300 mt-1">{appCopyright}</p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
