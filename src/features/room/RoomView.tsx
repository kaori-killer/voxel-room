'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CarveStudio } from '@/features/studio/CarveStudio';
import { InventoryRail } from '@/features/inventory/InventoryRail';
import { ObjectBar } from '@/features/room/ObjectBar';
import { RoomSettingsPanel } from '@/features/room/RoomSettingsPanel';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { Toast } from '@/features/shared/Toast';
import { useRoomController } from '@/hooks/useRoomController';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useRoomKeyboard } from '@/hooks/useRoomKeyboard';
import { checkImageFile, fileToPhotoDataUrl } from '@/lib/image';
import { saveRoom } from '@/api/roomsClient';
import type { RoomMetaType, RoomType } from '@/domain/types';
import { hashOwnerKey, readOwnerKey } from '@/store/ownerKey';
import { logger } from '@/lib/logger';
import styles from './room.module.css';

export type RoomViewProps = {
  meta: RoomMetaType;
  initialRoom: RoomType;
  shared: boolean;
};

export function RoomView({ meta, initialRoom, shared }: RoomViewProps) {
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [ownerResolved, setOwnerResolved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const railRef = useRef<HTMLElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOwnerKey(readOwnerKey(meta.id));
    setOwnerResolved(true);
  }, [meta.id]);

  const canEdit = !shared || Boolean(ownerKey);

  const handlePersist = useCallback(
    async (room: RoomType, thumbnail: string | null) => {
      if (!shared || !ownerKey) return;
      try {
        await saveRoom(meta.id, {
          room,
          thumbnail,
          ownerKeyHash: await hashOwnerKey(ownerKey),
        });
      } catch (error) {
        logger.warn('방 저장 실패', error);
        setToast('방을 저장하지 못했습니다. 연결을 확인해 주세요.');
      }
    },
    [meta.id, ownerKey, shared],
  );

  const controller = useRoomController({
    initialRoom,
    canEdit,
    onPersist: (room, thumbnail) => void handlePersist(room, thumbnail),
  });

  const upload = useImageUpload({
    enabled: canEdit,
    onReject: setToast,
  });

  useRoomKeyboard({
    enabled: canEdit && !upload.image,
    onMoveInput: controller.handleMoveInput,
    onJump: controller.handleJump,
    onToggleSit: controller.handleToggleSit,
    onRotate: controller.handleRotateSelected,
    onRemove: controller.handleRemoveSelected,
    onDeselect: () => controller.handleSelect(null),
  });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const observer = new ResizeObserver(() => {
      controller.setBottomInset(rail.getBoundingClientRect().height + 18);
    });
    observer.observe(rail);
    return () => observer.disconnect();
  }, [controller]);

  const handleConfirmDelete = useCallback(() => {
    if (pendingDelete) controller.handleDeleteItem(pendingDelete);
    setPendingDelete(null);
  }, [controller, pendingDelete]);

  const handlePickPhoto = useCallback(() => {
    const input = photoInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  }, []);

  const handlePhotoFile = useCallback(
    async (file: File | null | undefined) => {
      const itemId = controller.selection?.itemId;
      if (!itemId) return;
      const checked = checkImageFile(file);
      if (!checked.ok) {
        setToast(checked.message);
        return;
      }
      try {
        controller.handleSetPhoto(itemId, await fileToPhotoDataUrl(checked.file));
      } catch {
        setToast('사진을 넣지 못했습니다. 다른 이미지를 골라 주세요.');
      }
    },
    [controller],
  );

  return (
    <main>
      <h1 className="visually-hidden">{meta.title}</h1>
      <canvas ref={controller.canvasRef} className={styles.stage} aria-label="방 미리보기" />

      {!controller.ready ? <p className={styles.loading}>방을 여는 중…</p> : null}

      <aside className={`${styles.layer} ${styles.rail}`} ref={railRef} aria-label="보관함">
        <header className={styles.brand}>
          <span className={styles.cube} aria-hidden="true" />
          <p className={styles.brandTitle}>
            복셀 공방<small>my voxel room</small>
          </p>
        </header>

        {canEdit ? (
          <button type="button" className="btn btn-primary btn-block" onClick={upload.openPicker}>
            사진으로 오브제 만들기
          </button>
        ) : null}

        <div className={styles.railHead}>
          <span className="field-label">보관함</span>
          <span className={styles.railCount}>{controller.items.length ? `${controller.items.length}개` : ''}</span>
        </div>

        <InventoryRail
          items={controller.items}
          thumbnails={controller.thumbnails}
          canEdit={canEdit}
          onTakeOut={controller.handleTakeOut}
          onDelete={setPendingDelete}
        />
      </aside>

      <div className={`${styles.layer} ${styles.panelWrap}`}>
        <RoomSettingsPanel
          settings={controller.settings}
          canEdit={canEdit}
          roomId={meta.id}
          shared={shared}
          onChange={controller.handleChangeSettings}
          onResetView={controller.handleResetView}
          onCopied={() => setToast('방 링크를 복사했습니다.')}
          onCopyFailed={(url) => setToast(`복사가 막혀 있습니다. 주소: ${url}`)}
        />
      </div>

      <div className={`${styles.layer} ${styles.dock}`}>
        {controller.selection && controller.selectedItem ? (
          <ObjectBar
            name={controller.selectedItem.name}
            height={controller.selection.height}
            hasPhoto={Boolean(controller.selectedItem.photo)}
            onRotate={controller.handleRotateSelected}
            onResize={controller.handleResizeSelected}
            onAddPhoto={handlePickPhoto}
            onRemovePhoto={() => controller.handleSetPhoto(controller.selection!.itemId, null)}
            onDuplicate={controller.handleDuplicateSelected}
            onRemove={controller.handleRemoveSelected}
            onDone={() => controller.handleSelect(null)}
          />
        ) : null}
      </div>

      {ownerResolved && shared && !canEdit ? (
        <p className={`${styles.layer} ${styles.readOnly}`}>
          다른 사람의 방을 보고 있습니다. 구경만 할 수 있어요.
        </p>
      ) : null}

      {controller.activeCharacterKey ? (
        <p className={`${styles.layer} ${styles.charBadge}`}>
          <span className={styles.charDot} aria-hidden="true" />
          조작 중 · <b>캐릭터</b>
        </p>
      ) : null}

      <p className={`${styles.layer} ${styles.hints}`}>
        오브제를 <b>끌어</b> 옮기고, 빈 바닥을 <b>끌어</b> 시점을 돌립니다.
        <br />
        <b>휠</b>로 확대·축소 · <kbd>R</kbd> 회전 · <kbd>Del</kbd> 치우기
      </p>

      {upload.input}

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => void handlePhotoFile(event.target.files?.[0])}
      />

      {upload.image ? (
        <CarveStudio
          image={upload.image}
          fileName={upload.fileName}
          itemCount={controller.items.length}
          onCancel={upload.clear}
          onCreate={(item, data) => {
            controller.handleAddItem(item, data);
            upload.clear();
            controller.handleTakeOut(item.id);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        message="이 오브제를 보관함에서 지웁니다. 방에 놓인 것도 함께 사라집니다."
        confirmLabel="지우기"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
