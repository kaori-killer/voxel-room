import { captureApiError } from '@/lib/monitoring';
import type { RoomType } from '@/domain/types';
import type {
  ChatListResType,
  CreateRoomReqType,
  RoomDetailResType,
  SaveRoomReqType,
  SaveRoomResType,
  SendChatReqType,
  SendChatResType,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (error) {
    captureApiError(error, { path });
    throw error;
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : '요청에 실패했습니다';
    const apiError = new ApiError(message, response.status);
    // 4xx 는 사용자·검증 사유라 리포트하지 않고, 서버 장애(5xx)만 캡쳐한다.
    if (response.status >= 500) captureApiError(apiError, { path, status: response.status });
    throw apiError;
  }
  return payload as T;
}

export function createRoom(body: CreateRoomReqType): Promise<{ meta: { id: string } }> {
  return request('/api/rooms', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchRoom(roomId: string): Promise<RoomDetailResType> {
  return request(`/api/rooms/${roomId}`);
}

export function saveRoom(roomId: string, body: SaveRoomReqType): Promise<SaveRoomResType> {
  return request(`/api/rooms/${roomId}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function fetchChat(roomId: string): Promise<ChatListResType> {
  return request(`/api/rooms/${roomId}/chat`);
}

export function sendChat(roomId: string, body: SendChatReqType): Promise<SendChatResType> {
  return request(`/api/rooms/${roomId}/chat`, { method: 'POST', body: JSON.stringify(body) });
}

/** 재생에 쓰는 안정적인 경로. 서버가 서명 URL 로 302 리다이렉트한다. */
export function trackSrc(roomId: string, trackId: string): string {
  return `/api/rooms/${roomId}/tracks/${trackId}`;
}

/**
 * 서버에서 서명 업로드 URL 을 받아, 파일 바이트는 브라우저가 Supabase 로 직접 PUT 한다.
 * (서버 라우트를 바이트가 지나지 않아 배포 플랫폼의 본문 크기 제한을 피한다.)
 */
export async function uploadTrack(
  roomId: string,
  trackId: string,
  ownerKeyHash: string,
  file: File,
): Promise<void> {
  const { uploadUrl } = await request<{ uploadUrl: string }>(`/api/rooms/${roomId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ trackId, ownerKeyHash }),
  });
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: file,
    });
  } catch (error) {
    captureApiError(error, { path: 'PUT storage upload' });
    throw error;
  }
  if (!response.ok) throw new ApiError('음악 업로드에 실패했습니다', response.status);
}

export async function deleteTrack(roomId: string, trackId: string, ownerKeyHash: string): Promise<void> {
  const response = await fetch(`/api/rooms/${roomId}/tracks/${trackId}`, {
    method: 'DELETE',
    headers: { 'x-owner-key-hash': ownerKeyHash },
  });
  if (!response.ok && response.status !== 204) {
    throw new ApiError('음악 삭제에 실패했습니다', response.status);
  }
}

export type { RoomType };
