/* LA ZONA — service worker.
 * - Precaché del shell completo (la app funciona 100 % offline tras la primera carga).
 * - Estrategia red‑primero con respaldo de caché para recursos propios.
 * - Caché versionada: al cambiar VERSION se crea una nueva y se borran las antiguas.
 * Si añades o quitas archivos, actualiza PRECACHE (tests/pwa.test.js lo comprueba). */
const VERSION = 'lazona-v11';
const PRECACHE = [
  './', 'index.html', 'manifest.json',
  'css/styles.css', 'css/game.css',
  'js/theme-boot.js', 'app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'legal/privacy.html', 'legal/terms.html', 'legal/legal.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lazona-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // solo recursos propios

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type === 'basic') cache.put(req, fresh.clone());
      return fresh;
    } catch {
      const hit = (await cache.match(req, { ignoreSearch: true }))
        // Navegaciones sin red: el shell de la app.
        || (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
      return hit || new Response('Sin conexión', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
