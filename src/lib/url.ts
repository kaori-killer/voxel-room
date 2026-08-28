export function buildRoomPath(roomId: string): string {
  return `/${roomId}`;
}

export function buildRoomUrl(roomId: string, origin?: string): string {
  const base = origin ?? getSiteOrigin();
  return `${base}${buildRoomPath(roomId)}`;
}

export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
