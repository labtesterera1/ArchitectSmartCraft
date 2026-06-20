/**
 * storage.js
 * ----------------------------------------------------------------
 * Shared IndexedDB wrapper for ArchitectSmartCraft.
 *
 * Every module (CreateDiagram, AnalyzeDiagram, future modules)
 * talks ONLY to the functions exported here — never to indexedDB
 * directly. That keeps modules independent: if storage tech ever
 * changes, only this file needs to change.
 *
 * Object stores:
 *   diagrams  -> diagrams created in the CreateDiagram module
 *   analyses  -> uploaded images + explanations from AnalyzeDiagram
 *   settings  -> key/value app settings (theme, API prefs, etc.)
 *
 * Works fully offline. Tested target browsers: Edge (desktop),
 * Chrome (Android).
 * ----------------------------------------------------------------
 */

const DB_NAME = "ArchitectSmartCraftDB";
const DB_VERSION = 1;

const STORES = {
  diagrams: "diagrams",
  analyses: "analyses",
  settings: "settings",
};

let _dbPromise = null;

/**
 * Opens (or creates/upgrades) the database.
 * Cached as a singleton promise so every call reuses one connection.
 */
function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.diagrams)) {
        const diagramStore = db.createObjectStore(STORES.diagrams, {
          keyPath: "id",
        });
        diagramStore.createIndex("by_updatedAt", "updatedAt", { unique: false });
        diagramStore.createIndex("by_name", "name", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.analyses)) {
        const analysisStore = db.createObjectStore(STORES.analyses, {
          keyPath: "id",
        });
        analysisStore.createIndex("by_createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
    request.onblocked = () =>
      reject(new Error("Database upgrade blocked — close other open tabs of this app."));
  });

  return _dbPromise;
}

/** Generic promise wrapper around an IDBRequest */
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Generates a reasonably unique id without external deps */
function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ----------------------------------------------------------------
// DIAGRAMS  (used by CreateDiagram module)
// ----------------------------------------------------------------

/**
 * Saves a diagram. If diagram.id is missing, a new one is created.
 * @param {Object} diagram - { id?, name, nodes, connectors, meta }
 * @returns {Promise<Object>} the saved diagram (with id + timestamps)
 */
async function saveDiagram(diagram) {
  const db = await openDB();
  const now = new Date().toISOString();

  const record = {
    ...diagram,
    id: diagram.id || generateId("diagram"),
    createdAt: diagram.createdAt || now,
    updatedAt: now,
  };

  const tx = db.transaction(STORES.diagrams, "readwrite");
  tx.objectStore(STORES.diagrams).put(record);
  await promisifyRequest(tx.objectStore(STORES.diagrams).put(record));

  return record;
}

/** Retrieves a single diagram by id */
async function getDiagram(id) {
  const db = await openDB();
  const tx = db.transaction(STORES.diagrams, "readonly");
  return promisifyRequest(tx.objectStore(STORES.diagrams).get(id));
}

