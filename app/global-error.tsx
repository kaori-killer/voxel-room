'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/monitoring';

export type GlobalErrorProps = {
  error: Error & { digest?: string };
};

/**
 * layout·Providers 까지 깨져 어떤 페이지도 못 뜨는 상황의 최종 안전망.
 * 루트 레이아웃 밖에서 렌더되어 globals.css·폰트가 없으므로 스타일을 인라인으로 둔다.
 */
export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '32px 20px',
          background: '#edeff7',
          color: '#191c2a',
          fontFamily: 'system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 26, margin: '0 0 12px' }}>문제가 발생했어요</h1>
          <p style={{ color: '#464c64', lineHeight: 1.7, margin: 0 }}>
            잠시 후 다시 접속해 주세요.
          </p>
        </div>
      </body>
    </html>
  );
}
