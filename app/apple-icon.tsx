import { ImageResponse } from 'next/og';
import { cubeDataUri } from '@/lib/brandMark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** iOS 홈 화면 아이콘. 투명 배경을 못 쓰므로 브랜드 배경 위에 큐브를 얹는다. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#101320',
        }}
      >
        <img width={132} height={132} src={cubeDataUri()} alt="" />
      </div>
    ),
    size,
  );
}
