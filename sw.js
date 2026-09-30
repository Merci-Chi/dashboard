const CACHE_NAME = 'steady-dashboard-v6';

self.addEventListener('install', event => {
  // Activate new deployments immediately instead of waiting for every old tab/app window to close.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    // Remove every older Steady Dashboard cache.
    await Promise.all(
      keys
        .filter(key => key.startsWith('steady-dashboard-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );

    // Immediately take control of existing installed app windows.
    await self.clients.claim();

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of windows) {
      client.postMessage({ type: 'STEADY_DASHBOARD_UPDATED' });
    }
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Leave Supabase/CDN/other third-party requests alone.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      // Always ask the network for the deployed version.
      // This prevents installed phone apps from getting stuck on old HTML/JS/CSS.
      const response = await fetch(event.request, { cache: 'no-store' });

      // Keep the newest successful same-origin response only as an offline fallback.
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }

      return response;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
