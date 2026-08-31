/* ProgFrog service worker — minimal, hand-rolled.
 * Goals: make the app installable and degrade gracefully offline.
 * Bump CACHE_VERSION whenever this file's caching rules change. */
const CACHE_VERSION = "v2";
const STATIC_CACHE = `progfrog-static-${CACHE_VERSION}`;
const PAGE_CACHE = `progfrog-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/icon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "SKIP_WAITING") self.skipWaiting();

  // The app asks us to stash a page (the active workout) so "Resume" works
  // even if that URL was never opened online.
  if (data && data.type === "cache-page" && typeof data.url === "string") {
    const url = new URL(data.url, self.location.origin);
    if (url.origin !== self.location.origin) return;
    event.waitUntil(
      Promise.all([
        caches.open(PAGE_CACHE).then((cache) =>
          fetch(url.href, { credentials: "same-origin", redirect: "manual" })
            .then((res) => {
              // Only cache a real page — not a redirect to sign-in.
              if (res && res.ok && res.type !== "opaqueredirect") {
                return cache.put(url.href, res);
              }
            })
            .catch(() => {}),
        ),
      ]),
    );
  }
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never get between the app and its data / auth / server actions / RSC.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1"
  ) {
    return;
  }

  // App shell navigations: network-first, fall back to the last good copy of
  // this page, then to the offline screen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  // Immutable build assets: cache-first, fill the cache lazily.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
