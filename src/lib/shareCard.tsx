/* eslint-disable @next/next/no-img-element -- ImageResponse(Satori)는 next/image 를 지원하지 않아 <img> 가 필수 */
import { ImageResponse } from 'next/og';
import { cubeDataUri } from './brandMark';

export const shareCardSize = { width: 1200, height: 630 };
export const shareCardContentType = 'image/png';
export const shareCardAlt = '복셀 공방 — 사진으로 만드는 내 방';

/**
 * 홈·기본 링크 공유 카드. 방 페이지는 방 썸네일이 있으면 그걸 우선 쓰고,
 * 없으면 이 카드로 폴백된다. 한글 텍스트는 og:title 이 담당하므로
 * 이미지에는 폰트 의존이 없는 라틴 워드마크만 둔다.
 */
export function renderShareCard(): ImageResponse {
  const cube = cubeDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
          background: 'linear-gradient(135deg, #f3ede1 0%, #ded2be 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
          <img width={150} height={150} src={cube} alt="" style={{ opacity: 0.85 }} />
          <img width={300} height={300} src={cube} alt="" />
          <img width={150} height={150} src={cube} alt="" style={{ opacity: 0.85 }} />
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 14,
            color: '#b4650c',
          }}
        >
          VOXEL WORKSHOP
        </div>
      </div>
    ),
    shareCardSize,
  );
}
