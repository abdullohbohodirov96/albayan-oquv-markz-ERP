/* Albyana ERP — server: ilova + API + Telegram bot bir jarayonda.
   Ishga tushirish:  node server/index.js                                  */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

try { require('dotenv').config(); } catch (e) { /* dotenv ixtiyoriy */ }

const { createStore } = require('./store');
const { A, writePermFor, readBlocked, safeUser, safeStaff, visibleData, GENERAL_CHAT } = require('./shared');
const backup = require('./backup');
const kabinet = require('./kabinet');
const link = require('./link');
const kabsess = require('./kabsess');
const levels = require('./levels');
const files = require('./files');
const curriculum = require('./curriculum');
const lms = require('./lms');
const quiz = require('./quiz');
const progress = require('./progress');
const seo = require('./seo');
const parents = require('./parents');

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
/* ---------------- Javobni siqish ----------------
   Matnli javoblar (JSON, HTML, CSS, JS) tarmoqqa siqilgan holda
   chiqadi. Bu MA'LUMOTGA TEGMAYDI — brauzer uni o'zi ochadi va
   aynan o'sha matnni oladi. Faqat yuborilayotgan bayt kamayadi:
   bir yillik ma'lumotli /api/bootstrap 3 MB dan ~250 KB ga tushadi,
   ya'ni sekin internetda sahifa bir necha barobar tez ochiladi.

   Rasm, shrift va arxiv fayllar siqilmaydi — ular allaqachon siqiq.
   Kichik javoblar ham siqilmaydi: siqish foydasidan ko'ra vaqt
   ko'proq ketadi.                                                  */
const zlib = require('zlib');
const COMPRESS_MIN = Number(process.env.COMPRESS_MIN_BYTES || 1024);
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|manifest\+json|xml)|image\/svg)/i;

function pickEncoding(req) {
  const acc = String((req && req.headers && req.headers['accept-encoding']) || '').toLowerCase();
  if (/\bbr\b/.test(acc)) return 'br';
  if (/\bgzip\b/.test(acc)) return 'gzip';
  return '';
}
function compressBody(enc, buf) {
  try {
    if (enc === 'br') {
      return zlib.brotliCompressSync(buf, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 5,          // tez va yetarlicha kuchli
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length
        }
      });
    }
    if (enc === 'gzip') return zlib.gzipSync(buf, { level: 6 });
  } catch (e) { /* siqib bo'lmasa — xom holda yuboramiz */ }
  return null;
}

/** Javobni kerak bo'lsa siqib yuboradi. `req` berilmasa — siqilmaydi. */
function sendMaybeZip(req, res, code, head, buf) {
  const type = String(head['Content-Type'] || '');
  const enc = COMPRESSIBLE.test(type) && buf.length >= COMPRESS_MIN ? pickEncoding(req) : '';
  /* Vary — oraliq keshlar siqilgan javobni siqilmaganidan ajratsin */
  const out = Object.assign({}, head, { Vary: 'Accept-Encoding' });
  if (enc) {
    const packed = compressBody(enc, buf);
    if (packed && packed.length < buf.length) {
      out['Content-Encoding'] = enc;
      out['Content-Length'] = String(packed.length);
      res.writeHead(code, out);
      return res.end(packed);
    }
  }
  out['Content-Length'] = String(buf.length);
  res.writeHead(code, out);
  return res.end(buf);
}

function send(res, code, body, headers, req) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  const head = Object.assign({
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, headers || {});
  const buf = Buffer.from(data, 'utf8');
  /* So'rov alohida berilmasa — Node javobga ulab qo'ygan so'rovdan
     olamiz (res.req). Shunda barcha yo'llar siqishdan foyda ko'radi. */
  const rq = req || res.req;
  if (rq) return sendMaybeZip(rq, res, code, head, buf);
  head['Content-Length'] = String(buf.length);
  res.writeHead(code, head);
  res.end(buf);
}
/* So'rov tanasi. `max` — ruxsat etilgan eng katta hajm (bayt).
   Fayl yuklash uchun kattaroq beriladi: base64 asl fayldan ~1.37 barobar
   katta bo'ladi, shuning uchun 10 MB fayl ≈ 14 MB so'rov.              */
const BODY_MAX = Number(process.env.BODY_MAX_BYTES || 4e6);
const BODY_MAX_FILE = Number(process.env.BODY_MAX_FILE_BYTES || 16e6);
function readBody(req, max) {
  const cap = Number(max) || BODY_MAX;
  return new Promise((resolve, reject) => {
    /* MUHIM: bo'laklar avval BAYT ko'rinishida to'planadi, matnga esa
       oxirida bir marta o'giriladi. Har bir bo'lakni alohida matnga
       aylantirish xavfli: o'zbek "’" yoki arab harfi ikki bo'lak
       orasida bo'linsa "�" ga aylanadi va yozuv jimgina buziladi. */
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      const b = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += b.length;
      if (size > cap) {
        const e = new Error('So’rov juda katta');
        e.tooBig = true;
        reject(e); req.destroy();
        return;
      }
      chunks.push(b);
    });
    req.on('end', () => {
      if (!size) return resolve({});
      const d = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('Noto’g’ri JSON')); }
    });
    req.on('error', reject);
  });
}

