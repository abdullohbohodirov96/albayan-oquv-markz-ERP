/* Albyana ERP — telefonga o'rnatish (PWA) va ulanish holati.
   — Xizmat ishchisini ro'yxatdan o'tkazadi (faqat http/https da).
   — Yangi versiya chiqqanda "Yangilash" tugmasi ko'rsatadi.
   — Internet uzilganda ochiq ogohlantirish chiqaradi.
   Hech qanday to'lov yoki yozuv internetsiz "saqlandi" deb ko'rsatilmaydi. */
(function (global) {
  'use strict';
  var A = global.A;
  var installEvent = null;
  var reg = null;

  function bar(text, actions, cls) {
    var old = document.getElementById('pwa-bar');
    if (old) old.remove();
    var box = document.createElement('div');
    box.id = 'pwa-bar';
    box.className = 'pwa-bar ' + (cls || '');
    var span = document.createElement('span');
    span.textContent = text;
    box.appendChild(span);
    (actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.type = 'button';
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      box.appendChild(b);
    });
    document.body.appendChild(box);
    return box;
  }
  function hideBar() {
    var old = document.getElementById('pwa-bar');
    if (old) old.remove();
  }

  /* ---------- Ulanish holati ---------- */
  function online() { return !(typeof navigator !== 'undefined' && navigator.onLine === false); }

  function showOffline() {
    bar('Internet yo’q. Ma’lumot ko’rish mumkin, lekin saqlash ishlamaydi.', [], 'bad');
  }
  function showOnline() {
    hideBar();
    if (A && A.UI && A.UI.toast) A.UI.toast('Internet qaytdi.', 'ok');
  }

  /* ---------- O'rnatish ---------- */
  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    if (A && A.App) A.App.canInstall = true;
  });

  async function install() {
    if (!installEvent) {
      if (A && A.UI) {
        A.UI.toast('Brauzer menyusidan "Bosh ekranga qo’shish" ni tanlang.', 'info');
      }
      return false;
    }
    installEvent.prompt();
    var r = await installEvent.userChoice;
    installEvent = null;
    if (A && A.App) A.App.canInstall = false;
    return r && r.outcome === 'accepted';
  }

  function installed() {
    return global.matchMedia && global.matchMedia('(display-mode: standalone)').matches ||
      global.navigator.standalone === true;
  }

  /* ---------- Yangilanish ---------- */
  function offerUpdate(worker) {
    bar('Yangi versiya tayyor.', [{
      label: 'Yangilash', cls: 'primary', onClick: function () {
        if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(function () { location.reload(); }, 400);
      }
    }, {
      label: 'Keyinroq', onClick: hideBar
    }], 'info');
  }

  async function register() {
    if (!('serviceWorker' in navigator)) return null;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    try {
      reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
      if (reg.waiting) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
        });
      });
      // har soatda yangilanishni tekshirish
      setInterval(function () { try { reg.update(); } catch (e) { } }, 60 * 60 * 1000);
      return reg;
    } catch (e) {
      console.warn('sw', e);
      return null;
    }
  }

  function start() {
    register();
    global.addEventListener('online', showOnline);
    global.addEventListener('offline', showOffline);
    if (!online()) showOffline();
  }

  A.PWA = {
    start: start, install: install, installed: installed,
    canInstall: function () { return !!installEvent; },
    online: online, register: register
  };
})(window);
