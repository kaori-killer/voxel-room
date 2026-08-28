import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '복셀 공방 — 사진으로 만드는 내 방',
    short_name: '복셀 공방',
    description: '사진 한 장을 복셀 3D 오브제로 깎아 내 방에 놓고 꾸밉니다.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3ede1',
    theme_color: '#f3ede1',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  };
}
