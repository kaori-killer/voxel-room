import { DEFAULT_LAMP_BRIGHT, DEFAULT_LAMP_TINT } from './constants';
import type { InventoryItemType, PlacedObjectType } from './types';

/**
 * 새 방을 만들 때 미리 놓아 두는 기본 오브제.
 *
 * maskPng 는 손으로 만든 작은 실루엣 PNG(투명 배경 위 색이 있는 도형)다.
 * 방을 여는 순간 클라이언트가 carveVoxels(alphaOnly)로 복셀로 되살리므로
 * 별도의 서버 이미지 처리가 필요 없다. 각 item 은 inventoryItemSchema,
 * 각 placed 는 placedObjectSchema 를 통과해야 한다(아니면 GET 시 조용히 버려진다).
 */

// 별 — 노란 5각별. character 속성이라 방에 들어가면 조작 캐릭터가 된다.
const STAR_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAAoElEQVR42mNgIAP8P+fwn1Q9TAx0Akzk+oZUXw1OH5ETN4PXRyi+kfAh2Yd08xEjyWEP9Q0DAwMDw4stxFlidICRCcagmU+gZjOSlLKQfUPAV+iOZyKkgBJfYMQRKSkNK4D6Cp8jGamVSQmFxODIsKQke0JqB281QVHJQEpQIEc6NjW4EgULRXkDKkZMXDIS8g2xGZgcPRRVcJToHQUDCwB+b03FQa+MYgAAAABJRU5ErkJggg==';

// 램프 — 갓+목+받침. lamp 속성이라 은은한 조명을 낸다.
const LAMP_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAgCAYAAAAIXrg4AAAAnUlEQVR42mNgGAUEACM+yf9vVv0n2iCRMKxmMeHV9eoccabjUYfTgv/XKv6TEhS41DNR4jpi5Jmo4Xp8+lgoDWNCgInWyZSJWsGDSz99fUCp67GZw0KKxukHtODsTIdrlBcV6GDatEVwl2VlxTEOzlQ0asGoBaMW0LlVwcDAwJDnZ0WwAJy06Rjj4AwiYlxPSN0wTkXEBg8h9TT3AQD7gjoIv6ZGlwAAAABJRU5ErkJggg==';

// 주크박스 — music·piano 속성이라 다가가면 음악을 재생하고 펄스한다.
const JUKEBOX_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAaCAYAAACtv5zzAAAApElEQVR42mNgGOqAEZdEwqZ9/0k1bIGfE4Z5TNQyHJc+RnyKjnV1EW24VVkZVp8w4dJAiuH41DPROpJHLRjEFiAnO1KTKTJgIUcTVYNoX1UFw76qCpLliLIAWTO6QfjkiLIAmyaYGD65wZOKnNo6cIrhkyPJB8ia0A3AJ0d0cU0uQC6uceaDCXbmJBlacOjkMC2LGKlZJ2Or+JmIbR2Q26qgOQAAVNBEFUydDioAAAAASUVORK5CYII=';

/** 방과 함께 저장되는 기본 보관함 항목. id 는 placed.itemId 와 이어진다. */
export const DEFAULT_ITEMS: InventoryItemType[] = [
  {
    id: 'seed-star',
    name: '반짝별',
    maskPng: STAR_PNG,
    carve: { depth: 11, mode: 'inflate' },
    traits: { character: true },
    tracks: [],
  },
  {
    id: 'seed-lamp',
    name: '무드등',
    maskPng: LAMP_PNG,
    carve: { depth: 12, mode: 'inflate' },
    traits: { lamp: true },
    tracks: [],
  },
  {
    id: 'seed-jukebox',
    name: '주크박스',
    maskPng: JUKEBOX_PNG,
    carve: { depth: 12, mode: 'inflate' },
    traits: { music: true, piano: true },
    tracks: [],
  },
];

/** 바닥(중심 원점, size=12 기준 대략 -6..+6)에 겹치지 않게 배치한다. */
export const DEFAULT_PLACED: PlacedObjectType[] = [
  {
    key: 'seed-star-1',
    itemId: 'seed-star',
    x: 0,
    z: 1.5,
    y: 0,
    rot: 0,
    height: 3,
  },
  {
    key: 'seed-lamp-1',
    itemId: 'seed-lamp',
    x: -3,
    z: -3,
    y: 0,
    rot: 0,
    height: 3.6,
    lamp: { on: true, bright: DEFAULT_LAMP_BRIGHT, tint: DEFAULT_LAMP_TINT },
  },
  {
    key: 'seed-jukebox-1',
    itemId: 'seed-jukebox',
    x: 3,
    z: -3,
    y: 0,
    rot: 0,
    height: 2.8,
  },
];
