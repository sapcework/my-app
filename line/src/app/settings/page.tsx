'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/ui/Avatar';
import { BottomNav } from '@/components/ui/BottomNav';

export default function SettingsPage() {
  const router = useRouter();
  const { profile, loading, signOut } = useAuth();
  const { uploadAvatar, updateDisplayName } = useProfile(profile?.id ?? null);
  const [displayName, setDisplayName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name);
  }, [profile]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-screen"><span className="text-gray-400">読み込み中...</span></div>;
  }
  if (!profile) { router.push('/login'); return null; }

  const displayUser = {
    display_name: displayName || profile.display_name,
    avatar_url: previewUrl ?? profile.avatar_url,
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-[#4CAF50] text-white flex items-center gap-3 px-4 py-3 pt-safe shadow-sm flex-shrink-0">
        <button onClick={() => router.back()} className="text-white text-xl">‹</button>
        <h1 className="text-lg font-bold flex-1">設定</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {/* アバター */}
        <div className="flex flex-col items-center py-8 bg-white mb-3">
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
          <p className="text-xs text-gray-400 mt-3">タップして変更</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* 表示名 */}
        <div className="bg-white px-4 py-4 mb-3">
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

        {/* ログアウト */}
        <div className="bg-white px-4 py-4">
          <button
            onClick={signOut}
            className="w-full py-3 text-red-500 font-medium text-sm text-center"
          >
            ログアウト
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
