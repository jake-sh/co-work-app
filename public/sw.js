const CACHE_NAME = "co-work-shell-v2";
const PRECACHE = ["/manifest.webmanifest", "/icon.svg"];

const isStaticAsset = (url) =>
  new URL(url).pathname.startsWith("/_next/static/");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Static assets (_next/static/*): cache-first (content-hashed, always fresh)
  if (isStaticAsset(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
            return res;
          })
      )
    );
    return;
  }

  // HTML pages and API routes: network-first, no caching
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
