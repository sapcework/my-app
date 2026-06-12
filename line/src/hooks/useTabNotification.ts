'use client';

import { useEffect, useRef, useCallback } from 'react';

export function useTabNotification() {
  const countRef = useRef(0);
  const baseTitleRef = useRef('LINE Chat');

  useEffect(() => {
    const handleFocus = () => { // タブがフォーカスされたらリセット
      countRef.current = 0;
      document.title = baseTitleRef.current;
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.title = baseTitleRef.current;
    };
  }, []);

  const setBaseTitle = useCallback((title: string) => {
    baseTitleRef.current = title;
    document.title = title;
  }, []);

  const notify = useCallback(() => {
    if (document.hasFocus()) return; // フォーカス中は通知不要
    countRef.current += 1;
    document.title = `(${countRef.current}) ${baseTitleRef.current}`;
  }, []);

  return { notify, setBaseTitle };
}
