import { describe, expect, it } from 'vitest';
import { createCharacterState, desiredFacing, maxWalkSpeed, stepCharacter, toWorldDirection } from '@/engine/character';
import type { CharacterBodyType } from '@/engine/character';

const noClamp = (x: number, z: number) => ({ x, z });
const body = (patch: Partial<CharacterBodyType> = {}): CharacterBodyType => ({
  x: 0, z: 0, y: 0, rot: 0, height: 2, ...patch,
});

function run(steps: number, input: { forward: number; right: number }, start = body()) {
  let current = start;
  let state = createCharacterState(0);
  for (let i = 0; i < steps; i += 1) {
    const result = stepCharacter(current, state, {
      dt: 1 / 60, time: i / 60, input, cameraYaw: 0, groundHeight: 0, clampPosition: noClamp,
    });
    current = result.body;
    state = result.state;
  }
  return { body: current, state };
}

describe('toWorldDirection', () => {
  it('카메라가 정면일 때 앞은 -z 다', () => {
    const dir = toWorldDirection({ forward: 1, right: 0 }, 0);
    expect(dir.x).toBeCloseTo(0, 5);
    expect(dir.z).toBeCloseTo(-1, 5);
  });

  it('카메라를 90도 돌리면 앞도 함께 돈다', () => {
    const dir = toWorldDirection({ forward: 1, right: 0 }, Math.PI / 2);
    expect(dir.x).toBeCloseTo(-1, 5);
    expect(dir.z).toBeCloseTo(0, 5);
  });

  it('대각선 입력이 더 빨라지지 않는다', () => {
    const dir = toWorldDirection({ forward: 1, right: 1 }, 0);
    expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1, 5);
  });
});

describe('desiredFacing', () => {
  it('카메라 쪽을 보되 진행 방향으로만 살짝 튼다', () => {
    const right = desiredFacing(1, 0, 0);
    const left = desiredFacing(-1, 0, 0);
    expect(right).toBeGreaterThan(0);
    expect(left).toBeLessThan(0);
    expect(Math.abs(right)).toBeLessThan(Math.PI / 2);
  });

  it('카메라 반대로 걸어도 뒤돌지 않는다', () => {
    expect(Math.abs(desiredFacing(0, -1, 0))).toBeLessThan(0.1);
  });
});

describe('stepCharacter', () => {
  it('앞으로 누르면 -z 로 간다', () => {
    const { body: moved } = run(60, { forward: 1, right: 0 });
    expect(moved.z).toBeLessThan(-1);
  });

  it('입력을 놓으면 멈춘다', () => {
    const walked = run(60, { forward: 1, right: 0 });
    let current = walked.body;
    let state = walked.state;
    for (let i = 0; i < 60; i += 1) {
      const result = stepCharacter(current, state, {
        dt: 1 / 60, time: i, input: { forward: 0, right: 0 }, cameraYaw: 0, groundHeight: 0, clampPosition: noClamp,
      });
      current = result.body;
      state = result.state;
    }
    expect(Math.hypot(state.vx, state.vz)).toBeLessThan(0.05);
  });

  it('점프하면 떴다가 다시 바닥으로 내려온다', () => {
    let current = body();
    let state = createCharacterState(0);
    state.jumpRequested = true;
    let peak = 0;
    for (let i = 0; i < 120; i += 1) {
      const result = stepCharacter(current, state, {
        dt: 1 / 60, time: i / 60, input: { forward: 0, right: 0 }, cameraYaw: 0, groundHeight: 0, clampPosition: noClamp,
      });
      current = result.body;
      state = result.state;
      peak = Math.max(peak, current.y);
    }
    expect(peak).toBeGreaterThan(0.8);
    expect(current.y).toBeCloseTo(0, 3);
    expect(state.onGround).toBe(true);
  });

  it('턱에서는 떨어진다', () => {
    let current = body({ y: 1 });
    let state = createCharacterState(0);
    for (let i = 0; i < 90; i += 1) {
      const result = stepCharacter(current, state, {
        dt: 1 / 60, time: i / 60, input: { forward: 0, right: 0 }, cameraYaw: 0, groundHeight: 0, clampPosition: noClamp,
      });
      current = result.body;
      state = result.state;
    }
    expect(current.y).toBeCloseTo(0, 3);
  });

  it('앉으면 세로로 눌린다', () => {
    let current = body();
    let state = createCharacterState(0);
    state.sitting = true;
    let pose = { scaleY: 1 };
    for (let i = 0; i < 60; i += 1) {
      const result = stepCharacter(current, state, {
        dt: 1 / 60, time: i / 60, input: { forward: 0, right: 0 }, cameraYaw: 0, groundHeight: 0, clampPosition: noClamp,
      });
      current = result.body;
      state = result.state;
      pose = result.pose;
    }
    expect(pose.scaleY).toBeLessThan(0.7);
  });

  it('벽 밖으로 나가지 않는다', () => {
    let current = body();
    let state = createCharacterState(0);
    for (let i = 0; i < 300; i += 1) {
      const result = stepCharacter(current, state, {
        dt: 1 / 60, time: i / 60, input: { forward: 1, right: 0 }, cameraYaw: 0, groundHeight: 0,
        clampPosition: (x, z) => ({ x, z: Math.max(-3, z) }),
      });
      current = result.body;
      state = result.state;
    }
    expect(current.z).toBeCloseTo(-3, 5);
  });
});

describe('maxWalkSpeed', () => {
  it('큰 오브제가 더 성큼 걷는다', () => {
    expect(maxWalkSpeed(4)).toBeGreaterThan(maxWalkSpeed(1));
  });
});
