import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

const ROOM_ID_PATTERN = /^\/[23456789abcdefghjkmnpqrstuvwxyz]{10}$/;

test.describe('방 만들기와 꾸미기', () => {
  test('첫 화면에서 방을 만들면 방 주소로 옮겨 간다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '복셀 공방' })).toBeVisible();

    await page.getByRole('button', { name: '내 방 만들기' }).click();
    await page.waitForURL((url) => ROOM_ID_PATTERN.test(url.pathname), { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toMatch(ROOM_ID_PATTERN);

    await expect(page.getByRole('button', { name: '사진으로 오브제 만들기' })).toBeVisible();
    // 새 방에는 기본 오브제(별·무드등·주크박스)가 미리 놓여 있다.
    await expect(page.getByRole('button', { name: '반짝별 방에 꺼내기' })).toBeVisible();
    await expect(page.locator('aside[aria-label="보관함"] li')).toHaveCount(3);
  });

  test('사진을 올리면 스튜디오가 열리고 보관함에 오브제가 담긴다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '내 방 만들기' }).click();
    await page.waitForURL((url) => ROOM_ID_PATTERN.test(url.pathname), { timeout: 30_000 });

    await page.setInputFiles('[data-testid="image-input"]', {
      name: '별.png',
      mimeType: 'image/png',
      buffer: makePng(),
    });

    const studio = page.getByRole('dialog', { name: '오브제 깎기' });
    await expect(studio).toBeVisible();
    await expect(studio.getByLabel('이름')).toHaveValue('별');
    await expect(studio.getByRole('status', { name: '변환 상태' })).toContainText('복셀', { timeout: 20_000 });

    await studio.getByRole('button', { name: '보관함에 넣고 방에 놓기' }).click();
    await expect(studio).toBeHidden();

    // 시드 '반짝별' 과 겹치지 않도록 정확히 '별' 항목만 집는다.
    await expect(page.getByRole('button', { name: '별 방에 꺼내기', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('toolbar')).toBeVisible();
  });

  test('이미지가 아닌 파일은 안내만 하고 스튜디오를 열지 않는다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '내 방 만들기' }).click();
    await page.waitForURL((url) => ROOM_ID_PATTERN.test(url.pathname), { timeout: 30_000 });

    await page.setInputFiles('[data-testid="image-input"]', {
      name: 'room.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });

    await expect(page.getByRole('dialog', { name: '오브제 깎기' })).toBeHidden();
    await expect(page.getByText('이미지 파일만 올릴 수 있습니다', { exact: false })).toBeVisible();
  });

  test('없는 방 주소는 404 를 보여 준다', async ({ page }) => {
    const response = await page.goto('/zzzzzzzzzz');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '방을 찾지 못했습니다' })).toBeVisible();
  });
});

/** 가운데 빨간 사각형이 있는 8×8 PNG */
function makePng(): Buffer {
  const size = 8;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const inside = x >= 2 && x < 6 && y >= 2 && y < 6;
      const offset = rowStart + 1 + x * 3;
      raw[offset] = inside ? 220 : 255;
      raw[offset + 1] = inside ? 40 : 255;
      raw[offset + 2] = inside ? 40 : 255;
    }
  }
  const idat = deflateSync(raw);

  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc;
}
