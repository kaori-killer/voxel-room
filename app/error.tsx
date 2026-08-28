'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { captureError } from '@/lib/monitoring';
import styles from '@/features/landing/landing.module.css';

export type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>일시적인 문제가 있어요</h1>
        <p className={styles.lead}>잠시 뒤 다시 시도해 주세요. 계속되면 처음으로 돌아가 주세요.</p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            다시 시도
          </button>
          <Link className="btn btn-ghost" href="/">
            처음으로
          </Link>
        </div>
      </div>
    </main>
  );
}
