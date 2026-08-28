import { z } from 'zod';
import { DEFAULT_ROOM_TITLE } from '@/domain/constants';
import { roomTitleSchema, seededRoom } from '@/domain/roomSchema';
import { buildRoomId } from '@/lib/id';
import { jsonError, jsonOk, readJsonBody } from '@/lib/http';
import { logger } from '@/lib/logger';
import { captureError } from '@/lib/monitoring';
import { getRoomStore } from '@/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  title: roomTitleSchema.optional(),
  ownerKeyHash: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return jsonError('요청 형식이 올바르지 않습니다', 400);

  try {
    const stored = await getRoomStore().create({
      id: buildRoomId(),
      title: parsed.data.title ?? DEFAULT_ROOM_TITLE,
      ownerKeyHash: parsed.data.ownerKeyHash,
      room: seededRoom(),
    });
    return jsonOk({ meta: stored.meta }, 201);
  } catch (error) {
    logger.error('방 생성 실패', error);
    captureError(error, { route: 'POST /api/rooms' });
    return jsonError('방을 만들지 못했습니다', 500);
  }
}
