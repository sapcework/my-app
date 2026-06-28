import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import { StorageProviderComponent } from '@/context/StorageContext'
import { PasscodeProvider } from '@/context/PasscodeContext'
import { ConfirmDialogHost } from '@/components/ConfirmDialogHost'
import { ToastHost } from '@/components/ToastHost'
import { PWARegister } from '@/components/PWARegister'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'SimpleNote',
  description: 'Offline-first note app',
  manifest: '/manifest.webmanifest', // PWA マニフェスト（public配下の静的ファイル）
  // PWA: iOS でもホーム画面追加時に全画面アプリ化
  appleWebApp: { capable: true, title: 'SimpleNote', statusBarStyle: 'default' },
  icons: { apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  themeColor: '#3b82f6', // ステータスバー等の配色（blue-500）
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // 描画前に localStorage のテーマを反映し、ダーク時の白フラッシュを防ぐ
  const themeScript = `(function(){try{var t=localStorage.getItem('simplenote-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full bg-white dark:bg-gray-950">
        <PasscodeProvider>
          <AuthProvider>
            <StorageProviderComponent>{children}</StorageProviderComponent>
            <ConfirmDialogHost />
            <ToastHost />
            <PWARegister />
          </AuthProvider>
        </PasscodeProvider>
      </body>
    </html>
  )
}
