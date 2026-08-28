'use client';

import { LAMP_TINT_MAP } from '@/domain/constants';
import { LAMP_TINTS, TRAIT_KEYS, TRAIT_LABEL_MAP } from '@/domain/types';
import type { InventoryItemType, LampStateType, TraitKeyType } from '@/domain/types';
import styles from './traitControls.module.css';

export type TraitControlsProps = {
  item: InventoryItemType;
  lamp: LampStateType | null;
  onToggleTrait: (trait: TraitKeyType, on: boolean) => void;
  onOpenMusic: () => void;
  onSetLamp: (patch: Partial<LampStateType>) => void;
};

/** 선택한 오브제에 속성을 붙이고, 음악·전등은 여기서 곧바로 손본다. */
export function TraitControls({ item, lamp, onToggleTrait, onOpenMusic, onSetLamp }: TraitControlsProps) {
  const traits = item.traits;

  return (
    <section className={styles.wrap} aria-label={`${item.name} 속성`}>
      <div className={styles.chips} role="group" aria-label="속성">
        {TRAIT_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.chip}
            aria-pressed={Boolean(traits[key])}
            onClick={() => onToggleTrait(key, !traits[key])}
          >
            {TRAIT_LABEL_MAP[key]}
          </button>
        ))}
      </div>

      {traits.music ? (
        <button type="button" className={styles.sub} onClick={onOpenMusic}>
          재생목록 열기
        </button>
      ) : null}

      {traits.piano ? (
        <p className={styles.note}>
          캐릭터로 다가가 <kbd>E</kbd> 를 누르면 연주할 수 있습니다.
        </p>
      ) : null}

      {traits.lamp && lamp ? (
        <div className={styles.lamp}>
          <div className={styles.lampHead}>
            <span className="field-label">전등</span>
            <span className={styles.lampState}>{lamp.on ? '켜짐' : '꺼짐'}</span>
            <button
              type="button"
              role="switch"
              aria-checked={lamp.on}
              aria-label="불 켜고 끄기"
              className={styles.switch}
              onClick={() => onSetLamp({ on: !lamp.on })}
            >
              <span aria-hidden="true" />
            </button>
          </div>
          <label className={styles.bright}>
            <span>밝기</span>
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.05}
              value={lamp.bright}
              disabled={!lamp.on}
              onChange={(event) => onSetLamp({ bright: Number(event.target.value) })}
            />
          </label>
          <div className={styles.tints} role="group" aria-label="불빛 색">
            {LAMP_TINTS.map((tint) => (
              <button
                key={tint}
                type="button"
                className={styles.tint}
                aria-pressed={lamp.tint === tint}
                aria-label={LAMP_TINT_MAP[tint].label}
                title={LAMP_TINT_MAP[tint].label}
                style={{ background: LAMP_TINT_MAP[tint].css }}
                onClick={() => onSetLamp({ tint })}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
