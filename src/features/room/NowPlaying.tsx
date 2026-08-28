'use client';

import styles from './nowPlaying.module.css';

export type NowPlayingProps = {
  trackName: string;
  fromName: string;
  playing: boolean;
  onToggle: () => void;
};

/** 오브제를 골라 두지 않아도 배경에서 흐르는 곡을 알려주는 작은 바. */
export function NowPlaying({ trackName, fromName, playing, onToggle }: NowPlayingProps) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.toggle}
        onClick={onToggle}
        aria-label={playing ? '일시정지' : '재생'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <span className={styles.text}>
        <span className={styles.name}>{trackName}</span>
        <span className={styles.from}>{fromName}</span>
      </span>
    </div>
  );
}
