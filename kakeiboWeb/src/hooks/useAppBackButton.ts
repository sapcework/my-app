import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { showToast } from '../store/toastStore'

// 各画面の「上位（戻り先）」を返す。null はホーム＝これ以上戻れない（終了）を意味する
const getParentPath = (pathname: string): string | null => {
  if (pathname === '/') return null                                 // ホーム → 終了
  if (pathname === '/expenses') return '/'                          // 支出一覧 → ホーム
  if (pathname === '/table') return '/'                             // 表 → ホーム
  if (pathname === '/stats') return '/'                             // 統計 → ホーム
  if (pathname === '/settings') return '/'                          // 設定 → ホーム
  if (pathname === '/expenses/new') return '/expenses'             // 追加 → 支出一覧
  if (/^\/expenses\/[^/]+\/edit$/.test(pathname)) return '/expenses' // 編集 → 支出一覧
  if (pathname === '/categories') return '/settings'               // カテゴリ → 設定
  if (pathname === '/budget') return '/settings'                   // 予算 → 設定
  if (pathname === '/recurring') return '/settings'                // 定期 → 設定
  return '/'                                                        // 不明なパスはホームへ
}

// 「戻る」捕捉用の履歴エントリを最上位に積む。
// React Router が持つ state（idx/key など）は残したまま目印だけ足す（idx破壊を防ぐ）
const armGuard = () =>
  window.history.pushState({ ...window.history.state, __kkBackGuard: true }, '') // URL は現在画面のまま

// Android/ブラウザの「戻る」を、履歴の逆再生ではなく画面の上位へたどる動きに変える。
// ホームでは「もう一度戻ると終了」の確認を挟み、誤終了を防ぐ。
export const useAppBackButton = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef(location.pathname) // 「戻る」を押した瞬間にいた画面を参照するため
  const exitArmedRef = useRef(false)        // ホームで一度戻るが押された状態か
  const exitTimerRef = useRef<number | undefined>(undefined)

  // 画面が変わるたび、現在地を控え、最上位に捕捉用の履歴を積み直す（戻る＝これが pop されて発火する）
  useEffect(() => {
    pathRef.current = location.pathname
    armGuard()
  }, [location.pathname])

  useEffect(() => {
    const onPop = () => {
      const parent = getParentPath(pathRef.current) // 今いる画面の上位を求める

      if (parent === null) {
        // ホーム：もう一度戻ると終了
        if (exitArmedRef.current) {
          exitArmedRef.current = false
          window.clearTimeout(exitTimerRef.current)
          window.removeEventListener('popstate', onPop) // 捕捉をやめて…
          window.history.back()                         // …本当に戻す（アプリ終了）
          return
        }
        exitArmedRef.current = true
        showToast({ message: 'もう一度戻ると終了します' }, 2000)
        exitTimerRef.current = window.setTimeout(() => { exitArmedRef.current = false }, 2000)
        armGuard() // 再武装して留まる
        return
      }

      // サブ画面／トップタブ：上位画面へ（履歴の逆再生はしない）
      navigate(parent, { replace: true }) // pathname 変化で上記 useEffect が再武装する
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [navigate])
}
