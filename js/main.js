/**
 * js/main.js
 * ----------------------------------------------------------------
 * App entry point. Handles bottom-nav routing between modules.
 * Each module owns its own DOM rendering inside #view-container —
 * main.js just decides which module's init function to call.
 *
 * Adding a new module later = add one nav button + one view init
 * call here. Nothing else in the app needs to change.
 * ----------------------------------------------------------------
 */

import { initCreateDiagramView } from "../modules/create-diagram/create-diagram.js";
import { initAnalyzeDiagramView } from "../modules/analyze-diagram/analyze-diagram.js";
import { initSettingsView } from "../modules/settings/settings-view.js";
import { registerInstallPromptCapture } from "../modules/settings/settings.js";
import { APP_VERSION } from "./version.js";

const VIEWS = {
  create: { label: "Create", init: initCreateDiagramView },
  analyze: { label: "Analyze", init: initAnalyzeDiagramView },
  settings: { label: "Settings", init: initSettingsView },
};

let currentView = "create";

function navigate(viewKey) {
  if (!VIEWS[viewKey]) return;
  currentView = viewKey;

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewKey);
  });

  const container = document.getElementById("view-container");
  container.innerHTML = "";
  VIEWS[viewKey].init(container);

  window.location.hash = viewKey;
}

function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.view));
  });
}

function initFromHash() {
  const hash = window.location.hash.replace("#", "");
  navigate(VIEWS[hash] ? hash : "create");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }
}

function init() {
  console.log(`ArchitectSmartCraft v${APP_VERSION}`);
  initNav();
  registerInstallPromptCapture();
  registerServiceWorker();
  initFromHash();
}

document.addEventListener("DOMContentLoaded", init);
