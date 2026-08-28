'use client';

import { useEffect } from 'react';
import styles from './shared.module.css';

export type ToastProps = {
  message: string | null;
  onDismiss: () => void;
};

const VISIBLE_MS = 3400;

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onDismiss, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <output className={styles.toast} data-open={message ? 'true' : 'false'} aria-live="polite">
      {message}
    </output>
  );
}
