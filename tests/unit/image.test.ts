import { describe, expect, it } from 'vitest';
import { checkImageFile, MAX_IMAGE_BYTES, normalizeItemName } from '@/lib/image';

function makeFile(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(Math.min(size, 1024))], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('checkImageFile', () => {
  it('PNG·JPG·WEBP 를 받는다', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(checkImageFile(makeFile('a', type, 1000)).ok).toBe(true);
    }
  });

  it('타입이 비어 있어도 확장자로 받아 준다', () => {
    expect(checkImageFile(makeFile('사진.JPG', '', 1000)).ok).toBe(true);
  });

  it('이미지가 아닌 파일을 막는다', () => {
    const result = checkImageFile(makeFile('room.json', 'application/json', 1000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('type');
  });

  it('너무 큰 파일을 막는다', () => {
    const result = checkImageFile(makeFile('big.png', 'image/png', MAX_IMAGE_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('size');
  });

  it('빈 파일과 없는 파일을 막는다', () => {
    expect(checkImageFile(makeFile('empty.png', 'image/png', 0)).ok).toBe(false);
    expect(checkImageFile(null).ok).toBe(false);
    expect(checkImageFile(undefined).ok).toBe(false);
  });

  it('막을 때는 사람이 읽을 이유를 함께 낸다', () => {
    const result = checkImageFile(makeFile('a.txt', 'text/plain', 10));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});

describe('normalizeItemName', () => {
  it('확장자를 떼고 길이를 자른다', () => {
    expect(normalizeItemName('버섯.png', '오브제 1')).toBe('버섯');
    expect(normalizeItemName('x'.repeat(50) + '.png', 'fallback')).toHaveLength(24);
  });

  it('이름이 비면 기본값을 쓴다', () => {
    expect(normalizeItemName('  .png', '오브제 3')).toBe('오브제 3');
  });
});
