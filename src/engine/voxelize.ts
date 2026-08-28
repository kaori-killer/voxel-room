import type { CarveOptionsType, VoxelDataType } from '@/domain/types';
import { clamp } from '@/lib/math';

const ALPHA_SOLID = 250;
const ALPHA_KEEP = 128;
const ALPHA_KEEP_LOOSE = 96;
const MIN_KEPT_CELLS = 12;

export type ImageSourceType = HTMLImageElement | HTMLCanvasElement;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * 한 번에 줄이면 얇은 선이 사라진다. 절반씩 여러 번 줄여 형태를 남긴다.
 */
export function sampleImage(source: ImageSourceType, gridWidth: number, gridHeight: number): ImageData {
  let current: ImageSourceType = source;
  let w = source.width;
  let h = source.height;

  while (w * 0.5 > gridWidth && h * 0.5 > gridHeight) {
    w = Math.max(gridWidth, Math.round(w / 2));
    h = Math.max(gridHeight, Math.round(h / 2));
    const step = createCanvas(w, h);
    const stepCtx = step.getContext('2d');
    if (!stepCtx) break;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.clearRect(0, 0, w, h);
    stepCtx.drawImage(current, 0, 0, w, h);
    current = step;
  }

  const target = createCanvas(gridWidth, gridHeight);
  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D 컨텍스트를 만들지 못했습니다');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, gridWidth, gridHeight);
  ctx.drawImage(current, 0, 0, gridWidth, gridHeight);
  return ctx.getImageData(0, 0, gridWidth, gridHeight);
}

function colorDistance(data: Uint8ClampedArray, offset: number, r: number, g: number, b: number): number {
  const dr = (data[offset] ?? 0) - r;
  const dg = (data[offset + 1] ?? 0) - g;
  const db = (data[offset + 2] ?? 0) - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 테두리에서 시작하는 flood fill. 그림 안쪽의 흰색은 배경으로 보지 않는다.
 */
export function maskByFlood(
  data: Uint8ClampedArray,
  gridWidth: number,
  gridHeight: number,
  tolerance: number,
): Uint8Array {
  const total = gridWidth * gridHeight;
  const filled = new Uint8Array(total).fill(1);

  const corners = [0, (gridWidth - 1) * 4, (total - gridWidth) * 4, (total - 1) * 4];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of corners) {
    r += data[c] ?? 0;
    g += data[c + 1] ?? 0;
    b += data[c + 2] ?? 0;
  }
  r /= 4;
  g /= 4;
  b /= 4;

  const queue: number[] = [];
  const seed = (index: number): void => {
    if (filled[index] && colorDistance(data, index * 4, r, g, b) <= tolerance) {
      filled[index] = 0;
      queue.push(index);
    }
  };

  for (let x = 0; x < gridWidth; x += 1) {
    seed(x);
    seed((gridHeight - 1) * gridWidth + x);
  }
  for (let y = 0; y < gridHeight; y += 1) {
    seed(y * gridWidth);
    seed(y * gridWidth + gridWidth - 1);
  }

  let head = 0;
  while (head < queue.length) {
    const index = queue[head] ?? 0;
    head += 1;
    const x = index % gridWidth;
    const y = Math.floor(index / gridWidth);
    if (x > 0) seed(index - 1);
    if (x < gridWidth - 1) seed(index + 1);
    if (y > 0) seed(index - gridWidth);
    if (y < gridHeight - 1) seed(index + gridWidth);
  }
  return filled;
}

/** 외톨이 픽셀을 턴다. 다 지워질 것 같으면 원본을 지킨다. */
export function despeckle(
  filled: Uint8Array,
  gridWidth: number,
  gridHeight: number,
  erode: boolean,
): Uint8Array {
  const out = new Uint8Array(filled);
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const i = y * gridWidth + x;
      if (!filled[i]) continue;
      let neighbours = 0;
      if (x > 0 && filled[i - 1]) neighbours += 1;
      if (x < gridWidth - 1 && filled[i + 1]) neighbours += 1;
      if (y > 0 && filled[i - gridWidth]) neighbours += 1;
      if (y < gridHeight - 1 && filled[i + gridWidth]) neighbours += 1;
      if (neighbours <= 1) out[i] = 0;
      else if (erode && neighbours < 4) out[i] = 0;
    }
  }
  let kept = 0;
  for (let i = 0; i < out.length; i += 1) if (out[i]) kept += 1;
  return kept < MIN_KEPT_CELLS ? filled : out;
}

