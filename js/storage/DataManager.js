/**
 * DataManager — armazenamento chave-valor no IndexedDB,
 * espelhando 1:1 as chaves que vivem no localStorage do app.
 * Fallback automático para localStorage se IndexedDB falhar.
 */

const DEFAULT_KEYS = [
  'obr_custom_tiles',
  'obr_custom_arena',
  'obr_custom_arena_objects',
  'obr_custom_objects',
  'obr_robot_library',
  'obr_custom_mode'
];

export class DataManager {
  constructor(dbName = 'OBRTrainerDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.storeName = 'kv';
    this.ready = false;
    this.useIdb = true;
  }

  async init() {
    if (this.ready) return;
    try {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, this.version);
        req.onerror = () => reject(new Error('Falha ao abrir IndexedDB'));
        req.onsuccess = () => {
          this.db = req.result;
          resolve();
        };
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'key' });
          }
        };
      });
      this.useIdb = true;
      this.ready = true;
      await this._migrateFromLocalStorage();
    } catch (err) {
      console.warn('[DataManager] IndexedDB indisponível, usando localStorage:', err);
      this.useIdb = false;
      this.ready = true;
    }
  }

  /** Copia chaves do localStorage → IndexedDB se a store estiver vazia nessas chaves */
  async _migrateFromLocalStorage() {
    if (!this.useIdb || !this.db) return;
    for (const key of DEFAULT_KEYS) {
      try {
        const existing = await this._idbGet(key);
        if (existing !== undefined && existing !== null) continue;
        const raw = localStorage.getItem(key);
        if (raw == null) continue;
        let value;
        try { value = JSON.parse(raw); } catch { value = raw; }
        await this._idbPut(key, value);
      } catch (e) { /* ignore per-key */ }
    }
  }

  _idbPut(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const req = tx.objectStore(this.storeName).put({
        key,
        value,
        savedAt: new Date().toISOString()
      });
      req.onerror = () => reject(new Error(`Falha ao salvar ${key}`));
      req.onsuccess = () => resolve(value);
    });
  }

  _idbGet(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const req = tx.objectStore(this.storeName).get(key);
      req.onerror = () => reject(new Error(`Falha ao carregar ${key}`));
      req.onsuccess = () => {
        if (!req.result) resolve(null);
        else resolve(req.result.value);
      };
    });
  }

  async saveKey(key, value) {
    if (!this.ready) await this.init();
    // Espelho no localStorage (compatibilidade / fallback)
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* quota */ }
    if (this.useIdb && this.db) {
      try {
        return await this._idbPut(key, value);
      } catch (e) {
        console.warn('[DataManager] saveKey IDB falhou:', e);
      }
    }
    return value;
  }

  async loadKey(key, fallback = null) {
    if (!this.ready) await this.init();
    if (this.useIdb && this.db) {
      try {
        const v = await this._idbGet(key);
        if (v !== null && v !== undefined) return v;
      } catch (e) {
        console.warn('[DataManager] loadKey IDB falhou:', e);
      }
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch { return raw; }
    } catch (e) {
      return fallback;
    }
  }

  async deleteKey(key) {
    if (!this.ready) await this.init();
    try { localStorage.removeItem(key); } catch (e) {}
    if (this.useIdb && this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        const req = tx.objectStore(this.storeName).delete(key);
        req.onerror = () => reject(new Error(`Falha ao deletar ${key}`));
        req.onsuccess = () => resolve();
      });
    }
  }

  async listKeys() {
    if (!this.ready) await this.init();
    if (this.useIdb && this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.storeName], 'readonly');
        const req = tx.objectStore(this.storeName).getAllKeys();
        req.onerror = () => reject(new Error('Falha ao listar chaves'));
        req.onsuccess = () => resolve(req.result);
      });
    }
    return DEFAULT_KEYS.filter(k => localStorage.getItem(k) != null);
  }

  async exportCompleteBackup() {
    if (!this.ready) await this.init();
    const data = {};
    for (const k of DEFAULT_KEYS) {
      data[k] = await this.loadKey(k, null);
    }
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appVersion: 'v1.2-robot',
      data
    };
  }

  async downloadJSON(filename = 'obr-backup.json') {
    const backup = await this.exportCompleteBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return backup;
  }

  async importFromJSON(jsonData) {
    if (typeof jsonData === 'string') jsonData = JSON.parse(jsonData);
    if (!jsonData || !jsonData.data) throw new Error('Formato JSON inválido (falta data)');
    let imported = 0;
    for (const [key, value] of Object.entries(jsonData.data)) {
      if (value !== null && value !== undefined) {
        await this.saveKey(key, value);
        imported++;
      }
    }
    return { success: true, imported };
  }

  async uploadJSON() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        try {
          const file = e.target.files[0];
          if (!file) return reject(new Error('Nenhum arquivo'));
          resolve(await this.importFromJSON(await file.text()));
        } catch (err) {
          reject(err);
        }
      };
      input.click();
    });
  }

  async clearAll() {
    if (!this.ready) await this.init();
    for (const k of DEFAULT_KEYS) {
      try { localStorage.removeItem(k); } catch (e) {}
    }
    if (this.useIdb && this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        tx.objectStore(this.storeName).clear();
        tx.onerror = () => reject(new Error('Falha ao limpar'));
        tx.oncomplete = () => resolve();
      });
    }
  }
}

export default DataManager;
