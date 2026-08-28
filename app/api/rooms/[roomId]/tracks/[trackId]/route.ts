import { roomIdSchema } from '@/domain/roomSchema';
import { jsonError } from '@/lib/http';
import { logger } from '@/lib/logger';
import { captureError } from '@/lib/monitoring';
import {
  createTrackDownloadUrl,
  deleteTrackBlob,
  readSupabaseConfig,
  verifyRoomOwner,
} from '@/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContextType = { params: Promise<{ roomId: string; trackId: string }> };

const trackIdOk = (id: string): boolean => /^[A-Za-z0-9_-]{1,64}$/.test(id);

/** 재생용. 서명 다운로드 URL 로 넘겨 브라우저가 Supabase 에서 바로 스트리밍하게 한다. */
export async function GET(_request: Request, context: RouteContextType) {
  const { roomId, trackId } = await context.params;
  if (!roomIdSchema.safeParse(roomId).success || !trackIdOk(trackId)) {
    return new Response('Not found', { status: 404 });
  }

  const config = readSupabaseConfig();
  if (!config) return new Response('Not found', { status: 404 });

  try {
    const url = await createTrackDownloadUrl(config, roomId, trackId);
    if (!url) return new Response('Not found', { status: 404 });
    return Response.redirect(url, 302);
  } catch (error) {
    logger.error('트랙 조회 실패', error);
    captureError(error, { route: 'GET /api/rooms/:id/tracks/:trackId', roomId });
    return new Response('Not found', { status: 404 });
  }
}

/** 방 주인만 서버 사본을 지운다. */
export async function DELETE(request: Request, context: RouteContextType) {
  const { roomId, trackId } = await context.params;
  if (!roomIdSchema.safeParse(roomId).success || !trackIdOk(trackId)) {
    return jsonError('형식이 올바르지 않습니다', 400);
  }

  const config = readSupabaseConfig();
  if (!config) return jsonError('공유가 꺼져 있습니다', 503);

  const ownerKeyHash = request.headers.get('x-owner-key-hash') ?? '';
  try {
    const owner = await verifyRoomOwner(config, roomId, ownerKeyHash);
    if (owner === 'notfound') return jsonError('방을 찾지 못했습니다', 404);
    if (owner === 'forbidden') return jsonError('이 방을 고칠 권한이 없습니다', 403);

    await deleteTrackBlob(config, roomId, trackId);
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('트랙 삭제 실패', error);
    captureError(error, { route: 'DELETE /api/rooms/:id/tracks/:trackId', roomId });
    return jsonError('음악을 지우지 못했습니다', 500);
  }
}
