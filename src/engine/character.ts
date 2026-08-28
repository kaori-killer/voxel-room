import {
  GRAVITY,
  JUMP_SPEED,
  MAX_TURN_FROM_CAMERA,
  WALK_SPEED_BASE,
  WALK_SPEED_PER_HEIGHT,
} from '@/domain/constants';
import { clamp, damp, shortestAngleDelta } from '@/lib/math';

export type MoveInputType = {
  forward: number;
  right: number;
};

export type CharacterStateType = {
  vx: number;
  vz: number;
  vy: number;
  phase: number;
  sit: number;
  sitting: boolean;
  onGround: boolean;
  jumpRequested: boolean;
  idleOffset: number;
};

export type CharacterPoseType = {
  bob: number;
  roll: number;
  lean: number;
  scaleY: number;
  scaleXZ: number;
};

export type CharacterBodyType = {
  x: number;
  z: number;
  y: number;
  rot: number;
  height: number;
};

export function createCharacterState(idleOffset = Math.random() * Math.PI * 2): CharacterStateType {
  return {
    vx: 0,
    vz: 0,
    vy: 0,
    phase: 0,
    sit: 0,
    sitting: false,
    onGround: true,
    jumpRequested: false,
    idleOffset,
  };
}

/** 화면 위쪽이 앞이 되도록 카메라 방향으로 입력을 돌린다. */
export function toWorldDirection(input: MoveInputType, cameraYaw: number): { x: number; z: number } {
  const fx = -Math.sin(cameraYaw);
  const fz = -Math.cos(cameraYaw);
  const rx = -fz;
  const rz = fx;
  let x = fx * input.forward + rx * input.right;
  let z = fz * input.forward + rz * input.right;
  const length = Math.hypot(x, z);
  if (length > 1) {
    x /= length;
    z /= length;
  }
  return { x, z };
}

/**
 * 밀어낸 그림이라 옆을 보면 얇다. 늘 카메라 쪽을 보되
 * 가는 방향으로만 살짝 트는 3/4 자세를 유지한다.
 */
export function desiredFacing(vx: number, vz: number, cameraYaw: number): number {
  const speed = Math.hypot(vx, vz);
  if (speed <= 0) return cameraYaw;
  const screenRight = (vx * Math.cos(cameraYaw) - vz * Math.sin(cameraYaw)) / speed;
  return cameraYaw + clamp(screenRight, -1, 1) * MAX_TURN_FROM_CAMERA;
}

export function maxWalkSpeed(height: number): number {
  return WALK_SPEED_BASE + height * WALK_SPEED_PER_HEIGHT;
}

export type StepResultType = {
  body: CharacterBodyType;
  state: CharacterStateType;
  pose: CharacterPoseType;
};

export function stepCharacter(
  body: CharacterBodyType,
  state: CharacterStateType,
  params: {
    dt: number;
    time: number;
    input: MoveInputType;
    cameraYaw: number;
    groundHeight: number;
    clampPosition: (x: number, z: number) => { x: number; z: number };
  },
): StepResultType {
  const { dt, time, cameraYaw, groundHeight } = params;
  const next: CharacterStateType = { ...state };
  const out: CharacterBodyType = { ...body };

  const dir = toWorldDirection(params.input, cameraYaw);
  const speedCap = maxWalkSpeed(out.height);
  const accel = damp(dt, next.onGround ? 15 : 4.5);
  next.vx += (dir.x * speedCap - next.vx) * accel;
  next.vz += (dir.z * speedCap - next.vz) * accel;

  let speed = Math.hypot(next.vx, next.vz);
  if (speed < 0.03) {
    next.vx = 0;
    next.vz = 0;
    speed = 0;
  }

  if (speed > 0) {
    const moved = params.clampPosition(out.x + next.vx * dt, out.z + next.vz * dt);
    out.x = moved.x;
    out.z = moved.z;
    if (speed > 0.2) {
      const want = desiredFacing(next.vx, next.vz, cameraYaw);
      out.rot += shortestAngleDelta(out.rot, want) * damp(dt, 10);
    }
  }

  if (next.jumpRequested && next.onGround && !next.sitting) {
    next.vy = JUMP_SPEED;
    next.onGround = false;
  }
  next.jumpRequested = false;

  if (next.onGround && out.y - groundHeight > 0.06) {
    next.onGround = false;
    next.vy = 0;
  }
  if (!next.onGround) {
    next.vy -= GRAVITY * dt;
    out.y += next.vy * dt;
    if (out.y <= groundHeight) {
      out.y = groundHeight;
      next.vy = 0;
      next.onGround = true;
    }
  } else if (out.y !== groundHeight) {
    out.y += (groundHeight - out.y) * damp(dt, 14);
    if (Math.abs(out.y - groundHeight) < 0.004) out.y = groundHeight;
  }

  next.sit += ((next.sitting ? 1 : 0) - next.sit) * damp(dt, 13);

  return { body: out, state: next, pose: buildPose(next, out, speed, dt, time) };
}

/** 발 디딜 때마다 눌리고 좌우로 흔들리는, 걸음처럼 보이는 최소한의 움직임. */
function buildPose(
  state: CharacterStateType,
  body: CharacterBodyType,
  speed: number,
  dt: number,
  time: number,
): CharacterPoseType {
  let bob = 0;
  let roll = 0;
  let lean = 0;
  let scaleY = 1;
  let scaleXZ = 1;

  if (!state.onGround) {
    lean = -0.1;
    scaleY = 1 + clamp(state.vy * 0.017, -0.09, 0.13);
    scaleXZ = 1 - (scaleY - 1) * 0.55;
    state.phase = 0;
  } else if (speed > 0.12) {
    state.phase += dt * (5 + speed * 1.6);
    const swing = Math.sin(state.phase);
    const lift = Math.abs(swing);
    bob = lift * 0.08 * body.height;
    roll = swing * 0.07;
    lean = -Math.min(0.14, speed * 0.05);
    scaleY = 1 - lift * 0.05;
    scaleXZ = 1 + lift * 0.035;
  } else {
    state.phase *= Math.exp(-dt * 6);
    const breath = Math.sin(time * 1.7 + state.idleOffset);
    bob = breath * 0.007 * body.height;
    scaleY = 1 + breath * 0.013;
    scaleXZ = 1 - breath * 0.009;
  }

  if (state.sit > 0.002) {
    scaleY *= 1 - 0.42 * state.sit;
    scaleXZ *= 1 + 0.13 * state.sit;
    bob *= 1 - state.sit;
    lean += 0.07 * state.sit;
  }

  return { bob, roll, lean, scaleY, scaleXZ };
}
