'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CarveStudio } from '@/features/studio/CarveStudio';
import { CreateRoomButton } from '@/features/landing/CreateRoomButton';
import { InventoryRail } from '@/features/inventory/InventoryRail';
import { ObjectBar } from '@/features/room/ObjectBar';
import { RoomSettingsPanel } from '@/features/room/RoomSettingsPanel';
import { TraitControls } from '@/features/room/TraitControls';
import { InteractBubble } from '@/features/room/InteractBubble';
import { PianoPanel } from '@/features/room/PianoPanel';
import { MusicPanel } from '@/features/room/MusicPanel';
import { NowPlaying } from '@/features/room/NowPlaying';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { Toast } from '@/features/shared/Toast';
import { useRoomController } from '@/hooks/useRoomController';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useRoomKeyboard } from '@/hooks/useRoomKeyboard';
import { checkImageFile, fileToPhotoDataUrl } from '@/lib/image';
import { saveRoom } from '@/api/roomsClient';
import type { LampStateType, RoomMetaType, RoomType, TraitKeyType } from '@/domain/types';
import { hashOwnerKey, readOwnerKey } from '@/store/ownerKey';
import { logger } from '@/lib/logger';
import styles from './room.module.css';

export type RoomViewProps = {
  meta: RoomMetaType;
  initialRoom: RoomType;
  shared: boolean;
};

type OpenPanelType = { kind: 'piano'; itemId: string; name: string } | { kind: 'music'; itemId: string } | null;

