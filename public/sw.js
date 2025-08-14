// Minimal Service Worker - Troubleshooting Mode
console.log('Service Worker: Troubleshooting mode active');

// Immediately skip waiting and take control
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('Service Worker: Clearing all caches');
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('Service Worker: Taking control of clients');
      return self.clients.claim();
    })
  );
});

// Don't intercept fetch requests - let everything go to network
self.addEventListener('fetch', (event) => {
  // No caching, no interception - just let requests pass through
  return;
});

console.log('Service Worker: Setup complete');