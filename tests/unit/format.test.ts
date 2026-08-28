import { describe, expect, it } from 'vitest';
import { formatDuration, formatRelativeTime, formatTiles } from '@/lib/format';

describe('formatDuration', () => {
  it('분:초로 적는다', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('아직 길이를 모를 때도 0:00 을 낸다', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Infinity)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('formatTiles', () => {
  it('방 칸 기준으로 적는다', () => {
    expect(formatTiles(2.44)).toBe('2.4칸');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  it('가까운 시간은 말로 적는다', () => {
    expect(formatRelativeTime('2026-08-28T11:59:30Z', now)).toBe('방금');
    expect(formatRelativeTime('2026-08-28T11:30:00Z', now)).toBe('30분 전');
    expect(formatRelativeTime('2026-08-28T09:00:00Z', now)).toBe('3시간 전');
    expect(formatRelativeTime('2026-08-25T12:00:00Z', now)).toBe('3일 전');
  });

  it('알 수 없는 값에는 아무것도 적지 않는다', () => {
    expect(formatRelativeTime('nope', now)).toBe('');
  });
});
