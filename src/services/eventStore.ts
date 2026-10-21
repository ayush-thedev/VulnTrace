// IndexedDB event store + BroadcastChannel for multi-tab sync

export interface StoredEvent {
  offset?: number; // autoIncrement key
  scanId: string;
  seq: number;
  type: string;
  payload: unknown;
  ts: number;
}

const DB_NAME = 'vulntrace-events';
const STORE_NAME = 'events';
const DB_VERSION = 1;

export function openEventDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'offset', autoIncrement: true });
        store.createIndex('scanId_seq', ['scanId', 'seq'], { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function appendEvent(db: IDBDatabase, event: Omit<StoredEvent, 'offset'>): Promise<number> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(event);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => {
      // ConstraintError = duplicate [scanId, seq] — silently ignore
      if (tx.error?.name === 'ConstraintError' || req.error?.name === 'ConstraintError') {
        tx.abort();
      }
      resolve(-1);
    };
    tx.onerror = () => resolve(-1);
  });
}

export function loadAllEvents(db: IDBDatabase): Promise<StoredEvent[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as StoredEvent[]);
    req.onerror = () => reject(req.error);
  });
}

export function loadEventsFrom(db: IDBDatabase, fromOffset: number): Promise<StoredEvent[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const range = IDBKeyRange.lowerBound(fromOffset);
    const results: StoredEvent[] = [];
    const req = store.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as StoredEvent);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export function getLastEventForScan(db: IDBDatabase, scanId: string): Promise<StoredEvent | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('scanId_seq');
    // Open cursor on the index in reverse to get last event for this scanId
    const range = IDBKeyRange.bound([scanId, 0], [scanId, 0xFFFFFFFF]);
    const req = index.openCursor(range, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      resolve(cursor ? (cursor.value as StoredEvent) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

// BroadcastChannel
export interface EventChannelMessage {
  type: 'NEW_OFFSET';
  offset: number;
}

export function createEventChannel(): BroadcastChannel {
  return new BroadcastChannel('vulntrace-events');
}

export function announceOffset(channel: BroadcastChannel, offset: number): void {
  const msg: EventChannelMessage = { type: 'NEW_OFFSET', offset };
  channel.postMessage(msg);
}
