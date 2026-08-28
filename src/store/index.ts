import { MemoryRoomStore } from './memoryRoomStore';
import { readSupabaseConfig, SupabaseRoomStore } from './supabaseRoomStore';
import type { RoomStoreType } from './roomStore';

let cached: RoomStoreType | null = null;

/** 환경변수가 있으면 Supabase, 없으면 메모리. 호출부는 차이를 모른다. */
export function getRoomStore(): RoomStoreType {
  if (cached) return cached;
  const config = readSupabaseConfig();
  cached = config ? new SupabaseRoomStore(config) : new MemoryRoomStore();
  return cached;
}

export function isSharingEnabled(): boolean {
  return readSupabaseConfig() !== null;
}

export type { RoomStoreType, StoredRoomType } from './roomStore';
export { RoomForbiddenError, RoomNotFoundError } from './roomStore';
export { readSupabaseConfig, verifyRoomOwner } from './supabaseRoomStore';
export type { SupabaseConfigType } from './supabaseRoomStore';
export {
  createTrackDownloadUrl,
  createTrackUploadUrl,
  deleteTrackBlob,
  ensureTrackBucket,
} from './trackBlobStore';
