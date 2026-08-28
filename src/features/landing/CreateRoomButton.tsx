'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createRoom } from '@/api/roomsClient';
import { buildOwnerKey } from '@/lib/id';
import { buildRoomPath } from '@/lib/url';
import { hashOwnerKey, writeOwnerKey } from '@/store/ownerKey';
import styles from './landing.module.css';

export function CreateRoomButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const ownerKey = buildOwnerKey();
      const response = await createRoom({ ownerKeyHash: await hashOwnerKey(ownerKey) });
      writeOwnerKey(response.meta.id, ownerKey);
      router.push(buildRoomPath(response.meta.id));
    } catch {
      setError('방을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.actions}>
      <button type="button" className="btn btn-primary" onClick={handleCreateRoom} disabled={busy}>
        {busy ? '방을 만드는 중…' : '내 방 만들기'}
      </button>
      <p className={styles.note}>주소가 방 하나에 하나씩 생깁니다. 링크를 보내면 서로의 방을 볼 수 있어요.</p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
