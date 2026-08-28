import type { Metadata, Viewport } from 'next';
import { GoogleAnalytics } from '@/features/analytics/GoogleAnalytics';
import { getSiteOrigin } from '@/lib/url';
import './globals.css';

/**
 * next/font 는 빌드 시점에 Google Fonts 를 받아 온다. 네트워크가 막힌 곳에서는
 * 빌드 자체가 실패하므로, 어디서든 빌드되도록 스타일시트로 받는다.
 * 폰트를 자체 호스팅하게 되면 next/font/local 로 바꾼다.
 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Jua&display=swap';

const TITLE = '복셀 공방 — 사진으로 만드는 내 방';
const DESCRIPTION =
  '사진 한 장을 복셀 3D 오브제로 깎아 내 방에 놓고 꾸밉니다. 캐릭터로 걸어 다니고, 전등을 켜고, 피아노를 치고, 링크로 방을 나눌 수 있습니다.';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: { default: TITLE, template: '%s · 복셀 공방' },
  description: DESCRIPTION,
  applicationName: '복셀 공방',
  keywords: ['복셀', '3D', '방꾸미기', '픽셀아트', 'voxel', 'room'],
  openGraph: {
    type: 'website',
    siteName: '복셀 공방',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'ko_KR',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3ede1' },
    { media: '(prefers-color-scheme: dark)', color: '#101320' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
