import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { GlobalNotificationProvider } from '@/components/ui/GlobalNotificationProvider';

export const metadata: Metadata = {
  title: 'LINE Chat',
  description: 'LINE風リアルタイムチャット',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LINE Chat',
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
