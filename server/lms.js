/* O'quv jarayoni: bayram va tanaffus, qo'shimcha dars, dars jurnali,
   guruh savol-javobi va fikr bildirish.

   Yozuvlar:
     holidays/<id>  — bayram/dam olish { name, from, to, scope:'markaz'|'guruh', groupId }
     pauses/<id>    — o'quvchi tanaffusi { studentId, from, to, reason, byUserId }
     makeups/<id>   — qo'shimcha dars { studentId, groupId, missedDate, date, time,
                                        room, teacherId, status }
     lessonlog/<id> — o'tkazilgan dars yozuvi { groupId, date, topicId, note,
                                                homeworkId, materialIds, by }
     questions/<id> — guruh savoli { groupId, studentId, text, answers[], status }
     feedback/<id>  — dars/ustoz haqida fikr { groupId, topicId, teacherId,
                                               studentId?, rating, text, anon }

   Muhim qoida: bu yozuvlarni MIJOZ to'g'ridan-to'g'ri yoza olmaydi — hammasi
   server yo'llari orqali, huquq tekshirilgandan keyin yoziladi (guardWrite). */
'use strict';
const crypto = require('crypto');

const HOL = 'holidays/';
const PAU = 'pauses/';
const MKP = 'makeups/';
const LOG = 'lessonlog/';
const QST = 'questions/';
const FBK = 'feedback/';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function id(prefix) { return prefix + crypto.randomBytes(6).toString('hex'); }
function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function txt(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, max || 500); }
function dateOk(d) { return DATE.test(String(d || '')); }

async function listCol(store, col) {
  return (await store.list(col))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean);
}

/* ---------------- Bayram va tanaffus ---------------- */

/** Sana oralig'ida ekanini tekshirish (ikki chegara ham kiradi) */
function inRange(date, from, to) {
  const d = String(date);
  return (!from || d >= String(from)) && (!to || d <= String(to));
}

/**
 * Shu kunda dars bo'ladimi?
 * @returns {{off:boolean, reason:string, name:string}}
 */
async function dayOff(store, date, groupId) {
  if (!dateOk(date)) return { off: false, reason: '', name: '' };
  for (const h of await listCol(store, HOL)) {
    if (h.active === false) continue;
    if (h.scope === 'guruh' && String(h.groupId || '') !== String(groupId || '')) continue;
    if (inRange(date, h.from, h.to || h.from)) {
      return { off: true, reason: h.scope === 'guruh' ? 'guruh tanaffusi' : 'bayram', name: h.name || '' };
    }
  }
  return { off: false, reason: '', name: '' };
}

/** O'quvchi shu kunda tanaffusdami? */
async function studentPaused(store, studentId, date) {
  if (!dateOk(date)) return null;
  for (const p of await listCol(store, PAU)) {
    if (String(p.studentId) !== String(studentId)) continue;
    if (inRange(date, p.from, p.to || '9999-12-31')) return p;
  }
  return null;
}

