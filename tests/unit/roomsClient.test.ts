import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureApiError = vi.fn();
vi.mock('@/lib/monitoring', () => ({
  captureApiError: (...args: unknown[]) => captureApiError(...args),
}));

import { ApiError, fetchRoom } from '@/api/roomsClient';

type FetchResultType = { ok: boolean; status: number; body: unknown } | Error;

function stubFetch(result: FetchResultType): void {
  global.fetch = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.body,
    } as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => captureApiError.mockClear());
afterEach(() => vi.restoreAllMocks());

describe('roomsClient 실패 리포팅', () => {
  it('성공하면 payload 를 돌려주고 캡쳐하지 않는다', async () => {
    stubFetch({ ok: true, status: 200, body: { meta: { id: 'abc123' } } });

    await expect(fetchRoom('abc123')).resolves.toEqual({ meta: { id: 'abc123' } });
    expect(captureApiError).not.toHaveBeenCalled();
  });

  it('5xx 는 ApiError 를 던지고 캡쳐한다', async () => {
    stubFetch({ ok: false, status: 500, body: { error: '서버가 응답하지 않아요' } });

    await expect(fetchRoom('abc123')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: '서버가 응답하지 않아요',
    });
    expect(captureApiError).toHaveBeenCalledWith(expect.any(ApiError), {
      path: '/api/rooms/abc123',
      status: 500,
    });
  });

  it('4xx 는 던지되 캡쳐하지 않는다', async () => {
    stubFetch({ ok: false, status: 404, body: { error: '방을 찾지 못했습니다' } });

    await expect(fetchRoom('abc123')).rejects.toMatchObject({ status: 404 });
    expect(captureApiError).not.toHaveBeenCalled();
  });

  it('네트워크 실패는 원본 에러를 다시 던지고 캡쳐한다', async () => {
    const networkError = new TypeError('Failed to fetch');
    stubFetch(networkError);

    await expect(fetchRoom('abc123')).rejects.toBe(networkError);
    expect(captureApiError).toHaveBeenCalledWith(networkError, { path: '/api/rooms/abc123' });
  });
});
