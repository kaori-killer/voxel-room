import * as Sentry from '@sentry/nextjs';

/**
 * 에러 리포팅 경계. DSN 이 없으면 Sentry SDK 가 알아서 no-op 이므로 호출부는 켜짐 여부를 모른다.
 * 렌더/전역 미처리 예외는 SDK 가 자동 후킹하고, 여기 함수들은 계획서의 "명시적 캡쳐" 지점에 쓴다.
 * logger 와 달리 이 모듈은 @sentry/nextjs(=Next 의존)를 끌어오므로 app·api 경계에서만 import 한다.
 */

/** path 안 방/식별자 segment 를 :id 로 치환해 이슈가 URL 별로 흩어지지 않게 묶는다. */
export function normalizePath(path: string): string {
  const pathname = path.split('?')[0] ?? path;
  return pathname.replace(/\/[A-Za-z0-9_-]{6,}(?=\/|$)/g, '/:id');
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export type ApiErrorMetaType = {
  path: string;
  status?: number;
};

export function captureApiError(error: unknown, meta: ApiErrorMetaType): void {
  Sentry.captureException(error, {
    tags: { kind: 'api', status: meta.status ?? 'network' },
    extra: { path: normalizePath(meta.path) },
  });
}