/** Oraliqdagi dam olish kunlari soni (hisob-kitob uchun) */
async function offDays(store, from, to, groupId) {
  if (!dateOk(from) || !dateOk(to)) return [];
  const out = [];
  const d = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (d <= end) {
    const s = d.toISOString().slice(0, 10);
    const o = await dayOff(store, s, groupId);
    if (o.off) out.push({ date: s, name: o.name, reason: o.reason });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function saveHoliday(store, data, opts) {
  const from = txt(data && data.from, 10), to = txt((data && data.to) || (data && data.from), 10);
  if (!dateOk(from) || !dateOk(to)) return { ok: false, reason: 'sana' };
  if (to < from) return { ok: false, reason: 'sana' };
  const scope = (data && data.scope) === 'guruh' ? 'guruh' : 'markaz';
  if (scope === 'guruh' && !txt(data && data.groupId, 60)) return { ok: false, reason: 'guruh' };
  const rec = {
    id: txt(data && data.id, 60) || id('hol'),
    name: txt(data && data.name, 120) || (scope === 'guruh' ? 'Guruh tanaffusi' : 'Bayram'),
    from, to, scope,
    groupId: scope === 'guruh' ? txt(data && data.groupId, 60) : '',
    note: txt(data && data.note, 300),
    active: (data && data.active) !== false,
    by: txt(opts && opts.byUserId, 60),
    at: nowStamp(opts)
  };
  await store.set(HOL + rec.id, rec);
  return { ok: true, rec };
}

async function savePause(store, data, opts) {
  const from = txt(data && data.from, 10), to = txt(data && data.to, 10);
  const studentId = txt(data && data.studentId, 60);
  if (!studentId) return { ok: false, reason: 'oquvchi' };
  if (!dateOk(from)) return { ok: false, reason: 'sana' };
  if (to && (!dateOk(to) || to < from)) return { ok: false, reason: 'sana' };
  const st = await store.get('students/' + studentId);
  if (!st) return { ok: false, reason: 'topilmadi' };
  const rec = {
    id: txt(data && data.id, 60) || id('pau'),
    studentId, from, to: to || '',
    reason: txt(data && data.reason, 200),
    by: txt(opts && opts.byUserId, 60),
    at: nowStamp(opts)
  };
  await store.set(PAU + rec.id, rec);
  return { ok: true, rec };
}

/* ---------------- Qo'shimcha (qoldirilgan) dars ---------------- */

const MKP_STATUS = ['taklif', 'tasdiq', 'bajarildi', 'bekor'];

/**
 * Qo'shimcha dars taklifi. Faqat HAQIQATDA kelmagan darsga beriladi:
 * davomat jurnalida o'sha kunda "kelmadi" yoki "sababli" bo'lishi kerak.
 */
async function offerMakeup(store, data, opts) {
  const studentId = txt(data && data.studentId, 60);
  const groupId = txt(data && data.groupId, 60);
  const missedDate = txt(data && data.missedDate, 10);
  const date = txt(data && data.date, 10);
  const time = txt(data && data.time, 5);
  if (!studentId || !groupId) return { ok: false, reason: 'format' };
  if (!dateOk(missedDate) || !dateOk(date)) return { ok: false, reason: 'sana' };
  if (time && !TIME.test(time)) return { ok: false, reason: 'vaqt' };
  if (date < missedDate) return { ok: false, reason: 'sana' };

  const g = await store.get('groups/' + groupId);
  if (!g) return { ok: false, reason: 'guruh' };
  const st = await store.get('students/' + studentId);
  if (!st) return { ok: false, reason: 'oquvchi' };

  const missed = await wasAbsent(store, groupId, studentId, missedDate);
  if (!missed) return { ok: false, reason: 'kelmagan-emas' };

  const off = await dayOff(store, date, groupId);
  if (off.off) return { ok: false, reason: 'dam-kuni' };

  const dup = (await listCol(store, MKP)).filter(m =>
    m.studentId === studentId && m.missedDate === missedDate && m.status !== 'bekor')[0];
  if (dup) return { ok: false, reason: 'takror', rec: dup };

  const rec = {
    id: id('mkp'),
    studentId, groupId, missedDate, date, time,
    room: txt(data && data.room, 60),
    teacherId: txt((data && data.teacherId) || g.teacherId, 60),
    note: txt(data && data.note, 300),
    status: 'taklif',
    by: txt(opts && opts.byUserId, 60),
    at: nowStamp(opts)
  };
  await store.set(MKP + rec.id, rec);
  return { ok: true, rec };
}

/** O'sha kunda davomatda "kelmadi"/"sababli" belgilanganmi */
async function wasAbsent(store, groupId, studentId, date) {
  const month = String(date).slice(0, 7);
  const doc = await store.get('lessons/' + groupId + '__' + month);
  if (!doc) return false;
  const day = (doc.items && doc.items[date]) || null;
  const marks = (doc.marks && doc.marks[date]) || null;
  let v = null;
  if (day && day.attendance && day.attendance[studentId]) {
    v = day.attendance[studentId].status || day.attendance[studentId];
  } else if (marks && marks[studentId]) {
    v = marks[studentId];
  }
  const s = String(v || '');
  return s === 'kelmadi' || s === 'sababli';
}

async function setMakeupStatus(store, mid, status, opts) {
  if (MKP_STATUS.indexOf(status) < 0) return { ok: false, reason: 'holat' };
  const rec = await store.get(MKP + String(mid || ''));
  if (!rec) return { ok: false, reason: 'topilmadi' };
  if (rec.status === 'bajarildi' && status !== 'bekor') return { ok: false, reason: 'yopiq' };
  rec.status = status;
  rec.statusAt = nowStamp(opts);
  rec.statusBy = txt(opts && opts.byUserId, 60);
  await store.set(MKP + rec.id, rec);
  return { ok: true, rec };
}

/* ---------------- Dars jurnali (darsdan keyingi jarayon) ---------------- */

/**
 * Dars o'tilgandan keyingi yozuv: mavzu, izoh, uy vazifasi, materiallar.
 * Bitta guruh + sana uchun bitta yozuv (qayta yozilsa yangilanadi).
 */
async function saveLessonLog(store, data, opts) {
  const groupId = txt(data && data.groupId, 60);
  const date = txt(data && data.date, 10);
  if (!groupId || !dateOk(date)) return { ok: false, reason: 'format' };
  const g = await store.get('groups/' + groupId);
  if (!g) return { ok: false, reason: 'guruh' };

  const key = groupId + '__' + date;
  const old = await store.get(LOG + key);
  /* Yozuv qayta saqlansa — SO'ROVDA BO'LMAGAN maydon o'chib ketmasin.
     (Ilgari faqat sarlavhani o'zgartirsa, uy vazifasi yo'qolardi.)
     Maydonni ataylab bo'shatish uchun bo'sh matn yuboriladi.          */
  const keep = (k, val, dflt) => (data && data[k] !== undefined)
    ? val : (old && old[k] !== undefined ? old[k] : dflt);
  const rec = {
    id: key,
    groupId, date,
    topicId: keep('topicId', txt(data && data.topicId, 60), ''),
    title: keep('title', txt(data && data.title, 200), ''),
    note: keep('note', txt(data && data.note, 2000), ''),
    homeworkId: keep('homeworkId', txt(data && data.homeworkId, 60), ''),
    homeworkText: keep('homeworkText', txt(data && data.homeworkText, 1000), ''),
    dueDate: keep('dueDate', dateOk(data && data.dueDate) ? txt(data.dueDate, 10) : '', ''),
    materialIds: keep('materialIds', Array.isArray(data && data.materialIds)
      ? data.materialIds.slice(0, 20).map(x => txt(x, 60)) : [], []),
    fileIds: keep('fileIds', Array.isArray(data && data.fileIds)
      ? data.fileIds.slice(0, 20).map(x => txt(x, 60)) : [], []),
    quizId: keep('quizId', txt(data && data.quizId, 60), ''),
    by: txt(opts && opts.byUserId, 60),
    at: nowStamp(opts),
    createdAt: (old && old.createdAt) || nowStamp(opts)
  };
  await store.set(LOG + key, rec);
  return { ok: true, rec, isNew: !old };
}

/** Guruhning oxirgi dars yozuvlari */
async function logsOfGroup(store, groupId, limit) {
  return (await listCol(store, LOG))
    .filter(l => l.groupId === String(groupId))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, Number(limit) || 20);
}

/** O'quvchi uchun oxirgi vazifalar (uning guruhlari bo'yicha) */
async function homeworkForStudent(store, studentId, limit) {
  const mems = (await listCol(store, 'memberships/'))
    .filter(m => m.studentId === String(studentId) && m.status !== 'chiqdi');
  const gids = {};
  mems.forEach(m => { gids[m.groupId] = 1; });
  const logs = (await listCol(store, LOG))
    .filter(l => gids[l.groupId] && (l.homeworkText || l.homeworkId))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, Number(limit) || 10);
  const out = [];
  for (const l of logs) {
    let hw = null;
    if (l.homeworkId) hw = await store.get('homework/' + l.homeworkId);
    const g = await store.get('groups/' + l.groupId);
    out.push({
      date: l.date,
      group: g ? (g.name || '') : '',
      title: l.title || (hw ? hw.title : ''),
      text: l.homeworkText || (hw ? hw.about : ''),
      dueDate: l.dueDate || '',
      fileIds: l.fileIds || []
    });
  }
  return out;
}