/** Lists all diagrams, most recently updated first */
async function listDiagrams() {
  const db = await openDB();
  const tx = db.transaction(STORES.diagrams, "readonly");
  const all = await promisifyRequest(tx.objectStore(STORES.diagrams).getAll());
  return all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/** Deletes a diagram by id */
async function deleteDiagram(id) {
  const db = await openDB();
  const tx = db.transaction(STORES.diagrams, "readwrite");
  tx.objectStore(STORES.diagrams).delete(id);
  return promisifyRequest(tx.objectStore(STORES.diagrams).delete(id));
}

// ----------------------------------------------------------------
// ANALYSES  (used by AnalyzeDiagram module)
// ----------------------------------------------------------------

/**
 * Saves an uploaded-image analysis record.
 * @param {Object} analysis - { id?, imageBlob, imageName, explanation, steps, meta }
 * @returns {Promise<Object>} the saved analysis record
 */
async function saveAnalysis(analysis) {
  const db = await openDB();
  const now = new Date().toISOString();

  const record = {
    ...analysis,
    id: analysis.id || generateId("analysis"),
    createdAt: analysis.createdAt || now,
    updatedAt: now,
  };

  const tx = db.transaction(STORES.analyses, "readwrite");
  tx.objectStore(STORES.analyses).put(record);
  await promisifyRequest(tx.objectStore(STORES.analyses).put(record));

  return record;
}

/** Retrieves a single analysis by id */
async function getAnalysis(id) {
  const db = await openDB();
  const tx = db.transaction(STORES.analyses, "readonly");
  return promisifyRequest(tx.objectStore(STORES.analyses).get(id));
}

/** Lists all analyses, most recent first */
async function listAnalyses() {
  const db = await openDB();
  const tx = db.transaction(STORES.analyses, "readonly");
  const all = await promisifyRequest(tx.objectStore(STORES.analyses).getAll());
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Deletes an analysis by id */
async function deleteAnalysis(id) {
  const db = await openDB();
  const tx = db.transaction(STORES.analyses, "readwrite");
  tx.objectStore(STORES.analyses).delete(id);
  return promisifyRequest(tx.objectStore(STORES.analyses).delete(id));
}

// ----------------------------------------------------------------
// SETTINGS  (used by Settings screen — API prefs, theme, etc.)
// ----------------------------------------------------------------

/** Sets a single setting value, e.g. setSetting('apiProvider', 'groq') */
async function setSetting(key, value) {
  const db = await openDB();
  const tx = db.transaction(STORES.settings, "readwrite");
  const record = { key, value, updatedAt: new Date().toISOString() };
  tx.objectStore(STORES.settings).put(record);
  await promisifyRequest(tx.objectStore(STORES.settings).put(record));
  return record;
}

/** Gets a single setting value (returns undefined if not set) */
async function getSetting(key) {
  const db = await openDB();
  const tx = db.transaction(STORES.settings, "readonly");
  const result = await promisifyRequest(tx.objectStore(STORES.settings).get(key));
  return result ? result.value : undefined;
}

/** Gets all settings as a plain { key: value } object */
async function getAllSettings() {
  const db = await openDB();
  const tx = db.transaction(STORES.settings, "readonly");
  const all = await promisifyRequest(tx.objectStore(STORES.settings).getAll());
  return all.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

// ----------------------------------------------------------------
// EXPORT / IMPORT  (whole-app backup, matches your roadmap)
// ----------------------------------------------------------------

/**
 * Exports everything (diagrams, analyses, settings) as one JSON-ready object.
 * The Settings module can pass this to a Blob + download link.
 */
async function exportAllData() {
  const [diagrams, analyses, settings] = await Promise.all([
    listDiagrams(),
    listAnalyses(),
    getAllSettings(),
  ]);

  return {
    appName: "ArchitectSmartCraft",
    exportedAt: new Date().toISOString(),
    schemaVersion: DB_VERSION,
    data: { diagrams, analyses, settings },
  };
}

/**
 * Imports a previously exported JSON object back into IndexedDB.
 * Existing records with matching ids are overwritten (put, not add).
 * @param {Object} exportedData - the object produced by exportAllData()
 * @param {Object} [options] - { mode: 'merge' | 'replace' } (default: 'merge')
 */
async function importAllData(exportedData, options = { mode: "merge" }) {
  if (!exportedData || !exportedData.data) {
    throw new Error("Invalid import file: missing data field.");
  }

  const db = await openDB();
  const { diagrams = [], analyses = [], settings = {} } = exportedData.data;

  if (options.mode === "replace") {
    await Promise.all([
      promisifyRequest(
        db.transaction(STORES.diagrams, "readwrite").objectStore(STORES.diagrams).clear()
      ),
      promisifyRequest(
        db.transaction(STORES.analyses, "readwrite").objectStore(STORES.analyses).clear()
      ),
      promisifyRequest(
        db.transaction(STORES.settings, "readwrite").objectStore(STORES.settings).clear()
      ),
    ]);
  }

  const diagramTx = db.transaction(STORES.diagrams, "readwrite");
  diagrams.forEach((d) => diagramTx.objectStore(STORES.diagrams).put(d));

  const analysisTx = db.transaction(STORES.analyses, "readwrite");
  analyses.forEach((a) => analysisTx.objectStore(STORES.analyses).put(a));

  const settingsTx = db.transaction(STORES.settings, "readwrite");
  Object.entries(settings).forEach(([key, value]) =>
    settingsTx.objectStore(STORES.settings).put({ key, value, updatedAt: new Date().toISOString() })
  );

  return {
    imported: {
      diagrams: diagrams.length,
      analyses: analyses.length,
      settings: Object.keys(settings).length,
    },
  };
}

// ----------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------

const storage = {
  diagrams: { save: saveDiagram, get: getDiagram, list: listDiagrams, delete: deleteDiagram },
  analyses: { save: saveAnalysis, get: getAnalysis, list: listAnalyses, delete: deleteAnalysis },
  settings: { set: setSetting, get: getSetting, getAll: getAllSettings },
  exportAllData,
  importAllData,
};

export default storage;
