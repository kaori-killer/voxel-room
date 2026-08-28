import { parseRoom, roomIdSchema, saveRoomReqSchema } from '@/domain/roomSchema';
import { jsonError, jsonOk, readJsonBody } from '@/lib/http';
import { logger } from '@/lib/logger';
import { getRoomStore, isSharingEnabled, RoomForbiddenError, RoomNotFoundError } from '@/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContextType = { params: Promise<{ roomId: string }> };

export async function GET(_request: Request, context: RouteContextType) {
  const { roomId } = await context.params;
  if (!roomIdSchema.safeParse(roomId).success) return jsonError('방 주소 형식이 아닙니다', 400);

  try {
    const stored = await getRoomStore().read(roomId);
    if (!stored) return jsonError('방을 찾지 못했습니다', 404);
    return jsonOk({ meta: stored.meta, room: stored.room, shared: isSharingEnabled() });
  } catch (error) {
    logger.error('방 조회 실패', error);
    return jsonError('방을 불러오지 못했습니다', 500);
  }
}

export async function PUT(request: Request, context: RouteContextType) {
  const { roomId } = await context.params;
  if (!roomIdSchema.safeParse(roomId).success) return jsonError('방 주소 형식이 아닙니다', 400);

  const parsed = saveRoomReqSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return jsonError('방 데이터 형식이 올바르지 않습니다', 400);

  try {
    const stored = await getRoomStore().save({
      id: roomId,
      title: parsed.data.title,
      thumbnail: parsed.data.thumbnail,
      room: parseRoom(parsed.data.room),
      ownerKeyHash: parsed.data.ownerKeyHash,
    });
    return jsonOk({ meta: stored.meta });
  } catch (error) {
    if (error instanceof RoomNotFoundError) return jsonError('방을 찾지 못했습니다', 404);
    if (error instanceof RoomForbiddenError) return jsonError('이 방을 고칠 권한이 없습니다', 403);
    logger.error('방 저장 실패', error);
    return jsonError('방을 저장하지 못했습니다', 500);
  }
}
