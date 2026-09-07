/**
 * Persistência leve: localStorage síncrono + IndexedDB via DataManager.
 * Recebe a instância de DataManager por injeção (sem closure global).
 */

/**
 * @param {import('../storage/DataManager.js').DataManager} dataManager
 * @param {string} key
 * @param {*} value
 */
export function persist(dataManager, key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* quota */ }
  dataManager.saveKey(key, value).catch(() => {});
}

/**
 * Factory que fixa o DataManager e devolve `persist(key, value)`.
 * @param {import('../storage/DataManager.js').DataManager} dataManager
 * @returns {(key: string, value: *) => void}
 */
export function createPersist(dataManager) {
  return (key, value) => persist(dataManager, key, value);
}
