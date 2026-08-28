export type PianoKeyType = {
  code: string;
  semitone: number;
  black: boolean;
  label: string;
};

/** 도부터 다음 옥타브 미까지 — 한 손으로 닿는 범위만 낸다. */
export const PIANO_KEYS: readonly PianoKeyType[] = [
  { code: 'a', semitone: 0, black: false, label: '도' },
  { code: 'w', semitone: 1, black: true, label: '도♯' },
  { code: 's', semitone: 2, black: false, label: '레' },
  { code: 'e', semitone: 3, black: true, label: '레♯' },
  { code: 'd', semitone: 4, black: false, label: '미' },
  { code: 'f', semitone: 5, black: false, label: '파' },
  { code: 't', semitone: 6, black: true, label: '파♯' },
  { code: 'g', semitone: 7, black: false, label: '솔' },
  { code: 'y', semitone: 8, black: true, label: '솔♯' },
  { code: 'h', semitone: 9, black: false, label: '라' },
  { code: 'u', semitone: 10, black: true, label: '라♯' },
  { code: 'j', semitone: 11, black: false, label: '시' },
  { code: 'k', semitone: 12, black: false, label: '도' },
  { code: 'o', semitone: 13, black: true, label: '도♯' },
  { code: 'l', semitone: 14, black: false, label: '레' },
  { code: 'p', semitone: 15, black: true, label: '레♯' },
  { code: ';', semitone: 16, black: false, label: '미' },
];

export const PIANO_KEY_BY_CODE = new Map(PIANO_KEYS.map((key) => [key.code, key]));
export const WHITE_KEYS = PIANO_KEYS.filter((key) => !key.black);
export const BLACK_KEYS = PIANO_KEYS.filter((key) => key.black);

export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 6;
export const DEFAULT_OCTAVE = 4;

export function noteFrequency(semitone: number, octave: number): number {
  const midi = 12 * (octave + 1) + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 검은건반이 흰건반 몇 번째 경계에 놓이는지. 레이아웃 계산의 유일한 근거. */
export function whiteKeyOffsetFor(semitone: number): number {
  return WHITE_KEYS.filter((key) => key.semitone < semitone).length;
}

type VoiceType = {
  gain: GainNode;
  nodes: OscillatorNode[];
};

type PianoOptionsType = {
  createContext?: () => AudioContext | null;
};

/**
 * 2-오퍼레이터 FM. 샘플 없이 전자피아노에 가까운 소리를 낸다.
 * AudioContext 를 만들 수 없는 환경에서는 조용히 무시한다.
 */
export class PianoSynth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly voices = new Map<number, VoiceType>();
  private readonly createContext: () => AudioContext | null;
  private sustaining = false;
  private readonly heldSemitones = new Set<number>();

  octave = DEFAULT_OCTAVE;

  constructor(options: PianoOptionsType = {}) {
    this.createContext =
      options.createContext ??
      (() => {
        const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        return Ctor ? new Ctor() : null;
      });
  }

  resume(): void {
    const context = this.ensureContext();
    if (context?.state === 'suspended') void context.resume();
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const context = this.createContext();
    if (!context) return null;
    this.context = context;
    const master = context.createGain();
    master.gain.value = 0.26;
    const compressor = context.createDynamicsCompressor();
    master.connect(compressor);
    compressor.connect(context.destination);
    this.master = master;
    return context;
  }

  isHeld(semitone: number): boolean {
    return this.heldSemitones.has(semitone);
  }

  getSoundingSemitones(): number[] {
    return [...this.voices.keys()];
  }

  press(semitone: number): void {
    if (this.heldSemitones.has(semitone)) return;
    this.heldSemitones.add(semitone);
    this.start(semitone);
  }

  release(semitone: number): void {
    this.heldSemitones.delete(semitone);
    if (this.sustaining) return;
    this.stop(semitone, false);
  }

  setSustain(value: boolean): void {
    this.sustaining = value;
    if (value) return;
    for (const semitone of [...this.voices.keys()]) {
      if (!this.heldSemitones.has(semitone)) this.stop(semitone, false);
    }
  }

  releaseAll(): void {
    this.sustaining = false;
    this.heldSemitones.clear();
    for (const semitone of [...this.voices.keys()]) this.stop(semitone, true);
  }

  setOctave(next: number): void {
    this.releaseAll();
    this.octave = Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, next));
  }

  dispose(): void {
    this.releaseAll();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  private start(semitone: number): void {
    const context = this.ensureContext();
    const master = this.master;
    if (!context || !master || this.voices.has(semitone)) return;
    if (context.state === 'suspended') void context.resume();

    const now = context.currentTime;
    const frequency = noteFrequency(semitone, this.octave);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 3.4);

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(Math.min(11000, frequency * 11), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(420, frequency * 3), now + 1.1);

    const carrier = context.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = frequency;

    const modulator = context.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = frequency * 3;
    const modulatorGain = context.createGain();
    modulatorGain.gain.setValueAtTime(frequency * 2.4, now);
    modulatorGain.gain.exponentialRampToValueAtTime(frequency * 0.04, now + 0.55);
    modulator.connect(modulatorGain);
    modulatorGain.connect(carrier.frequency);

    const body = context.createOscillator();
    body.type = 'triangle';
    body.frequency.value = frequency;
    body.detune.value = 7;
    const bodyGain = context.createGain();
    bodyGain.gain.value = 0.3;
    body.connect(bodyGain);
    bodyGain.connect(filter);

    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    carrier.start(now);
    modulator.start(now);
    body.start(now);

    this.voices.set(semitone, { gain, nodes: [carrier, modulator, body] });
  }

  private stop(semitone: number, immediate: boolean): void {
    const voice = this.voices.get(semitone);
    const context = this.context;
    if (!voice || !context) return;
    this.voices.delete(semitone);
    const now = context.currentTime;
    const release = immediate ? 0.04 : 0.36;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
    } catch {
      voice.gain.disconnect();
    }
    for (const node of voice.nodes) {
      try {
        node.stop(now + release + 0.06);
      } catch {
        node.disconnect();
      }
    }
  }
}
