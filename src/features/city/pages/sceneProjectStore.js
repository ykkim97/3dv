import { validateSceneProject } from './projectModel.js';

// Separate from single-city recovery: page IDs and cross-page links are saved together.
export function createSceneProjectStore(indexedDB = globalThis.indexedDB) {
  let connection;
  const open = () => connection ||= new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('자동 저장소를 사용할 수 없습니다. 프로젝트 파일로 저장하세요.')); return; }
    const request = indexedDB.open('lumatrix-scene-pages-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onerror = () => { connection = null; reject(request.error); };
    request.onblocked = () => { connection = null; reject(new Error('다른 창의 프로젝트 저장소를 닫아 주세요.')); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connection = null; }; resolve(db); };
  });
  const run = async (mode, value) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', mode), store = tx.objectStore('projects');
      const request = mode === 'readonly' ? store.get('latest') : store.put(value, 'latest');
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error('프로젝트 저장 실패'));
      tx.onerror = () => {};
    });
  };
  return { load: () => run('readonly'), save: async project => run('readwrite', validateSceneProject(project)) };
}