/* ---------------- Guruh savol-javobi ---------------- */

async function askQuestion(store, data, opts) {
  const groupId = txt(data && data.groupId, 60);
  const studentId = txt(data && data.studentId, 60);
  const text = txt(data && data.text, 1500).trim();
  if (!groupId || !studentId || !text) return { ok: false, reason: 'format' };
  const inGroup = (await listCol(store, 'memberships/'))
    .some(m => m.groupId === groupId && m.studentId === studentId && m.status !== 'chiqdi');
  if (!inGroup) return { ok: false, reason: 'guruh-emas' };
  const rec = {
    id: id('qst'), groupId, studentId, text,
    topicId: txt(data && data.topicId, 60),
    answers: [], status: 'ochiq',
    at: nowStamp(opts)
  };
  await store.set(QST + rec.id, rec);
  return { ok: true, rec };
}

async function answerQuestion(store, qid, data, opts) {
  const rec = await store.get(QST + String(qid || ''));
  if (!rec) return { ok: false, reason: 'topilmadi' };
  const text = txt(data && data.text, 2000).trim();
  if (!text) return { ok: false, reason: 'format' };
  rec.answers = Array.isArray(rec.answers) ? rec.answers : [];
  if (rec.answers.length >= 50) return { ok: false, reason: 'kop' };
  rec.answers.push({
    by: txt(opts && opts.byUserId, 60),
    byName: txt(opts && opts.byName, 80),
    byKind: txt((opts && opts.byKind) || 'xodim', 20),
    text, at: nowStamp(opts)
  });
  rec.status = 'javob berilgan';
  await store.set(QST + rec.id, rec);
  return { ok: true, rec };
}

