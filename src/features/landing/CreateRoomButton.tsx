'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { createRoom } from '@/api/roomsClient';
import { roomTitleSchema } from '@/domain/roomSchema';
import { buildOwnerKey } from '@/lib/id';
import { buildRoomPath } from '@/lib/url';
import { hashOwnerKey, writeOwnerKey } from '@/store/ownerKey';
import styles from './landing.module.css';

const TITLE_MAX_LENGTH = 40;

export function CreateRoomButton() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = title.trim();
      const parsedTitle = roomTitleSchema.safeParse(trimmed);
      const ownerKey = buildOwnerKey();
      const response = await createRoom({
        ownerKeyHash: await hashOwnerKey(ownerKey),
        ...(parsedTitle.success ? { title: parsedTitle.data } : {}),
      });
      writeOwnerKey(response.meta.id, ownerKey);
      router.push(buildRoomPath(response.meta.id));
    } catch {
      setError('방을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <form className={styles.actions} onSubmit={(event) => void handleSubmit(event)}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>방 이름</span>
        <input
          className={styles.input}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="이름 없는 방"
          maxLength={TITLE_MAX_LENGTH}
          disabled={busy}
          autoComplete="off"
          enterKeyHint="go"
        />
      </label>
      <button type="submit" className={`btn btn-primary ${styles.create}`} disabled={busy}>
        {busy ? '방을 만드는 중…' : '내 방 만들기'}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
