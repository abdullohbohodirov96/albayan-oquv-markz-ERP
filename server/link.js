/* Telegram hisobini bog'lash — bir martalik havola (token).

   Nega kerak: 4 xonali shaxsiy kod MAXFIY EMAS (u o'quvchiga qog'ozda
   beriladi, guruhda aytiladi, taxmin qilinishi ham mumkin). Shuning uchun
   u bilan hisobni bog'lash mumkin emas: kodni bilgan begona odam o'quvchining
   ismi, qarzi va davomatini ko'rib qolardi.

   Shuning uchun bog'lash faqat shu modul orqali:
     — token kriptografik tasodifiy (16 bayt) va bir marta ishlaydi;
     — bazada faqat SHA-256 xeshi saqlanadi, ochiq token hech qayerda
       (log, baza, zaxira) qolmaydi;
     — muddati bor (standart 24 soat);
     — ishlatish bitta navbatda (withLock) bajariladi — bir vaqtda kelgan
       ikki so'rov ikki marta ishlata olmaydi;
     — o'quvchida allaqachon bog'lanish bo'lsa, yangi odam uni TASDIQSIZ
       almashtira olmaydi (faqat administrator bergan token almashtiradi).   */
'use strict';
const crypto = require('crypto');

const TTL_MS = Number(process.env.LINK_TTL_MS || 24 * 60 * 60 * 1000);   // 24 soat
const COL = 'linktokens/';

/* Bir vaqtda bitta amal — token ikki marta ishlatilmasin */
const locks = new Map();
function withLock(name, fn) {
  const prev = locks.get(name) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(name, next.catch(() => { }));
  next.finally(() => { if (locks.get(name) === next) locks.delete(name); });
  return next;
}

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}

/** Token ko'rinishi: "<id>.<sir>" — id bilan yozuvni topamiz, sirni xesh bilan solishtiramiz */
function parse(token) {
  const m = /^([A-Za-z0-9_-]{6,24})\.([A-Za-z0-9_-]{16,64})$/.exec(String(token || '').trim());
  return m ? { id: m[1], secret: m[2] } : null;
}

/**
 * Yangi bir martalik havola yaratish.
 * @returns {{id, token, expiresAt}} — token FAQAT shu yerda ochiq ko'rinadi.
 */
async function create(store, opts) {
  const studentId = String((opts && opts.studentId) || '');
  if (!studentId) throw new Error('studentId kerak');
  const id = 'lt' + crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(16).toString('base64url');
  const expiresAt = Date.now() + (Number(opts && opts.ttlMs) || TTL_MS);
  await store.set(COL + id, {
    id,
    studentId,
    kind: String((opts && opts.kind) || 'telegram'),
    hash: sha(secret),
    createdAt: nowStamp(opts),
    createdBy: String((opts && opts.byUserId) || ''),
    expiresAt,
    usedAt: null,
    usedBy: null
  });
  return { id, token: id + '.' + secret, expiresAt };
}

/**
 * Tokenni ishlatish. Muvaffaqiyatda yozuvni "ishlatilgan" deb belgilaydi.
 * @returns {{ok:true, studentId}} yoki {ok:false, reason}
 *   reason: 'format' | 'topilmadi' | 'ishlatilgan' | 'muddati' | 'band'
 */
async function use(store, token, opts) {
  const p = parse(token);
  if (!p) return { ok: false, reason: 'format' };
  return withLock('link:' + p.id, async () => {
    const rec = await store.get(COL + p.id);
    if (!rec || !rec.hash) return { ok: false, reason: 'topilmadi' };
    const a = Buffer.from(sha(p.secret), 'utf8');
    const b = Buffer.from(String(rec.hash), 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'topilmadi' };
    if (rec.usedAt) return { ok: false, reason: 'ishlatilgan' };
    if (Number(rec.expiresAt) && Date.now() > Number(rec.expiresAt)) return { ok: false, reason: 'muddati' };

    rec.usedAt = nowStamp(opts);
    rec.usedBy = String((opts && opts.usedBy) || '');
    await store.set(COL + p.id, rec);
    return { ok: true, studentId: rec.studentId, kind: rec.kind, createdBy: rec.createdBy };
  });
}

/**
 * O'quvchini Telegram suhbatiga bog'lash.
 * Mavjud bog'lanish boshqa suhbatda bo'lsa — faqat `force` bilan almashadi
 * (force'ni administrator bergan token yoki administrator tasdig'i beradi).
 */
async function attach(store, opts) {
  const studentId = String((opts && opts.studentId) || '');
  const chatId = String((opts && opts.chatId) || '');
  if (!studentId || !chatId) return { ok: false, reason: 'format' };
  /* Guruh/kanal suhbati manfiy raqam bilan boshlanadi. Shaxsiy hisobni
     guruhga bog'lab bo'lmaydi — aks holda ism, qarz va davomat guruhdagi
     hammaga ko'rinardi.                                                    */
  if (chatId.charAt(0) === '-') return { ok: false, reason: 'guruh' };
  return withLock('student:' + studentId, async () => {
    const st = await store.get('students/' + studentId);
    if (!st) return { ok: false, reason: 'topilmadi' };
    const cur = st.telegram && st.telegram.id ? String(st.telegram.id) : '';
    if (cur && cur !== chatId && !(opts && opts.force)) {
      return { ok: false, reason: 'band', current: cur };
    }
    const from = (opts && opts.from) || {};
    st.telegram = {
      id: chatId,
      tgUserId: String(from.id || chatId),      // barqaror identifikator
      name: String(from.first_name || ''),
      username: String(from.username || ''),
      linkedAt: nowStamp(opts),
      via: String((opts && opts.via) || 'token')
    };
    await store.set('students/' + studentId, st);
    // eski suhbat holati qolmasin
    if (cur && cur !== chatId) {
      try { await store.set('botstate/' + cur, { chatId: cur, step: 'start' }); } catch (e) { }
    }
    return { ok: true, student: st, replaced: cur && cur !== chatId ? cur : '' };
  });
}

/** Bog'lanishni bekor qilish: hisob uziladi, tokenlar va suhbat holati yopiladi. */
async function revoke(store, opts) {
  const studentId = String((opts && opts.studentId) || '');
  if (!studentId) return { ok: false, reason: 'format' };
  return withLock('student:' + studentId, async () => {
    const st = await store.get('students/' + studentId);
    if (!st) return { ok: false, reason: 'topilmadi' };
    const chatId = st.telegram && st.telegram.id ? String(st.telegram.id) : '';
    delete st.telegram;
    await store.set('students/' + studentId, st);
    if (chatId) {
      try { await store.set('botstate/' + chatId, { chatId, step: 'start' }); } catch (e) { }
    }
    // ishlatilmagan tokenlarni yopamiz
    const rows = await store.list(COL);
    for (const r of rows) {
      const d = r.data;
      if (!d || d.studentId !== studentId || d.usedAt) continue;
      d.usedAt = nowStamp(opts);
      d.usedBy = 'bekor';
      await store.set(r.path, d);
    }
    return { ok: true, chatId };
  });
}

/** Eskirgan tokenlarni tozalash (ixtiyoriy, zaxira oldidan chaqiriladi) */
async function cleanup(store) {
  const rows = await store.list(COL);
  let n = 0;
  for (const r of rows) {
    const d = r.data;
    if (!d) continue;
    const old = Number(d.expiresAt) && Date.now() - Number(d.expiresAt) > 7 * 864e5;
    if (old && store.del) { await store.del(r.path); n++; }
  }
  return n;
}

module.exports = { create, use, attach, revoke, cleanup, TTL_MS, COL };
