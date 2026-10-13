import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Dar | Espace Familial',
  description: 'Portail familial privé et partagé.',
  manifest: '/manifest.json',
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

import { AuthProvider } from '@/lib/authContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full bg-gray-50">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="h-full flex flex-col max-w-lg mx-auto bg-white shadow-xl min-h-screen relative pb-36">
        <AuthProvider>
          <main className="flex-1">{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
