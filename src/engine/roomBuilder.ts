import { BoxGeometry, Color, Group, InstancedMesh, MeshLambertMaterial, Object3D, SRGBColorSpace } from 'three';
import { ROOM_PALETTE_MAP, TILE_THICKNESS, WALL_HEIGHT } from '@/domain/constants';
import type { RoomSettingsType } from '@/domain/types';
import type { WallNormalType } from './camera';

const scratchObject = new Object3D();
const scratchColor = new Color();

export type WallPanelType = {
  mesh: InstancedMesh;
  normal: WallNormalType;
};

export type RoomMeshesType = {
  group: Group;
  walls: WallPanelType[];
  dispose: () => void;
};

type WallDefType = {
  normal: WallNormalType;
  axis: 'x' | 'z';
  sign: 1 | -1;
};

const WALL_DEFS: WallDefType[] = [
  { normal: { x: 0, z: 1 }, axis: 'z', sign: -1 },
  { normal: { x: 0, z: -1 }, axis: 'z', sign: 1 },
  { normal: { x: 1, z: 0 }, axis: 'x', sign: -1 },
  { normal: { x: -1, z: 0 }, axis: 'x', sign: 1 },
];

const WALL_THICKNESS = 0.4;

function shadeFor(row: number, palette: (typeof ROOM_PALETTE_MAP)[keyof typeof ROOM_PALETTE_MAP]): number {
  if (row === 0) return palette.base;
  return row % 2 ? palette.wallB : palette.wallA;
}

/**
 * 네 벽을 모두 세운다. 어느 벽을 감출지는 카메라가 매 프레임 정한다.
 * 벽은 그림자를 만들지 않으므로 빛의 방향과 무관하게 밝기가 고르다.
 */
export function buildRoomMeshes(settings: RoomSettingsType): RoomMeshesType {
  const palette = ROOM_PALETTE_MAP[settings.palette];
  const size = settings.size;
  const half = size / 2;
  const group = new Group();
  const disposables: (() => void)[] = [];

  const floorGeometry = new BoxGeometry(1, TILE_THICKNESS, 1);
  const floor = new InstancedMesh(floorGeometry, new MeshLambertMaterial({ color: 0xffffff }), size * size);
  floor.receiveShadow = true;
  floor.raycast = () => {};
  let index = 0;
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      scratchObject.position.set(x + 0.5 - half, -TILE_THICKNESS / 2, z + 0.5 - half);
      scratchObject.scale.set(1, 1, 1);
      scratchObject.updateMatrix();
      floor.setMatrixAt(index, scratchObject.matrix);
      floor.setColorAt(index, scratchColor.setHex((x + z) % 2 ? palette.floorB : palette.floorA, SRGBColorSpace));
      index += 1;
    }
  }
  floor.instanceMatrix.needsUpdate = true;
  if (floor.instanceColor) floor.instanceColor.needsUpdate = true;
  group.add(floor);
  disposables.push(() => {
    floor.dispose();
    floor.material.dispose();
    floorGeometry.dispose();
  });

  const walls: WallPanelType[] = WALL_DEFS.map((def) => {
    const geometry = new BoxGeometry(1, 1, 1);
    const mesh = new InstancedMesh(geometry, new MeshLambertMaterial({ color: 0xffffff }), size * WALL_HEIGHT);
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    let i = 0;
    for (let row = 0; row < WALL_HEIGHT; row += 1) {
      const shade = shadeFor(row, palette);
      for (let t = 0; t < size; t += 1) {
        const along = t + 0.5 - half;
        if (def.axis === 'z') {
          scratchObject.position.set(along, row + 0.5, def.sign * (half + WALL_THICKNESS / 2));
          scratchObject.scale.set(1, 1, WALL_THICKNESS);
        } else {
          scratchObject.position.set(def.sign * (half + WALL_THICKNESS / 2), row + 0.5, along);
          scratchObject.scale.set(WALL_THICKNESS, 1, 1);
        }
        scratchObject.updateMatrix();
        mesh.setMatrixAt(i, scratchObject.matrix);
        mesh.setColorAt(i, scratchColor.setHex(shade, SRGBColorSpace));
        i += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    disposables.push(() => {
      mesh.dispose();
      mesh.material.dispose();
      geometry.dispose();
    });
    return { mesh, normal: def.normal };
  });

  // 벽을 서로 겹치게 늘리면 밖으로 삐져나온다. 모서리는 기둥으로 메운다.
  const cornerGeometry = new BoxGeometry(1, 1, 1);
  const corners = new InstancedMesh(
    cornerGeometry,
    new MeshLambertMaterial({ color: 0xffffff }),
    4 * WALL_HEIGHT,
  );
  corners.receiveShadow = true;
  corners.raycast = () => {};
  const offset = half + WALL_THICKNESS / 2;
  let cornerIndex = 0;
  for (let row = 0; row < WALL_HEIGHT; row += 1) {
    const shade = shadeFor(row, palette);
    for (const [cx, cz] of [
      [-offset, -offset],
      [offset, -offset],
      [-offset, offset],
      [offset, offset],
    ] as const) {
      scratchObject.position.set(cx, row + 0.5, cz);
      scratchObject.scale.set(WALL_THICKNESS, 1, WALL_THICKNESS);
      scratchObject.updateMatrix();
      corners.setMatrixAt(cornerIndex, scratchObject.matrix);
      corners.setColorAt(cornerIndex, scratchColor.setHex(shade, SRGBColorSpace));
      cornerIndex += 1;
    }
  }
  corners.instanceMatrix.needsUpdate = true;
  if (corners.instanceColor) corners.instanceColor.needsUpdate = true;
  group.add(corners);
  disposables.push(() => {
    corners.dispose();
    corners.material.dispose();
    cornerGeometry.dispose();
  });

  scratchObject.scale.set(1, 1, 1);

  return {
    group,
    walls,
    dispose: () => disposables.forEach((fn) => fn()),
  };
}
