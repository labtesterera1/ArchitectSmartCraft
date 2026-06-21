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
      navigator.serviceWorker
        .register("./sw.js")
        .then((registration) => {
          // Force a byte-comparison check against the live sw.js on every
          // page load, bypassing the browser's normal 24h throttle on SW
          // update checks. Cheap (one small file fetch) and guarantees
          // new releases are picked up the same day they're deployed.
          registration.update().catch(() => {});

          // If a new worker is already waiting (e.g. from a previous load
          // that didn't get claimed), activate it immediately and reload
          // once so the user is never stuck on stale JS.
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // A new version has installed and is waiting — claim it now.
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch((err) => {
          console.warn("Service worker registration failed:", err);
        });

      // Reload once when the new SW takes control, so the page picks up
      // the new module files instead of running with stale cached ones.
      let hasReloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
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
