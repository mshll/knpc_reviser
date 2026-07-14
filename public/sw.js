/* Offline support for a fully static export. Bump CACHE_VERSION on any change
 * to the caching logic; old caches are deleted on activate. This worker only
 * touches the HTTP cache layer - IndexedDB (quiz history, settings) is not a
 * network resource and is never intercepted.
 */
const CACHE_VERSION = 2;
const CACHE_NAME = `knpc-reviser-v${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/bank',
  '/history',
  '/quiz',
  '/results',
  '/settings',
  '/setup',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function putInCache(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

/* App shell, hashed /_next/static chunks (which embed the question bank),
 * figures and fonts: immutable per deploy, so the cache wins outright. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await putInCache(request, response.clone());
  return response;
}

/* Navigations and RSC payloads: the network wins so a redeploy is picked up,
 * the cache answers offline, and the cached shell is the last resort. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) await putInCache(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('/');
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Vercel Analytics and Speed Insights: never cache, never intercept.
  if (url.pathname.startsWith('/_vercel/')) return;

  const freshFirst = request.mode === 'navigate' || url.searchParams.has('_rsc');
  event.respondWith(freshFirst ? networkFirst(request) : cacheFirst(request));
});
