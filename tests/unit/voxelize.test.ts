import { beforeAll, describe, expect, it } from 'vitest';
import { carveVoxels, despeckle, distanceField, maskByFlood } from '@/engine/voxelize';
import type { CarveOptionsType } from '@/domain/types';
import { installCanvasStub, makeImage } from '../helpers/canvas';
import type { FakeImageType } from '../helpers/canvas';

beforeAll(() => installCanvasStub());

const BASE: CarveOptionsType = { grid: 16, depth: 4, mode: 'flat', removeBg: true, tolerance: 60, trim: false };

function asSource(image: FakeImageType): HTMLImageElement {
  return image as unknown as HTMLImageElement;
}

/** 흰 배경 위 가운데 빨간 사각형 */
function squareOnWhite(size = 16, inset = 4) {
  return makeImage(size, size, (x, y) =>
    x >= inset && x < size - inset && y >= inset && y < size - inset ? [220, 40, 40, 255] : [255, 255, 255, 255],
  );
}

describe('maskByFlood', () => {
  it('테두리에서 이어진 배경만 지운다', () => {
    const image = squareOnWhite();
    const mask = maskByFlood(image.pixels, 16, 16, 60);
    expect(mask[0]).toBe(0);
    expect(mask[8 * 16 + 8]).toBe(1);
  });

  it('그림 안쪽의 흰색은 배경으로 보지 않는다', () => {
    const image = makeImage(16, 16, (x, y) => {
      const inShape = x >= 3 && x < 13 && y >= 3 && y < 13;
      if (!inShape) return [255, 255, 255, 255];
      const inHole = x >= 6 && x < 10 && y >= 6 && y < 10;
      return inHole ? [255, 255, 255, 255] : [10, 10, 200, 255];
    });
    const mask = maskByFlood(image.pixels, 16, 16, 60);
    expect(mask[8 * 16 + 8]).toBe(1);
  });
});

describe('despeckle', () => {
  it('이웃 없는 외톨이 칸을 턴다', () => {
    const mask = new Uint8Array(16 * 16);
    for (let y = 4; y < 12; y += 1) for (let x = 4; x < 12; x += 1) mask[y * 16 + x] = 1;
    mask[0] = 1;
    const cleaned = despeckle(mask, 16, 16, false);
    expect(cleaned[0]).toBe(0);
    expect(cleaned[8 * 16 + 8]).toBe(1);
  });

  it('다 지워질 상황이면 원본을 지킨다', () => {
    const mask = new Uint8Array(16 * 16);
    mask[20] = 1;
    mask[40] = 1;
    expect(despeckle(mask, 16, 16, false)).toEqual(mask);
  });
});

describe('distanceField', () => {
  it('안쪽으로 갈수록 값이 커진다', () => {
    const mask = new Uint8Array(16 * 16);
    for (let y = 2; y < 14; y += 1) for (let x = 2; x < 14; x += 1) mask[y * 16 + x] = 1;
    const dist = distanceField(mask, 16, 16);
    expect(dist[8 * 16 + 8]).toBeGreaterThan(dist[2 * 16 + 8] ?? 0);
  });
});

describe('carveVoxels', () => {
  it('배경을 지우고 실루엣만 남긴다', () => {
    const data = carveVoxels(asSource(squareOnWhite()), BASE);
    expect(data).not.toBeNull();
    expect(data?.gridWidth).toBe(8);
    expect(data?.gridHeight).toBe(8);
    expect(data?.count).toBeGreaterThan(0);
  });

  it('바닥이 y=0 에 서도록 복셀을 올린다', () => {
    const data = carveVoxels(asSource(squareOnWhite()), BASE);
    let minY = Infinity;
    for (let i = 0; i < (data?.count ?? 0); i += 1) minY = Math.min(minY, data?.positions[i * 3 + 1] ?? 0);
    expect(minY).toBeCloseTo(0.5, 5);
  });

  it('속이 보이지 않는 복셀은 버린다', () => {
    const data = carveVoxels(asSource(squareOnWhite(16, 2)), { ...BASE, depth: 8 });
    const solidCount = (data?.gridWidth ?? 0) * (data?.gridHeight ?? 0) * 8;
    expect(data?.count ?? 0).toBeLessThan(solidCount);
  });

  it('남는 것이 없으면 null 을 낸다', () => {
    const blank = makeImage(16, 16, () => [255, 255, 255, 255]);
    expect(carveVoxels(asSource(blank), BASE)).toBeNull();
  });

  it('부풀리기는 가운데를 더 두껍게 만든다', () => {
    const flat = carveVoxels(asSource(squareOnWhite()), { ...BASE, mode: 'flat', depth: 9 });
    const inflate = carveVoxels(asSource(squareOnWhite()), { ...BASE, mode: 'inflate', depth: 9 });
    expect(inflate?.depthExtent).toBeLessThanOrEqual(flat?.depthExtent ?? 0);
    expect(inflate?.count ?? 0).toBeGreaterThan(0);
  });

  it('alphaOnly 는 배경 판정을 건너뛴다 — 꽉 찬 마스크가 통째로 날아가지 않는다', () => {
    const solid = makeImage(8, 8, () => [110, 80, 60, 255]);
    const reCarved = carveVoxels(asSource(solid), { ...BASE, grid: 8, alphaOnly: true });
    expect(reCarved?.gridWidth).toBe(8);
    expect(reCarved?.gridHeight).toBe(8);

    const withoutFlag = carveVoxels(asSource(solid), { ...BASE, grid: 8 });
    expect(withoutFlag).toBeNull();
  });
});
