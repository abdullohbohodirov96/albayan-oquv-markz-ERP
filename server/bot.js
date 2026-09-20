/* Albayan Telegram bot.
   Ulash: o'quvchiga administrator bir martalik kod beradi (masalan 7KQ3M2).
   O'quvchi /start bosib shu kodni yozadi — faqat shunda hisob bog'lanadi.
   Kodi bo'lmasa, ism va guruh kodini yozadi; ulashni ADMINISTRATOR tasdiqlaydi.
   Ism bo'yicha avtomatik ulash yo'q — chunki ismlar bir xil bo'lishi mumkin.

   Xabarlar: har bir turini alohida yoqish/o'chirish mumkin, takrorlanmaydi,
   yuborilgan/xato holati saqlanadi va xato bo'lsa qayta urinadi.            */
'use strict';

const kabinet = require('./kabinet');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = 'https://api.telegram.org/bot' + TOKEN + '/';

let store, stamp, A;
let offset = 0;
let running = false;
let timers = [];

/* Xabar yuborish yo'li. Sinovlarda soxta yo'l qo'yiladi — haqiqiy odamlarga yozilmaydi. */
let transport = null;
function setTransport(fn) { transport = fn; }

const MAX_TRIES = 3;
const RETRY_MS = [0, 60 * 1000, 10 * 60 * 1000];   // 1-urinish darhol, keyin 1 daq, 10 daq
const KINDS = ['davomat', 'tolov', 'qarz', 'elon', 'ulash'];

/* Navbat bo'sh bo'lsa baza shuncha vaqtda bir marta so'raladi (ehtiyot tekshiruvi).
   Yangi xabar yoki tasdiq paydo bo'lsa — kutmasdan uyg'onadi (wake). */
const IDLE_MS = Number(process.env.BOT_IDLE_MS || 10 * 60 * 1000);

/* ---------------- Telegram API ---------------- */
async function tg(method, params) {
  const res = await fetch(API + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  const data = await res.json();
  if (!data.ok) throw new Error(method + ': ' + (data.description || 'xato'));
  return data.result;
}
async function sendMessage(chatId, text, keyboard) {
  if (transport) return transport(chatId, text, keyboard);
  return tg('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: keyboard ? { keyboard: keyboard, resize_keyboard: true } : { remove_keyboard: true }
  });
}

const MENU = [
  [{ text: 'Ma’lumotim' }, { text: 'To’lovim' }],
  [{ text: 'Davomatim' }, { text: 'Jadvalim' }],
  [{ text: 'Markazga yozish' }]
];

/* ---------------- Ma'lumot yordamchilari ---------------- */
async function settings() {
  return (await store.get('meta/settings')) || {};
}
async function botConf() {
  const s = await settings();
  const b = s.bot || {};
  const n = b.notify || {};
  return {
    welcome: b.welcome || 'Assalomu alaykum!',
    username: b.username || '',
    notify: {
      davomat: n.davomat !== false && b.notifyAttendance !== false,
      tolov: n.tolov !== false && b.notifyPayment !== false,
      qarz: n.qarz !== false && b.notifyDebt !== false,
      elon: n.elon !== false,
      ulash: n.ulash !== false
    },
    remindDays: Number(b.remindDays || 3),      // muddatdan necha kun o'tsa eslatiladi
    remindEvery: Number(b.remindEvery || 7)     // necha kunda bir marta
  };
}
async function listCol(name) {
  const rows = await store.list(name + '/');
  return rows.filter(r => r.path.split('/').length === 2).map(r => r.data);
}
async function findStudentByChat(chatId) {
  const students = await listCol('students');
  return students.filter(s => s.telegram && String(s.telegram.id) === String(chatId))[0] || null;
}

async function getState(chatId) {
  return (await store.get('botstate/' + chatId)) || { chatId: String(chatId), step: 'start' };
}
async function setState(chatId, st) {
  st.chatId = String(chatId);
  st.updatedAt = stamp();
  await store.set('botstate/' + chatId, st);
}

