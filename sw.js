/* AlBayan Cairo ERP — xizmat ishchisi (service worker).
   Qoidalar:
   1. Faqat dastur qobig'i (HTML, CSS, JS, rasm) keshlanadi.
   2. /api/ so'rovlari HECH QACHON keshlanmaydi — maxfiy ma'lumot brauzerda qolmaydi.
   3. Internet yo'qligida to'lov yoki boshqa yozuv "muvaffaqiyatli" deb ko'rsatilmaydi:
      so'rov xato qaytaradi va ilova buni ochiq aytadi.
   4. VERSION ni `node build.js` fayllar mazmunidan hisoblab yozadi.
   5. HTML ham, JS/CSS ham BITTA versiya keshidan beriladi.                  */
'use strict';

const VERSION = 'albayan-5ac3110afbc0';
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
  './js/pages-lms.js',
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
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    // faqat SHU ilovaning eski keshlari o'chiriladi, boshqalarga tegilmaydi
    const upgrading = names.some(n => n !== VERSION && /^(albayan|albyana)-/.test(n));
    await Promise.all(names
      .filter(n => n !== VERSION && /^(albayan|albyana)-/.test(n))
      .map(n => caches.delete(n)));
    await self.clients.claim();
    // Avvalgi versiyada avtomatik yangilash yo'q edi: ochiq ommaviy sahifani
    // yangi versiyada qayta ochamiz. ERP oynalaridagi formaga tegmaymiz.
    //
    // MUHIM: bu yerda KUTILMAYDI. client.navigate() yangi sahifani shu
    // ishchidan so'raydi; agar uni activate ichida kutsak, faollashuv
    // navigatsiyani, navigatsiya esa faollashuvni kutadi va sahifa
    // brauzer muhlati tugaguncha (~40 soniya) qotib qoladi.
    if (upgrading) renavigate();
  })());
});

/** Ochiq oynalarni yangi versiyada qayta ochish (activate ni bloklamaydi) */
function renavigate() {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(windows => {
      windows.forEach(client => {
        if (new URL(client.url).hash) return;        // ERP oynasiga tegmaymiz
        try { client.navigate(client.url).catch(() => { }); } catch (e) { }
      });
    })
    .catch(() => { });
}

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

  // 3) HTML — joriy versiya keshidan
  const isHtml = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') >= 0;

  // 3) HTML — shu versiya keshidan (JS/CSS bilan bir xil to'plamdan).
  //    Yangi chiqarilish brauzerga sw.js orqali yetadi: u o'zgargani uchun
  //    yangi ishchi o'rnatilgach ochiq sahifa avtomatik qayta yuklanadi.
  if (isHtml) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match('./index.html');
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200) cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return new Response(
          '<h1>Internet yo’q</h1><p>Ilova ochilishi uchun bir marta internetga ulaning.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // 4) Qolgan statik fayllar — shu versiya keshidan, bo'lmasa tarmoqdan
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});