async function questionsOfGroup(store, groupId, limit) {
  return (await listCol(store, QST))
    .filter(q => q.groupId === String(groupId))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, Number(limit) || 50);
}

/* ---------------- Fikr bildirish ---------------- */

/**
 * Dars/ustoz haqida fikr. Anonim bo'lsa studentId SAQLANMAYDI —
 * "anonim" deb yozib, keyin ismini ko'rsatish insofsizlik bo'lardi.
 * Takror bo'lmasligi uchun anonimda ham bitta kalit saqlanadi (xesh).
 */
async function giveFeedback(store, data, opts) {
  const groupId = txt(data && data.groupId, 60);
  const studentId = txt(data && data.studentId, 60);
  const rating = Math.round(Number(data && data.rating));
  const anon = !!(data && data.anon);
  if (!groupId || !studentId) return { ok: false, reason: 'format' };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, reason: 'baho' };
  const inGroup = (await listCol(store, 'memberships/'))
    .some(m => m.groupId === groupId && m.studentId === studentId && m.status !== 'chiqdi');
  if (!inGroup) return { ok: false, reason: 'guruh-emas' };

  const key = crypto.createHash('sha256')
    .update(groupId + '|' + studentId + '|' + txt(data && data.date, 10)).digest('hex').slice(0, 24);
  const dup = (await listCol(store, FBK)).filter(f => f.key === key)[0];
  if (dup) return { ok: false, reason: 'takror' };

  const g = await store.get('groups/' + groupId);
  const rec = {
    id: id('fbk'), key, groupId,
    teacherId: txt((data && data.teacherId) || (g && g.teacherId), 60),
    topicId: txt(data && data.topicId, 60),
    date: txt(data && data.date, 10),
    rating,
    text: txt(data && data.text, 1500),
    anon,
    studentId: anon ? '' : studentId,
    at: nowStamp(opts)
  };
  await store.set(FBK + rec.id, rec);
  return { ok: true, rec };
}

/** Guruh yoki ustoz bo'yicha fikrlar xulosasi */
async function feedbackSummary(store, filter) {
  const all = await listCol(store, FBK);
  const rows = all.filter(f =>
    (!filter || !filter.groupId || f.groupId === filter.groupId) &&
    (!filter || !filter.teacherId || f.teacherId === filter.teacherId));
  const n = rows.length;
  const avg = n ? Math.round(rows.reduce((s, f) => s + Number(f.rating || 0), 0) / n * 10) / 10 : 0;
  const byStar = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach(f => { const r = Number(f.rating); if (byStar[r] != null) byStar[r]++; });
  return {
    count: n, avg, byStar,
    last: rows.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20)
      .map(f => ({
        id: f.id, rating: f.rating, text: f.text, at: f.at,
        anon: !!f.anon, studentId: f.anon ? '' : f.studentId, groupId: f.groupId
      }))
  };
}

module.exports = {
  HOL, PAU, MKP, LOG, QST, FBK, MKP_STATUS,
  dayOff, studentPaused, offDays, saveHoliday, savePause,
  offerMakeup, setMakeupStatus, wasAbsent,
  saveLessonLog, logsOfGroup, homeworkForStudent,
  askQuestion, answerQuestion, questionsOfGroup,
  giveFeedback, feedbackSummary,
  listCol, dateOk, txt, inRange
};
