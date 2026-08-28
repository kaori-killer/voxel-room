'use client';

import { useEffect, useRef } from 'react';
import styles from './shared.module.css';

export type ConfirmDialogProps = {
  open: boolean;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 브라우저 confirm 은 임베드 환경에서 막히므로 직접 그린다. */
export function ConfirmDialog({ open, message, confirmLabel = '확인', onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;
  return (
    <div className={styles.veil}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-label={message}>
        <p>{message}</p>
        <div className={styles.dialogRow}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn btn-primary" ref={confirmRef} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
