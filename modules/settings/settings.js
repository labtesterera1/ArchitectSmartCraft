/**
 * modules/settings/settings.js
 * ----------------------------------------------------------------
 * Settings module — independent of CreateDiagram and AnalyzeDiagram.
 * Handles: API provider/key config, PWA install prompt,
 * export/import of all app data, and showing the current version.
 *
 * Talks only to storage.js — never touches IndexedDB directly.
 * ----------------------------------------------------------------
 */

import storage from "../../js/storage.js";
import { APP_VERSION, APP_NAME } from "../../js/version.js";

let deferredInstallPrompt = null;

/** Captures the browser's "beforeinstallprompt" event so we can trigger it later from a button */
export function registerInstallPromptCapture() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const btn = document.getElementById("install-app-btn");
    if (btn) btn.classList.remove("hidden");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById("install-app-btn");
    if (btn) btn.classList.add("hidden");
  });
}

/** Triggers the native install prompt (must be called from a user gesture, e.g. button click) */
export async function triggerInstallPrompt() {
  if (!deferredInstallPrompt) {
    return { outcome: "unavailable" };
  }
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return choice;
}

/** Returns true if the app is already running in standalone/installed mode */
export function isRunningStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

// ----------------------------------------------------------------
// API provider settings (Groq / Cerebras / Mistral — manual use)
// ----------------------------------------------------------------

const SUPPORTED_PROVIDERS = ["groq", "cerebras", "mistral"];

/** Saves the user's chosen API provider + key. Stored locally only, never transmitted anywhere but the chosen provider's API. */
export async function saveApiConfig(provider, apiKey) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  await storage.settings.set("apiProvider", provider);
  await storage.settings.set("apiKey", apiKey);
  return { provider, saved: true };
}

/** Loads the saved API provider + key */
export async function loadApiConfig() {
  const provider = await storage.settings.get("apiProvider");
  const apiKey = await storage.settings.get("apiKey");
  return { provider: provider || null, apiKey: apiKey || null };
}

/** Clears the saved API key (e.g. "log out" / "forget key") */
export async function clearApiConfig() {
  await storage.settings.set("apiProvider", null);
  await storage.settings.set("apiKey", null);
}

// ----------------------------------------------------------------
// Export / Import (delegates to storage.js)
// ----------------------------------------------------------------

/** Triggers a browser download of all app data as a single JSON file */
export async function exportData() {
  const exportObject = await storage.exportAllData();
  const blob = new Blob([JSON.stringify(exportObject, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `${APP_NAME.toLowerCase()}-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return exportObject;
}

/** Reads a File selected via <input type="file"> and imports it */
export async function importDataFromFile(file, mode = "merge") {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("That file isn't valid JSON. Please select a previously exported backup.");
  }
  return storage.importAllData(parsed, { mode });
}

// ----------------------------------------------------------------
// Version info
// ----------------------------------------------------------------

export function getVersionInfo() {
  return { version: APP_VERSION, name: APP_NAME };
}
