// Lets ScheduLens open without internet. Pages are fetched from the network
// first and fall back to the saved copy when offline. Versioned app files
// (their names change with every release) are served from the saved copy.
// Only this site's own files are saved, never sign-in or group data.
const CACHE = 'schedulens-v1';
const CORE = ['/', '/manifest.webmanifest', '/assets/sql-wasm.wasm', '/icons/icon-192.png',
  '/fonts/fredoka-latin-500-normal.woff2', '/fonts/fredoka-latin-600-normal.woff2',
  '/fonts/nunito-latin-400-normal.woff2', '/fonts/nunito-latin-600-normal.woff2',
  '/fonts/nunito-latin-700-normal.woff2', '/fonts/nunito-latin-800-normal.woff2'];

async function saveCore() {
  const c = await caches.open(CACHE);
  await Promise.all(CORE.map((u) => c.add(u).catch(() => {})));
  // Also save the app's main script named in the current page.
  try {
    const html = await (await fetch('/', { cache: 'no-store' })).text();
    const m = html.match(/src="(\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js)"/);
    if (m) await c.add(m[1]);
  } catch {}
}

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(saveCore()); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const versioned = url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/fonts/');
  if (versioned) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // Network first; any page address falls back to the saved app page.
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? '/' : req, copy)); }
    return res;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('/') : Response.error())));
});