/* ---------------- So'rov cheklovi (webhook uchun) ---------------- */
const intakeHits = new Map();
function intakeAllowed(req) {
  const ip = clientIp(req);
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
/* ---------------- Haqiqiy IP ----------------
   X-Forwarded-For ni MIJOZ ham yuborishi mumkin, shuning uchun uning chap
   tomoniga ishonib bo'lmaydi. Render hujjatlari va jamoa javoblariga ko'ra
   Render kelgan sarlavhani tozalamaydi, balki O'Z IP sini OXIRIGA qo'shadi;
   haqiqiy mijoz IP si esa undan oldin turadi. Shuning uchun biz ro'yxatning
   O'NG tomonidan TRUST_PROXY_HOPS ta qadam orqaga qaytamiz — mijoz qancha
   soxta qiymat qo'shsa ham, ular faqat CHAPGA qo'shiladi va o'nggi hisob
   o'zgarmaydi.
     Render: 2 (mijoz IP + ichki proksi)   Lokal: 0 (sarlavhaga ishonilmaydi)
   Boshqa hosting uchun TRUST_PROXY_HOPS bilan sozlanadi.                    */
const PROXY_HOPS = Number(
  process.env.TRUST_PROXY_HOPS != null
    ? process.env.TRUST_PROXY_HOPS
    : (process.env.RENDER || process.env.RENDER_SERVICE_ID ? 2 : 0)
);
function clientIp(req) {
  const sock = String((req.socket && req.socket.remoteAddress) || '?').replace(/^::ffff:/, '');
  if (!PROXY_HOPS) return sock;
  const xs = String(req.headers['x-forwarded-for'] || '')
    .split(',').map(x => x.trim()).filter(Boolean);
  if (!xs.length) return sock;
  const i = xs.length - PROXY_HOPS;
  return String(i >= 0 ? xs[i] : xs[0]).replace(/^::ffff:/, '');
}

function gateKey(req, login) {
  return clientIp(req) + '|' + login;
}
function loginGate(req, login) {
  const rec = loginTries.get(gateKey(req, login));
  if (!rec) return { ok: true };
  if (Date.now() - rec.first > LOCK_MS) return { ok: true };
  if (rec.n < MAX_TRIES) return { ok: true };
  return { ok: false, wait: Math.ceil((LOCK_MS - (Date.now() - rec.first)) / 60000) };
}
/* IP bo'yicha UMUMIY hisob: muvaffaqiyatli kirish uni TOZALAMAYDI.
   Aks holda hujumchi har 4 ta xato urinishdan keyin o'zining to'g'ri
   hisobiga kirib, cheklovni nolga qaytarardi.                              */
const ipTries = new Map();
const IP_MAX = Number(process.env.LOGIN_IP_MAX || 30);          // 30 xato / oyna
const IP_WINDOW_MS = Number(process.env.LOGIN_IP_WINDOW_MS || 30 * 60 * 1000);

function ipGate(req) {
  const rec = ipTries.get(clientIp(req));
  if (!rec) return { ok: true };
  if (Date.now() - rec.first > IP_WINDOW_MS) return { ok: true };
  if (rec.n < IP_MAX) return { ok: true };
  return { ok: false, wait: Math.max(1, Math.ceil((IP_WINDOW_MS - (Date.now() - rec.first)) / 60000)) };
}
function ipFail(req) {
  const k = clientIp(req);
  const rec = ipTries.get(k);
  if (!rec || Date.now() - rec.first > IP_WINDOW_MS) ipTries.set(k, { n: 1, first: Date.now() });
  else rec.n++;
  if (ipTries.size > 20000) ipTries.clear();
}

function loginFail(req, login) {
  const k = gateKey(req, login);
  const rec = loginTries.get(k);
  if (!rec || Date.now() - rec.first > LOCK_MS) loginTries.set(k, { n: 1, first: Date.now() });
  else rec.n++;
  if (loginTries.size > 5000) loginTries.clear();
  ipFail(req);                      // umumiy hisob ham o'sadi
}
/* Muvaffaqiyatli kirish: FAQAT shu login+IP juftligi bo'shaydi.
   IP bo'yicha umumiy hisob o'z oynasi tugaguncha saqlanadi.               */
function loginOk(req, login) { loginTries.delete(gateKey(req, login)); }

/* ---------------- O'quvchi kabineti: kod taxmin qilishdan himoya ----------------
   4 xonali kodni taxmin qilish mumkin (9000 ta variant), shuning uchun:
   — 5 ta noto'g'ri urinishdan keyin 15 daqiqa qulf;
   — 20 ta noto'g'ri urinishdan keyin direktorga xabar;
   — to'g'ri kod kiritilsa sanoq tozalanadi.                                    */
const kabinetTries = new Map();
const KAB_MAX = Number(process.env.KABINET_MAX_TRIES || 5);
const KAB_LOCK_MS = Number(process.env.KABINET_LOCK_MS || 15 * 60 * 1000);
const KAB_NOTIFY_AT = 20;
/* KABINET_STRICT=1 bo'lsa kod yetarli emas: o'quvchi o'z telefon raqamining
   oxirgi 4 raqamini ham yozadi. Standart holatda o'chiq (faqat kod).        */
const STRICT_KAB = String(process.env.KABINET_STRICT || '') === '1';

/* Daraja testi: bitta IP soatiga ko'pi bilan TEST_MAX marta test boshlashi mumkin.
   Bu savol bazasini ko'chirib olishga urinishni sekinlashtiradi.            */
const testTries = new Map();
const TEST_MAX = Number(process.env.TEST_MAX_STARTS || 30);
const TEST_WINDOW_MS = Number(process.env.TEST_WINDOW_MS || 60 * 60 * 1000);
function testGate(ip) {
  const rec = testTries.get(ip);
  if (!rec) return { ok: true };
  if (Date.now() - rec.first > TEST_WINDOW_MS) { testTries.delete(ip); return { ok: true }; }
  if (rec.n < TEST_MAX) return { ok: true };
  return { ok: false, wait: Math.max(1, Math.ceil((TEST_WINDOW_MS - (Date.now() - rec.first)) / 60000)) };
}
function testFail(ip) {
  const rec = testTries.get(ip);
  if (!rec || Date.now() - rec.first > TEST_WINDOW_MS) { testTries.set(ip, { n: 1, first: Date.now() }); return; }
  rec.n++;
  if (testTries.size > 5000) testTries.clear();
}

function kabinetGate(ip) {
  const rec = kabinetTries.get(ip);
  if (!rec) return { ok: true };
  if (Date.now() - rec.first > KAB_LOCK_MS) { kabinetTries.delete(ip); return { ok: true }; }
  if (rec.n < KAB_MAX) return { ok: true };
  return { ok: false, wait: Math.max(1, Math.ceil((KAB_LOCK_MS - (Date.now() - rec.first)) / 60000)) };
}
function kabinetFail(ip) {
  const rec = kabinetTries.get(ip);
  if (!rec || Date.now() - rec.first > KAB_LOCK_MS) {
    kabinetTries.set(ip, { n: 1, first: Date.now(), total: (rec && rec.total || 0) + 1 });
  } else {
    rec.n++; rec.total = (rec.total || 0) + 1;
  }
  if (kabinetTries.size > 5000) kabinetTries.clear();
  const cur = kabinetTries.get(ip) || { n: 1, total: 1 };
  return { n: cur.total, notify: cur.total === KAB_NOTIFY_AT };
}
/* To'g'ri havola qulfni bo'shatadi, lekin UMUMIY sanoq (total) saqlanadi —
   shuning uchun hujumchi har safar to'g'ri kirish bilan hisobni nolga
   qaytara olmaydi.                                                         */
function kabinetOk(ip) {
  const rec = kabinetTries.get(ip);
  if (!rec) return;
  kabinetTries.set(ip, { n: 0, first: Date.now(), total: rec.total || 0 });
}

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
  // Eski bazada telefon bo'sh bo'lsa — markaz raqamini qo'yamiz (sayt uchun kerak)
  if (settings) {
    let touched = false;
    if (!settings.phone) { settings.phone = '+998 (55) 588-20-28'; touched = true; }
    // Darslar 08:00–22:00, har biri 90 daqiqa (eski standart 20:00 edi)
    if (!settings.workEnd || settings.workEnd === '20:00') { settings.workEnd = '22:00'; touched = true; }
    if (!settings.workStart) { settings.workStart = '08:00'; touched = true; }
    if (!settings.lessonMinutes) { settings.lessonMinutes = 90; touched = true; }
    if (touched) await store.set('meta/settings', settings);
  }
  if (!settings) {
    await store.set('meta/settings', {
      centerName: process.env.APP_NAME || 'AlBayan Cairo',
      address: '', phone: '+998 (55) 588-20-28', workStart: '08:00', workEnd: '22:00', lessonMinutes: 90, dueDay: 5,
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

  /* Saytdagi ustozlar. Rasm keyin ERP orqali qo'yiladi — bu yerda
     faqat ism va o'rni turadi, shuning uchun sayt bo'sh ko'rinmaydi. */
  const teachers = await store.list('teachers/');
  if (!teachers.length) {
    const seedT = [
      { id: 'tch_asmaa', name: 'Ustoz Asmaa', audience: 'ayollar', order: 1 },
      { id: 'tch_kholid', name: 'Ustoz Kholid', audience: 'erkaklar', order: 2 },
      { id: 'tch_ahmad', name: 'Ustoz Ahmad', audience: 'erkaklar', order: 3 },
      { id: 'tch_muhammad', name: 'Ustoz Muhammad', audience: 'erkaklar', order: 4 },
      { id: 'tch_islam', name: 'Ustoz Islam', audience: 'erkaklar', order: 5 }
    ];
    for (const t of seedT) {
      await store.set('teachers/' + t.id, Object.assign({
        tag: 'Arab ustoz', country: '', levels: '', bio: '', years: 0,
        active: true, createdAt: stamp()
      }, t));
    }
    console.log('  Sayt uchun ustoz profillari yaratildi (' + seedT.length + ' ta)');
  }

  // Daraja aniqlash testi uchun savollar (A1…C2)
  const nq = await levels.ensureBank(store, { stamp });
  if (nq) console.log('  Daraja testi savollari yaratildi (' + nq + ' ta)');

  /* Kodsiz qolgan guruhlarga kod berish.
     DIQQAT: mavjud kodga TEGILMAYDI. Avval bu yerda 4 xonali bo'lmagan
     har qanday kod almashtirilardi — shuning uchun "B020" yo'qolib ketardi. */
  for (const r of await store.list('groups/')) {
    if (r.path.split('/').length !== 2) continue;
    const g = r.data;
    if (!g || normGroupCode(g.code)) continue;
    g.code = await freeGroupCode(g.id);
    await store.set('groups/' + g.id, g);
  }

  /* Eski xavfli bog'lanishlarni tozalash:
     agar o'quvchining "telegram" hisobi GURUH suhbatiga (manfiy chat id)
     ulangan bo'lsa — u yerda xabarni hamma ko'radi. Bunday bog'lanishlar
     uziladi va tarixga yoziladi.                                          */
  {
    const rows = await store.list('students/');
    let cleaned = 0;
    for (const r of rows) {
      if (r.path.split('/').length !== 2) continue;
      const st = r.data;
      const id = st && st.telegram && String(st.telegram.id || '');
      if (!id || id.charAt(0) !== '-') continue;
      delete st.telegram;
      await store.set(r.path, st);
      try { await store.set('botstate/' + id, { chatId: id, step: 'start' }); } catch (e) { }
      cleaned++;
    }
    if (cleaned) {
      console.log('  Guruhga ulangan ' + cleaned + ' ta bog’lanish uzildi (shaxsiy ma’lumot guruhga ketmasin).');
      await writeAudit(null, 'Xavfsizlik: guruhga ulangan bog’lanishlar uzildi', '', cleaned + ' ta');
    }
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

/** Guruh uchun band bo'lmagan 4 xonali kod. Kod Telegram guruh nomiga yoziladi. */
/* Guruh kodi: harf va raqam, 2–12 belgi (B020, A1, 4821 — hammasi bo'ladi).
   Katta harfga keltiriladi, chunki bot kodni katta-kichikka qaramay topadi. */
function normGroupCode(v) {
  const c = String(v == null ? '' : v).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  /* Eng kami 3 belgi: "A1", "B2" — bular DARAJA nomi, guruh nomlarida doim
     uchraydi. Ularni kod sifatida qabul qilsak, bot guruh nomidan kodni
     ajratganda noto'g'ri guruhga ulanib qolishi mumkin.                   */
  return /^[A-Z0-9]{3,12}$/.test(c) ? c : '';
}

/** Shu kod bilan boshqa guruh bormi (exceptId dan boshqa) */
async function groupByCode(code, exceptId) {
  const c = normGroupCode(code);
  if (!c) return null;
  const rows = await store.list('groups/');
  for (const r of rows) {
    if (r.path.split('/').length !== 2) continue;
    const d = r.data;
    if (!d || d.id === exceptId) continue;
    if (normGroupCode(d.code) === c) return d;
  }
  return null;
}

/** Kod yozilmagan guruh uchun taklif: G001, G002 … (band bo'lmagani) */
async function freeGroupCode(exceptId) {
  const rows = await store.list('groups/');
  const busy = {};
  rows.filter(r => r.path.split('/').length === 2).forEach(r => {
    const d = r.data;
    if (d && d.id !== exceptId && d.code) busy[normGroupCode(d.code)] = 1;
  });
  for (let i = 1; i < 1000; i++) {
    const c = 'G' + String(i).padStart(3, '0');
    if (!busy[c]) return c;
  }
  return 'G' + String(crypto.randomInt(100000));
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
  /* Tarix cheksiz o'smasin.

     MUHIM: tozalash HAR BIR yozuvda emas, vaqti-vaqti bilan
     bajariladi. Ilgari har bir saqlashda butun tarix (2000 qator)
     o'qilardi — PostgreSQL da bu har bir "Saqlash" bosilishiga
     qo'shimcha so'rov va kutish demak edi. Chegaradan bir necha
     yozuv oshib ketishi zarar qilmaydi.                          */
  auditSinceSweep++;
  if (auditSinceSweep < AUDIT_SWEEP_EVERY) return;
  auditSinceSweep = 0;
  try {
    const all = await store.list('audit/');
    if (all.length > AUDIT_KEEP) {
      all.sort((a, b) => String(a.data.at).localeCompare(String(b.data.at)));
      for (const old of all.slice(0, all.length - AUDIT_KEEP)) await store.del(old.path);
    }
  } catch (e) { /* tozalash bo'lmasa ham yozuv saqlandi */ }
}
const AUDIT_KEEP = Number(process.env.AUDIT_KEEP || 2000);
const AUDIT_SWEEP_EVERY = Number(process.env.AUDIT_SWEEP_EVERY || 50);
let auditSinceSweep = AUDIT_SWEEP_EVERY;      // birinchi yozuvda bir marta tozalanadi

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

/* Pul qiymati: butun, musbat, cheksiz emas va me'yordan katta emas.
   1e12 so'm (1 trillion) — markaz uchun aniq xato kiritish belgisi.       */
const MONEY_MAX = Number(process.env.MONEY_MAX || 1e12);
function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r <= 0 || r > MONEY_MAX) return null;
  return r;
}

async function createPaymentServer(body, user) {
  const id = String(body.id || '').slice(0, 60) || ('pay_' + Date.now().toString(36));
  const existing = await store.get('payments/' + id);
  if (existing) return existing;                        // takroriy so'rov — bitta yozuv

  const date = String(body.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Sana noto’g’ri.');
  const amount = money(body.amount);
  if (amount == null) throw new Error('Summa noto’g’ri.');
  const student = await store.get('students/' + String(body.studentId || ''));
  if (!student) throw new Error('O’quvchi topilmadi.');

  const type = body.type === 'refund' ? 'refund'
    : (body.type === 'advance' ? 'advance' : 'payment');

  if (type === 'advance') {
    // Avansdan qoplash: yangi pul kirmaydi, faqat oldin olingan pul hisobga yoziladi.
    return await applyAdvanceServer(id, student, body, user);
  }

  let refSrc = null;
  if (type === 'refund') {
    if (!A.can(user, 'payment.void')) throw new Error('Pul qaytarish uchun alohida ruxsat kerak.');
    refSrc = await store.get('payments/' + String(body.refOf || ''));
    if (!refSrc) throw new Error('Asl to’lov topilmadi.');
    if (refSrc.voided) throw new Error('Bekor qilingan to’lovdan qaytarib bo’lmaydi.');
    // Qaytarish faqat ODDIY to'lovdan bo'ladi: qaytarishdan yoki avansdan emas
    if (refSrc.type && refSrc.type !== 'payment') {
      throw new Error('Faqat oddiy to’lovdan qaytarish mumkin.');
    }
    // Va faqat O'SHA o'quvchining to'lovidan
    if (String(refSrc.studentId) !== String(student.id)) {
      throw new Error('Bu to’lov boshqa o’quvchiga tegishli.');
    }
    const rows = await store.list('payments/');
    const done = rows.map(x => x.data)
      .filter(p => p && p.type === 'refund' && p.refOf === refSrc.id && !p.voided)
      .reduce((s, p) => s + Math.round(p.amount), 0);
    const cap = Math.max(0, Math.round(refSrc.amount) - done);
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
  /* Takroriy invoiceId larni BIRLASHTIRAMIZ.
     Aks holda bitta so'rovda bir hisobga ikki marta yozib, qoldiqdan
     oshirib yuborish mumkin edi (100 000 lik hisobga 200 000).            */
  const wanted = new Map();
  for (const a of (body.allocations || [])) {
    const iid = String((a && a.invoiceId) || '');
    if (!iid) continue;
    const v = money(a.amount);
    if (v == null) continue;
    wanted.set(iid, (wanted.get(iid) || 0) + v);
  }

  const allocations = [];
  let allocSum = 0;
  for (const [iid, want] of wanted) {
    const inv = await store.get('invoices/' + iid);
    if (!inv) continue;
    if (inv.studentId !== student.id) throw new Error('Hisob boshqa o’quvchiga tegishli.');
    let amt = want;
    const already = Math.round(paidMap[inv.id] || 0);
    if (type !== 'refund') {
      const remaining = Math.max(0, Math.round(inv.final) - already);
      if (amt > remaining) amt = remaining;                 // ortiqchasi avans bo'lib qoladi
    } else {
      if (amt > Math.max(0, already)) amt = Math.max(0, already);   // yozilganidan ortiq qaytarilmaydi
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

/** Guruh ustoziga ichki suhbat orqali xabar (savol kelganda) */
async function notifyTeacherOfGroup(group, text) {
  try {
    if (!group || !group.teacherId) return;
    const users = (await store.list('users/')).map(x => x.data);
    const who = users.filter(u => u && u.active !== false && u.staffId === group.teacherId);
    for (const d of who) {
      const id = 'sys__' + d.id;
      const doc = (await store.get('chats/' + id)) ||
        { id, type: 'direct', title: 'Tizim xabarlari', members: [d.id], messages: [], readAt: {} };
      doc.messages = (doc.messages || []).concat([{
        id: 'msg_' + Date.now().toString(36), from: 'system',
        text: (group.name ? group.name + ': ' : '') + text, at: stamp()
      }]).slice(-50);
      doc.updatedAt = stamp();
      await store.set('chats/' + id, doc);
    }
  } catch (e) { /* xabar yetmasa ham ish to'xtamaydi */ }
}

/**
 * Fayl shu o'quvchiga ko'rinadimi?
 * Faqat uning guruhidagi dars yozuvi, materiali yoki vazifasiga biriktirilgan
 * fayl, yoki o'zi yuborgan fayl ochiladi. Boshqa hech narsa.
 */
async function fileVisibleToStudents(rec, studentIds) {
  if (!rec) return false;
  const ids = (studentIds || []).map(String);
  if (rec.byKind === 'oquvchi' && ids.indexOf(String(rec.by)) >= 0) return true;

  const ref = String(rec.refPath || '');
  if (!ref) return false;
  const mems = (await store.list('memberships/'))
    .map(r => r.data).filter(m => m && ids.indexOf(String(m.studentId)) >= 0 && m.status !== 'chiqdi');
  const gids = {};
  mems.forEach(m => { gids[String(m.groupId)] = 1; });

  const [col, key] = ref.split('/');
  if (col === 'lessonlog') return !!gids[String(key || '').split('__')[0]];
  if (col === 'materials' || col === 'homework') {
    const doc = await store.get(ref);
    if (!doc || !doc.topicId) return false;
    /* Dastur materiali: o'quvchining guruhida o'sha mavzu o'tilgan bo'lsa */
    const logs = (await store.list('lessonlog/')).map(r => r.data)
      .filter(l => l && l.topicId === doc.topicId && gids[String(l.groupId)]);
    return logs.length > 0;
  }
  if (col === 'asks') {
    const doc = await store.get(ref);
    return !!(doc && ids.indexOf(String(doc.studentId)) >= 0);
  }
  return false;
}

/* ---------------- Kunlik tozalash ----------------
   Baza cheksiz o'smasligi uchun kuniga bir marta:
     — muddati o'tgan test urinishlari (daraja testi va dars testlari);
     — ishlatilgan/eskirgan bir martalik havolalar;
     — muddati tugagan kabinet sessiyalari;
     — bazadagi ma'lumotnomasi yo'q "yetim" fayllar (diskda joy bo'shaydi).
   Natijalar (quizres, placements) va tarix TEGILMAYDI.                   */
async function maintenanceTick() {
  const done = {};
  try { done.testSess = await levels.cleanup(store); } catch (e) { /* muhim emas */ }
  try { done.quizSess = await quiz.cleanup(store); } catch (e) { }
  try { done.links = await link.cleanup(store); } catch (e) { }
  try { done.sessions = await kabsess.cleanup(store); } catch (e) { }
  try { done.files = await files.sweep(store); } catch (e) { }
  const total = Object.values(done).reduce((a, b) => a + (Number(b) || 0), 0);
  if (total) {
    console.log('  Tozalandi: ' + Object.entries(done)
      .filter(([, v]) => v).map(([k, v]) => k + '=' + v).join(', '));
  }
  return done;
}

function startMaintenance() {
  const t = setInterval(() => {
    maintenanceTick().catch(e => console.error('tozalash:', e.message));
  }, Number(process.env.MAINTENANCE_MS || 24 * 60 * 60 * 1000));
  if (t.unref) t.unref();
  /* Ishga tushgandan 1 daqiqa keyin birinchi marta — start sekinlashmasin */
  const first = setTimeout(() => { maintenanceTick().catch(() => { }); }, 60 * 1000);
  if (first.unref) first.unref();
  return t;
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

/* ---------- Tegishlilik qoidalari (o'qish ham, yozish ham) ---------- */

/**
 * Suhbatga kirish huquqi.
 * MUHIM: mijoz yuborgan "type" qiymatiga ishonilmaydi — aks holda shaxsiy suhbatni
 * type: "group" qilib saqlab, uni hammaga ochiq qilib qo'yish mumkin edi.
 * Umumiy suhbat faqat bitta — serverdagi GENERAL_CHAT identifikatori.
 */
function isChatMember(user, chat, id) {
  const cid = id || (chat && chat.id);
  if (cid === GENERAL_CHAT) return true;         // markazning umumiy suhbati
  if (!chat) return false;
  return (chat.members || []).indexOf(user.id) >= 0;
}
/** Vazifani ijrochi, yaratgan odam va vazifa taqsimlovchi ko'radi */
function canSeeTask(user, task) {
  if (!task) return false;
  if (A.can(user, 'task.assign') || A.can(user, 'settings.edit')) return true;
  return task.assigneeId === user.id || task.createdById === user.id;
}
/** Ish haqi qoralamadan boshqa holatda — faqat payroll.approve bilan */
const PAYROLL_LOCKED = ['tasdiqlangan', 'to’langan', 'tolangan'];
function payrollLocked(item) {
  return !!item && PAYROLL_LOCKED.indexOf(String(item.status || 'qoralama')) >= 0;
}

/**
 * Yozish (PUT/DELETE) uchun tegishlilik tekshiruvi.
 * Ruxsat nomi yetarli emas: yozuv kimga tegishli ekani va holat o'zgarishi ham tekshiriladi.
 * Natija: { code, error } — rad etilgan bo'lsa; yoki { data } — saqlanadigan (tozalangan) ma'lumot.
 */
/* Mijoz to'g'ridan-to'g'ri yoza olmaydigan to'plamlar: ular faqat
   maxsus API yo'llari orqali, huquq tekshirilgandan keyin yoziladi. */
const SERVER_ONLY = {
  lessonlog: 1, holidays: 1, pauses: 1, makeups: 1,
  questions: 1, feedback: 1,
  quizzes: 1, quizq: 1, quizsess: 1, quizres: 1, asks: 1,
  parents: 1, files: 1
};

async function guardWrite(user, p, method, next) {
  const seg = p.split('/');
  const col = seg[0];
  const old = await store.get(p);
  const no = (msg) => ({ code: 403, error: msg || 'Sizda bu amal uchun ruxsat yo’q.' });

  /* --- Daraja testi: savollar, sessiyalar va natijalarni FAQAT server yozadi.
     Aks holda o'quvchi o'ziga "C2" yozib qo'yardi yoki javoblarni ko'rardi. --- */
  if (col === 'testq' || col === 'testsess' || col === 'placements') {
    return no('Daraja testi yozuvlarini faqat tizim o’zgartiradi.');
  }

  /* --- O'quv qismi: quyidagilarni FAQAT server yo'llari yozadi ---
     Sabab: natija, kod, anonimlik va fayl ma'lumotnomasi mijozdan
     kelgan JSON bilan o'zgartirilmasligi kerak.                        */
  if (SERVER_ONLY[col]) {
    return no('Bu yozuvni faqat tizim o’zgartiradi (to’g’ri yo’ldan foydalaning).');
  }

  /* --- Dastur: modul, dars, material, vazifa --- */
  if (col === 'modules' || col === 'topics' || col === 'materials' || col === 'homework') {
    if (!A.can(user, 'curriculum.edit')) return no('Dasturni tahrirlash huquqi yo’q.');
    const data = Object.assign({}, next, { id: seg[1] });
    if (col === 'modules' && !curriculum.validLevel(data.level)) {
      return { code: 400, error: 'Daraja noto’g’ri (A1…C2).' };
    }
    if (col === 'topics' && !data.moduleId) {
      return { code: 400, error: 'Dars moduli ko’rsatilmagan.' };
    }
    if ((col === 'materials' || col === 'homework') && !data.topicId) {
      return { code: 400, error: 'Dars ko’rsatilmagan.' };
    }
    if (!old) {
      const field = col === 'modules' ? 'level' : (col === 'topics' ? 'moduleId' : 'topicId');
      const value = col === 'modules' ? data.level : (col === 'topics' ? data.moduleId : data.topicId);
      if (data.order == null || !Number.isFinite(Number(data.order))) {
        data.order = await curriculum.nextOrder(store, col + '/', field, value);
      }
      data.createdAt = stamp();
    } else {
      data.createdAt = old.createdAt || stamp();
    }
    data.at = stamp();
    data.by = user.id;
    return { data };
  }

  /* --- O'quvchi: shaxsiy kodni server beradi va u o'zgarmaydi --- */
  if (col === 'students' && method === 'PUT') {
    const data = Object.assign({}, next);
    // Telegram bog'lanishini mijoz o'zgartira olmaydi — faqat /api/student/link* yo'llari
    if (old && old.telegram) data.telegram = old.telegram; else delete data.telegram;
    /* Shaxsiy kod — markaz o'zi beradi va u O'ZGARMAYDI.
         — yangi o'quvchida kod yozilgan bo'lsa, o'shasi olinadi (Excel'dan
           import qilinganda ham shu yo'l ishlaydi);
         — yozilmagan bo'lsa, server bo'sh kod tanlaydi;
         — keyin kodni almashtirish faqat student.edit huquqi bilan va faqat
           kod bo'sh bo'lmasa: shunda ham eski kod bilan ishlagan havola va
           sessiyalar yopiladi (pastda, saqlangandan keyin).
       Kod hech qachon o'z-o'zidan o'zgarmaydi.                            */
    const want = kabinet.normCode(data.code);
    const hadOld = old && kabinet.validCode(old.code);

    if (!kabinet.validCode(want)) {
      /* Kod yozilmagan yoki noto'g'ri: eskisi bo'lsa qoladi, yo'q bo'lsa beriladi */
      if (hadOld) data.code = old.code;
      else {
        const c = await kabinet.ensureCode(store, Object.assign({ id: seg[1] }, data, { code: '' }));
        if (c) data.code = c;
      }
    } else if (hadOld && want === String(old.code)) {
      data.code = old.code;                        // o'zgarmadi
    } else {
      /* Yangi kod berilmoqda — band emasligini tekshiramiz */
      const busy = await kabinet.byCode(store, want);
      if (busy && busy.id !== seg[1]) {
        return { code: 400, error: 'Bu kod boshqa o’quvchida: ' + want };
      }
      if (hadOld && !A.can(user, 'student.edit')) {
        return { code: 403, error: 'Kodni o’zgartirish uchun ruxsat yo’q.' };
      }
      data.code = want;
    }
    return { data };
  }

  /* --- Guruh: kod va Telegram bog'lanishini server boshqaradi --- */
  if (col === 'groups' && method === 'PUT') {
    const data = Object.assign({}, next);
    if (old) {
      data.tgChat = old.tgChat;               // botga ulanishni mijoz o'zgartira olmaydi
      data.tgTitle = old.tgTitle;
      data.tgAt = old.tgAt;
    } else {
      delete data.tgChat; delete data.tgTitle; delete data.tgAt;
    }
    /* Guruh kodi — MARKAZ o'zi yozadi va u o'zgarmaydi.
       Avval server kodni majburan 4 xonali raqamga almashtirardi, shuning
       uchun "B020" deb yozilgan kod kirib chiqqandan keyin yo'qolardi.
       Endi: yozilgan kod qanday bo'lsa, shundayligicha saqlanadi.
       Faqat bo'sh qolsa yoki band bo'lsa server o'zi taklif qiladi.        */
    const want = normGroupCode(data.code);
    if (!want) {
      data.code = (old && old.code) || await freeGroupCode(seg[1]);
    } else {
      const busy = await groupByCode(want, seg[1]);
      if (busy) return { code: 400, error: 'Bu kod boshqa guruhda: ' + (busy.name || busy.code) };
      data.code = want;
    }
    return { data };
  }

  /* --- Davomat: o'qituvchi faqat o'ziga biriktirilgan guruhga --- */
  if (col === 'lessons' && user.role === 'oqituvchi') {
    const gid = String(seg[1] || '').split('__')[0];
    const sc = await teacherScope(user);
    if (!sc || !sc.gid[gid]) return no('Bu guruh sizga biriktirilmagan.');
  }

  /* --- Ish haqi: tasdiqlash va tasdiqlangan yozuv alohida ruxsat talab qiladi --- */
  if (col === 'payroll') {
    const canApprove = A.can(user, 'payroll.approve');
    if (!canApprove) {
      if (payrollLocked(old)) {
        return no('Tasdiqlangan ish haqini faqat tasdiqlash huquqi bor odam o’zgartiradi.');
      }
      if (method === 'PUT' && payrollLocked(next)) {
        return no('Ish haqini tasdiqlash uchun alohida ruxsat kerak.');
      }
    }
  }

  /* --- Suhbat --- Xabar bu yo'l bilan yozilmaydi: /api/chat/send bor.
     Bu yerda faqat suhbat yaratish va o'z "o'qildi" belgisini yangilash mumkin. */
  if (col === 'chats') {
    const id = seg[1];
    const admin = A.can(user, 'settings.edit');
    if (old) {
      if (!isChatMember(user, old, id)) return no('Bu suhbat sizga tegishli emas.');
    } else if (method === 'PUT') {
      if (id !== GENERAL_CHAT && !isChatMember(user, next, id) && !admin) {
        return no('O’zingiz ishtirok etmaydigan suhbat yarata olmaysiz.');
      }
    }
    if (method === 'DELETE') {
      if (!admin) return no('Suhbatni o’chira olmaysiz.');
      return { data: null };
    }

    const msgs = m => (Array.isArray(m) ? m : []);
    const same = (a, b) => a.length === b.length &&
      a.every((x, i) => x && b[i] && x.id === b[i].id && x.text === b[i].text && x.from === b[i].from);

    if (old) {
      const data = Object.assign({}, old);
      // type va members — oddiy foydalanuvchi o'zgartira olmaydi
      if (admin) {
        if (next.members) data.members = next.members;
        if (next.title != null) data.title = next.title;
      }
      // xabarlar bu yo'l bilan umuman o'zgarmaydi
      if (!same(msgs(next.messages), msgs(old.messages))) {
        return { code: 400, error: 'Xabar yuborish uchun “chat/send” amali ishlatiladi.' };
      }
      // faqat O'ZINING "o'qildi" belgisi
      data.readAt = Object.assign({}, old.readAt || {});
      const mine = next.readAt && next.readAt[user.id];
      if (mine) data.readAt[user.id] = mine;
      return { data };
    }

    // yangi suhbat
    const data = Object.assign({}, next);
    data.id = id;
    data.messages = [];                       // xabarlar faqat chat/send orqali
    data.readAt = {};
    if (id === GENERAL_CHAT) {
      data.type = 'group';
      data.members = [];
    } else if (!admin) {
      data.type = 'direct';
      const mem = Array.isArray(next.members) ? next.members.filter(x => typeof x === 'string') : [];
      if (mem.indexOf(user.id) < 0) mem.push(user.id);
      data.members = mem;
    }
    return { data };
  }

  /* --- Ustoz rasmi: faqat rasm, o'lchami cheklangan --- */
  if (col === 'photos' && method === 'PUT') {
    const d = String((next && next.data) || '');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d)) {
      return { code: 400, error: 'Faqat rasm yuklash mumkin (JPEG, PNG yoki WebP).' };
    }
    if (d.length > 700000) {                     // ~500 KB rasm
      return { code: 400, error: 'Rasm juda katta. Kichikroq rasm tanlang.' };
    }
    return { data: { id: seg[1], data: d, at: stamp() } };
  }

  /* --- Vazifalar: begona vazifani ID orqali o'zgartirib bo'lmaydi --- */
  if (col === 'tasks') {
    if (old && !canSeeTask(user, old)) return no('Bu vazifa sizga tegishli emas.');
    if (!old && method === 'PUT' && !A.can(user, 'task.assign')) {
      const mine = next && (next.createdById === user.id || next.assigneeId === user.id);
      if (!mine) return no('Vazifani faqat o’zingizga yoki o’zingizdan yarata olasiz.');
    }
    if (method === 'DELETE' && old && !A.can(user, 'task.assign') && old.createdById !== user.id) {
      return no('Vazifani o’chira olmaysiz.');
    }
    if (method === 'PUT' && old && !A.can(user, 'task.assign')) {
      const data = Object.assign({}, next, {
        assigneeId: old.assigneeId, createdById: old.createdById   // o'zgartirib bo'lmaydi
      });
      return { data };
    }
  }

  return { data: next };
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

  /* Suhbat va vazifalar: ID orqali ham bootstrap bilan bir xil qoida ishlasin */
  if (col === 'chats') {
    if (!A.can(user, 'nav.chat')) return false;
    if (!isChatMember(user, data, seg[1])) return false;
    return data;
  }
  if (col === 'tasks') {
    if (!A.can(user, 'nav.tasks')) return false;
    if (!canSeeTask(user, data)) return false;
    return data;
  }

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
const COLLECTIONS = ['users', 'staff', 'teachers', 'courses', 'rooms', 'students', 'groups', 'memberships',
  'leads', 'funnels', 'tasks', 'chats', 'botreq', 'botout', 'botin',
  'invoices', 'payments', 'expenses', 'payroll', 'audit', 'placements',
  /* O'quv qismi */
  'modules', 'topics', 'materials', 'homework', 'lessonlog',
  'holidays', 'pauses', 'makeups', 'questions', 'feedback',
  'quizzes', 'quizres', 'asks', 'parents', 'files',
  /* Saytdagi izohlar — markaz tasdiqlaydi */
  'reviews'];

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

  /* ---------- O'quvchi kabineti: shaxsiy kod bo'yicha kirish ----------
     Markaz rahbari shu yo'lni tanladi: o'quvchi faqat 4 xonali kodini
     yozadi va kabinetiga kiradi.

     BILIB QO'YING: 4 xonali kod MAXFIY EMAS. Kodni ko'rgan yoki
     0000–9999 orasidan topgan odam ham o'sha o'quvchining ismi, guruhi,
     qarzi va davomatini ko'radi. Shu sababli bu yerda quyidagilar bor:
       — har bir IP uchun urinishlar soni qattiq cheklangan (qulflash);
       — noto'g'ri kodda javob ataylab sekinlashtiriladi;
       — ko'p urinish bo'lsa direktorga xabar boradi va jurnalga yoziladi;
       — javobda telefon, ota-ona va manzil YO'Q (kabinet.summary filtrlaydi);
       — kirgandan keyin 30 kunlik sessiya beriladi, kod qayta yozilmaydi;
       — kodni serverdan boshqa hech kim yoza olmaydi (guardWrite).
     Xavfsizroq variant (kod + telefon oxirgi 4 raqami) tayyor turibdi —
     sozlamadan KABINET_STRICT=1 bilan yoqiladi.                           */
  if (route === 'kabinet' && req.method === 'POST') {
    const ip = clientIp(req);
    const gate = kabinetGate(ip);
    if (!gate.ok) {
      return send(res, 429, {
        error: 'Juda ko’p urinish. ' + gate.wait + ' daqiqadan keyin qayta urinib ko’ring.'
      });
    }
    const body = await readBody(req);
    const code = kabinet.normCode(body.code);
    if (!kabinet.validCode(code)) {
      kabinetFail(ip);
      return send(res, 400, { error: 'Kod ' + kabinet.CODE_LEN + ' ta raqamdan iborat.' });
    }
    const student = await kabinet.byCode(store, code);

    /* Kod o'quvchiniki bo'lmasa — ota-ona kodimi? Ota-onaning kodi o'zinikidir,
       farzandining kodi emas; shuning uchun kodlar bir-biri bilan to'qnashmaydi. */
    if (!student) {
      const par = await parents.byCode(store, code);
      if (par) {
        kabinetOk(ip);
        const ses = await kabsess.create(store, {
          kind: 'parent', parentId: par.id, studentIds: par.studentIds || [], via: 'kod', stamp
        });
        const sum = await parents.summary(store, par, progress);
        await writeAudit(null, 'Kabinet: ota-ona kirdi', par.name || '', ip);
        return send(res, 200, Object.assign({ csrf: ses.csrf }, sum), {
          'Set-Cookie': kabsess.cookieHeader(ses.cookie, kabsess.TTL_MS / 1000)
        });
      }
    }

    const okPhone = !STRICT_KAB || kabinet.phoneTailOk(student, body.phone4);
    if (!student || !okPhone) {
      const f = kabinetFail(ip);
      if (f.notify) {
        await writeAudit(null, 'Kabinet: ko’p noto’g’ri kod', ip, f.n + ' ta urinish');
        await notifyDirectors('Diqqat: ' + ip + ' manzilidan o’quvchi kabinetiga ' +
          f.n + ' marta noto’g’ri kod kiritildi. Kodlarni taxmin qilishga urinish bo’lishi mumkin.');
      }
      await new Promise(r => setTimeout(r, 400));     // taxmin qilishni sekinlashtirish
      return send(res, 404, {
        error: STRICT_KAB ? 'Kod yoki telefon raqami mos kelmadi.'
          : 'Bunday kod topilmadi. Administratordan so’rang.'
      });
    }
    if (student.status === 'o’chirilgan') {
      kabinetFail(ip);
      return send(res, 404, { error: 'Bunday kod topilmadi. Administratordan so’rang.' });
    }
    kabinetOk(ip);
    const sum = await kabinet.summary(store, student);
    /* Kodni qayta-qayta yozmasligi uchun 30 kunlik sessiya beriladi.
       Sessiya bazada, sirning faqat xeshi saqlanadi (server/kabsess.js). */
    const ses = await kabsess.create(store, { studentId: student.id, kind: 'student', via: 'kod', stamp });
    await writeAudit(null, 'Kabinet: kod bilan kirildi',
      (student.lastName || '') + ' ' + (student.firstName || ''), ip);
    return send(res, 200, Object.assign({ csrf: ses.csrf, kind: 'student' }, sum), {
      'Set-Cookie': kabsess.cookieHeader(ses.cookie, kabsess.TTL_MS / 1000)
    });
  }

  /* Havolani sessiyaga almashtirish (bir marta) */
  if (route === 'kabinet/session' && req.method === 'POST') {
    const ip = clientIp(req);
    const gate = kabinetGate(ip);
    if (!gate.ok) {
      return send(res, 429, { error: 'Juda ko’p urinish. ' + gate.wait + ' daqiqadan keyin urinib ko’ring.' });
    }
    const body = await readBody(req);
    const r = await link.use(store, String(body.token || ''), { stamp, usedBy: 'web:' + ip });
    if (!r.ok) {
      kabinetFail(ip);
      await new Promise(x => setTimeout(x, 300));
      return send(res, 401, {
        error: r.reason === 'ishlatilgan' ? 'Bu havola allaqachon ishlatilgan.'
          : r.reason === 'muddati' ? 'Havola muddati tugagan.' : 'Havola yaroqsiz.'
      });
    }
    kabinetOk(ip);
    const st = await store.get('students/' + r.studentId);
    if (!st || st.status === 'o’chirilgan') return send(res, 404, { error: 'O’quvchi topilmadi.' });
    const ses = await kabsess.create(store, { studentId: r.studentId, kind: 'student', stamp });
    await writeAudit(null, 'Kabinet: sessiya ochildi',
      (st.lastName || '') + ' ' + (st.firstName || ''), ip);
    return send(res, 200, { ok: true, csrf: ses.csrf }, {
      'Set-Cookie': kabsess.cookieHeader(ses.cookie, kabsess.TTL_MS / 1000)
    });
  }

  /* Kabinet ma'lumoti — faqat o'z sessiyasi bilan */
  if (route === 'kabinet/me' && req.method === 'GET') {
    const ses = await kabsess.read(store, parseCookies(req)[kabsess.COOKIE]);
    if (!ses) return send(res, 401, { error: 'Kirish kerak.' });
    if (ses.kind === 'parent') {
      const par = await store.get(parents.COL + ses.parentId);
      if (!par || par.active === false) {
        return send(res, 401, { error: 'Kirish kerak.' }, { 'Set-Cookie': kabsess.clearHeader() });
      }
      const sum = await parents.summary(store, par, progress);
      return send(res, 200, Object.assign({ csrf: ses.csrf }, sum));
    }
    const st = await store.get('students/' + ses.studentId);
    if (!st || st.status === 'o’chirilgan') {
      return send(res, 401, { error: 'Kirish kerak.' }, { 'Set-Cookie': kabsess.clearHeader() });
    }
    const sum = await kabinet.summary(store, st);
    return send(res, 200, Object.assign({ csrf: ses.csrf, kind: 'student' }, sum));
  }

  if (route === 'kabinet/logout' && req.method === 'POST') {
    const ses = await kabsess.read(store, parseCookies(req)[kabsess.COOKIE]);
    if (ses) await kabsess.revoke(store, ses.id, { stamp });
    return send(res, 200, { ok: true }, { 'Set-Cookie': kabsess.clearHeader() });
  }

  /* ================= KABINETDAGI O'QUV QISMI =================
     Hamma yo'l sessiya bilan ishlaydi. O'zgartiruvchi so'rovlar CSRF
     sirini talab qiladi (cookie SameSite=Lax ustiga qo'shimcha himoya).
     Ota-ona O'QIYDI, lekin farzandi nomidan vazifa bajarmaydi va test
     ishlamaydi — natija bolaning o'z mehnatidan chiqishi kerak.        */
  if (route.indexOf('kabinet/') === 0) {
    const ses = await kabsess.read(store, parseCookies(req)[kabsess.COOKIE]);
    if (!ses) return send(res, 401, { error: 'Kirish kerak.' });
    const isParent = ses.kind === 'parent';
    const sub = route.slice('kabinet/'.length);

    /* O'zgartiruvchi so'rov uchun CSRF */
    function csrfOk() {
      const got = String(req.headers['x-kab-csrf'] || '');
      return got && ses.csrf && got === ses.csrf;
    }
    const writing = req.method !== 'GET';
    if (writing && !csrfOk()) return send(res, 403, { error: 'So’rov tasdiqlanmadi. Sahifani yangilang.' });

    /** Shu sessiya ko'rishi mumkin bo'lgan o'quvchi id lari */
    const mine = isParent
      ? (Array.isArray(ses.studentIds) ? ses.studentIds.map(String) : [])
      : [String(ses.studentId)];
    function allowStudent(sid) { return mine.indexOf(String(sid)) >= 0; }

    /* ---- O'quv sahifasi: vazifa, test, savol, material ---- */
    if (sub === 'learning' && req.method === 'GET') {
      const sid = String(url.searchParams.get('studentId') || mine[0] || '');
      if (!allowStudent(sid)) return send(res, 403, { error: 'Bu o’quvchi sizga tegishli emas.' });
      const [homework, quizzes, asks, prog] = await Promise.all([
        lms.homeworkForStudent(store, sid, 15),
        quiz.quizzesForStudent(store, sid),
        quiz.asksForStudent(store, sid),
        progress.forStudent(store, sid)
      ]);
      const mems = (await lms.listCol(store, 'memberships/'))
        .filter(m => m.studentId === sid && m.status !== 'chiqdi');
      const questions = [];
      for (const m of mems) {
        (await lms.questionsOfGroup(store, m.groupId, 20)).forEach(q => {
          questions.push({
            id: q.id, groupId: q.groupId, text: q.text, at: q.at,
            mine: q.studentId === sid,
            answers: (q.answers || []).map(a => ({ byName: a.byName, byKind: a.byKind, text: a.text, at: a.at }))
          });
        });
      }
      const makeups = (await lms.listCol(store, lms.MKP))
        .filter(m => m.studentId === sid && m.status !== 'bekor')
        .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
      return send(res, 200, {
        kind: isParent ? 'parent' : 'student',
        canSubmit: !isParent,
        homework, quizzes, asks, questions, makeups,
        progress: prog ? {
          level: prog.level, attendance: prog.attendance, quizzes: prog.quizzes,
          homework: prog.homework, makeups: prog.makeups
        } : null
      });
    }

    /* ---- Test ishlash (faqat o'quvchi) ---- */
    if (sub === 'quiz/start' && req.method === 'POST') {
      if (isParent) return send(res, 403, { error: 'Testni o’quvchining o’zi ishlaydi.' });
      const body = await readBody(req);
      const r = await quiz.start(store, String(body.quizId || ''), mine[0], { stamp });
      if (!r.ok) return send(res, r.reason === 'topilmadi' ? 404 : 403, { error: 'Testni ochib bo’lmadi.' });
      return send(res, 200, { id: r.id, quiz: r.quiz, total: r.total, questions: r.questions });
    }
    if (sub === 'quiz/submit' && req.method === 'POST') {
      if (isParent) return send(res, 403, { error: 'Testni o’quvchining o’zi ishlaydi.' });
      const body = await readBody(req);
      const r = await quiz.submit(store, {
        stamp, sessionId: body.sessionId, answers: body.answers, studentId: mine[0]
      });
      if (!r.ok) {
        return send(res, r.reason === 'ishlatilgan' ? 409 : 400, {
          error: r.reason === 'ishlatilgan' ? 'Bu test allaqachon topshirilgan.'
            : r.reason === 'muddati' ? 'Vaqt tugadi, qaytadan boshlang.' : 'So’rov noto’g’ri.'
        });
      }
      return send(res, 200, { result: r.result });
    }

    /* ---- Alohida savolga javob (faqat o'quvchi) ---- */
    if (sub === 'ask/answer' && req.method === 'POST') {
      if (isParent) return send(res, 403, { error: 'Javobni o’quvchining o’zi yozadi.' });
      const body = await readBody(req);
      const r = await quiz.answerAsk(store, String(body.askId || ''), mine[0], body.text, { stamp });
      if (!r.ok) {
        return send(res, r.reason === 'topilmadi' ? 404 : 400, {
          error: r.reason === 'javob-berilgan' ? 'Javob allaqachon yuborilgan.' : 'Javob yozilmadi.'
        });
      }
      return send(res, 200, { ok: true, ask: r.rec });
    }

    /* ---- Guruhga savol berish (faqat o'quvchi) ---- */
    if (sub === 'question' && req.method === 'POST') {
      if (isParent) return send(res, 403, { error: 'Savolni o’quvchining o’zi beradi.' });
      const body = await readBody(req);
      const r = await lms.askQuestion(store, {
        groupId: body.groupId, studentId: mine[0], text: body.text, topicId: body.topicId
      }, { stamp });
      if (!r.ok) {
        return send(res, r.reason === 'guruh-emas' ? 403 : 400, { error: 'Savol yuborilmadi.' });
      }
      const g = await store.get('groups/' + String(body.groupId || ''));
      await notifyTeacherOfGroup(g, 'Yangi savol: ' + String(body.text || '').slice(0, 200));
      return send(res, 200, { ok: true, question: r.rec });
    }

    /* ---- Dars haqida fikr (faqat o'quvchi) ---- */
    if (sub === 'feedback' && req.method === 'POST') {
      if (isParent) return send(res, 403, { error: 'Fikrni o’quvchining o’zi bildiradi.' });
      const body = await readBody(req);
      const r = await lms.giveFeedback(store, {
        groupId: body.groupId, studentId: mine[0], rating: body.rating,
        text: body.text, anon: body.anon, date: body.date, topicId: body.topicId
      }, { stamp });
      if (!r.ok) {
        return send(res, r.reason === 'takror' ? 409 : (r.reason === 'guruh-emas' ? 403 : 400), {
          error: r.reason === 'takror' ? 'Bu dars uchun fikr allaqachon yuborilgan.'
            : r.reason === 'baho' ? 'Bahoni 1 dan 5 gacha tanlang.' : 'Fikr yozilmadi.'
        });
      }
      return send(res, 200, { ok: true });
    }

    /* ---- Material yoki vazifa fayli ---- */
    if (sub === 'file' && req.method === 'GET') {
      const fid = String(url.searchParams.get('id') || '');
      const rec = await files.meta(store, fid);
      if (!rec) return send(res, 404, { error: 'Fayl topilmadi.' });
      const allowed = await fileVisibleToStudents(rec, mine);
      if (!allowed) return send(res, 403, { error: 'Bu fayl sizga tegishli emas.' });
      const buf = files.readBody(rec);
      if (!buf) return send(res, 404, { error: 'Fayl topilmadi.' });
      res.writeHead(200, {
        'Content-Type': rec.type,
        'Content-Length': buf.length,
        'Content-Disposition': 'inline; filename="' + encodeURIComponent(rec.name) + '"',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(buf);
    }

    return send(res, 404, { error: 'Topilmadi.' });
  }

  /* ---------- Daraja aniqlash testi (A1…C2) ----------
     Kirishsiz ishlaydi: sayt mehmoni ham, o'quvchi ham topshira oladi.
     TO'G'RI JAVOB BRAUZERGA YUBORILMAYDI — baholash faqat shu yerda.
     Bir IP dan ketma-ket ko'p test boshlash cheklanadi.                  */
  if (route === 'test/start' && req.method === 'POST') {
    const ip = clientIp(req);
    const gate = testGate(ip);
    if (!gate.ok) return send(res, 429, { error: 'Juda ko’p urinish. ' + gate.wait + ' daqiqadan keyin urinib ko’ring.' });
    const body = await readBody(req);
    const lg = levels.lang(body && body.lang);
    const t = await levels.start(store, { stamp, ip, lang: lg });
    if (!t) return send(res, 503, { error: 'Savollar hali tayyor emas.' });
    testFail(ip);
    return send(res, 200, {
      id: t.id, total: t.total, questions: t.questions,
      /* Testga berilgan vaqt (soniya) — sahifa shu bo'yicha sanoq chizadi */
      limitSec: t.limitSec,
      lang: t.lang, rtl: t.rtl, levels: levels.levelList(lg)
    });
  }

  if (route === 'test/submit' && req.method === 'POST') {
    const ip = clientIp(req);
    const body = await readBody(req);
    const r = await levels.submit(store, {
      stamp, sessionId: body.sessionId, answers: body.answers,
      name: body.name, phone: body.phone
    });
    if (!r.ok) {
      return send(res, r.reason === 'ishlatilgan' ? 409 : 400, {
        error: r.reason === 'ishlatilgan' ? 'Bu test allaqachon topshirilgan.'
          : r.reason === 'muddati' ? 'Test muddati tugadi, qaytadan boshlang.'
            : 'Test topilmadi yoki so’rov noto’g’ri.'
      });
    }
    /* Ismi va telefoni yozilgan bo'lsa — murojaat (lead) ochamiz. */
    if (r.name || r.phone) {
      try {
        const lid = 'ld_test_' + r.resultId;
        await store.set('leads/' + lid, {
          id: lid, name: r.name || 'Daraja testi', phone: r.phone || '',
          source: 'Daraja testi', stage: 'yangi',
          note: 'Daraja: ' + r.level + ' (' + r.score + '/' + r.total + ')',
          level: r.level, createdAt: stamp()
        });
      } catch (e) { /* murojaat yozilmasa ham natija qoladi */ }
    }
    await writeAudit(null, 'Daraja testi topshirildi', r.level, r.score + '/' + r.total);
    return send(res, 200, {
      level: r.level, info: levels.levelInfo(r.level, r.lang), lang: r.lang,
      score: r.score, total: r.total, perLevel: r.perLevel, resultId: r.resultId,
      levels: levels.levelList(r.lang)
    });
  }

  /* Kirish sahifasi uchun ochiq ma'lumot: faqat markaz nomi.
     (U kirish sahifasida baribir ko'rinadi — boshqa hech narsa berilmaydi.) */
  if (route === 'public' && req.method === 'GET') {
    const out = { centerName: process.env.APP_NAME || 'AlBayan Cairo' };
    try {
      const s = (await store.get('meta/settings')) || {};
      if (s.centerName) out.centerName = String(s.centerName);
      out.phone = String(s.phone || '');
      out.address = String(s.address || seo.DEFAULT_ADDRESS);
      out.workStart = String(s.workStart || '');
      out.workEnd = String(s.workEnd || '');
      out.about = String(s.about || '');
      out.telegram = String((s.bot && s.bot.username) || '');
      out.instagram = String(s.instagram || '');
      // Kurslar: faqat nomi va (ruxsat berilgan bo'lsa) oylik narxi
      /* Tartibni MARKAZ belgilaydi: `order` kichik bo'lgani birinchi
         turadi. Saytda asosiy narx shu birinchi kursdan olinadi.       */
      const courses = (await store.list('courses/'))
        .filter(r => r.path.split('/').length === 2)
        .map(r => r.data).filter(c => c && c.active !== false)
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) ||
          String(a.name || '').localeCompare(String(b.name || '')));
      out.courses = courses.slice(0, 12).map(c => ({
        id: c.id, name: c.name,
        fee: (c.publicPrice === false || s.publicPrices === false) ? null : Math.round(c.monthlyFee || 0),
        /* Izoh bosqich kartasidagi ro'yxat uchun ishlatiladi:
           nuqtali vergul yoki yangi qator bilan ajratiladi.            */
        note: String(c.note || '').slice(0, 400)
      }));
      /* Ustozlar: faqat ochiq profil ma'lumoti. Telefon, oylik va
         boshqa ichki ma'lumot bu yerga umuman chiqmaydi. */
      out.teachers = (await store.list('teachers/'))
        .filter(r => r.path.split('/').length === 2)
        .map(r => r.data).filter(t => t && t.active !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0) ||
          String(a.name || '').localeCompare(String(b.name || '')))
        .slice(0, 24)
        .map(t => ({
          id: String(t.id),
          name: String(t.name || ''),
          tag: String(t.tag || ''),
          bio: String(t.bio || '').slice(0, 600),
          levels: String(t.levels || ''),
          audience: String(t.audience || ''),
          country: String(t.country || ''),
          years: Number(t.years) || 0
        }));
      out.lessonMinutes = Number(s.lessonMinutes) || 90;
      /* Darslar orasidagi tanaffus. Markaz Sozlamada yozadi; yozmagan
         bo'lsa 30 daqiqa — jadval shunga qarab tuziladi.               */
      out.breakMinutes = s.breakMinutes == null ? 30
        : Math.min(120, Math.max(0, Number(s.breakMinutes) || 0));
      /* Dars vaqtlarini markaz QO'LDA ham yozishi mumkin — haqiqiy jadval
         har doim ham "ish boshlanishi + dars + tanaffus" formulasiga
         tushavermaydi. Yozilgan bo'lsa, sayt aynan shuni ko'rsatadi;
         yozilmagan bo'lsa formula bo'yicha o'zi chizadi.                */
      out.lessonTimes = String(s.lessonTimes || '')
        .split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12)
        .map(x => x.replace(/\s*[-—]\s*/g, '–').slice(0, 20))
        .filter(x => /^\d{1,2}:\d{2}(–\d{1,2}:\d{2})?$/.test(x));
      /* Ochiq Telegram manzillari: kanal va qabul. Bot nomidan alohida —
         o'quvchi botga emas, odamga yoki kanalga yozadi.               */
      /* Izohlar: FAQAT markaz tasdiqlaganlari. Yuboruvchining IP si va
         boshqa ichki maydonlari bu yerga umuman chiqmaydi.             */
      out.reviews = (await store.list('reviews/'))
        .filter(r => r.path.split('/').length === 2)
        .map(r => r.data).filter(x => x && x.status === 'ochiq')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 24)
        .map(x => ({
          name: String(x.name || '').slice(0, 40),
          text: String(x.text || '').slice(0, 500),
          rating: Math.min(5, Math.max(1, Number(x.rating) || 5)),
          about: String(x.about || '').slice(0, 40),
          date: String(x.createdAt || '').slice(0, 10)
        }));
      out.tgChannel = String(s.tgChannel || '').slice(0, 60);
      out.tgQabul = String(s.tgQabul || '').slice(0, 60);
      out.tgQabulLabel = String(s.tgQabulLabel || '').slice(0, 60);
      /* Ikkinchi qabul manzili (ikkinchi filial) */
      out.tgQabul2 = String(s.tgQabul2 || '').slice(0, 60);
      out.tgQabulLabel2 = String(s.tgQabulLabel2 || '').slice(0, 60);
      /* Saytning hero qismida yozilib turadigan qatorlar.
         Markaz o'zi yozadi (Sozlamalar → Ochiq sayt). Har qatorda bitta
         ibora. Bo'sh bo'lsa mijoz standart iboralarni ko'rsatadi.        */
      out.taglines = String(s.taglines || '')
        .split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8)
        .map(x => x.slice(0, 90));
      out.youtube = String(s.youtube || '');
      /* Hero yonidagi kichik yozuv (masalan "Al-Azhar standarti").
         Markaz o'zi yozadi — biz hech qanday da'vo o'ylab topmaymiz.     */
      out.heroBadge = String(s.heroBadge || '').slice(0, 40);
      /* Hero ostidagi ko'rsatkichlar. Har qatorda "qiymat | izoh".
         Masalan: "6 bosqich | daraja A1–C2 to'liq dastur"               */
      out.stats = String(s.stats || '').split('\n').map(function (row) {
        const p = row.split('|');
        return { v: String(p[0] || '').trim().slice(0, 14),
                 t: String(p[1] || '').trim().slice(0, 60) };
      }).filter(x => x.v).slice(0, 4);
      /* Hero ostidagi ishonch qatori: "500+ o'quvchi bizni tanladi".
         Bu ham markazning O'Z gapi — Sozlamada yoziladi. Biz hech qanday
         son o'ylab topmaymiz va bazadan sanab chiqarmaymiz (o'quvchilar
         soni ichki ma'lumot, u kirishsiz ochilmaydi).                    */
      out.heroProof = String(s.heroProof || '').slice(0, 60);
      /* Darajalar — CEFR (A1…C2). Bu markazning da'vosi emas, tizimda
         allaqachon bor ro'yxat (server/levels.js): daraja testi ham,
         o'quv dasturi ham shu darajalar ustiga qurilgan. Shuning uchun
         sayt uni o'zi o'ylab topmaydi, bir joydan oladi.                 */
      out.levels = levels.levelList('uz').map(l => ({
        code: String(l.code), name: String(l.name), about: String(l.about)
      }));
      /* Savol-javob. Har juftlik: savol qatori, keyin javob qatori,
         juftliklar bo'sh qator bilan ajratiladi.                         */
      out.faq = String(s.faq || '').split(/\n\s*\n/).map(function (blk) {
        const rows = blk.split('\n').map(x => x.trim()).filter(Boolean);
        if (rows.length < 2) return null;
        return { q: rows[0].slice(0, 160), a: rows.slice(1).join(' ').slice(0, 700) };
      }).filter(Boolean).slice(0, 10);
    } catch (e) { /* baza javob bermasa standart ma'lumot */ }
    return send(res, 200, out);
  }

  /* ---------- Ustoz rasmi ----------
     Kirishsiz ochiladi, lekin FAQAT saytda ko'rsatiladigan ustoz uchun.
     Boshqa hujjat rasmi bu yo'l bilan olinmaydi.                        */
  if (route === 'photo' && req.method === 'GET') {
    const id = String(url.searchParams.get('id') || '').slice(0, 60);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return send(res, 404, 'Topilmadi');
    const t = await store.get('teachers/' + id);
    if (!t || t.active === false) return send(res, 404, 'Topilmadi');
    const ph = await store.get('photos/' + id);
    const m = ph && /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(ph.data || ''));
    if (!m) return send(res, 404, 'Topilmadi');
    const buf = Buffer.from(m[2], 'base64');
    const tag = '"' + buf.length.toString(16) + '-' + String(ph.at || '').replace(/\D/g, '') + '"';
    if (req.headers['if-none-match'] === tag) {
      res.writeHead(304, { ETag: tag, 'Cache-Control': 'public, max-age=3600' });
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': m[1],
      'Content-Length': buf.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
      ETag: tag
    });
    return res.end(buf);
  }

  /* ---------- Saytdagi forma: yangi murojaat ----------
     Kirishsiz ishlaydi. Har bir so'rov leads bo'limiga tushadi va
     administratorlarga xabar beriladi (ichki suhbat + Telegram bot).      */
  /* ---------- Saytdagi izoh (sharh) ----------
     Kirishsiz yoziladi, lekin DARHOL SAYTGA CHIQMAYDI: markaz ko'rib,
     tasdiqlagandan keyingina ko'rinadi. Shuning uchun saytda hech qachon
     tekshirilmagan yoki soxta izoh turmaydi.

     Yuboruvchining IP si va yuborilgan vaqti ichkarida saqlanadi (spam
     bo'lsa topish uchun), lekin /api/public ga CHIQMAYDI.               */
  if (route === 'review' && req.method === 'POST') {
    if (!intakeAllowed(req)) return send(res, 429, { error: 'Juda ko’p so’rov. Birozdan keyin urinib ko’ring.' });
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 40);
    const text = String(body.text || '').trim().slice(0, 500);
    /* Bahoni AVVAL tekshiramiz, keyin chegaraga solamiz — aks holda
       0 ham 1 ga aylanib, "bahosiz" izoh o'tib ketardi.                */
    const rawRating = Math.round(Number(body.rating));
    const rating = Number.isFinite(rawRating) ? Math.min(5, Math.max(1, rawRating)) : 0;
    const about = String(body.about || '').trim().slice(0, 40);
    if (name.length < 2) return send(res, 400, { error: 'Ismingizni yozing.' });
    if (text.length < 10) return send(res, 400, { error: 'Izohni biroz to’liqroq yozing.' });
    if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) {
      return send(res, 400, { error: 'Bahoni tanlang (1 dan 5 gacha).' });
    }

    const ip = clientIp(req);
    /* Bir IP dan kuniga 3 tadan ko'p izoh qabul qilinmaydi */
    const kun = new Date().toISOString().slice(0, 10);
    const bor = (await store.list('reviews/')).map(r => r.data).filter(Boolean);
    const bugun = bor.filter(r => r.ip === ip && String(r.createdAt || '').slice(0, 10) === kun);
    if (bugun.length >= 3) return send(res, 429, { error: 'Bugun uchun izoh qabul qilindi. Rahmat!' });

    const id = 'rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await store.set('reviews/' + id, {
      id, name, text, rating, about,
      status: 'yangi',                 // markaz tasdiqlaguncha saytda ko'rinmaydi
      ip, createdAt: stamp()
    });
    return send(res, 200, { ok: true });
  }

  if (route === 'lead' && req.method === 'POST') {
    if (!intakeAllowed(req)) return send(res, 429, { error: 'Juda ko’p so’rov. Birozdan keyin urinib ko’ring.' });
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 80);
    const phone = A.normPhone(String(body.phone || ''));
    const note = String(body.note || '').trim().slice(0, 500);
    const courseId = String(body.courseId || '').slice(0, 60);
    /* Saytdagi formadan qo'shimcha: hozirgi daraja va qulay vaqt.
       Ro'yxat yopiq — mijoz o'z matnini yubora olmaydi.                  */
    const LEVELS = { noldan: 'Noldan (alifbo)', oqiy: 'O’qiy olaman', gram: 'Grammatikani bilaman' };
    /* Saytdagi daraja kartasidan kelgan CEFR kodi ham qabul qilinadi
       (A1…C2). Ro'yxat server/levels.js dan olinadi — ya'ni bu yerda ham
       yopiq ro'yxat, mijoz o'z matnini yozib yubora olmaydi.             */
    levels.levelList('uz').forEach(function (l) {
      LEVELS[l.code] = l.code + ' — ' + l.name;
    });
    const startLevel = LEVELS[String(body.startLevel || '')] || '';
    const wantTime = String(body.wantTime || '').slice(0, 40);
    if (name.length < 2) return send(res, 400, { error: 'Ismingizni yozing.' });
    if (A.phoneDigits(phone).length < 9) return send(res, 400, { error: 'Telefon raqamni to’liq yozing.' });

    const funnels = (await store.list('funnels/')).map(x => x.data).filter(Boolean);
    const funnel = funnels.filter(f => f.isDefault)[0] || funnels[0];
    if (!funnel) return send(res, 503, { error: 'Markaz hali sozlanmagan.' });

    const leads = (await store.list('leads/')).map(x => x.data).filter(Boolean);
    const digits = A.phoneDigits(phone);
    const dup = leads.filter(l => A.phoneDigits(l.phone) === digits &&
      Date.parse((l.createdAt || '').replace(' ', 'T') + ':00') > Date.now() - 7 * 864e5)[0];
    if (dup) return send(res, 200, { ok: true, duplicate: true });

    /* Bir IP dan kuniga nechta YANGI ariza qabul qilinadi.
       Takrorlanish filtri faqat bir xil telefonni to'xtatadi — har
       safar boshqa raqam yozilsa, bitta odam "Murojaatlar" ro'yxatini
       va direktorning Telegram xabarlarini ko'mib tashlashi mumkin
       edi. Chegara kattaroq qilib olingan: bitta uy yoki ofisdan
       (umumiy IP dan) bir necha kishi ariza qoldirishi normal.      */
    const leadIp = clientIp(req);
    const LEAD_DAY_MAX = Number(process.env.LEAD_IP_DAY_MAX || 15);
    const today = stamp().slice(0, 10);
    const fromIpToday = leads.filter(l => l.ip === leadIp &&
      String(l.createdAt || '').slice(0, 10) === today).length;
    if (fromIpToday >= LEAD_DAY_MAX) {
      return send(res, 429, {
        error: 'Arizangiz qabul qilindi. Agar shoshilinch bo’lsa, telefon qiling.'
      });
    }

    const course = courseId ? await store.get('courses/' + courseId) : null;
    const stages = A.funnelStages(funnel);
    const id = 'led_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    await store.set('leads/' + id, {
      id, funnelId: funnel.id, name, phone,
      courseId: course ? course.id : '',
      source: 'Sayt', ownerStaffId: '',
      stage: stages[0] ? stages[0].id : 'yangi',
      note: [note, startLevel ? 'Daraja: ' + startLevel : '',
             wantTime ? 'Qulay vaqt: ' + wantTime : ''].filter(Boolean).join(' · '),
      startLevel, wantTime,
      nextContact: A.today(),
      /* IP faqat toshqinni to'xtatish uchun saqlanadi; u mijozga
         berilmaydi (leads ro'yxati xodimga ochiq, saytga emas).   */
      ip: leadIp,
      createdAt: stamp(), viaSite: true
    });
    await writeAudit(null, 'Saytdan murojaat', name, phone + (course ? ' · ' + course.name : ''));

    const text = 'Yangi murojaat (sayt)\n' +
      'Ism: ' + name + '\n' +
      'Telefon: ' + phone +
      (course ? '\nKurs: ' + course.name : '') +
      (note ? '\nIzoh: ' + note : '');
    notifyDirectors(text).catch(() => { });
    try { require('./bot').notifyStaff(text); } catch (e) { /* bot o'chiq bo'lsa muhim emas */ }

    return send(res, 200, { ok: true, id });
  }

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
    const ipg = ipGate(req);
    if (!gate.ok || !ipg.ok) {
      const wait = !gate.ok ? gate.wait : ipg.wait;
      return send(res, 429, { error: 'Juda ko’p urinish. ' + wait + ' daqiqadan keyin qayta urinib ko’ring.' });
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

  /* ================= O'QUV QISMI (xodimlar tomoni) ================= */
  const nope = (m) => send(res, 403, { error: m || 'Sizda bu amal uchun ruxsat yo’q.' });

  /** O'qituvchi faqat o'z guruhi bilan ishlaydi */
  async function ownsGroup(gid) {
    if (A.can(user, 'group.edit') || A.can(user, 'settings.edit')) return true;
    if (user.role !== 'oqituvchi') return A.can(user, 'group.view');
    const g = await store.get('groups/' + String(gid || ''));
    return !!(g && g.teacherId && g.teacherId === user.staffId);
  }

  /* ---- Dastur ---- */
  if (route === 'curriculum' && req.method === 'GET') {
    if (!A.can(user, 'curriculum.view') && !A.can(user, 'group.view')) return nope();
    return send(res, 200, { levels: levels.LEVELS, tree: await curriculum.tree(store) });
  }
  if (route === 'curriculum/topic' && req.method === 'GET') {
    if (!A.can(user, 'curriculum.view') && !A.can(user, 'group.view')) return nope();
    const t = await curriculum.topicFull(store, String(url.searchParams.get('id') || ''));
    if (!t) return send(res, 404, { error: 'Dars topilmadi.' });
    return send(res, 200, t);
  }
  if (route === 'curriculum/next' && req.method === 'GET') {
    if (!A.can(user, 'group.view')) return nope();
    const gid = String(url.searchParams.get('groupId') || '');
    if (!await ownsGroup(gid)) return nope('Bu guruh sizga tegishli emas.');
    return send(res, 200, { next: await curriculum.nextTopic(store, gid) });
  }
  if (route === 'curriculum/delete' && req.method === 'POST') {
    if (!A.can(user, 'curriculum.edit')) return nope();
    const body = await readBody(req);
    const kind = String(body.kind || ''), id = String(body.id || '');
    if (kind !== 'module' && kind !== 'topic') return send(res, 400, { error: 'Nima o’chiriladi?' });
    const gone = await curriculum.cascadeDelete(store, kind, id);
    await writeAudit(user, 'Dasturdan o’chirildi', kind + ' ' + id, gone.length + ' ta yozuv');
    return send(res, 200, { ok: true, removed: gone.length });
  }

  /* ---- Fayl ombori ---- */
  if (route === 'file' && req.method === 'POST') {
    if (!A.can(user, 'curriculum.edit') && !A.can(user, 'lesson.log')) return nope();
    const body = await readBody(req, BODY_MAX_FILE);
    const r = await files.save(store, {
      name: body.name, type: body.type, dataBase64: body.data,
      purpose: body.purpose, refPath: body.refPath,
      byUserId: user.id, byKind: 'xodim', stamp
    });
    if (!r.ok) {
      return send(res, 400, {
        error: r.reason === 'turi' ? 'Bu turdagi fayl qabul qilinmaydi.'
          : r.reason === 'kattaligi' ? 'Fayl juda katta (' + Math.round(files.MAX_BYTES / 1048576) + ' MB gacha).'
            : 'Fayl bo’sh.'
      });
    }
    await writeAudit(user, 'Fayl yuklandi', r.file.name, r.file.bytes + ' bayt');
    return send(res, 200, { ok: true, file: r.file });
  }
  if (route === 'file' && req.method === 'GET') {
    if (!A.can(user, 'group.view') && !A.can(user, 'student.view')) return nope();
    const rec = await files.meta(store, String(url.searchParams.get('id') || ''));
    if (!rec) return send(res, 404, { error: 'Fayl topilmadi.' });
    const buf = files.readBody(rec);
    if (!buf) return send(res, 404, { error: 'Fayl topilmadi.' });
    res.writeHead(200, {
      'Content-Type': rec.type,
      'Content-Length': buf.length,
      'Content-Disposition': 'inline; filename="' + encodeURIComponent(rec.name) + '"',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end(buf);
  }
  if (route === 'file/delete' && req.method === 'POST') {
    if (!A.can(user, 'curriculum.edit')) return nope();
    const body = await readBody(req);
    const okd = await files.remove(store, String(body.id || ''));
    return send(res, okd ? 200 : 404, okd ? { ok: true } : { error: 'Fayl topilmadi.' });
  }

  /* ---- Bayram va tanaffus ---- */
  if (route === 'holiday' && req.method === 'POST') {
    if (!A.can(user, 'holiday.manage')) return nope();
    const body = await readBody(req);
    const r = await lms.saveHoliday(store, body, { byUserId: user.id, stamp });
    if (!r.ok) return send(res, 400, { error: r.reason === 'sana' ? 'Sana noto’g’ri.' : 'Guruh tanlanmagan.' });
    await writeAudit(user, 'Dam olish kuni saqlandi', r.rec.name, r.rec.from + ' → ' + r.rec.to);
    return send(res, 200, { ok: true, holiday: r.rec });
  }
  if (route === 'holiday/delete' && req.method === 'POST') {
    if (!A.can(user, 'holiday.manage')) return nope();
    const body = await readBody(req);
    const id = String(body.id || '');
    if (!await store.get(lms.HOL + id)) return send(res, 404, { error: 'Topilmadi.' });
    if (store.del) await store.del(lms.HOL + id);
    await writeAudit(user, 'Dam olish kuni o’chirildi', id, '');
    return send(res, 200, { ok: true });
  }
  if (route === 'pause' && req.method === 'POST') {
    if (!A.can(user, 'student.edit')) return nope();
    const body = await readBody(req);
    const r = await lms.savePause(store, body, { byUserId: user.id, stamp });
    if (!r.ok) return send(res, r.reason === 'topilmadi' ? 404 : 400, { error: 'Tanaffus saqlanmadi.' });
    await writeAudit(user, 'O’quvchi tanaffusi', r.rec.studentId, r.rec.from + ' → ' + (r.rec.to || '—'));
    return send(res, 200, { ok: true, pause: r.rec });
  }
  if (route === 'dayoff' && req.method === 'GET') {
    if (!A.can(user, 'schedule.view')) return nope();
    const d = String(url.searchParams.get('date') || '');
    const g = String(url.searchParams.get('groupId') || '');
    return send(res, 200, await lms.dayOff(store, d, g));
  }

  /* ---- Qo'shimcha dars ---- */
  if (route === 'makeup' && req.method === 'POST') {
    if (!A.can(user, 'makeup.manage')) return nope();
    const body = await readBody(req);
    if (!await ownsGroup(body.groupId)) return nope('Bu guruh sizga tegishli emas.');
    const r = await lms.offerMakeup(store, body, { byUserId: user.id, stamp });
    if (!r.ok) {
      const msg = {
        'kelmagan-emas': 'O’sha kunda bu o’quvchi kelmagan deb belgilanmagan.',
        'dam-kuni': 'Tanlangan kun dam olish kuni.',
        'takror': 'Bu dars uchun qo’shimcha allaqachon belgilangan.',
        'sana': 'Sana noto’g’ri.', 'vaqt': 'Vaqt noto’g’ri.'
      }[r.reason] || 'Qo’shimcha dars belgilanmadi.';
      return send(res, r.reason === 'takror' ? 409 : 400, { error: msg });
    }
    await writeAudit(user, 'Qo’shimcha dars belgilandi', r.rec.studentId, r.rec.missedDate + ' → ' + r.rec.date);
    return send(res, 200, { ok: true, makeup: r.rec });
  }
  if (route === 'makeup/status' && req.method === 'POST') {
    if (!A.can(user, 'makeup.manage')) return nope();
    const body = await readBody(req);
    const cur = await store.get(lms.MKP + String(body.id || ''));
    if (cur && !await ownsGroup(cur.groupId)) return nope('Bu guruh sizga tegishli emas.');
    const r = await lms.setMakeupStatus(store, body.id, String(body.status || ''), { byUserId: user.id, stamp });
    if (!r.ok) {
      return send(res, r.reason === 'topilmadi' ? 404 : 400, {
        error: r.reason === 'yopiq' ? 'Bajarilgan darsni o’zgartirib bo’lmaydi.' : 'Holat noto’g’ri.'
      });
    }
    return send(res, 200, { ok: true, makeup: r.rec });
  }

  /* ---- Dars jurnali ---- */
  if (route === 'lesson/log' && req.method === 'POST') {
    if (!A.can(user, 'lesson.log')) return nope();
    const body = await readBody(req);
    if (!await ownsGroup(body.groupId)) return nope('Bu guruh sizga tegishli emas.');
    const r = await lms.saveLessonLog(store, body, { byUserId: user.id, stamp });
    if (!r.ok) return send(res, 400, { error: 'Dars yozuvi saqlanmadi.' });
    await writeAudit(user, 'Dars yozuvi', r.rec.groupId, r.rec.date + ' ' + (r.rec.title || ''));
    return send(res, 200, { ok: true, log: r.rec });
  }
  if (route === 'lesson/log' && req.method === 'GET') {
    if (!A.can(user, 'group.view')) return nope();
    const gid = String(url.searchParams.get('groupId') || '');
    if (!await ownsGroup(gid)) return nope('Bu guruh sizga tegishli emas.');
    return send(res, 200, { logs: await lms.logsOfGroup(store, gid, 40) });
  }

  /* ---- Savol-javob va fikr ---- */
  if (route === 'questions' && req.method === 'GET') {
    if (!A.can(user, 'group.view')) return nope();
    const gid = String(url.searchParams.get('groupId') || '');
    if (!await ownsGroup(gid)) return nope('Bu guruh sizga tegishli emas.');
    return send(res, 200, { questions: await lms.questionsOfGroup(store, gid, 100) });
  }
  if (route === 'question/answer' && req.method === 'POST') {
    if (!A.can(user, 'qa.answer')) return nope();
    const body = await readBody(req);
    const q = await store.get(lms.QST + String(body.id || ''));
    if (!q) return send(res, 404, { error: 'Savol topilmadi.' });
    if (!await ownsGroup(q.groupId)) return nope('Bu guruh sizga tegishli emas.');
    const r = await lms.answerQuestion(store, body.id, { text: body.text }, {
      byUserId: user.id, byName: user.name || user.login, byKind: 'xodim', stamp
    });
    if (!r.ok) return send(res, 400, { error: 'Javob yozilmadi.' });
    return send(res, 200, { ok: true, question: r.rec });
  }
  if (route === 'feedback' && req.method === 'GET') {
    if (!A.can(user, 'feedback.view')) return nope();
    const gid = String(url.searchParams.get('groupId') || '');
    const tid = String(url.searchParams.get('teacherId') || '');
    if (gid && !await ownsGroup(gid)) return nope('Bu guruh sizga tegishli emas.');
    /* O'qituvchi faqat O'ZI haqidagi fikrni ko'radi */
    if (user.role === 'oqituvchi' && !A.can(user, 'settings.edit')) {
      return send(res, 200, await lms.feedbackSummary(store, { groupId: gid, teacherId: user.staffId }));
    }
    return send(res, 200, await lms.feedbackSummary(store, { groupId: gid, teacherId: tid }));
  }

  /* ---- Dars testlari ---- */
  if (route === 'quiz' && req.method === 'POST') {
    if (!A.can(user, 'quiz.manage')) return nope();
    const body = await readBody(req);
    if (body.groupId && !await ownsGroup(body.groupId)) return nope('Bu guruh sizga tegishli emas.');
    const r = await quiz.saveQuiz(store, body, { byUserId: user.id, stamp });
    if (!r.ok) {
      const msg = {
        nom: 'Test nomini yozing.', 'savol-yoq': 'Kamida bitta savol kerak.',
        variant: 'Har savolda kamida ikkita variant bo’lsin.',
        javob: 'To’g’ri javob tanlanmagan.', kop: 'Savollar juda ko’p.'
      }[r.reason] || 'Test saqlanmadi.';
      return send(res, 400, { error: msg });
    }
    await writeAudit(user, 'Dars testi saqlandi', r.rec.title, r.rec.count + ' ta savol');
    return send(res, 200, { ok: true, quiz: r.rec });
  }
  if (route === 'quiz' && req.method === 'GET') {
    if (!A.can(user, 'quiz.manage')) return nope();
    const q = await quiz.quizWithAnswers(store, String(url.searchParams.get('id') || ''));
    if (!q) return send(res, 404, { error: 'Test topilmadi.' });
    if (q.quiz.groupId && !await ownsGroup(q.quiz.groupId)) return nope('Bu guruh sizga tegishli emas.');
    return send(res, 200, q);
  }
  if (route === 'quiz/delete' && req.method === 'POST') {
    if (!A.can(user, 'quiz.manage')) return nope();
    const body = await readBody(req);
    const q = await store.get(quiz.QZ + String(body.id || ''));
    if (q && q.groupId && !await ownsGroup(q.groupId)) return nope('Bu guruh sizga tegishli emas.');
    const okd = await quiz.removeQuiz(store, String(body.id || ''));
    return send(res, okd ? 200 : 404, okd ? { ok: true } : { error: 'Test topilmadi.' });
  }
  if (route === 'ask' && req.method === 'POST') {
    if (!A.can(user, 'quiz.manage')) return nope();
    const body = await readBody(req);
    if (body.groupId && !await ownsGroup(body.groupId)) return nope('Bu guruh sizga tegishli emas.');
    const r = await quiz.sendAsk(store, body, {
      byUserId: user.id, byName: user.name || user.login, stamp
    });
    if (!r.ok) return send(res, r.reason === 'topilmadi' ? 404 : 400, { error: 'Savol yuborilmadi.' });
    return send(res, 200, { ok: true, ask: r.rec });
  }

  /* ---- Ota-ona hisobi ---- */
  if (route === 'parent' && req.method === 'POST') {
    if (!A.can(user, 'parent.manage')) return nope();
    const body = await readBody(req);
    const r = await parents.save(store, body, { byUserId: user.id, stamp });
    if (!r.ok) return send(res, 400, { error: 'Ota-ona ismi kerak.' });
    await writeAudit(user, 'Ota-ona hisobi saqlandi', r.rec.name, (r.rec.studentIds || []).length + ' ta farzand');
    return send(res, 200, { ok: true, parent: r.rec });
  }
  if (route === 'parent/code' && req.method === 'POST') {
    if (!A.can(user, 'parent.manage')) return nope();
    const body = await readBody(req);
    const r = await parents.newCode(store, String(body.id || ''), { stamp });
    if (!r.ok) return send(res, 404, { error: 'Ota-ona topilmadi.' });
    await kabsess.revokeForStudent(store, '__parent__' + r.rec.id, { stamp });
    await writeAudit(user, 'Ota-ona kodi yangilandi', r.rec.name, '');
    return send(res, 200, { ok: true, code: r.rec.code });
  }
  if (route === 'parent/delete' && req.method === 'POST') {
    if (!A.can(user, 'parent.manage')) return nope();
    const body = await readBody(req);
    const id = String(body.id || '');
    if (!await store.get(parents.COL + id)) return send(res, 404, { error: 'Topilmadi.' });
    if (store.del) await store.del(parents.COL + id);
    await writeAudit(user, 'Ota-ona hisobi o’chirildi', id, '');
    return send(res, 200, { ok: true });
  }

  /* ---- Hisobotlar ---- */
  if (route === 'report/student' && req.method === 'GET') {
    if (!A.can(user, 'reports.learning') && !A.can(user, 'student.view')) return nope();
    const r = await progress.forStudent(store, String(url.searchParams.get('id') || ''), {
      from: url.searchParams.get('from'), to: url.searchParams.get('to')
    });
    if (!r) return send(res, 404, { error: 'O’quvchi topilmadi.' });
    return send(res, 200, r);
  }
  if (route === 'report/group' && req.method === 'GET') {
    if (!A.can(user, 'reports.learning') && !A.can(user, 'group.view')) return nope();
    const gid = String(url.searchParams.get('id') || '');
    if (!await ownsGroup(gid)) return nope('Bu guruh sizga tegishli emas.');
    const r = await progress.forGroup(store, gid, {
      from: url.searchParams.get('from'), to: url.searchParams.get('to')
    });
    if (!r) return send(res, 404, { error: 'Guruh topilmadi.' });
    return send(res, 200, r);
  }
  if (route === 'report/overview' && req.method === 'GET') {
    if (!A.can(user, 'reports.learning')) return nope();
    return send(res, 200, await progress.overview(store, {
      from: url.searchParams.get('from'), to: url.searchParams.get('to')
    }));
  }

  /* O'quvchining shaxsiy kodini yangilash (kod boshqaga ma'lum bo'lib qolsa) */
  if (route === 'student/code' && req.method === 'POST') {
    if (!A.can(user, 'student.edit')) return send(res, 403, { error: 'Ruxsat yo’q.' });
    const body = await readBody(req);
    const id = String(body.studentId || '');
    if (!/^[A-Za-z0-9_\-]+$/.test(id)) return send(res, 400, { error: 'O’quvchi topilmadi.' });
    const st = await store.get('students/' + id);
    if (!st) return send(res, 404, { error: 'O’quvchi topilmadi.' });
    const code = await kabinet.ensureCode(store, st, { force: true });
    if (!code) return send(res, 400, { error: 'Bo’sh kod qolmadi.' });
    const oldCode = st.code || '';
    st.code = code;
    await store.set('students/' + id, st);
    await writeAudit(user, 'O’quvchi kodi yangilandi',
      (st.lastName || '') + ' ' + (st.firstName || ''), oldCode + ' → ' + code);
    return send(res, 200, { ok: true, code });
  }

  /* ---------- Telegram hisobini bog'lash ----------
     4 xonali kod MAXFIY EMAS, shuning uchun u bilan bog'lanmaydi.
     Administrator bir martalik havola yaratadi (24 soat, bir marta).   */
  if (route === 'student/link' && req.method === 'POST') {
    if (!A.can(user, 'student.edit')) return send(res, 403, { error: 'Sizda bu amal uchun ruxsat yo’q.' });
    const body = await readBody(req);
    const sid = String(body.studentId || '');
    if (!/^[A-Za-z0-9_\-.]+$/.test(sid)) return send(res, 400, { error: 'O’quvchi noto’g’ri.' });
    const st = await store.get('students/' + sid);
    if (!st) return send(res, 404, { error: 'O’quvchi topilmadi.' });
    const made = await link.create(store, { studentId: sid, byUserId: user.id, stamp });
    const s0 = (await store.get('meta/settings')) || {};
    const uname = String((s0.bot && s0.bot.username) || process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
    await writeAudit(user, 'Bot: bog’lash havolasi yaratildi',
      (st.lastName || '') + ' ' + (st.firstName || ''), 'id ' + made.id);   // token o'zi YOZILMAYDI
    return send(res, 200, {
      ok: true,
      id: made.id,
      expiresAt: made.expiresAt,
      url: uname ? 'https://t.me/' + uname + '?start=' + made.token : '',
      token: made.token                        // faqat shu javobda, bir marta ko'rsatiladi
    });
  }

  if (route === 'student/unlink' && req.method === 'POST') {
    if (!A.can(user, 'student.edit')) return send(res, 403, { error: 'Sizda bu amal uchun ruxsat yo’q.' });
    const body = await readBody(req);
    const sid = String(body.studentId || '');
    const st = await store.get('students/' + sid);
    if (!st) return send(res, 404, { error: 'O’quvchi topilmadi.' });
    const r = await link.revoke(store, { studentId: sid, stamp });
    if (!r.ok) return send(res, 400, { error: 'Bekor qilinmadi.' });
    // kabinet sessiyalari ham darhol yopiladi
    const closed = await kabsess.revokeForStudent(store, sid, { stamp });
    await writeAudit(user, 'Kabinet: sessiyalar yopildi',
      (st.lastName || '') + ' ' + (st.firstName || ''), closed + ' ta');
    await writeAudit(user, 'Bot: bog’lanish bekor qilindi',
      (st.lastName || '') + ' ' + (st.firstName || ''), r.chatId ? 'suhbat ' + r.chatId : '');
    return send(res, 200, { ok: true });
  }

  /* Administrator so'rovni tasdiqlaydi: botdagi suhbat o'quvchiga bog'lanadi */
  if (route === 'student/link-approve' && req.method === 'POST') {
    if (!A.can(user, 'student.edit')) return send(res, 403, { error: 'Sizda bu amal uchun ruxsat yo’q.' });
    const body = await readBody(req);
    const sid = String(body.studentId || '');
    const reqId = String(body.reqId || '');
    const br = await store.get('botreq/' + reqId);
    if (!br) return send(res, 404, { error: 'So’rov topilmadi.' });
    const st = await store.get('students/' + sid);
    if (!st) return send(res, 404, { error: 'O’quvchi topilmadi.' });
    const at = await link.attach(store, {
      studentId: sid, chatId: String(br.chatId), from: { id: br.tgUserId || br.chatId, username: br.username, first_name: br.name },
      stamp, via: 'admin', force: true
    });
    if (!at.ok) return send(res, 400, { error: 'Bog’lanmadi.' });
    if (at.replaced) await kabsess.revokeForStudent(store, sid, { stamp });
    br.status = 'tasdiqlangan';
    br.studentId = sid;
    br.handledAt = stamp();
    br.handledBy = user.id;
    await store.set('botreq/' + reqId, br);
    await writeAudit(user, 'Bot: o’quvchi ulandi',
      (st.lastName || '') + ' ' + (st.firstName || ''), 'suhbat ' + br.chatId);
    return send(res, 200, { ok: true });
  }

  /* ---------- Telegram guruhiga xabar ----------
     Faqat ERP’dan, ruxsati borlar uchun. Matn guruhning o'z suhbatiga boradi. */
  if (route === 'group/message' && req.method === 'POST') {
    if (!A.can(user, 'group.edit') && !A.can(user, 'bot.broadcast')) {
      return send(res, 403, { error: 'Sizda bu amal uchun ruxsat yo’q.' });
    }
    const body = await readBody(req);
    const gid = String(body.groupId || '');
    const text = String(body.text == null ? '' : body.text).trim();
    if (!/^[A-Za-z0-9_\-.]+$/.test(gid)) return send(res, 400, { error: 'Guruh noto’g’ri.' });
    if (!text) return send(res, 400, { error: 'Xabar bo’sh.' });
    const g = await store.get('groups/' + gid);
    if (!g) return send(res, 404, { error: 'Guruh topilmadi.' });
    if (!g.tgChat) return send(res, 400, { error: 'Bu guruh Telegramga ulanmagan.' });
    try {
      const r = await require('./bot').sendToGroup(g, text);
      if (!r.ok) return send(res, 400, { error: r.error });
    } catch (e) {
      return send(res, 502, { error: 'Telegram javob bermadi: ' + (e.message || e) });
    }
    await writeAudit(user, 'Guruhga Telegram xabari', g.name || gid, text.slice(0, 80));
    return send(res, 200, { ok: true });
  }

  /* ---------- Suhbat: xabar qo'shish faqat shu yerda ----------
     Butun ro'yxat qayta yozilmaydi — faqat bitta yangi xabar qo'shiladi.
     Shuning uchun ikki xodim bir vaqtda yozsa ham xabar yo'qolmaydi va
     200 tadan oshgani uchun hech narsa "eskirgan" deb rad etilmaydi.        */
  const CHAT_KEEP = Number(process.env.CHAT_KEEP || 500);   // bazada saqlanadigan oxirgi xabarlar
  if (route === 'chat/send' && req.method === 'POST') {
    if (!A.can(user, 'nav.chat') || !A.can(user, 'chat.use')) {
      return send(res, 403, { error: 'Sizda suhbat ruxsati yo’q.' });
    }
    const body = await readBody(req);
    const chatId = String(body.chatId || '');
    const text = String(body.text == null ? '' : body.text).trim();
    if (!/^[A-Za-z0-9_\-.:@+]+$/.test(chatId)) return send(res, 400, { error: 'Suhbat nomi noto’g’ri.' });
    if (!text) return send(res, 400, { error: 'Xabar bo’sh.' });
    if (text.length > 4000) return send(res, 400, { error: 'Xabar juda uzun (4000 belgidan ko’p).' });
    const msgId = String(body.msgId || '').slice(0, 40) ||
      ('msg_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'));

    try {
      const result = await withLock('chat:' + chatId, async () => {
        const doc = await store.get('chats/' + chatId);
        if (!doc) throw Object.assign(new Error('Suhbat topilmadi.'), { code: 404 });
        if (!isChatMember(user, doc, chatId)) {
          throw Object.assign(new Error('Bu suhbat sizga tegishli emas.'), { code: 403 });
        }
        const list = Array.isArray(doc.messages) ? doc.messages.slice() : [];
        const already = list.filter(m => m && m.id === msgId)[0];
        if (already) return { message: already, duplicate: true, count: list.length };
        const msg = { id: msgId, from: user.id, text, at: stamp() };   // muallif va vaqt — serverdan
        list.push(msg);
        const kept = list.length > CHAT_KEEP ? list.slice(-CHAT_KEEP) : list;
        doc.messages = kept;
        doc.updatedAt = msg.at;
        doc.readAt = Object.assign({}, doc.readAt || {});
        doc.readAt[user.id] = msg.at;
        await store.set('chats/' + chatId, doc);
        return { message: msg, duplicate: false, count: list.length };
      });
      return send(res, 200, Object.assign({ ok: true }, result));
    } catch (e) {
      return send(res, e.code || 400, { error: e.message || 'Xabar yuborilmadi.' });
    }
  }

  /* Faqat o'zining "o'qildi" belgisini yangilaydi — boshqasining xabariga tegmaydi */
  if (route === 'chat/read' && req.method === 'POST') {
    if (!A.can(user, 'nav.chat')) return send(res, 403, { error: 'Ruxsat yo’q.' });
    const body = await readBody(req);
    const chatId = String(body.chatId || '');
    if (!/^[A-Za-z0-9_\-.:@+]+$/.test(chatId)) return send(res, 400, { error: 'Suhbat nomi noto’g’ri.' });
    try {
      const at = await withLock('chat:' + chatId, async () => {
        const doc = await store.get('chats/' + chatId);
        if (!doc) throw Object.assign(new Error('Suhbat topilmadi.'), { code: 404 });
        if (!isChatMember(user, doc, chatId)) {
          throw Object.assign(new Error('Bu suhbat sizga tegishli emas.'), { code: 403 });
        }
        doc.readAt = Object.assign({}, doc.readAt || {});
        doc.readAt[user.id] = stamp();
        await store.set('chats/' + chatId, doc);
        return doc.readAt[user.id];
      });
      return send(res, 200, { ok: true, at });
    } catch (e) {
      return send(res, e.code || 400, { error: e.message || 'Saqlanmadi.' });
    }
  }

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
          lastOkDate: backup.tzDate(),
          lastOkAt: backup.tzStamp(),
          lastFile: r.name, lastBytes: r.bytes, lastCount: r.count, lastError: '', lastErrorAt: ''
        });
        await writeAudit(user, 'Zaxira nusxa olindi', r.name, r.count + ' yozuv');
        return send(res, 200, { ok: true, file: r });
      } catch (e) {
        await backup.writeState(store, { lastError: String(e.message), lastErrorAt: backup.tzStamp() });
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
      const g = await guardWrite(user, p, 'PUT', body.data);
      if (g.error) return send(res, g.code || 403, { error: g.error });
      body.data = g.data;
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
      // Bot navbatchisini uyg'otamiz (tasdiq/ e'lon darhol ketsin, bo'sh vaqtda esa baza tinch)
      if (p.indexOf('botreq/') === 0 || p.indexOf('botout/') === 0) {
        try { require('./bot').wake(); } catch (e) { /* bot ishlamayotgan bo'lsa muhim emas */ }
      }
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      if (p.indexOf('users/') === 0 && p === 'users/' + user.id) {
        return send(res, 400, { error: 'O’z hisobingizni o’chira olmaysiz.' });
      }
      const gd = await guardWrite(user, p, 'DELETE', null);
      if (gd.error) return send(res, gd.code || 403, { error: gd.error });
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
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};

