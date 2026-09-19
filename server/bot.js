/* Albayan Telegram bot.
   O'quvchi /start bosadi → ism-familiya va guruh kodini yozadi →
   tizimdagi o'quvchi bilan bog'lanadi. Keyin davomat, to'lov va e'lonlarni oladi,
   markazga xabar yozishi mumkin. */
'use strict';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = 'https://api.telegram.org/bot' + TOKEN + '/';

let store, stamp, A;
let offset = 0;
let running = false;

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
async function listCol(name) {
  const rows = await store.list(name + '/');
  return rows.filter(r => r.path.split('/').length === 2).map(r => r.data);
}
async function findStudentByChat(chatId) {
  const students = await listCol('students');
  return students.filter(s => s.telegram && String(s.telegram.id) === String(chatId))[0] || null;
}
function normName(s) {
  return String(s || '').toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[^a-zЀ-ӿ ]/g, '')
    .split(/\s+/).filter(Boolean).sort().join(' ');
}
function nameMatches(a, b) {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const xp = x.split(' '), yp = y.split(' ');
  const common = xp.filter(p => yp.indexOf(p) >= 0).length;
  return common >= Math.min(2, Math.min(xp.length, yp.length));
}

async function getState(chatId) {
  return (await store.get('botstate/' + chatId)) || { chatId: String(chatId), step: 'start' };
}
async function setState(chatId, st) {
  st.chatId = String(chatId);
  st.updatedAt = stamp();
  await store.set('botstate/' + chatId, st);
}

