const CACHE_NAME = "co-work-shell-v6";
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

  // Only ever touch same-origin requests. Cross-origin traffic — most
  // importantly Firestore's realtime long-poll/streaming channel to
  // firestore.googleapis.com and FCM — must reach the network untouched.
  // Re-issuing those GETs here with {cache:"no-store"} and a cache fallback
  // was disrupting the realtime channel, so chat messages synced late, out
  // of order, or (when the channel had to fully re-establish) not until the
  // app was next opened.
  if (new URL(event.request.url).origin !== self.location.origin) return;

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

  // HTML pages and API routes: always hit the network, bypassing the
  // browser's HTTP cache so stale documents never reference asset hashes
  // from a since-replaced deployment.
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request))
  );
});

// ── Web Push (chat notifications) ──────────────────────────────────────────
// The Cloud Function sends FCM data-only messages, so we build and show the
// notification ourselves here. This fires even when the PWA is backgrounded or
// fully closed. iOS requires a notification to be shown for every push, which
// we always do below.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { data: { body: event.data.text() } };
  }
  // FCM nests custom fields under `data`; fall back to the root for safety.
  const d = payload.data || payload;
  const title = d.title || "cowork";
  const body = d.body || "";
  const url = d.url || "/chat";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/badge.png",
      tag: d.tag || url,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/chat";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
