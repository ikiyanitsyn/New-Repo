/*
 * Intercontinental Nomad service worker: keeps the app usable offline.
 *  - App code, fonts and map shapes: served from the cache once seen (they're versioned).
 *  - Pages: fresh from the network when online; the last copy when offline.
 *  - City guides (/api/places): the last copy is shown at once and refreshed in the background.
 *  - Flights, ratings, the AI planner and accounts always go to the network.
 * Trips themselves live in the browser's storage, so they're available offline already.
 */
const VERSION = "v1";
const STATIC = `in-static-${VERSION}`;
const PAGES = `in-pages-${VERSION}`;
const GUIDES = `in-guides-${VERSION}`;
const SHELL = ["/", "/itinerary", "/share"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC, PAGES, GUIDES]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("in-") && !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(STATIC)).put(request, res.clone());
  return res;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(new URL(request.url).pathname, res.clone());
    return res;
  } catch {
    return (await cache.match(new URL(request.url).pathname)) || (await cache.match("/")) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(GUIDES);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/geo/") || /\.(woff2?|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname === "/api/places") {
    event.respondWith(staleWhileRevalidate(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});
