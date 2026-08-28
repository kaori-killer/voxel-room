import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  AdditiveBlending,
} from 'three';
import {
  CAMERA_FOV,
  DEFAULT_LAMP_BRIGHT,
  DEFAULT_LAMP_TINT,
  INTERACT_RANGE,
  LAMP_TINT_MAP,
  ROOM_PALETTE_MAP,
} from '@/domain/constants';
import type {
  LampStateType,
  PlacedObjectType,
  RoomSettingsType,
  TraitSetType,
  VoxelDataType,
} from '@/domain/types';
import { buildLocalId } from '@/lib/id';
import { clamp } from '@/lib/math';
import { clampView, computeCameraFrame, DEFAULT_VIEW, isWallVisible } from './camera';
import type { ViewportInsetsType, ViewStateType } from './camera';
import {
  clampInsideRoom,
  clampObjectHeight,
  computeFootprint,
  computeRestHeight,
  resolvePlacement,
} from './placement';
import type { PlacementBodyType } from './placement';
import { createCharacterState, stepCharacter } from './character';
import type { CharacterStateType, MoveInputType } from './character';
import { buildRoomMeshes } from './roomBuilder';
import type { RoomMeshesType } from './roomBuilder';
import { buildVoxelMesh, disposeMesh, getGlowTexture } from './meshFactory';
import type { VoxelMeshType } from './meshFactory';

export type InteractHintType = {
  key: string;
  itemId: string;
  screenX: number;
  screenY: number;
};

export type RoomSceneEventsType = {
  onSelectionChange: (key: string | null) => void;
  onInteractHintChange: (hint: InteractHintType | null) => void;
  onActiveCharacterChange: (key: string | null) => void;
  onRoomChange: () => void;
};

export type RoomSceneDepsType = {
  getTraits: (itemId: string) => TraitSetType;
};

type SceneObjectType = {
  key: string;
  itemId: string;
  group: Group;
  inner: Group;
  mesh: VoxelMeshType;
  data: VoxelDataType;
  x: number;
  z: number;
  y: number;
  rot: number;
  height: number;
  lamp: LampStateType;
  lampLight: PointLight | null;
  lampGlow: Sprite | null;
  character: CharacterStateType | null;
  musicPulse: number;
  musicPhase: number;
  musicDirty: boolean;
};

const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const MARKER_COLOR = 0x18b39c;

