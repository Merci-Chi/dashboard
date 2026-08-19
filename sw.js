const CACHE_NAME = 'steady-dashboard-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css.css',
  './js.js',
  './manifest.webmanifest',
  './app-icon/favicon-64.png',
  './app-icon/apple-touch-icon.png',
  './app-icon/icon-192.png',
  './app-icon/icon-512.png',
  './app-icon/icon-1024.png',
  './leads/index.html',
  './leads/css.css',
  './leads/js.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
