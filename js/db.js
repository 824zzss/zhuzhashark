/* 猪猪鲨手 - 本地持久化层
 * 优先 IndexedDB；在 file:// 或 IndexedDB 不可用时自动降级到 localStorage。
 * 对外暴露统一 Promise 接口：put / bulkPut / get / getAll / del / clear / uid
 */
(function (global) {
  'use strict';

  const STORES = ['tasks', 'notes', 'settings', 'health', 'words', 'review', 'money', 'clients', 'ideas', 'podcasts', 'english', 'english_mistakes'];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- localStorage 兜底引擎 (file:// / 无 IndexedDB 时使用) ---------- */
  const LS = {
    _key(store) { return 'zzsk:' + store; },
    _read(store) {
      try { return JSON.parse(localStorage.getItem(this._key(store)) || '[]'); }
      catch (e) { return []; }
    },
    _write(store, arr) {
      try { localStorage.setItem(this._key(store), JSON.stringify(arr)); }
      catch (e) {
        console.warn('localStorage 写入失败(可能超限):', store, e);
        if (global.toast) global.toast('⚠️ 本地存储将满，部分数据可能未保存');
      }
    },
    put(store, value) {
      const arr = this._read(store);
      const i = arr.findIndex(x => x && x.id === value.id);
      if (i >= 0) arr[i] = value; else arr.push(value);
      this._write(store, arr);
      return Promise.resolve(value);
    },
    bulkPut(store, values) {
      const arr = this._read(store);
      const map = new Map(arr.map(x => [x.id, x]));
      (values || []).forEach(v => { if (v && v.id) map.set(v.id, v); });
      this._write(store, Array.from(map.values()));
      return Promise.resolve();
    },
    get(store, id) {
      const arr = this._read(store);
      return Promise.resolve(arr.find(x => x && x.id === id) || undefined);
    },
    getAll(store) { return Promise.resolve(this._read(store)); },
    del(store, id) {
      const arr = this._read(store).filter(x => !(x && x.id === id));
      this._write(store, arr);
      return Promise.resolve();
    },
    clear(store) { this._write(store, []); return Promise.resolve(); },
  };
  LS.uid = uid;

  /* ---------- IndexedDB 引擎 ---------- */
  const DB_NAME = 'zhuzhashark_db';
  const DB_VERSION = 5;
  let _dbPromise = null;
  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }
  function tx(store, mode) {
    return openDB().then((db) => db.transaction(store, mode).objectStore(store));
  }
  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  const IDB = {
    put(store, value) {
      return tx(store, 'readwrite').then((s) => reqToPromise(s.put(value))).then(() => value);
    },
    bulkPut(store, values) {
      return tx(store, 'readwrite').then((s) => Promise.all((values || []).map((v) => reqToPromise(s.put(v)))));
    },
    get(store, id) {
      return tx(store, 'readonly').then((s) => reqToPromise(s.get(id)));
    },
    getAll(store) {
      return tx(store, 'readonly').then((s) => reqToPromise(s.getAll()));
    },
    del(store, id) {
      return tx(store, 'readwrite').then((s) => reqToPromise(s.delete(id)));
    },
    clear(store) {
      return tx(store, 'readwrite').then((s) => reqToPromise(s.clear()));
    },
  };
  IDB.uid = uid;

  /* ---------- 引擎选择 ---------- */
  function preferIDB() {
    try {
      if (typeof indexedDB === 'undefined') return false;
      const p = location.protocol;
      if (p === 'file:') return false;            // file:// 下 IndexedDB 不可靠，降级到 localStorage
      if (p !== 'http:' && p !== 'https:') return false;
      return true;
    } catch (e) { return false; }
  }

  const engine = preferIDB() ? IDB : LS;
  global.DB = engine;
  global.DB_ENGINE = preferIDB() ? 'idb' : 'ls';
  global.DB_STORES = STORES;
})(window);
