'use client';

import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  CircleGeometry,
  Clock,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { VoxelDataType } from '@/domain/types';
import { buildVoxelMesh, disposeMesh } from '@/engine/meshFactory';
import { createCharacterState, stepCharacter, type CharacterStateType } from '@/engine/character';
import { clamp } from '@/lib/math';
import styles from './landing.module.css';

/**
 * 랜딩 배경에 조작 불가한 복셀 캐릭터 몇 마리가 잔디밭을 자동으로 돌아다니는 장식 씬.
 * 방 엔진(RoomScene)은 재사용하지 않고, 순수 함수인 stepCharacter 와 buildVoxelMesh 만 빌려
 * 가벼운 독립 캔버스로 그린다. 그림자·후처리 없음, DPR·프레임 상한, 화면 밖이면 정지.
 */

// 동물의 숲 톤 파스텔 — [몸통, 머리(밝게), 눈] 순.
const PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#8fd6b4', '#a9e3c6', '#3a4a44'],
  ['#f4b8a0', '#f8cbb8', '#5a3f38'],
  ['#9cc7f0', '#b6d7f5', '#37485c'],
  ['#f2d99a', '#f7e6b8', '#5c4f30'],
  ['#c3b1e8', '#d3c6ef', '#453a5c'],
  ['#f2a0a8', '#f6bcc1', '#5c3a3f'],
];

const AREA_X = 6.6;
const AREA_Z = 3.4;
const CHAR_HEIGHT = 1.35;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * 3×5×2 격자의 작고 둥근 복셀 캐릭터를 손으로 쌓는다.
 * 발은 y=0, 정면(눈)은 +Z 라 카메라를 바라본다.
 */
function buildCharacterData(palette: readonly [string, string, string]): VoxelDataType {
  const [bodyHex, headHex, eyeHex] = palette;
  const body = hexToRgb(bodyHex);
  const head = hexToRgb(headHex);
  const eye = hexToRgb(eyeHex);

  const positions: number[] = [];
  const colors: number[] = [];
  const add = (x: number, y: number, z: number, rgb: [number, number, number]) => {
    positions.push(x, y, z - 0.5);
    colors.push(rgb[0], rgb[1], rgb[2], 1);
  };

  for (let y = 0; y <= 4; y += 1) {
    const isHead = y >= 3;
    for (let x = -1; x <= 1; x += 1) {
      for (let z = 0; z <= 1; z += 1) {
        // 머리 맨 위 앞뒤 모서리를 깎아 살짝 둥글린다.
        if (y === 4 && Math.abs(x) === 1 && z !== 1) continue;
        let rgb = isHead ? head : body;
        if (y === 3 && Math.abs(x) === 1 && z === 1) rgb = eye; // 정면 두 눈
        add(x, y, z, rgb);
      }
    }
  }

  const count = colors.length / 4;
  return {
    gridWidth: 3,
    gridHeight: 5,
    depthExtent: 2,
    count,
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    maskPng: '',
  };
}

type Walker = {
  group: Group;
  inner: Group;
  shadow: Mesh;
  data: VoxelDataType;
  char: CharacterStateType;
  body: { x: number; z: number; y: number; rot: number; height: number };
  heading: number;
  headingTimer: number;
  speed: number;
};

