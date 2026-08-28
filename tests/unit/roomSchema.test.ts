import { describe, expect, it } from 'vitest';
import { emptyRoom, parseRoom, roomIdSchema, saveRoomReqSchema } from '@/domain/roomSchema';
import { ROOM_ID_PATTERN } from '@/domain/constants';
import { buildOwnerKey, buildRoomId } from '@/lib/id';

const MASK = 'data:image/png;base64,AAAA';

function validRoom() {
  return {
    version: 1,
    settings: { size: 12, palette: 'wood' },
    items: [{ id: 'i1', name: '버섯', maskPng: MASK, carve: { depth: 11, mode: 'inflate' }, traits: { lamp: true }, tracks: [], photo: undefined as string | undefined }],
    placed: [{ key: 'p1', itemId: 'i1', x: 0, z: 0, y: 0, rot: 0, height: 2 }],
  };
}

describe('roomIdSchema', () => {
  it('만든 id 는 늘 형식을 지킨다', () => {
    for (let i = 0; i < 50; i += 1) expect(ROOM_ID_PATTERN.test(buildRoomId())).toBe(true);
  });

  it('헷갈리는 글자는 쓰지 않는다', () => {
    const ids = Array.from({ length: 50 }, () => buildRoomId()).join('');
    expect(/[01ilo]/.test(ids)).toBe(false);
  });

  it('아무 문자열이나 방 주소로 보지 않는다', () => {
    expect(roomIdSchema.safeParse('admin').success).toBe(false);
    expect(roomIdSchema.safeParse('').success).toBe(false);
  });
});

describe('parseRoom', () => {
  it('제대로 된 방을 그대로 통과시킨다', () => {
    const room = parseRoom(validRoom());
    expect(room.items).toHaveLength(1);
    expect(room.placed).toHaveLength(1);
  });

  it('깨진 개체만 버리고 나머지를 살린다', () => {
    const broken = validRoom();
    broken.placed.push({ key: 'p2', itemId: 'i1', x: Number.NaN, z: 0, y: 0, rot: 0, height: 2 });
    const room = parseRoom(broken);
    expect(room.placed).toHaveLength(1);
  });

  it('없는 오브제를 가리키는 배치를 정리한다', () => {
    const orphan = validRoom();
    orphan.placed.push({ key: 'p3', itemId: 'sky', x: 0, z: 0, y: 0, rot: 0, height: 2 });
    expect(parseRoom(orphan).placed).toHaveLength(1);
  });

  it('전혀 다른 값이 오면 빈 방을 낸다', () => {
    expect(parseRoom('nope')).toEqual(emptyRoom());
    expect(parseRoom(null).items).toHaveLength(0);
  });
});

describe('saveRoomReqSchema', () => {
  it('PNG 가 아닌 마스크를 거른다', () => {
    const room = validRoom();
    room.items[0]!.maskPng = 'javascript:alert(1)';
    const result = saveRoomReqSchema.safeParse({ room, ownerKeyHash: buildOwnerKey() });
    expect(result.success).toBe(false);
  });

  it('이미지가 아닌 썸네일을 거른다', () => {
    const result = saveRoomReqSchema.safeParse({
      room: validRoom(), ownerKeyHash: buildOwnerKey(), thumbnail: 'data:text/html,<script>',
    });
    expect(result.success).toBe(false);
  });

  it('소유 키 없이는 저장할 수 없다', () => {
    expect(saveRoomReqSchema.safeParse({ room: validRoom() }).success).toBe(false);
  });

  it('이미지가 아닌 사진을 거른다', () => {
    const room = validRoom();
    room.items[0]!.photo = 'javascript:alert(1)';
    const result = saveRoomReqSchema.safeParse({ room, ownerKeyHash: buildOwnerKey() });
    expect(result.success).toBe(false);
  });
});

describe('오브제 사진', () => {
  it('이미지 data URL 사진을 그대로 살린다', () => {
    const room = validRoom();
    room.items[0]!.photo = 'data:image/jpeg;base64,AAAA';
    expect(parseRoom(room).items[0]!.photo).toBe('data:image/jpeg;base64,AAAA');
  });

  it('사진이 깨진 오브제는 통째로 버려 방을 지킨다', () => {
    const room = validRoom();
    room.items[0]!.photo = 'not-an-image';
    expect(parseRoom(room).items).toHaveLength(0);
  });
});
