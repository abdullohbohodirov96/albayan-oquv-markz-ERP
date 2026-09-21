/* Dars testlari va o'quvchiga alohida yuborilgan savollar.

   Daraja testi (server/levels.js) bilan bir xil qoida amal qiladi:
   TO'G'RI JAVOB HECH QACHON BRAUZERGA YUBORILMAYDI. Savollar javobsiz
   beriladi, baholash faqat shu yerda bo'ladi, natijani mijoz yoza olmaydi.

   Yozuvlar:
     quizzes/<id>  — test tavsifi { title, topicId, groupId, level, active, due }
     quizq/<id>    — savol { quizId, text, options, answer, kind }   ← YOPIQ
     quizsess/<id> — boshlangan urinish { quizId, studentId, qids, mix }  ← YOPIQ
     quizres/<id>  — natija { quizId, studentId, score, total, at }
     asks/<id>     — bitta o'quvchiga yuborilgan savol { studentId, text, answerText } */
'use strict';
const crypto = require('crypto');

const QZ = 'quizzes/';
const QQ = 'quizq/';
const QS = 'quizsess/';
const QR = 'quizres/';
const ASK = 'asks/';
const TTL_MS = Number(process.env.QUIZ_TTL_MS || 3 * 60 * 60 * 1000);   // 3 soat

function rid(p) { return p + crypto.randomBytes(6).toString('hex'); }
function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function txt(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, max || 400); }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); }

async function listCol(store, col) {
  return (await store.list(col))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean);
}
function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function seeded(seed) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

/* ---------------- Testni tuzish (ustoz tomoni) ---------------- */

/**
 * Testni saqlash. Savollar shu yerda `quizq/` ga yoziladi, javoblari bilan.
 * @param {{id,title,topicId,groupId,level,due,questions:[{text,options,answer,kind}]}} data
 */
async function saveQuiz(store, data, opts) {
  const title = txt(data && data.title, 200).trim();
  if (!title) return { ok: false, reason: 'nom' };
  const qs = Array.isArray(data && data.questions) ? data.questions : [];
  if (!qs.length) return { ok: false, reason: 'savol-yoq' };
  if (qs.length > 100) return { ok: false, reason: 'kop' };

  const qid = txt(data && data.id, 60) || rid('qz');
  const old = await store.get(QZ + qid);

  /* Eski savollarni tozalaymiz — test qayta saqlansa nusxa qolmasin */
  if (old) {
    for (const q of await listCol(store, QQ)) {
      if (q.quizId === qid && store.del) await store.del(QQ + q.id);
    }
  }

  let n = 0;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i] || {};
    const options = (Array.isArray(q.options) ? q.options : [])
      .slice(0, 6).map(o => txt(o, 300)).filter(o => o !== '');
    const answer = Math.round(num(q.answer, -1));
    if (options.length < 2) return { ok: false, reason: 'variant' };
    if (!(answer >= 0 && answer < options.length)) return { ok: false, reason: 'javob' };
    const iid = qid + '_q' + String(i + 1).padStart(3, '0');
    await store.set(QQ + iid, {
      id: iid, quizId: qid, order: i,
      text: txt(q.text, 600), options, answer,
      kind: txt(q.kind, 40) || 'lugat',
      active: true
    });
    n++;
  }

  const rec = {
    id: qid,
    title,
    topicId: txt(data && data.topicId, 60),
    groupId: txt(data && data.groupId, 60),
    level: txt(data && data.level, 4),
    about: txt(data && data.about, 800),
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(data && data.due)) ? txt(data.due, 10) : '',
    count: n,
    pass: Math.min(100, Math.max(0, Math.round(num(data && data.pass, 60)))),
    active: (data && data.active) !== false,
    by: txt(opts && opts.byUserId, 60),
    at: nowStamp(opts),
    createdAt: (old && old.createdAt) || nowStamp(opts)
  };
  await store.set(QZ + qid, rec);
  return { ok: true, rec };
}

