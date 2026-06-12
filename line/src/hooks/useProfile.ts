'use client';

import { createClient } from '@/lib/supabase/client';

export function useProfile(userId: string | null) {
  const supabase = createClient();

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!userId) return null;
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { console.error('avatar upload error:', error); return null; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`; // キャッシュバスター
    await supabase.from('users').update({ avatar_url: url }).eq('id', userId);
    return url;
  };

  const updateDisplayName = async (name: string): Promise<boolean> => {
    if (!userId || !name.trim()) return false;
    const { error } = await supabase.from('users').update({ display_name: name.trim() }).eq('id', userId);
    return !error;
  };

  return { uploadAvatar, updateDisplayName };
}
