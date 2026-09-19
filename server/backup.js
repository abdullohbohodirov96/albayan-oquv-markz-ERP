/* Zaxira nusxa va tiklash.
   — Har kuni avtomatik zaxira (alohida papkaga).
   — Qo'lda zaxira olish.
   — Tiklash: fayl tekshiriladi, ta'siri ko'rsatiladi, tiklashdan oldin joriy holat saqlanadi.
   Papka: BACKUP_DIR muhit o'zgaruvchisi yoki <loyiha>/backups                */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP = Number(process.env.BACKUP_KEEP || 30);
const FORMAT = 3;

function ensureDir() { fs.mkdirSync(DIR, { recursive: true, mode: 0o700 }); }

/* Barcha sana va vaqt Toshkent (UTC+5) bo'yicha — markaz shu yerda ishlaydi */
const TZ_MS = 5 * 3600 * 1000;
function tzNow() { return new Date(Date.now() + TZ_MS); }
function tzDate() { return tzNow().toISOString().slice(0, 10); }
function tzStamp() { return tzNow().toISOString().slice(0, 19).replace('T', ' '); }

function tsName(prefix) {
  const d = tzNow();
  const p = n => (n < 10 ? '0' + n : '' + n);
  return prefix + '-' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
    '-' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + '.json';
}

/** Zaxira ichidagi barcha hujjatlar: { "students/st_1": {...}, ... } */
async function dumpOf(store) {
  const rows = await store.all();
  const docs = {};
  rows.forEach(r => { docs[r.path] = r.data; });
  return {
    format: FORMAT,
    app: 'albyana-erp',
    createdAt: tzStamp(),
    count: Object.keys(docs).length,
    docs
  };
}

function checksum(dump) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(dump.docs))
    .digest('hex');
}

/** Zaxira faylini yozish. reason: 'avtomatik' | 'qo'lda' | 'tiklashdan oldin' */
async function makeBackup(store, reason, prefix) {
  ensureDir();
  const dump = await dumpOf(store);
  dump.reason = reason || 'qo’lda';
  dump.checksum = checksum(dump);
  const name = tsName(prefix || 'albayan');
  const file = path.join(DIR, name);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dump), { mode: 0o600 });
  fs.renameSync(tmp, file);                       // yarim yozilgan fayl qolmasin
  prune();
  return { name, file, bytes: fs.statSync(file).size, count: dump.count, checksum: dump.checksum };
}

function prune() {
  try {
    // eski ("albyana-") va yangi ("albayan-") nomdagi kunlik zaxiralar birga hisoblanadi
    const files = list().filter(f => /^(albayan|albyana)-/.test(f.name));
    files.slice(KEEP).forEach(f => { try { fs.unlinkSync(path.join(DIR, f.name)); } catch (e) { } });
  } catch (e) { }
}

