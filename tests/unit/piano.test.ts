import { describe, expect, it } from 'vitest';
import { BLACK_KEYS, noteFrequency, PIANO_KEY_BY_CODE, PIANO_KEYS, WHITE_KEYS, whiteKeyOffsetFor } from '@/audio/piano';

describe('건반 배치', () => {
  it('흰건반 10개와 검은건반 7개로 한 옥타브를 조금 넘긴다', () => {
    expect(WHITE_KEYS).toHaveLength(10);
    expect(BLACK_KEYS).toHaveLength(7);
    expect(PIANO_KEYS).toHaveLength(17);
  });

  it('키가 겹치지 않는다', () => {
    expect(PIANO_KEY_BY_CODE.size).toBe(PIANO_KEYS.length);
  });

  it('검은건반은 흰건반 경계에 놓인다', () => {
    expect(whiteKeyOffsetFor(1)).toBe(1);
    expect(whiteKeyOffsetFor(6)).toBe(4);
    expect(whiteKeyOffsetFor(15)).toBe(9);
  });
});

describe('noteFrequency', () => {
  it('A4 는 440Hz 다', () => {
    expect(noteFrequency(9, 4)).toBeCloseTo(440, 6);
  });

  it('한 옥타브 위는 두 배다', () => {
    expect(noteFrequency(0, 5) / noteFrequency(0, 4)).toBeCloseTo(2, 6);
  });

  it('반음 위는 12제곱근 2배다', () => {
    expect(noteFrequency(1, 4) / noteFrequency(0, 4)).toBeCloseTo(Math.pow(2, 1 / 12), 6);
  });
});
