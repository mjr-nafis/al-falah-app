// Al-Falah Foundation App - Service Worker
// অ্যাপ আপডেট করলে নিচের VERSION বদলে দিন (যেমন v2), তাহলে ফোনে নতুন ভার্সন লোড হবে।
const VERSION = 'v2';
const CORE_CACHE = 'alfalah-core-' + VERSION;
const RUNTIME_CACHE = 'alfalah-runtime-' + VERSION;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

// শুধু এই CDN গুলো ক্যাশ হবে (Tailwind, Chart.js, Lucide, Fonts)
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CORE_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const fallback = () => caches.match('./index.html').then((r) => r || caches.match(request));
    const timer = setTimeout(() => {
      fallback().then((r) => { if (r && !settled) { settled = true; resolve(r); } });
    }, timeoutMs);
    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CORE_CACHE).then((c) => c.put('./index.html', copy));
        }
        if (!settled) { settled = true; resolve(res); }
      })
      .catch(() => {
        clearTimeout(timer);
        fallback().then((r) => { if (!settled) { settled = true; resolve(r || Response.error()); } });
      });
  });
}

function staleWhileRevalidate(request) {
  return caches.open(RUNTIME_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST (Google Sheet সেভ) সরাসরি নেটওয়ার্কে যাবে

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(networkFirst(req, 4000));
    } else {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
  // অন্য সব (যেমন script.google.com) — কোনো হস্তক্ষেপ নেই, লাইভ ডাটা সরাসরি আসবে
});
