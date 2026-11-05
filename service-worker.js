const CACHE_NAME = "hk-vn-travel-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./trip-data.json",
  "./styles.css?v=20261104-4",
  "./ledger.css?v=20261104-2",
  "./apple-polish.css?v=20261105-8",
  "./initial-local-state.js?v=20261105-1",
  "./runtime-storage.js?v=20260910-2",
  "./overview-map.js?v=20260910-2",
  "./route-ui.js?v=20260910-2",
  "./app.js?v=20261105-3",
  "./trip-editor.js?v=20261105-3",
  "./ui-stress.js?v=20261104-1",
  "./outfit.js?v=20261105-2",
  "./ticket-pdf-preview.js?v=20260910-2",
  "./ledger.js?v=20261104-3",
  "./apple-date-picker.js?v=20261105-1",
  "./site-navigation.js?v=20261104-1",
  "./apple-polish.js?v=20261104-1",
  "./pwa-register.js?v=20261105-1",
  "./assets/icons/sunflower-apple-touch-icon.png",
  "./assets/icons/sunflower-icon-192.png",
  "./assets/icons/sunflower-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
        return response;
      })
      .catch(() => caches.match("./index.html")));
    return;
  }

  if (url.pathname.endsWith("/trip-data.json")) {
    event.respondWith(fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  })));
});
