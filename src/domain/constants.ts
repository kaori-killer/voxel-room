import type { DepthModeType, LampTintType, RoomPaletteType, RoomSettingsType } from './types';

export const ROOM_VERSION = 1;

export const ROOM_ID_LENGTH = 10;
/** 헷갈리는 글자(0/o/1/l/i)를 뺀 base32. URL 에 그대로 노출된다. */
export const ROOM_ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
export const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);

export const DEFAULT_ROOM_TITLE = '이름 없는 방';
export const DEFAULT_ROOM_SETTINGS: RoomSettingsType = { size: 12, palette: 'wood' };

export const ROOM_SIZE_OPTIONS = [10, 12, 16] as const;

export const TILE_THICKNESS = 0.35;
export const WALL_HEIGHT = 5;
export const CAMERA_FOV = 24;
export const RAIL_WIDTH = 292;

export const SNAP_STEP = 0.5;
export const MIN_OBJECT_HEIGHT = 0.3;
export const MAX_OBJECT_HEIGHT = 7;
export const INTERACT_RANGE = 2.6;

export const GRAVITY = 20;
export const JUMP_SPEED = 6.4;
export const WALK_SPEED_BASE = 2.3;
export const WALK_SPEED_PER_HEIGHT = 0.32;
/** 밀어낸 그림이라 옆면이 얇다. 이 각도 이상은 돌리지 않는다. */
export const MAX_TURN_FROM_CAMERA = 0.95;

export const DEFAULT_CARVE_GRID = 56;
export const DEFAULT_CARVE_DEPTH = 11;
export const DEFAULT_CARVE_TOLERANCE = 60;
export const DEFAULT_CARVE_MODE: DepthModeType = 'inflate';

export const DEPTH_MODE_NOTE_MAP: Record<DepthModeType, string> = {
  inflate: '실루엣 안쪽으로 갈수록 두꺼워집니다. 인물·물건 사진이나 손그림에 가장 잘 맞습니다.',
  flat: '일정한 두께의 판으로 밀어냅니다. 로고·아이콘처럼 윤곽이 분명한 이미지에 좋습니다.',
  relief: '밝은 부분이 튀어나옵니다. 음영이 살아 있는 사진에 어울립니다.',
};

export const DEPTH_MODE_LABEL_MAP: Record<DepthModeType, string> = {
  inflate: '부풀리기',
  flat: '판',
  relief: '릴리프',
};

export const LAMP_TINT_MAP: Record<LampTintType, { label: string; hex: number; css: string }> = {
  warm: { label: '노란 불', hex: 0xffc069, css: '#FFC069' },
  white: { label: '흰 불', hex: 0xfff4e2, css: '#FFF4E2' },
  pink: { label: '분홍 불', hex: 0xffa3c4, css: '#FFA3C4' },
  cool: { label: '푸른 불', hex: 0x9fc8ff, css: '#9FC8FF' },
};

export const DEFAULT_LAMP_BRIGHT = 1;
export const DEFAULT_LAMP_TINT: LampTintType = 'warm';

export type PaletteColorsType = {
  label: string;
  floorA: number;
  floorB: number;
  wallA: number;
  wallB: number;
  base: number;
  sky1: string;
  sky2: string;
};

export const ROOM_PALETTE_MAP: Record<RoomPaletteType, PaletteColorsType> = {
  wood: {
    label: '우드 & 크림',
    floorA: 0xc9a268, floorB: 0xbe9760, wallA: 0xf0e7d7, wallB: 0xe8decc, base: 0xb08a57,
    sky1: '#F3EDE1', sky2: '#DED2BE',
  },
  mint: {
    label: '민트 타일',
    floorA: 0xbcd8cc, floorB: 0xaecdc0, wallA: 0xe6f0eb, wallB: 0xdbe9e2, base: 0x8fb6a6,
    sky1: '#EAF3EE', sky2: '#D2E4DB',
  },
  night: {
    label: '밤하늘',
    floorA: 0x554e7c, floorB: 0x4b4570, wallA: 0x413c64, wallB: 0x3a3559, base: 0x2e2b47,
    sky1: '#332F4E', sky2: '#191830',
  },
  sakura: {
    label: '벚꽃',
    floorA: 0xe0c0c4, floorB: 0xd6b4b9, wallA: 0xf7eaeb, wallB: 0xf0e1e3, base: 0xc59ba1,
    sky1: '#F7ECEE', sky2: '#E4CDD1',
  },
};

export const MAX_CHAT_BODY_LENGTH = 800;
export const CHAT_PAGE_SIZE = 100;

/** 음악 파일 1개 최대 크기. 서버·클라이언트가 같은 값으로 막는다. */
export const MAX_TRACK_BYTES = 20 * 1024 * 1024;
