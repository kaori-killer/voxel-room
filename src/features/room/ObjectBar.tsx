'use client';

import { MAX_OBJECT_HEIGHT, MIN_OBJECT_HEIGHT } from '@/domain/constants';
import { formatTiles } from '@/lib/format';
import styles from './objectBar.module.css';

export type ObjectBarProps = {
  name: string;
  height: number;
  hasPhoto: boolean;
  onRotate: (direction: number) => void;
  onResize: (height: number) => void;
  onAddPhoto: () => void;
  onRemovePhoto: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDone: () => void;
};

export function ObjectBar({
  name,
  height,
  hasPhoto,
  onRotate,
  onResize,
  onAddPhoto,
  onRemovePhoto,
  onDuplicate,
  onRemove,
  onDone,
}: ObjectBarProps) {
  return (
    <div className={styles.bar} role="toolbar" aria-label={`${name} 조작`}>
      <span className={styles.name}>{name}</span>
      <button type="button" onClick={() => onRotate(-1)} aria-label="왼쪽으로 돌리기">
        ↺
      </button>
      <button type="button" onClick={() => onRotate(1)} aria-label="오른쪽으로 돌리기">
        ↻
      </button>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.size}>
        <label htmlFor="object-size">크기</label>
        <input
          id="object-size"
          type="range"
          min={MIN_OBJECT_HEIGHT}
          max={MAX_OBJECT_HEIGHT}
          step={0.1}
          value={height}
          onChange={(event) => onResize(Number(event.target.value))}
        />
        <output htmlFor="object-size">{formatTiles(height)}</output>
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <button type="button" onClick={onAddPhoto}>
        {hasPhoto ? '사진 바꾸기' : '사진'}
      </button>
      {hasPhoto ? (
        <button type="button" onClick={onRemovePhoto}>
          사진 빼기
        </button>
      ) : null}
      <span className={styles.divider} aria-hidden="true" />
      <button type="button" onClick={onDuplicate}>
        복제
      </button>
      <button type="button" className={styles.remove} onClick={onRemove}>
        치우기
      </button>
      <button type="button" className={styles.done} onClick={onDone}>
        완료
      </button>
    </div>
  );
}
