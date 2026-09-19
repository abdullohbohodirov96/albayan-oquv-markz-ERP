/* Albyana ERP — server: ilova + API + Telegram bot bir jarayonda.
   Ishga tushirish:  node server/index.js                                  */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

try { require('dotenv').config(); } catch (e) { /* dotenv ixtiyoriy */ }

const { createStore } = require('./store');
const { A, writePermFor, readBlocked, safeUser, safeStaff, visibleData } = require('./shared');
const backup = require('./backup');

/** Zaxira faylini xavfsiz o'qish — nomi noto'g'ri bo'lsa null */
function backupReadSafe(name) {
  try { return backup.read(name); } catch (e) { return null; }
}

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const store = createStore();

/* ---------------- Yordamchi ---------------- */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
/** Eski (brauzerda yaratilgan) hisoblar uchun */
function legacyHash(login, pass, salt) {
  return sha256(String(login).toLowerCase() + '::' + pass + '::' + salt);
}

/** Parolni saqlash uchun PBKDF2-SHA256 (sekin, brute-force'ga chidamli) */
const PBKDF2_ITER = 150000;
function pbkdf2(pass, salt, iter) {
  return crypto.pbkdf2Sync(String(pass), String(salt), iter || PBKDF2_ITER, 32, 'sha256').toString('hex');
}
function makePassword(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { algo: 'pbkdf2', iter: PBKDF2_ITER, salt, hash: pbkdf2(pass, salt, PBKDF2_ITER) };
}
function verifyPassword(user, pass) {
  if (!user || !user.hash) return false;
  if (user.algo === 'pbkdf2') {
    const calc = Buffer.from(pbkdf2(pass, user.salt, user.iter), 'hex');
    const want = Buffer.from(String(user.hash), 'hex');
    return calc.length === want.length && crypto.timingSafeEqual(calc, want);
  }
  // eski usul — kirishda avtomatik yangilanadi
  return legacyHash(user.login, pass, user.salt) === user.hash;
}
function stamp() {
  const d = new Date(Date.now() + 5 * 3600 * 1000); // Asia/Tashkent
  const p = n => (n < 10 ? '0' + n : '' + n);
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
    ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
function send(res, code, body, headers) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, Object.assign({
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => {
      d += c;
      if (d.length > 4e6) { reject(new Error('So’rov juda katta')); req.destroy(); }
    });
    req.on('end', () => {
      if (!d) return resolve({});
      try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('Noto’g’ri JSON')); }
    });
    req.on('error', reject);
  });
}

/* ---------------- So'rov cheklovi (webhook uchun) ---------------- */
const intakeHits = new Map();
function intakeAllowed(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim();
  const now = Date.now();
  const rec = intakeHits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  intakeHits.set(ip, rec);
  if (intakeHits.size > 5000) intakeHits.clear();
  return rec.n <= 60;                 // daqiqasiga 60 ta so'rov
}

/* ---------------- Kirish urinishlari cheklovi ---------------- */
const loginTries = new Map();
const MAX_TRIES = 8, LOCK_MS = 10 * 60 * 1000;
function gateKey(req, login) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim();
  return ip + '|' + login;
}
function loginGate(req, login) {
  const rec = loginTries.get(gateKey(req, login));
  if (!rec) return { ok: true };
  if (Date.now() - rec.first > LOCK_MS) return { ok: true };
  if (rec.n < MAX_TRIES) return { ok: true };
  return { ok: false, wait: Math.ceil((LOCK_MS - (Date.now() - rec.first)) / 60000) };
}
function loginFail(req, login) {
  const k = gateKey(req, login);
  const rec = loginTries.get(k);
  if (!rec || Date.now() - rec.first > LOCK_MS) loginTries.set(k, { n: 1, first: Date.now() });
  else rec.n++;
  if (loginTries.size > 5000) loginTries.clear();
}
function loginOk(req, login) { loginTries.delete(gateKey(req, login)); }

/* ---------------- Sessiyalar ---------------- */
const sessions = new Map();               // token -> {userId, at}
const SESSION_MS = Number(process.env.SESSION_MAX_AGE_DAYS || 7) * 864e5;

function newToken() { return crypto.randomBytes(24).toString('hex'); }
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
async function currentUser(req) {
  const token = parseCookies(req).alb_session;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.at > SESSION_MS) { sessions.delete(token); return null; }
  const u = await store.get('users/' + s.userId);
  if (!u || u.active === false) return null;
  return u;
}

