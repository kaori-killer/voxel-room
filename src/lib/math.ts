export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function snapTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** -π..π 로 접은 각도 차. 캐릭터가 먼 쪽으로 도는 것을 막는다. */
export function shortestAngleDelta(from: number, to: number): number {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/** 프레임 간격이 흔들려도 같은 감속을 내는 지수 보간 계수. */
export function damp(dt: number, rate: number): number {
  return 1 - Math.exp(-dt * rate);
}
