/* ProgFrog service worker — minimal, hand-rolled.
 * Goals: make the app installable and degrade gracefully offline.
 * Bump CACHE_VERSION whenever this file's caching rules change. */
const CACHE_VERSION = "v4";
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

  // Sign-out / landing on the sign-in page: drop every cached authenticated
  // page so a later visitor on this device can't read them offline.
  if (data === "clear-pages") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }

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

// Content-hashed by the build — the bytes behind a given URL never change.
function isHashedBuildAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

// Static assets served from a stable path (brand icons, launch screens,
// favicon, fonts). The bytes CAN change on a redeploy, so these must not be
// pinned forever the way hashed assets are.
function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname);
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

  // App shell navigations: network-first. Only the active-workout pages are
  // written to the page cache (so "Resume" works offline) — caching every
  // authenticated page would leave a readable copy behind after sign-out.
  if (request.mode === "navigate") {
    const cacheThisPage = /^\/dashboard\/workouts\/[^/]+$/.test(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheThisPage && response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  // Content-hashed build assets: cache-first, fill the cache lazily — the URL
  // changes whenever the bytes do, so a stale hit is impossible.
  if (isHashedBuildAsset(url)) {
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
    return;
  }

  // Other static assets (icons, launch screens, favicon): stale-while-
  // revalidate. Serve the cached copy immediately, then refresh it in the
  // background so a redeployed icon or splash lands on the next load without a
  // CACHE_VERSION bump.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request).then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        });
        if (cached) {
          event.waitUntil(network.catch(() => {}));
          return cached;
        }
        return network;
      })(),
    );
  }
});
