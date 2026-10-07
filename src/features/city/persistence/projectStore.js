import { validateCity } from '../core/cityValidation.js';

const DATABASE = 'lumatrix-city-projects-v1';
export const MAX_PROJECTS = 10, MAX_SNAPSHOTS = 3;

export function projectRecord(city, projectId, previous, now = Date.now()) {
  validateCity(city);
  const snapshots = [{ id: crypto.randomUUID(), savedAt: now, city }, ...(previous?.snapshots || [])].slice(0, MAX_SNAPSHOTS);
  return { id: projectId, name: city.name, updatedAt: now, snapshots };
}

// A single IndexedDB transaction atomically replaces a project's snapshots.
// Failure leaves the last successful recovery copy intact.
export function createProjectStore(indexedDB = globalThis.indexedDB) {
  let opened;
  const open = () => {
    if (!indexedDB) return Promise.reject(new Error('이 환경에서는 자동 저장소를 사용할 수 없습니다. 도시 파일로 내보내세요.'));
    opened ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opened = null; }; resolve(db); };
      request.onerror = () => { opened = null; reject(request.error); };
      request.onblocked = () => { opened = null; reject(new Error('다른 창에서 저장소를 사용 중입니다. 다른 창을 닫고 다시 시도하세요.')); };
    });
    return opened;
  };
  const transaction = async (mode, operation) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', mode), store = tx.objectStore('projects');
      let result, failure;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('자동 저장을 완료하지 못했습니다.'));
      tx.onerror = () => { /* onabort reports the final transaction failure. */ };
      try { operation(store, value => { result = value; }, error => { failure = error; tx.abort(); }); }
      catch (error) { failure = error; tx.abort(); }
    });
  };
  return {
    async list() {
      return transaction('readonly', (store, done) => { const request = store.getAll(); request.onsuccess = () => done(request.result.sort((a, b) => b.updatedAt - a.updatedAt)); });
    },
    async save(city, id) {
      return transaction('readwrite', (store, done, fail) => {
        const request = store.get(id);
        request.onsuccess = () => {
          try {
            const record = projectRecord(city, id, request.result);
            store.put(record);
            // Read index keys only: no cloning every other city's terrain on each save.
            const cursor = store.index('updatedAt').openKeyCursor(null, 'prev');
            let others = 0;
            cursor.onsuccess = () => {
              const entry = cursor.result;
              if (!entry) { done(record); return; }
              if (entry.primaryKey !== id && ++others >= MAX_PROJECTS) store.delete(entry.primaryKey);
              entry.continue();
            };
          } catch (error) { fail(error); }
        };
      });
    },
    async remove(id) { return transaction('readwrite', (store, done) => { store.delete(id); done(); }); },
  };
}