/* ---------------- Bir martalik kod ---------------- */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // chalkashadigan harflar yo'q (O/0, I/1)
function makeCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}
function normCode(t) {
  return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
/** Kod bo'yicha o'quvchini topish. Muddati o'tgan yoki ishlatilgan kod yaramaydi. */
async function studentByCode(code) {
  const c = normCode(code);
  if (c.length !== 6) return null;
  const students = await listCol('students');
  const now = Date.now();
  return students.filter(s => {
    const lk = s.botLink;
    if (!lk || normCode(lk.code) !== c) return false;
    if (lk.usedAt) return false;
    if (lk.expiresAt && Date.parse(lk.expiresAt) < now) return false;
    return true;
  })[0] || null;
}

/* ---------------- Shaxsiy kod urinishlari (taxmin qilishdan himoya) ----------------
   Bitta suhbatdan 5 ta noto'g'ri urinishdan keyin 15 daqiqa kutiladi.          */
const codeTries = new Map();
const CODE_MAX = Number(process.env.BOT_CODE_MAX_TRIES || 5);
const CODE_LOCK_MS = Number(process.env.BOT_CODE_LOCK_MS || 15 * 60 * 1000);
function codeGate(chatId) {
  const rec = codeTries.get(String(chatId));
  if (!rec) return { ok: true };
  if (Date.now() - rec.first > CODE_LOCK_MS) { codeTries.delete(String(chatId)); return { ok: true }; }
  if (rec.n < CODE_MAX) return { ok: true };
  return { ok: false, wait: Math.max(1, Math.ceil((CODE_LOCK_MS - (Date.now() - rec.first)) / 60000)) };
}
function codeFail(chatId) {
  const k = String(chatId);
  const rec = codeTries.get(k);
  if (!rec || Date.now() - rec.first > CODE_LOCK_MS) codeTries.set(k, { n: 1, first: Date.now() });
  else rec.n++;
  if (codeTries.size > 5000) codeTries.clear();
}
function codeOk(chatId) { codeTries.delete(String(chatId)); }

/* ---------------- Moliya: har bir yozuv alohida hujjatda ---------------- */
async function finData() {
  const all = await store.all();
  const invoices = [], payments = [];
  all.forEach(({ path: p, data }) => {
    const parts = p.split('/');
    if (parts.length !== 2 || !data) return;
    if (parts[0] === 'invoices') invoices.push(data);
    else if (parts[0] === 'payments') payments.push(data);
  });
  return { invoices, payments };
}

async function balanceText(student) {
  const { invoices, payments } = await finData();
  const bal = A.balanceOf(student.id, invoices, payments);
  const overdue = A.overdueOf(student.id, invoices, payments, A.today());
  const lines = [];
  lines.push('<b>To’lov holati</b>');
  lines.push('Hisoblangan: ' + A.som(bal.charged) + ' so’m');
  lines.push('To’langan: ' + A.som(bal.received) + ' so’m');
  if (bal.debt > 0) {
    lines.push('Qarz: <b>' + A.som(bal.debt) + ' so’m</b>');
    if (overdue > 0) lines.push('Shundan muddati o’tgan: ' + A.som(overdue) + ' so’m');
  } else if (bal.advance > 0) {
    lines.push('Avans: ' + A.som(bal.advance) + ' so’m');
  } else {
    lines.push('Qarzingiz yo’q. Rahmat!');
  }
  const paid = A.paidByInvoice(payments);
  const open = invoices
    .filter(i => i.studentId === student.id && A.invoiceRemaining(i, paid) > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (open.length) {
    lines.push('');
    lines.push('<b>To’lanmagan oylar</b>');
    for (const i of open.slice(0, 6)) {
      const g = await store.get('groups/' + i.groupId);
      lines.push('• ' + A.monthLabel(i.month) + (g ? ' — ' + g.name : '') +
        ': ' + A.som(A.invoiceRemaining(i, paid)) + ' so’m');
    }
  }
  return lines.join('\n');
}

async function attendanceText(student) {
  const mems = (await listCol('memberships')).filter(m => m.studentId === student.id);
  const rows = [];
  const all = await store.all();
  for (const m of mems) {
    const g = await store.get('groups/' + m.groupId);
    all.forEach(({ path: p, data }) => {
      if (p.indexOf('lessons/' + m.groupId + '__') !== 0) return;
      Object.keys((data && data.items) || {}).forEach(date => {
        const att = (data.items[date].attendance || {})[m.id];
        if (att && att.status) rows.push({ date, status: att.status, group: g ? g.name : '' });
      });
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return 'Hozircha davomat yozuvi yo’q.';
  const labels = { keldi: 'Keldi', kelmadi: 'Kelmadi', kechikdi: 'Kechikdi', sababli: 'Sababli' };
  const stats = { keldi: 0, kelmadi: 0, kechikdi: 0, sababli: 0 };
  rows.forEach(r => { if (stats[r.status] != null) stats[r.status]++; });
  const out = ['<b>Oxirgi darslar</b>'];
  rows.slice(0, 10).forEach(r => out.push('• ' + A.dateLabel(r.date) + ' — ' + (labels[r.status] || r.status)));
  out.push('');
  out.push('Jami: keldi ' + stats.keldi + ', kelmadi ' + stats.kelmadi +
    ', kechikdi ' + stats.kechikdi + ', sababli ' + stats.sababli);
  return out.join('\n');
}

async function scheduleText(student) {
  const mems = (await listCol('memberships')).filter(m => m.studentId === student.id && m.status === 'faol');
  if (!mems.length) return 'Siz hozircha guruhga yozilmagansiz.';
  const out = ['<b>Dars jadvalingiz</b>'];
  for (const m of mems) {
    const g = await store.get('groups/' + m.groupId);
    if (!g) continue;
    const days = (g.days || []).map(d => A.WEEKDAYS[d - 1]).join(', ');
    const room = g.roomId ? await store.get('rooms/' + g.roomId) : null;
    out.push('');
    out.push('<b>' + (g.code ? g.code + ' · ' : '') + g.name + '</b>');
    out.push(days + '  ' + g.startTime + '–' + g.endTime);
    if (room) out.push('Xona: ' + room.name);
  }
  return out.join('\n');
}

/* ---------------- Navbat: takrorlanmaslik va qayta urinish ---------------- */

/** Bir xil xabar ikki marta ketmasin */
function dedupeKey(msg) {
  return msg.dedupeKey || (msg.kind + ':' + msg.chatId + ':' + hash(String(msg.text)));
}
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Xabarni navbatga qo'yish. Bir xil kalit bilan yaqinda yuborilgan bo'lsa — qo'yilmaydi.
 * windowMs: shu vaqt ichida takroriy hisoblanadi (standart 24 soat).
 */
async function enqueue(msg, windowMs) {
  const key = dedupeKey(msg);
  const rows = (await store.list('botout/')).map(r => r.data).filter(Boolean);
  const limit = Date.now() - (windowMs == null ? 24 * 3600 * 1000 : windowMs);
  const dup = rows.filter(m => dedupeKey(m) === key &&
    m.status !== 'failed' &&
    Date.parse(m.createdAt || 0) >= limit)[0];
  if (dup) return { skipped: true, id: dup.id };
  const id = msg.id || ('out_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  const rec = Object.assign({
    id, status: 'pending', tries: 0, createdAt: stamp()
  }, msg, { id, dedupeKey: key });
  await store.set('botout/' + id, rec);
  wake();                                   // navbatchi darhol uyg'onadi
  return { skipped: false, id };
}

/* ---------------- Uyg'otish: bo'sh navbat uchun bazani bezovta qilmaymiz ----------------
   Ilgari har 5 soniyada botout/ va botreq/ so'ralardi (soatiga ~1440 so'rov, hech nima
   bo'lmasa ham). Endi: yangi xabar navbatga qo'yilganda yoki administrator tasdiqlaganda
   wake() chaqiriladi; aks holda IDLE_MS da bir marta ehtiyot tekshiruvi bo'ladi. */
let wakeup = null;          // kutayotgan va'dani uyg'otish
let woken = false;          // kutish boshlanmasdan oldin kelgan uyg'otish
function wake() {
  woken = true;
  if (wakeup) { const w = wakeup; wakeup = null; w(); }
}
function waitFor(ms) {
  if (woken) { woken = false; return Promise.resolve(); }
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; woken = false; clearTimeout(t); wakeup = null; resolve(); };
    const t = setTimeout(finish, ms);
    if (t.unref) t.unref();
    wakeup = finish;
  });
}

/** Navbatni yuborish: xato bo'lsa belgilaydi va keyin qayta urinadi */
async function flushQueue(now) {
  const conf = await botConf();
  const t = now || Date.now();
  const rows = (await store.list('botout/')).map(r => r.data).filter(Boolean);
  let sent = 0, failed = 0, skipped = 0;
  let nextAt = 0;                          // keyingi qayta urinish vaqti (uyg'onish uchun)

  for (const m of rows) {
    if (m.status !== 'pending' && m.status !== 'error') continue;
    if (m.nextTryAt && Date.parse(m.nextTryAt) > t) {
      const at = Date.parse(m.nextTryAt);
      if (!nextAt || at < nextAt) nextAt = at;
      continue;
    }
    // xabar turi o'chirilgan bo'lsa — yubormaymiz va shunday deb belgilaymiz
    if (m.kind && conf.notify[m.kind] === false) {
      m.status = 'skipped';
      m.error = 'Bu turdagi xabarlar o’chirilgan.';
      await store.set('botout/' + m.id, m);
      skipped++;
      continue;
    }
    m.tries = (m.tries || 0) + 1;
    try {
      await sendMessage(m.chatId, m.text);
      m.status = 'sent';
      m.sentAt = stamp();
      m.error = '';
      sent++;
    } catch (e) {
      m.error = String(e.message).slice(0, 140);
      if (m.tries >= MAX_TRIES) {
        m.status = 'failed';
        failed++;
      } else {
        m.status = 'error';
        const at = t + RETRY_MS[Math.min(m.tries, RETRY_MS.length - 1)];
        m.nextTryAt = new Date(at).toISOString();
        if (!nextAt || at < nextAt) nextAt = at;
      }
    }
    await store.set('botout/' + m.id, m);
  }

  // eski yozuvlarni tozalash (oxirgi 200 tasi qoladi)
  const done = rows.filter(m => m.status === 'sent' || m.status === 'skipped');
  if (done.length > 200) {
    done.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    for (const old of done.slice(0, done.length - 200)) await store.del('botout/' + old.id);
  }
  return { sent, failed, skipped, nextAt };
}

/**
 * Markaz xodimlariga xabar (masalan saytdagi formadan murojaat kelganda).
 * Chat ID lar sozlamada: bot.staffChats — vergul bilan yoki ro'yxat ko'rinishida.
 * Bot o'chiq bo'lsa yoki ID berilmagan bo'lsa — hech narsa qilinmaydi.
 */
async function notifyStaff(text) {
  if (!store) return { queued: 0, off: true };
  const s = (await store.get('meta/settings')) || {};
  const raw = (s.bot && (s.bot.staffChats || s.bot.adminChatId)) || '';
  const ids = (Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/))
    .map(x => String(x).trim()).filter(Boolean);
  let queued = 0;
  for (const chatId of ids) {
    const r = await enqueue({
      kind: 'elon', chatId, text,
      dedupeKey: 'staff:' + chatId + ':' + hash(String(text))
    }, 5 * 60 * 1000);
    if (!r.skipped) queued++;
  }
  return { queued };
}

