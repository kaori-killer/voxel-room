import { logger } from '@/lib/logger';

const DB_NAME = 'voxel-room';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

type TrackRecordType = {
  id: string;
  blob: Blob;
};

/**
 * 음악 파일은 방 데이터에 담기에 너무 크다. 브라우저에만 남기고
 * 방 JSON 에는 곡 이름과 id 만 저장한다.
 */
export class TrackStore {
  private database: Promise<IDBDatabase | null> | null = null;
  private readonly memory = new Map<string, Blob>();

  private open(): Promise<IDBDatabase | null> {
    if (this.database) return this.database;
    this.database = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') {
          resolve(null);
          return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.database;
  }

  /** 넣자마자 재생할 수 있도록 메모리에 먼저 올린다. */
  async put(id: string, blob: Blob): Promise<boolean> {
    this.memory.set(id, blob);
    const database = await this.open();
    if (!database) return false;
    return new Promise((resolve) => {
      try {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ id, blob } satisfies TrackRecordType);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (error) {
        logger.warn('음악 저장 실패', error);
        resolve(false);
      }
    });
  }

  async get(id: string): Promise<Blob | null> {
    const cached = this.memory.get(id);
    if (cached) return cached;
    const database = await this.open();
    if (!database) return null;
    return new Promise((resolve) => {
      try {
        const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
        request.onsuccess = () => {
          const record = request.result as TrackRecordType | undefined;
          if (record?.blob) this.memory.set(id, record.blob);
          resolve(record?.blob ?? null);
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async remove(id: string): Promise<void> {
    this.memory.delete(id);
    const database = await this.open();
    if (!database) return;
    try {
      database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
    } catch (error) {
      logger.warn('음악 삭제 실패', error);
    }
  }
}