export function RoomView({ meta, initialRoom, shared }: RoomViewProps) {
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [ownerResolved, setOwnerResolved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<OpenPanelType>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lampState, setLampState] = useState<LampStateType | null>(null);
  const [touch, setTouch] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOwnerKey(readOwnerKey(meta.id));
    setOwnerResolved(true);
  }, [meta.id]);

  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);

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
    roomId: meta.id,
    shared,
    initialRoom,
    canEdit,
    onPersist: (room, thumbnail) => void handlePersist(room, thumbnail),
  });

  const upload = useImageUpload({
    enabled: canEdit,
    onReject: setToast,
  });

  const { interactHint, interactItem, getLampState, handleSetLamp, musicPlayer, player, selection } = controller;
  const selectionKey = selection?.key ?? null;

  // 선택이 바뀌면 그 개체의 전등 상태를 다시 읽어 온다.
  useEffect(() => {
    setLampState(selectionKey ? getLampState(selectionKey) : null);
  }, [selectionKey, getLampState]);

  const applyLamp = useCallback(
    (patch: Partial<LampStateType>) => {
      if (!selectionKey) return;
      handleSetLamp(selectionKey, patch);
      setLampState((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [selectionKey, handleSetLamp],
  );

  const doInteract = useCallback(() => {
    if (!interactHint || !interactItem) return;
    const traits = interactItem.traits;
    if (traits.piano) {
      setOpenPanel({ kind: 'piano', itemId: interactItem.id, name: interactItem.name });
      return;
    }
    if (traits.music) {
      void musicPlayer.toggle(interactItem.id, interactItem.tracks);
      return;
    }
    if (traits.lamp) {
      const current = getLampState(interactHint.key);
      handleSetLamp(interactHint.key, { on: !(current?.on ?? true) });
    }
  }, [interactHint, interactItem, musicPlayer, getLampState, handleSetLamp]);

  useRoomKeyboard({
    enabled: canEdit && !upload.image && openPanel === null,
    onMoveInput: controller.handleMoveInput,
    onJump: controller.handleJump,
    onToggleSit: controller.handleToggleSit,
    onRotate: controller.handleRotateSelected,
    onRemove: controller.handleRemoveSelected,
    onDeselect: () => controller.handleSelect(null),
    onInteract: doInteract,
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
      const itemId = selection?.itemId;
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
    [controller, selection],
  );

  const handleToggleTrait = useCallback(
    (trait: TraitKeyType, on: boolean) => {
      if (selection) controller.handleToggleTrait(selection.itemId, trait, on);
    },
    [controller, selection],
  );

  // 말풍선은 편집 UI 위로 겹치지 않도록, 패널·스튜디오·설정이 열리면 감춘다.
  const bubbleLabel =
    interactHint && interactItem
      ? labelFor(interactItem.traits, interactItem.id, interactHint.key, player, getLampState)
      : null;
  const showBubble =
    Boolean(interactHint && bubbleLabel) && openPanel === null && !upload.image && !settingsOpen;

  const panelItem = openPanel ? controller.items.find((item) => item.id === openPanel.itemId) ?? null : null;
  const playingItem = player.itemId ? controller.items.find((item) => item.id === player.itemId) ?? null : null;
  const playingTrack = playingItem?.tracks.find((track) => track.id === player.trackId) ?? null;

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
          onOpenChange={setSettingsOpen}
        />
      </div>

      <div className={`${styles.layer} ${styles.dock}`}>
        {canEdit && selection && controller.selectedItem ? (
          <TraitControls
            item={controller.selectedItem}
            lamp={lampState}
            onToggleTrait={handleToggleTrait}
            onOpenMusic={() => setOpenPanel({ kind: 'music', itemId: selection.itemId })}
            onSetLamp={applyLamp}
          />
        ) : null}
        {selection && controller.selectedItem ? (
          <ObjectBar
            name={controller.selectedItem.name}
            height={selection.height}
            hasPhoto={Boolean(controller.selectedItem.photo)}
            onRotate={controller.handleRotateSelected}
            onResize={controller.handleResizeSelected}
            onAddPhoto={handlePickPhoto}
            onRemovePhoto={() => controller.handleSetPhoto(selection.itemId, null)}
            onDuplicate={controller.handleDuplicateSelected}
            onRemove={controller.handleRemoveSelected}
            onDone={() => controller.handleSelect(null)}
          />
        ) : null}
      </div>

      {showBubble && interactHint && bubbleLabel ? (
        <InteractBubble
          label={bubbleLabel}
          x={interactHint.screenX}
          y={interactHint.screenY}
          showKeyHint={!touch}
          onInteract={doInteract}
        />
      ) : null}

      {playingItem && playingTrack && openPanel?.kind !== 'music' ? (
        <NowPlaying
          trackName={playingTrack.name}
          fromName={playingItem.name}
          playing={player.playing}
          onToggle={() => void musicPlayer.toggle(playingItem.id, playingItem.tracks)}
        />
      ) : null}

      {ownerResolved && shared && !canEdit ? (
        <div className={`${styles.layer} ${styles.visitor}`}>
          <p className={styles.visitorNote}>다른 사람의 방을 구경하고 있어요.</p>
          <p className={styles.visitorCta}>내 사진으로 나만의 방도 만들어 보세요.</p>
          <CreateRoomButton />
        </div>
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

      {openPanel?.kind === 'piano' ? (
        <PianoPanel title={openPanel.name} touch={touch} onClose={() => setOpenPanel(null)} />
      ) : null}

      {openPanel?.kind === 'music' && panelItem ? (
        <MusicPanel
          item={panelItem}
          player={player}
          musicPlayer={musicPlayer}
          roomId={meta.id}
          shared={shared}
          ownerKey={ownerKey}
          onSetTracks={(tracks) => controller.handleSetTracks(panelItem.id, tracks)}
          onToast={setToast}
          onClose={() => setOpenPanel(null)}
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

function labelFor(
  traits: { piano?: boolean; music?: boolean; lamp?: boolean },
  itemId: string,
  hintKey: string,
  player: { playing: boolean; itemId: string | null },
  getLampState: (key: string) => LampStateType | null,
): string | null {
  if (traits.piano) return '연주하기';
  if (traits.music) return player.playing && player.itemId === itemId ? '음악 끄기' : '음악 켜기';
  if (traits.lamp) return getLampState(hintKey)?.on ? '불 끄기' : '불 켜기';
  return null;
}
