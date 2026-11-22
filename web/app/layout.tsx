import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';

const plexAr = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-ar',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'WatcherX · نرى الخطر قبل وقوعه',
  description: 'عرض تجريبي لوكيل WatcherX للتنبؤ بالحوادث الأمنية وتخطيط الدوريات في المدن الصناعية. بيانات افتراضية.',
  icons: { icon: '/brand/watcherx-app-icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plexAr.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
