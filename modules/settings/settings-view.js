/**
 * modules/settings/settings-view.js
 * ----------------------------------------------------------------
 * UI layer for the Settings module. Logic lives in settings.js;
 * this file only renders DOM and wires up event listeners.
 * ----------------------------------------------------------------
 */

import {
  saveApiConfig,
  loadApiConfig,
  clearApiConfig,
  exportData,
  importDataFromFile,
  triggerInstallPrompt,
  isRunningStandalone,
  getVersionInfo,
} from "./settings.js";

let containerEl = null;

export async function initSettingsView(container) {
  containerEl = container;
  await render();
}

async function render() {
  if (!containerEl) return;

  const { provider, apiKey } = await loadApiConfig();
  const { version, name } = getVersionInfo();
  const installed = isRunningStandalone();

  containerEl.innerHTML = `
    <h2>Settings</h2>

    <div class="panel corner-frame">
      <span class="label">App</span>
      <div class="flex-between">
        <span style="font-size:14px;">${name}</span>
        <span style="font-size:12px; color: var(--color-text-tertiary);">v${version}</span>
      </div>
    </div>

    <div class="panel">
      <span class="label">Install</span>
      ${
        installed
          ? `<p style="font-size:13px; margin:0;">Already installed on this device.</p>`
          : `<button class="btn btn-primary btn-block hidden" id="install-app-btn">Install app</button>
             <p style="font-size:12px; color: var(--color-text-tertiary); margin-top:8px;">
               If the install button doesn't appear, use your browser menu — "Add to Home screen" on Chrome (Android) or "Apps &gt; Install this site as an app" on Edge.
             </p>`
      }
    </div>

    <div class="panel">
      <span class="label">AI provider (optional)</span>
      <p style="font-size:12px;">Used by Analyze Diagram to generate explanations automatically. Your key is stored only on this device.</p>
      <select id="provider-select">
        <option value="">None — I'll write explanations manually</option>
        <option value="groq" ${provider === "groq" ? "selected" : ""}>Groq</option>
        <option value="cerebras" ${provider === "cerebras" ? "selected" : ""}>Cerebras</option>
        <option value="mistral" ${provider === "mistral" ? "selected" : ""}>Mistral</option>
      </select>
      <input type="text" id="api-key-input" placeholder="API key" value="${apiKey ? escapeHtml(apiKey) : ""}" class="mt-1" />
      <div class="flex gap-1 mt-2">
        <button class="btn btn-primary" id="save-api-btn">Save</button>
        <button class="btn btn-danger" id="clear-api-btn">Clear</button>
      </div>
      <p id="api-status" style="font-size:12px; color: var(--color-accent); margin-top:8px;"></p>
    </div>

    <div class="panel">
      <span class="label">Backup</span>
      <p style="font-size:12px;">Export all diagrams, analyses, and settings as one JSON file. Import it back on this or another device.</p>
      <div class="flex gap-1">
        <button class="btn" id="export-btn">Export data</button>
        <label class="btn" style="margin:0;">
          Import data
          <input type="file" id="import-input" accept="application/json" class="hidden" />
        </label>
      </div>
      <p id="backup-status" style="font-size:12px; color: var(--color-accent); margin-top:8px;"></p>
    </div>
  `;

  document.getElementById("save-api-btn").addEventListener("click", handleSaveApi);
  document.getElementById("clear-api-btn").addEventListener("click", handleClearApi);
  document.getElementById("export-btn").addEventListener("click", handleExport);
  document.getElementById("import-input").addEventListener("change", handleImport);

  const installBtn = document.getElementById("install-app-btn");
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      const result = await triggerInstallPrompt();
      if (result.outcome === "accepted") {
        installBtn.classList.add("hidden");
      }
    });
  }
}

async function handleSaveApi() {
  const provider = document.getElementById("provider-select").value;
  const apiKey = document.getElementById("api-key-input").value.trim();
  const statusEl = document.getElementById("api-status");

  if (!provider) {
    await clearApiConfig();
    statusEl.textContent = "No provider selected — manual explanations only.";
    return;
  }

  if (!apiKey) {
    statusEl.textContent = "Enter an API key first.";
    return;
  }

  await saveApiConfig(provider, apiKey);
  statusEl.textContent = "Saved.";
}

async function handleClearApi() {
  await clearApiConfig();
  document.getElementById("provider-select").value = "";
  document.getElementById("api-key-input").value = "";
  document.getElementById("api-status").textContent = "Cleared.";
}

async function handleExport() {
  const statusEl = document.getElementById("backup-status");
  statusEl.textContent = "Preparing export...";
  await exportData();
  statusEl.textContent = "Downloaded.";
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById("backup-status");

  try {
    const result = await importDataFromFile(file, "merge");
    statusEl.textContent = `Imported ${result.imported.diagrams} diagrams, ${result.imported.analyses} analyses.`;
  } catch (err) {
    statusEl.textContent = `Import failed: ${err.message}`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
