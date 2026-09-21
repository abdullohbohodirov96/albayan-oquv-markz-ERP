/* Ota-ona hisobi va "Shaxsiy kabinet" ma'lumoti.

   Bitta kabinet, ikki xil kiruvchi:
     o'quvchi  — o'z ma'lumotini ko'radi, vazifa topshiradi, test ishlaydi,
                 savol beradi, fikr bildiradi;
     ota-ona   — FARZANDLARI ma'lumotini ko'radi (davomat, to'lov, natija),
                 lekin ularning nomidan vazifa topshirmaydi, test ishlamaydi
                 va savol bermaydi. Bu ataylab: natija bolaning o'zi
                 bajargan ishidan chiqishi kerak.

   Ota-ona ham 4 xonali kod bilan kiradi (markaz rahbari tanlagan tartib),
   lekin kod O'ZINIKI — farzandining kodi emas.                              */
'use strict';
const crypto = require('crypto');
const kabinet = require('./kabinet');

const COL = 'parents/';
const CODE_LEN = 4;

function rid(p) { return p + crypto.randomBytes(6).toString('hex'); }
function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function txt(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, max || 200); }

async function listCol(store, col) {
  return (await store.list(col))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean);
}

function normCode(t) { return String(t == null ? '' : t).replace(/\D/g, '').slice(0, CODE_LEN); }
function validCode(c) { return new RegExp('^\\d{' + CODE_LEN + '}$').test(String(c || '')); }

/** Band bo'lmagan kod: o'quvchi kodlari bilan ham to'qnashmasin */
async function freeCode(store, exceptId) {
  const taken = {};
  (await kabinet.studentsOf(store)).forEach(s => { if (s.code) taken[String(s.code)] = 1; });
  (await listCol(store, COL)).forEach(p => {
    if (p.id !== exceptId && p.code) taken[String(p.code)] = 1;
  });
  for (let i = 0; i < 400; i++) {
    const c = String(crypto.randomInt(0, 10000)).padStart(CODE_LEN, '0');
    if (!taken[c]) return c;
  }
  return '';
}

/** Ota-onani saqlash. Kodni har doim SERVER beradi. */
async function save(store, data, opts) {
  const name = txt(data && data.name, 120).trim();
  if (!name) return { ok: false, reason: 'ism' };
  const pid = txt(data && data.id, 60) || rid('par');
  const old = await store.get(COL + pid);

  const ids = Array.isArray(data && data.studentIds) ? data.studentIds : [];
  const studentIds = [];
  for (const sid of ids.slice(0, 20)) {
    const s = await store.get('students/' + txt(sid, 60));
    if (s && s.status !== 'o’chirilgan') studentIds.push(s.id);
  }

  const rec = {
    id: pid,
    name,
    phone: txt(data && data.phone, 30),
    relation: txt(data && data.relation, 30),      // ota / ona / vasiy
    studentIds,
    code: (old && validCode(old.code)) ? old.code : await freeCode(store, pid),
    active: (data && data.active) !== false,
    note: txt(data && data.note, 300),
    by: txt(opts && opts.byUserId, 60),
    at: nowStamp(opts),
    createdAt: (old && old.createdAt) || nowStamp(opts)
  };
  await store.set(COL + rec.id, rec);
  return { ok: true, rec };
}

/** Yangi kod berish (eskisi ishlamay qoladi) */
async function newCode(store, pid, opts) {
  const rec = await store.get(COL + String(pid || ''));
  if (!rec) return { ok: false, reason: 'topilmadi' };
  rec.code = await freeCode(store, rec.id);
  rec.codeAt = nowStamp(opts);
  await store.set(COL + rec.id, rec);
  return { ok: true, rec };
}

async function byCode(store, code) {
  const c = normCode(code);
  if (!validCode(c)) return null;
  return (await listCol(store, COL))
    .filter(p => p.active !== false && String(p.code || '') === c)[0] || null;
}

async function forStudent(store, studentId) {
  return (await listCol(store, COL))
    .filter(p => Array.isArray(p.studentIds) && p.studentIds.indexOf(String(studentId)) >= 0);
}

/**
 * Ota-ona kabineti: har bir farzand uchun qisqa xulosa.
 * Boshqa oilaning bolasi hech qachon bu yerga tushmaydi.
 */
async function summary(store, parent, progress) {
  const kids = [];
  for (const sid of (parent.studentIds || [])) {
    const st = await store.get('students/' + sid);
    if (!st || st.status === 'o’chirilgan') continue;
    const base = await kabinet.summary(store, st);
    const prog = progress ? await progress.forStudent(store, st.id) : null;
    kids.push({
      student: base.student,
      groups: base.groups,
      finance: base.finance,
      attendance: base.attendance,
      level: prog ? prog.level : '',
      quizzes: prog ? { count: prog.quizzes.count, avgPercent: prog.quizzes.avgPercent } : null
    });
  }
  const s = (await store.get('meta/settings')) || {};
  return {
    kind: 'parent',
    parent: { id: parent.id, name: parent.name, code: parent.code, relation: parent.relation || '' },
    children: kids,
    center: { name: s.centerName || 'AlBayan Cairo', phone: s.phone || '' }
  };
}

module.exports = { COL, CODE_LEN, save, newCode, byCode, forStudent, summary, normCode, validCode, freeCode };
