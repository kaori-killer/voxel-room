import { z } from 'zod';
import {
  DEFAULT_LAMP_BRIGHT,
  DEFAULT_LAMP_TINT,
  DEFAULT_ROOM_SETTINGS,
  MAX_OBJECT_HEIGHT,
  MIN_OBJECT_HEIGHT,
  ROOM_ID_PATTERN,
  ROOM_VERSION,
} from './constants';
import { DEPTH_MODES, LAMP_TINTS, ROOM_PALETTES, TRAIT_KEYS } from './types';
import type { RoomType } from './types';

const maskPngSchema = z
  .string()
  .max(400_000)
  .refine((v) => v.startsWith('data:image/png;base64,'), { message: 'PNG data URL 이어야 합니다' });

export const traitSetSchema = z.object(
  Object.fromEntries(TRAIT_KEYS.map((k) => [k, z.boolean().optional()])) as Record<
    (typeof TRAIT_KEYS)[number],
    z.ZodOptional<z.ZodBoolean>
  >,
);

export const trackItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
});

export const inventoryItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
  maskPng: maskPngSchema,
  carve: z.object({
    depth: z.number().int().min(2).max(24),
    mode: z.enum(DEPTH_MODES),
  }),
  traits: traitSetSchema.default({}),
  tracks: z.array(trackItemSchema).max(200).default([]),
});

export const lampStateSchema = z.object({
  on: z.boolean().default(true),
  bright: z.number().min(0.1).max(3).default(DEFAULT_LAMP_BRIGHT),
  tint: z.enum(LAMP_TINTS).default(DEFAULT_LAMP_TINT),
});

export const placedObjectSchema = z.object({
  key: z.string().min(1).max(64),
  itemId: z.string().min(1).max(64),
  x: z.number().finite(),
  z: z.number().finite(),
  y: z.number().finite().min(0),
  rot: z.number().finite(),
  height: z.number().min(MIN_OBJECT_HEIGHT).max(MAX_OBJECT_HEIGHT),
  lamp: lampStateSchema.optional(),
});

export const roomSettingsSchema = z.object({
  size: z.number().int().min(6).max(24).default(DEFAULT_ROOM_SETTINGS.size),
  palette: z.enum(ROOM_PALETTES).default(DEFAULT_ROOM_SETTINGS.palette),
});

export const roomSchema = z.object({
  version: z.number().int().min(1).default(ROOM_VERSION),
  settings: roomSettingsSchema.default(DEFAULT_ROOM_SETTINGS),
  items: z.array(inventoryItemSchema).max(120).default([]),
  placed: z.array(placedObjectSchema).max(400).default([]),
});

export const roomIdSchema = z.string().regex(ROOM_ID_PATTERN, '방 주소 형식이 아닙니다');

export const roomTitleSchema = z.string().trim().min(1).max(40);

export const saveRoomReqSchema = z.object({
  room: roomSchema,
  title: roomTitleSchema.optional(),
  thumbnail: z
    .string()
    .max(600_000)
    .refine((v) => v.startsWith('data:image/'), { message: '이미지 data URL 이어야 합니다' })
    .nullable()
    .optional(),
  ownerKeyHash: z.string().min(8).max(200),
});

export const createRoomReqSchema = z.object({
  title: roomTitleSchema.optional(),
});

export const chatMessageReqSchema = z.object({
  body: z.string().trim().min(1).max(800),
  authorName: z.string().trim().min(1).max(40),
  visitorKey: z.string().min(8).max(128),
});

/**
 * 저장소에서 온 값은 남이 만졌을 수 있다. 모양이 어긋나면 던지지 말고
 * 되도록 살려서 돌려준다 — 방 하나가 통째로 안 열리는 편이 더 나쁘다.
 */
export function parseRoom(input: unknown): RoomType {
  const result = roomSchema.safeParse(input);
  if (result.success) return dropOrphanPlacements(result.data);

  const loose = z
    .object({
      version: z.number().optional(),
      settings: z.unknown().optional(),
      items: z.array(z.unknown()).optional(),
      placed: z.array(z.unknown()).optional(),
    })
    .safeParse(input);

  if (!loose.success) return emptyRoom();

  const settings = roomSettingsSchema.safeParse(loose.data.settings);
  const items = (loose.data.items ?? [])
    .map((it) => inventoryItemSchema.safeParse(it))
    .flatMap((r) => (r.success ? [r.data] : []));
  const placed = (loose.data.placed ?? [])
    .map((p) => placedObjectSchema.safeParse(p))
    .flatMap((r) => (r.success ? [r.data] : []));

  return dropOrphanPlacements({
    version: ROOM_VERSION,
    settings: settings.success ? settings.data : DEFAULT_ROOM_SETTINGS,
    items,
    placed,
  });
}

function dropOrphanPlacements(room: RoomType): RoomType {
  const known = new Set(room.items.map((i) => i.id));
  const placed = room.placed.filter((p) => known.has(p.itemId));
  return placed.length === room.placed.length ? room : { ...room, placed };
}

export function emptyRoom(): RoomType {
  return { version: ROOM_VERSION, settings: { ...DEFAULT_ROOM_SETTINGS }, items: [], placed: [] };
}
