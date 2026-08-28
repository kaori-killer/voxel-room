import { roomIdSchema } from '@/domain/roomSchema';
import { logger } from '@/lib/logger';
import { captureError } from '@/lib/monitoring';
import { getRoomStore } from '@/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContextType = { params: Promise<{ roomId: string }> };

/** 공유 카드용 이미지. data URL 로 저장된 것을 바이너리로 돌려준다. */
export async function GET(_request: Request, context: RouteContextType) {
  const { roomId } = await context.params;
  if (!roomIdSchema.safeParse(roomId).success) return new Response('Not found', { status: 404 });

  try {
    const dataUrl = await getRoomStore().readThumbnail(roomId);
    if (!dataUrl) return new Response('Not found', { status: 404 });
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
    if (!match?.[1] || !match[2]) return new Response('Not found', { status: 404 });
    return new Response(Buffer.from(match[2], 'base64'), {
      headers: {
        'Content-Type': match[1],
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    logger.error('썸네일 조회 실패', error);
    captureError(error, { route: 'GET /api/rooms/:id/thumbnail', roomId });
    return new Response('Not found', { status: 404 });
  }
}
