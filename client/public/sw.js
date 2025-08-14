// BuildFlow Pro Service Worker
const CACHE_NAME = 'buildflow-pro-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline functionality
const STATIC_CACHE = [
  '/',
  '/manifest.json',
  '/offline.html',
  // Core app files will be cached automatically by the browser
];

// API endpoints to cache
const API_CACHE = [
  '/api/auth/user',
  '/api/jobs',
  '/api/employees',
  '/api/timesheet-entries'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('🔧 BuildFlow Pro Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching essential files');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        console.log('✅ BuildFlow Pro Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 BuildFlow Pro Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ BuildFlow Pro Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses for offline access
          if (response.ok && API_CACHE.some(path => url.pathname.startsWith(path))) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached API data if available
          return caches.match(request);
        })
    );
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return cached page or offline page
          return caches.match(request)
            .then((response) => {
              return response || caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // Handle other requests (assets, etc.)
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(request)
          .then((fetchResponse) => {
            // Cache successful responses
            if (fetchResponse.ok) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return fetchResponse;
          });
      })
  );
});

// Handle background sync for offline data submission
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'background-timesheet-sync') {
    event.waitUntil(syncTimesheetData());
  }
  
  if (event.tag === 'background-job-sync') {
    event.waitUntil(syncJobData());
  }
});

// Sync timesheet data when back online
async function syncTimesheetData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const pendingData = await cache.match('/pending-timesheet-data');
    
    if (pendingData) {
      const data = await pendingData.json();
      const response = await fetch('/api/timesheet-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        await cache.delete('/pending-timesheet-data');
        console.log('✅ Timesheet data synced successfully');
      }
    }
  } catch (error) {
    console.error('❌ Error syncing timesheet data:', error);
  }
}

// Sync job data when back online  
async function syncJobData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const pendingData = await cache.match('/pending-job-data');
    
    if (pendingData) {
      const data = await pendingData.json();
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        await cache.delete('/pending-job-data');
        console.log('✅ Job data synced successfully');
      }
    }
  } catch (error) {
    console.error('❌ Error syncing job data:', error);
  }
}

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open BuildFlow Pro'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('BuildFlow Pro', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

console.log('📱 BuildFlow Pro Service Worker loaded successfully');