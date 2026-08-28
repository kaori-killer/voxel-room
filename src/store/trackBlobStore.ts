import type { SupabaseConfigType } from './supabaseRoomStore';

/**
 * 음악 파일을 Supabase Storage 에 둔다. 방 JSON 에는 여전히 곡 이름·id 만 남기고,
 * 실제 오디오는 이 버킷에 올려 공유 링크로 연 사람도 받아 갈 수 있게 한다.
 *
 * 업로드·다운로드 모두 서명 URL 을 발급해 브라우저가 Supabase 로 직접 주고받는다.
 * (서버 라우트를 바이트가 통과하지 않으므로 배포 플랫폼의 본문 크기 제한을 피한다.)
 */

const BUCKET = 'room-tracks';

const objectPath = (roomId: string, trackId: string): string => `${roomId}/${trackId}`;

function storageFetch(config: SupabaseConfigType, path: string, init: RequestInit): Promise<Response> {
  return fetch(`${config.url}/storage/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}

let bucketReady = false;

/** 버킷이 없으면 만든다 (비공개). 이미 있으면 조용히 넘어간다. */
export async function ensureTrackBucket(config: SupabaseConfigType): Promise<void> {
  if (bucketReady) return;
  const response = await storageFetch(config, 'bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  if (response.ok || response.status === 409) {
    bucketReady = true;
    return;
  }
  const text = await response.text();
  if (/exist/i.test(text)) {
    bucketReady = true;
    return;
  }
  throw new Error(`버킷 준비 실패 ${response.status}: ${text}`);
}

/** 브라우저가 파일을 직접 PUT 할 서명 업로드 URL. */
export async function createTrackUploadUrl(
  config: SupabaseConfigType,
  roomId: string,
  trackId: string,
): Promise<string> {
  const response = await storageFetch(
    config,
    `object/upload/sign/${BUCKET}/${objectPath(roomId, trackId)}`,
    { method: 'POST' },
  );
  if (!response.ok) throw new Error(`업로드 URL 발급 실패 ${response.status}: ${await response.text()}`);
  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error('업로드 URL 이 비어 있습니다');
  return `${config.url}/storage/v1${data.url}`;
}

/** 재생용 서명 다운로드 URL. 파일이 없거나 실패하면 null. */
export async function createTrackDownloadUrl(
  config: SupabaseConfigType,
  roomId: string,
  trackId: string,
): Promise<string | null> {
  const response = await storageFetch(config, `object/sign/${BUCKET}/${objectPath(roomId, trackId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60 * 60 }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { signedURL?: string };
  return data.signedURL ? `${config.url}/storage/v1${data.signedURL}` : null;
}

export async function deleteTrackBlob(
  config: SupabaseConfigType,
  roomId: string,
  trackId: string,
): Promise<void> {
  const response = await storageFetch(config, `object/${BUCKET}/${objectPath(roomId, trackId)}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`음악 삭제 실패 ${response.status}: ${await response.text()}`);
  }
}
