export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'] as const;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export type ImageRejectReasonType = 'type' | 'size' | 'empty';

export type ImageCheckResultType =
  | { ok: true; file: File }
  | { ok: false; reason: ImageRejectReasonType; message: string };

const REJECT_MESSAGE_MAP: Record<ImageRejectReasonType, string> = {
  type: '이미지 파일만 올릴 수 있습니다 (PNG · JPG · WEBP)',
  size: '이미지가 너무 큽니다. 25MB 이하로 올려 주세요',
  empty: '파일을 읽지 못했습니다',
};

/** 업로드 지점이 여러 곳(버튼·드롭·붙여넣기)이라 판정은 한 곳에 모은다. */
export function checkImageFile(file: File | null | undefined): ImageCheckResultType {
  if (!file || file.size === 0) return { ok: false, reason: 'empty', message: REJECT_MESSAGE_MAP.empty };
  const typeOk = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);
  if (!typeOk) return { ok: false, reason: 'type', message: REJECT_MESSAGE_MAP.type };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: 'size', message: REJECT_MESSAGE_MAP.size };
  return { ok: true, file };
}

export function loadImageFromSource(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 읽지 못했습니다'));
    image.src = src;
  });
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return loadImageFromSource(url).finally(() => URL.revokeObjectURL(url));
}

export function normalizeItemName(rawName: string, fallback: string): string {
  const trimmed = rawName.replace(/\.[a-z0-9]+$/i, '').trim().slice(0, 24);
  return trimmed || fallback;
}
