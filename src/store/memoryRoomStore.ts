import { DEFAULT_ROOM_TITLE } from '@/domain/constants';
import { RoomForbiddenError, RoomNotFoundError } from './roomStore';
import type { CreateRoomInputType, RoomStoreType, SaveRoomInputType, StoredRoomType } from './roomStore';

type EntryType = StoredRoomType & { ownerKeyHash: string; thumbnail: string | null };

/**
 * Supabase 가 없을 때 쓰는 대체 구현. 서버 인스턴스 안에서만 살아 있으므로
 * 공유는 되지 않는다 (isShared=false). 개발과 테스트에서 앱이 뜨게 하는 용도.
 */
export class MemoryRoomStore implements RoomStoreType {
  readonly isShared = false;
  private readonly rooms = new Map<string, EntryType>();

  async create(input: CreateRoomInputType): Promise<StoredRoomType> {
    const entry: EntryType = {
      meta: {
        id: input.id,
        title: input.title || DEFAULT_ROOM_TITLE,
        updatedAt: new Date().toISOString(),
        thumbnailUrl: null,
      },
      room: input.room,
      ownerKeyHash: input.ownerKeyHash,
      thumbnail: null,
    };
    this.rooms.set(input.id, entry);
    return { meta: entry.meta, room: entry.room };
  }

  async read(id: string): Promise<StoredRoomType | null> {
    const entry = this.rooms.get(id);
    return entry ? { meta: entry.meta, room: entry.room } : null;
  }

  async readThumbnail(id: string): Promise<string | null> {
    return this.rooms.get(id)?.thumbnail ?? null;
  }

  async save(input: SaveRoomInputType): Promise<StoredRoomType> {
    const entry = this.rooms.get(input.id);
    if (!entry) throw new RoomNotFoundError(input.id);
    if (entry.ownerKeyHash !== input.ownerKeyHash) throw new RoomForbiddenError();
    entry.room = input.room;
    if (input.title) entry.meta.title = input.title;
    if (input.thumbnail !== undefined) {
      entry.thumbnail = input.thumbnail;
      entry.meta.thumbnailUrl = input.thumbnail ? `/api/rooms/${input.id}/thumbnail` : null;
    }
    entry.meta.updatedAt = new Date().toISOString();
    return { meta: entry.meta, room: entry.room };
  }
}
