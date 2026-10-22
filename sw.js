const CACHE_NAME = 'element-speller-1.0.4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './favicon.ico',
  './manifest.json',
  './css/style.css',
  './css/modals.css',
  './js/app.js',
  './js/elements.js',
  './js/words.js',
  './js/speller.js',
  './js/prng.js',
  './js/storage.js',
  './js/auth.js',
  './js/firebase-config.js',
  './images/icon-64.png',
  './images/icon-192.png',
  './images/icon-512.png'
];

// Install Event: Pre-cache all core game assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event: Clear older caches when version bumps
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Network-first for scripts, styles & navigation; Cache-first for images/icons
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip caching external Firebase or third-party requests
  if (!url.origin.includes(self.location.origin)) {
    return;
  }

  const isCodeOrDoc = event.request.mode === 'navigate' ||
                      event.request.destination === 'script' ||
                      event.request.destination === 'style' ||
                      url.pathname.endsWith('.js') ||
                      url.pathname.endsWith('.css') ||
                      url.pathname.endsWith('.html');

  if (isCodeOrDoc) {
    // Network-first strategy so game logic updates apply immediately
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first strategy for media and icon assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
