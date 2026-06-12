'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/types';

export function useUserSearch() {
  const supabase = createClient();
  const [searching, setSearching] = useState(false);

  const searchByEmail = async (email: string): Promise<User | null> => {
    if (!email.trim()) return null;
    setSearching(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    setSearching(false);
    return data as User | null;
  };

  return { searchByEmail, searching };
}
