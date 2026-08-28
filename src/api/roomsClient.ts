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
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : '요청에 실패했습니다';
    throw new ApiError(message, response.status);
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