/** Zaxiralar ro'yxati — yangisi birinchi */
function list() {
  ensureDir();
  return fs.readdirSync(DIR)
    .filter(n => /\.json$/.test(n))
    .map(n => {
      const st = fs.statSync(path.join(DIR, n));
      return { name: n, bytes: st.size, at: new Date(st.mtimeMs).toISOString() };
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

function safeName(n) {
  return /^[A-Za-z0-9._-]+\.json$/.test(String(n)) && String(n).indexOf('..') < 0;
}

function read(name) {
  if (!safeName(name)) throw new Error('Fayl nomi noto’g’ri.');
  const file = path.join(DIR, name);
  if (!fs.existsSync(file)) throw new Error('Zaxira topilmadi.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/* ---------------- Tekshirish ---------------- */

const REQUIRED = ['users'];

/**
 * Zaxira faylining to'g'riligini tekshiradi.
 * Natija: { ok, errors[], warnings[], count, byCollection{} }
 */
function validate(dump) {
  const errors = [], warnings = [];
  if (!dump || typeof dump !== 'object') return { ok: false, errors: ['Fayl JSON emas.'], warnings, byCollection: {}, count: 0 };
  if (dump.app && dump.app !== 'albyana-erp') errors.push('Bu fayl AlBayan Cairo zaxirasi emas.');
  const docs = dump.collections ? flattenOld(dump) : dump.docs;
  if (!docs || typeof docs !== 'object') errors.push('Ichida ma’lumot yo’q.');

  const byCollection = {};
  if (docs) {
    Object.keys(docs).forEach(p => {
      if (!/^[A-Za-z0-9_\-./~:@+]+$/.test(p) || p.split('/').length % 2 !== 0) {
        errors.push('Noto’g’ri yo’l: ' + p.slice(0, 40));
        return;
      }
      if (docs[p] === null || typeof docs[p] !== 'object') {
        errors.push('Buzuq yozuv: ' + p.slice(0, 40));
        return;
      }
      const c = p.split('/')[0];
      byCollection[c] = (byCollection[c] || 0) + 1;
    });
    REQUIRED.forEach(c => {
      if (!byCollection[c]) errors.push('Zaxirada foydalanuvchilar yo’q — tiklash xavfli.');
    });
    if (!docs['meta/settings']) warnings.push('Sozlamalar yo’q — standart sozlamalar qo’llanadi.');
    const dirs = Object.keys(docs).filter(p => p.indexOf('users/') === 0);
    const withHash = dirs.filter(p => docs[p] && docs[p].hash);
    if (dirs.length && !withHash.length) errors.push('Foydalanuvchi parollari yo’q — hech kim kira olmaydi.');
    if (dump.checksum) {
      const actual = checksum({ docs });
      if (actual !== dump.checksum) errors.push('Nazorat summasi mos emas — fayl o’zgartirilgan yoki buzilgan.');
    } else {
      warnings.push('Faylda nazorat summasi yo’q (eski format).');
    }
    if (dump.format && dump.format > FORMAT) errors.push('Fayl yangiroq versiyadan — bu server ocha olmaydi.');
  }
  return {
    ok: errors.length === 0,
    errors, warnings,
    count: docs ? Object.keys(docs).length : 0,
    byCollection,
    docs: docs || {}
  };
}

/** Eski (v2) formatdagi zaxirani yangi ko'rinishga o'tkazish */
function flattenOld(dump) {
  const docs = {};
  Object.keys(dump.collections || {}).forEach(c => {
    const items = dump.collections[c] || {};
    Object.keys(items).forEach(id => { docs[c + '/' + id] = items[id]; });
  });
  Object.keys(dump.docs || {}).forEach(p => { docs[p] = dump.docs[p]; });
  if (dump.settings) docs['meta/settings'] = dump.settings;
  return docs;
}

/** Tiklashdan oldin nima o'zgarishini ko'rsatish */
async function preview(store, dump) {
  const v = validate(dump);
  const now = await store.all();
  const current = {};
  now.forEach(r => { current[r.path] = r.data; });
  const currentByCol = {};
  Object.keys(current).forEach(p => {
    const c = p.split('/')[0];
    currentByCol[c] = (currentByCol[c] || 0) + 1;
  });
  const cols = Array.from(new Set(Object.keys(currentByCol).concat(Object.keys(v.byCollection)))).sort();
  const rows = cols.map(c => ({
    collection: c,
    hozir: currentByCol[c] || 0,
    keyin: v.byCollection[c] || 0,
    ochiriladi: Math.max(0, (currentByCol[c] || 0) - (v.byCollection[c] || 0))
  }));
  return {
    ok: v.ok, errors: v.errors, warnings: v.warnings,
    createdAt: dump.createdAt || null, reason: dump.reason || null,
    totalNow: Object.keys(current).length, totalAfter: v.count,
    rows
  };
}

/**
 * Tiklash. Avval joriy holat zaxiraga olinadi, keyin hamma narsa almashtiriladi.
 * Natija: { ok, restored, removed, safety }
 */
async function restore(store, dump) {
  const v = validate(dump);
  if (!v.ok) { const e = new Error(v.errors[0] || 'Zaxira yaroqsiz.'); e.details = v.errors; throw e; }

  const safety = await makeBackup(store, 'tiklashdan oldin', 'oldingi');

  const now = await store.all();
  const keep = new Set(Object.keys(v.docs));
  let removed = 0, restored = 0;
  for (const r of now) {
    if (!keep.has(r.path)) { await store.del(r.path); removed++; }
  }
  for (const p of Object.keys(v.docs)) {
    await store.set(p, v.docs[p]);
    restored++;
  }
  return { ok: true, restored, removed, safety: safety.name };
}

/* ---------------- Holat va jadval ---------------- */

async function readState(store) {
  return (await store.get('meta/backupstate')) || {};
}
async function writeState(store, patch) {
  const st = await readState(store);
  Object.assign(st, patch);
  await store.set('meta/backupstate', st);
  return st;
}

/** Kunlik avtomatik zaxira. Har soatda tekshiradi; kuniga bir marta oladi. */
function startSchedule(store, onFail) {
  let timer = null;
  async function tick() {
    try {
      const st = await readState(store);
      const today = tzDate();
      if (st.lastOkDate === today) return;
      const r = await makeBackup(store, 'avtomatik');
      await writeState(store, {
        lastOkDate: today, lastOkAt: tzStamp(),
        lastFile: r.name, lastBytes: r.bytes, lastCount: r.count,
        lastError: '', lastErrorAt: ''
      });
      console.log('  Zaxira olindi: ' + r.name + ' (' + r.count + ' yozuv)');
    } catch (e) {
      await writeState(store, { lastError: String(e.message || e), lastErrorAt: tzStamp() })
        .catch(() => { });
      console.error('  Zaxira XATO: ' + e.message);
      if (onFail) { try { await onFail(e); } catch (x) { } }
    }
  }
  tick();
  // Har 6 soatda tekshiramiz: bulutli bazalar (Neon) behuda uyg'onmasin
  timer = setInterval(tick, Number(process.env.BACKUP_CHECK_MS || 6 * 60 * 60 * 1000));
  if (timer.unref) timer.unref();
  return { stop: () => clearInterval(timer), tick };
}

module.exports = {
  DIR, FORMAT, tzDate, tzStamp,
  makeBackup, list, read, validate, preview, restore,
  readState, writeState, startSchedule, dumpOf, checksum, flattenOld, safeName
};
