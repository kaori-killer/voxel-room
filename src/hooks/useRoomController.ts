'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { carveVoxels } from '@/engine/voxelize';
import { RoomScene } from '@/engine/roomScene';
import { renderThumbnail } from '@/engine/meshFactory';
import type { InteractHintType } from '@/engine/roomScene';
import { defaultObjectHeight, findFreeSpot } from '@/engine/placement';
import { MusicPlayer } from '@/audio/musicPlayer';
import type { PlayerSnapshotType } from '@/audio/musicPlayer';
import { trackSrc } from '@/api/roomsClient';
import {
  DEFAULT_CARVE_DEPTH,
  DEFAULT_CARVE_MODE,
  DEFAULT_LAMP_BRIGHT,
  DEFAULT_LAMP_TINT,
  RAIL_WIDTH,
} from '@/domain/constants';
import type {
  InventoryItemType,
  LampStateType,
  PlacedObjectType,
  RoomSettingsType,
  RoomType,
  TraitKeyType,
  TraitSetType,
  VoxelDataType,
} from '@/domain/types';
import { buildLocalId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { loadImageFromSource } from '@/lib/image';

const SAVE_DEBOUNCE_MS = 700;
const MOBILE_BREAKPOINT = 900;

export type UseRoomControllerParams = {
  roomId: string;
  shared: boolean;
  initialRoom: RoomType;
  canEdit: boolean;
  onPersist: (room: RoomType, thumbnail: string | null) => void;
};

export type SelectionInfoType = {
  key: string;
  itemId: string;
  height: number;
};

export type RoomControllerType = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  items: InventoryItemType[];
  settings: RoomSettingsType;
  selection: SelectionInfoType | null;
  selectedItem: InventoryItemType | null;
  interactHint: InteractHintType | null;
  interactItem: InventoryItemType | null;
  activeCharacterKey: string | null;
  player: PlayerSnapshotType;
  musicPlayer: MusicPlayer;
  thumbnails: Record<string, string>;
  ready: boolean;
  handleSelect: (key: string | null) => void;
  handleAddItem: (item: InventoryItemType, data: VoxelDataType) => void;
  handleTakeOut: (itemId: string) => void;
  handleDeleteItem: (itemId: string) => void;
  handleRemoveSelected: () => void;
  handleDuplicateSelected: () => void;
  handleRotateSelected: (direction: number) => void;
  handleResizeSelected: (height: number) => void;
  handleToggleTrait: (itemId: string, trait: TraitKeyType, on: boolean) => void;
  handleChangeSettings: (patch: Partial<RoomSettingsType>) => void;
  handleResetView: () => void;
  handleSetLamp: (key: string, patch: Partial<LampStateType>) => void;
  getLampState: (key: string) => LampStateType | null;
  handleMoveInput: (forward: number, right: number) => void;
  handleJump: () => void;
  handleToggleSit: () => void;
  handleSetTracks: (itemId: string, tracks: InventoryItemType['tracks']) => void;
  handleSetPhoto: (itemId: string, photo: string | null) => void;
  setBottomInset: (value: number) => void;
};

