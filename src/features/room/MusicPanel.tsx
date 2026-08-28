'use client';

import { useEffect, useRef } from 'react';
import type { MusicPlayer, PlayerSnapshotType } from '@/audio/musicPlayer';
import { deleteTrack, uploadTrack } from '@/api/roomsClient';
import { MAX_TRACK_BYTES } from '@/domain/constants';
import type { InventoryItemType, TrackItemType } from '@/domain/types';
import { formatDuration } from '@/lib/format';
import { buildLocalId } from '@/lib/id';
import { hashOwnerKey } from '@/store/ownerKey';
import styles from './music.module.css';

export type MusicPanelProps = {
  item: InventoryItemType;
  player: PlayerSnapshotType;
  musicPlayer: MusicPlayer;
  roomId: string;
  shared: boolean;
  ownerKey: string | null;
  onSetTracks: (tracks: TrackItemType[]) => void;
  onToast: (message: string) => void;
  onClose: () => void;
};

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav|flac|webm)$/i;
const MAX_TRACK_MB = Math.floor(MAX_TRACK_BYTES / (1024 * 1024));

/** 재생목록을 손보고, 배경에서 계속 흐르도록 곡을 재생한다. */
export function MusicPanel({
  item,
  player,
  musicPlayer,
  roomId,
  shared,
  ownerKey,
  onSetTracks,
  onToast,
  onClose,
}: MusicPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const tracks = item.tracks ?? [];
  const isThis = player.itemId === item.id;
  // 공유 방이고 내가 주인이면 서버에도 올려, 링크를 받은 사람도 들을 수 있다.
  const canShareTracks = shared && Boolean(ownerKey);

  useEffect(() => {
    musicPlayer.onMissingTrack = (track) => {
      onToast(`‘${track.name}’ 음악을 불러오지 못했습니다.`);
    };
    return () => {
      musicPlayer.onMissingTrack = null;
    };
  }, [musicPlayer, onToast]);

  const handleFiles = async (fileList: FileList | null): Promise<void> => {
    if (!fileList) return;
    const audioFiles = Array.from(fileList).filter(
      (file) => /^audio\//.test(file.type) || AUDIO_EXT.test(file.name),
    );
    if (!audioFiles.length) {
      onToast('오디오 파일만 넣을 수 있습니다.');
      return;
    }
    const files = audioFiles.filter((file) => file.size <= MAX_TRACK_BYTES);
    if (files.length < audioFiles.length) {
      onToast(`${MAX_TRACK_MB}MB 이하 파일만 올릴 수 있어요.`);
    }
    if (!files.length) return;

    const store = musicPlayer.getStore();
    const records = files.map((file) => ({
      track: { id: buildLocalId(), name: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 70) },
      file,
    }));
    // 넣자마자 재생되도록 로컬에 먼저 담는다.
    const localResults = await Promise.all(records.map(({ track, file }) => store.put(track.id, file)));
    onSetTracks([...tracks, ...records.map((record) => record.track)]);

    let shareFailed = false;
    if (canShareTracks && ownerKey) {
      const hash = await hashOwnerKey(ownerKey);
      const uploads = await Promise.all(
        records.map(({ track, file }) =>
          uploadTrack(roomId, track.id, hash, file).then(
            () => true,
            () => false,
          ),
        ),
      );
      shareFailed = uploads.some((ok) => !ok);
    }

    if (localResults.some((ok) => !ok)) {
      onToast('이 브라우저에는 저장할 수 없어, 새로고침하면 목록에서 사라질 수 있어요.');
    } else if (shareFailed) {
      onToast('담았지만 공유 저장에 실패한 곡이 있어요. 다른 사람은 못 들을 수 있어요.');
    } else {
      onToast(canShareTracks ? `${records.length}곡을 담아 공유했어요.` : `${records.length}곡을 담았습니다.`);
    }
  };

  const handleRemove = (index: number): void => {
    const track = tracks[index];
    if (!track) return;
    void musicPlayer.getStore().remove(track.id);
    if (canShareTracks && ownerKey) {
      void hashOwnerKey(ownerKey)
        .then((hash) => deleteTrack(roomId, track.id, hash))
        .catch(() => undefined);
    }
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
          <p className={styles.note}>
            {canShareTracks
              ? '음악은 방과 함께 저장돼, 링크를 받은 사람도 들을 수 있어요.'
              : '음악 파일은 이 브라우저에만 저장됩니다.'}
          </p>
        </div>
      </section>
    </div>
  );
}
