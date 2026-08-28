import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  AmbientLight,
  InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { VoxelDataType } from '@/domain/types';

const UNIT_BOX = new BoxGeometry(1, 1, 1);
const scratchObject = new Object3D();
const scratchColor = new Color();

export type VoxelMeshType = InstancedMesh<BoxGeometry, MeshLambertMaterial>;

export function buildVoxelMesh(data: VoxelDataType, castShadow: boolean): VoxelMeshType {
  const material = new MeshLambertMaterial({ color: 0xffffff });
  const mesh: VoxelMeshType = new InstancedMesh(UNIT_BOX, material, data.count);
  mesh.raycast = () => {};
  mesh.frustumCulled = false;

  for (let i = 0; i < data.count; i += 1) {
    scratchObject.position.set(
      data.positions[i * 3] ?? 0,
      data.positions[i * 3 + 1] ?? 0,
      data.positions[i * 3 + 2] ?? 0,
    );
    scratchObject.updateMatrix();
    mesh.setMatrixAt(i, scratchObject.matrix);
    const o = i * 4;
    scratchColor.setRGB(data.colors[o] ?? 0, data.colors[o + 1] ?? 0, data.colors[o + 2] ?? 0, SRGBColorSpace);
    scratchColor.multiplyScalar(data.colors[o + 3] ?? 1);
    mesh.setColorAt(i, scratchColor);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  if (castShadow) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return mesh;
}

export function disposeMesh(mesh: VoxelMeshType): void {
  mesh.dispose();
  mesh.material.dispose();
}

const THUMB_SIZE = 160;

type ThumbnailRigType = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
};

let thumbnailRig: ThumbnailRigType | null = null;

function getThumbnailRig(): ThumbnailRigType | null {
  if (thumbnailRig) return thumbnailRig;
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.add(new HemisphereLight(0xe4ecff, 0x77809b, 1));
  const key = new DirectionalLight(0xfff4e2, 1.25);
  key.position.set(-0.6, 1, 0.8);
  const fill = new DirectionalLight(0xc9d8ff, 0.4);
  fill.position.set(0.8, 0.2, 0.5);
  scene.add(key, fill, new AmbientLight(0xffffff, 0.15));

  thumbnailRig = { renderer, scene, camera: new OrthographicCamera(-1, 1, 1, -1, -600, 600) };
  return thumbnailRig;
}

/** 보관함 카드에 쓰는 정사각 썸네일. 실패하면 호출자가 대체 이미지를 쓴다. */
export function renderThumbnail(data: VoxelDataType): string | null {
  const rig = getThumbnailRig();
  if (!rig) return null;
  const mesh = buildVoxelMesh(data, false);
  mesh.position.y = -data.gridHeight / 2;
  const group = new Group();
  group.add(mesh);
  group.rotation.set(0.18, -0.5, 0);
  rig.scene.add(group);

  const radius = Math.max(data.gridWidth, data.gridHeight) * 0.62;
  rig.camera.left = -radius;
  rig.camera.right = radius;
  rig.camera.top = radius;
  rig.camera.bottom = -radius;
  rig.camera.position.set(0, 0, 400);
  rig.camera.updateProjectionMatrix();
  rig.renderer.render(rig.scene, rig.camera);

  const url = rig.renderer.domElement.toDataURL('image/png');
  rig.scene.remove(group);
  disposeMesh(mesh);
  return url;
}

let glowTexture: CanvasTexture | null = null;

export function getGlowTexture(): CanvasTexture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.28, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.10)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  glowTexture = new CanvasTexture(canvas);
  glowTexture.colorSpace = SRGBColorSpace;
  return glowTexture;
}
