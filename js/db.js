// Tours created in the editor are stored locally in the browser (IndexedDB).
const DB = 'orbit360', STORE = 'tours';
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE)); t.oncomplete = () => res(out.result ?? out); t.onerror = () => rej(t.error); });
}
export const saveTour = tour => tx('readwrite', s => s.put(tour));
export const getLocalTour = id => tx('readonly', s => s.get(id));
export const listLocalTours = () => tx('readonly', s => s.getAll());
export const deleteLocalTour = id => tx('readwrite', s => s.delete(id));
// turn stored blobs into object URLs the viewer can load
export function hydrate(tour) {
  return { ...tour, local: true, cover: tour.scenes[0] ? URL.createObjectURL(tour.scenes[0].thumb || tour.scenes[0].blob) : '',
    scenes: tour.scenes.map(s => ({ ...s, src: URL.createObjectURL(s.blob), thumbUrl: URL.createObjectURL(s.thumb || s.blob) })) };
}
