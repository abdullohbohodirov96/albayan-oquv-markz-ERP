/* O'quvchi kabineti: shaxsiy kod bo'yicha ma'lumot.
   Bir joyda hisoblanadi — Telegram bot ham, saytdagi sahifa ham shuni ishlatadi.

   Kod: 4 xonali raqam (masalan 4077). Har bir o'quvchida bitta, takrorlanmaydi.
   Kod maxfiy emas, lekin taxmin qilib topish mumkin — shuning uchun so'rovlar
   cheklanadi (index.js dagi kabinetGate) va javobda telefon, ota-ona ma'lumoti,
   manzil kabi shaxsiy tafsilotlar YUBORILMAYDI.                               */
'use strict';
const { A } = require('./shared');

const CODE_LEN = 4;
const MIN = Math.pow(10, CODE_LEN - 1);          // 1000
const MAX = Math.pow(10, CODE_LEN) - 1;          // 9999

function normCode(t) {
  return String(t == null ? '' : t).replace(/\D/g, '');
}
function validCode(c) {
  return new RegExp('^\\d{' + CODE_LEN + '}$').test(String(c || ''));
}

/** Band bo'lmagan yangi kod tanlash */
function pickCode(taken) {
  const free = [];
  for (let n = MIN; n <= MAX; n++) {
    const c = String(n);
    if (!taken[c]) free.push(c);
    if (free.length > 500) break;                 // hammasini yig'ish shart emas
  }
  if (!free.length) return null;                  // bo'sh kod qolmagan (9000 ta o'quvchi)
  return free[Math.floor(Math.random() * free.length)];
}

async function studentsOf(store) {
  return (await store.list('students/'))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean);
}

/** Kodlar jadvali: { '4077': 'st_1' } */
function codeMap(students) {
  const m = {};
  students.forEach(s => { if (s && validCode(s.code)) m[String(s.code)] = s.id; });
  return m;
}

/** Bitta o'quvchiga kod berish (bor bo'lsa — o'sha qoladi) */
async function ensureCode(store, student, opts) {
  if (!student) return null;
  if (validCode(student.code) && !(opts && opts.force)) return student.code;
  const students = await studentsOf(store);
  const taken = codeMap(students.filter(s => s.id !== student.id));
  const code = pickCode(taken);
  if (!code) return null;
  return code;
}

/** Kodsiz qolgan o'quvchilarga kod berish (bir marta, server ishga tushganda) */
async function ensureAllCodes(store) {
  const students = await studentsOf(store);
  const taken = codeMap(students);
  let added = 0;
  for (const s of students) {
    if (validCode(s.code)) continue;
    const code = pickCode(taken);
    if (!code) break;
    taken[code] = s.id;
    s.code = code;
    await store.set('students/' + s.id, s);
    added++;
  }
  return added;
}

async function byCode(store, code) {
  const c = normCode(code);
  if (!validCode(c)) return null;
  const students = await studentsOf(store);
  return students.filter(s => String(s.code || '') === c && s.status !== 'o’chirilgan')[0] || null;
}

/* ---------------- Ma'lumot ---------------- */

async function listCol(store, name) {
  return (await store.list(name + '/'))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean);
}

/** Dars kunlari: [1,3] → "Dushanba, Chorshanba" */
function daysText(days) {
  const names = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
  return (days || []).map(d => names[Number(d) - 1] || '').filter(Boolean).join(', ');
}

/**
 * O'quvchi haqida to'liq ma'lumot.
 * Natija — sof ma'lumot (JSON). Matnga aylantirishni bot yoki sahifa bajaradi.
 */
