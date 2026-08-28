'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { carveVoxels } from '@/engine/voxelize';
import { buildVoxelMesh, disposeMesh } from '@/engine/meshFactory';
import {
  DEFAULT_CARVE_DEPTH,
  DEFAULT_CARVE_GRID,
  DEFAULT_CARVE_MODE,
  DEFAULT_CARVE_TOLERANCE,
  DEPTH_MODE_LABEL_MAP,
  DEPTH_MODE_NOTE_MAP,
} from '@/domain/constants';
import { DEPTH_MODES } from '@/domain/types';
import type { CarveOptionsType, DepthModeType, InventoryItemType, VoxelDataType } from '@/domain/types';
import { buildLocalId } from '@/lib/id';
import { formatCount } from '@/lib/format';
import { normalizeItemName } from '@/lib/image';
import { StudioPreview } from './StudioPreview';
import styles from './studio.module.css';

export type CarveStudioProps = {
  image: HTMLImageElement;
  fileName: string;
  itemCount: number;
  onCancel: () => void;
  onCreate: (item: InventoryItemType, data: VoxelDataType) => void;
};

const CARVE_DEBOUNCE_MS = 90;

export function CarveStudio({ image, fileName, itemCount, onCancel, onCreate }: CarveStudioProps) {
  const [grid, setGrid] = useState(DEFAULT_CARVE_GRID);
  const [depth, setDepth] = useState(DEFAULT_CARVE_DEPTH);
  const [mode, setMode] = useState<DepthModeType>(DEFAULT_CARVE_MODE);
  const [removeBg, setRemoveBg] = useState(true);
  const [tolerance, setTolerance] = useState(DEFAULT_CARVE_TOLERANCE);
  const [trim, setTrim] = useState(false);
  const [name, setName] = useState(() => normalizeItemName(fileName, `오브제 ${itemCount + 1}`));
  const [data, setData] = useState<VoxelDataType | null>(null);
  const [status, setStatus] = useState('깎는 중…');
  const dialogRef = useRef<HTMLDivElement>(null);

  const options = useMemo<CarveOptionsType>(
    () => ({ grid, depth, mode, removeBg, tolerance, trim }),
    [grid, depth, mode, removeBg, tolerance, trim],
  );

  useEffect(() => {
    setStatus('깎는 중…');
    const timer = window.setTimeout(() => {
      const carved = carveVoxels(image, options);
      if (!carved) {
        setData(null);
        setStatus('남는 부분이 없습니다. 배경 판정 민감도를 낮춰 보세요.');
        return;
      }
      setData(carved);
      setStatus(`복셀 ${formatCount(carved.count)}개 · 격자 ${carved.gridWidth}×${carved.gridHeight}`);
    }, CARVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [image, options]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleCreateObject = useCallback(() => {
    if (!data) return;
    const item: InventoryItemType = {
      id: buildLocalId(),
      name: name.trim() || `오브제 ${itemCount + 1}`,
      maskPng: data.maskPng,
      carve: { depth, mode },
      traits: {},
      tracks: [],
    };
    onCreate(item, data);
  }, [data, depth, itemCount, mode, name, onCreate]);

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.scrim} onClick={onCancel} aria-label="닫기" />
      <section className={styles.panel} ref={dialogRef} role="dialog" aria-modal="true" aria-label="오브제 깎기">
        <header className={styles.head}>
          <h2>오브제 깎기</h2>
          <button type="button" className={styles.close} onClick={onCancel} aria-label="닫기">
            ✕
          </button>
        </header>

        <StudioPreview data={data} source={image} buildMesh={buildVoxelMesh} disposeMesh={disposeMesh} />

        <div className={styles.body}>
          <div className={styles.control}>
            <label className={styles.controlHead} htmlFor="studio-name">
              이름
            </label>
            <input
              id="studio-name"
              className="text-input"
              value={name}
              maxLength={24}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className={styles.control}>
            <label className={styles.controlHead} htmlFor="studio-grid">
              격자 해상도 <output>{grid}</output>
            </label>
            <input
              id="studio-grid"
              type="range"
              min={24}
              max={96}
              step={4}
              value={grid}
              onChange={(event) => setGrid(Number(event.target.value))}
            />
          </div>

          <div className={styles.control}>
            <label className={styles.controlHead} htmlFor="studio-depth">
              두께 <output>{depth}</output>
            </label>
            <input
              id="studio-depth"
              type="range"
              min={2}
              max={24}
              step={1}
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
            />
          </div>

          <div className={styles.control}>
            <span className={styles.controlHead}>입체 방식</span>
            <div className={styles.segment} role="group" aria-label="입체 방식">
              {DEPTH_MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                >
                  {DEPTH_MODE_LABEL_MAP[option]}
                </button>
              ))}
            </div>
          </div>
          <p className={styles.note}>{DEPTH_MODE_NOTE_MAP[mode]}</p>

          <hr className={styles.rule} />

          <label className={styles.check}>
            <input type="checkbox" checked={removeBg} onChange={(event) => setRemoveBg(event.target.checked)} />
            배경 지우기
          </label>

          {removeBg ? (
            <>
              <div className={styles.control}>
                <label className={styles.controlHead} htmlFor="studio-tolerance">
                  배경 판정 민감도 <output>{tolerance}</output>
                </label>
                <input
                  id="studio-tolerance"
                  type="range"
                  min={10}
                  max={180}
                  step={5}
                  value={tolerance}
                  onChange={(event) => setTolerance(Number(event.target.value))}
                />
              </div>
              <label className={styles.check}>
                <input type="checkbox" checked={trim} onChange={(event) => setTrim(event.target.checked)} />
                가장자리 한 겹 다듬기
              </label>
            </>
          ) : null}
        </div>

        <footer className={styles.foot}>
          <p className={styles.status} role="status" aria-label="변환 상태">
            {status}
          </p>
          <button type="button" className="btn btn-primary" onClick={handleCreateObject} disabled={!data}>
            보관함에 넣고 방에 놓기
          </button>
        </footer>
      </section>
    </div>
  );
}
