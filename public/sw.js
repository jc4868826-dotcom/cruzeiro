'use strict';

// ─── FunnelOS Cruzeiro — Service Worker ───────────────────────────────────────
// Provides: offline shell cache, background sync hook, native push notifications.

const CACHE_NAME = 'cruzeiro-funnelos-v3';

// Assets to cache for offline shell
const SHELL_ASSETS = [
  '/',
  '/login.html',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/leads.js',
  '/js/catalogo.js',
  '/js/campanas.js',
  '/js/configuracion.js',
  '/js/chat-test.js',
  '/js/archivos.js',
  '/js/pipeline.js',
  '/js/agenda.js',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch — network-first for API, cache-first for shell ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls and webhooks: always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhook')) {
    return; // let browser handle normally
  }

  // Shell: network-first with cache fallback
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Cruzeiro FunnelOS', body: 'Nueva notificación', url: '/' };
  try {
    data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(self.location.origin) && 'focus' in c);
      if (existing) {
        return existing.focus().then(c => c.navigate(targetUrl));
      }
      return clients.openWindow(targetUrl);
    })
  );
});
