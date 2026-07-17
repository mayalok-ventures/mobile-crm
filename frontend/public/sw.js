const CACHE_NAME = 'salescrm-v1';
const STATIC_CACHE = [
  '/',
  '/dashboard',
  '/templates',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first strategy — for fresh API data
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // Always network for API calls
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
