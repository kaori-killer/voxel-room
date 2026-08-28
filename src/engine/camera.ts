import { CAMERA_FOV } from '@/domain/constants';
import { clamp } from '@/lib/math';

export type ViewStateType = {
  yaw: number;
  pitch: number;
  zoom: number;
};

export type ViewportInsetsType = {
  width: number;
  height: number;
  left: number;
  top: number;
  bottom: number;
};

export type CameraFrameType = {
  distance: number;
  target: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  offset: { x: number; y: number };
  near: number;
  far: number;
};

export const DEFAULT_VIEW: ViewStateType = { yaw: 0, pitch: 0.58, zoom: 1 };

export const MIN_PITCH = 0.18;
export const MAX_PITCH = 1.35;
export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 3.2;

export function clampView(view: ViewStateType): ViewStateType {
  return {
    yaw: view.yaw,
    pitch: clamp(view.pitch, MIN_PITCH, MAX_PITCH),
    zoom: clamp(view.zoom, MIN_ZOOM, MAX_ZOOM),
  };
}

/**
 * UI 가 가리는 만큼을 빼고 남는 자리에 방을 맞춘다.
 * 좁은 화각이라 방이 디오라마처럼 보인다.
 */
export function computeCameraFrame(
  roomSize: number,
  view: ViewStateType,
  insets: ViewportInsetsType,
): CameraFrameType {
  const { width, height } = insets;
  const usableWidth = Math.max(280, width - insets.left);
  const usableHeight = Math.max(220, height - insets.top - insets.bottom);
  const aspect = width / Math.max(1, height);

  const need = roomSize * 1.34;
  const tanHalfFov = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const verticalNeed = Math.max(
    need * (height / usableHeight),
    (need * 1.06) * (width / usableWidth) / aspect,
  );
  const distance = verticalNeed / (2 * tanHalfFov) / view.zoom;

  const targetY = roomSize * 0.12;
  return {
    distance,
    target: { x: 0, y: targetY, z: 0 },
    position: {
      x: Math.cos(view.pitch) * Math.sin(view.yaw) * distance,
      y: Math.sin(view.pitch) * distance + targetY,
      z: Math.cos(view.pitch) * Math.cos(view.yaw) * distance,
    },
    offset: {
      x: -((insets.left + usableWidth / 2) - width / 2),
      y: -((insets.top + usableHeight / 2) - height / 2),
    },
    near: Math.max(0.5, distance * 0.05),
    far: distance * 3.5,
  };
}

export type WallNormalType = { x: number; z: number };

/** 카메라와 방 사이를 가로막는 벽만 감춘다. */
export function isWallVisible(normal: WallNormalType, cameraX: number, cameraZ: number): boolean {
  const length = Math.hypot(cameraX, cameraZ);
  if (length < 1e-6) return normal.z > -0.06;
  const dot = (normal.x * cameraX + normal.z * cameraZ) / length;
  return dot > -0.06;
}