export function VoxelParade() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return undefined; // WebGL 불가 환경은 CSS 배경만 보이면 충분하다.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = SRGBColorSpace;

    const scene = new Scene();
    scene.add(new AmbientLight(0xfff6e6, 0.55));
    scene.add(new HemisphereLight(0xdff3ff, 0x9fd479, 0.85));
    const key = new DirectionalLight(0xfff3d8, 1.0);
    key.position.set(-0.7, 1.4, 0.9);
    scene.add(key);

    const FOV = 24;
    const PITCH = 0.5;
    const camera = new PerspectiveCamera(FOV, 1, 0.5, 200);
    // 세로로 긴 화면(모바일)일수록 카메라를 물려 캐릭터가 작게, 덜 겹치게 보이도록.
    const placeCamera = (aspect: number) => {
      const tanH = Math.tan((FOV * Math.PI) / 360) * aspect;
      const distance = clamp((AREA_X + 1.2) / Math.max(0.05, tanH), 25, 44);
      camera.position.set(0, Math.sin(PITCH) * distance, Math.cos(PITCH) * distance);
      // 시선을 살짝 위로 둬 잔디(바닥 y=0)와 캐릭터가 화면 아래쪽에 깔리게 한다.
      camera.lookAt(0, 3, 0);
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = window.matchMedia('(max-width: 640px)').matches ? 3 : 5;

    const shadowGeometry = new CircleGeometry(0.5, 18);
    const shadowMaterial = new MeshBasicMaterial({ color: 0x2a3320, transparent: true, opacity: 0.12, depthWrite: false });

    const walkers: Walker[] = [];
    for (let i = 0; i < count; i += 1) {
      const data = buildCharacterData(PALETTES[i % PALETTES.length]!);
      const mesh = buildVoxelMesh(data, false);
      const inner = new Group();
      const scale = CHAR_HEIGHT / data.gridHeight;
      inner.scale.setScalar(scale);
      inner.add(mesh);
      const group = new Group();
      group.add(inner);
      // 겹치지 않게 가로로 흩뿌리고 앞뒤로 살짝 어긋나게 시작.
      const x = ((i + 0.5) / count - 0.5) * (AREA_X * 1.7);
      const z = (i % 2 === 0 ? -1 : 1) * AREA_Z * 0.4;
      group.position.set(x, 0, z);
      scene.add(group);

      const shadow = new Mesh(shadowGeometry, shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.02, z);
      scene.add(shadow);

      walkers.push({
        group,
        inner,
        shadow,
        data,
        char: createCharacterState(),
        body: { x, z, y: 0, rot: 0, height: CHAR_HEIGHT },
        heading: Math.random() * Math.PI * 2,
        headingTimer: 1 + Math.random() * 3,
        speed: 0.5,
      });
    }

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      placeCamera(camera.aspect);
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const clampPosition = (x: number, z: number) => ({
      x: clamp(x, -AREA_X, AREA_X),
      z: clamp(z, -AREA_Z, AREA_Z),
    });

    const step = (dt: number, time: number) => {
      for (const w of walkers) {
        w.headingTimer -= dt;
        if (w.headingTimer <= 0) {
          // 가끔 멈춰 쉬고, 아니면 새 방향으로.
          w.speed = Math.random() < 0.25 ? 0 : 0.4 + Math.random() * 0.3;
          w.heading = Math.random() * Math.PI * 2;
          w.headingTimer = 2 + Math.random() * 3.5;
        }
        // 가장자리에 닿으면 중심 쪽으로 방향을 튼다.
        if (Math.abs(w.body.x) > AREA_X * 0.82 || Math.abs(w.body.z) > AREA_Z * 0.82) {
          w.heading = Math.atan2(-w.body.z, -w.body.x);
          w.speed = Math.max(w.speed, 0.45);
        }
        const wx = Math.cos(w.heading) * w.speed;
        const wz = Math.sin(w.heading) * w.speed;
        // cameraYaw=0 기준: input.right→+x, input.forward→-z.
        const result = stepCharacter(w.body, w.char, {
          dt,
          time,
          input: { forward: -wz, right: wx },
          cameraYaw: 0,
          groundHeight: 0,
          clampPosition,
        });
        w.body = result.body;
        w.char = result.state;

        const scale = w.body.height / w.data.gridHeight;
        w.group.position.set(w.body.x, w.body.y, w.body.z);
        w.group.rotation.y = w.body.rot;
        w.inner.position.y = result.pose.bob;
        w.inner.rotation.set(result.pose.lean, 0, result.pose.roll);
        w.inner.scale.set(scale * result.pose.scaleXZ, scale * result.pose.scaleY, scale * result.pose.scaleXZ);
        w.shadow.position.set(w.body.x, 0.02, w.body.z);
      }
    };

    const clock = new Clock();
    let frame = 0;
    let running = true;
    let accum = 0;
    const FRAME_MIN = 1 / 32; // 프레임 상한 ~32fps.

    const loop = () => {
      if (!running) return;
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      accum += dt;
      if (accum < FRAME_MIN) return;
      step(accum, clock.elapsedTime);
      accum = 0;
      renderer.render(scene, camera);
    };

    const renderOnce = () => {
      step(0, 0);
      renderer.render(scene, camera);
    };

    const start = () => {
      if (running && frame) return;
      running = true;
      clock.getDelta(); // 백그라운드 복귀 시 큰 dt 방지.
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    // 캔버스가 화면 밖이거나 탭이 숨으면 루프를 멈춰 배터리를 아낀다.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (reduceMotion) return;
        if (entry?.isIntersecting) start();
        else stop();
      },
      { threshold: 0.01 },
    );
    observer.observe(canvas);

    const onVisibility = () => {
      if (reduceMotion) return;
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (reduceMotion) {
      renderOnce();
    } else {
      start();
    }

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      for (const w of walkers) {
        disposeMesh(w.inner.children[0] as ReturnType<typeof buildVoxelMesh>);
      }
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.parade} aria-hidden="true" />;
}
