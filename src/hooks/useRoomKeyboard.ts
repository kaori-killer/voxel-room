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

/** 한글 자판이 켜져 있어도 걷도록 같은 자리의 낱자를 함께 받는다. */
const MOVE_KEY_MAP: Record<string, 'w' | 'a' | 's' | 'd'> = {
  w: 'w', a: 'a', s: 's', d: 'd',
  arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd',
  ㅈ: 'w', ㅁ: 'a', ㄴ: 's', ㅇ: 'd',
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
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        paramsRef.current.onDeselect();
        return;
      }
      const move = MOVE_KEY_MAP[key];
      if (move) {
        held.add(move);
        emit();
        event.preventDefault();
        return;
      }
      if (key === ' ') {
        paramsRef.current.onJump();
        event.preventDefault();
        return;
      }
      if (key === 'z' || key === 'ㅋ') {
        paramsRef.current.onToggleSit();
        return;
      }
      if (key === 'r' || key === 'ㄱ') {
        paramsRef.current.onRotate(event.shiftKey ? -1 : 1);
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        paramsRef.current.onRemove();
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      const move = MOVE_KEY_MAP[event.key.toLowerCase()];
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
