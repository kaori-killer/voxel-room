export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatTiles(value: number): string {
  return `${value.toFixed(1)}칸`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, now.getTime() - then);
  const minute = 60_000;
  if (diff < minute) return '방금';
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}분 전`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}시간 전`;
  return `${Math.floor(diff / (24 * 60 * minute))}일 전`;
}

export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(date);
}
