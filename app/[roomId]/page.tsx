import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RoomView } from '@/features/room/RoomView';
import { roomIdSchema } from '@/domain/roomSchema';
import { buildRoomPath } from '@/lib/url';
import { getRoomStore, isSharingEnabled } from '@/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RoomPagePropsType = { params: Promise<{ roomId: string }> };

async function readRoom(roomId: string) {
  if (!roomIdSchema.safeParse(roomId).success) return null;
  return getRoomStore().read(roomId);
}

export async function generateMetadata({ params }: RoomPagePropsType): Promise<Metadata> {
  const { roomId } = await params;
  const stored = await readRoom(roomId);
  if (!stored) return { title: '방을 찾지 못했습니다', robots: { index: false } };

  const title = stored.meta.title;
  const description = `${title} — 복셀 오브제 ${stored.room.placed.length}개로 꾸민 방입니다.`;
  const image = stored.meta.thumbnailUrl ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: buildRoomPath(roomId) },
    robots: { index: false, follow: false },
    openGraph: {
      type: 'article',
      title,
      description,
      url: buildRoomPath(roomId),
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function RoomPage({ params }: RoomPagePropsType) {
  const { roomId } = await params;
  const stored = await readRoom(roomId);
  if (!stored) notFound();
  return <RoomView meta={stored.meta} initialRoom={stored.room} shared={isSharingEnabled()} />;
}
