'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_OCTAVE, MIN_OCTAVE, PianoSynth } from '@/audio/piano';

const WHITE_WIDTH = 48;
const BLACK_WIDTH = 30;

type TestKeyType = {
  /** 물리 키 위치(KeyboardEvent.code). 자판 배열·한글 IME 와 무관하게 자리로 맞춘다. */
  code: string;
  hint: string;
  semitone: number;
  black: boolean;
  label: string;
};

/**
 * 낮은 옥타브(왼손) = 키보드 맨 아랫줄, 높은 옥타브(오른손) = 맨 윗줄.
 * 두 옥타브를 격자상 가장 먼 두 줄로 갈라, 한 키보드로 양손을 쳐도 고스팅이 덜하다.
 * 가운데 홈줄(A F K L ;)은 손 완충지대로 비워 둔다.
 */
const LOW_ROW: readonly TestKeyType[] = [
  { code: 'KeyZ', hint: 'Z', semitone: 0, black: false, label: '도' },
  { code: 'KeyS', hint: 'S', semitone: 1, black: true, label: '도♯' },
  { code: 'KeyX', hint: 'X', semitone: 2, black: false, label: '레' },
  { code: 'KeyD', hint: 'D', semitone: 3, black: true, label: '레♯' },
  { code: 'KeyC', hint: 'C', semitone: 4, black: false, label: '미' },
  { code: 'KeyV', hint: 'V', semitone: 5, black: false, label: '파' },
  { code: 'KeyG', hint: 'G', semitone: 6, black: true, label: '파♯' },
  { code: 'KeyB', hint: 'B', semitone: 7, black: false, label: '솔' },
  { code: 'KeyH', hint: 'H', semitone: 8, black: true, label: '솔♯' },
  { code: 'KeyN', hint: 'N', semitone: 9, black: false, label: '라' },
  { code: 'KeyJ', hint: 'J', semitone: 10, black: true, label: '라♯' },
  { code: 'KeyM', hint: 'M', semitone: 11, black: false, label: '시' },
];

const HIGH_ROW: readonly TestKeyType[] = [
  { code: 'KeyQ', hint: 'Q', semitone: 12, black: false, label: '도' },
  { code: 'Digit2', hint: '2', semitone: 13, black: true, label: '도♯' },
  { code: 'KeyW', hint: 'W', semitone: 14, black: false, label: '레' },
  { code: 'Digit3', hint: '3', semitone: 15, black: true, label: '레♯' },
  { code: 'KeyE', hint: 'E', semitone: 16, black: false, label: '미' },
  { code: 'KeyR', hint: 'R', semitone: 17, black: false, label: '파' },
  { code: 'Digit5', hint: '5', semitone: 18, black: true, label: '파♯' },
  { code: 'KeyT', hint: 'T', semitone: 19, black: false, label: '솔' },
  { code: 'Digit6', hint: '6', semitone: 20, black: true, label: '솔♯' },
  { code: 'KeyY', hint: 'Y', semitone: 21, black: false, label: '라' },
  { code: 'Digit7', hint: '7', semitone: 22, black: true, label: '라♯' },
  { code: 'KeyU', hint: 'U', semitone: 23, black: false, label: '시' },
  { code: 'KeyI', hint: 'I', semitone: 24, black: false, label: '도' },
];

const KEY_BY_CODE = new Map([...LOW_ROW, ...HIGH_ROW].map((key) => [key.code, key]));

/** 같은 줄 안에서 해당 음이 흰건반 몇 칸째에 놓이는지 — 검은건반 위치의 근거. */
function whiteOffsetInRow(row: readonly TestKeyType[], semitone: number): number {
  return row.filter((key) => !key.black && key.semitone < semitone).length;
}

/** 고스트 테스터용 — KeyboardEvent.code 를 사람이 읽는 짧은 라벨로. */
function keyLabel(event: KeyboardEvent): string {
  const { code } = event;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const named: Record<string, string> = {
    Space: 'Space',
    Semicolon: ';',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Quote: "'",
  };
  return named[code] ?? (event.key.length === 1 ? event.key.toUpperCase() : code);
}

/**
 * 소리만 귀로 확인하는 임시 페이지. 마우스로 건반을 누르거나 실제 자판을 눌러 본다.
 * 방 화면과 무관한 독립 라우트라, 배포에 섞여도 부담이 없다.
 */