/**
 * Faqat brauzerga kerakli fayllar tarqatiladi.
 * .env, .git, server kodi, baza va testlar hech qachon berilmaydi.
 */
/* robots.txt va sitemap.xml fayl emas — ular serverda tuziladi
   (pastdagi yo'llarga qarang), shuning uchun bu ro'yxatda yo'q. */
const PUBLIC_FILES = new Set(['/index.html', '/manifest.webmanifest', '/sw.js', '/favicon.ico']);
const PUBLIC_DIRS = ['/css/', '/js/', '/assets/'];
const ALLOWED_EXT = new Set(['.html', '.js', '.css', '.png', '.jpg', '.svg', '.ico', '.webmanifest',
  '.txt', '.xml']);

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
  /* Kesh qoidasi.
     MUHIM: kod fayllari (html, js, css, sw.js, manifest) "no-cache" bilan beriladi —
     brauzer har safar serverdan so'raydi va o'zgarmagan bo'lsa 304 oladi.
     Aks holda yangi index.html eski js bilan aralashib qolardi (5 daqiqa keshda).
     Rasm va shriftlar uzoq keshlanaveradi — ular kamdan-kam o'zgaradi. */
  const ext = path.extname(file).toLowerCase();
  const codeFile = ['.html', '.js', '.css', '.webmanifest'].indexOf(ext) >= 0;
  fs.stat(file, (se, st) => {
    fs.readFile(file, (err, data) => {
      if (err) {
        /* favicon o'rniga sahifa berilmasin */
        const noFallback = rel === '/favicon.ico';
        if (rel !== '/index.html' && !noFallback) return serveStatic(req, res, '/index.html');
        return send(res, 404, 'Topilmadi');
      }
      const tag = st ? '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"' : null;
      // O'zgarmagan bo'lsa — qayta yubormaymiz
      if (tag && req.headers['if-none-match'] === tag) {
        res.writeHead(304, { 'Cache-Control': codeFile ? 'no-cache' : 'public, max-age=86400', ETag: tag });
        return res.end();
      }
      const head = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': codeFile ? 'no-cache' : 'public, max-age=86400'
      };
      if (tag) head.ETag = tag;
      /* Matnli fayllar (js, css, html, svg) siqib yuboriladi —
         mazmuni o'zgarmaydi, faqat tarmoqdagi hajmi kamayadi. */
      return sendMaybeZip(req, res, 200, head, data);
    });
  });
}