async function summary(store, student) {
  const today = A.today();
  const settings = (await store.get('meta/settings')) || {};
  const dueDay = Number(settings.dueDay || 5);

  const [memberships, groups, staff, rooms, invoices, payments] = await Promise.all([
    listCol(store, 'memberships'), listCol(store, 'groups'), listCol(store, 'staff'),
    listCol(store, 'rooms'), listCol(store, 'invoices'), listCol(store, 'payments')
  ]);

  const mine = memberships.filter(m => m.studentId === student.id);
  const active = mine.filter(m => m.status !== 'chiqdi');
  const groupById = {};
  groups.forEach(g => { groupById[g.id] = g; });

  const groupList = active.map(m => {
    const g = groupById[m.groupId];
    if (!g) return null;
    const t = staff.filter(x => x.id === g.teacherId)[0];
    const r = rooms.filter(x => x.id === g.roomId)[0];
    return {
      id: g.id, code: g.code || '', name: g.name,
      teacher: t ? t.name : '',
      days: g.days || [], daysText: daysText(g.days),
      startTime: g.startTime || '', endTime: g.endTime || '',
      room: r ? r.name : ''
    };
  }).filter(Boolean);

  /* --- Pul --- */
  const bal = A.balanceOf(student.id, invoices, payments);
  const overdue = A.overdueOf(student.id, invoices, payments, today);
  const paidMap = A.paidByInvoice(payments);
  const open = invoices
    .filter(i => i.studentId === student.id && A.invoiceRemaining(i, paidMap) > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));

  const pad = n => (n < 10 ? '0' + n : '' + n);
  function dueOf(ym) {
    const p = String(ym).split('-');
    const last = new Date(Number(p[0]), Number(p[1]), 0).getDate();
    return ym + '-' + pad(Math.min(dueDay, last));
  }
  let next = null;
  if (open.length) {
    const inv = open[0];
    next = {
      month: inv.month,
      monthLabel: A.monthLabel(inv.month),
      amount: A.invoiceRemaining(inv, paidMap),
      dueDate: dueOf(inv.month),
      group: (groupById[inv.groupId] || {}).name || '',
      overdue: dueOf(inv.month) < today
    };
  } else {
    // qarz yo'q — keyingi hisob qachon chiqadi
    const nextYm = A.addMonths(today.slice(0, 7), 1);
    next = {
      month: nextYm, monthLabel: A.monthLabel(nextYm),
      amount: 0, dueDate: dueOf(nextYm), group: '', overdue: false, upcoming: true
    };
  }

  /* --- Davomat --- */
  const rows = [];
  const all = await store.all();
  const labels = { keldi: 'Keldi', kelmadi: 'Kelmadi', kechikdi: 'Kechikdi', sababli: 'Sababli' };
  for (const m of mine) {
    const g = groupById[m.groupId];
    all.forEach(({ path: p, data }) => {
      if (p.indexOf('lessons/' + m.groupId + '__') !== 0) return;
      const items = (data && data.items) || {};
      Object.keys(items).forEach(date => {
        const att = (items[date].attendance || {})[m.id];
        if (att && att.status) {
          rows.push({ date, status: att.status, group: g ? g.name : '' });
        }
      });
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  const stats = { keldi: 0, kelmadi: 0, kechikdi: 0, sababli: 0 };
  rows.forEach(r => { if (stats[r.status] != null) stats[r.status]++; });
  const total = rows.length;
  const attended = stats.keldi + stats.kechikdi;

  return {
    student: {
      id: student.id,
      code: String(student.code || ''),
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      name: ((student.lastName || '') + ' ' + (student.firstName || '')).trim(),
      status: student.status || 'faol'
    },
    center: { name: settings.centerName || 'AlBayan Cairo', phone: settings.phone || '' },
    groups: groupList,
    finance: {
      charged: bal.charged, received: bal.received,
      debt: bal.debt, advance: bal.advance, overdue: overdue,
      next: next
    },
    attendance: {
      total, attended, missed: stats.kelmadi, late: stats.kechikdi, excused: stats.sababli,
      percent: total ? Math.round(attended * 100 / total) : null,
      last: rows.slice(0, 10).map(r => ({ date: r.date, status: r.status, label: labels[r.status] || r.status, group: r.group }))
    },
    at: A.nowStamp ? A.nowStamp() : today
  };
}

/** Telegram uchun matn ko'rinishi */
function summaryText(sum) {
  const L = [];
  L.push('<b>' + sum.student.name + '</b>  ·  kod: <code>' + sum.student.code + '</code>');
  L.push('');
  if (sum.groups.length) {
    L.push('<b>Guruhlaringiz</b>');
    sum.groups.forEach(g => {
      L.push('• ' + (g.code ? g.code + ' · ' : '') + g.name +
        (g.teacher ? ' — ' + g.teacher : ''));
      const when = [g.daysText, (g.startTime && g.endTime) ? g.startTime + '–' + g.endTime : '']
        .filter(Boolean).join('  ');
      if (when) L.push('   ' + when + (g.room ? '  ·  ' + g.room : ''));
    });
  } else {
    L.push('Hozircha guruhga yozilmagansiz.');
  }
  L.push('');

  const f = sum.finance;
  L.push('<b>To’lov</b>');
  if (f.debt > 0) {
    L.push('Qarz: <b>' + A.som(f.debt) + ' so’m</b>');
    if (f.overdue > 0) L.push('Shundan muddati o’tgan: ' + A.som(f.overdue) + ' so’m');
  } else if (f.advance > 0) {
    L.push('Avans: ' + A.som(f.advance) + ' so’m (oldindan to’langan)');
  } else {
    L.push('Qarzingiz yo’q. Rahmat!');
  }
  if (f.next) {
    if (f.next.upcoming) {
      L.push('Keyingi hisob: ' + f.next.monthLabel + ' — ' + A.dateLabel(f.next.dueDate) + ' gacha');
    } else {
      L.push('Keyingi to’lov: ' + A.som(f.next.amount) + ' so’m — ' +
        A.dateLabel(f.next.dueDate) + ' gacha (' + f.next.monthLabel + ')' +
        (f.next.overdue ? '  ⚠️ muddati o’tgan' : ''));
    }
  }
  L.push('');

  const a = sum.attendance;
  L.push('<b>Davomat</b>');
  if (!a.total) {
    L.push('Hozircha yozuv yo’q.');
  } else {
    L.push('Keldi: ' + a.attended + ' · Kelmadi: ' + a.missed +
      ' · Kechikdi: ' + a.late + ' · Sababli: ' + a.excused);
    L.push('Jami dars: ' + a.total + (a.percent != null ? '  (' + a.percent + '%)' : ''));
    if (a.last.length) {
      L.push('');
      L.push('Oxirgi darslar:');
      a.last.slice(0, 5).forEach(r => L.push('• ' + A.dateLabel(r.date) + ' — ' + r.label));
    }
  }
  return L.join('\n');
}

module.exports = {
  CODE_LEN, normCode, validCode, ensureCode, ensureAllCodes, byCode,
  summary, summaryText, studentsOf, codeMap
};
