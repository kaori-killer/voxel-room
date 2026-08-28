import { CHAT_PAGE_SIZE } from '@/domain/constants';
import type { ChatMessageItemType, ChatRoleType } from '@/domain/types';
import { readSupabaseConfig } from './supabaseRoomStore';

export type PostChatInputType = {
  roomId: string;
  role: ChatRoleType;
  authorName: string;
  body: string;
  visitorKeyHash: string;
};

export type ChatStoreType = {
  readonly enabled: boolean;
  list: (roomId: string) => Promise<ChatMessageItemType[]>;
  post: (input: PostChatInputType) => Promise<ChatMessageItemType>;
  listRooms: () => Promise<{ roomId: string; lastMessageAt: string; total: number }[]>;
};

type ChatRowType = {
  id: string;
  room_id: string;
  role: ChatRoleType;
  author_name: string;
  body: string;
  created_at: string;
};

const TABLE = 'chat_messages';

function toItem(row: ChatRowType): ChatMessageItemType {
  return {
    id: row.id,
    roomId: row.room_id,
    role: row.role,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

class SupabaseChatStore implements ChatStoreType {
  readonly enabled = true;

  constructor(private readonly config: { url: string; serviceKey: string }) {}

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
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async list(roomId: string): Promise<ChatMessageItemType[]> {
    const rows = await this.request<ChatRowType[]>(
      `${TABLE}?room_id=eq.${encodeURIComponent(roomId)}&select=id,room_id,role,author_name,body,created_at&order=created_at.asc&limit=${CHAT_PAGE_SIZE}`,
      { method: 'GET' },
    );
    return rows.map(toItem);
  }

  async post(input: PostChatInputType): Promise<ChatMessageItemType> {
    const rows = await this.request<ChatRowType[]>(TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        room_id: input.roomId,
        role: input.role,
        author_name: input.authorName,
        body: input.body,
        visitor_key_hash: input.visitorKeyHash,
      }),
    });
    const row = rows[0];
    if (!row) throw new Error('메시지를 남기지 못했습니다');
    return toItem(row);
  }

  async listRooms(): Promise<{ roomId: string; lastMessageAt: string; total: number }[]> {
    const rows = await this.request<ChatRowType[]>(
      `${TABLE}?select=room_id,created_at&order=created_at.desc&limit=500`,
      { method: 'GET' },
    );
    const map = new Map<string, { lastMessageAt: string; total: number }>();
    for (const row of rows) {
      const current = map.get(row.room_id);
      if (current) current.total += 1;
      else map.set(row.room_id, { lastMessageAt: row.created_at, total: 1 });
    }
    return [...map.entries()].map(([roomId, value]) => ({ roomId, ...value }));
  }
}

class DisabledChatStore implements ChatStoreType {
  readonly enabled = false;
  async list(): Promise<ChatMessageItemType[]> {
    return [];
  }
  async post(): Promise<ChatMessageItemType> {
    throw new Error('채팅이 꺼져 있습니다');
  }
  async listRooms(): Promise<{ roomId: string; lastMessageAt: string; total: number }[]> {
    return [];
  }
}

let cached: ChatStoreType | null = null;

export function getChatStore(): ChatStoreType {
  if (cached) return cached;
  const config = readSupabaseConfig();
  cached = config ? new SupabaseChatStore(config) : new DisabledChatStore();
  return cached;
}