/* ---------------- Dastlabki sozlash ---------------- */
/** Eski oylik hujjatlarni alohida yozuvlarga ajratish (bir marta) */
async function migrateMonthDocs() {
  const kinds = ['invoices', 'payments', 'expenses', 'payroll', 'audit'];
  let moved = 0;
  for (const kind of kinds) {
    const rows = await store.list(kind + '/');
    for (const { path: p, data } of rows) {
      if (!data || (!data.items && !data.list)) continue;
      const ym = p.split('/')[1];
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      if (kind === 'audit') {
        for (const e of (data.list || []).slice(0, 500)) {
          const id = e.id || ('log_' + Math.random().toString(36).slice(2, 10));
          if (!(await store.get('audit/' + id))) { await store.set('audit/' + id, Object.assign({}, e, { id, month: ym })); moved++; }
        }
      } else {
        for (const key of Object.keys(data.items || {})) {
          const rec = data.items[key];
          if (!rec || typeof rec !== 'object') continue;
          rec.month = rec.month || ym;
          rec.id = kind === 'payroll' ? ym + '__' + (rec.staffId || key) : (rec.id || key);
          if (!(await store.get(kind + '/' + rec.id))) { await store.set(kind + '/' + rec.id, rec); moved++; }
        }
      }
      await store.del(p);
    }
  }
  if (moved) console.log('  Eski yozuvlar yangi ko’rinishga o’tkazildi: ' + moved + ' ta');
  return moved;
}

async function ensureSeed() {
  await migrateMonthDocs();
  const settings = await store.get('meta/settings');
  if (!settings) {
    await store.set('meta/settings', {
      centerName: process.env.APP_NAME || 'AlBayan Cairo',
      address: '', phone: '', workStart: '08:00', workEnd: '20:00', dueDay: 5,
      expenseCategories: ['Ijara', 'Kommunal', 'Reklama', 'Jihozlar', 'Xo’jalik', 'Ish haqi', 'Boshqa'],
      bot: {
        username: process.env.TELEGRAM_BOT_USERNAME || '',
        welcome: 'Assalomu alaykum! AlBayan Cairo o’quv markazi botiga xush kelibsiz.',
        notifyAttendance: true, notifyPayment: true, notifyDebt: true, autoApprove: false
      },
      createdAt: stamp()
    });
  }
  const funnels = await store.list('funnels/');
  if (!funnels.length) {
    for (const f of A.DEFAULT_FUNNELS) {
      const rec = JSON.parse(JSON.stringify(f));
      rec.intakeKey = crypto.randomBytes(10).toString('hex');
      await store.set('funnels/' + rec.id, rec);
    }
    console.log('  Sotuv voronkalari yaratildi (Asosiy, Target reklama, Instagram)');
  }

  const users = await store.list('users/');
  if (!users.length) {
    const login = (process.env.SEED_DIRECTOR_LOGIN || 'admin').toLowerCase();
    // SEED_DIRECTOR_PASSWORD berilmasa — birinchi kirish uchun oddiy parol (1234).
    // Bu vaqtinchalik: ilova kirgandan keyin uni almashtirishni so'raydi.
    const envPass = process.env.SEED_DIRECTOR_PASSWORD || '';
    const pass = envPass || '1234';
    await store.set('users/usr_admin', Object.assign({
      id: 'usr_admin', login, name: 'Direktor', role: 'direktor', staffId: null,
      active: true, isDefault: !envPass, createdAt: stamp()
    }, makePassword(pass)));
    console.log('  Direktor hisobi yaratildi: ' + login +
      (envPass ? '' : ' (parol: 1234 — kirgandan keyin almashtiring!)'));
  }
}

/* ---------------- Yozuv navbati (bir vaqtda bitta amal) ---------------- */
const locks = new Map();
function withLock(name, fn) {
  const prev = locks.get(name) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(name, next.catch(() => { }));
  return next;
}

/* ---------------- Tarix: faqat server yozadi ---------------- */
async function writeAudit(user, action, entity, details) {
  const id = 'log_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  await store.set('audit/' + id, {
    id, at: stamp(), month: stamp().slice(0, 7),
    by: user ? user.name : 'tizim',
    byLogin: user ? user.login : '',
    role: user ? user.role : '',
    action: String(action || '').slice(0, 120),
    entity: String(entity || '').slice(0, 120),
    details: String(details || '').slice(0, 300)
  });
  // tarix cheksiz o'smasin
  const all = await store.list('audit/');
  if (all.length > 2000) {
    all.sort((a, b) => String(a.data.at).localeCompare(String(b.data.at)));
    for (const old of all.slice(0, all.length - 2000)) await store.del(old.path);
  }
}