/* ---------------- Matnlar ---------------- */
async function balanceText(student) {
  const invoices = [], payments = [];
  const all = await store.all();
  all.forEach(({ path: p, data }) => {
    if (p.indexOf('invoices/') === 0) Object.values(data.items || {}).forEach(i => invoices.push(i));
    if (p.indexOf('payments/') === 0) Object.values(data.items || {}).forEach(i => payments.push(i));
  });
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
      Object.keys(data.items || {}).forEach(date => {
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

/* ---------------- Ulanish jarayoni ---------------- */
async function handleLinkFlow(chatId, text, from, st, conf) {
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
      'Rahmat, ' + name + '.\n\nEndi <b>guruh kodingizni</b> yozing.\n' +
      'Kod guruh ro’yxatida yozilgan bo’ladi, masalan: <code>A001</code>\n' +
      'Bilmasangiz, administratordan so’rang.');
    return;
  }

  if (st.step === 'group') {
    const code = text.trim().toUpperCase();
    const groups = await listCol('groups');
    const group = groups.filter(g => String(g.code || '').toUpperCase() === code)[0];
    if (!group) {
      await sendMessage(chatId, 'Bunday guruh kodi topilmadi: <b>' + code + '</b>\n' +
        'Kodni tekshirib, qayta yozing.');
      return;
    }
    const mems = (await listCol('memberships')).filter(m => m.groupId === group.id && m.status === 'faol');
    const students = await listCol('students');
    const candidates = [];
    for (const m of mems) {
      const s = students.filter(x => x.id === m.studentId)[0];
      if (!s || (s.telegram && s.telegram.id)) continue;
      if (nameMatches(st.name, s.lastName + ' ' + s.firstName)) candidates.push(s);
    }

    if (candidates.length === 1 && conf.autoApprove) {
      const s = candidates[0];
      s.telegram = {
        id: String(chatId), username: from.username || '',
        name: st.name, linkedAt: stamp()
      };
      await store.set('students/' + s.id, s);
      st.step = 'linked';
      st.studentId = s.id;
      await setState(chatId, st);
      await sendMessage(chatId,
        'Tayyor! Siz <b>' + s.lastName + ' ' + s.firstName + '</b> sifatida ulandingiz.\n' +
        'Endi davomat va to’lovlar haqida xabar olasiz.', MENU);
      return;
    }

    await store.set('botreq/req_' + chatId, {
      id: 'req_' + chatId, chatId: String(chatId), username: from.username || '',
      name: st.name, groupCode: code, groupId: group.id,
      matchStudentId: candidates[0] ? candidates[0].id : null,
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
  const conf = (await settings()).bot || {};
  let st = await getState(chatId);
  const student = await findStudentByChat(chatId);

  if (text === '/start') {
    if (student) {
      st.step = 'linked'; st.studentId = student.id;
      await setState(chatId, st);
      await sendMessage(chatId,
        (conf.welcome || 'Assalomu alaykum!') + '\n\nSiz <b>' + student.lastName + ' ' + student.firstName +
        '</b> sifatida ulangansiz.', MENU);
      return;
    }
    st = { chatId: String(chatId), step: 'name' };
    await setState(chatId, st);
    await sendMessage(chatId,
      (conf.welcome || 'Assalomu alaykum!') + '\n\nIltimos, <b>ism va familiyangizni</b> yozing.');
    return;
  }

  if (!student) {
    if (st.step === 'start') {
      st.step = 'name';
      await setState(chatId, st);
      await sendMessage(chatId, 'Boshlash uchun ism va familiyangizni yozing.');
      return;
    }
    return handleLinkFlow(chatId, text, msg.from || {}, st, conf);
  }

  /* --- Ulangan o'quvchi --- */
  if (st.step === 'writing') {
    await store.set('botin/in_' + Date.now() + '_' + chatId, {
      id: 'in_' + Date.now() + '_' + chatId,
      studentId: student.id, chatId: String(chatId),
      text: text, at: stamp(), status: 'yangi'
    });
    st.step = 'linked';
    await setState(chatId, st);
    await sendMessage(chatId, 'Xabaringiz markazga yuborildi. Tez orada javob beramiz.', MENU);
    return;
  }

  if (text === 'To’lovim' || text === '/tolov') {
    await sendMessage(chatId, await balanceText(student), MENU);
    return;
  }
  if (text === 'Davomatim' || text === '/davomat') {
    await sendMessage(chatId, await attendanceText(student), MENU);
    return;
  }
  if (text === 'Jadvalim' || text === '/jadval') {
    await sendMessage(chatId, await scheduleText(student), MENU);
    return;
  }
  if (text === 'Markazga yozish' || text === '/yozish') {
    st.step = 'writing';
    await setState(chatId, st);
    await sendMessage(chatId, 'Xabaringizni yozing — u markaz administratoriga yetkaziladi.');
    return;
  }

  await sendMessage(chatId, 'Quyidagi tugmalardan birini tanlang.', MENU);
}

/* ---------------- Navbatdagi xabarlarni yuborish ---------------- */
async function flushQueue() {
  const rows = await store.list('botout/');
  const pending = rows.map(r => r.data).filter(m => m && m.status === 'pending');
  for (const m of pending) {
    try {
      await sendMessage(m.chatId, m.text);
      m.status = 'sent';
      m.sentAt = stamp();
    } catch (e) {
      m.status = 'error';
      m.error = String(e.message).slice(0, 140);
    }
    await store.set('botout/' + m.id, m);
  }
  // eski yuborilganlarni tozalash (100 tadan ortig'i)
  const sent = rows.map(r => r.data).filter(m => m && m.status !== 'pending');
  if (sent.length > 100) {
    sent.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    for (const old of sent.slice(0, sent.length - 100)) {
      await store.del('botout/' + old.id);
    }
  }
}

/** Administrator so'rovni tasdiqlaganda — botga xabar berish shu yerda ham ishlaydi */
async function notifyApproved() {
  const reqs = (await store.list('botreq/')).map(r => r.data);
  for (const r of reqs) {
    if (r.status === 'tasdiqlangan' && !r.notified) {
      try {
        await sendMessage(r.chatId, 'Hisobingiz tasdiqlandi! Menyudan foydalanishingiz mumkin.', MENU);
        const st = await getState(r.chatId);
        st.step = 'linked';
        await setState(r.chatId, st);
      } catch (e) { /* jim */ }
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

function start(ctx) {
  store = ctx.store; stamp = ctx.stamp; A = ctx.A;
  if (!TOKEN) { console.log('  Bot: token yo’q, ishga tushmadi.'); return; }
  running = true;
  tg('getMe').then(me => {
    console.log('  Telegram bot ishga tushdi: @' + me.username);
    poll();
    tick();
  }).catch(e => {
    console.error('  Bot ulanmadi: ' + e.message);
    running = false;
  });
}

function stop() { running = false; }

module.exports = { start, stop, nameMatches, normName };
