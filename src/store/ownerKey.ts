const STORAGE_PREFIX = 'voxel-room.owner.';

/**
 * 방을 만든 브라우저에만 남는 비밀값.
 * 서버에는 해시만 보내므로 원본이 새지 않는다.
 */
export function readOwnerKey(roomId: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + roomId);
  } catch {
    return null;
  }
}

export function writeOwnerKey(roomId: string, key: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + roomId, key);
  } catch {
    // 저장소가 막힌 브라우저에서는 이 세션에서만 편집할 수 있다.
  }
}

export async function hashOwnerKey(key: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return `plain:${key}`;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
