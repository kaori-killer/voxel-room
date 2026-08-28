import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Jua } from 'next/font/google';
import { GoogleAnalytics } from '@/features/analytics/GoogleAnalytics';
import { getSiteOrigin } from '@/lib/url';
import './globals.css';

/**
 * next/font 가 빌드 시점에 폰트를 받아 같은 도메인(/_next)에서 자체 호스팅한다.
 * 외부 CDN(fonts.googleapis.com) 연결 비용과 렌더 차단 stylesheet 를 없애고,
 * display: swap 으로 폰트 로드가 첫 렌더를 막지 않게 한다. (빌드 시 네트워크 필요)
 */
const bodyFont = IBM_Plex_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});
const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});
const displayFont = Jua({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

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
    <html
      lang="ko"
      className={`${bodyFont.variable} ${monoFont.variable} ${displayFont.variable}`}
    >
      <body>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
