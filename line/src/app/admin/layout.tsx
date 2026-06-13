'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!profile || !profile.is_admin)) {
      router.push('/rooms');
    }
  }, [loading, profile, router]);

  if (loading || !profile?.is_admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400 text-sm">読み込み中...</span>
      </div>
    );
  }

  return <>{children}</>;
}
