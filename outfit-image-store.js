(() => {
  "use strict";

  const DB_NAME = "luxia-outfit-media-v1";
  const STORE_NAME = "images";
  const MAX_FILE_BYTES = 1024 * 1024 * 1024;
  const activeObjectUrls = new Set();

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("当前浏览器不支持大图片存储，请升级 Safari 或 Chrome 后重试。"));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error || new Error("无法打开图片存储空间"));
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  function runTransaction(mode, operation) {
    return openDatabase().then((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      transaction.oncomplete = () => {
        database.close();
        resolve(result);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("图片存储失败"));
      };
      transaction.onabort = transaction.onerror;
      try { result = operation(store); }
      catch (error) {
        transaction.abort();
        reject(error);
      }
    }));
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("图片读取失败"));
    });
  }

  function assertImage(file) {
    if (!file) throw new Error("请选择一张图片");
    if (!String(file.type || "").startsWith("image/")) throw new Error("请选择图片格式的文件");
    if (file.size > MAX_FILE_BYTES) throw new Error("单张图片不能超过 1GB");
  }

  async function assertLocalCapacity(file) {
    if (!navigator.storage?.estimate) return;
    const estimate = await navigator.storage.estimate();
    const remaining = Math.max(0, Number(estimate.quota || 0) - Number(estimate.usage || 0));
    if (estimate.quota && file.size > remaining * 0.92) {
      const availableMb = Math.max(0, Math.floor(remaining / 1024 / 1024));
      throw new Error(`设备可用网页存储空间不足（约剩 ${availableMb}MB），请释放空间或选择较小图片。`);
    }
  }

  function localId(tripId, date) {
    const nonce = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${String(tripId || "trip")}:${String(date || "date")}:${nonce}`;
  }

  async function save(file, context = {}) {
    assertImage(file);
    await assertLocalCapacity(file);
    const id = localId(context.tripId, context.date);
    await runTransaction("readwrite", (store) => store.put({
      id,
      blob: file,
      name: file.name || "outfit-image",
      type: file.type || "application/octet-stream",
      size: file.size,
      updatedAt: new Date().toISOString()
    }));
    return { kind: "indexeddb", id, name: file.name || "outfit-image", type: file.type || "", size: file.size };
  }

  async function resolve(reference) {
    if (!reference || reference.kind !== "indexeddb" || !reference.id) return "";
    const record = await runTransaction("readonly", (store) => requestResult(store.get(reference.id)));
    if (!record?.blob) return "";
    const url = URL.createObjectURL(record.blob);
    activeObjectUrls.add(url);
    return url;
  }

  async function remove(reference) {
    if (reference?.kind === "indexeddb" && reference.id) {
      await runTransaction("readwrite", (store) => store.delete(reference.id));
    }
  }

  function releaseObjectUrls() {
    activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    activeObjectUrls.clear();
  }

  if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);

  window.OutfitImageStore = Object.freeze({ MAX_FILE_BYTES, save, resolve, remove, releaseObjectUrls });
})();
