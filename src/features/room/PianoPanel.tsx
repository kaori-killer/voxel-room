'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BLACK_KEYS,
  DEFAULT_OCTAVE,
  MAX_OCTAVE,
  MIN_OCTAVE,
  PIANO_KEY_BY_CODE,
  PianoSynth,
  WHITE_KEYS,
  whiteKeyOffsetFor,
} from '@/audio/piano';
import styles from './piano.module.css';

export type PianoPanelProps = {
  title: string;
  touch: boolean;
  onClose: () => void;
};

/** 화면 건반과 물리 키(e.code) 양쪽으로 연주한다. 한글 자판에서도 자리가 맞는다. */
export function PianoPanel({ title, touch, onClose }: PianoPanelProps) {
  const synthRef = useRef<PianoSynth | null>(null);
  const [down, setDown] = useState<ReadonlySet<number>>(new Set());
  const [octave, setOctave] = useState(DEFAULT_OCTAVE);
  const [pedal, setPedal] = useState(false);

  const press = useCallback((semitone: number) => {
    synthRef.current?.press(semitone);
    setDown((prev) => {
      const next = new Set(prev);
      next.add(semitone);
      return next;
    });
  }, []);

  const release = useCallback((semitone: number) => {
    synthRef.current?.release(semitone);
    setDown((prev) => {
      if (!prev.has(semitone)) return prev;
      const next = new Set(prev);
      next.delete(semitone);
      return next;
    });
  }, []);

  useEffect(() => {
    const synth = new PianoSynth();
    synthRef.current = synth;
    synth.resume();
    return () => {
      synth.dispose();
      synthRef.current = null;
    };
  }, []);

  useEffect(() => {
    const heldCodes = new Set<string>();

    const handleDown = (event: KeyboardEvent): void => {
      if (event.code === 'Escape') {
        onClose();
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) {
          synthRef.current?.setSustain(true);
          setPedal(true);
        }
        return;
      }
      const key = PIANO_KEY_BY_CODE.get(event.code);
      if (!key) return;
      event.preventDefault();
      if (heldCodes.has(event.code)) return;
      heldCodes.add(event.code);
      press(key.semitone);
    };

    const handleUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') {
        synthRef.current?.setSustain(false);
        setPedal(false);
        return;
      }
      const key = PIANO_KEY_BY_CODE.get(event.code);
      if (!key) return;
      heldCodes.delete(event.code);
      release(key.semitone);
    };

    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [onClose, press, release]);

  const shiftOctave = (direction: number): void => {
    const next = Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, octave + direction));
    if (next === octave) return;
    synthRef.current?.setOctave(next);
    setDown(new Set());
    setOctave(next);
  };

  const keyHandlers = (semitone: number) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      press(semitone);
    },
    onPointerUp: () => release(semitone),
    onPointerCancel: () => release(semitone),
  });

  return (
    <section className={styles.panel} aria-label={`${title} 연주`}>
      <div className={styles.bar}>
        <span className={styles.title}>{title}</span>
        <span className={`${styles.pedal} ${pedal ? styles.pedalOn : ''}`} aria-hidden="true">
          페달
        </span>
        <div className={styles.octave} role="group" aria-label="옥타브">
          <button type="button" onClick={() => shiftOctave(-1)} disabled={octave <= MIN_OCTAVE} aria-label="옥타브 내리기">
            −
          </button>
          <span className={styles.octaveValue}>{octave}옥타브</span>
          <button type="button" onClick={() => shiftOctave(1)} disabled={octave >= MAX_OCTAVE} aria-label="옥타브 올리기">
            +
          </button>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="피아노 닫기">
          ✕
        </button>
      </div>

      <div className={styles.keys}>
        {WHITE_KEYS.map((key) => (
          <button
            key={key.code}
            type="button"
            className={`${styles.white} ${down.has(key.semitone) ? styles.active : ''}`}
            aria-label={key.label}
            {...keyHandlers(key.semitone)}
          >
            <span className={styles.name}>{key.label}</span>
            <span className={styles.hint}>{key.hint}</span>
          </button>
        ))}
        {BLACK_KEYS.map((key) => (
          <button
            key={key.code}
            type="button"
            className={`${styles.black} ${down.has(key.semitone) ? styles.active : ''}`}
            style={{ left: `calc(${whiteKeyOffsetFor(key.semitone)} * (100% / ${WHITE_KEYS.length}) - 3.2%)` }}
            aria-label={key.label}
            {...keyHandlers(key.semitone)}
          >
            <span className={styles.hint}>{key.hint}</span>
          </button>
        ))}
      </div>

      <p className={styles.foot}>
        {touch ? (
          '건반을 눌러 연주하세요.'
        ) : (
          <>
            물리 키로 연주 · <kbd>Space</kbd> 페달 · <kbd>Esc</kbd> 닫기
          </>
        )}
      </p>
    </section>
  );
}
