// Capa de datos 100% local sobre IndexedDB
const NAME = 'GestionHogarDB';
const VERSION = 2;
export const STORES = ['transactions', 'goals', 'obligations', 'obligationPayments',
  'products', 'stores', 'lists', 'listItems', 'priceHistory', 'tasks', 'templates'];

let db;

export function init() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = e => {
      const d = e.target.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
  });
}

function run(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const all = s => run(s, 'readonly', st => st.getAll());
export const get = (s, id) => run(s, 'readonly', st => st.get(id));
export const put = (s, obj) => run(s, 'readwrite', st => st.put(obj));
export const add = (s, obj) => run(s, 'readwrite', st => st.add(obj));
export const del = (s, id) => run(s, 'readwrite', st => st.delete(id));
export const clear = s => run(s, 'readwrite', st => st.clear());

export async function where(store, pred) {
  return (await all(store)).filter(pred);
}

// ---- Ajustes (clave/valor) ----
const DEFAULTS = {
  baseCurrency: 'CRC', exchangeRate: 515, foodBudget: 0, theme: 'auto', seeded: false,
  uiScale: 100, contrast: false, easyMode: false, sizeAsked: false, firstSeen: null, interest: null, interestSnooze: 0, deviceId: null
};
let cache = { ...DEFAULTS };

export async function loadSettings() {
  for (const r of await all('settings')) cache[r.key] = r.value;
  return cache;
}
export const settings = () => cache;
export async function setSetting(key, value) {
  cache[key] = value;
  await put('settings', { key, value });
}

// ---- Respaldo ----
export async function exportAll() {
  const data = { app: 'GestionHogar', version: VERSION, exportedAt: new Date().toISOString() };
  for (const s of STORES) data[s] = await all(s);
  data.settings = await all('settings');
  return data;
}

export async function importAll(data) {
  if (!data || data.app !== 'GestionHogar') throw new Error('Archivo de respaldo no válido');
  for (const s of STORES) {
    await clear(s);
    for (const row of data[s] || []) await put(s, row);
  }
  await clear('settings');
  for (const row of data.settings || []) await put('settings', row);
  cache = { ...DEFAULTS };
  await loadSettings();
}

export async function resetAll() {
  for (const s of STORES) await clear(s);
  await clear('settings');
  cache = { ...DEFAULTS };
}
