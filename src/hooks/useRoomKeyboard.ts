'use client';

import { useEffect, useRef } from 'react';

export type UseRoomKeyboardParams = {
  enabled: boolean;
  onMoveInput: (forward: number, right: number) => void;
  onJump: () => void;
  onToggleSit: () => void;
  onRotate: (direction: number) => void;
  onRemove: () => void;
  onDeselect: () => void;
};

/**
 * 물리 키 위치(KeyboardEvent.code)로 맞춘다. 자판 배열·한글 IME 와 무관하므로
 * 한글이 켜져 있어도 걷고, 자모 낱자를 따로 받을 필요가 없다.
 */
const MOVE_KEY_MAP: Record<string, 'w' | 'a' | 's' | 'd'> = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
  ArrowUp: 'w', ArrowLeft: 'a', ArrowDown: 's', ArrowRight: 'd',
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export function useRoomKeyboard(params: UseRoomKeyboardParams): void {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!params.enabled) return undefined;
    const held = new Set<'w' | 'a' | 's' | 'd'>();

    const emit = (): void => {
      const forward = (held.has('w') ? 1 : 0) - (held.has('s') ? 1 : 0);
      const right = (held.has('d') ? 1 : 0) - (held.has('a') ? 1 : 0);
      paramsRef.current.onMoveInput(forward, right);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      const code = event.code;
      if (code === 'Escape') {
        paramsRef.current.onDeselect();
        return;
      }
      const move = MOVE_KEY_MAP[code];
      if (move) {
        held.add(move);
        emit();
        event.preventDefault();
        return;
      }
      if (code === 'Space') {
        paramsRef.current.onJump();
        event.preventDefault();
        return;
      }
      if (code === 'KeyZ') {
        paramsRef.current.onToggleSit();
        return;
      }
      if (code === 'KeyR') {
        paramsRef.current.onRotate(event.shiftKey ? -1 : 1);
        return;
      }
      if (code === 'Delete' || code === 'Backspace') {
        paramsRef.current.onRemove();
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      const move = MOVE_KEY_MAP[event.code];
      if (!move) return;
      held.delete(move);
      emit();
    };

    const handleBlur = (): void => {
      held.clear();
      emit();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      handleBlur();
    };
  }, [params.enabled]);
}