/* ---------------- To'lovni serverda yaratish ---------------- */
async function nextReceiptNo(ym) {
  const rows = await store.list('payments/');
  let max = 0;
  rows.forEach(({ data }) => {
    if (!data || data.type === 'refund' || data.month !== ym) return;
    const m = String(data.receiptNo || '').match(/-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return 'ALB-' + ym.replace('-', '') + '-' + String(max + 1).padStart(4, '0');
}

async function createPaymentServer(body, user) {
  const id = String(body.id || '').slice(0, 60) || ('pay_' + Date.now().toString(36));
  const existing = await store.get('payments/' + id);
  if (existing) return existing;                        // takroriy so'rov — bitta yozuv

  const date = String(body.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Sana noto’g’ri.');
  const amount = Math.round(Number(body.amount) || 0);
  if (amount <= 0) throw new Error('Summa noto’g’ri.');
  const student = await store.get('students/' + String(body.studentId || ''));
  if (!student) throw new Error('O’quvchi topilmadi.');

  const type = body.type === 'refund' ? 'refund'
    : (body.type === 'advance' ? 'advance' : 'payment');

  if (type === 'advance') {
    // Avansdan qoplash: yangi pul kirmaydi, faqat oldin olingan pul hisobga yoziladi.
    return await applyAdvanceServer(id, student, body, user);
  }

  if (type === 'refund') {
    if (!A.can(user, 'payment.void')) throw new Error('Pul qaytarish uchun alohida ruxsat kerak.');
    const src = await store.get('payments/' + String(body.refOf || ''));
    if (!src) throw new Error('Asl to’lov topilmadi.');
    if (src.voided) throw new Error('Bekor qilingan to’lovdan qaytarib bo’lmaydi.');
    const rows = await store.list('payments/');
    const done = rows.map(x => x.data)
      .filter(p => p && p.type === 'refund' && p.refOf === src.id && !p.voided)
      .reduce((s, p) => s + Math.round(p.amount), 0);
    const cap = Math.max(0, Math.round(src.amount) - done);
    if (amount > cap) throw new Error('Qaytarish mumkin bo’lgan qoldiq: ' + cap + ' so’m');
  }

  // taqsimotni tekshiramiz — hisobdan ortiq yozilmasin
  const rowsAll = await store.list('payments/');
  const paidMap = {};
  rowsAll.map(x => x.data).forEach(p => {
    if (!p || p.voided) return;
    const sign = p.type === 'refund' ? -1 : 1;
    (p.allocations || []).forEach(a => {
      paidMap[a.invoiceId] = (paidMap[a.invoiceId] || 0) + sign * Math.round(a.amount);
    });
  });
  const allocations = [];
  let allocSum = 0;
  for (const a of (body.allocations || [])) {
    const inv = await store.get('invoices/' + String(a.invoiceId || ''));
    if (!inv) continue;
    if (inv.studentId !== student.id) throw new Error('Hisob boshqa o’quvchiga tegishli.');
    let amt = Math.round(Number(a.amount) || 0);
    if (amt <= 0) continue;
    if (type !== 'refund') {
      const remaining = Math.max(0, Math.round(inv.final) - Math.round(paidMap[inv.id] || 0));
      if (amt > remaining) amt = remaining;
    }
    if (amt <= 0) continue;
    allocations.push({ invoiceId: inv.id, amount: amt });
    allocSum += amt;
  }
  if (allocSum > amount) throw new Error('Taqsimlangan summa to’lovdan ko’p.');

  const ym = date.slice(0, 7);
  const rec = {
    id, type, studentId: student.id, amount, date, month: ym,
    method: ['naqd', 'karta', 'bank'].indexOf(body.method) >= 0 ? body.method : 'naqd',
    note: String(body.note || '').slice(0, 300),
    allocations,
    receiptNo: await nextReceiptNo(ym),
    createdAt: stamp(), createdBy: user.name, createdById: user.id,
    refOf: body.refOf || null,
    fromAdvance: body.fromAdvance === true
  };
  await store.set('payments/' + id, rec);
  await writeAudit(user, type === 'refund' ? 'Pul qaytarildi' : 'To’lov qabul qilindi',
    rec.receiptNo, rec.amount + ' so’m');
  return rec;
}


/** O'quvchining ishlatilmagan avansi: olingan pul − hisoblarga yozilgani */
async function advanceOf(studentId) {
  const rows = (await store.list('payments/')).map(x => x.data)
    .filter(p => p && !p.voided && p.studentId === studentId);
  let received = 0, allocated = 0;
  rows.forEach(p => {
    const sign = p.type === 'refund' ? -1 : 1;
    if (p.type !== 'advance') received += sign * Math.round(p.amount || 0);
    (p.allocations || []).forEach(a => { allocated += sign * Math.round(a.amount || 0); });
  });
  return { received, allocated, advance: Math.max(0, received - allocated) };
}

/**
 * Avansdan qoplash. Yangi daromad EMAS: yozuvning summasi 0,
 * faqat taqsimot yoziladi — qarz ham, avans ham shuncha kamayadi.
 */
async function applyAdvanceServer(id, student, body, user) {
  const date = String(body.date || '').slice(0, 10);
  const bal = await advanceOf(student.id);
  if (bal.advance <= 0) throw new Error('Bu o’quvchida avans yo’q.');

  // hisoblarning qoldig'ini hisoblaymiz
  const rows = (await store.list('payments/')).map(x => x.data);
  const paidMap = {};
  rows.forEach(p => {
    if (!p || p.voided) return;
    const sign = p.type === 'refund' ? -1 : 1;
    (p.allocations || []).forEach(a => {
      paidMap[a.invoiceId] = (paidMap[a.invoiceId] || 0) + sign * Math.round(a.amount);
    });
  });

  const allocations = [];
  let sum = 0;
  for (const a of (body.allocations || [])) {
    const inv = await store.get('invoices/' + String(a.invoiceId || ''));
    if (!inv) continue;
    if (inv.studentId !== student.id) throw new Error('Hisob boshqa o’quvchiga tegishli.');
    const remaining = Math.max(0, Math.round(inv.final) - Math.round(paidMap[inv.id] || 0));
    let amt = Math.min(Math.round(Number(a.amount) || 0), remaining, bal.advance - sum);
    if (amt <= 0) continue;
    allocations.push({ invoiceId: inv.id, amount: amt });
    sum += amt;
  }
  if (!allocations.length) throw new Error('Qoplash uchun ochiq hisob yo’q.');

  const ym = date.slice(0, 7);
  const rec = {
    id, type: 'advance', studentId: student.id,
    amount: 0,                       // yangi pul emas — hisobotlarda daromad sifatida ko'rinmaydi
    applied: sum,                    // avansdan ishlatilgan summa
    date, month: ym, method: 'avans',
    note: String(body.note || '').slice(0, 300),
    allocations,
    receiptNo: await nextReceiptNo(ym),
    createdAt: stamp(), createdBy: user.name, createdById: user.id,
    fromAdvance: true
  };
  await store.set('payments/' + id, rec);
  await writeAudit(user, 'Avansdan qoplandi', rec.receiptNo, sum + ' so’m');
  return rec;
}

async function generateInvoicesServer(ym, user) {
  const settings = (await store.get('meta/settings')) || {};
  const groups = {}, students = {};
  (await store.list('groups/')).forEach(x => { groups[x.data.id] = x.data; });
  (await store.list('students/')).forEach(x => { students[x.data.id] = x.data; });
  const mems = (await store.list('memberships/')).map(x => x.data);
  let created = 0, skipped = 0;
  const errors = [];

  for (const m of mems) {
    try {
      if (m.status !== 'faol' || !A.membershipActiveIn(m, ym)) continue;
      const g = groups[m.groupId], st = students[m.studentId];
      if (!g || !st || st.status === 'arxiv' || g.status === 'rejalashtirilgan') continue;
      if (g.startDate && g.startDate > A.monthEnd(ym)) continue;
      const id = A.invoiceId(m.id, ym);
      if (await store.get('invoices/' + id)) { skipped++; continue; }
      const amt = A.invoiceAmountFor(g, m, ym);
      let due = A.dueDateFor(ym, settings.dueDay || 5);
      if (m.joinedAt && m.joinedAt > due) due = A.addDays(m.joinedAt, 7);
      await store.set('invoices/' + id, {
        id, membershipId: m.id, studentId: m.studentId, groupId: m.groupId, month: ym,
        base: amt.base, discount: amt.discount, final: amt.final,
        dueDate: due, createdAt: stamp(), createdBy: user ? user.name : 'tizim', note: ''
      });
      created++;
    } catch (e) {
      errors.push(String(e.message));
    }
  }
  if (created) await writeAudit(user, 'Oylik hisoblar yaratildi', ym, created + ' ta');
  return { created, skipped, errors };
}


/* ---------------- Oylik hisoblarni avtomatik yaratish ---------------- */
/**
 * Sozlamalarda yoqilgan bo'lsa, har oy boshida hisoblar o'zi yaratiladi.
 * Natija meta/autoinvoice ichida saqlanadi — direktor sozlamalarda ko'radi.
 */
async function autoInvoiceTick() {
  const settings = (await store.get('meta/settings')) || {};
  const conf = settings.autoInvoice || {};
  if (conf.enabled !== true) return { off: true };

  const day = Math.min(28, Math.max(1, Number(conf.day || 1)));
  const now = new Date(Date.now() + 5 * 3600 * 1000);       // Asia/Tashkent
  const today = now.getUTCDate();
  const ym = A.thisMonth();
  const state = (await store.get('meta/autoinvoice')) || {};
  if (today < day) return { waiting: true, day };
  if (state.lastMonth === ym) return { done: true, month: ym };

  try {
    const r = await withLock('invoices', () => generateInvoicesServer(ym, null));
    const next = {
      lastMonth: ym, lastRunAt: stamp(),
      created: r.created, skipped: r.skipped,
      errors: (r.errors || []).slice(0, 10), lastError: ''
    };
    await store.set('meta/autoinvoice', next);
    console.log('  Oylik hisoblar avtomatik yaratildi: ' + r.created + ' ta (' + ym + ')');
    await notifyDirectors('Oylik hisoblar avtomatik yaratildi: ' + r.created + ' ta (' +
      ym + '). ' + (r.errors && r.errors.length ? 'Xatolar: ' + r.errors.length + ' ta.' : ''));
    return next;
  } catch (e) {
    const next = Object.assign({}, state, { lastError: String(e.message), lastErrorAt: stamp() });
    await store.set('meta/autoinvoice', next);
    await notifyDirectors('Oylik hisoblarni avtomatik yaratishda xato: ' + e.message);
    return next;
  }
}

/** Direktorga ichki suhbat orqali xabar */
async function notifyDirectors(text) {
  try {
    const users = (await store.list('users/')).map(x => x.data);
    for (const d of users.filter(u => u.role === 'direktor' && u.active !== false)) {
      const id = 'sys__' + d.id;
      const doc = (await store.get('chats/' + id)) ||
        { id, type: 'direct', title: 'Tizim xabarlari', members: [d.id], messages: [], readAt: {} };
      doc.messages = (doc.messages || []).concat([{
        id: 'msg_' + Date.now().toString(36), from: 'system', text, at: stamp()
      }]).slice(-50);
      doc.updatedAt = stamp();
      await store.set('chats/' + id, doc);
    }
  } catch (e) { /* xabar yetmasa ham ish to'xtamaydi */ }
}

function startAutoInvoice() {
  const t = setInterval(() => {
    autoInvoiceTick().catch(e => console.error('auto invoice:', e.message));
  }, Number(process.env.AUTO_INVOICE_CHECK_MS || 6 * 60 * 60 * 1000));
  if (t.unref) t.unref();
  autoInvoiceTick().catch(() => { });
  return t;
}

/* ---------------- Bitta hujjatni o'qish huquqi ---------------- */
async function teacherScope(user) {
  if (user.role !== 'oqituvchi') return null;
  const groups = (await store.list('groups/')).map(x => x.data)
    .filter(g => g && g.teacherId === user.staffId);
  const gid = {};
  groups.forEach(g => { gid[g.id] = 1; });
  const sid = {};
  (await store.list('memberships/')).map(x => x.data).forEach(m => {
    if (m && gid[m.groupId]) sid[m.studentId] = 1;
  });
  return { gid, sid };
}

/** false — ruxsat yo'q; aks holda ko'rsatish mumkin bo'lgan ma'lumot */
async function filterReadDoc(user, p, data) {
  const seg = p.split('/');
  const col = seg[0];
  const need = {
    invoices: 'finance.debts', payments: 'finance.payments',
    expenses: 'finance.expenses', payroll: 'finance.payroll',
    audit: 'settings.edit', leads: 'nav.leads', funnels: 'nav.leads',
    botreq: 'nav.bot', botout: 'nav.bot', botin: 'nav.bot',
    students: 'student.view', groups: 'group.view', memberships: 'group.view',
    courses: 'group.view', rooms: 'group.view'
  }[col];
  if (need && !A.can(user, need)) return false;
  if (col === 'users') return A.can(user, 'users.manage') || (data && data.id === user.id)
    ? safeUser(data)
    : (data ? { id: data.id, name: data.name, role: data.role } : null);
  if (col === 'staff') return safeStaff(data, user);
  if (!data) return null;

  if (user.role === 'oqituvchi') {
    const sc = await teacherScope(user);
    if (col === 'groups' && !sc.gid[data.id]) return false;
    if (col === 'memberships' && !sc.gid[data.groupId]) return false;
    if (col === 'students' && !sc.sid[data.id]) return false;
    if (col === 'lessons') {
      const gidPart = String(seg[1] || '').split('__')[0];
      if (!sc.gid[gidPart]) return false;
    }
  }
  return data;
}

/* ---------------- API ---------------- */
const COLLECTIONS = ['users', 'staff', 'courses', 'rooms', 'students', 'groups', 'memberships',
  'leads', 'funnels', 'tasks', 'chats', 'botreq', 'botout', 'botin',
  'invoices', 'payments', 'expenses', 'payroll', 'audit'];

async function apiBootstrap(user) {
  const all = await store.all();
  const v = visibleData(user, all);
  const col = {};
  COLLECTIONS.forEach(c => { col[c] = v.col[c] || {}; });
  return {
    settings: v.settings,
    col,
    docs: v.docs,
    me: safeUser(user),
    serverTime: stamp()
  };
}

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/^\/api\//, '');

  if (route === 'health') return send(res, 200, { ok: true, mode: store.kind });

  /* --- Tashqi murojaat qabul qilish (Instagram, target reklama, sayt formasi) --- */
  if (route.indexOf('intake/') === 0 && req.method === 'POST') {
    const key = route.slice('intake/'.length);
    if (!key || key.length < 8) return send(res, 400, { error: 'Kalit noto’g’ri.' });
    if (!intakeAllowed(req)) return send(res, 429, { error: 'Juda ko’p so’rov.' });

    const funnels = (await store.list('funnels/')).map(x => x.data);
    const funnel = funnels.filter(f => f.intakeKey === key)[0];
    if (!funnel) return send(res, 404, { error: 'Voronka topilmadi.' });

    const body = await readBody(req);
    const text = String(body.text || body.message || body.comment || '');
    const phone = A.normPhone(String(body.phone || body.telefon || '')) || A.extractPhone(text);
    const name = String(body.name || body.full_name || body.ism || '').trim() ||
      (body.username ? '@' + body.username : '') || 'Noma’lum';
    if (!phone && !text && name === 'Noma’lum') {
      return send(res, 400, { error: 'Ism yoki telefon kerak.' });
    }

    // takroriy raqamni qayta yaratmaymiz
    const leads = (await store.list('leads/')).map(x => x.data);
    const digits = A.phoneDigits(phone);
    const dup = digits ? leads.filter(l => A.phoneDigits(l.phone) === digits && l.funnelId === funnel.id)[0] : null;
    if (dup) return send(res, 200, { ok: true, duplicate: true, id: dup.id });

    const stages = A.funnelStages(funnel);
    const id = 'led_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await store.set('leads/' + id, {
      id, funnelId: funnel.id,
      name, phone,
      courseId: '', source: String(body.source || funnel.autoSource || 'Webhook'),
      ownerStaffId: '', stage: stages[0] ? stages[0].id : 'yangi',
      note: text.slice(0, 500),
      nextContact: new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10),
      createdAt: stamp(), viaIntake: true
    });
    return send(res, 200, { ok: true, id });
  }

  if (route === 'login' && req.method === 'POST') {
    const body = await readBody(req);
    const login = String(body.login || '').toLowerCase().trim();
    const pass = String(body.password || '');
    const gate = loginGate(req, login);
    if (!gate.ok) {
      return send(res, 429, { error: 'Juda ko’p urinish. ' + gate.wait + ' daqiqadan keyin qayta urinib ko’ring.' });
    }
    const users = await store.list('users/');
    const u = users.map(x => x.data).filter(x => String(x.login).toLowerCase() === login)[0];
    if (!u || u.active === false || !verifyPassword(u, pass)) {
      loginFail(req, login);
      await new Promise(r => setTimeout(r, 350));         // taxmin qilishni sekinlashtirish
      return send(res, 401, { error: 'Login yoki parol xato.' });
    }
    loginOk(req, login);
    // eski hash bo'lsa — jim yangilaymiz
    if (u.algo !== 'pbkdf2') {
      Object.assign(u, makePassword(pass));
      u.isDefault = u.isDefault === true && pass === '1234';
      await store.set('users/' + u.id, u);
    }
    const token = newToken();
    sessions.set(token, { userId: u.id, at: Date.now() });
    return send(res, 200, { user: safeUser(u) }, {
      'Set-Cookie': 'alb_session=' + token + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' +
        Math.floor(SESSION_MS / 1000) + (process.env.NODE_ENV === 'production' ? '; Secure' : '')
    });
  }

  if (route === 'logout' && req.method === 'POST') {
    const token = parseCookies(req).alb_session;
    if (token) sessions.delete(token);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'alb_session=; HttpOnly; Path=/; Max-Age=0' });
  }

  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Kirish talab qilinadi.' });

  if (route === 'me') return send(res, 200, { user: safeUser(user) });
  if (route === 'bootstrap') return send(res, 200, await apiBootstrap(user));

  /* ---------- To'lov: faqat server yozadi ---------- */
  if (route === 'payment' && req.method === 'POST') {
    if (!A.can(user, 'payment.create')) return send(res, 403, { error: 'Sizda to’lov qabul qilish ruxsati yo’q.' });
    const body = await readBody(req);
    try {
      const rec = await withLock('payments', () => createPaymentServer(body, user));
      return send(res, 200, { payment: rec });
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }

  if (route === 'payment/void' && req.method === 'POST') {
    if (!A.can(user, 'payment.void')) return send(res, 403, { error: 'To’lovni bekor qilish uchun alohida ruxsat kerak.' });
    const body = await readBody(req);
    const reason = String(body.reason || '').trim();
    if (reason.length < 3) return send(res, 400, { error: 'Sababni yozing.' });
    const p = await store.get('payments/' + body.id);
    if (!p) return send(res, 404, { error: 'To’lov topilmadi.' });
    if (p.voided) return send(res, 200, { payment: p });
    p.voided = { reason, by: user.name, at: stamp() };
    await store.set('payments/' + p.id, p);
    await writeAudit(user, 'To’lov bekor qilindi', p.receiptNo, reason);
    return send(res, 200, { payment: p });
  }

  if (route === 'invoices/auto' && req.method === 'GET') {
    if (!A.can(user, 'invoice.create')) return send(res, 403, { error: 'Ruxsat yo’q.' });
    const settings = (await store.get('meta/settings')) || {};
    return send(res, 200, {
      conf: settings.autoInvoice || { enabled: false, day: 1 },
      state: (await store.get('meta/autoinvoice')) || {}
    });
  }
  if (route === 'invoices/auto/run' && req.method === 'POST') {
    if (!A.can(user, 'invoice.create')) return send(res, 403, { error: 'Ruxsat yo’q.' });
    const r = await autoInvoiceTick();
    return send(res, 200, r);
  }

  if (route === 'invoices/generate' && req.method === 'POST') {
    if (!A.can(user, 'invoice.create')) return send(res, 403, { error: 'Ruxsat yo’q.' });
    const body = await readBody(req);
    const ym = String(body.month || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return send(res, 400, { error: 'Oy noto’g’ri.' });
    const r = await withLock('invoices', () => generateInvoicesServer(ym, user));
    return send(res, 200, r);
  }

  /* ---------- Zaxira nusxa va tiklash (faqat sozlamalar ruxsati bilan) ---------- */
  if (route.indexOf('backup') === 0) {
    if (!A.can(user, 'settings.edit')) return send(res, 403, { error: 'Zaxira bilan ishlash uchun ruxsat yo’q.' });

    if (route === 'backup/db' && req.method === 'GET') {
    let stats = null;
    try { stats = store.stats ? await store.stats() : null; } catch (e) { stats = null; }
    if (!stats) {
      const rows = await store.all();
      stats = { rows: rows.length, bytes: Buffer.byteLength(JSON.stringify(rows)), size: null };
    }
    return send(res, 200, { kind: store.kind, stats });
  }

  if (route === 'backup/state' && req.method === 'GET') {
      return send(res, 200, { state: await backup.readState(store), files: backup.list().slice(0, 20) });
    }
    if (route === 'backup/run' && req.method === 'POST') {
      try {
        const r = await withLock('backup', () => backup.makeBackup(store, 'qo’lda'));
        await backup.writeState(store, {
          lastOkDate: new Date().toISOString().slice(0, 10),
          lastOkAt: new Date().toISOString(),
          lastFile: r.name, lastBytes: r.bytes, lastCount: r.count, lastError: '', lastErrorAt: ''
        });
        await writeAudit(user, 'Zaxira nusxa olindi', r.name, r.count + ' yozuv');
        return send(res, 200, { ok: true, file: r });
      } catch (e) {
        await backup.writeState(store, { lastError: String(e.message), lastErrorAt: new Date().toISOString() });
        return send(res, 500, { error: e.message });
      }
    }
    if (route === 'backup/file' && req.method === 'GET') {
      const name = String(url.searchParams.get('name') || '');
      try {
        const dump = backup.read(name);
        return send(res, 200, dump);
      } catch (e) { return send(res, 404, { error: e.message }); }
    }
    if (route === 'backup/preview' && req.method === 'POST') {
      const body = await readBody(req);
      const dump = body.name ? backupReadSafe(body.name) : body.dump;
      if (!dump) return send(res, 400, { error: 'Zaxira berilmadi.' });
      return send(res, 200, await backup.preview(store, dump));
    }
    if (route === 'backup/restore' && req.method === 'POST') {
      const body = await readBody(req);
      if (String(body.confirm || '') !== 'TIKLASH') {
        return send(res, 400, { error: 'Tasdiqlash so’zi noto’g’ri.' });
      }
      const dump = body.name ? backupReadSafe(body.name) : body.dump;
      if (!dump) return send(res, 400, { error: 'Zaxira berilmadi.' });
      try {
        const r = await withLock('backup', () => backup.restore(store, dump));
        await writeAudit(user, 'Ma’lumotlar zaxiradan tiklandi',
          body.name || 'yuklangan fayl', r.restored + ' yozuv tiklandi, ' + r.removed + ' ta olib tashlandi');
        return send(res, 200, r);
      } catch (e) {
        return send(res, 400, { error: e.message, details: e.details || [] });
      }
    }
    return send(res, 404, { error: 'Topilmadi.' });
  }

  if (route === 'collection' && req.method === 'GET') {
    const name = String(url.searchParams.get('name') || '');
    if (COLLECTIONS.indexOf(name) < 0) return send(res, 400, { error: 'Noma’lum ro’yxat.' });
    // ruxsat va ko'rinish qoidalari bootstrap bilan bir xil
    const rows = await store.list(name + '/');
    const v = visibleData(user, rows.concat(
      name === 'students' || name === 'memberships'
        ? (await store.list('groups/')).concat(await store.list('memberships/'))
        : []));
    return send(res, 200, { items: v.col[name] || {} });
  }

  if (route === 'doc') {
    const p = String(url.searchParams.get('path') || '');
    if (!/^[A-Za-z0-9_\-./~:@+]+$/.test(p) || p.split('/').length % 2 !== 0) {
      return send(res, 400, { error: 'Noto’g’ri yo’l.' });
    }
    if (req.method === 'GET') {
      if (readBlocked(p, user)) return send(res, 403, { error: 'Ruxsat yo’q.' });
      const data = await store.get(p);
      const filtered = await filterReadDoc(user, p, data);
      if (filtered === false) return send(res, 403, { error: 'Ruxsat yo’q.' });
      return send(res, 200, { data: filtered });
    }
    const perm = writePermFor(p);
    if (perm === '__server__') return send(res, 403, { error: 'Bu ma’lumotni faqat server yozadi.' });
    if (perm && !A.can(user, perm)) return send(res, 403, { error: 'Sizda bu amal uchun ruxsat yo’q.' });

    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!body || typeof body.data !== 'object' || body.data === null) {
        return send(res, 400, { error: 'Ma’lumot noto’g’ri.' });
      }
      // Parolni FAQAT server hisoblaydi — mijoz hash yubora olmaydi
      if (p.indexOf('users/') === 0) {
        const old = await store.get(p);
        delete body.data.hash; delete body.data.salt; delete body.data.iter; delete body.data.algo;
        const pass = String(body.password || '');
        if (pass) {
          if (pass.length < 4) return send(res, 400, { error: 'Parol kamida 4 belgidan iborat bo’lsin.' });
          Object.assign(body.data, makePassword(pass));
          body.data.isDefault = false;
        } else if (old) {
          body.data.salt = old.salt; body.data.hash = old.hash;
          body.data.iter = old.iter; body.data.algo = old.algo;
          body.data.isDefault = old.isDefault;
        } else {
          return send(res, 400, { error: 'Yangi foydalanuvchi uchun parol kerak.' });
        }
        // o'zini o'zi o'chirib qo'ymasin
        if (old && old.id === user.id && body.data.active === false) {
          return send(res, 400, { error: 'O’z hisobingizni o’chira olmaysiz.' });
        }
      }
      await store.set(p, body.data);
      await writeAudit(user, body.action || 'Ma’lumot saqlandi', body.entity || p, body.details || '');
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      if (p.indexOf('users/') === 0 && p === 'users/' + user.id) {
        return send(res, 400, { error: 'O’z hisobingizni o’chira olmaysiz.' });
      }
      await store.del(p);
      await writeAudit(user, 'Yozuv o’chirildi', p, '');
      return send(res, 200, { ok: true });
    }
  }

  return send(res, 404, { error: 'Topilmadi.' });
}

