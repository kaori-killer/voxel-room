import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import { captureApiError, captureError, normalizePath } from '@/lib/monitoring';

beforeEach(() => captureException.mockClear());

describe('normalizePath', () => {
  it('방·식별자 세그먼트를 :id 로 묶는다', () => {
    expect(normalizePath('/api/rooms/abc123def')).toBe('/api/rooms/:id');
    expect(normalizePath('/api/rooms/abc123/chat/def456')).toBe('/api/rooms/:id/chat/:id');
  });

  it('쿼리스트링은 떼어 낸다', () => {
    expect(normalizePath('/api/rooms/abc123?from=share')).toBe('/api/rooms/:id');
  });

  it('짧은 세그먼트(5자 이하)는 그대로 둔다', () => {
    expect(normalizePath('/api/rooms')).toBe('/api/rooms');
    expect(normalizePath('/api/rooms/abc12/chat')).toBe('/api/rooms/abc12/chat');
  });
});

describe('captureApiError', () => {
  it('status 태그와 정규화 경로로 보고한다', () => {
    const error = new Error('서버 터짐');
    captureApiError(error, { path: '/api/rooms/abc123', status: 500 });

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { kind: 'api', status: 500 },
      extra: { path: '/api/rooms/:id' },
    });
  });

  it('status 가 없으면 network 로 태그한다', () => {
    const error = new Error('offline');
    captureApiError(error, { path: '/api/rooms' });

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { kind: 'api', status: 'network' },
      extra: { path: '/api/rooms' },
    });
  });
});

describe('captureError', () => {
  it('context 가 있으면 extra 로 넘긴다', () => {
    const error = new Error('boom');
    captureError(error, { roomId: 'abc123' });

    expect(captureException).toHaveBeenCalledWith(error, { extra: { roomId: 'abc123' } });
  });

  it('context 가 없으면 두 번째 인자 없이 넘긴다', () => {
    const error = new Error('boom');
    captureError(error);

    expect(captureException).toHaveBeenCalledWith(error, undefined);
  });
});
