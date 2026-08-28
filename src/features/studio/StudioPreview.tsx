'use client';

import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { VoxelMeshType } from '@/engine/meshFactory';
import type { VoxelDataType } from '@/domain/types';
import styles from './studio.module.css';

export type StudioPreviewProps = {
  data: VoxelDataType | null;
  source: HTMLImageElement;
  buildMesh: (data: VoxelDataType, castShadow: boolean) => VoxelMeshType;
  disposeMesh: (mesh: VoxelMeshType) => void;
};

/** 깎은 결과를 돌려 보는 작은 뷰어. 방 씬과 렌더러를 나눠 서로 간섭하지 않는다. */
export function StudioPreview({ data, source, buildMesh, disposeMesh }: StudioPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meshRef = useRef<VoxelMeshType | null>(null);
  const groupRef = useRef<Group | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const stateRef = useRef({ yaw: -0.5, pitch: 0.22, auto: true, distance: 100, dragging: false, x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    const scene = new Scene();
    const group = new Group();
    scene.add(group);
    scene.add(new HemisphereLight(0xe4ecff, 0x77809b, 1));
    const key = new DirectionalLight(0xfff4e2, 1.2);
    key.position.set(-0.55, 0.95, 0.75);
    const fill = new DirectionalLight(0xc9d8ff, 0.42);
    fill.position.set(0.8, 0.15, 0.55);
    scene.add(key, fill, new AmbientLight(0xffffff, 0.12));
    const camera = new PerspectiveCamera(30, 1, 0.5, 4000);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    groupRef.current = group;

    let frame = 0;
    const loop = (): void => {
      frame = requestAnimationFrame(loop);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      if (canvas.width !== Math.round(width * renderer.getPixelRatio())) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const state = stateRef.current;
      if (state.auto) state.yaw += 0.006;
      group.rotation.set(state.pitch, state.yaw, 0);
      camera.position.set(0, 0, state.distance);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      if (meshRef.current) disposeMesh(meshRef.current);
      meshRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [disposeMesh]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    if (meshRef.current) {
      group.remove(meshRef.current);
      disposeMesh(meshRef.current);
      meshRef.current = null;
    }
    if (!data) return;
    const mesh = buildMesh(data, false);
    mesh.position.y = -data.gridHeight / 2;
    group.add(mesh);
    meshRef.current = mesh;
    stateRef.current.distance = Math.max(data.gridWidth, data.gridHeight) * 2.4;
  }, [data, buildMesh, disposeMesh]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const state = stateRef.current;
    state.dragging = true;
    state.auto = false;
    state.x = event.clientX;
    state.y = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const state = stateRef.current;
    if (!state.dragging) return;
    state.yaw += (event.clientX - state.x) * 0.011;
    state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch + (event.clientY - state.y) * 0.011));
    state.x = event.clientX;
    state.y = event.clientY;
  };

  const handlePointerUp = (): void => {
    stateRef.current.dragging = false;
  };

  return (
    <div className={styles.preview}>
      <canvas
        ref={canvasRef}
        className={styles.previewCanvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <img className={styles.source} src={source.src} alt="" />
      <span className={styles.previewTip}>끌어서 돌려 보기</span>
    </div>
  );
}
