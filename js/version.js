/**
 * version.js
 * ----------------------------------------------------------------
 * Single source of truth for the app version. Bump this on every
 * release. The service worker reads this (via sw.js's own copy,
 * since service workers can't import ES modules in all browsers
 * reliably) to know when to invalidate old caches.
 *
 * RULE: whenever you change ANY file in the app, bump APP_VERSION
 * here AND bump CACHE_VERSION in sw.js to the same value. This
 * guarantees Edge/Chrome pick up the new files instead of serving
 * stale cached ones.
 * ----------------------------------------------------------------
 */

export const APP_VERSION = "1.5.0";
export const APP_NAME = "ArchitectSmartCraft";
export const APP_SHORT_NAME = "ASC";
