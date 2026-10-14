import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import { themeInitScript, THEME_STORAGE_KEY } from '@/lib/themeScript';
import { cookies } from 'next/headers';
import { AuthProvider } from '@/lib/authContext';
import FamilyAlertBanner from '@/components/FamilyAlertBanner';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import AppUpdateNotifier from '@/components/AppUpdateNotifier';
import GlobalNotificationListener from '@/components/GlobalNotificationListener';

export const metadata: Metadata = {
  title: 'Dar | Espace Familial',
  description: 'Portail familial privé et partagé.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dar',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ee7318',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const themePref = cookieStore.get(THEME_STORAGE_KEY)?.value;
  const isDark = themePref === 'dark';

  return (
    <html
      lang="fr"
      className={`h-full ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-gray-50 text-gray-900'}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="h-full flex flex-col max-w-lg mx-auto bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-xl min-h-screen relative pb-36 transition-colors duration-200">
        <AuthProvider>
          <ServiceWorkerRegister />
          <AppUpdateNotifier />
          <GlobalNotificationListener />
          <FamilyAlertBanner />
          <main className="flex-1">{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
