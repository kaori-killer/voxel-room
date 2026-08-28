'use client';

import { useState } from 'react';
import { ROOM_PALETTE_MAP, ROOM_SIZE_OPTIONS } from '@/domain/constants';
import { ROOM_PALETTES } from '@/domain/types';
import type { RoomPaletteType, RoomSettingsType } from '@/domain/types';
import { buildRoomUrl } from '@/lib/url';
import styles from './settings.module.css';

export type RoomSettingsPanelProps = {
  onCopyFailed: (url: string) => void;
  settings: RoomSettingsType;
  canEdit: boolean;
  roomId: string;
  shared: boolean;
  onChange: (patch: Partial<RoomSettingsType>) => void;
  onResetView: () => void;
  onCopied: () => void;
  onOpenChange?: (open: boolean) => void;
};

const SIZE_LABEL_MAP: Record<number, string> = { 10: '작게', 12: '보통', 16: '넓게' };

export function RoomSettingsPanel({
  settings,
  canEdit,
  roomId,
  shared,
  onChange,
  onResetView,
  onCopied,
  onCopyFailed,
  onOpenChange,
}: RoomSettingsPanelProps) {
  const [open, setOpen] = useState(false);

  const toggleOpen = (): void => {
    setOpen((value) => {
      const next = !value;
      onOpenChange?.(next);
      return next;
    });
  };

  const handleCopyLink = async (): Promise<void> => {
    const url = buildRoomUrl(roomId, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      onCopied();
    } catch {
      onCopyFailed(url);
    }
  };

  return (
    <>
      <button type="button" className="chip-btn" aria-expanded={open} onClick={toggleOpen}>
        방 꾸미기
      </button>
      {open ? (
        <section className={styles.panel} aria-label="방 설정">
          {canEdit ? (
            <>
              <div className={styles.field}>
                <span className="field-label">방 크기</span>
                <div className={styles.segment} role="group" aria-label="방 크기">
                  {ROOM_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={settings.size === size}
                      onClick={() => onChange({ size })}
                    >
                      {SIZE_LABEL_MAP[size] ?? `${size}칸`}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <span className="field-label">바닥과 벽</span>
                <div className={styles.palette}>
                  {ROOM_PALETTES.map((palette: RoomPaletteType) => (
                    <button
                      key={palette}
                      type="button"
                      aria-pressed={settings.palette === palette}
                      aria-label={ROOM_PALETTE_MAP[palette].label}
                      title={ROOM_PALETTE_MAP[palette].label}
                      className={styles.swatch}
                      style={{
                        backgroundImage: `linear-gradient(160deg, ${ROOM_PALETTE_MAP[palette].sky1} 0 50%, ${ROOM_PALETTE_MAP[palette].sky2} 50% 100%)`,
                      }}
                      onClick={() => onChange({ palette })}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : null}
          <div className={styles.row}>
            <button type="button" className="btn btn-ghost" onClick={onResetView}>
              시점 리셋
            </button>
            {shared ? (
              <button type="button" className="btn btn-ghost" onClick={() => void handleCopyLink()}>
                링크 복사
              </button>
            ) : null}
          </div>
          {!shared ? (
            <p className={styles.note}>
              공유 저장소가 연결되지 않아 이 방은 이 브라우저에만 남습니다.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
