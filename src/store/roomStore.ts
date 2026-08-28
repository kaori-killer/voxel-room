import type { RoomMetaType, RoomType } from '@/domain/types';

export type StoredRoomType = {
  meta: RoomMetaType;
  room: RoomType;
};

export type CreateRoomInputType = {
  id: string;
  title: string;
  ownerKeyHash: string;
  room: RoomType;
};

export type SaveRoomInputType = {
  id: string;
  title?: string;
  thumbnail?: string | null;
  room: RoomType;
  ownerKeyHash: string;
};

/**
 * 방 저장소의 계약. 화면과 route handler 는 이 타입에만 기댄다.
 * Supabase 가 없으면 브라우저 로컬 구현이 대신 들어간다.
 */
export type RoomStoreType = {
  readonly isShared: boolean;
  create: (input: CreateRoomInputType) => Promise<StoredRoomType>;
  read: (id: string) => Promise<StoredRoomType | null>;
  save: (input: SaveRoomInputType) => Promise<StoredRoomType>;
  readThumbnail: (id: string) => Promise<string | null>;
};

export class RoomNotFoundError extends Error {
  constructor(id: string) {
    super(`방을 찾지 못했습니다: ${id}`);
    this.name = 'RoomNotFoundError';
  }
}

export class RoomForbiddenError extends Error {
  constructor() {
    super('이 방을 고칠 권한이 없습니다');
    this.name = 'RoomForbiddenError';
  }
}
