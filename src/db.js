const DB_NAME = "meter-watch";
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("captures")) db.createObjectStore("captures", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction("captures", mode).objectStore("captures"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const addCapture = (capture) => transaction("readwrite", (store) => store.add(capture));
export const listCaptures = () => transaction("readonly", (store) => store.getAll());
export const updateCapture = (capture) => transaction("readwrite", (store) => store.put(capture));
export const removeCapture = (id) => transaction("readwrite", (store) => store.delete(id));
export const clearCaptures = () => transaction("readwrite", (store) => store.clear());