/* ---------------- Statik fayllar ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8'
};

/**
 * Faqat brauzerga kerakli fayllar tarqatiladi.
 * .env, .git, server kodi, baza va testlar hech qachon berilmaydi.
 */
const PUBLIC_FILES = new Set(['/index.html', '/manifest.webmanifest', '/sw.js', '/favicon.ico']);
const PUBLIC_DIRS = ['/css/', '/js/', '/assets/'];
const ALLOWED_EXT = new Set(['.html', '.js', '.css', '.png', '.jpg', '.svg', '.ico', '.webmanifest']);

function isPublicPath(rel) {
  if (rel.indexOf('\0') >= 0) return false;
  if (rel.indexOf('..') >= 0) return false;
  if (rel.split('/').some(seg => seg.startsWith('.') && seg !== '')) return false;
  if (PUBLIC_FILES.has(rel)) return true;
  if (!PUBLIC_DIRS.some(d => rel.indexOf(d) === 0)) return false;
  if (rel.slice(1).split('/').length > 3) return false;         // chuqur joylashuv yo'q
  return ALLOWED_EXT.has(path.extname(rel).toLowerCase());
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  if (!isPublicPath(rel)) {
    // mavjudligini ham bildirmaymiz
    return send(res, 404, 'Topilmadi');
  }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) {
    return send(res, 404, 'Topilmadi');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      if (rel !== '/index.html') return serveStatic(req, res, '/index.html');
      return send(res, 404, 'Topilmadi');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': rel === '/index.html' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(data);
  });
}

/* ---------------- Server ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  try {
    if (url.pathname.indexOf('/api/') === 0) return await handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message || 'Server xatosi' });
  }
});

(async function start() {
  await ensureSeed();
  server.listen(PORT, () => {
    console.log('\n  AlBayan Cairo ERP ishga tushdi: http://localhost:' + PORT);
    console.log('  Ombor: ' + store.kind + (store.file ? ' (' + store.file + ')' : ''));
  });
  // Kunlik avtomatik zaxira; xato bo'lsa direktorga xabar qoldiriladi
  backup.startSchedule(store, async (err) => {
    await notifyDirectors('Diqqat: kunlik zaxira nusxa olinmadi. Sabab: ' + String(err.message || err));
  });

  // Oylik hisoblarni avtomatik yaratish (sozlamalarda yoqilsa)
  startAutoInvoice();

  if (process.env.TELEGRAM_BOT_TOKEN) {
    require('./bot').start({ store, stamp, A });
  } else {
    console.log('  Telegram bot o’chirilgan (TELEGRAM_BOT_TOKEN berilmagan).\n');
  }
})();

module.exports = { server, store };