/* ---------------- To'lov muddati eslatmasi ---------------- */

/**
 * Muddati o'tgan qarzi bor, botga ulangan o'quvchilarga eslatma.
 * Bir o'quvchiga remindEvery kunda bir martadan ko'p yozilmaydi.
 */
async function remindDebtors(todayIso) {
  const conf = await botConf();
  if (!conf.notify.qarz) return { queued: 0, skipped: 0, off: true };
  const today = todayIso || A.today();
  const { invoices, payments } = await finData();
  const students = (await listCol('students')).filter(s => s.telegram && s.telegram.id);
  const paid = A.paidByInvoice(payments);
  let queued = 0, skipped = 0;

  for (const s of students) {
    const open = invoices.filter(i => i.studentId === s.id && A.invoiceRemaining(i, paid) > 0 && i.dueDate);
    if (!open.length) continue;
    // eng eski muddati o'tgan hisob
    const late = open.filter(i => daysBetween(i.dueDate, today) >= conf.remindDays)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
    if (!late) continue;

    const total = open.reduce((x, i) => x + A.invoiceRemaining(i, paid), 0);
    const text = 'Eslatma: to’lov muddati o’tdi.\n' +
      A.monthLabel(late.month) + ' uchun to’lov muddati: ' + A.dateLabel(late.dueDate) + '\n' +
      'To’lanmagan summa: ' + A.som(total) + ' so’m\n' +
      'Savol bo’lsa, markazga yozing.';

    // kalit: bir o'quvchiga remindEvery kunda bir marta
    const r = await enqueue({
      studentId: s.id, chatId: String(s.telegram.id), text, kind: 'qarz',
      dedupeKey: 'qarz:' + s.id
    }, conf.remindEvery * 24 * 3600 * 1000);
    if (r.skipped) skipped++; else queued++;
  }
  return { queued, skipped };
}

