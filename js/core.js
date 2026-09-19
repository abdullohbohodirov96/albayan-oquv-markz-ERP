/* Albyana ERP — asos: yordamchi funksiyalar va ma'lumotlar qatlami */
(function (global) {
  'use strict';

  /* ---------------- Vaqt (Asia/Tashkent, UTC+5) ---------------- */
  var TZ_OFFSET_MIN = 300; // +05:00

  function tzNow() {
    var d = new Date();
    return new Date(d.getTime() + (TZ_OFFSET_MIN + d.getTimezoneOffset()) * 60000);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toISODate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return toISODate(tzNow()); }
  function nowStamp() {
    var d = tzNow();
    return toISODate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function ymOf(isoDate) { return isoDate.slice(0, 7); }
  function thisMonth() { return today().slice(0, 7); }
  function parseDate(iso) {
    var p = String(iso).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function addDays(iso, n) {
    var d = parseDate(iso); d.setDate(d.getDate() + n); return toISODate(d);
  }
  function addMonths(ym, n) {
    var p = ym.split('-'), y = Number(p[0]), m = Number(p[1]) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function daysInMonth(ym) {
    var p = ym.split('-');
    return new Date(Number(p[0]), Number(p[1]), 0).getDate();
  }
  function weekdayOf(iso) { // 1=Dushanba ... 7=Yakshanba
    var d = parseDate(iso).getDay();
    return d === 0 ? 7 : d;
  }
  var WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
  var WEEKDAYS_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
  var MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

  function monthLabel(ym) {
    var p = ym.split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }
  function dateLabel(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    if (p.length < 3) return iso;
    return p[2] + ' ' + MONTHS[Number(p[1]) - 1].toLowerCase() + ' ' + p[0];
  }
  function monthStart(ym) { return ym + '-01'; }
  function monthEnd(ym) { return ym + '-' + pad(daysInMonth(ym)); }

  /* ---------------- Pul (butun son, so'm) ---------------- */
  function som(n) {
    n = Math.round(Number(n) || 0);
    var neg = n < 0; n = Math.abs(n);
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '−' : '') + s;
  }
  function somFull(n) { return som(n) + ' so’m'; }
  function parseSom(str) {
    var v = String(str == null ? '' : str).replace(/[^0-9-]/g, '');
    if (v === '' || v === '-') return 0;
    return Math.round(Number(v));
  }

  /* ---------------- Boshqa ---------------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function normPhone(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length === 9) d = '998' + d;
    if (d.length === 12 && d.slice(0, 3) === '998') return '+' + d;
    return String(p || '').trim();
  }
  function phoneDigits(p) { return String(p || '').replace(/\D/g, '').slice(-9); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function byId(list) { var m = {}; (list || []).forEach(function (x) { m[x.id] = x; }); return m; }
  function sortBy(arr, key, dir) {
    var d = dir === 'desc' ? -1 : 1;
    return arr.slice().sort(function (a, b) {
      var x = typeof key === 'function' ? key(a) : a[key];
      var y = typeof key === 'function' ? key(b) : b[key];
      if (x == null) x = '';
      if (y == null) y = '';
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * d;
      return String(x).localeCompare(String(y), 'uz') * d;
    });
  }
  async function sha256(text) {
    if (global.crypto && global.crypto.subtle) {
      var buf = new TextEncoder().encode(text);
      var hash = await global.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(function (b) { return pad2hex(b); }).join('');
    }
    // zaxira: oddiy hash (faqat crypto mavjud bo'lmaganda)
    var h = 0;
    for (var i = 0; i < text.length; i++) { h = (h * 31 + text.charCodeAt(i)) | 0; }
    return 'fb' + (h >>> 0).toString(16);
  }
  function pad2hex(b) { return b < 16 ? '0' + b.toString(16) : b.toString(16); }

  /* ---------------- Ma'lumotlar qatlami ---------------- */
  var COLLECTIONS = ['users', 'staff', 'courses', 'rooms', 'students', 'groups', 'memberships', 'leads',
    'tasks', 'chats', 'botreq', 'botout'];
  var AUTH_COLLECTIONS = ['users'];
  var MONTHLY = ['invoices', 'payments', 'expenses', 'payroll', 'audit'];

  var Data = {
    mode: 'local',          // 'cloud' | 'local'
    ready: false,
    db: null,
    col: {},                // col[name] = {id: doc}
    docs: {},               // 'invoices/2026-09' -> doc
    settings: null,
    _queues: {},
    _listeners: [],

    onChange: function (fn) { this._listeners.push(fn); },
    _emit: function () {
      var l = this._listeners;
      for (var i = 0; i < l.length; i++) { try { l[i](); } catch (e) { console.error(e); } }
    },

    /* ---------- Server rejimi ---------- */
    async api(method, path, body) {
      var res = await fetch(path, {
        method: method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin'
      });
      var data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok) {
        var err = new Error((data && data.error) || ('Server xatosi (' + res.status + ')'));
        err.status = res.status;
        throw err;
      }
      return data;
    },
    async serverLogin(login, password) {
      var r = await this.api('POST', 'api/login', { login: login, password: password });
      await this.loadBootstrap();
      return r.user;
    },
    async serverLogout() {
      try { await this.api('POST', 'api/logout'); } catch (e) { }
    },
    async loadBootstrap() {
      var b = await this.api('GET', 'api/bootstrap');
      var self = this;
      COLLECTIONS.forEach(function (c) { self.col[c] = (b.col && b.col[c]) || {}; });
      this.docs = b.docs || {};
      this.settings = b.settings || null;
      if (b.finindex && global.A && global.A.Fin) global.A.Fin.index = b.finindex;
      this.ready = true;
      return b;
    },

    /** 1-bosqich: kirish uchun kerakli minimal ma'lumot (tez) */
    async initAuth() {
      COLLECTIONS.forEach(function (c) { Data.col[c] = {}; });

      // Avval o'z serverimiz bormi tekshiramiz
      try {
        var ctrl = new AbortController();
        var t = setTimeout(function () { ctrl.abort(); }, 2500);
        var res = await fetch('api/health', { signal: ctrl.signal, credentials: 'same-origin' });
        clearTimeout(t);
        if (res.ok) {
          this.mode = 'server';
          this.authReady = true;
          try {
            var me = await this.api('GET', 'api/me');
            this.currentServerUser = me.user;
          } catch (e) { this.currentServerUser = null; }
          return;
        }
      } catch (e) { /* server yo'q — davom etamiz */ }

      var db = null;
      try {
        if (global.claude && typeof global.claude.use === 'function') {
          db = await global.claude.use('db');
        }
      } catch (e) { db = null; }
      if (db) {
        this.db = db; this.mode = 'cloud';
        await Promise.all([
          this._loadCollection('users'),
          this._loadSettings()
        ]);
      } else {
        this.mode = 'local';
        this._loadLocal();
      }
      this.authReady = true;
    },

    /** 2-bosqich: qolgan hamma narsa (fonda) */
    async initRest() {
      if (this.mode === 'server') { this.ready = true; return; }
      if (this.mode === 'cloud') {
        var rest = COLLECTIONS.filter(function (c) { return AUTH_COLLECTIONS.indexOf(c) < 0; });
        await Promise.all(rest.map(function (c) { return Data._loadCollection(c); }));
      }
      this.ready = true;
    },

    /** Eski nom bilan moslik */
    async init() {
      await this.initAuth();
      await this.initRest();
    },

    async _loadCollection(name) {
      try {
        var snap = await this.db.collection(name).limit(1000).get();
        var map = {};
        snap.docs.forEach(function (d) { var v = d.data(); if (v) { v.id = d.id; map[d.id] = v; } });
        this.col[name] = map;
      } catch (e) { console.error('load ' + name, e); this.col[name] = {}; }
    },
    async _loadSettings() {
      try {
        var s = await this.db.doc('meta/settings').get();
        this.settings = s.exists ? s.data() : null;
      } catch (e) { this.settings = null; }
    },

    _lsKey: 'albyana_local_v1',
    _loadLocal() {
      var raw = null;
      try { raw = global.localStorage.getItem(this._lsKey); } catch (e) { raw = null; }
      var obj = {};
      try { obj = raw ? JSON.parse(raw) : {}; } catch (e) { obj = {}; }
      var self = this;
      COLLECTIONS.forEach(function (c) { self.col[c] = (obj.col && obj.col[c]) || {}; });
      this.docs = obj.docs || {};
      this.settings = obj.settings || null;
    },
    _saveLocal() {
      try {
        global.localStorage.setItem(this._lsKey, JSON.stringify({
          col: this.col, docs: this.docs, settings: this.settings
        }));
      } catch (e) { /* joy yetmadi */ }
    },

    /* yozuvlarni hujjat bo'yicha navbatga qo'yish */
    pending: 0,
    onBusy: null,
    _bump: function (n) {
      this.pending += n;
      if (this.pending < 0) this.pending = 0;
      if (this.onBusy) { try { this.onBusy(this.pending); } catch (e) { } }
    },
    _enqueue(path, fn) {
      var self = this;
      var q = this._queues[path] || Promise.resolve();
      self._bump(1);
      var next = q.then(fn, fn).then(function (r) { self._bump(-1); return r; },
        function (e) { self._bump(-1); throw e; });
      this._queues[path] = next.catch(function () { });
      return next;
    },

    async _setDoc(path, data) {
      var self = this;
      return this._enqueue(path, async function () {
        if (self.mode === 'cloud') {
          await self.db.doc(path).set(data);
        } else if (self.mode === 'server') {
          await self.api('PUT', 'api/doc?path=' + encodeURIComponent(path), { data: data });
        } else {
          self._saveLocal();
        }
      });
    },
    async _delDoc(path) {
      var self = this;
      return this._enqueue(path, async function () {
        if (self.mode === 'cloud') { await self.db.doc(path).delete(); }
        else if (self.mode === 'server') { await self.api('DELETE', 'api/doc?path=' + encodeURIComponent(path)); }
        else { self._saveLocal(); }
      });
    },

    /* --- kolleksiyalar --- */
    all: function (name) {
      var m = this.col[name] || {};
      return Object.keys(m).map(function (k) { return m[k]; });
    },
    one: function (name, id) { return (this.col[name] || {})[id] || null; },
    async save(name, obj) {
      if (!obj.id) obj.id = uid(name.slice(0, 3));
      this.col[name][obj.id] = obj;
      await this._setDoc(name + '/' + obj.id, obj);
      this._emit();
      return obj;
    },
    async remove(name, id) {
      delete this.col[name][id];
      await this._delDoc(name + '/' + id);
      this._emit();
    },

    /** Kolleksiyani jonli kuzatish */
    subscribe: function (name, cb) {
      var self = this;
      if (this.mode === 'server') {
        var timer = setInterval(async function () {
          try {
            var r = await self.api('GET', 'api/collection?name=' + encodeURIComponent(name));
            if (r && r.items) { self.col[name] = r.items; if (cb) cb(); }
          } catch (e) { /* jim */ }
        }, 8000);
        return function () { clearInterval(timer); };
      }
      if (this.mode !== 'cloud' || !this.db) return function () { };
      try {
        return this.db.collection(name).limit(1000).onSnapshot(function (snap) {
          var map = {};
          snap.docs.forEach(function (d) { var v = d.data(); if (v) { v.id = d.id; map[d.id] = v; } });
          Data.col[name] = map;
          if (cb) cb();
        }, function (e) { console.error('subscribe ' + name, e); });
      } catch (e) { return function () { }; }
    },

    /* --- oylik hujjatlar --- */
    docPath: function (kind, ym) { return kind + '/' + ym; },
    async loadMonth(kind, ym) {
      var path = this.docPath(kind, ym);
      if (this.docs[path]) return this.docs[path];
      var data = { month: ym, items: {} };
      if (this.mode === 'cloud') {
        try {
          var s = await this.db.doc(path).get();
          if (s.exists) { data = clone(s.data()); if (!data.items) data.items = {}; }
        } catch (e) { console.error('loadMonth', path, e); }
      } else if (this.mode === 'server') {
        try {
          var r = await this.api('GET', 'api/doc?path=' + encodeURIComponent(path));
          if (r && r.data) { data = r.data; if (!data.items) data.items = {}; }
        } catch (e) { console.error('loadMonth', path, e); }
      }
      this.docs[path] = data;
      return data;
    },
    monthCached: function (kind, ym) { return this.docs[this.docPath(kind, ym)] || null; },
    async mutateMonth(kind, ym, fn) {
      var doc = await this.loadMonth(kind, ym);
      var res = fn(doc);
      this.docs[this.docPath(kind, ym)] = doc;
      await this._setDoc(this.docPath(kind, ym), doc);
      this._emit();
      return res;
    },
    /** Bir necha oyni birdan yuklash */
    async loadMonths(kind, list) {
      for (var i = 0; i < list.length; i++) { await this.loadMonth(kind, list[i]); }
    },

    /* --- lessons: guruh + oy --- */
    lessonPath: function (groupId, ym) { return 'lessons/' + groupId + '__' + ym; },
    async loadLessons(groupId, ym) {
      var path = this.lessonPath(groupId, ym);
      if (this.docs[path]) return this.docs[path];
      var data = { groupId: groupId, month: ym, items: {} };
      if (this.mode === 'cloud') {
        try {
          var s = await this.db.doc(path).get();
          if (s.exists) { data = clone(s.data()); if (!data.items) data.items = {}; }
        } catch (e) { console.error('loadLessons', e); }
      } else if (this.mode === 'server') {
        try {
          var r = await this.api('GET', 'api/doc?path=' + encodeURIComponent(path));
          if (r && r.data) { data = r.data; if (!data.items) data.items = {}; }
        } catch (e) { console.error('loadLessons', e); }
      }
      this.docs[path] = data;
      return data;
    },
    lessonsCached: function (groupId, ym) { return this.docs[this.lessonPath(groupId, ym)] || null; },
    async mutateLessons(groupId, ym, fn) {
      var doc = await this.loadLessons(groupId, ym);
      var res = fn(doc);
      this.docs[this.lessonPath(groupId, ym)] = doc;
      await this._setDoc(this.lessonPath(groupId, ym), doc);
      this._emit();
      return res;
    },

    /* --- sozlamalar --- */
    async saveSettings(s) {
      this.settings = s;
      await this._setDoc('meta/settings', s);
      this._emit();
    }
  };

  global.A = global.A || {};
  Object.assign(global.A, {
    TZ_OFFSET_MIN: TZ_OFFSET_MIN,
    tzNow: tzNow, today: today, nowStamp: nowStamp, toISODate: toISODate,
    ymOf: ymOf, thisMonth: thisMonth, addDays: addDays, addMonths: addMonths,
    daysInMonth: daysInMonth, weekdayOf: weekdayOf, parseDate: parseDate,
    monthStart: monthStart, monthEnd: monthEnd, monthLabel: monthLabel, dateLabel: dateLabel,
    WEEKDAYS: WEEKDAYS, WEEKDAYS_SHORT: WEEKDAYS_SHORT, MONTHS: MONTHS,
    som: som, somFull: somFull, parseSom: parseSom,
    uid: uid, normPhone: normPhone, phoneDigits: phoneDigits, esc: esc, clone: clone,
    byId: byId, sortBy: sortBy, sha256: sha256, pad: pad,
    COLLECTIONS: COLLECTIONS, MONTHLY: MONTHLY,
    Data: Data
  });
})(typeof window !== 'undefined' ? window : globalThis);
