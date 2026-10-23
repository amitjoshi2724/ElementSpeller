/**
 * Element-Speller Service Worker (v1.0.5)
 * Full offline PWA support for macOS Dock, iOS Safari, Android, and Desktop Chrome.
 */

const CACHE_NAME = 'element-speller-v1.0.5';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
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
  './images/icon-512.png',
  './query/index.html'
];

// Install Event: Pre-cache all core game assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    }).catch((err) => {
      console.warn('Pre-caching some assets failed:', err);
    })
  );
});

// Activate Event: Clear older caches when version bumps and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Navigation Requests (Opening page from Dock, browser, or refresh)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Robust offline fallback: match request ignoring search params, then index.html, then root
          const cachedMatch = await caches.match(event.request, { ignoreSearch: true });
          if (cachedMatch) return cachedMatch;

          const indexMatch = await caches.match('./index.html') || await caches.match('./');
          if (indexMatch) return indexMatch;

          return new Response('Offline - puzzle assets cached locally.', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 2. External CDN Requests (Firebase SDK, Ko-fi widget)
  if (url.origin.includes('gstatic.com') || url.origin.includes('ko-fi.com')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Local Scripts & Styles: Network-first with fast cache fallback
  const isCode = url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json');
  if (isCode && url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // 4. Media & Icons: Cache-first
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