function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso + 'T00:00:00Z'), b = Date.parse(toIso + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return -1;
  return Math.round((b - a) / 86400000);
}

/* ---------------- Ulash jarayoni ---------------- */
async function linkWithCode(chatId, student, from, st) {
  const rec = student;
  rec.telegram = {
    id: String(chatId), username: (from && from.username) || '',
    name: (from && from.first_name) || '', linkedAt: stamp(), via: 'kod'
  };
  rec.botLink = Object.assign({}, rec.botLink, { usedAt: stamp(), usedBy: String(chatId) });
  await store.set('students/' + rec.id, rec);
  st.step = 'linked';
  st.studentId = rec.id;
  await setState(chatId, st);
  // Ulangan zahoti to'liq ma'lumot — qayta so'rash shart emas
  let info = '';
  try { info = kabinet.summaryText(await kabinet.summary(store, rec)); } catch (e) { info = ''; }
  await sendMessage(chatId,
    'Tayyor! Siz <b>' + rec.lastName + ' ' + rec.firstName + '</b> sifatida ulandingiz.\n' +
    (info ? '\n' + info + '\n' : '') +
    '\nEndi davomat va to’lovlar haqida xabar olasiz.', MENU);
}

async function handleLinkFlow(chatId, text, from, st) {
  /* 1) Kod kutilmoqda.
     Ikki xil kod qabul qilinadi:
       — shaxsiy kod: 4 xonali raqam (masalan 4077), o'quvchida doim bitta;
       — bir martalik kod: 6 belgili (eski usul, administrator beradi).       */
  if (st.step === 'code') {
    const digits = kabinet.normCode(text);
    if (kabinet.validCode(digits) && /^\s*\d{4}\s*$/.test(text)) {
      const gate = codeGate(chatId);
      if (!gate.ok) {
        await sendMessage(chatId, 'Juda ko’p urinish. ' + gate.wait +
          ' daqiqadan keyin qayta urinib ko’ring.');
        return;
      }
      const s = await kabinet.byCode(store, digits);
      if (s) { codeOk(chatId); return linkWithCode(chatId, s, from, st); }
      codeFail(chatId);
      st.codeTries = (st.codeTries || 0) + 1;
      await setState(chatId, st);
      await sendMessage(chatId, 'Bunday kod topilmadi. Kodingizni markazdan so’rang.\n' +
        'Kodingiz bo’lmasa, <b>ismim</b> deb yozing.');
      return;
    }
    const code = normCode(text);
    if (code.length === 6) {
      const s = await studentByCode(code);
      if (s) return linkWithCode(chatId, s, from, st);
      st.codeTries = (st.codeTries || 0) + 1;
      await setState(chatId, st);
      if (st.codeTries >= 3) {
        st.step = 'name';
        await setState(chatId, st);
        await sendMessage(chatId,
          'Kod to’g’ri kelmadi. Administrator tasdiqlashi uchun ' +
          '<b>ism va familiyangizni</b> yozing.');
        return;
      }
      await sendMessage(chatId, 'Bunday kod topilmadi yoki muddati o’tgan. ' +
        'Administratordan yangi kod so’rang va qayta yozing.\n' +
        'Kodingiz bo’lmasa, <b>ismim</b> deb yozing.');
      return;
    }
    if (/^ismim/i.test(text.trim())) {
      st.step = 'name';
      await setState(chatId, st);
      await sendMessage(chatId, 'Ism va familiyangizni to’liq yozing.');
      return;
    }
    await sendMessage(chatId, 'Shaxsiy kodingizni yozing — 4 ta raqam, masalan: <code>4077</code>');
    return;
  }

  /* 2) Ism */
  if (st.step === 'name') {
    const name = text.trim();
    if (name.length < 3) {
      await sendMessage(chatId, 'Iltimos, ism va familiyangizni to’liq yozing.');
      return;
    }
    st.name = name;
    st.step = 'group';
    await setState(chatId, st);
    await sendMessage(chatId,
      'Rahmat, ' + name + '.\n\nEndi <b>guruh kodingizni</b> yozing, masalan: <code>B020</code>');
    return;
  }

  /* 3) Guruh kodi → administratorga so'rov */
  if (st.step === 'group') {
    const code = text.trim().toUpperCase();
    const groups = await listCol('groups');
    const group = groups.filter(g => String(g.code || '').toUpperCase() === code)[0];
    if (!group) {
      await sendMessage(chatId, 'Bunday guruh kodi topilmadi: <b>' + code + '</b>\nKodni tekshirib, qayta yozing.');
      return;
    }
    await store.set('botreq/req_' + chatId, {
      id: 'req_' + chatId, chatId: String(chatId), username: (from && from.username) || '',
      name: st.name, groupCode: code, groupId: group.id,
      status: 'kutilmoqda', createdAt: stamp()
    });
    st.step = 'waiting';
    await setState(chatId, st);
    await sendMessage(chatId,
      'So’rovingiz administratorga yuborildi.\n' +
      'U tasdiqlagach, sizga xabar keladi. Rahmat!');
    return;
  }

  if (st.step === 'waiting') {
    await sendMessage(chatId, 'So’rovingiz ko’rib chiqilmoqda. Administrator tasdiqlagach xabar beramiz.');
    return;
  }
}

