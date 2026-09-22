/* Albyana ERP — umumiy interfeys komponentlari */
(function (global) {
  'use strict';
  var A = global.A;

  /* ---------- DOM ---------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') el.setAttribute('style', v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  var ICONS = {
    key: 'M15 7a4 4 0 1 1-3.9 5H8v3H5v3H2v-3l6.1-6.1A4 4 0 0 1 15 7z',
    home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z',
    layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    calendar: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5M16 12h.01',
    badge: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M8.3 13.9 6.4 22l5.6-3 5.6 3-1.9-8.1',
    camera: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5l1.8-3h5.4l1.8 3H20a2 2 0 0 1 2 2zM12 17.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    play: 'M2.6 6.6a3 3 0 0 1 3-3h12.8a3 3 0 0 1 3 3v10.8a3 3 0 0 1-3 3H5.6a3 3 0 0 1-3-3zM10 8.9l5.2 3.1-5.2 3.1z',
    chart: 'M3 3v18h18M7 15l4-5 3 3 5-7',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.7H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10.3 3V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z',
    plus: 'M12 5v14M5 12h14',
    back: 'M19 12H5M12 19l-7-7 7-7',
    right: 'M5 12h14M12 5l7 7-7 7',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3.5 2',
    link: 'M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.2 4.7M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.8-1.8',
    money: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    down: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
    trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
    alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    history: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2',
    chat: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z',
    task: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
    bot: 'M12 8V4H8M4 8h16v12H4zM2 14h2M20 14h2M9 13v2M15 13v2',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12'
  };
  function icon(name, cls) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', cls || 'ico');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[name] || ICONS.home);
    svg.appendChild(p);
    return svg;
  }

  /* ---------- Xabarlar ---------- */
  function toast(msg, kind) {
    var t = h('div', { class: 'toast ' + (kind || '') }, msg);
    document.getElementById('toasts').appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s'; t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 260);
    }, kind === 'bad' ? 4200 : 2600);
  }

  /* ---------- Modal ---------- */
  var modalStack = [];
  function modal(opts) {
    var body = h('div', { class: 'm-body' });
    (Array.isArray(opts.body) ? opts.body : [opts.body]).forEach(function (n) { if (n) body.appendChild(n); });
    var foot = h('div', { class: 'm-foot' });
    var back = h('div', { class: 'modal-back' });
    var dirty = false, closing = false;
    function markClean() { dirty = false; }
    function reallyClose() {
      back.remove();
      modalStack = modalStack.filter(function (m) { return m !== back; });
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    }
    /** Saqlanmagan ma'lumot bo'lsa ogohlantiramiz */
    function close(force) {
      if (!dirty || force === true || closing) return reallyClose();
      closing = true;
      confirm('Saqlanmagan ma’lumot bor',
        'Kiritganlaringiz saqlanmaydi. Baribir yopilsinmi?', 'Ha, yopilsin', true)
        .then(function (yes) {
          closing = false;
          if (yes) reallyClose();
        });
    }
    close.clean = markClean;
    function onKey(e) {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === back) { e.preventDefault(); close(); }
    }
    (opts.actions || []).forEach(function (a) {
      if (!a) return;
      var b = h('button', { class: 'btn ' + (a.cls || ''), type: 'button' }, a.label);
      b.addEventListener('click', function () {
        // "Saqlash" bosilganda ogohlantirish kerak emas
        var closeFn = function (force) { markClean(); close(force === undefined ? true : force); };
        if (a.onClick) a.onClick(closeFn, b);
        else close();
      });
      foot.appendChild(b);
    });
    var box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' }, [
      h('div', { class: 'm-head' }, [
        h('h2', {}, opts.title || ''),
        h('button', { class: 'x-btn', type: 'button', 'aria-label': 'Yopish', onclick: close }, [
          (function () {
            var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '18'); s.setAttribute('height', '18');
            s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
            var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.setAttribute('d', 'M18 6 6 18M6 6l12 12'); s.appendChild(p); return s;
          })()
        ])
      ]),
      body,
      (opts.actions && opts.actions.length) ? foot : null
    ]);
    back.appendChild(box);
    back.addEventListener('mousedown', function (e) { if (e.target === back && opts.dismissable !== false) close(); });
    // kiritilgan ma'lumotni kuzatamiz
    body.addEventListener('input', function () { dirty = true; });
    body.addEventListener('change', function () { dirty = true; });
    document.getElementById('modal-root').appendChild(back);
    modalStack.push(back);
    document.addEventListener('keydown', onKey);
    setTimeout(function () {
      var f = box.querySelector('input,select,textarea,button.primary');
      if (f) try { f.focus(); } catch (e) { }
    }, 30);
    back.__isDirty = function () { return dirty; };
    return { close: close, body: body, box: box, markClean: markClean };
  }

  /** Matnni nusxalash (brauzer ruxsat bermasa — tanlab qo'yamiz) */
  function copy(text) {
    var t = String(text == null ? '' : text);
    function done() { toast('Nusxalandi: ' + t, 'ok'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done, fallback);
    } else { fallback(); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        done();
      } catch (e) { toast('Nusxalanmadi. Kod: ' + t, 'info'); }
    }
  }

  function confirm(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      /* Javob bir marta beriladi.
         Ilgari: tugma bosilganda avval oyna yopilar, yopilish esa onClose orqali
         "yo'q" deb javob berardi — shuning uchun "Ha, yopilsin" ishlamasdi va
         forma oynasi ochiq qolib ketardi. */
      var answered = false;
      function answer(v) {
        if (answered) return;
        answered = true;
        resolve(v);
      }
      var m = modal({
        title: title,
        body: h('p', { style: 'margin:0;font-size:14px' }, text),
        actions: [
          { label: 'Bekor qilish', onClick: function (c) { answer(false); c(); } },
          {
            label: okLabel || 'Tasdiqlash', cls: danger ? 'danger' : 'primary',
            onClick: function (c) { answer(true); c(); }
          }
        ],
        onClose: function () { answer(false); }
      });
      void m;
    });
  }

  function askReason(title, label) {
    return new Promise(function (resolve) {
      var f = field({ label: label || 'Sabab', required: true, id: 'reason-' + Date.now() });
      var err = h('div', { class: 'err-msg', hidden: true }, 'Sababni yozing.');
      f.wrap.appendChild(err);
      var done = false;
      modal({
        title: title,
        body: f.wrap,
        actions: [
          { label: 'Bekor qilish', onClick: function (c) { c(); } },
          {
            label: 'Tasdiqlash', cls: 'primary', onClick: function (c) {
              var v = f.input.value.trim();
              if (!v) { err.hidden = false; f.wrap.classList.add('err'); return; }
              done = true; c(); resolve(v);
            }
          }
        ],
        onClose: function () { if (!done) resolve(null); }
      });
    });
  }

  /* ---------- Shakl maydonlari ---------- */
  var fieldSeq = 0;
  function field(o) {
    o = o || {};
    var id = o.id || ('f' + (++fieldSeq));
    var input;
    if (o.type === 'select') {
      input = h('select', { id: id });
      (o.options || []).forEach(function (op) {
        input.appendChild(h('option', { value: op.value }, op.label));
      });
      if (o.value != null && String(o.value) !== '') input.value = String(o.value);
      // qiymat ro'yxatda bo'lmasa yoki berilmagan bo'lsa — birinchi variant tanlanadi
      if ((input.selectedIndex < 0) && input.options.length) input.selectedIndex = 0;
    } else if (o.type === 'textarea') {
      input = h('textarea', { id: id, rows: o.rows || 3 });
      input.value = o.value == null ? '' : o.value;
    } else if (o.type === 'time' || o.type === 'month') {
      input = h('input', { id: id, type: o.type, class: 'dp-native' });
      input.value = o.value == null ? '' : o.value;
      if (o.min != null) input.setAttribute('min', o.min);
      if (o.max != null) input.setAttribute('max', o.max);
    } else if (o.type === 'date') {
      // O'z taqvimimiz: brauzernikidan farqli — mavzuga mos, o'zbekcha (yoki tanlangan tilda)
      input = h('input', { id: id, type: 'date', class: 'dp-native' });
      input.value = o.value == null ? '' : o.value;
      if (o.min != null) input.setAttribute('min', o.min);
      if (o.max != null) input.setAttribute('max', o.max);
    } else {
      input = h('input', { id: id, type: o.type || 'text' });
      if (o.type === 'number') { input.setAttribute('inputmode', 'numeric'); input.setAttribute('step', o.step || '1'); }
      if (o.placeholder) input.setAttribute('placeholder', o.placeholder);
      if (o.min != null) input.setAttribute('min', o.min);
      if (o.max != null) input.setAttribute('max', o.max);
      if (o.autocomplete) input.setAttribute('autocomplete', o.autocomplete);
      input.value = o.value == null ? '' : o.value;
    }
    if (o.disabled) input.disabled = true;
    if (o.required) input.setAttribute('aria-required', 'true');
    if (o.oninput) input.addEventListener('input', o.oninput);
    if (o.onchange) input.addEventListener('change', o.onchange);
    var control = (o.type === 'date' || o.type === 'time' || o.type === 'month')
      ? pickerControl(o.type, input, o) : input;
    var wrap = h('div', { class: 'field' + (o.full ? ' full' : '') }, [
      o.label ? h('label', { for: id }, [o.label, o.required ? h('span', { class: 'req' }, ' *') : null]) : null,
      control,
      o.help ? h('div', { class: 'help' }, o.help) : null
    ]);
    return { wrap: wrap, input: input, id: id, name: o.name || id };
  }


  /* ================= TAQVIM (sana tanlash) =================
     Brauzerning o'z oynasi o'rniga — ilova mavzusiga mos, tanlangan tildagi taqvim.
     Qiymat oddiy <input type="date"> ichida (YYYY-MM-DD) saqlanadi:
     shuning uchun boshqa kod hech nima o'zgartirmasdan ishlayveradi.        */

  var dpOpen = null;

  function dpFormat(iso) {
    if (!iso) return '';
    return A.dateLabel(iso);
  }

  function fmtValue(kind, v, o) {
    if (!v) return '';
    if (kind === 'date') return A.dateLabel(v);
    if (kind === 'month') return A.monthLabel(v);
    return v;                                     // vaqt: 09:00
  }
  function emptyLabel(kind, o) {
    if (o && o.placeholder) return o.placeholder;
    if (kind === 'date') return 'Sanani tanlang';
    if (kind === 'month') return 'Oyni tanlang';
    return 'Vaqtni tanlang';
  }
  function pickIcon(kind) { return icon(kind === 'time' ? 'history' : 'calendar'); }

  /** Sana / vaqt / oy tanlash tugmasi va ochiladigan oyna */
  function pickerControl(kind, input, o) {
    o = o || {};
    var btn = h('button', {
      type: 'button', class: 'dp-btn dp-' + kind,
      'aria-haspopup': 'dialog',
      onclick: function (e) { e.preventDefault(); open(); }
    }, [
      h('span', { class: 'dp-text' }, fmtValue(kind, input.value, o) || emptyLabel(kind, o)),
      pickIcon(kind)
    ]);
    if (!input.value) btn.classList.add('empty');
    if (o.disabled) btn.disabled = true;

    var box = h('div', { class: 'dp-wrap' }, [input, btn]);

    function sync() {
      var t = btn.querySelector('.dp-text');
      t.textContent = fmtValue(kind, input.value, o) || emptyLabel(kind, o);
      btn.classList.toggle('empty', !input.value);
    }
    input.addEventListener('change', sync);
    input.addEventListener('input', sync);
    input.addEventListener('focus', function () { btn.focus(); });

    function set(v) {
      input.value = v || '';
      sync();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function open() {
      if (dpOpen) dpOpen();
      var pop = h('div', { class: 'dp-pop dp-pop-' + kind, role: 'dialog', 'aria-label': emptyLabel(kind, o) });
      var body = h('div', { class: 'dp-body' });
      pop.appendChild(body);

      if (kind === 'date') buildDate(body, input, set, close);
      else if (kind === 'month') buildMonth(body, input, set, close);
      else buildTime(body, input, set, close, o);

      document.body.appendChild(pop);
      place();
      function place() {
        var r = btn.getBoundingClientRect();
        var w = pop.offsetWidth || 300, hgt = pop.offsetHeight || 320;
        var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
        var top = r.bottom + 6;
        if (top + hgt > window.innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
      }
      function onDoc(e) { if (!pop.contains(e.target) && e.target !== btn) close(); }
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }
      function close() {
        document.removeEventListener('mousedown', onDoc, true);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
        pop.remove();
        dpOpen = null;
        try { btn.focus(); } catch (e) { }
      }
      setTimeout(function () {
        document.addEventListener('mousedown', onDoc, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
      }, 0);
      dpOpen = close;
      var f = pop.querySelector('.sel') || pop.querySelector('.today') || pop.querySelector('button:not(.dp-nav)');
      if (f) try { f.focus(); } catch (e) { }
    }

    return box;
  }

  function isoToDots(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : '';
  }
  /** "19.09.2026", "19/9/26", "1992026" — ISO sanaga aylantiradi */
  function parseDots(text) {
    var t = String(text || '').trim().replace(/[\/\s-]/g, '.');
    var m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (!m) {
      var digits = t.replace(/\D/g, '');
      if (digits.length === 8) m = [null, digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)];
      else return null;
    }
    var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    if (y < 100) y += 2000;
    if (!(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31) || y < 1900 || y > 2200) return null;
    var iso = y + '-' + A.pad(mo) + '-' + A.pad(d);
    if (d > A.daysInMonth(y + '-' + A.pad(mo))) return null;
    return iso;
  }

  /* ---------- Taqvim ---------- */
  function buildDate(root, input, set, close) {
    var min = input.getAttribute('min') || '';
    var max = input.getAttribute('max') || '';
    var view = (input.value || A.today()).slice(0, 7);
    var head = h('div', { class: 'dp-head' });
    var grid = h('div', { class: 'dp-grid' });
    // Qo'lda yozish: 19.09.2026 yoki 19/9/26
    var typed = h('input', {
      class: 'dp-input', type: 'text', inputmode: 'numeric', maxlength: '10',
      'aria-label': 'Sanani yozing', placeholder: 'kk.oo.yyyy',
      value: input.value ? isoToDots(input.value) : ''
    });
    typed.addEventListener('input', function () {
      var iso = parseDots(typed.value);
      typed.classList.toggle('bad', typed.value.length >= 8 && !iso);
      if (!iso) return;
      view = iso.slice(0, 7);
      paint();
    });
    typed.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var iso = parseDots(typed.value);
      if (iso && !(min && iso < min) && !(max && iso > max)) { set(iso); close(); }
      else typed.classList.add('bad');
    });
    root.appendChild(typed);
    root.appendChild(head); root.appendChild(grid);
    root.appendChild(h('div', { class: 'dp-foot' }, [
      h('button', { type: 'button', class: 'btn sm', onclick: function () { set(A.today()); close(); } }, 'Bugun'),
      h('button', { type: 'button', class: 'btn sm ghost', onclick: function () { set(''); close(); } }, 'Tozalash')
    ]));

    function paint() {
      clear(head); clear(grid);
      var y = Number(view.slice(0, 4)), m = Number(view.slice(5, 7));
      head.appendChild(h('button', {
        type: 'button', class: 'dp-nav', 'aria-label': 'Oldingi oy',
        onclick: function () { view = A.addMonths(view, -1); paint(); }
      }, '‹'));
      head.appendChild(h('div', { class: 'dp-title' }, [
        h('b', {}, A.MONTHS[m - 1] || ''), h('span', {}, ' ' + y)
      ]));
      head.appendChild(h('button', {
        type: 'button', class: 'dp-nav', 'aria-label': 'Keyingi oy',
        onclick: function () { view = A.addMonths(view, 1); paint(); }
      }, '›'));

      var wk = h('div', { class: 'dp-week' });
      A.WEEKDAYS_SHORT.forEach(function (d) { wk.appendChild(h('span', {}, d)); });
      grid.appendChild(wk);

      var days = h('div', { class: 'dp-days' });
      var lead = A.weekdayOf(view + '-01') - 1;
      for (var i = 0; i < lead; i++) days.appendChild(h('span', { class: 'dp-empty' }));
      var n = A.daysInMonth(view);
      for (var d = 1; d <= n; d++) {
        (function (d) {
          var iso = view + '-' + A.pad(d);
          var off = (min && iso < min) || (max && iso > max);
          var cls = 'dp-day';
          if (iso === input.value) cls += ' sel';
          if (iso === A.today()) cls += ' today';
          if (A.weekdayOf(iso) === 7) cls += ' rest';
          days.appendChild(h('button', {
            type: 'button', class: cls, disabled: off ? 'disabled' : null,
            onclick: function () { set(iso); close(); }
          }, String(d)));
        })(d);
      }
      grid.appendChild(days);
    }
    paint();
  }

  /* ---------- Oy tanlash ---------- */
  function buildMonth(root, input, set, close) {
    var year = Number((input.value || A.thisMonth()).slice(0, 4));
    var head = h('div', { class: 'dp-head' });
    var grid = h('div', { class: 'dp-months' });
    root.appendChild(head); root.appendChild(grid);
    root.appendChild(h('div', { class: 'dp-foot' }, [
      h('button', { type: 'button', class: 'btn sm', onclick: function () { set(A.thisMonth()); close(); } }, 'Shu oy'),
      h('button', { type: 'button', class: 'btn sm ghost', onclick: function () { set(''); close(); } }, 'Tozalash')
    ]));
    function paint() {
      clear(head); clear(grid);
      head.appendChild(h('button', { type: 'button', class: 'dp-nav', 'aria-label': 'Oldingi yil', onclick: function () { year--; paint(); } }, '‹'));
      head.appendChild(h('div', { class: 'dp-title' }, h('b', {}, String(year))));
      head.appendChild(h('button', { type: 'button', class: 'dp-nav', 'aria-label': 'Keyingi yil', onclick: function () { year++; paint(); } }, '›'));
      A.MONTHS.forEach(function (name, i) {
        var ym = year + '-' + A.pad(i + 1);
        var cls = 'dp-month';
        if (ym === input.value) cls += ' sel';
        if (ym === A.thisMonth()) cls += ' today';
        grid.appendChild(h('button', {
          type: 'button', class: cls, onclick: function () { set(ym); close(); }
        }, name));
      });
    }
    paint();
  }

  /** "9:30", "0930", "9.30", "930" — hammasi 09:30 ga aylanadi */
  function parseTime(text) {
    var t = String(text || '').trim().replace(/[.,\s]/g, ':');
    var m = t.match(/^(\d{1,2}):?(\d{0,2})$/);
    if (!m) return null;
    var hrs = Number(m[1]);
    var min = m[2] === '' ? 0 : Number(m[2]);
    if (m[2].length === 1) min = Number(m[2]) * 10;
    if (!(hrs >= 0 && hrs <= 23) || !(min >= 0 && min <= 59)) return null;
    return A.pad(hrs) + ':' + A.pad(min);
  }

  /* ---------- Vaqt tanlash ---------- */
  function buildTime(root, input, set, close, o) {
    var cur = /^\d{2}:\d{2}$/.test(input.value) ? input.value : '09:00';
    var hh = cur.slice(0, 2), mm = cur.slice(3, 5);

    // Qo'lda yozish ham mumkin: 9:30, 0930, 09:30 — hammasi tushuniladi
    var typed = h('input', {
      class: 'tp-input', type: 'text', inputmode: 'numeric', maxlength: '5',
      'aria-label': 'Vaqtni yozing', value: hh + ':' + mm, placeholder: 'SS:DD'
    });
    typed.addEventListener('input', function () {
      var v = parseTime(typed.value);
      if (!v) return;
      hh = v.slice(0, 2); mm = v.slice(3, 5);
      paintHours(); paintMins();
    });
    typed.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var v = parseTime(typed.value);
      if (v) { set(v); close(); }
      else typed.classList.add('bad');
    });
    typed.addEventListener('blur', function () { typed.value = hh + ':' + mm; typed.classList.remove('bad'); });

    var head = h('div', { class: 'dp-head time' }, [typed]);
    var cols = h('div', { class: 'tp-cols' });
    var hourCol = h('div', { class: 'tp-col' });
    var minCol = h('div', { class: 'tp-col' });
    cols.appendChild(h('div', { class: 'tp-colwrap' }, [h('span', { class: 'tp-lab' }, 'Soat'), hourCol]));
    cols.appendChild(h('div', { class: 'tp-colwrap' }, [h('span', { class: 'tp-lab' }, 'Daqiqa'), minCol]));
    root.appendChild(head); root.appendChild(cols);
    root.appendChild(h('div', { class: 'dp-foot' }, [
      h('button', {
        type: 'button', class: 'btn sm primary', onclick: function () {
          var v = parseTime(typed.value) || (hh + ':' + mm);
          set(v); close();
        }
      }, 'Tanlash'),
      h('button', { type: 'button', class: 'btn sm ghost', onclick: function () { set(''); close(); } }, 'Tozalash')
    ]));

    function show() { if (document.activeElement !== typed) typed.value = hh + ':' + mm; }
    function paintHours() {
      clear(hourCol);
      for (var i = 0; i < 24; i++) {
        (function (i) {
          var v = A.pad(i);
          hourCol.appendChild(h('button', {
            type: 'button', class: 'tp-item' + (v === hh ? ' sel' : ''),
            onclick: function () { hh = v; paintHours(); show(); }
          }, v));
        })(i);
      }
      var sel = hourCol.querySelector('.sel');
      if (sel) hourCol.scrollTop = Math.max(0, sel.offsetTop - 60);
    }
    function paintMins() {
      clear(minCol);
      [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].forEach(function (i) {
        var v = A.pad(i);
        minCol.appendChild(h('button', {
          type: 'button', class: 'tp-item' + (v === mm ? ' sel' : ''),
          onclick: function () { mm = v; paintMins(); show(); }
        }, v));
      });
      if (['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].indexOf(mm) < 0) {
        minCol.appendChild(h('button', { type: 'button', class: 'tp-item sel' }, mm));
      }
      var sel = minCol.querySelector('.sel');
      if (sel) minCol.scrollTop = Math.max(0, sel.offsetTop - 60);
    }
    paintHours(); paintMins(); show();
    void o;
  }

  /** Oddiy shakl: maydonlar ro'yxatidan tugun va qiymatlar */
  function form(defs) {
    var grid = h('div', { class: 'form-grid' });
    var fields = {};
    defs.forEach(function (d) {
      if (d.node) { grid.appendChild(d.node); return; }
      var f = field(d);
      fields[d.name] = { f: f, def: d };
      grid.appendChild(f.wrap);
    });
    function values() {
      var v = {};
      Object.keys(fields).forEach(function (k) {
        var it = fields[k];
        var raw = it.f.input.value;
        if (it.def.type === 'number') v[k] = A.parseSom(raw);
        else v[k] = typeof raw === 'string' ? raw.trim() : raw;
      });
      return v;
    }
    function validate() {
      var ok = true;
      Object.keys(fields).forEach(function (k) {
        var it = fields[k];
        it.f.wrap.classList.remove('err');
        var old = it.f.wrap.querySelector('.err-msg');
        if (old) old.remove();
        var val = it.f.input.value;
        var msg = null;
        if (it.def.required && !String(val).trim()) msg = 'Bu maydon to’ldirilishi kerak.';
        else if (it.def.validate) msg = it.def.validate(val, values());
        if (msg) {
          ok = false;
          it.f.wrap.classList.add('err');
          it.f.wrap.appendChild(h('div', { class: 'err-msg' }, msg));
        }
      });
      return ok;
    }
    function get(name) { return fields[name] && fields[name].f; }
    return { node: grid, values: values, validate: validate, get: get, fields: fields };
  }

  /* ---------- Bir marta bosiladigan tugma ---------- */
  function busy(btn, fn) {
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    var old = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saqlanmoqda…';
    Promise.resolve()
      .then(fn)
      .catch(function (e) {
        console.error(e);
        toast(e && e.message ? e.message : 'Xatolik yuz berdi.', 'bad');
      })
      .then(function () {
        btn.dataset.busy = '0';
        btn.disabled = false;
        btn.textContent = old;
      });
  }

  /* ---------- Jadval ---------- */
  /** cols: [{key, label, right, cls, render(row)}] */
  /**
   * Jadval. Ro'yxat katta bo'lsa (opts.page) — bo'lib chiziladi:
   * birinchi N ta qator ko'rinadi, qolganini "Yana ko'rsatish" bilan qo'shamiz.
   * Shunda 5000 ta o'quvchi bo'lsa ham sahifa tez ochiladi.
   */
  function table(cols, rows, opts) {
    opts = opts || {};
    var pageSize = opts.page || 0;
    var thead = h('thead', {}, h('tr', {}, cols.map(function (c) {
      return h('th', { class: c.right ? 'r' : '' }, c.label);
    })));
    var tbody = h('tbody');
    var shown = pageSize && rows.length > pageSize ? rows.slice(0, pageSize) : rows;
    var rest = rows.length - shown.length;
    shown.forEach(function (r, i) {
      var tr = h('tr', opts.onRow ? { class: 'row-link', tabindex: '0' } : {});
      cols.forEach(function (c) {
        var cell = c.render ? c.render(r, i) : (r[c.key] == null ? '—' : String(r[c.key]));
        var td = h('td', { class: (c.right ? 'r ' : '') + (c.cls || '') },
          typeof cell === 'string' || typeof cell === 'number' ? String(cell) : cell);
        if (c.label) td.setAttribute('data-label', c.label);
        tr.appendChild(td);
      });
      if (opts.onRow) {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('button,a,input,select')) return;
          opts.onRow(r);
        });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); opts.onRow(r); }
        });
      }
      tbody.appendChild(tr);
    });

    var wrap = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, [thead, tbody]));
    if (!rest) return wrap;

    var more = h('div', { class: 'tbl-more' }, [
      h('span', { class: 'small muted' }, shown.length + ' / ' + rows.length + ' ta ko’rsatilmoqda'),
      h('button', {
        class: 'btn', type: 'button',
        onclick: function (e) {
          var btn = e.currentTarget;
          var from = tbody.children.length;
          var next = rows.slice(from, from + pageSize);
          next.forEach(function (r, i) { tbody.appendChild(buildRow(r, from + i)); });
          var left = rows.length - tbody.children.length;
          more.querySelector('span').textContent = tbody.children.length + ' / ' + rows.length + ' ta ko’rsatilmoqda';
          if (left <= 0) more.remove();
          else btn.textContent = 'Yana ' + Math.min(pageSize, left) + ' ta ko’rsatish';
        }
      }, 'Yana ' + Math.min(pageSize, rest) + ' ta ko’rsatish')
    ]);

    function buildRow(r, i) {
      var tr = h('tr', opts.onRow ? { class: 'row-link', tabindex: '0' } : {});
      cols.forEach(function (c) {
        var cell = c.render ? c.render(r, i) : (r[c.key] == null ? '—' : String(r[c.key]));
        var td = h('td', { class: (c.right ? 'r ' : '') + (c.cls || '') },
          typeof cell === 'string' || typeof cell === 'number' ? String(cell) : cell);
        if (c.label) td.setAttribute('data-label', c.label);
        tr.appendChild(td);
      });
      if (opts.onRow) {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('button,a,input,select')) return;
          opts.onRow(r);
        });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); opts.onRow(r); }
        });
      }
      return tr;
    }

    return h('div', {}, [wrap, more]);
  }

  function empty(o) {
    return h('div', { class: 'empty' }, [
      h('h3', {}, o.title),
      h('p', {}, o.text || ''),
      o.action ? h('button', { class: 'btn primary', type: 'button', onclick: o.action.onClick }, o.action.label) : null
    ]);
  }

  function pill(text, cls) {
    return h('span', { class: 'pill ' + (cls || 'mute') }, [h('i', { class: 'dot' }), text]);
  }

  function tile(o) {
    var t = h('button', {
      class: 'tile' + (o.cls ? ' ' + o.cls : ''), type: 'button',
      dataset: o.onClick ? { clickable: '1' } : {},
      onclick: o.onClick || null
    }, [
      h('span', { class: 'lbl' }, o.label),
      h('span', { class: 'val' }, o.value),
      o.hint ? h('span', { class: 'hint' }, o.hint) : null
    ]);
    if (!o.onClick) t.setAttribute('tabindex', '-1');
    return t;
  }

  function pageHead(title, sub, actions) {
    return h('div', { class: 'page-head' }, [
      h('div', { class: 't' }, [h('h1', {}, title), sub ? h('p', {}, sub) : null]),
      h('div', { class: 'page-actions' }, (actions || []).filter(Boolean))
    ]);
  }

  function card(title, bodyNodes, headActions, tight) {
    return h('section', { class: 'card' }, [
      title ? h('div', { class: 'card-head' }, [h('h2', {}, title)].concat(headActions || [])) : null,
      h('div', { class: 'card-body' + (tight ? ' tight' : '') }, bodyNodes)
    ]);
  }

  function tabs(items, active, onPick) {
    return h('div', { class: 'tabs', role: 'tablist' }, items.map(function (it) {
      return h('button', {
        type: 'button', role: 'tab', 'aria-selected': it.id === active ? 'true' : 'false',
        onclick: function () { onPick(it.id); }
      }, it.label);
    }));
  }

  function avatar(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    var s = (parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '');
    return h('div', { class: 'avatar' }, s.toUpperCase());
  }

  /* ---------- Tezkor qidiruv (takliflar) ---------- */
  /**
   * input — matn maydoni; provider(q) -> [{group, title, sub, onPick}]
   * Har harf kiritilganda ro'yxat yangilanadi; strelka va Enter ishlaydi.
   */
  function suggest(input, provider, opts) {
    opts = opts || {};
    var wrap = input.closest('.sg-wrap');
    if (!wrap) {
      wrap = h('div', { class: 'sg-wrap' });
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    var box = h('div', { class: 'sg-box', role: 'listbox' });
    wrap.appendChild(box);
    var items = [], active = -1, timer = null;

    function close() { UI_clear(box); items = []; active = -1; }
    function UI_clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

    function mark(text, q) {
      var s = String(text == null ? '' : text);
      if (!q) return document.createTextNode(s);
      var i = s.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return document.createTextNode(s);
      var frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode(s.slice(0, i)));
      frag.appendChild(h('mark', {}, s.slice(i, i + q.length)));
      frag.appendChild(document.createTextNode(s.slice(i + q.length)));
      return frag;
    }

    function paint(q) {
      UI_clear(box);
      items = []; active = -1;
      var res = provider(q) || [];
      if (!res.length) {
        if (q && q.length >= (opts.min || 1)) {
          box.appendChild(h('div', { class: 'sg-empty' }, opts.emptyText || 'Hech narsa topilmadi'));
        }
        return;
      }
      var lastGroup = null;
      res.slice(0, opts.limit || 24).forEach(function (r) {
        if (r.group && r.group !== lastGroup) {
          box.appendChild(h('div', { class: 'sg-group' }, r.group));
          lastGroup = r.group;
        }
        var b = h('button', { type: 'button', class: 'sg-item', role: 'option' }, [
          r.icon || null,
          h('div', { class: 'sg-main' }, [
            (function () { var el = h('b'); el.appendChild(mark(r.title, q)); return el; })(),
            r.sub ? (function () { var el = h('span'); el.appendChild(mark(r.sub, q)); return el; })() : null
          ]),
          r.badge || null
        ]);
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () { close(); r.onPick(); });
        items.push(b);
        box.appendChild(b);
      });
    }

    function setActive(i) {
      if (active >= 0 && items[active]) items[active].setAttribute('aria-selected', 'false');
      active = i;
      if (active >= 0 && items[active]) {
        items[active].setAttribute('aria-selected', 'true');
        items[active].scrollIntoView({ block: 'nearest' });
      }
    }

    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      timer = setTimeout(function () { paint(q); }, 90);
      if (opts.onType) opts.onType(q);
    });
    input.addEventListener('focus', function () {
      if (input.value.trim() || opts.showOnFocus) paint(input.value.trim());
    });
    input.addEventListener('blur', function () { setTimeout(close, 140); });
    input.addEventListener('keydown', function (e) {
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); items[active].click(); }
      else if (e.key === 'Escape') { close(); }
    });
    return { close: close, refresh: function () { paint(input.value.trim()); } };
  }

  /* ---------- Eksport ---------- */
  /** Formula sifatida bajarilib ketmasin: =, +, -, @ bilan boshlangan matn */
  function safeCell(v) {
    if (v == null) return '';
    if (typeof v === 'number') return v;
    var s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) return '’' + s;   // oldiga apostrof
    return s;
  }
  function inArtifactSandbox() {
    return !!(global.claude && typeof global.claude.use === 'function');
  }
  /** Faylni brauzerda saqlash (oddiy kompyuter va telefon uchun) */
  function saveBlob(blob, filename) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 3000);
      return true;
    } catch (e) { return false; }
  }

  function rowsToCsv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) {
        var s = safeCell(c);
        s = (s == null ? '' : String(s));
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
  }

  /**
   * Jadvalni faylga chiqarish.
   * format: 'xlsx' (standart, SheetJS bo'lsa) yoki 'csv'.
   */
  function buildXlsx(clean) {
    // 1) O'zimizning kutubxonaga bog'liq bo'lmagan yozuvchimiz
    if (global.XlsxLite) return global.XlsxLite.build(clean, 'AlBayan Cairo');
    // 2) SheetJS bo'lsa (ixtiyoriy)
    if (global.XLSX) {
      var ws = global.XLSX.utils.aoa_to_sheet(clean);
      var widths = [];
      clean.forEach(function (r) {
        r.forEach(function (c, i) {
          var len = String(c == null ? '' : c).length;
          widths[i] = Math.min(42, Math.max(widths[i] || 10, len + 2));
        });
      });
      ws['!cols'] = widths.map(function (w) { return { wch: w }; });
      var wb = global.XLSX.utils.book_new();
      global.XLSX.utils.book_append_sheet(wb, ws, 'AlBayan Cairo');
      return global.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    }
    return null;
  }

  async function exportRows(baseName, rows, format) {
    var name = String(baseName || 'albyana').replace(/\.(csv|xlsx|xls)$/i, '');
    var wantXlsx = format !== 'csv' && !!(global.XlsxLite || global.XLSX);
    var clean = rows.map(function (r) { return r.map(safeCell); });

    if (wantXlsx) {
      try {
        var buf = buildXlsx(clean);
        if (!buf) throw new Error('xlsx yozuvchi topilmadi');
        var blob = new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        if (!inArtifactSandbox() && saveBlob(blob, name + '.xlsx')) {
          toast('Fayl yuklab olindi: ' + name + '.xlsx', 'ok');
          return;
        }
        // Claude muhitida yuklab olish xizmati orqali
        var dl = null;
        try { dl = await global.claude.use('downloads'); } catch (e) { dl = null; }
        if (dl) {
          var b64 = await blobToBase64(blob);
          try {
            await dl.save({ filename: name + '.xlsx', data: b64, encoding: 'base64' });
            toast('Fayl yuklab olindi: ' + name + '.xlsx', 'ok');
            return;
          } catch (e) { /* pastdagi CSV yo'li */ }
        }
      } catch (e) { console.error('xlsx', e); }
    }

    // CSV yo'li
    var data = rowsToCsv(clean);
    if (!inArtifactSandbox() && saveBlob(new Blob([data], { type: 'text/csv;charset=utf-8' }), name + '.csv')) {
      toast('Fayl yuklab olindi: ' + name + '.csv', 'ok');
      return;
    }
    var dl2 = null;
    try { if (global.claude && global.claude.use) dl2 = await global.claude.use('downloads'); } catch (e) { dl2 = null; }
    if (dl2) {
      try {
        await dl2.save({ filename: name + '.csv', data: data });
        toast('Fayl yuklab olindi: ' + name + '.csv', 'ok');
        return;
      } catch (e) { /* oxirgi chora */ }
    }
    showCopyFallback(data);
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  function showCopyFallback(data) {
    var ta = h('textarea', { style: 'width:100%;min-height:220px;font-family:var(--mono);font-size:12px' });
    ta.value = data;
    modal({
      title: 'Ma’lumotni nusxalang',
      wide: true,
      body: [
        h('p', { class: 'muted small', style: 'margin:0' },
          'Fayl saqlash bu yerda mavjud emas. Quyidagi matnni nusxalab, Excel’ga qo’ying (Ma’lumot → Matndan ustunlarga, ajratgich: nuqtali vergul).'),
        ta
      ],
      actions: [{
        label: 'Nusxalash', cls: 'primary', onClick: function (c) {
          ta.select();
          try { document.execCommand('copy'); toast('Nusxalandi.', 'ok'); } catch (e) { }
          c();
        }
      }]
    });
  }

  var exportCsv = exportRows;   // eski nom bilan moslik

  /** Matnli faylni saqlash (zaxira nusxa uchun) */
  async function saveText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    if (!inArtifactSandbox() && saveBlob(blob, filename)) {
      toast('Fayl yuklab olindi: ' + filename, 'ok');
      return true;
    }
    var dl = null;
    try { if (global.claude && global.claude.use) dl = await global.claude.use('downloads'); } catch (e) { }
    if (dl) {
      try { await dl.save({ filename: filename, data: text }); toast('Fayl yuklab olindi.', 'ok'); return true; }
      catch (e) { }
    }
    showCopyFallback(text);
    return false;
  }

  /* ================= BOG'LANISH TUGMALARI =================
     Raqamni qo'lda terish shart emas: bosilsa telefon o'zi teradi.
     Kompyuterda ham ishlaydi (FaceTime/Telefon ilovasi ochiladi), shuning
     uchun ish stolida ham "nusxa olish" tugmasi yonida turadi.          */

  /** "tel:" manzili. Raqam bo'sh yoki noto'g'ri bo'lsa — bo'sh qaytadi. */
  function telHref(p) {
    var n = (global.A && global.A.normPhone) ? global.A.normPhone(p) : String(p || '');
    var d = String(n || '').replace(/[^+0-9]/g, '');
    return d.replace(/\D/g, '').length >= 7 ? 'tel:' + d : '';
  }
  function smsHref(p) {
    var t = telHref(p);
    return t ? 'sms:' + t.slice(4) : '';
  }

  /** Jadvaldagi raqam: bosilsa qo'ng'iroq qiladi.
      Raqam yo'q bo'lsa — oddiy chiziqcha.                               */
  function phoneLink(p) {
    var href = telHref(p);
    if (!href) return h('span', { class: 'muted' }, '—');
    return h('a', {
      class: 'tel-link mono', href: href,
      title: 'Qo’ng’iroq qilish',
      onclick: function (e) { e.stopPropagation(); }
    }, [icon('phone'), h('span', {}, String(p))]);
  }

  /** Karta va oynalar uchun: Qo'ng'iroq · SMS · Nusxa.
      `small` — jadval ichidagi kichik ko'rinish.                        */
  function contactBtns(p, opts) {
    opts = opts || {};
    var href = telHref(p);
    if (!href) return null;
    var sz = opts.small ? ' sm' : '';
    var stop = function (e) { e.stopPropagation(); };
    var kids = [
      h('a', {
        class: 'btn' + sz + ' call-btn', href: href, onclick: stop,
        title: 'Qo’ng’iroq qilish'
      }, [icon('phone'), opts.small ? null : h('span', {}, 'Qo’ng’iroq')].filter(Boolean))
    ];
    if (!opts.small) {
      kids.push(h('a', {
        class: 'btn', href: smsHref(p), onclick: stop, title: 'SMS yozish'
      }, [icon('chat'), h('span', {}, 'SMS')]));
      kids.push(h('button', {
        class: 'btn', type: 'button',
        onclick: function (e) { stop(e); copy(String(p)); }
      }, [icon('link'), h('span', {}, 'Nusxa olish')]));
    }
    return h('div', { class: 'contact-btns rowflex' }, kids);
  }

  global.A.UI = {
    h: h, clear: clear, icon: icon, ICONS: ICONS, toast: toast, modal: modal, confirm: confirm,
    copy: copy, telHref: telHref, smsHref: smsHref,
    phoneLink: phoneLink, contactBtns: contactBtns,
    askReason: askReason, field: field, form: form, busy: busy, table: table, empty: empty,
    pill: pill, tile: tile, pageHead: pageHead, card: card, tabs: tabs, avatar: avatar,
    suggest: suggest, exportCsv: exportCsv, exportRows: exportRows, safeCell: safeCell, saveText: saveText,
    hasUnsaved: function () {
      return modalStack.some(function (m) { return m.__isDirty && m.__isDirty(); });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