/* ---------------- Server ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  try {
    if (url.pathname.indexOf('/api/') === 0) return await handleApi(req, res, url);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = await fs.promises.readFile(path.join(ROOT, 'index.html'), 'utf8');
      const settings = (await store.get('meta/settings')) || {};
      const page = seo.render(html, settings, req.headers.host || 'localhost');
      /* Sahifa sozlamaga qarab o'zgaradi, shuning uchun ETag uning
         MAZMUNIDAN hisoblanadi: o'zgarmagan bo'lsa brauzer qayta
         yuklab o'tirmaydi, o'zgarsa darrov yangisini oladi.          */
      const etag = '"' + crypto.createHash('sha1').update(page).digest('hex').slice(0, 16) + '"';
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { 'Cache-Control': 'no-cache', ETag: etag });
        return res.end();
      }
      return sendMaybeZip(req, res, 200, {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff', ETag: etag
      }, Buffer.from(page, 'utf8'));
    }
    if (req.method === 'GET' && url.pathname === '/robots.txt') {
      const origin = seo.origin(req.headers.host || 'localhost');
      return send(res, 200, 'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ' + origin + '/sitemap.xml\n',
        { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    if (req.method === 'GET' && url.pathname === '/sitemap.xml') {
      const origin = seo.origin(req.headers.host || 'localhost');
      return send(res, 200, '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '/</loc></url></urlset>',
        { 'Content-Type': 'application/xml; charset=utf-8' });
    }
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    if (e && e.tooBig) {
      try { return send(res, 413, { error: 'So’rov juda katta.' }); } catch (x) { return; }
    }
    console.error(e);
    try { send(res, 500, { error: e.message || 'Server xatosi' }); } catch (x) { /* ulanish yopilgan */ }
  }
});

(async function start() {
  await ensureSeed();
  try {
    const added = await kabinet.ensureAllCodes(store);
    if (added) console.log('  O’quvchi kodlari berildi: ' + added + ' ta');
  } catch (e) { console.error('  Kod berishda xato: ' + e.message); }
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

  // Kunlik tozalash — baza va disk cheksiz o'smasin
  startMaintenance();

  if (process.env.TELEGRAM_BOT_TOKEN) {
    require('./bot').start({ store, stamp, A });
  } else {
    console.log('  Telegram bot o’chirilgan (TELEGRAM_BOT_TOKEN berilmagan).\n');
  }
})();

module.exports = { server, store };