/* ---------------- Telegram guruhiga ulanish ----------------
   Bot guruhga qo'shilganda guruh NOMIDAGI kodni (4 raqam) topadi va
   o'sha o'quv guruhiga bog'lanadi. Kod topilmasa — qanday qilishni tushuntiradi.
   Ulangach guruhga "ulandim" xabari boradi.                                */

/** Guruh nomidan kodga o'xshash 4 xonali raqamlarni ajratib olish */
function codesInTitle(title) {
  const out = [];
  String(title || '').replace(/\d{4}/g, m => { if (out.indexOf(m) < 0) out.push(m); return m; });
  return out;
}

async function allGroups() {
  const rows = await store.list('groups/');
  return rows.filter(r => r.path.split('/').length === 2).map(r => r.data).filter(Boolean);
}

/** Guruh nomiga qarab o'quv guruhini topish */
async function groupByTitle(title) {
  const codes = codesInTitle(title);
  if (!codes.length) return { error: 'kod-yoq' };
  const groups = await allGroups();
  const hits = groups.filter(g => codes.indexOf(String(g.code || '')) >= 0);
  if (!hits.length) return { error: 'topilmadi', codes };
  if (hits.length > 1) return { error: 'kop', codes };
  return { group: hits[0] };
}

/** Guruhni shu Telegram suhbatiga bog'lash */
async function linkGroupChat(chatId, title) {
  const r = await groupByTitle(title);
  if (r.error === 'kod-yoq') {
    await sendMessage(chatId,
      'Assalomu alaykum! Bu guruhni markazga bog’lash uchun guruh nomiga ' +
      '<b>guruh kodini</b> qo’shing — 4 ta raqam, masalan: <code>Arab tili A1 · 4821</code>\n' +
      'Kodni ERP’dagi guruh sahifasidan olasiz. Nomni o’zgartirgach <code>/ulash</code> deb yozing.');
    return null;
  }
  if (r.error === 'topilmadi') {
    await sendMessage(chatId,
      'Guruh nomidagi kod (' + r.codes.join(', ') + ') markazdagi hech bir guruhga to’g’ri kelmadi. ' +
      'Kodni tekshirib, <code>/ulash</code> deb yozing.');
    return null;
  }
  if (r.error === 'kop') {
    await sendMessage(chatId, 'Nomda bir nechta kod bor. Faqat bittasini qoldiring va <code>/ulash</code> deb yozing.');
    return null;
  }
  const g = r.group;
  const already = String(g.tgChat || '') === String(chatId);
  const rec = Object.assign({}, g, { tgChat: String(chatId), tgTitle: String(title || ''), tgAt: stamp() });
  await store.set('groups/' + g.id, rec);
  await sendMessage(chatId,
    (already ? '✅ Bog’lanish yangilandi' : '✅ Ulandim!') + '\n\n' +
    'Bu guruh <b>' + (g.name || g.id) + '</b> guruhiga bog’landi (kod <code>' + g.code + '</code>).\n' +
    'Endi shu yerga e’lon, dars va to’lov xabarlarini yubora olaman.');
  return rec;
}

