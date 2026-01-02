/**
 * Custom Service Worker for LotAstro
 * Provides background sync and offline queue management
 */

const CACHE_NAME = 'lotastro-v1';
const SYNC_QUEUE_NAME = 'sync-queue';
const API_CACHE_NAME = 'supabase-api-cache';

// URLs to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/lotastro-logo.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

// API patterns to cache with network-first strategy
const API_PATTERNS = [
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
];

// Install event - precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching static assets');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first with cache fallback for API, cache first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // API requests - network first with cache fallback
  if (API_PATTERNS.some((pattern) => pattern.test(event.request.url))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Static assets - cache first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version but also update cache in background
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        });
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Background Sync registration
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-pending-mutations') {
    event.waitUntil(processPendingMutations());
  }
});

// Process pending mutations from IndexedDB
async function processPendingMutations() {
  console.log('[SW] Processing pending mutations...');
  
  try {
    // Open IndexedDB
    const db = await openDatabase();
    const mutations = await getPendingMutations(db);
    
    console.log(`[SW] Found ${mutations.length} pending mutations`);
    
    for (const mutation of mutations) {
      try {
        const success = await executeMutation(mutation);
        if (success) {
          await removeMutation(db, mutation.id);
          console.log(`[SW] Synced mutation: ${mutation.id}`);
        }
      } catch (err) {
        console.error(`[SW] Failed to sync mutation ${mutation.id}:`, err);
        await incrementRetryCount(db, mutation);
      }
    }
    
    // Notify clients of sync completion
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now(),
      });
    });
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

// IndexedDB helpers
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lotastro_offline', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getPendingMutations(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const index = store.index('status');
    const request = index.getAll('pending');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

function removeMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

function incrementRetryCount(db, mutation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    
    const updatedMutation = {
      ...mutation,
      attempts: (mutation.attempts || 0) + 1,
      status: mutation.attempts >= 2 ? 'failed' : 'pending',
      lastError: 'Background sync failed',
    };
    
    const request = store.put(updatedMutation);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Execute a single mutation against the API
async function executeMutation(mutation) {
  const supabaseUrl = self.registration.scope.includes('localhost')
    ? 'http://localhost:54321'
    : 'https://kwcwbyfzzordqwudixvl.supabase.co';
  
  const endpoint = `${supabaseUrl}/rest/v1/${mutation.table}`;
  
  let response;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': mutation.apiKey || '',
    'Authorization': `Bearer ${mutation.accessToken || ''}`,
    'Prefer': 'return=representation',
  };
  
  switch (mutation.type) {
    case 'CREATE':
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(mutation.data),
      });
      break;
      
    case 'UPDATE':
      response = await fetch(`${endpoint}?id=eq.${mutation.recordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(mutation.data),
      });
      break;
      
    case 'DELETE':
      response = await fetch(`${endpoint}?id=eq.${mutation.recordId}`, {
        method: 'DELETE',
        headers,
      });
      break;
      
    default:
      throw new Error(`Unknown mutation type: ${mutation.type}`);
  }
  
  return response.ok;
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'TRIGGER_SYNC':
      console.log('[SW] Manual sync triggered');
      processPendingMutations();
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME);
      caches.delete(API_CACHE_NAME);
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Periodic sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-pending-mutations') {
    event.waitUntil(processPendingMutations());
  }
});

console.log('[SW] Service worker loaded');
