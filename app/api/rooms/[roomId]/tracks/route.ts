import { z } from 'zod';
import { roomIdSchema } from '@/domain/roomSchema';
import { jsonError, jsonOk, readJsonBody } from '@/lib/http';
import { logger } from '@/lib/logger';
import { captureError } from '@/lib/monitoring';
import {
  createTrackUploadUrl,
  ensureTrackBucket,
  readSupabaseConfig,
  verifyRoomOwner,
} from '@/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContextType = { params: Promise<{ roomId: string }> };

const uploadReqSchema = z.object({
  trackId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  ownerKeyHash: z.string().min(8).max(200),
});

/** 방 주인에게만 서명 업로드 URL 을 내준다. 파일 바이트는 브라우저가 Supabase 로 직접 보낸다. */
export async function POST(request: Request, context: RouteContextType) {
  const { roomId } = await context.params;
  if (!roomIdSchema.safeParse(roomId).success) return jsonError('방 주소 형식이 아닙니다', 400);

  const parsed = uploadReqSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return jsonError('요청 형식이 올바르지 않습니다', 400);

  const config = readSupabaseConfig();
  if (!config) return jsonError('공유가 꺼져 있어 음악을 올릴 수 없습니다', 503);

  try {
    const owner = await verifyRoomOwner(config, roomId, parsed.data.ownerKeyHash);
    if (owner === 'notfound') return jsonError('방을 찾지 못했습니다', 404);
    if (owner === 'forbidden') return jsonError('이 방을 고칠 권한이 없습니다', 403);

    await ensureTrackBucket(config);
    const uploadUrl = await createTrackUploadUrl(config, roomId, parsed.data.trackId);
    return jsonOk({ uploadUrl });
  } catch (error) {
    logger.error('트랙 업로드 URL 발급 실패', error);
    captureError(error, { route: 'POST /api/rooms/:id/tracks', roomId });
    return jsonError('음악을 올릴 준비를 하지 못했습니다', 500);
  }
}
