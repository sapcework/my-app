'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// 各画面の「上位（戻り先）」を返す。null はルート＝これ以上戻れない（終了）を意味する
const getParentPath = (pathname: string): string | null => {
  if (pathname === '/rooms') return null; // トーク一覧 → 終了
  if (pathname === '/login') return null; // ログイン → 終了
  if (/^\/rooms\/[^/]+$/.test(pathname)) return '/rooms'; // チャット画面 → トーク一覧
  if (pathname === '/settings') return '/rooms'; // マイページ → トーク一覧
  if (pathname === '/voom') return '/rooms'; // タブ → トーク一覧
  if (pathname === '/news') return '/rooms'; // タブ → トーク一覧
  if (pathname === '/wallet') return '/rooms'; // タブ → トーク一覧
  if (/^\/admin\/rooms\/[^/]+\/messages$/.test(pathname)) return '/admin/rooms'; // メッセージ監視 → ルーム一覧
  if (pathname === '/admin/rooms') return '/admin'; // 管理者ルーム一覧 → ダッシュボード
  if (pathname === '/admin/users') return '/admin'; // 管理者ユーザー一覧 → ダッシュボード
  if (pathname === '/admin') return '/rooms'; // 管理者ダッシュボード → トーク一覧
  if (/^\/join\/[^/]+$/.test(pathname)) return '/rooms'; // 招待参加 → トーク一覧
  return '/rooms'; // 不明なパスはトーク一覧へ
};

// 「戻る」捕捉用の履歴エントリを最上位に積む（URLは現在画面のまま、目印だけ足す）
const armGuard = () =>
  window.history.pushState({ ...window.history.state, __appBackGuard: true }, '');

// Android/ブラウザの「戻る」を、履歴の逆再生ではなく画面の上位へたどる動きに変える。
// ルート画面（トーク一覧・ログイン）では「もう一度戻ると終了」を挟み、誤終了を防ぐ。
export function useAppBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname); // 「戻る」を押した瞬間にいた画面を参照するため
  const exitArmedRef = useRef(false); // ルート画面で一度戻るが押された状態か
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showExitToast, setShowExitToast] = useState(false);

  // 画面が変わるたび、現在地を控え、最上位に捕捉用の履歴を積み直す
  useEffect(() => {
    pathRef.current = pathname;
    armGuard();
  }, [pathname]);

  useEffect(() => {
    const onPop = () => {
      const parent = getParentPath(pathRef.current);

      if (parent === null) {
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
        return;
      }

      // サブ画面／トップタブ：上位画面へ（履歴の逆再生はしない）
      router.replace(parent); // pathname 変化で上のuseEffectが再武装する
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [router]);

  return { showExitToast };
}
