export const TRAIT_KEYS = ['character', 'music', 'lamp', 'piano'] as const;
export type TraitKeyType = (typeof TRAIT_KEYS)[number];

export const TRAIT_LABEL_MAP: Record<TraitKeyType, string> = {
  character: '캐릭터',
  music: '음악재생',
  lamp: '전등',
  piano: '피아노',
};

export type TraitSetType = Partial<Record<TraitKeyType, boolean>>;

export const DEPTH_MODES = ['inflate', 'flat', 'relief'] as const;
export type DepthModeType = (typeof DEPTH_MODES)[number];

export const LAMP_TINTS = ['warm', 'white', 'pink', 'cool'] as const;
export type LampTintType = (typeof LAMP_TINTS)[number];

export const ROOM_PALETTES = ['wood', 'mint', 'night', 'sakura'] as const;
export type RoomPaletteType = (typeof ROOM_PALETTES)[number];

/** 그림 한 장을 복셀로 깎을 때 쓰는 설정. 되돌릴 수 있도록 방과 함께 저장한다. */
export type CarveOptionsType = {
  grid: number;
  depth: number;
  mode: DepthModeType;
  removeBg: boolean;
  tolerance: number;
  trim: boolean;
  /** 저장된 마스크에서 되살릴 때는 배경 판정을 다시 하지 않는다. */
  alphaOnly?: boolean;
};

export type VoxelDataType = {
  gridWidth: number;
  gridHeight: number;
  depthExtent: number;
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  /** 격자 해상도 그대로의 배경 투명 PNG. 저장·복원의 단위. */
  maskPng: string;
};

export type TrackItemType = {
  id: string;
  name: string;
};

/** 보관함 항목 — 속성은 항목에 붙어 꺼낸 모든 개체가 공유한다. */
export type InventoryItemType = {
  id: string;
  name: string;
  maskPng: string;
  carve: Pick<CarveOptionsType, 'depth' | 'mode'>;
  traits: TraitSetType;
  tracks: TrackItemType[];
};

export type LampStateType = {
  on: boolean;
  bright: number;
  tint: LampTintType;
};

/** 방에 꺼내 놓은 개체 하나. */
export type PlacedObjectType = {
  key: string;
  itemId: string;
  x: number;
  z: number;
  y: number;
  rot: number;
  height: number;
  lamp?: LampStateType;
};

export type RoomSettingsType = {
  size: number;
  palette: RoomPaletteType;
};

export type RoomType = {
  version: number;
  settings: RoomSettingsType;
  items: InventoryItemType[];
  placed: PlacedObjectType[];
};

export type RoomMetaType = {
  id: string;
  title: string;
  updatedAt: string;
  thumbnailUrl: string | null;
};

export type ChatRoleType = 'visitor' | 'admin';

export type ChatMessageItemType = {
  id: string;
  roomId: string;
  role: ChatRoleType;
  authorName: string;
  body: string;
  createdAt: string;
};
