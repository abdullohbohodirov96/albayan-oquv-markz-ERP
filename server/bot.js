/* Albayan Telegram bot.
   Ulash: o'quvchiga administrator bir martalik kod beradi (masalan 7KQ3M2).
   O'quvchi /start bosib shu kodni yozadi — faqat shunda hisob bog'lanadi.
   Kodi bo'lmasa, ism va guruh kodini yozadi; ulashni ADMINISTRATOR tasdiqlaydi.
   Ism bo'yicha avtomatik ulash yo'q — chunki ismlar bir xil bo'lishi mumkin.

   Xabarlar: har bir turini alohida yoqish/o'chirish mumkin, takrorlanmaydi,
   yuborilgan/xato holati saqlanadi va xato bo'lsa qayta urinadi.            */
'use strict';

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
  [{ text: 'To’lovim' }, { text: 'Davomatim' }],
  [{ text: 'Jadvalim' }, { text: 'Markazga yozish' }]
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
  return { skipped: false, id };
}

/** Navbatni yuborish: xato bo'lsa belgilaydi va keyin qayta urinadi */
async function flushQueue(now) {
  const conf = await botConf();
  const t = now || Date.now();
  const rows = (await store.list('botout/')).map(r => r.data).filter(Boolean);
  let sent = 0, failed = 0, skipped = 0;

  for (const m of rows) {
    if (m.status !== 'pending' && m.status !== 'error') continue;
    if (m.nextTryAt && Date.parse(m.nextTryAt) > t) continue;
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
        m.nextTryAt = new Date(t + RETRY_MS[Math.min(m.tries, RETRY_MS.length - 1)]).toISOString();
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
  return { sent, failed, skipped };
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
  await sendMessage(chatId,
    'Tayyor! Siz <b>' + rec.lastName + ' ' + rec.firstName + '</b> sifatida ulandingiz.\n' +
    'Endi davomat va to’lovlar haqida xabar olasiz.', MENU);
}

async function handleLinkFlow(chatId, text, from, st) {
  /* 1) Kod kutilmoqda */
  if (st.step === 'code') {
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
    await sendMessage(chatId, 'Kod 6 ta belgidan iborat, masalan: <code>7KQ3M2</code>');
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

/* ---------------- Xabarlarni qayta ishlash ---------------- */
async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = String(msg.text || '').trim();
  const conf = await botConf();
  let st = await getState(chatId);
  const student = await findStudentByChat(chatId);

  if (text === '/start') {
    if (student) {
      st.step = 'linked'; st.studentId = student.id;
      await setState(chatId, st);
      await sendMessage(chatId,
        conf.welcome + '\n\nSiz <b>' + student.lastName + ' ' + student.firstName +
        '</b> sifatida ulangansiz.', MENU);
      return;
    }
    st = { chatId: String(chatId), step: 'code', codeTries: 0 };
    await setState(chatId, st);
    await sendMessage(chatId,
      conf.welcome + '\n\nUlanish uchun administrator bergan <b>6 belgili kodni</b> yozing.\n' +
      'Masalan: <code>7KQ3M2</code>\n\nKodingiz bo’lmasa, <b>ismim</b> deb yozing.');
    return;
  }

  if (!student) {
    if (st.step === 'start') {
      st.step = 'code'; st.codeTries = 0;
      await setState(chatId, st);
      await sendMessage(chatId, 'Boshlash uchun administrator bergan 6 belgili kodni yozing. ' +
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
      const updates = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message && u.message.text) {
          try { await onMessage(u.message); }
          catch (e) { console.error('bot message:', e.message); }
        }
      }
    } catch (e) {
      console.error('bot poll:', e.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

async function tick() {
  while (running) {
    try { await flushQueue(); await notifyApproved(); }
    catch (e) { console.error('bot queue:', e.message); }
    await new Promise(r => setTimeout(r, 5000));
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
    tick();
  }).catch(e => {
    console.error('  Bot ulanmadi: ' + e.message);
    running = false;
  });
}

function stop() {
  running = false;
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
    balanceText, attendanceText, scheduleText, daysBetween, KINDS, MAX_TRIES
  };
}

module.exports = { start, stop, setTransport, makeCode, normCode, _test };
