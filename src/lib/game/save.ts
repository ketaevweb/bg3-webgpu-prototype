/** Слот сохранения в IndexedDB с фоллбеком на localStorage. */

const DB_NAME = 'bg3-crpg';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      if (typeof indexedDB === 'undefined') return res(null);
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => {
        rq.result.createObjectStore(STORE);
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}

export async function idbSet<T>(key: string, val: T): Promise<void> {
  const db = await openDb();
  if (db) {
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } else {
    try {
      localStorage.setItem(`${DB_NAME}:${key}`, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (db) {
    const v = await new Promise<T | null>((res) => {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => res((rq.result as T | undefined) ?? null);
      rq.onerror = () => res(null);
    });
    db.close();
    return v;
  }
  try {
    const s = localStorage.getItem(`${DB_NAME}:${key}`);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}
