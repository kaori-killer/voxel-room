import { chatMessageReqSchema, roomIdSchema } from '@/domain/roomSchema';
import { hashOwnerKey } from '@/store/ownerKey';
import { isAdminRequest } from '@/lib/adminSession';
import { jsonError, jsonOk, readJsonBody } from '@/lib/http';
import { logger } from '@/lib/logger';
import { getChatStore } from '@/store/chatStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContextType = { params: Promise<{ roomId: string }> };

export async function GET(_request: Request, context: RouteContextType) {
  const { roomId } = await context.params;
  if (!roomIdSchema.safeParse(roomId).success) return jsonError('방 주소 형식이 아닙니다', 400);

  const store = getChatStore();
  if (!store.enabled) return jsonOk({ messages: [], enabled: false });
  try {
    return jsonOk({ messages: await store.list(roomId), enabled: true });
  } catch (error) {
    logger.error('채팅 조회 실패', error);
    return jsonError('대화를 불러오지 못했습니다', 500);
  }
}

export async function POST(request: Request, context: RouteContextType) {
  const { roomId } = await context.params;
  if (!roomIdSchema.safeParse(roomId).success) return jsonError('방 주소 형식이 아닙니다', 400);

  const store = getChatStore();
  if (!store.enabled) return jsonError('채팅이 꺼져 있습니다', 503);

  const parsed = chatMessageReqSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return jsonError('메시지 형식이 올바르지 않습니다', 400);

  try {
    const admin = await isAdminRequest();
    const message = await store.post({
      roomId,
      role: admin ? 'admin' : 'visitor',
      authorName: admin ? '관리자' : parsed.data.authorName,
      body: parsed.data.body,
      visitorKeyHash: await hashOwnerKey(parsed.data.visitorKey),
    });
    return jsonOk({ message }, 201);
  } catch (error) {
    logger.error('채팅 전송 실패', error);
    return jsonError('메시지를 남기지 못했습니다', 500);
  }
}