async function removeQuiz(store, qid) {
  const rec = await store.get(QZ + String(qid || ''));
  if (!rec) return false;
  for (const q of await listCol(store, QQ)) {
    if (q.quizId === rec.id && store.del) await store.del(QQ + q.id);
  }
  if (store.del) await store.del(QZ + rec.id);
  return true;
}

/** Ustoz uchun: test savollari JAVOBI BILAN (faqat huquqi borlarga beriladi) */
async function quizWithAnswers(store, qid) {
  const rec = await store.get(QZ + String(qid || ''));
  if (!rec) return null;
  const qs = (await listCol(store, QQ))
    .filter(q => q.quizId === rec.id)
    .sort((a, b) => num(a.order) - num(b.order));
  return { quiz: rec, questions: qs };
}

/* ---------------- Testni topshirish (o'quvchi tomoni) ---------------- */

/** O'quvchiga tegishli testlar ro'yxati (natijasi bilan) */
async function quizzesForStudent(store, studentId) {
  const mems = (await listCol(store, 'memberships/'))
    .filter(m => m.studentId === String(studentId) && m.status !== 'chiqdi');
  const gids = {};
  mems.forEach(m => { gids[m.groupId] = 1; });
  const res = (await listCol(store, QR)).filter(r => r.studentId === String(studentId));
  const byQuiz = {};
  res.forEach(r => {
    const cur = byQuiz[r.quizId];
    if (!cur || String(r.at) > String(cur.at)) byQuiz[r.quizId] = r;
  });
  return (await listCol(store, QZ))
    .filter(q => q.active !== false && (!q.groupId || gids[q.groupId]))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .map(q => ({
      id: q.id, title: q.title, count: q.count, due: q.due, about: q.about,
      done: !!byQuiz[q.id],
      score: byQuiz[q.id] ? byQuiz[q.id].score : null,
      total: byQuiz[q.id] ? byQuiz[q.id].total : null,
      percent: byQuiz[q.id] ? byQuiz[q.id].percent : null
    }));
}

/** Urinish boshlash — savollar JAVOBSIZ qaytadi */
async function start(store, qid, studentId, opts) {
  const rec = await store.get(QZ + String(qid || ''));
  if (!rec || rec.active === false) return { ok: false, reason: 'topilmadi' };
  if (!String(studentId || '')) return { ok: false, reason: 'oquvchi' };

  if (rec.groupId) {
    const inGroup = (await listCol(store, 'memberships/'))
      .some(m => m.groupId === rec.groupId && m.studentId === String(studentId) && m.status !== 'chiqdi');
    if (!inGroup) return { ok: false, reason: 'guruh-emas' };
  }

  const qs = (await listCol(store, QQ))
    .filter(q => q.quizId === rec.id && q.active !== false)
    .sort((a, b) => num(a.order) - num(b.order));
  if (!qs.length) return { ok: false, reason: 'savol-yoq' };

  const rnd = seeded(crypto.randomBytes(8).toString('hex'));
  const mix = {};
  qs.forEach(q => { mix[q.id] = shuffle(q.options.map((_, i) => i), rnd); });

  const sid = 'qs' + crypto.randomBytes(8).toString('hex');
  await store.set(QS + sid, {
    id: sid, quizId: rec.id, studentId: String(studentId),
    qids: qs.map(q => q.id), mix,
    startedAt: nowStamp(opts),
    expiresAt: Date.now() + TTL_MS,
    usedAt: null
  });
  return {
    ok: true,
    id: sid,
    quiz: { id: rec.id, title: rec.title, about: rec.about, pass: rec.pass },
    total: qs.length,
    questions: qs.map(q => ({
      id: q.id, kind: q.kind, text: q.text,
      options: mix[q.id].map(i => q.options[i])
    }))
  };
}

