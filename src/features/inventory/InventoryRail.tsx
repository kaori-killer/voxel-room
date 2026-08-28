'use client';

import type { InventoryItemType, TraitKeyType } from '@/domain/types';
import { TRAIT_KEYS, TRAIT_LABEL_MAP } from '@/domain/types';
import styles from './inventory.module.css';

export type InventoryRailProps = {
  items: InventoryItemType[];
  thumbnails: Record<string, string>;
  canEdit: boolean;
  onTakeOut: (itemId: string) => void;
  onDelete: (itemId: string) => void;
};

const BADGE_CLASS_MAP: Record<TraitKeyType, string | undefined> = {
  character: styles.badgeCharacter,
  music: styles.badgeMusic,
  lamp: styles.badgeLamp,
  piano: styles.badgePiano,
};

export function InventoryRail({ items, thumbnails, canEdit, onTakeOut, onDelete }: InventoryRailProps) {
  if (!items.length) {
    return (
      <p className={styles.empty}>
        {canEdit ? '아직 오브제가 없습니다. 사진을 올려 첫 오브제를 깎아 보세요.' : '이 방에는 보관된 오브제가 없습니다.'}
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const traits = TRAIT_KEYS.filter((key) => item.traits[key]);
        const thumbnail = thumbnails[item.id];
        return (
          <li key={item.id} className={styles.card}>
            <button
              type="button"
              className={styles.take}
              onClick={() => onTakeOut(item.id)}
              disabled={!canEdit}
              aria-label={canEdit ? `${item.name} 방에 꺼내기` : item.name}
            >
              {thumbnail ? (
                <img src={thumbnail} alt="" className={styles.thumb} />
              ) : (
                <span className={styles.thumbFallback} aria-hidden="true" />
              )}
              <span className={styles.name}>{item.name}</span>
            </button>
            {traits.length || item.photo ? (
              <span className={styles.badges}>
                {traits.map((trait) => (
                  <span key={trait} className={`${styles.badge} ${BADGE_CLASS_MAP[trait] ?? ''}`}>
                    {TRAIT_LABEL_MAP[trait]}
                  </span>
                ))}
                {item.photo ? <span className={`${styles.badge} ${styles.badgePhoto}`}>사진</span> : null}
              </span>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                className={styles.remove}
                onClick={() => onDelete(item.id)}
                aria-label={`${item.name} 보관함에서 지우기`}
              >
                ✕
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
