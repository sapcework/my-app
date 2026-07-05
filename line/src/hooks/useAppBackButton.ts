'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// ルート画面（これ以上戻ると終了になる画面）
const ROOT_PATHS = new Set(['/rooms', '/login']);

// 「戻る」捕捉用の履歴エントリを最上位に積む（URLは現在画面のまま、目印だけ足す）
const armGuard = () =>
  window.history.pushState({ ...window.history.state, __appExitGuard: true }, '');

// ルート画面（トーク一覧・ログイン）でのみ「もう一度戻ると終了」を挟み、誤終了を防ぐ。
// サブ画面はNext.jsの標準の戻る（キャッシュからの高速復元）に任せる。
// ⚠️ サブ画面まで戻るを毎回横取りして router.replace() し直すと、
//    Next.jsの高速復元が使われず毎回データ再取得が走り「戻るが遅い」原因になるため、
//    横取りはルート画面の二重終了防止だけに限定すること。
export function useAppBackButton() {
  const pathname = usePathname();
  const isRootRef = useRef(false);
  const exitArmedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showExitToast, setShowExitToast] = useState(false);

  // 画面が変わるたび、ルート画面かどうかを控え、ルート画面なら捕捉用の履歴を積む
  useEffect(() => {
    isRootRef.current = ROOT_PATHS.has(pathname);
    if (isRootRef.current) armGuard();
  }, [pathname]);

  useEffect(() => {
    const onPop = () => {
      if (!isRootRef.current) return; // サブ画面は素通り（標準の戻るに任せる）

      // ルート画面：もう一度戻ると終了
      if (exitArmedRef.current) {
        exitArmedRef.current = false;
        setShowExitToast(false);
        clearTimeout(exitTimerRef.current);
        window.removeEventListener('popstate', onPop); // 捕捉をやめて…
        window.history.back(); // …本当に戻す（アプリ終了）
        return;
      }
      exitArmedRef.current = true;
      setShowExitToast(true);
      exitTimerRef.current = setTimeout(() => {
        exitArmedRef.current = false;
        setShowExitToast(false);
      }, 2000);
      armGuard(); // 再武装して留まる
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return { showExitToast };
}
