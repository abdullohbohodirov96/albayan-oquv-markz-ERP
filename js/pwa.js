/* Albyana ERP — telefonga o'rnatish (PWA) va ulanish holati.
   — Xizmat ishchisini ro'yxatdan o'tkazadi (faqat http/https da).
   — Yangi versiya chiqqanda, saqlanmagan ish bo'lmasa, avtomatik yangilaydi.
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
  var updating = false;
  var pendingWorker = null;
  var pendingReload = false;

  /** Ekranda saqlanmagan ma'lumot bormi (ochiq oyna yoki to'ldirilgan forma) */
  function hasUnsaved() {
    if (A && A.UI && A.UI.hasUnsaved && A.UI.hasUnsaved()) return true;
    var backs = document.querySelectorAll('#modal-root .modal-back');
    for (var i = 0; i < backs.length; i++) {
      if (typeof backs[i].__isDirty === 'function' && backs[i].__isDirty()) return true;
    }
    var fields = document.querySelectorAll('#app input, #app textarea, #app select');
    for (var j = 0; j < fields.length; j++) {
      var f = fields[j];
      if (f.type === 'hidden' || f.disabled || f.readOnly) continue;
      if (f.id === 'global-search' || f.type === 'search') continue;
      if (f.tagName === 'SELECT') {
        var initialIndex = 0;
        for (var k = 0; k < f.options.length; k++) {
          if (f.options[k].defaultSelected) { initialIndex = k; break; }
        }
        if (f.selectedIndex !== initialIndex) return true;
        continue;
      }
      if ((f.value || '') !== (f.defaultValue || '')) return true;
    }
    return false;
  }

  function doUpdate(worker) {
    if (updating || !worker) return;
    updating = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  function tryUpdate() {
    if (pendingReload && !hasUnsaved()) {
      pendingReload = false;
      location.reload();
      return;
    }
    if (pendingWorker && !hasUnsaved()) doUpdate(pendingWorker);
  }

  async function register() {
    if (!('serviceWorker' in navigator)) return null;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    try {
      var hadController = !!navigator.serviceWorker.controller;
      // updateViaCache: 'none' — sw.js har safar serverdan tekshiriladi (keshdan emas)
      reg = await navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' });
      if (reg.waiting && navigator.serviceWorker.controller) {
        pendingWorker = reg.waiting;
        tryUpdate();
      }
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            pendingWorker = w;
            tryUpdate();
          }
        });
      });
      // Yangi ishchi boshqaruvni oldi — sahifani darhol yangi kod bilan ochamiz.
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController) return;
        updating = false;
        pendingWorker = null;
        pendingReload = true;
        tryUpdate();
      });
      // Tahrirlanayotgan forma saqlangach yangilanishni davom ettiramiz.
      setInterval(tryUpdate, 3000);
      // yangilanishni tekshirish: ochilganda, oynaga qaytganda va har soatda
      try { reg.update(); } catch (e) { }
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { try { reg.update(); } catch (e) { } }
      });
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
    version: function () {
      var m = document.querySelector('meta[name="app-version"]');
      return m ? m.getAttribute('content') : '';
    },
    hasUnsaved: hasUnsaved,
    canInstall: function () { return !!installEvent; },
    online: online, register: register
  };
})(window);
