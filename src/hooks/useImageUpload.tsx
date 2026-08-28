'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { checkImageFile, loadImageFromFile } from '@/lib/image';

export type UseImageUploadParams = {
  enabled: boolean;
  onReject: (message: string) => void;
};

export type ImageUploadType = {
  image: HTMLImageElement | null;
  fileName: string;
  openPicker: () => void;
  clear: () => void;
  accept: (file: File | null | undefined) => Promise<void>;
  input: React.ReactElement;
};

/** 버튼·드롭·붙여넣기 세 입구를 한 곳에서 검사하고 같은 결과를 낸다. */
export function useImageUpload({ enabled, onReject }: UseImageUploadParams): ImageUploadType {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState('');

  const accept = useCallback(
    async (file: File | null | undefined) => {
      if (!enabled) return;
      const checked = checkImageFile(file);
      if (!checked.ok) {
        onReject(checked.message);
        return;
      }
      try {
        setImage(await loadImageFromFile(checked.file));
        setFileName(checked.file.name);
      } catch {
        onReject('이미지를 읽지 못했습니다');
      }
    },
    [enabled, onReject],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const handleDrop = (event: DragEvent): void => {
      event.preventDefault();
      void accept(event.dataTransfer?.files?.[0]);
    };
    const handleDragOver = (event: DragEvent): void => event.preventDefault();
    const handlePaste = (event: ClipboardEvent): void => {
      const item = [...(event.clipboardData?.items ?? [])].find((entry) => entry.type.startsWith('image/'));
      if (item) void accept(item.getAsFile());
    };
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('paste', handlePaste);
    };
  }, [accept, enabled]);

  const openPicker = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  }, []);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      hidden
      aria-hidden="true"
      tabIndex={-1}
      data-testid="image-input"
      onChange={(event) => void accept(event.target.files?.[0])}
    />
  );

  return {
    image,
    fileName,
    openPicker,
    clear: () => setImage(null),
    accept,
    input,
  };
}
