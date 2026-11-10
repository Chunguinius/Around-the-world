// Drafts: tours being edited are kept in this browser (IndexedDB) until they are published.
const DB = 'around-the-world', STORE = 'tours';
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE)); t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error); });
}
export const saveDraft = tour => tx('readwrite', s => s.put(tour));
export const getDraft = id => tx('readonly', s => s.get(id));
export const listDrafts = () => tx('readonly', s => s.getAll());
export const deleteDraft = id => tx('readwrite', s => s.delete(id));
