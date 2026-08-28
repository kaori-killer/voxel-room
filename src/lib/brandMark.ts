/** 브랜드 복셀 큐브. 파비콘·앱 아이콘·공유 카드가 같은 마크를 공유한다. */
export function cubeSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<polygon points="50,6 92,30 50,54 8,30" fill="#f4b45f"/>',
    '<polygon points="8,30 50,54 50,98 8,74" fill="#b4650c"/>',
    '<polygon points="92,30 50,54 50,98 92,74" fill="#8a4e08"/>',
    '</svg>',
  ].join('');
}

/** ImageResponse(<img>) 에 넣기 위한 data URI. */
export function cubeDataUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(cubeSvg())}`;
}