export function useRoomController(params: UseRoomControllerParams): RoomControllerType {
  const { roomId, shared, initialRoom, canEdit, onPersist } = params;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<RoomScene | null>(null);
  const voxelCacheRef = useRef(new Map<string, VoxelDataType>());
  const itemsRef = useRef<InventoryItemType[]>(initialRoom.items);
  const saveTimerRef = useRef<number | null>(null);
  const bottomInsetRef = useRef(0);

  const [items, setItems] = useState<InventoryItemType[]>(initialRoom.items);
  const [settings, setSettings] = useState<RoomSettingsType>(initialRoom.settings);
  const [selection, setSelection] = useState<SelectionInfoType | null>(null);
  const [interactHint, setInteractHint] = useState<InteractHintType | null>(null);
  const [activeCharacterKey, setActiveCharacterKey] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  const musicPlayer = useMemo(() => (typeof window === 'undefined' ? null : new MusicPlayer()), []);
  const [player, setPlayer] = useState<PlayerSnapshotType>({
    itemId: null,
    trackId: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    repeatOne: false,
  });

  itemsRef.current = items;

  const getTraits = useCallback((itemId: string): TraitSetType => {
    return itemsRef.current.find((item) => item.id === itemId)?.traits ?? {};
  }, []);

  const getPhoto = useCallback((itemId: string): string | null => {
    return itemsRef.current.find((item) => item.id === itemId)?.photo ?? null;
  }, []);

  const schedulePersist = useCallback(() => {
    if (!canEdit) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      const room: RoomType = {
        version: initialRoom.version,
        settings: scene.getSettings(),
        items: itemsRef.current,
        placed: scene.serializePlaced(),
      };
      onPersist(room, scene.captureThumbnail());
    }, SAVE_DEBOUNCE_MS);
  }, [canEdit, initialRoom.version, onPersist]);

  const applyInsets = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const wide = width > MOBILE_BREAKPOINT;
    scene.setInsets({
      width,
      height,
      left: wide ? RAIL_WIDTH : 0,
      top: wide ? 0 : 62,
      bottom: wide ? 0 : bottomInsetRef.current,
    });
  }, []);

  const setBottomInset = useCallback(
    (value: number) => {
      bottomInsetRef.current = value;
      document.documentElement.style.setProperty('--sheet', `${Math.round(value)}px`);
      applyInsets();
    },
    [applyInsets],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const scene = new RoomScene(
      canvas,
      initialRoom.settings,
      {
        onSelectionChange: (key) => setSelection(key ? sceneRef.current?.getSelectedInfo() ?? null : null),
        onInteractHintChange: setInteractHint,
        onActiveCharacterChange: setActiveCharacterKey,
        onRoomChange: schedulePersist,
      },
      { getTraits },
    );
    sceneRef.current = scene;
    scene.setReadOnly(!canEdit);
    applyInsets();
    scene.start();

    const sky = scene.getPaletteSky();
    document.body.style.setProperty('--sky-1', sky.from);
    document.body.style.setProperty('--sky-2', sky.to);

    let cancelled = false;
    void (async () => {
      const nextThumbs: Record<string, string> = {};
      for (const item of initialRoom.items) {
        const data = await carveFromMask(item);
        if (!data) continue;
        voxelCacheRef.current.set(item.id, data);
        const thumb = renderThumb(data);
        if (thumb) nextThumbs[item.id] = thumb;
      }
      if (cancelled) return;
      for (const placed of initialRoom.placed) {
        const data = voxelCacheRef.current.get(placed.itemId);
        if (!data) continue;
        scene.addObject(placed, data, getTraits(placed.itemId), getPhoto(placed.itemId));
      }
      setThumbnails(nextThumbs);
      setReady(true);
    })();

    window.addEventListener('resize', applyInsets);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', applyInsets);
      scene.dispose();
      sceneRef.current = null;
    };
    // 초기 방은 마운트 시점에 한 번만 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // canEdit 은 소유 키(ownerKey)가 async 로 풀린 뒤에야 true 가 되므로,
  // 마운트 시 한 번 잡은 readOnly 를 canEdit 이 바뀔 때마다 씬에 다시 반영한다.
  useEffect(() => {
    sceneRef.current?.setReadOnly(!canEdit);
  }, [canEdit]);

  useEffect(() => {
    if (!musicPlayer) return undefined;
    return musicPlayer.subscribe(setPlayer);
  }, [musicPlayer]);

  // 공유 방에서는 로컬에 없는 곡을 서버에서 받아 재생한다 (직접 만든 방이 아니어도 음악이 나오도록).
  useEffect(() => {
    if (!musicPlayer) return;
    musicPlayer.remoteUrlFor = shared ? (trackId) => trackSrc(roomId, trackId) : null;
  }, [musicPlayer, shared, roomId]);

  useEffect(() => {
    sceneRef.current?.setMusicState(player.itemId, player.playing);
  }, [player.itemId, player.playing]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      musicPlayer?.dispose();
    };
  }, [musicPlayer]);

  const handleSelect = useCallback((key: string | null) => {
    sceneRef.current?.select(key);
    setSelection(key ? sceneRef.current?.getSelectedInfo() ?? null : null);
  }, []);

  const handleAddItem = useCallback(
    (item: InventoryItemType, data: VoxelDataType) => {
      voxelCacheRef.current.set(item.id, data);
      const thumb = renderThumb(data);
      if (thumb) setThumbnails((prev) => ({ ...prev, [item.id]: thumb }));
      setItems((prev) => [...prev, item]);
      schedulePersist();
    },
    [schedulePersist],
  );

  const handleTakeOut = useCallback(
    (itemId: string) => {
      const scene = sceneRef.current;
      const data = voxelCacheRef.current.get(itemId);
      if (!scene || !data) return;
      const spot = findFreeSpot(
        scene.getSettings().size,
        scene.serializePlaced().map((p) => ({ x: p.x, z: p.z })),
      );
      const placed: PlacedObjectType = {
        key: buildLocalId(),
        itemId,
        x: spot.x,
        z: spot.z,
        y: 0,
        rot: 0,
        height: defaultObjectHeight(data.gridWidth, data.gridHeight),
        lamp: { on: true, bright: DEFAULT_LAMP_BRIGHT, tint: DEFAULT_LAMP_TINT },
      };
      scene.addObject(placed, data, getTraits(itemId), getPhoto(itemId));
      scene.placeAt(placed.key, spot.x, spot.z);
      scene.select(placed.key);
      setSelection(scene.getSelectedInfo());
      schedulePersist();
    },
    [getPhoto, getTraits, schedulePersist],
  );

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      const scene = sceneRef.current;
      if (!scene) return;
      scene
        .serializePlaced()
        .filter((placed) => placed.itemId === itemId)
        .forEach((placed) => scene.removeObject(placed.key, true));
      voxelCacheRef.current.delete(itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setThumbnails((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      if (musicPlayer && player.itemId === itemId) musicPlayer.stop();
      schedulePersist();
    },
    [musicPlayer, player.itemId, schedulePersist],
  );

  const handleRemoveSelected = useCallback(() => {
    const key = sceneRef.current?.getSelectedKey();
    if (key) sceneRef.current?.removeObject(key);
  }, []);

  const handleDuplicateSelected = useCallback(() => {
    const scene = sceneRef.current;
    const copy = scene?.duplicateSelected();
    if (!scene || !copy) return;
    const data = voxelCacheRef.current.get(copy.itemId);
    if (!data) return;
    scene.addObject(copy, data, getTraits(copy.itemId), getPhoto(copy.itemId));
    scene.placeAt(copy.key, copy.x, copy.z);
    scene.select(copy.key);
    setSelection(scene.getSelectedInfo());
    schedulePersist();
  }, [getPhoto, getTraits, schedulePersist]);

  const handleRotateSelected = useCallback((direction: number) => {
    sceneRef.current?.rotateSelected(direction);
  }, []);

  const handleResizeSelected = useCallback((height: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setSelectedHeight(height);
    setSelection(scene.getSelectedInfo());
  }, []);

  const handleToggleTrait = useCallback(
    (itemId: string, trait: TraitKeyType, on: boolean) => {
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === itemId ? { ...item, traits: { ...item.traits, [trait]: on } } : item,
        );
        itemsRef.current = next;
        sceneRef.current?.setTraits(itemId, next.find((item) => item.id === itemId)?.traits ?? {});
        return next;
      });
      if (trait === 'music' && !on && musicPlayer && player.itemId === itemId) musicPlayer.stop();
      schedulePersist();
    },
    [musicPlayer, player.itemId, schedulePersist],
  );

  const handleSetTracks = useCallback(
    (itemId: string, tracks: InventoryItemType['tracks']) => {
      setItems((prev) => {
        const next = prev.map((item) => (item.id === itemId ? { ...item, tracks } : item));
        itemsRef.current = next;
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const handleSetPhoto = useCallback(
    (itemId: string, photo: string | null) => {
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === itemId ? { ...item, photo: photo ?? undefined } : item,
        );
        itemsRef.current = next;
        sceneRef.current?.setPhoto(itemId, photo);
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const handleChangeSettings = useCallback(
    (patch: Partial<RoomSettingsType>) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const next = { ...scene.getSettings(), ...patch };
      scene.setSettings(next);
      setSettings(next);
      const sky = scene.getPaletteSky();
      document.body.style.setProperty('--sky-1', sky.from);
      document.body.style.setProperty('--sky-2', sky.to);
      applyInsets();
      schedulePersist();
    },
    [applyInsets, schedulePersist],
  );

  const handleResetView = useCallback(() => sceneRef.current?.resetView(), []);

  const handleSetLamp = useCallback((key: string, patch: Partial<LampStateType>) => {
    sceneRef.current?.setLampState(key, patch);
  }, []);

  const getLampState = useCallback((key: string) => sceneRef.current?.getLampState(key) ?? null, []);

  const handleMoveInput = useCallback((forward: number, right: number) => {
    sceneRef.current?.setMoveInput({ forward, right });
  }, []);

  const handleJump = useCallback(() => sceneRef.current?.requestJump(), []);
  const handleToggleSit = useCallback(() => sceneRef.current?.toggleSit(), []);

  const selectedItem = useMemo(
    () => (selection ? items.find((item) => item.id === selection.itemId) ?? null : null),
    [items, selection],
  );
  const interactItem = useMemo(
    () => (interactHint ? items.find((item) => item.id === interactHint.itemId) ?? null : null),
    [items, interactHint],
  );

  return {
    canvasRef,
    items,
    settings,
    selection,
    selectedItem,
    interactHint,
    interactItem,
    activeCharacterKey,
    player,
    musicPlayer: musicPlayer as MusicPlayer,
    thumbnails,
    ready,
    handleSelect,
    handleAddItem,
    handleTakeOut,
    handleDeleteItem,
    handleRemoveSelected,
    handleDuplicateSelected,
    handleRotateSelected,
    handleResizeSelected,
    handleToggleTrait,
    handleChangeSettings,
    handleResetView,
    handleSetLamp,
    getLampState,
    handleMoveInput,
    handleJump,
    handleToggleSit,
    handleSetTracks,
    handleSetPhoto,
    setBottomInset,
  };
}

async function carveFromMask(item: InventoryItemType): Promise<VoxelDataType | null> {
  try {
    const image = await loadImageFromSource(item.maskPng);
    return carveVoxels(image, {
      grid: Math.max(image.width, image.height),
      depth: item.carve.depth ?? DEFAULT_CARVE_DEPTH,
      mode: item.carve.mode ?? DEFAULT_CARVE_MODE,
      alphaOnly: true,
      removeBg: true,
      tolerance: 0,
      trim: false,
    });
  } catch (error) {
    logger.warn('오브제를 되살리지 못했습니다', error);
    return null;
  }
}

function renderThumb(data: VoxelDataType): string | null {
  return renderThumbnail(data);
}
