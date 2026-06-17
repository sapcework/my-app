import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { GlobalNotificationProvider } from '@/components/ui/GlobalNotificationProvider';
import { APP_INFO } from '@/lib/appInfo';

export const metadata: Metadata = {
  title: APP_INFO.name,
  description: 'リアルタイムチャット',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_INFO.name,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4CAF50',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* チラつき防止：描画前にテーマを適用 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="h-full antialiased">
        <AuthProvider>
          <GlobalNotificationProvider />
          {children}
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