export class RoomScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly events: RoomSceneEventsType;
  private readonly deps: RoomSceneDepsType;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.5, 900);
  private readonly clock = new Clock();
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hitPoint = new Vector3();
  private readonly projected = new Vector3();
  private readonly scratchColor = new Color();

  private readonly keyLight: DirectionalLight;
  private readonly fillLight: DirectionalLight;
  private readonly markerLine: Line;
  private readonly markerPlane: Mesh;

  private roomMeshes: RoomMeshesType | null = null;
  private settings: RoomSettingsType;
  private view: ViewStateType = { ...DEFAULT_VIEW };
  private insets: ViewportInsetsType = { width: 1, height: 1, left: 0, top: 0, bottom: 0 };
  private objects: SceneObjectType[] = [];
  private selectedKey: string | null = null;
  private activeCharacterKey: string | null = null;
  private interactKey: string | null = null;
  private moveInput: MoveInputType = { forward: 0, right: 0 };
  private musicItemId: string | null = null;
  private musicPlaying = false;
  private readOnly = false;
  private frameHandle = 0;
  private disposed = false;

  private drag:
    | { mode: 'orbit'; startX: number; startY: number; yaw: number; pitch: number }
    | { mode: 'move'; key: string; offsetX: number; offsetZ: number; moved: boolean }
    | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch: { distance: number; zoom: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    settings: RoomSettingsType,
    events: RoomSceneEventsType,
    deps: RoomSceneDepsType,
  ) {
    this.canvas = canvas;
    this.events = events;
    this.deps = deps;
    this.settings = settings;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene.add(new AmbientLight(0xfff4e4, 0.22));
    this.scene.add(new HemisphereLight(0xfff4e2, 0xc0b5a2, 0.95));
    this.keyLight = new DirectionalLight(0xfff0d2, 1.05);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0009;
    this.keyLight.shadow.normalBias = 0.08;
    this.fillLight = new DirectionalLight(0xe8ecff, 0.42);
    this.scene.add(this.keyLight, this.keyLight.target, this.fillLight);

    const markerGeometry = new BufferGeometry();
    markerGeometry.setAttribute('position', new BufferAttribute(new Float32Array(15), 3));
    const markerMaterial = new LineBasicMaterial({ color: MARKER_COLOR, transparent: true, opacity: 0.95 });
    markerMaterial.depthTest = false;
    this.markerLine = new Line(markerGeometry, markerMaterial);
    this.markerLine.visible = false;
    this.markerLine.renderOrder = 5;

    this.markerPlane = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ color: MARKER_COLOR, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    this.markerPlane.rotation.x = -Math.PI / 2;
    this.markerPlane.visible = false;
    this.scene.add(this.markerLine, this.markerPlane);

    this.rebuildRoom();
    this.attachPointerHandlers();
  }

  /* ------------------------------------------------------------------ 수명 */

  start(): void {
    if (this.frameHandle) return;
    const loop = (): void => {
      if (this.disposed) return;
      this.frameHandle = requestAnimationFrame(loop);
      this.tick();
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    this.detachPointerHandlers();
    this.objects.slice().forEach((object) => this.removeObject(object.key, true));
    this.roomMeshes?.dispose();
    this.renderer.dispose();
  }

  /* -------------------------------------------------------------- 방 설정 */

  setSettings(settings: RoomSettingsType): void {
    this.settings = settings;
    this.rebuildRoom();
    this.objects.forEach((object) => {
      const clamped = clampInsideRoom(toBody(object), settings.size, object.x, object.z);
      object.x = clamped.x;
      object.z = clamped.z;
      this.applyTransform(object);
    });
    this.updateCamera();
  }

  getSettings(): RoomSettingsType {
    return this.settings;
  }

  setReadOnly(value: boolean): void {
    this.readOnly = value;
    if (value) this.select(null);
  }

  setInsets(insets: ViewportInsetsType): void {
    this.insets = insets;
    this.renderer.setSize(insets.width, insets.height, false);
    this.updateCamera();
  }

  setView(next: Partial<ViewStateType>): void {
    this.view = clampView({ ...this.view, ...next });
    this.updateCamera();
  }

  resetView(): void {
    this.setView({ ...DEFAULT_VIEW });
  }

  getView(): ViewStateType {
    return { ...this.view };
  }

  private rebuildRoom(): void {
    if (this.roomMeshes) {
      this.scene.remove(this.roomMeshes.group);
      this.roomMeshes.dispose();
    }
    this.roomMeshes = buildRoomMeshes(this.settings);
    this.scene.add(this.roomMeshes.group);

    const size = this.settings.size;
    this.keyLight.position.set(size * 0.5, size * 1.7, size * 0.7);
    this.fillLight.position.set(-size * 0.8, size * 0.55, -size * 0.4);
    const shadow = this.keyLight.shadow.camera;
    shadow.left = -size * 1.2;
    shadow.right = size * 1.2;
    shadow.top = size * 1.2;
    shadow.bottom = -size * 1.2;
    shadow.near = 0.5;
    shadow.far = size * 5;
    shadow.updateProjectionMatrix();
    this.updateWallVisibility();
  }

  getPaletteSky(): { from: string; to: string } {
    const palette = ROOM_PALETTE_MAP[this.settings.palette];
    return { from: palette.sky1, to: palette.sky2 };
  }

  private updateCamera(): void {
    const frame = computeCameraFrame(this.settings.size, this.view, this.insets);
    this.camera.aspect = this.insets.width / Math.max(1, this.insets.height);
    this.camera.position.set(frame.position.x, frame.position.y, frame.position.z);
    this.camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
    this.camera.near = frame.near;
    this.camera.far = frame.far;
    this.camera.setViewOffset(
      this.insets.width,
      this.insets.height,
      frame.offset.x,
      frame.offset.y,
      this.insets.width,
      this.insets.height,
    );
    this.updateWallVisibility();
  }

  private updateWallVisibility(): void {
    if (!this.roomMeshes) return;
    for (const wall of this.roomMeshes.walls) {
      wall.mesh.visible = isWallVisible(wall.normal, this.camera.position.x, this.camera.position.z);
    }
  }

  /* -------------------------------------------------------------- 개체 */

  addObject(placed: PlacedObjectType, data: VoxelDataType, traits: TraitSetType): void {
    const group = new Group();
    const inner = new Group();
    const mesh = buildVoxelMesh(data, true);
    inner.add(mesh);
    group.add(inner);
    this.scene.add(group);

    const object: SceneObjectType = {
      key: placed.key,
      itemId: placed.itemId,
      group,
      inner,
      mesh,
      data,
      x: placed.x,
      z: placed.z,
      y: placed.y,
      rot: placed.rot,
      height: clampObjectHeight(placed.height),
      lamp: placed.lamp ?? { on: true, bright: DEFAULT_LAMP_BRIGHT, tint: DEFAULT_LAMP_TINT },
      lampLight: null,
      lampGlow: null,
      character: null,
      musicPulse: 0,
      musicPhase: Math.random() * Math.PI * 2,
      musicDirty: false,
    };
    this.objects.push(object);
    this.applyTransform(object);
    this.applyTraits(object, traits);
  }

  removeObject(key: string, silent = false): void {
    const index = this.objects.findIndex((o) => o.key === key);
    if (index < 0) return;
    const object = this.objects[index];
    if (!object) return;
    this.detachLamp(object);
    this.scene.remove(object.group);
    disposeMesh(object.mesh);
    this.objects.splice(index, 1);
    if (this.selectedKey === key) this.select(null);
    if (this.activeCharacterKey === key) this.pickNextCharacter();
    if (!silent) this.events.onRoomChange();
  }

  setTraits(itemId: string, traits: TraitSetType): void {
    this.objects.filter((o) => o.itemId === itemId).forEach((o) => this.applyTraits(o, traits));
    this.events.onRoomChange();
  }

  private applyTraits(object: SceneObjectType, traits: TraitSetType): void {
    if (traits.character && !object.character) {
      object.character = createCharacterState();
      if (!this.activeCharacterKey) this.setActiveCharacter(object.key);
    } else if (!traits.character && object.character) {
      object.character = null;
      object.inner.rotation.set(0, 0, 0);
      object.inner.position.y = 0;
      this.applyTransform(object);
      if (this.activeCharacterKey === object.key) this.pickNextCharacter();
    }
    if (traits.lamp) this.attachLamp(object);
    else this.detachLamp(object);
  }

  private pickNextCharacter(): void {
    const next = this.objects.find((o) => o.character);
    this.setActiveCharacter(next ? next.key : null);
  }

  private setActiveCharacter(key: string | null): void {
    this.activeCharacterKey = key;
    this.events.onActiveCharacterChange(key);
  }

  getActiveCharacterKey(): string | null {
    return this.activeCharacterKey;
  }

  serializePlaced(): PlacedObjectType[] {
    return this.objects.map((o) => ({
      key: o.key,
      itemId: o.itemId,
      x: round(o.x),
      z: round(o.z),
      y: round(o.y),
      rot: round(o.rot),
      height: round(o.height),
      lamp: o.lampLight ? { ...o.lamp } : undefined,
    }));
  }

  private applyTransform(object: SceneObjectType): void {
    const scale = object.height / object.data.gridHeight;
    object.group.position.set(object.x, object.y, object.z);
    object.group.rotation.y = object.rot;
    object.inner.scale.setScalar(scale);
    object.inner.position.set(0, 0, 0);
    if (object.lampLight) this.applyLamp(object);
  }

  /* -------------------------------------------------------------- 선택 */

  select(key: string | null): void {
    if (this.readOnly) key = null;
    this.selectedKey = key;
    this.updateMarker();
    this.events.onSelectionChange(key);
    const object = key ? this.find(key) : null;
    if (object?.character) this.setActiveCharacter(object.key);
  }

  getSelectedKey(): string | null {
    return this.selectedKey;
  }

  getSelectedInfo(): { key: string; itemId: string; height: number } | null {
    const object = this.selectedKey ? this.find(this.selectedKey) : null;
    if (!object) return null;
    return { key: object.key, itemId: object.itemId, height: object.height };
  }

  getLampState(key: string): LampStateType | null {
    const object = this.find(key);
    return object?.lampLight ? { ...object.lamp } : null;
  }

  setLampState(key: string, patch: Partial<LampStateType>): void {
    const object = this.find(key);
    if (!object) return;
    object.lamp = { ...object.lamp, ...patch };
    this.applyLamp(object);
    this.events.onRoomChange();
  }

  toggleLamp(key: string): void {
    const object = this.find(key);
    if (!object?.lampLight) return;
    this.setLampState(key, { on: !object.lamp.on });
  }

  setSelectedHeight(height: number): void {
    const object = this.selectedKey ? this.find(this.selectedKey) : null;
    if (!object || this.readOnly) return;
    object.height = clampObjectHeight(height);
    const spot = resolvePlacement(toBody(object), this.settings.size, object.x, object.z, this.otherBodies(object));
    object.x = spot.x;
    object.z = spot.z;
    object.y = spot.y;
    this.applyTransform(object);
    this.updateMarker();
    this.events.onRoomChange();
  }

  rotateSelected(direction: number): void {
    const object = this.selectedKey ? this.find(this.selectedKey) : null;
    if (!object || this.readOnly) return;
    object.rot += (direction * Math.PI) / 4;
    const spot = resolvePlacement(toBody(object), this.settings.size, object.x, object.z, this.otherBodies(object));
    object.x = spot.x;
    object.z = spot.z;
    object.y = spot.y;
    this.applyTransform(object);
    this.updateMarker();
    this.events.onRoomChange();
  }

  duplicateSelected(): PlacedObjectType | null {
    const object = this.selectedKey ? this.find(this.selectedKey) : null;
    if (!object || this.readOnly) return null;
    const foot = computeFootprint(toBody(object));
    const nextX = object.x + Math.max(1, foot.width) + 0.5;
    return {
      key: buildLocalId(),
      itemId: object.itemId,
      x: nextX,
      z: object.z,
      y: 0,
      rot: object.rot,
      height: object.height,
      lamp: object.lampLight ? { ...object.lamp } : undefined,
    };
  }

  placeAt(key: string, x: number, z: number): void {
    const object = this.find(key);
    if (!object) return;
    const spot = resolvePlacement(toBody(object), this.settings.size, x, z, this.otherBodies(object));
    object.x = spot.x;
    object.z = spot.z;
    object.y = spot.y;
    this.applyTransform(object);
    this.updateMarker();
  }

  private otherBodies(object: SceneObjectType): PlacementBodyType[] {
    return this.objects.filter((o) => o.key !== object.key).map(toBody);
  }

  private find(key: string): SceneObjectType | undefined {
    return this.objects.find((o) => o.key === key);
  }

  private updateMarker(): void {
    const object = this.selectedKey ? this.find(this.selectedKey) : null;
    if (!object) {
      this.markerLine.visible = false;
      this.markerPlane.visible = false;
      return;
    }
    const foot = computeFootprint(toBody(object));
    const hw = foot.width / 2;
    const hd = foot.depth / 2;
    const y = object.y + 0.02;
    const attr = this.markerLine.geometry.getAttribute('position') as BufferAttribute;
    const corners: [number, number][] = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
      [-hw, -hd],
    ];
    corners.forEach(([dx, dz], i) => {
      attr.setXYZ(i, object.x + dx, y, object.z + dz);
    });
    attr.needsUpdate = true;
    this.markerLine.geometry.computeBoundingSphere();
    this.markerLine.visible = true;
    this.markerPlane.position.set(object.x, y - 0.005, object.z);
    this.markerPlane.scale.set(foot.width, foot.depth, 1);
    this.markerPlane.visible = true;
  }

  /* -------------------------------------------------------------- 전등 */

  private attachLamp(object: SceneObjectType): void {
    if (object.lampLight) return;
    const light = new PointLight(0xffffff, 0, 10, 1.7);
    const glow = new Sprite(
      new SpriteMaterial({
        map: getGlowTexture(),
        color: 0xffffff,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      }),
    );
    glow.renderOrder = 3;
    object.group.add(light, glow);
    object.lampLight = light;
    object.lampGlow = glow;
    this.applyLamp(object);
  }

  private detachLamp(object: SceneObjectType): void {
    if (!object.lampLight || !object.lampGlow) return;
    object.group.remove(object.lampLight, object.lampGlow);
    object.lampGlow.material.dispose();
    object.lampLight = null;
    object.lampGlow = null;
    object.mesh.material.emissive.setRGB(0, 0, 0);
  }

  private applyLamp(object: SceneObjectType): void {
    const { lampLight: light, lampGlow: glow } = object;
    if (!light || !glow) return;
    const tint = LAMP_TINT_MAP[object.lamp.tint];
    const on = object.lamp.on ? 1 : 0;
    const bright = object.lamp.bright;
    const headY = object.height * 0.72;

    light.color.setHex(tint.hex, SRGBColorSpace);
    light.intensity = on * bright * 9 * Math.max(1, object.height * 0.5);
    light.distance = 6 + bright * 7;
    light.position.set(0, headY, 0);

    glow.material.color.setHex(tint.hex, SRGBColorSpace);
    glow.material.opacity = on * Math.min(0.85, 0.35 + bright * 0.3);
    glow.position.set(0, headY, 0);
    const size = object.height * (1.1 + bright * 0.5);
    glow.scale.set(size, size, 1);
    glow.visible = on === 1;

    this.scratchColor.setHex(tint.hex, SRGBColorSpace).multiplyScalar(on * Math.min(0.34, 0.14 + bright * 0.1));
    object.mesh.material.emissive.copy(this.scratchColor);
  }

  /* -------------------------------------------------------------- 음악 */

  setMusicState(itemId: string | null, playing: boolean): void {
    this.musicItemId = itemId;
    this.musicPlaying = playing;
  }

  /* -------------------------------------------------------------- 캐릭터 */

  setMoveInput(input: MoveInputType): void {
    this.moveInput = input;
  }

  requestJump(): void {
    const object = this.activeCharacterKey ? this.find(this.activeCharacterKey) : null;
    if (object?.character) object.character.jumpRequested = true;
  }

  toggleSit(): void {
    const object = this.activeCharacterKey ? this.find(this.activeCharacterKey) : null;
    if (object?.character) object.character.sitting = !object.character.sitting;
  }

  getInteractKey(): string | null {
    return this.interactKey;
  }

  /* -------------------------------------------------------------- 입력 */

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button === 2) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      this.drag = null;
      this.pinch = { distance: this.pointerDistance(), zoom: this.view.zoom };
      return;
    }
    if (this.pointers.size > 2) return;

    const hit = this.pickObject(event.clientX, event.clientY);
    if (hit && !this.readOnly) {
      this.select(hit.key);
      const floor = this.floorPoint(event.clientX, event.clientY);
      this.drag = {
        mode: 'move',
        key: hit.key,
        offsetX: floor ? hit.x - floor.x : 0,
        offsetZ: floor ? hit.z - floor.z : 0,
        moved: false,
      };
    } else {
      this.select(null);
      this.drag = {
        mode: 'orbit',
        startX: event.clientX,
        startY: event.clientY,
        yaw: this.view.yaw,
        pitch: this.view.pitch,
      };
    }
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const tracked = this.pointers.get(event.pointerId);
    if (tracked) {
      tracked.x = event.clientX;
      tracked.y = event.clientY;
    }
    if (this.pinch) {
      const distance = this.pointerDistance();
      if (distance > 8 && this.pinch.distance > 8) {
        this.setView({ zoom: this.pinch.zoom * (distance / this.pinch.distance) });
      }
      return;
    }
    if (!this.drag) return;
    if (this.drag.mode === 'orbit') {
      this.setView({
        yaw: this.drag.yaw - (event.clientX - this.drag.startX) * 0.008,
        pitch: this.drag.pitch + (event.clientY - this.drag.startY) * 0.005,
      });
      return;
    }
    const floor = this.floorPoint(event.clientX, event.clientY);
    if (!floor) return;
    this.placeAt(this.drag.key, floor.x + this.drag.offsetX, floor.z + this.drag.offsetZ);
    this.drag.moved = true;
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pinch && this.pointers.size < 2) this.pinch = null;
    if (this.drag?.mode === 'move' && this.drag.moved) this.events.onRoomChange();
    this.drag = null;
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.setView({ zoom: this.view.zoom * (event.deltaY > 0 ? 0.92 : 1.087) });
  };

  private readonly handleContextMenu = (event: Event): void => event.preventDefault();

  private attachPointerHandlers(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private detachPointerHandlers(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private setRay(clientX: number, clientY: number): void {
    this.ndc.set(
      (clientX / this.insets.width) * 2 - 1,
      -(clientY / this.insets.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  floorPoint(clientX: number, clientY: number): { x: number; z: number } | null {
    this.setRay(clientX, clientY);
    const hit = this.raycaster.ray.intersectPlane(FLOOR_PLANE, this.hitPoint);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  pickObject(clientX: number, clientY: number): SceneObjectType | null {
    this.setRay(clientX, clientY);
    let best: SceneObjectType | null = null;
    let bestDistance = Infinity;
    for (const object of this.objects) {
      const foot = computeFootprint(toBody(object));
      const box = new Box3(
        new Vector3(object.x - foot.width / 2, object.y, object.z - foot.depth / 2),
        new Vector3(object.x + foot.width / 2, object.y + object.height, object.z + foot.depth / 2),
      );
      const point = this.raycaster.ray.intersectBox(box, new Vector3());
      if (!point) continue;
      const distance = point.distanceTo(this.camera.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = object;
      }
    }
    return best;
  }

  /* -------------------------------------------------------------- 루프 */

  private tick(): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    this.updateCharacters(dt, time);
    this.updateMusicPulse(dt, time);
    this.updateInteractHint();
    if (this.selectedKey) this.updateMarker();
    this.keyLight.target.position.set(0, 0, 0);
    this.keyLight.target.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }

  private updateCharacters(dt: number, time: number): void {
    for (const object of this.objects) {
      if (!object.character) continue;
      const isActive = object.key === this.activeCharacterKey && this.drag?.mode !== 'move';
      const input = isActive ? this.moveInput : { forward: 0, right: 0 };
      const others = this.otherBodies(object);
      const result = stepCharacter(
        { x: object.x, z: object.z, y: object.y, rot: object.rot, height: object.height },
        object.character,
        {
          dt,
          time,
          input,
          cameraYaw: this.view.yaw,
          groundHeight: computeRestHeight(toBody(object), object.x, object.z, others),
          clampPosition: (x, z) => {
            const half = this.settings.size / 2;
            return { x: clamp(x, -half + 0.45, half - 0.45), z: clamp(z, -half + 0.45, half - 0.45) };
          },
        },
      );
      object.x = result.body.x;
      object.z = result.body.z;
      object.y = result.body.y;
      object.rot = result.body.rot;
      object.character = result.state;

      const scale = object.height / object.data.gridHeight;
      object.group.position.set(object.x, object.y, object.z);
      object.group.rotation.y = object.rot;
      object.inner.position.y = result.pose.bob;
      object.inner.rotation.set(result.pose.lean, 0, result.pose.roll);
      object.inner.scale.set(
        scale * result.pose.scaleXZ,
        scale * result.pose.scaleY,
        scale * result.pose.scaleXZ,
      );
    }
  }

  private updateMusicPulse(dt: number, time: number): void {
    for (const object of this.objects) {
      if (object.character) continue;
      const on = this.musicPlaying && this.musicItemId === object.itemId ? 1 : 0;
      object.musicPulse += (on - object.musicPulse) * (1 - Math.exp(-dt * 5));
      if (object.musicPulse < 0.003) {
        if (object.musicDirty) {
          object.inner.position.y = 0;
          object.inner.rotation.set(0, 0, 0);
          this.applyTransform(object);
          object.musicDirty = false;
        }
        continue;
      }
      object.musicDirty = true;
      const scale = object.height / object.data.gridHeight;
      const amount = object.musicPulse;
      const phase = time * 5.4 + object.musicPhase;
      const swing = Math.sin(phase);
      object.inner.position.y = Math.abs(swing) * 0.055 * object.height * amount;
      object.inner.rotation.set(0, 0, Math.sin(phase * 0.5) * 0.055 * amount);
      const pulse = 1 + 0.028 * amount * swing;
      object.inner.scale.set(scale * pulse, scale * (2 - pulse), scale * pulse);
    }
  }

  private updateInteractHint(): void {
    const character = this.activeCharacterKey ? this.find(this.activeCharacterKey) : null;
    if (!character?.character) {
      if (this.interactKey) {
        this.interactKey = null;
        this.events.onInteractHintChange(null);
      }
      return;
    }
    let best: SceneObjectType | null = null;
    let bestDistance = INTERACT_RANGE;
    for (const object of this.objects) {
      if (object.key === character.key) continue;
      const traits = this.deps.getTraits(object.itemId);
      if (!traits.piano && !traits.music && !traits.lamp) continue;
      const distance = Math.hypot(object.x - character.x, object.z - character.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = object;
      }
    }
    if (!best) {
      if (this.interactKey) {
        this.interactKey = null;
        this.events.onInteractHintChange(null);
      }
      return;
    }
    this.projected.set(best.x, best.y + best.height + 0.55, best.z).project(this.camera);
    if (this.projected.z > 1) return;
    this.interactKey = best.key;
    this.events.onInteractHintChange({
      key: best.key,
      itemId: best.itemId,
      screenX: (this.projected.x * 0.5 + 0.5) * this.insets.width,
      screenY: (-this.projected.y * 0.5 + 0.5) * this.insets.height,
    });
  }

  /** 공유 링크 썸네일. 렌더 직후에 읽어야 빈 이미지가 나오지 않는다. */
  captureThumbnail(width = 1200, height = 630): string | null {
    const previous = { width: this.insets.width, height: this.insets.height };
    try {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
      return this.renderer.domElement.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    } finally {
      this.renderer.setSize(previous.width, previous.height, false);
      this.updateCamera();
    }
  }
}

function toBody(object: {
  key: string;
  x: number;
  z: number;
  y: number;
  rot: number;
  height: number;
  data: VoxelDataType;
}): PlacementBodyType {
  return {
    key: object.key,
    x: object.x,
    z: object.z,
    y: object.y,
    rot: object.rot,
    height: object.height,
    gridWidth: object.data.gridWidth,
    gridHeight: object.data.gridHeight,
    depthExtent: object.data.depthExtent,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
