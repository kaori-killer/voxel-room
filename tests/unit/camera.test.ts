import { describe, expect, it } from 'vitest';
import { clampView, computeCameraFrame, isWallVisible, MAX_ZOOM, MIN_PITCH } from '@/engine/camera';

const insets = { width: 1440, height: 900, left: 292, top: 0, bottom: 0 };

describe('computeCameraFrame', () => {
  it('보관함이 가린 만큼 방을 오른쪽으로 민다', () => {
    const frame = computeCameraFrame(12, { yaw: 0, pitch: 0.58, zoom: 1 }, insets);
    expect(frame.offset.x).toBeCloseTo(-146, 0);
    expect(frame.offset.y).toBeCloseTo(0, 6);
  });

  it('모바일에서는 아래 시트만큼 위로 올린다', () => {
    const frame = computeCameraFrame(12, { yaw: 0, pitch: 0.58, zoom: 1 }, {
      width: 390, height: 844, left: 0, top: 62, bottom: 200,
    });
    expect(frame.offset.y).toBeGreaterThan(0);
  });

  it('확대하면 카메라가 가까워진다', () => {
    const near = computeCameraFrame(12, { yaw: 0, pitch: 0.58, zoom: 2 }, insets);
    const far = computeCameraFrame(12, { yaw: 0, pitch: 0.58, zoom: 1 }, insets);
    expect(near.distance).toBeLessThan(far.distance);
  });

  it('방이 커지면 더 멀리서 본다', () => {
    const small = computeCameraFrame(10, { yaw: 0, pitch: 0.58, zoom: 1 }, insets);
    const big = computeCameraFrame(16, { yaw: 0, pitch: 0.58, zoom: 1 }, insets);
    expect(big.distance).toBeGreaterThan(small.distance);
  });
});

describe('clampView', () => {
  it('시점이 뒤집히지 않게 막는다', () => {
    expect(clampView({ yaw: 0, pitch: -5, zoom: 1 }).pitch).toBe(MIN_PITCH);
    expect(clampView({ yaw: 0, pitch: 0.5, zoom: 99 }).zoom).toBe(MAX_ZOOM);
  });
});

describe('isWallVisible', () => {
  it('정면에서 보면 뒷벽과 옆벽만 남는다', () => {
    expect(isWallVisible({ x: 0, z: 1 }, 0, 10)).toBe(true);
    expect(isWallVisible({ x: 0, z: -1 }, 0, 10)).toBe(false);
    expect(isWallVisible({ x: 1, z: 0 }, 0, 10)).toBe(true);
    expect(isWallVisible({ x: -1, z: 0 }, 0, 10)).toBe(true);
  });

  it('45도에서는 두 면만 남는다', () => {
    const visible = [
      isWallVisible({ x: 0, z: 1 }, 7, 7),
      isWallVisible({ x: 1, z: 0 }, 7, 7),
      isWallVisible({ x: 0, z: -1 }, 7, 7),
      isWallVisible({ x: -1, z: 0 }, 7, 7),
    ];
    expect(visible.filter(Boolean)).toHaveLength(2);
  });
});
