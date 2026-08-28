export type FakeImageType = { width: number; height: number; pixels: Uint8ClampedArray };

const sources = new WeakMap<object, FakeImageType>();

export function makeImage(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
): FakeImageType {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return { width, height, pixels };
}

/**
 * jsdom 에는 2D 컨텍스트가 없다. 복셀 변환에 필요한 만큼만 흉내 낸다.
 * drawImage 는 최근접 이웃으로 축소해 결과를 예측할 수 있게 한다.
 */
export function installCanvasStub(): void {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;

  proto.getContext = function getContext(this: HTMLCanvasElement) {
    const canvas: HTMLCanvasElement = this;
    return {
      canvas,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      clearRect: () => {},
      fillRect: () => {},
      drawImage(source: FakeImageType | HTMLCanvasElement, _dx: number, _dy: number, dw?: number, dh?: number) {
        const src = 'pixels' in source ? source : sources.get(source);
        if (!src) return;
        const width = dw ?? canvas.width;
        const height = dh ?? canvas.height;
        const out = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const sx = Math.min(src.width - 1, Math.floor((x / width) * src.width));
            const sy = Math.min(src.height - 1, Math.floor((y / height) * src.height));
            const si = (sy * src.width + sx) * 4;
            const di = (y * canvas.width + x) * 4;
            out[di] = src.pixels[si] ?? 0;
            out[di + 1] = src.pixels[si + 1] ?? 0;
            out[di + 2] = src.pixels[si + 2] ?? 0;
            out[di + 3] = src.pixels[si + 3] ?? 0;
          }
        }
        sources.set(canvas, { width: canvas.width, height: canvas.height, pixels: out });
      },
      getImageData(_x: number, _y: number, w: number, h: number) {
        const stored = sources.get(canvas);
        const data = stored ? stored.pixels : new Uint8ClampedArray(w * h * 4);
        return { width: w, height: h, data };
      },
      createImageData(w: number, h: number) {
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      },
      putImageData(image: { width: number; height: number; data: Uint8ClampedArray }) {
        sources.set(canvas, { width: image.width, height: image.height, pixels: image.data });
      },
      createRadialGradient: () => ({ addColorStop: () => {} }),
    };
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  proto.toDataURL = function toDataURL(this: HTMLCanvasElement) {
    const stored = sources.get(this);
    return `data:image/png;base64,${btoa(String(stored?.pixels.length ?? 0))}`;
  } as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
}

export function readCanvasPixels(canvas: HTMLCanvasElement): FakeImageType | undefined {
  return sources.get(canvas);
}
