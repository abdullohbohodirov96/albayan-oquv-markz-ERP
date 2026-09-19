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
    home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z',
    layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    calendar: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5M16 12h.01',
    badge: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    chart: 'M3 3v18h18M7 15l4-5 3 3 5-7',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.7H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10.3 3V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z',
    plus: 'M12 5v14M5 12h14',
    back: 'M19 12H5M12 19l-7-7 7-7',
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
    function close() {
      back.remove();
      modalStack = modalStack.filter(function (m) { return m !== back; });
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === back) { e.preventDefault(); close(); }
    }
    (opts.actions || []).forEach(function (a) {
      if (!a) return;
      var b = h('button', { class: 'btn ' + (a.cls || ''), type: 'button' }, a.label);
      b.addEventListener('click', function () {
        if (a.onClick) a.onClick(close, b);
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
    document.getElementById('modal-root').appendChild(back);
    modalStack.push(back);
    document.addEventListener('keydown', onKey);
    setTimeout(function () {
      var f = box.querySelector('input,select,textarea,button.primary');
      if (f) try { f.focus(); } catch (e) { }
    }, 30);
    return { close: close, body: body, box: box };
  }

  function confirm(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var m = modal({
        title: title,
        body: h('p', { style: 'margin:0;font-size:14px' }, text),
        actions: [
          { label: 'Bekor qilish', onClick: function (c) { c(); resolve(false); } },
          { label: okLabel || 'Tasdiqlash', cls: danger ? 'danger' : 'primary', onClick: function (c) { c(); resolve(true); } }
        ],
        onClose: function () { resolve(false); }
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
    var wrap = h('div', { class: 'field' + (o.full ? ' full' : '') }, [
      o.label ? h('label', { for: id }, [o.label, o.required ? h('span', { class: 'req' }, ' *') : null]) : null,
      input,
      o.help ? h('div', { class: 'help' }, o.help) : null
    ]);
    return { wrap: wrap, input: input, id: id, name: o.name || id };
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
  function table(cols, rows, opts) {
    opts = opts || {};
    var thead = h('thead', {}, h('tr', {}, cols.map(function (c) {
      return h('th', { class: c.right ? 'r' : '' }, c.label);
    })));
    var tbody = h('tbody');
    rows.forEach(function (r, i) {
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
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, [thead, tbody]));
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
  async function exportCsv(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
    var data = '﻿' + csv;
    var dl = null;
    try { if (global.claude && global.claude.use) dl = await global.claude.use('downloads'); } catch (e) { dl = null; }
    if (dl) {
      try {
        await dl.save({ filename: filename, data: data });
        toast('Fayl yuklab olindi.', 'ok');
        return;
      } catch (e) { /* rad etildi yoki xato — pastdagi zaxira */ }
    }
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

  global.A.UI = {
    h: h, clear: clear, icon: icon, ICONS: ICONS, toast: toast, modal: modal, confirm: confirm,
    askReason: askReason, field: field, form: form, busy: busy, table: table, empty: empty,
    pill: pill, tile: tile, pageHead: pageHead, card: card, tabs: tabs, avatar: avatar,
    suggest: suggest, exportCsv: exportCsv
  };
})(typeof window !== 'undefined' ? window : globalThis);