export default function PianoTestPage() {
  const synthRef = useRef<PianoSynth | null>(null);
  const [octave, setOctave] = useState(4);
  const [sounding, setSounding] = useState<Set<number>>(new Set());
  const [held, setHeld] = useState<Map<string, string>>(new Map());
  const [maxHeld, setMaxHeld] = useState(0);

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
      const key = KEY_BY_CODE.get(event.code);
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
      const key = KEY_BY_CODE.get(event.code);
      if (key) release(key.semitone);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [press, release, refresh]);

  // 고스트 테스터: 피아노 매핑과 무관하게 "지금 이 키보드가 동시에 인식하는 키"를 추적한다.
  // 특정 조합에서 키가 씹히거나 최대 동시 인식 수가 낮으면 그게 이 키보드의 물리 한계다.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      setHeld((prev) => {
        if (prev.has(event.code)) return prev;
        const next = new Map(prev).set(event.code, keyLabel(event));
        setMaxHeld((max) => Math.max(max, next.size));
        return next;
      });
    };
    const up = (event: KeyboardEvent) => {
      setHeld((prev) => {
        if (!prev.has(event.code)) return prev;
        const next = new Map(prev);
        next.delete(event.code);
        return next;
      });
    };
    const clear = () => setHeld(new Map());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const renderRow = (row: readonly TestKeyType[]) => {
    const whiteCount = row.filter((key) => !key.black).length;
    return (
      <div style={{ position: 'relative', width: whiteCount * WHITE_WIDTH, height: 190 }}>
        {row
          .filter((key) => !key.black)
          .map((key) => (
            <PianoKeyButton
              key={key.code}
              pianoKey={key}
              left={whiteOffsetInRow(row, key.semitone) * WHITE_WIDTH}
              active={sounding.has(key.semitone)}
              onPress={press}
              onRelease={release}
            />
          ))}
        {row
          .filter((key) => key.black)
          .map((key) => (
            <PianoKeyButton
              key={key.code}
              pianoKey={key}
              left={whiteOffsetInRow(row, key.semitone) * WHITE_WIDTH - BLACK_WIDTH / 2}
              active={sounding.has(key.semitone)}
              onPress={press}
              onRelease={release}
            />
          ))}
      </div>
    );
  };

  return (
    <main style={{ maxWidth: 760, margin: '48px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>피아노 소리 확인 · 양손 2옥타브</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 6 }}>
        위 건반(윗줄 자판) = 오른손 · 높은 옥타브, 아래 건반(아랫줄 자판) = 왼손 · 낮은 옥타브.
        스페이스바는 서스테인 페달입니다.
      </p>
      <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 20 }}>
        도레미파솔라시 도레미파솔라시 도 — 두 손을 아래·윗줄로 갈라 짚으면 잘 안 꼬입니다.
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
        <span style={{ fontSize: 12, color: '#9ca3af' }}>({MIN_OCTAVE}~{MAX_OCTAVE}) — 2옥타브 뭉치 전체가 함께 이동합니다.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={rowLabelStyle}>오른손 · 높은 옥타브 (윗줄 Q~I, 검은건반 2·3·5·6·7)</div>
          {renderRow(HIGH_ROW)}
        </div>
        <div>
          <div style={rowLabelStyle}>왼손 · 낮은 옥타브 (아랫줄 Z~M, 검은건반 S·D·G·H·J)</div>
          {renderRow(LOW_ROW)}
        </div>
      </div>

      <section style={ghostPanelStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>고스트 테스터</strong>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            여러 키를 한꺼번에 눌러 보세요. 이 키보드가 동시에 인식하는 키 수가 곧 물리 한계입니다.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#374151' }}>
            지금 동시 인식 <strong style={{ fontSize: 18 }}>{held.size}</strong>키
          </span>
          <span style={{ fontSize: 13, color: '#374151' }}>
            최대 기록 <strong style={{ fontSize: 18, color: '#4338ca' }}>{maxHeld}</strong>키
          </span>
          <button type="button" onClick={() => setMaxHeld(0)} style={octaveButtonStyle} aria-label="최대 기록 초기화">
            ↺
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, minHeight: 30 }}>
          {[...held.values()].map((label, index) => (
            <span key={`${label}-${index}`} style={chipStyle}>
              {label}
            </span>
          ))}
          {held.size === 0 && <span style={{ fontSize: 12, color: '#9ca3af' }}>눌린 키 없음</span>}
        </div>
      </section>
    </main>
  );
}

type PianoKeyButtonProps = {
  pianoKey: TestKeyType;
  left: number;
  active: boolean;
  onPress: (semitone: number) => void;
  onRelease: (semitone: number) => void;
};

function PianoKeyButton({ pianoKey, left, active, onPress, onRelease }: PianoKeyButtonProps) {
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
        height: 124,
        background: active ? '#4b5563' : '#1f2937',
        color: '#e5e7eb',
        border: '1px solid #111827',
        zIndex: 2,
      }
    : {
        ...base,
        width: WHITE_WIDTH,
        height: 190,
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

const rowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  marginBottom: 6,
};

const ghostPanelStyle: React.CSSProperties = {
  marginTop: 32,
  padding: 16,
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#f9fafb',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 28,
  height: 28,
  padding: '0 8px',
  borderRadius: 6,
  background: '#4338ca',
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 600,
};
