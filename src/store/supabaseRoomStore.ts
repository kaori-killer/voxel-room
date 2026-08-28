import { DEFAULT_ROOM_TITLE } from '@/domain/constants';
import { parseRoom } from '@/domain/roomSchema';
import type { RoomMetaType } from '@/domain/types';
import { RoomForbiddenError, RoomNotFoundError } from './roomStore';
import type { CreateRoomInputType, RoomStoreType, SaveRoomInputType, StoredRoomType } from './roomStore';

type SupabaseConfigType = {
  url: string;
  serviceKey: string;
};

type RoomRowType = {
  id: string;
  title: string;
  data: unknown;
  owner_key_hash: string;
  thumbnail: string | null;
  updated_at: string;
};

const TABLE = 'rooms';

/**
 * Supabase 는 키 이름을 두 세대로 쓴다 (service_role / secret).
 * 어느 쪽으로 넣어도 뜨도록 둘 다 본다. 브라우저에 노출되는 publishable 키는
 * RLS 가 전부 거부라 쓰지 않는다.
 */
export function readSupabaseConfig(): SupabaseConfigType | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

/**
 * supabase-js 없이 PostgREST 를 직접 호출한다.
 * 의존성을 늘리지 않으려는 선택이며, 호출 지점은 이 파일 하나다.
 */
export class SupabaseRoomStore implements RoomStoreType {
  readonly isShared = true;

  constructor(private readonly config: SupabaseConfigType) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.config.serviceKey,
        Authorization: `Bearer ${this.config.serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Supabase ${response.status}: ${await response.text()}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private toStored(row: RoomRowType): StoredRoomType {
    const meta: RoomMetaType = {
      id: row.id,
      title: row.title || DEFAULT_ROOM_TITLE,
      updatedAt: row.updated_at,
      thumbnailUrl: row.thumbnail ? `/api/rooms/${row.id}/thumbnail` : null,
    };
    return { meta, room: parseRoom(row.data) };
  }

  async create(input: CreateRoomInputType): Promise<StoredRoomType> {
    const rows = await this.request<RoomRowType[]>(TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: input.id,
        title: input.title,
        owner_key_hash: input.ownerKeyHash,
        data: input.room,
      }),
    });
    const row = rows[0];
    if (!row) throw new Error('방을 만들지 못했습니다');
    return this.toStored(row);
  }

  async read(id: string): Promise<StoredRoomType | null> {
    const rows = await this.request<RoomRowType[]>(
      `${TABLE}?id=eq.${encodeURIComponent(id)}&select=id,title,data,owner_key_hash,thumbnail,updated_at&limit=1`,
      { method: 'GET' },
    );
    const row = rows[0];
    return row ? this.toStored(row) : null;
  }

  async readThumbnail(id: string): Promise<string | null> {
    const rows = await this.request<Pick<RoomRowType, 'thumbnail'>[]>(
      `${TABLE}?id=eq.${encodeURIComponent(id)}&select=thumbnail&limit=1`,
      { method: 'GET' },
    );
    return rows[0]?.thumbnail ?? null;
  }

  async save(input: SaveRoomInputType): Promise<StoredRoomType> {
    const existing = await this.request<Pick<RoomRowType, 'id' | 'owner_key_hash'>[]>(
      `${TABLE}?id=eq.${encodeURIComponent(input.id)}&select=id,owner_key_hash&limit=1`,
      { method: 'GET' },
    );
    const row = existing[0];
    if (!row) throw new RoomNotFoundError(input.id);
    if (row.owner_key_hash !== input.ownerKeyHash) throw new RoomForbiddenError();

    const patch: Record<string, unknown> = { data: input.room, updated_at: new Date().toISOString() };
    if (input.title) patch.title = input.title;
    if (input.thumbnail !== undefined) patch.thumbnail = input.thumbnail;

    const updated = await this.request<RoomRowType[]>(
      `${TABLE}?id=eq.${encodeURIComponent(input.id)}&select=id,title,data,owner_key_hash,thumbnail,updated_at`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
    );
    const saved = updated[0];
    if (!saved) throw new RoomNotFoundError(input.id);
    return this.toStored(saved);
  }
}