/** Guruhdan kelgan xabar/hodisa */
async function onGroupUpdate(chatId, title, text) {
  const t = String(text || '').trim().toLowerCase();
  if (t === '/ulash' || t === '/start' || t.indexOf('/ulash@') === 0 || t.indexOf('/start@') === 0) {
    return linkGroupChat(chatId, title);
  }
  if (t === '/id' || t.indexOf('/id@') === 0) {
    return sendMessage(chatId, 'Suhbat raqami: <code>' + chatId + '</code>');
  }
  return null;
}

/** ERP’dan guruhga xabar yuborish */
async function sendToGroup(group, text) {
  if (!group || !group.tgChat) return { ok: false, error: 'Guruh Telegramga ulanmagan.' };
  await sendMessage(group.tgChat, String(text || '').slice(0, 3500));
  return { ok: true };
}

/* ---------------- Xabarlarni qayta ishlash ---------------- */
async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = String(msg.text || '').trim();
  const conf = await botConf();
  let st = await getState(chatId);
  const student = await findStudentByChat(chatId);

  // Chat ID ni bilish (sozlamalarga yozish uchun) — hamma uchun ochiq, zararsiz
  if (text === '/id') {
    return sendMessage(chatId, 'Shu suhbat raqami (chat ID):\n<code>' + chatId + '</code>\n\n' +
      'Sozlamalar → Telegram bot bo’limiga shu raqamni yozsangiz, saytdagi ' +
      'formadan kelgan murojaatlar shu yerga tushadi.');
  }

  if (text === '/start') {
    if (student) {
      st.step = 'linked'; st.studentId = student.id;
      await setState(chatId, st);
      let info = '';
      try { info = kabinet.summaryText(await kabinet.summary(store, student)); } catch (e) { info = ''; }
      await sendMessage(chatId,
        conf.welcome + '\n\n' + (info || ('Siz <b>' + student.lastName + ' ' + student.firstName +
          '</b> sifatida ulangansiz.')), MENU);
      return;
    }
    st = { chatId: String(chatId), step: 'code', codeTries: 0 };
    await setState(chatId, st);
    await sendMessage(chatId,
      conf.welcome + '\n\n<b>Shaxsiy kodingizni</b> yozing — 4 ta raqam, masalan: <code>4077</code>\n' +
      'Kodni markaz administratoridan olasiz.\n\n' +
      'Kodingiz bo’lmasa, <b>ismim</b> deb yozing.');
    return;
  }

  if (!student) {
    if (st.step === 'start') {
      st.step = 'code'; st.codeTries = 0;
      await setState(chatId, st);
      await sendMessage(chatId, 'Boshlash uchun shaxsiy kodingizni yozing — 4 ta raqam (masalan 4077). ' +
        'Kodingiz bo’lmasa, "ismim" deb yozing.');
      return;
    }
    return handleLinkFlow(chatId, text, msg.from || {}, st);
  }

  /* --- Ulangan o'quvchi --- */
  if (st.step === 'writing') {
    const id = 'in_' + Date.now() + '_' + chatId;
    await store.set('botin/' + id, {
      id, studentId: student.id, chatId: String(chatId),
      text: text, at: stamp(), status: 'yangi'
    });
    st.step = 'linked';
    await setState(chatId, st);
    await sendMessage(chatId, 'Xabaringiz markazga yuborildi. Tez orada javob beramiz.', MENU);
    return;
  }

  if (text === 'Ma’lumotim' || text === '/malumot' || text === '/info') {
    return sendMessage(chatId, kabinet.summaryText(await kabinet.summary(store, student)), MENU);
  }
  if (text === 'To’lovim' || text === '/tolov') return sendMessage(chatId, await balanceText(student), MENU);
  if (text === 'Davomatim' || text === '/davomat') return sendMessage(chatId, await attendanceText(student), MENU);
  if (text === 'Jadvalim' || text === '/jadval') return sendMessage(chatId, await scheduleText(student), MENU);
  if (text === 'Markazga yozish' || text === '/yozish') {
    st.step = 'writing';
    await setState(chatId, st);
    return sendMessage(chatId, 'Xabaringizni yozing — u markaz administratoriga yetkaziladi.');
  }

  return sendMessage(chatId, 'Quyidagi tugmalardan birini tanlang.', MENU);
}

