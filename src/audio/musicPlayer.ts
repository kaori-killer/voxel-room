import type { TrackItemType } from '@/domain/types';
import { TrackStore } from './trackStore';

export type PlayerSnapshotType = {
  itemId: string | null;
  trackId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeatOne: boolean;
};

export type MissingTrackHandlerType = (track: TrackItemType) => void;

const INITIAL_VOLUME = 0.7;

/** 오브제를 골라 두지 않아도 배경에서 계속 흐르도록 오디오 하나를 공유한다. */
export class MusicPlayer {
  private readonly audio: HTMLAudioElement;
  private readonly store = new TrackStore();
  private readonly listeners = new Set<(snapshot: PlayerSnapshotType) => void>();
  private objectUrl: string | null = null;
  private itemId: string | null = null;
  private tracks: TrackItemType[] = [];
  private index = -1;
  private repeatOne = false;

  onMissingTrack: MissingTrackHandlerType | null = null;

  constructor(audio: HTMLAudioElement = new Audio()) {
    this.audio = audio;
    this.audio.preload = 'metadata';
    this.audio.volume = INITIAL_VOLUME;
    const emit = () => this.emit();
    this.audio.addEventListener('play', emit);
    this.audio.addEventListener('pause', emit);
    this.audio.addEventListener('timeupdate', emit);
    this.audio.addEventListener('loadedmetadata', emit);
    this.audio.addEventListener('ended', () => {
      if (this.repeatOne) {
        this.audio.currentTime = 0;
        void this.audio.play().catch(() => undefined);
        return;
      }
      void this.step(1);
    });
  }

  subscribe(listener: (snapshot: PlayerSnapshotType) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): PlayerSnapshotType {
    return {
      itemId: this.itemId,
      trackId: this.tracks[this.index]?.id ?? null,
      playing: !this.audio.paused && Boolean(this.audio.src),
      currentTime: this.audio.currentTime,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
      volume: this.audio.volume,
      repeatOne: this.repeatOne,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  getStore(): TrackStore {
    return this.store;
  }

  async play(itemId: string, tracks: TrackItemType[], index: number): Promise<void> {
    const track = tracks[index];
    if (!track) return;
    const blob = await this.store.get(track.id);
    if (!blob) {
      this.onMissingTrack?.(track);
      return;
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(blob);
    this.itemId = itemId;
    this.tracks = tracks;
    this.index = index;
    this.audio.src = this.objectUrl;
    await this.audio.play().catch(() => undefined);
    this.emit();
  }

  async toggle(itemId: string, tracks: TrackItemType[]): Promise<void> {
    if (!tracks.length) return;
    if (this.itemId === itemId && this.audio.src) {
      if (this.audio.paused) await this.audio.play().catch(() => undefined);
      else this.audio.pause();
      this.emit();
      return;
    }
    await this.play(itemId, tracks, 0);
  }

  async step(direction: number): Promise<void> {
    if (!this.itemId || !this.tracks.length) return;
    const next = (this.index + direction + this.tracks.length) % this.tracks.length;
    await this.play(this.itemId, this.tracks, next);
  }

  seek(seconds: number): void {
    if (Number.isFinite(this.audio.duration)) this.audio.currentTime = seconds;
  }

  setVolume(value: number): void {
    this.audio.volume = Math.min(1, Math.max(0, value));
    this.emit();
  }

  setRepeatOne(value: boolean): void {
    this.repeatOne = value;
    this.emit();
  }

  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    try {
      this.audio.load();
    } catch {
      // 일부 브라우저는 src 를 지운 뒤 load 에서 던진다. 상태만 맞추면 된다.
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.itemId = null;
    this.tracks = [];
    this.index = -1;
    this.emit();
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
  }
}
