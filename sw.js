/**
 * sw.js
 * ----------------------------------------------------------------
 * Service worker for ArchitectSmartCraft. Caches the app shell so
 * it works offline and installs cleanly on Edge (desktop) and
 * Chrome (Android).
 *
 * VERSION BUMPING RULE: bump CACHE_VERSION every time ANY cached
 * file changes (HTML/CSS/JS/assets). This forces browsers to fetch
 * fresh files instead of serving stale cached ones. Keep this in
 * sync with APP_VERSION in js/version.js.
 * ----------------------------------------------------------------
 */

const CACHE_VERSION = "1.3.0";
const CACHE_NAME = `architectsmartcraft-v${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/theme.css",
  "./js/main.js",
  "./js/storage.js",
  "./js/version.js",
  "./modules/create-diagram/create-diagram.js",
  "./modules/analyze-diagram/analyze-diagram.js",
  "./modules/settings/settings.js",
  "./modules/settings/settings-view.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/**
 * Strategy: cache-first for app shell files (fast, offline-capable),
 * network-first for everything else (e.g. AI provider API calls
 * should always hit the network, never be cached).
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache cross-origin requests (e.g. Groq/Cerebras/Mistral API calls)
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          // Cache successful same-origin GET responses for next time
          if (event.request.method === "GET" && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline and not cached — fall back to the app shell for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
