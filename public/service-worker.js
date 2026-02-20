// Service Worker for Sai Songs PWA
const CACHE_NAME = 'saisongs-v2';
const RUNTIME_CACHE = 'saisongs-runtime-v2';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/logo1.png',
  '/index.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);
  const isJsFile = url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs');
  const isCssFile = url.pathname.endsWith('.css');
  const isHtmlFile = url.pathname.endsWith('.html') || url.pathname === '/';

  // For JavaScript and CSS files, use network-first strategy to ensure fresh code
  // This prevents serving stale bundles after code changes
  if (isJsFile || isCssFile) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If network request succeeds, cache it and return
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // If network fails (e.g. offline), serve from cache
          return caches.match(event.request).then((cached) => cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }));
        })
    );
    return;
  }

  // For HTML and other files, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();

            // Cache the response
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If network fails, try cache - for navigation, fallback to index.html
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html').then((cached) => cached || caches.match('/'));
            }
            return caches.match(event.request);
          });
      })
  );
});