/** 실루엣 안쪽으로 갈수록 커지는 거리장. 부풀리기 두께의 근거. */
export function distanceField(filled: Uint8Array, gridWidth: number, gridHeight: number): Float32Array {
  const total = gridWidth * gridHeight;
  const dist = new Float32Array(total);
  const INF = 1e9;
  const D1 = 1;
  const D2 = Math.SQRT2;

  for (let i = 0; i < total; i += 1) dist[i] = filled[i] ? INF : 0;

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const i = y * gridWidth + x;
      if (dist[i] === 0) continue;
      let value = dist[i] ?? INF;
      if (x === 0 || y === 0 || x === gridWidth - 1 || y === gridHeight - 1) value = Math.min(value, D1);
      if (x > 0) value = Math.min(value, (dist[i - 1] ?? INF) + D1);
      if (y > 0) value = Math.min(value, (dist[i - gridWidth] ?? INF) + D1);
      if (x > 0 && y > 0) value = Math.min(value, (dist[i - gridWidth - 1] ?? INF) + D2);
      if (x < gridWidth - 1 && y > 0) value = Math.min(value, (dist[i - gridWidth + 1] ?? INF) + D2);
      dist[i] = value;
    }
  }
  for (let y = gridHeight - 1; y >= 0; y -= 1) {
    for (let x = gridWidth - 1; x >= 0; x -= 1) {
      const i = y * gridWidth + x;
      if (dist[i] === 0) continue;
      let value = dist[i] ?? INF;
      if (x < gridWidth - 1) value = Math.min(value, (dist[i + 1] ?? INF) + D1);
      if (y < gridHeight - 1) value = Math.min(value, (dist[i + gridWidth] ?? INF) + D1);
      if (x < gridWidth - 1 && y < gridHeight - 1) value = Math.min(value, (dist[i + gridWidth + 1] ?? INF) + D2);
      if (x > 0 && y < gridHeight - 1) value = Math.min(value, (dist[i + gridWidth - 1] ?? INF) + D2);
      dist[i] = value;
    }
  }
  return dist;
}

function resolveGrid(source: ImageSourceType, grid: number): { width: number; height: number } {
  const ratio = source.width / source.height;
  if (ratio >= 1) return { width: grid, height: Math.max(2, Math.round(grid / ratio)) };
  return { width: Math.max(2, Math.round(grid * ratio)), height: grid };
}

function buildMask(
  data: Uint8ClampedArray,
  gridWidth: number,
  gridHeight: number,
  options: CarveOptionsType,
): Uint8Array {
  const total = gridWidth * gridHeight;
  let hasTransparency = false;
  for (let i = 0; i < total; i += 1) {
    if ((data[i * 4 + 3] ?? 255) < ALPHA_SOLID) {
      hasTransparency = true;
      break;
    }
  }

  if (options.alphaOnly || (options.removeBg && hasTransparency)) {
    const filled = new Uint8Array(total);
    for (let i = 0; i < total; i += 1) filled[i] = (data[i * 4 + 3] ?? 0) >= ALPHA_KEEP ? 1 : 0;
    return filled;
  }
  if (!options.removeBg) {
    const filled = new Uint8Array(total);
    for (let i = 0; i < total; i += 1) filled[i] = (data[i * 4 + 3] ?? 0) >= ALPHA_KEEP_LOOSE ? 1 : 0;
    return filled;
  }
  return maskByFlood(data, gridWidth, gridHeight, options.tolerance);
}

function buildDepths(
  data: Uint8ClampedArray,
  filled: Uint8Array,
  gridWidth: number,
  gridHeight: number,
  options: CarveOptionsType,
): Int16Array {
  const total = gridWidth * gridHeight;
  const depth = new Int16Array(total);
  const D = options.depth;

  if (options.mode === 'inflate') {
    const dist = distanceField(filled, gridWidth, gridHeight);
    let maxDist = 1;
    for (let i = 0; i < total; i += 1) if ((dist[i] ?? 0) > maxDist) maxDist = dist[i] ?? 1;
    const radius = Math.max(1, Math.min(D * 0.6, maxDist));
    for (let i = 0; i < total; i += 1) {
      if (!filled[i]) continue;
      depth[i] = 1 + Math.round((D - 1) * Math.sqrt(clamp((dist[i] ?? 0) / radius, 0, 1)));
    }
    return depth;
  }
  if (options.mode === 'relief') {
    for (let i = 0; i < total; i += 1) {
      if (!filled[i]) continue;
      const lum =
        (0.2126 * (data[i * 4] ?? 0) + 0.7152 * (data[i * 4 + 1] ?? 0) + 0.0722 * (data[i * 4 + 2] ?? 0)) / 255;
      depth[i] = 1 + Math.round((D - 1) * lum);
    }
    return depth;
  }
  for (let i = 0; i < total; i += 1) if (filled[i]) depth[i] = D;
  return depth;
}

