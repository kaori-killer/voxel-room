'use client';

import { useEffect, useRef } from 'react';
import type { MusicPlayer, PlayerSnapshotType } from '@/audio/musicPlayer';
import type { InventoryItemType, TrackItemType } from '@/domain/types';
import { formatDuration } from '@/lib/format';
import { buildLocalId } from '@/lib/id';
import styles from './music.module.css';

export type MusicPanelProps = {
  item: InventoryItemType;
  player: PlayerSnapshotType;
  musicPlayer: MusicPlayer;
  onSetTracks: (tracks: TrackItemType[]) => void;
  onToast: (message: string) => void;
  onClose: () => void;
};

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav|flac|webm)$/i;

/** 재생목록을 손보고, 배경에서 계속 흐르도록 곡을 재생한다. */
export function MusicPanel({ item, player, musicPlayer, onSetTracks, onToast, onClose }: MusicPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const tracks = item.tracks ?? [];
  const isThis = player.itemId === item.id;

  useEffect(() => {
    musicPlayer.onMissingTrack = (track) => {
      onToast(`‘${track.name}’ 파일이 이 브라우저에 없습니다. 다시 넣어 주세요.`);
    };
    return () => {
      musicPlayer.onMissingTrack = null;
    };
  }, [musicPlayer, onToast]);

  const handleFiles = async (fileList: FileList | null): Promise<void> => {
    if (!fileList) return;
    const files = Array.from(fileList).filter(
      (file) => /^audio\//.test(file.type) || AUDIO_EXT.test(file.name),
    );
    if (!files.length) {
      onToast('오디오 파일만 넣을 수 있습니다.');
      return;
    }
    const store = musicPlayer.getStore();
    const records = files.map((file) => ({
      track: { id: buildLocalId(), name: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 70) },
      file,
    }));
    const results = await Promise.all(records.map(({ track, file }) => store.put(track.id, file)));
    onSetTracks([...tracks, ...records.map((record) => record.track)]);
    onToast(
      results.some((ok) => !ok)
        ? '이 브라우저에는 저장할 수 없어, 새로고침하면 목록에서 사라집니다.'
        : `${records.length}곡을 담았습니다.`,
    );
  };

  const handleRemove = (index: number): void => {
    const track = tracks[index];
    if (!track) return;
    void musicPlayer.getStore().remove(track.id);
    if (isThis && player.trackId === track.id) musicPlayer.stop();
    onSetTracks(tracks.filter((_, position) => position !== index));
  };

  const handleRowPlay = (index: number): void => {
    const track = tracks[index];
    if (!track) return;
    if (isThis && player.trackId === track.id) {
      void musicPlayer.toggle(item.id, tracks);
    } else {
      void musicPlayer.play(item.id, tracks, index);
    }
  };

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.scrim} aria-label="닫기" onClick={onClose} />
      <section className={styles.panel} aria-label={`${item.name} 재생목록`}>
        <div className={styles.head}>
          <h2>{item.name}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className={styles.list}>
          {tracks.length === 0 ? (
            <p className={styles.empty}>아직 담긴 음악이 없습니다. 아래에서 음악 파일을 넣어 보세요.</p>
          ) : (
            tracks.map((track, index) => {
              const on = isThis && player.trackId === track.id;
              return (
                <div key={track.id} className={`${styles.row} ${on ? styles.rowOn : ''}`}>
                  <button type="button" className={styles.rowPlay} onClick={() => handleRowPlay(index)}>
                    <span className={styles.rowIndex}>{on && player.playing ? '▶' : index + 1}</span>
                    <span className={styles.rowName}>{track.name}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.rowRemove}
                    onClick={() => handleRemove(index)}
                    aria-label={`${track.name} 빼기`}
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.transport}>
          <div className={styles.controls}>
            <button type="button" onClick={() => void musicPlayer.step(-1)} disabled={!isThis} aria-label="이전 곡">
              ⏮
            </button>
            <button
              type="button"
              className={styles.play}
              onClick={() => void musicPlayer.toggle(item.id, tracks)}
              disabled={tracks.length === 0}
              aria-label={player.playing ? '일시정지' : '재생'}
            >
              {isThis && player.playing ? '⏸' : '▶'}
            </button>
            <button type="button" onClick={() => void musicPlayer.step(1)} disabled={!isThis} aria-label="다음 곡">
              ⏭
            </button>
            <button
              type="button"
              className={styles.repeat}
              aria-pressed={player.repeatOne}
              onClick={() => musicPlayer.setRepeatOne(!player.repeatOne)}
              aria-label="한 곡 반복"
            >
              🔂
            </button>
          </div>
          <div className={styles.seekRow}>
            <input
              type="range"
              min={0}
              max={player.duration || 0}
              step={0.1}
              value={isThis ? player.currentTime : 0}
              disabled={!isThis || !player.duration}
              onChange={(event) => musicPlayer.seek(Number(event.target.value))}
              aria-label="재생 위치"
            />
            <span className={styles.time}>
              {formatDuration(isThis ? player.currentTime : 0)} / {formatDuration(isThis ? player.duration : 0)}
            </span>
          </div>
          <label className={styles.volume}>
            <span>소리</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.volume}
              onChange={(event) => musicPlayer.setVolume(Number(event.target.value))}
              aria-label="소리 크기"
            />
          </label>
        </div>

        <div className={styles.foot}>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <button type="button" className="btn btn-primary btn-block" onClick={() => fileRef.current?.click()}>
            음악 파일 넣기
          </button>
          <p className={styles.note}>음악 파일은 이 브라우저에만 저장되고, 방 링크로 공유되지 않습니다.</p>
        </div>
      </section>
    </div>
  );
}
