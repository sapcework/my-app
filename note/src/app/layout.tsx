import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import { StorageProviderComponent } from '@/context/StorageContext'
import { PasscodeProvider } from '@/context/PasscodeContext'
import { ConfirmDialogHost } from '@/components/ConfirmDialogHost'
import { ToastHost } from '@/components/ToastHost'
import { PWARegister } from '@/components/PWARegister'
import { InstallPrompt } from '@/components/InstallPrompt'
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
  metadataBase: new URL('https://myluminote.vercel.app'),
  title: 'LumiNote',
  applicationName: 'LumiNote',
  description: 'オフラインでも使えるシンプルなメモアプリ。クラウド同期・パスコード暗号化対応。',
  manifest: '/manifest.webmanifest', // PWA マニフェスト（public配下の静的ファイル）
  // PWA: iOS でもホーム画面追加時に全画面アプリ化
  appleWebApp: { capable: true, title: 'LumiNote', statusBarStyle: 'default' },
  icons: { apple: '/icon-192.png' },
  openGraph: {
    title: 'LumiNote',
    description: 'オフラインでも使えるシンプルなメモアプリ',
    url: '/',
    siteName: 'LumiNote',
    locale: 'ja_JP',
    type: 'website',
  },
}

export const viewport: Viewport = {
  // ステータスバー等をアプリ背景と揃える（ライト/ダークで切替）
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f17' },
  ],
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
            <InstallPrompt />
          </AuthProvider>
        </PasscodeProvider>
      </body>
    </html>
  )
}