/**
 * 그림 한 장을 복셀 덩어리로 깎는다.
 * 보이지 않는 안쪽 복셀은 버리고, 저장·복원용 마스크 PNG 를 함께 낸다.
 */
export function carveVoxels(source: ImageSourceType, options: CarveOptionsType): VoxelDataType | null {
  const { width: gw, height: gh } = resolveGrid(source, options.grid);
  const image = sampleImage(source, gw, gh);
  const data = image.data;
  const total = gw * gh;

  let filled = buildMask(data, gw, gh, options);
  filled = despeckle(filled, gw, gh, Boolean(options.trim && options.removeBg));

  let minX = gw;
  let maxX = -1;
  let minY = gh;
  let maxY = -1;
  for (let y = 0; y < gh; y += 1) {
    for (let x = 0; x < gw; x += 1) {
      if (!filled[y * gw + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;

  const depth = buildDepths(data, filled, gw, gh, options);
  const z0 = new Int16Array(total);
  const z1 = new Int16Array(total);
  let depthExtent = 1;
  for (let i = 0; i < total; i += 1) {
    if (!filled[i]) continue;
    const d = depth[i] ?? 1;
    z0[i] = -Math.floor(d / 2);
    z1[i] = (z0[i] ?? 0) + d - 1;
    if (d > depthExtent) depthExtent = d;
  }

  const occupied = (px: number, py: number, pz: number): boolean => {
    if (px < 0 || py < 0 || px >= gw || py >= gh) return false;
    const j = py * gw + px;
    if (!filled[j]) return false;
    return pz >= (z0[j] ?? 0) && pz <= (z1[j] ?? 0);
  };

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  const centreX = minX + boxWidth / 2 - 0.5;
  const positions: number[] = [];
  const colors: number[] = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const i = y * gw + x;
      if (!filled[i]) continue;
      const r = (data[i * 4] ?? 0) / 255;
      const g = (data[i * 4 + 1] ?? 0) / 255;
      const b = (data[i * 4 + 2] ?? 0) / 255;
      for (let z = z0[i] ?? 0; z <= (z1[i] ?? 0); z += 1) {
        let open = 0;
        if (!occupied(x - 1, y, z)) open += 1;
        if (!occupied(x + 1, y, z)) open += 1;
        if (!occupied(x, y - 1, z)) open += 1;
        if (!occupied(x, y + 1, z)) open += 1;
        if (!occupied(x, y, z - 1)) open += 1;
        if (!occupied(x, y, z + 1)) open += 1;
        if (open === 0) continue;
        positions.push(x - centreX, maxY - y + 0.5, z);
        colors.push(r, g, b, Math.min(1, 0.86 + 0.045 * open));
      }
    }
  }

  return {
    gridWidth: boxWidth,
    gridHeight: boxHeight,
    depthExtent,
    count: positions.length / 3,
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    maskPng: buildMaskPng(data, filled, gw, minX, minY, boxWidth, boxHeight),
  };
}

function buildMaskPng(
  data: Uint8ClampedArray,
  filled: Uint8Array,
  gridWidth: number,
  minX: number,
  minY: number,
  boxWidth: number,
  boxHeight: number,
): string {
  const canvas = createCanvas(boxWidth, boxHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const out = ctx.createImageData(boxWidth, boxHeight);
  for (let y = 0; y < boxHeight; y += 1) {
    for (let x = 0; x < boxWidth; x += 1) {
      const src = (y + minY) * gridWidth + (x + minX);
      const dst = (y * boxWidth + x) * 4;
      if (!filled[src]) continue;
      out.data[dst] = data[src * 4] ?? 0;
      out.data[dst + 1] = data[src * 4 + 1] ?? 0;
      out.data[dst + 2] = data[src * 4 + 2] ?? 0;
      out.data[dst + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}
