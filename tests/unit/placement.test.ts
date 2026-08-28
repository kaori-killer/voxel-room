import { describe, expect, it } from 'vitest';
import {
  clampInsideRoom,
  computeFootprint,
  computeRestHeight,
  defaultObjectHeight,
  findFreeSpot,
  resolvePlacement,
} from '@/engine/placement';
import type { PlacementBodyType } from '@/engine/placement';

function body(patch: Partial<PlacementBodyType> = {}): PlacementBodyType {
  return {
    key: 'a', x: 0, z: 0, y: 0, rot: 0, height: 2,
    gridWidth: 10, gridHeight: 20, depthExtent: 6,
    ...patch,
  };
}

describe('computeFootprint', () => {
  it('크기에 비례한다', () => {
    const foot = computeFootprint(body());
    expect(foot.width).toBeCloseTo(1, 5);
    expect(foot.depth).toBeCloseTo(0.6, 5);
  });

  it('45도로 돌리면 두 축 모두 넓어진다', () => {
    const straight = computeFootprint(body());
    const turned = computeFootprint(body({ rot: Math.PI / 4 }));
    expect(turned.width).toBeGreaterThan(straight.width);
    expect(turned.depth).toBeGreaterThan(straight.depth);
  });
});

describe('clampInsideRoom', () => {
  it('벽을 뚫고 나가지 못한다', () => {
    const spot = clampInsideRoom(body(), 10, 99, -99);
    expect(spot.x).toBeCloseTo(4.5, 5);
    expect(spot.z).toBeCloseTo(-4.7, 5);
  });
});

describe('computeRestHeight', () => {
  const table = body({ key: 'table', x: 0, z: 0, height: 1, gridWidth: 40, gridHeight: 20, depthExtent: 40 });

  it('가운데에 정확히 놓으면 위에 올라간다', () => {
    expect(computeRestHeight(body({ key: 'cup' }), 0, 0, [table])).toBe(1);
  });

  it('스쳐 지나가는 위치에서는 바닥에 남는다', () => {
    expect(computeRestHeight(body({ key: 'cup' }), 3, 3, [table])).toBe(0);
  });

  it('자기 자신 위에는 올라가지 않는다', () => {
    expect(computeRestHeight(table, 0, 0, [table])).toBe(0);
  });
});

describe('resolvePlacement', () => {
  it('반 칸 격자에 맞춘다', () => {
    const spot = resolvePlacement(body(), 20, 1.3, -2.4, []);
    expect(spot.x).toBeCloseTo(1.5, 5);
    expect(spot.z).toBeCloseTo(-2.5, 5);
  });
});

describe('defaultObjectHeight', () => {
  it('세로로 긴 그림이 더 크게 선다', () => {
    expect(defaultObjectHeight(10, 40)).toBeGreaterThan(defaultObjectHeight(40, 10));
  });
});

describe('findFreeSpot', () => {
  it('이미 찬 자리를 피한다', () => {
    let step = 0;
    const values = [0.9, 0.9, -0.9, -0.9];
    const random = () => values[step++ % values.length] ?? 0.5;
    const spot = findFreeSpot(12, [{ x: 3.5, z: 3.5 }], random);
    expect(Math.hypot(spot.x - 3.5, spot.z - 3.5)).toBeGreaterThan(1.1);
  });
});
