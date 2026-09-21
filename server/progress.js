/* O'quv hisobotlari: o'quvchi taraqqiyoti, guruh natijalari, davomat va test
   statistikasi. Hammasi SERVERDA hisoblanadi — mijozga tayyor son beriladi,
   shuning uchun o'quvchi o'zining "natijasini" chizib bera olmaydi.          */
'use strict';
const quiz = require('./quiz');
const lms = require('./lms');

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); }
function pct(a, b) { return b ? Math.round(a / b * 100) : null; }

async function listCol(store, col) {
  return (await store.list(col))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean);
}

/* ---------------- Davomat ---------------- */

/** Bitta guruhning oydagi davomat hujjatidan belgilarni chiqarish */
function marksOf(doc, date) {
  if (!doc) return {};
  const out = {};
  const day = doc.items && doc.items[date];
  if (day && day.attendance) {
    Object.keys(day.attendance).forEach(sid => {
      const v = day.attendance[sid];
      out[sid] = String((v && v.status) || v || '');
    });
  }
  const m = doc.marks && doc.marks[date];
  if (m) Object.keys(m).forEach(sid => { if (!out[sid]) out[sid] = String(m[sid] || ''); });
  return out;
}

function allDates(doc) {
  const s = {};
  if (doc && doc.items) Object.keys(doc.items).forEach(d => { s[d] = 1; });
  if (doc && doc.marks) Object.keys(doc.marks).forEach(d => { s[d] = 1; });
  return Object.keys(s).sort();
}

/**
 * Davomat xulosasi. from/to berilmasa — hamma yozuv.
 * @returns {{total, keldi, kelmadi, kechikdi, sababli, percent, last:[]}}
 */
async function attendance(store, opts) {
  const studentId = String((opts && opts.studentId) || '');
  const groupId = String((opts && opts.groupId) || '');
  const from = String((opts && opts.from) || '');
  const to = String((opts && opts.to) || '');

  const docs = (await store.list('lessons/')).map(r => r.data).filter(Boolean);
  const sum = { total: 0, keldi: 0, kelmadi: 0, kechikdi: 0, sababli: 0 };
  const last = [];
  for (const doc of docs) {
    const gid = String(doc.id || '').split('__')[0];
    if (groupId && gid !== groupId) continue;
    for (const date of allDates(doc)) {
      if (from && date < from) continue;
      if (to && date > to) continue;
      const marks = marksOf(doc, date);
      const ids = studentId ? (marks[studentId] ? [studentId] : []) : Object.keys(marks);
      for (const sid of ids) {
        const v = marks[sid];
        if (!v) continue;
        sum.total++;
        if (sum[v] != null) sum[v]++;
        if (studentId) last.push({ date, groupId: gid, status: v });
      }
    }
  }
  last.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const came = sum.keldi + sum.kechikdi;
  return Object.assign({}, sum, { percent: pct(came, sum.total), last: last.slice(0, 20) });
}

/* ---------------- Testlar ---------------- */

async function quizStats(store, opts) {
  const studentId = String((opts && opts.studentId) || '');
  const groupId = String((opts && opts.groupId) || '');
  const rows = (await listCol(store, quiz.QR)).filter(r =>
    (!studentId || r.studentId === studentId) &&
    (!groupId || r.groupId === groupId));
  const n = rows.length;
  const avg = n ? Math.round(rows.reduce((s, r) => s + num(r.percent), 0) / n) : null;
  const passed = rows.filter(r => r.passed).length;
  return {
    count: n, avgPercent: avg, passed,
    passRate: pct(passed, n),
    last: rows.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 15)
      .map(r => ({
        quizId: r.quizId, title: r.quizTitle, score: r.score, total: r.total,
        percent: r.percent, passed: !!r.passed, at: r.at, studentId: r.studentId
      }))
  };
}

/* ---------------- Uy vazifasi ---------------- */

async function homeworkStats(store, studentId) {
  const hw = await lms.homeworkForStudent(store, studentId, 100);
  const asks = await quiz.asksForStudent(store, studentId);
  const answered = asks.filter(a => a.answeredAt).length;
  return {
    lessons: hw.length,
    asks: asks.length,
    asksAnswered: answered,
    askRate: pct(answered, asks.length)
  };
}

/* ---------------- O'quvchi taraqqiyoti ---------------- */