/* ---------------- Administrator tasdig'i ---------------- */
async function notifyApproved() {
  const reqs = (await store.list('botreq/')).map(r => r.data).filter(Boolean);
  for (const r of reqs) {
    if (r.status === 'tasdiqlangan' && !r.notified) {
      try {
        await sendMessage(r.chatId, 'Hisobingiz tasdiqlandi! Menyudan foydalanishingiz mumkin.', MENU);
        const st = await getState(r.chatId);
        st.step = 'linked';
        await setState(r.chatId, st);
      } catch (e) { /* keyingi aylanishda qayta urinadi */ }
      r.notified = true;
      await store.set('botreq/' + r.id, r);
    }
    if (r.status === 'rad' && !r.notified) {
      try {
        await sendMessage(r.chatId, 'Kechirasiz, so’rovingiz tasdiqlanmadi. Administrator bilan bog’laning.');
      } catch (e) { }
      r.notified = true;
      await store.set('botreq/' + r.id, r);
    }
  }
}

/* ---------------- Uzoq so'rov (long polling) ---------------- */
async function poll() {
  while (running) {
    try {
      const updates = await tg('getUpdates', {
        offset, timeout: 25, allowed_updates: ['message', 'my_chat_member']
      });
      for (const u of updates) {
        offset = u.update_id + 1;
        // botni guruhga qo'shishdi — darhol ulashga urinamiz
        const cm = u.my_chat_member;
        if (cm && cm.chat && /group/.test(String(cm.chat.type || '')) &&
          /member|administrator/.test(String((cm.new_chat_member || {}).status || ''))) {
          try { await linkGroupChat(cm.chat.id, cm.chat.title); }
          catch (e) { console.error('bot guruh:', e.message); }
          continue;
        }
        if (u.message && u.message.text) {
          const chat = u.message.chat || {};
          try {
            if (/group/.test(String(chat.type || ''))) await onGroupUpdate(chat.id, chat.title, u.message.text);
            else { await onMessage(u.message); wake(); }
          } catch (e) { console.error('bot message:', e.message); }
        }
      }
    } catch (e) {
      console.error('bot poll:', e.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

/**
 * Navbatchi. Bazani faqat kerak bo'lganda so'raydi:
 *   — uyg'otish kelganda (yangi xabar, administrator tasdig'i, botdagi suhbat);
 *   — qayta urinish vaqti kelganda;
 *   — aks holda IDLE_MS da bir marta (ehtiyot tekshiruvi).
 * Shuning uchun bo'sh turganda baza deyarli bezovta qilinmaydi.
 */
async function queueLoop(opts) {
  const idle = (opts && opts.idleMs) || IDLE_MS;
  while (running) {
    let nextAt = 0;
    try {
      const r = await flushQueue();
      nextAt = r && r.nextAt ? r.nextAt : 0;
      await notifyApproved();
    } catch (e) { console.error('bot queue:', e.message); }
    let waitMs = idle;
    if (nextAt) waitMs = Math.max(500, Math.min(idle, nextAt - Date.now()));
    await waitFor(waitMs);
  }
}

/** Kuniga bir marta qarz eslatmasi */
function startReminders() {
  let lastDay = '';
  const t = setInterval(async () => {
    try {
      const today = A.today();
      if (today === lastDay) return;
      lastDay = today;
      const r = await remindDebtors(today);
      if (r.queued) console.log('  Bot: ' + r.queued + ' ta qarz eslatmasi navbatga qo’yildi.');
    } catch (e) { console.error('bot remind:', e.message); }
  }, 30 * 60 * 1000);
  if (t.unref) t.unref();
  timers.push(t);
}

function start(ctx) {
  store = ctx.store; stamp = ctx.stamp; A = ctx.A;
  if (ctx.send) setTransport(ctx.send);
  if (!TOKEN && !ctx.send) { console.log('  Bot: token yo’q, ishga tushmadi.'); return; }
  running = true;
  startReminders();
  if (ctx.send) return;                       // sinov rejimi: tashqi yuborish
  tg('getMe').then(me => {
    console.log('  Telegram bot ishga tushdi: @' + me.username);
    poll();
    queueLoop();
  }).catch(e => {
    console.error('  Bot ulanmadi: ' + e.message);
    running = false;
  });
}

function stop() {
  running = false;
  wake();                                     // kutayotgan navbatchi darhol to'xtasin
  timers.forEach(t => clearInterval(t));
  timers = [];
}

/** Sinov uchun: ichki funksiyalarni ochamiz (haqiqiy Telegram ishlatilmaydi) */
function _test(ctx) {
  store = ctx.store; stamp = ctx.stamp; A = ctx.A;
  if (ctx.send) setTransport(ctx.send);
  return {
    onMessage, flushQueue, enqueue, remindDebtors, notifyApproved,
    makeCode, normCode, studentByCode, botConf, getState, setState,
    balanceText, attendanceText, scheduleText, daysBetween, KINDS, MAX_TRIES,
    handleLinkFlow, findStudentByChat, notifyStaff,
    linkGroupChat, onGroupUpdate, sendToGroup, codesInTitle,
    wake,
    /** Sinovda navbatchini qo'lda ishga tushirish/to'xtatish */
    startQueue: function (opts) { running = true; queueLoop(opts); },
    stopQueue: function () { running = false; wake(); }
  };
}

module.exports = { start, stop, setTransport, makeCode, normCode, wake, notifyStaff, sendToGroup, _test };
