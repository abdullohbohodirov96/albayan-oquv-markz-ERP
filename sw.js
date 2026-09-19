/* Albyana ERP — xizmat ishchisi (service worker).
   Qoidalar:
   1. Faqat dastur qobig'i (HTML, CSS, JS, rasm) keshlanadi.
   2. /api/ so'rovlari HECH QACHON keshlanmaydi — maxfiy ma'lumot brauzerda qolmaydi.
   3. Internet yo'qligida to'lov yoki boshqa yozuv "muvaffaqiyatli" deb ko'rsatilmaydi:
      so'rov xato qaytaradi va ilova buni ochiq aytadi.                      */
'use strict';

const VERSION = 'albyana-v3';
const SHELL = [
  './index.html',
  './css/app.css',
  './js/xlsx-lite.js',
  './js/i18n.js',
  './js/core.js',
  './js/model.js',
  './js/ops.js',
  './js/ui.js',
  './js/pages-core.js',
  './js/pages-edu.js',
  './js/pages-fin.js',
  './js/pages-team.js',
  './js/bot.js',
  './js/import.js',
  './js/seed.js',
  './js/pwa.js',
  './js/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // bitta fayl yuklanmasa ham o'rnatish buzilmasin
    await Promise.all(SHELL.map(u => cache.add(u).catch(() => { })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isApi(url) {
  return url.pathname.indexOf('/api/') >= 0;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) API — hech qachon keshlanmaydi va keshdan berilmaydi
  if (isApi(url)) return;                       // brauzerning o'z yo'li

  // 2) Faqat GET va o'z manzilimiz
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // 3) HTML — avval tarmoq, keyin kesh (yangilanish tez yetib borsin)
  const isHtml = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') >= 0;

  if (isHtml) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match('./index.html');
        return cached || new Response(
          '<h1>Internet yo’q</h1><p>Ilova ochilishi uchun bir marta internetga ulaning.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // 4) Qolgan statik fayllar — avval kesh, keyin tarmoq
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});
