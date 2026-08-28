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

export type { RoomType };
