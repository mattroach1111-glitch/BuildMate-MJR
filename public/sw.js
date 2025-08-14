// Force unregister all service workers
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }),
      self.registration.unregister()
    ]).then(() => {
      console.log('Service worker unregistered');
      return self.clients.claim();
    })
  );
});

// Block all fetch requests from service worker
self.addEventListener('fetch', () => {
  return;
});