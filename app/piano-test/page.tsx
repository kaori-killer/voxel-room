'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BLACK_KEYS,
  MAX_OCTAVE,
  MIN_OCTAVE,
  PIANO_KEY_BY_CODE,
  PianoSynth,
  WHITE_KEYS,
  whiteKeyOffsetFor,
  type PianoKeyType,
} from '@/audio/piano';

const WHITE_WIDTH = 56;
const BLACK_WIDTH = 34;

/**
 * 소리만 귀로 확인하는 임시 페이지. 마우스로 건반을 누르거나 실제 자판을 눌러 본다.
 * 방 화면과 무관한 독립 라우트라, 배포에 섞여도 부담이 없다.
 */
export default function PianoTestPage() {
  const synthRef = useRef<PianoSynth | null>(null);
  const [octave, setOctave] = useState(4);
  const [sounding, setSounding] = useState<Set<number>>(new Set());

  useEffect(() => {
    const synth = new PianoSynth();
    synthRef.current = synth;
    return () => synth.dispose();
  }, []);

  const refresh = useCallback(() => {
    const synth = synthRef.current;
    if (synth) setSounding(new Set(synth.getSoundingSemitones()));
  }, []);

  const press = useCallback(
    (semitone: number) => {
      const synth = synthRef.current;
      if (!synth) return;
      synth.resume();
      synth.press(semitone);
      refresh();
    },
    [refresh],
  );

  const release = useCallback(
    (semitone: number) => {
      synthRef.current?.release(semitone);
      refresh();
    },
    [refresh],
  );

  const changeOctave = useCallback((next: number) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.setOctave(next);
    setOctave(synth.octave);
    setSounding(new Set());
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === 'Space') {
        event.preventDefault();
        synthRef.current?.setSustain(true);
        return;
      }
      const key = PIANO_KEY_BY_CODE.get(event.code);
      if (key) {
        event.preventDefault();
        press(key.semitone);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        synthRef.current?.setSustain(false);
        refresh();
        return;
      }
      const key = PIANO_KEY_BY_CODE.get(event.code);
      if (key) release(key.semitone);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [press, release, refresh]);

  const whiteWidth = WHITE_KEYS.length * WHITE_WIDTH;

  const renderKey = (key: PianoKeyType) => (
    <PianoKeyButton
      key={key.code}
      pianoKey={key}
      active={sounding.has(key.semitone)}
      onPress={press}
      onRelease={release}
    />
  );

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>피아노 소리 확인</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        건반을 누르거나 실제 자판(A~; 줄)을 눌러 보세요. 스페이스바는 서스테인 페달입니다.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 14, color: '#374151' }}>옥타브</span>
        <button
          type="button"
          onClick={() => changeOctave(octave - 1)}
          disabled={octave <= MIN_OCTAVE}
          style={octaveButtonStyle}
        >
          −
        </button>
        <strong style={{ minWidth: 24, textAlign: 'center', fontSize: 16 }}>{octave}</strong>
        <button
          type="button"
          onClick={() => changeOctave(octave + 1)}
          disabled={octave >= MAX_OCTAVE}
          style={octaveButtonStyle}
        >
          +
        </button>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          ({MIN_OCTAVE}~{MAX_OCTAVE}) — 옥타브를 바꿔가며 고음이 거칠게 튀지 않는지 확인해 보세요.
        </span>
      </div>

      <div style={{ position: 'relative', width: whiteWidth, height: 230 }}>
        {WHITE_KEYS.map(renderKey)}
        {BLACK_KEYS.map(renderKey)}
      </div>
    </main>
  );
}

type PianoKeyButtonProps = {
  pianoKey: PianoKeyType;
  active: boolean;
  onPress: (semitone: number) => void;
  onRelease: (semitone: number) => void;
};

function PianoKeyButton({ pianoKey, active, onPress, onRelease }: PianoKeyButtonProps) {
  const left = pianoKey.black
    ? whiteKeyOffsetFor(pianoKey.semitone) * WHITE_WIDTH - BLACK_WIDTH / 2
    : whiteKeyOffsetFor(pianoKey.semitone) * WHITE_WIDTH;
  const base: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    borderRadius: '0 0 6px 6px',
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: 11,
  };
  const style: React.CSSProperties = pianoKey.black
    ? {
        ...base,
        width: BLACK_WIDTH,
        height: 150,
        background: active ? '#4b5563' : '#1f2937',
        color: '#e5e7eb',
        border: '1px solid #111827',
        zIndex: 2,
      }
    : {
        ...base,
        width: WHITE_WIDTH,
        height: 230,
        background: active ? '#c7d2fe' : '#ffffff',
        color: '#374151',
        border: '1px solid #cbd5e1',
        zIndex: 1,
      };
  return (
    <button
      type="button"
      style={style}
      onMouseDown={() => onPress(pianoKey.semitone)}
      onMouseUp={() => onRelease(pianoKey.semitone)}
      onMouseLeave={() => active && onRelease(pianoKey.semitone)}
    >
      <span style={{ opacity: 0.55 }}>{pianoKey.hint}</span>
      <span style={{ fontWeight: 600 }}>{pianoKey.label}</span>
    </button>
  );
}

const octaveButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: 16,
};
