/* Media va hujjat ombori — fayllar DISKDA, bazada faqat ma'lumotnoma.

   Nega shunday: rasm/audio/pdf ni bazaga solish bazani shishiradi, zaxira
   nusxani og'irlashtiradi va har bir so'rovda ortiqcha yuk beradi. Shuning
   uchun bu yerda:
     — fayl mazmuni diskka yoziladi (FILES_DIR, standart <DATA_DIR>/files);
     — bazada faqat `files/<id>` yozuvi qoladi: nomi, turi, o'lchami, kim va qachon;
     — faylga murojaat faqat `/api/file?id=` orqali, huquq tekshirilgandan keyin;
     — fayl nomi serverda yasaladi (<id>.<kengaytma>), foydalanuvchi bergan nom
       hech qachon yo'lga qo'shilmaydi — shuning uchun yo'l bo'ylab chiqish yo'q. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DIR = process.env.FILES_DIR || path.join(DATA_DIR, 'files');
const COL = 'files/';
const MAX_BYTES = Number(process.env.FILE_MAX_BYTES || 10 * 1024 * 1024);   // 10 MB

/* Ruxsat etilgan turlar. Bajariladigan fayl (html, js, svg) YO'Q:
   ular brauzerda kod sifatida ishlashi mumkin edi.                     */
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
};

function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function ensureDir() { fs.mkdirSync(DIR, { recursive: true }); }

/** Foydalanuvchi bergan nomni faqat KO'RSATISH uchun tozalaymiz (yo'lga tushmaydi) */
function safeName(name) {
  return String(name || 'fayl')
    .replace(/[\\/\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'fayl';
}

function diskPath(id, ext) { return path.join(DIR, id + '.' + ext); }

/**
 * Faylni saqlash.
 * @param {{name, type, dataBase64, byUserId, purpose, refPath}} opts
 * @returns {{ok:true, file}} yoki {ok:false, reason}
 *   reason: 'turi' | 'kattaligi' | 'bosh'
 */
async function save(store, opts) {
  const type = String((opts && opts.type) || '').toLowerCase().split(';')[0].trim();
  const ext = TYPES[type];
  if (!ext) return { ok: false, reason: 'turi' };

  let buf;
  try {
    buf = Buffer.from(String((opts && opts.dataBase64) || ''), 'base64');
  } catch (e) { return { ok: false, reason: 'bosh' }; }
  if (!buf || !buf.length) return { ok: false, reason: 'bosh' };
  if (buf.length > MAX_BYTES) return { ok: false, reason: 'kattaligi' };

  ensureDir();
  const id = 'f' + crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(diskPath(id, ext), buf);

  const rec = {
    id,
    name: safeName(opts && opts.name),
    type,
    ext,
    bytes: buf.length,
    purpose: String((opts && opts.purpose) || '').slice(0, 40),   // 'material' | 'vazifa' | ...
    refPath: String((opts && opts.refPath) || '').slice(0, 120),  // qaysi yozuvga tegishli
    by: String((opts && opts.byUserId) || ''),
    byKind: String((opts && opts.byKind) || 'xodim'),             // 'xodim' | 'oquvchi' | 'ota-ona'
    at: nowStamp(opts)
  };
  await store.set(COL + id, rec);
  return { ok: true, file: rec };
}

/** Fayl yozuvi (baza) */
async function meta(store, id) {
  if (!/^f[a-f0-9]{16}$/.test(String(id || ''))) return null;
  return store.get(COL + String(id));
}

/** Fayl mazmuni. Yozuv bo'lmasa yoki disk fayli yo'q bo'lsa null. */
function readBody(rec) {
  if (!rec || !rec.id || !rec.ext) return null;
  const p = diskPath(rec.id, rec.ext);
  try {
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  } catch (e) { return null; }
}

/** Faylni o'chirish: avval diskdan, keyin bazadan. */
async function remove(store, id) {
  const rec = await meta(store, id);
  if (!rec) return false;
  try { fs.unlinkSync(diskPath(rec.id, rec.ext)); } catch (e) { }
  if (store.del) await store.del(COL + rec.id);
  return true;
}

/** Bitta yozuvga biriktirilgan fayllar */
async function forRef(store, refPath) {
  const rows = await store.list(COL);
  return rows.map(r => r.data)
    .filter(f => f && f.refPath === String(refPath))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** Bazada yozuvi yo'q, diskda qolib ketgan fayllarni tozalash (ixtiyoriy) */
async function sweep(store) {
  ensureDir();
  const rows = await store.list(COL);
  const known = {};
  rows.forEach(r => { if (r.data && r.data.id) known[r.data.id + '.' + r.data.ext] = 1; });
  let n = 0;
  for (const name of fs.readdirSync(DIR)) {
    if (known[name]) continue;
    try { fs.unlinkSync(path.join(DIR, name)); n++; } catch (e) { }
  }
  return n;
}

module.exports = { save, meta, readBody, remove, forRef, sweep, safeName, TYPES, MAX_BYTES, DIR, COL };