async function forStudent(store, studentId, opts) {
  const st = await store.get('students/' + String(studentId || ''));
  if (!st) return null;
  const mems = (await listCol(store, 'memberships/'))
    .filter(m => m.studentId === st.id && m.status !== 'chiqdi');
  const groups = [];
  for (const m of mems) {
    const g = await store.get('groups/' + m.groupId);
    if (g) groups.push({ id: g.id, name: g.name || '', code: g.code || '', level: g.level || '' });
  }
  const att = await attendance(store, { studentId: st.id, from: opts && opts.from, to: opts && opts.to });
  const qz = await quizStats(store, { studentId: st.id });
  const hw = await homeworkStats(store, st.id);
  const place = (await listCol(store, 'placements/'))
    .filter(p => p.studentId === st.id)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
  const mk = (await listCol(store, lms.MKP)).filter(m => m.studentId === st.id);

  return {
    student: { id: st.id, name: [st.lastName, st.firstName].filter(Boolean).join(' ') || st.name || '' },
    groups,
    level: (place && place.level) || st.level || '',
    attendance: att,
    quizzes: qz,
    homework: hw,
    makeups: {
      offered: mk.length,
      done: mk.filter(m => m.status === 'bajarildi').length,
      open: mk.filter(m => m.status === 'taklif' || m.status === 'tasdiq').length
    }
  };
}

/* ---------------- Guruh hisoboti ---------------- */

async function forGroup(store, groupId, opts) {
  const g = await store.get('groups/' + String(groupId || ''));
  if (!g) return null;
  const mems = (await listCol(store, 'memberships/'))
    .filter(m => m.groupId === g.id && m.status !== 'chiqdi');
  const rows = [];
  for (const m of mems) {
    const st = await store.get('students/' + m.studentId);
    if (!st) continue;
    const att = await attendance(store, { studentId: st.id, groupId: g.id, from: opts && opts.from, to: opts && opts.to });
    const qz = await quizStats(store, { studentId: st.id, groupId: g.id });
    rows.push({
      studentId: st.id,
      name: [st.lastName, st.firstName].filter(Boolean).join(' ') || st.name || '',
      lessons: att.total,
      attendPercent: att.percent,
      missed: att.kelmadi,
      quizCount: qz.count,
      quizAvg: qz.avgPercent
    });
  }
  rows.sort((a, b) => (b.attendPercent || 0) - (a.attendPercent || 0));
  const withAtt = rows.filter(r => r.attendPercent != null);
  const withQz = rows.filter(r => r.quizAvg != null);
  const logs = await lms.logsOfGroup(store, g.id, 200);
  const fb = await lms.feedbackSummary(store, { groupId: g.id });

  return {
    group: { id: g.id, name: g.name || '', code: g.code || '', level: g.level || '' },
    students: rows,
    avgAttend: withAtt.length
      ? Math.round(withAtt.reduce((s, r) => s + r.attendPercent, 0) / withAtt.length) : null,
    avgQuiz: withQz.length
      ? Math.round(withQz.reduce((s, r) => s + r.quizAvg, 0) / withQz.length) : null,
    lessonsLogged: logs.length,
    lastLesson: logs[0] || null,
    feedback: { count: fb.count, avg: fb.avg }
  };
}

/* ---------------- Markaz bo'yicha umumiy ---------------- */

async function overview(store, opts) {
  const groups = (await listCol(store, 'groups/')).filter(g => g.status !== 'yopilgan');
  const out = [];
  for (const g of groups) {
    const r = await forGroup(store, g.id, opts);
    if (r) out.push({
      id: g.id, name: r.group.name, code: r.group.code,
      students: r.students.length,
      avgAttend: r.avgAttend, avgQuiz: r.avgQuiz,
      lessonsLogged: r.lessonsLogged,
      feedback: r.feedback
    });
  }
  const qz = await quizStats(store, {});
  const att = await attendance(store, { from: opts && opts.from, to: opts && opts.to });
  return {
    groups: out.sort((a, b) => (b.avgAttend || 0) - (a.avgAttend || 0)),
    attendance: { total: att.total, percent: att.percent },
    quizzes: { count: qz.count, avgPercent: qz.avgPercent, passRate: qz.passRate }
  };
}

module.exports = { attendance, quizStats, homeworkStats, forStudent, forGroup, overview };
