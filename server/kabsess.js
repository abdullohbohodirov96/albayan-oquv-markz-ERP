/* O'quvchi/ota-ona kabineti uchun sessiya.

   Nega kerak: ilgari kabinet 4 xonali kod bilan ochilardi — kodni bilgan
   har kim ism, guruh, qarz va davomatni ko'rar edi. Endi kabinet faqat
   TASDIQLANGAN sessiya bilan ochiladi:
     — sessiya bir martalik havola (server/link.js) evaziga beriladi;
     — cookie ichida "<id>.<sir>" turadi, bazada faqat sirning SHA-256 xeshi;
     — bazada saqlanadi, shuning uchun server qayta ishga tushsa ham yo'qolmaydi;
     — muddati bor va bekor qilinishi mumkin (bog'lanish uzilganda ham);
     — har bir sessiyada CSRF siri bor: o'zgartiruvchi so'rovlar uni talab qiladi. */
'use strict';
const crypto = require('crypto');

const COL = 'kabsess/';
const TTL_MS = Number(process.env.KAB_SESSION_MS || 30 * 864e5);      // 30 kun
const COOKIE = 'alb_kab';

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function parse(v) {
  const m = /^([A-Za-z0-9_-]{6,24})\.([A-Za-z0-9_-]{16,64})$/.exec(String(v || '').trim());
  return m ? { id: m[1], secret: m[2] } : null;
}

/** Yangi sessiya. subject: {studentId} yoki {parentId, studentIds:[...]} */
async function create(store, opts) {
  const id = 'ks' + crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(24).toString('base64url');
  const csrf = crypto.randomBytes(16).toString('base64url');
  const rec = {
    id,
    hash: sha(secret),
    csrf,
    kind: String((opts && opts.kind) || 'student'),      // 'student' | 'parent'
    studentId: String((opts && opts.studentId) || ''),
    parentId: String((opts && opts.parentId) || ''),
    createdAt: nowStamp(opts),
    via: String((opts && opts.via) || 'havola'),
    expiresAt: Date.now() + (Number(opts && opts.ttlMs) || TTL_MS),
    revokedAt: null
  };
  await store.set(COL + id, rec);
  return { id, cookie: id + '.' + secret, csrf, expiresAt: rec.expiresAt };
}

/** Cookie qiymatidan sessiyani olish. Yaroqsiz bo'lsa null. */
async function read(store, cookieValue) {
  const p = parse(cookieValue);
  if (!p) return null;
  const rec = await store.get(COL + p.id);
  if (!rec || !rec.hash || rec.revokedAt) return null;
  const a = Buffer.from(sha(p.secret), 'utf8');
  const b = Buffer.from(String(rec.hash), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(rec.expiresAt) && Date.now() > Number(rec.expiresAt)) return null;
  return rec;
}

/** Bitta sessiyani yopish */
async function revoke(store, id, opts) {
  const rec = await store.get(COL + String(id || ''));
  if (!rec) return false;
  rec.revokedAt = nowStamp(opts);
  await store.set(COL + rec.id, rec);
  return true;
}

/** O'quvchiga tegishli barcha sessiyalarni yopish (bog'lanish uzilganda) */
async function revokeForStudent(store, studentId, opts) {
  const rows = await store.list(COL);
  let n = 0;
  for (const r of rows) {
    const d = r.data;
    if (!d || d.revokedAt) continue;
    const mine = d.studentId === String(studentId) ||
      (Array.isArray(d.studentIds) && d.studentIds.indexOf(String(studentId)) >= 0);
    if (!mine) continue;
    d.revokedAt = nowStamp(opts);
    await store.set(r.path, d);
    n++;
  }
  return n;
}

/** Cookie sarlavhasi */
function cookieHeader(value, maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return COOKIE + '=' + value + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' +
    Math.floor(maxAgeSec) + secure;
}
function clearHeader() {
  return COOKIE + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}

module.exports = { create, read, revoke, revokeForStudent, cookieHeader, clearHeader, COOKIE, COL, TTL_MS };
