'use client';

import styles from './interactBubble.module.css';

export type InteractBubbleProps = {
  label: string;
  x: number;
  y: number;
  showKeyHint: boolean;
  onInteract: () => void;
};

/** 캐릭터가 다가간 오브제 위에 떠서 사용을 안내한다. 화면 좌표에 붙는다. */
export function InteractBubble({ label, x, y, showKeyHint, onInteract }: InteractBubbleProps) {
  return (
    <button
      type="button"
      className={styles.bubble}
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={onInteract}
    >
      <span>{label}</span>
      {showKeyHint ? <kbd>E</kbd> : null}
    </button>
  );
}
