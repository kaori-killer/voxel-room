import { MAX_OBJECT_HEIGHT, MIN_OBJECT_HEIGHT, SNAP_STEP } from '@/domain/constants';
import { clamp, snapTo } from '@/lib/math';

export type FootprintType = { width: number; depth: number };

export type PlacementBodyType = {
  key: string;
  x: number;
  z: number;
  y: number;
  rot: number;
  height: number;
  gridWidth: number;
  gridHeight: number;
  depthExtent: number;
};

/** 회전을 반영해 바닥에 실제로 깔리는 사각형 크기. */
export function computeFootprint(body: PlacementBodyType): FootprintType {
  const scale = body.height / body.gridHeight;
  const w = body.gridWidth * scale;
  const d = body.depthExtent * scale;
  const c = Math.abs(Math.cos(body.rot));
  const s = Math.abs(Math.sin(body.rot));
  return { width: w * c + d * s, depth: w * s + d * c };
}

export function clampInsideRoom(
  body: PlacementBodyType,
  roomSize: number,
  x: number,
  z: number,
): { x: number; z: number } {
  const half = roomSize / 2;
  const foot = computeFootprint(body);
  return {
    x: clamp(x, -half + foot.width / 2, half - foot.width / 2),
    z: clamp(z, -half + foot.depth / 2, half - foot.depth / 2),
  };
}

/**
 * 다른 개체 '위에' 정확히 놓았을 때만 얹는다.
 * 스쳐 지나가는 것으로 올라가면 배치가 예측 불가능해진다.
 */
export function computeRestHeight(
  body: PlacementBodyType,
  x: number,
  z: number,
  others: readonly PlacementBodyType[],
): number {
  let top = 0;
  for (const other of others) {
    if (other.key === body.key) continue;
    const foot = computeFootprint(other);
    if (Math.abs(other.x - x) < foot.width / 2 && Math.abs(other.z - z) < foot.depth / 2) {
      top = Math.max(top, other.y + other.height);
    }
  }
  return top;
}

export function resolvePlacement(
  body: PlacementBodyType,
  roomSize: number,
  targetX: number,
  targetZ: number,
  others: readonly PlacementBodyType[],
): { x: number; z: number; y: number } {
  const snapped = clampInsideRoom(body, roomSize, snapTo(targetX, SNAP_STEP), snapTo(targetZ, SNAP_STEP));
  return { ...snapped, y: computeRestHeight(body, snapped.x, snapped.z, others) };
}

export function clampObjectHeight(height: number): number {
  return clamp(height, MIN_OBJECT_HEIGHT, MAX_OBJECT_HEIGHT);
}

/** 그림 비율에 맞춘 기본 크기. 가로로 긴 그림이 벽처럼 서는 것을 막는다. */
export function defaultObjectHeight(gridWidth: number, gridHeight: number): number {
  const ratio = gridHeight / Math.max(gridWidth, gridHeight);
  return clampObjectHeight(2.6 * ratio + 0.8);
}

export function findFreeSpot(
  roomSize: number,
  occupied: readonly { x: number; z: number }[],
  random: () => number = Math.random,
): { x: number; z: number } {
  const half = roomSize / 2 - 1.5;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = snapTo((random() * 2 - 1) * half, SNAP_STEP);
    const z = snapTo((random() * 2 - 1) * half, SNAP_STEP);
    const clash = occupied.some((o) => Math.abs(o.x - x) < 1.2 && Math.abs(o.z - z) < 1.2);
    if (!clash) return { x, z };
  }
  return { x: 0, z: 0 };
}
