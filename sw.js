// Service worker: η εφαρμογή ανοίγει και χωρίς ίντερνετ
const APP = 'taxidia-app-v2', TILES = 'taxidia-tiles-v1', DATA = 'taxidia-data-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![APP, TILES, DATA].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trimTiles() {
  const c = await caches.open(TILES), keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - 800))) await c.delete(k);
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Χάρτης: πρώτα δίκτυο, αλλιώς ό,τι έχει αποθηκευτεί
  if (url.hostname.endsWith('tile.openstreetmap.org') || url.hostname === 'server.arcgisonline.com') {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone(); caches.open(TILES).then(c => c.put(req, copy)).then(trimTiles); return r;
    }).catch(() => caches.match(req)));
    return;
  }
  // Λίστα αεροδρομίων & σημαίες: από την cache αν υπάρχουν (γλιτώνει δεδομένα κινητού)
  if (url.hostname === 'raw.githubusercontent.com' || url.hostname === 'flagcdn.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      const copy = r.clone(); caches.open(DATA).then(c => c.put(req, copy)); return r;
    })));
    return;
  }
  // Η ίδια η εφαρμογή: πρώτα δίκτυο (για ενημερώσεις), αλλιώς cache
  if (url.origin === location.origin || url.hostname === 'unpkg.com') {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone(); caches.open(APP).then(c => c.put(req, copy)); return r;
    }).catch(() => caches.match(req, {ignoreSearch: true})));
  }
});