/** Javoblarni baholash — bir sessiya bir marta */
async function submit(store, opts) {
  const sid = String((opts && opts.sessionId) || '');
  if (!/^qs[a-f0-9]{16}$/.test(sid)) return { ok: false, reason: 'format' };
  const ses = await store.get(QS + sid);
  if (!ses) return { ok: false, reason: 'topilmadi' };
  if (ses.usedAt) return { ok: false, reason: 'ishlatilgan' };
  if (Number(ses.expiresAt) && Date.now() > Number(ses.expiresAt)) return { ok: false, reason: 'muddati' };
  /* Sessiya boshqa o'quvchiniki bo'lsa — hech qachon baholanmaydi */
  if (String(ses.studentId) !== String((opts && opts.studentId) || '')) {
    return { ok: false, reason: 'begona' };
  }

  const answers = {};
  (Array.isArray(opts.answers) ? opts.answers : []).forEach(a => {
    if (a && a.id != null) answers[String(a.id)] = Number(a.choice);
  });

  let score = 0;
  const detail = [];
  for (const qid of ses.qids) {
    const q = await store.get(QQ + qid);
    if (!q) continue;
    const map = (ses.mix && ses.mix[qid]) || null;
    const shown = answers[qid];
    const real = (map && Number.isInteger(shown) && shown >= 0 && shown < map.length)
      ? Number(map[shown]) : shown;
    const ok = real === Number(q.answer);
    if (ok) score++;
    detail.push({ id: qid, ok });
  }
  const total = ses.qids.length;
  const percent = total ? Math.round(score / total * 100) : 0;

  ses.usedAt = nowStamp(opts);
  await store.set(QS + sid, ses);

  const quiz = await store.get(QZ + ses.quizId);
  const rec = {
    id: rid('qr'),
    quizId: ses.quizId,
    quizTitle: quiz ? quiz.title : '',
    groupId: quiz ? (quiz.groupId || '') : '',
    topicId: quiz ? (quiz.topicId || '') : '',
    studentId: ses.studentId,
    score, total, percent,
    passed: percent >= num(quiz && quiz.pass, 60),
    sessionId: sid,
    at: nowStamp(opts)
  };
  await store.set(QR + rec.id, rec);
  return { ok: true, result: rec, detail };
}

/* ---------------- Alohida savol (bitta o'quvchiga) ---------------- */

async function sendAsk(store, data, opts) {
  const studentId = txt(data && data.studentId, 60);
  const text = txt(data && data.text, 1500).trim();
  if (!studentId || !text) return { ok: false, reason: 'format' };
  const st = await store.get('students/' + studentId);
  if (!st) return { ok: false, reason: 'topilmadi' };
  const rec = {
    id: rid('ask'), studentId, text,
    groupId: txt(data && data.groupId, 60),
    topicId: txt(data && data.topicId, 60),
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(data && data.due)) ? txt(data.due, 10) : '',
    answerText: '', answeredAt: '',
    by: txt(opts && opts.byUserId, 60),
    byName: txt(opts && opts.byName, 80),
    at: nowStamp(opts)
  };
  await store.set(ASK + rec.id, rec);
  return { ok: true, rec };
}

async function answerAsk(store, aid, studentId, text, opts) {
  const rec = await store.get(ASK + String(aid || ''));
  if (!rec) return { ok: false, reason: 'topilmadi' };
  if (String(rec.studentId) !== String(studentId)) return { ok: false, reason: 'begona' };
  const t = txt(text, 2000).trim();
  if (!t) return { ok: false, reason: 'format' };
  if (rec.answeredAt) return { ok: false, reason: 'javob-berilgan' };
  rec.answerText = t;
  rec.answeredAt = nowStamp(opts);
  await store.set(ASK + rec.id, rec);
  return { ok: true, rec };
}

async function asksForStudent(store, studentId) {
  return (await listCol(store, ASK))
    .filter(a => a.studentId === String(studentId))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 50);
}

/** Eskirgan urinishlarni tozalash */
async function cleanup(store) {
  let n = 0;
  for (const r of await store.list(QS)) {
    const d = r.data;
    if (!d) continue;
    if (Number(d.expiresAt) && Date.now() - Number(d.expiresAt) > 7 * 864e5 && store.del) {
      await store.del(r.path); n++;
    }
  }
  return n;
}

module.exports = {
  QZ, QQ, QS, QR, ASK,
  saveQuiz, removeQuiz, quizWithAnswers, quizzesForStudent,
  start, submit, sendAsk, answerAsk, asksForStudent, cleanup, listCol
};
