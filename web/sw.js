"use strict";
/* Service worker of the web app, written by tools/web.mjs. It keeps the app files for offline use; a new version
   arrives with the next start. API calls and language packs always go to the network (the app stores the packs). */
const CACHE = "opensprachfuchs-__VERSION__", FILES = __FILES__;
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || /^\/(api|packs|f)(\/|$)/.test(u.pathname)) return;
  e.respondWith(caches.match(r.mode === "navigate" ? "./" : r, { cacheName: CACHE, ignoreSearch: true }).then(hit => hit || fetch(r)));
});
