/* Arab tili darajalari va daraja aniqlash testi.

   Darajalar: A1 → A2 → B1 → B2 → C1 → C2 (CEFR tartibida).
   Tillar: o'zbek (uz), rus (ru), arab (ar) — savollar uch tilda to'liq.

   XAVFSIZLIK QOIDASI: to'g'ri javob HECH QACHON brauzerga yuborilmaydi.
   Savollar `/api/test/start` orqali javobsiz beriladi, baholash faqat
   serverda bo'ladi. Natijani mijoz o'zi "tanlab" yozolmaydi — daraja
   server hisoblaydi va `placements/` ga server yozadi.                    */
'use strict';
const crypto = require('crypto');
const DATA = require('./levels-data');

const LANGS = DATA.LANGS;
const DEF_LANG = 'uz';
function lang(v) { return LANGS.indexOf(String(v || '')) >= 0 ? String(v) : DEF_LANG; }

const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVELS = ORDER.map(code => ({
  code,
  name: DATA.LEVEL_NAMES[code].uz,
  ar: DATA.LEVEL_NAMES[code].ar,
  about: DATA.LEVEL_ABOUT[code].uz
}));

/** Darajalar ro'yxati tanlangan tilda */
function levelList(lg) {
  const L = lang(lg);
  return ORDER.map(code => ({
    code,
    name: DATA.LEVEL_NAMES[code][L],
    about: DATA.LEVEL_ABOUT[code][L]
  }));
}

/* Har darajadan nechta savol olinadi — JAMI 20 ta.
   Avval har darajadan 5 tadan, jami 30 ta edi. Markaz "test qisqaroq
   bo'lsin" deb so'radi. Yuqori darajalarda savol bittadan ko'p: C1/C2
   ni noto'g'ri berib qo'ymaslik uchun aynan o'sha yerda aniqlik kerak. */
const COUNT = { A1: 3, A2: 3, B1: 3, B2: 3, C1: 4, C2: 4 };
const TOTAL_Q = ORDER.reduce((n, l) => n + COUNT[l], 0);            // 20
/** Daraja o'tilgan hisoblanishi uchun kerakli to'g'ri javob soni.
    4 ta savolli darajada 3 ta, 3 ta savollida 2 ta. Ya'ni taxmin bilan
    o'tib ketish ehtimoli har darajada 16% dan past, ketma-ket bir necha
    darajada esa deyarli nolga tushadi.                                */
function passFor(n) { return Number(n) >= 4 ? 3 : 2; }
/* Eng yuqori daraja (C2) alohida shart bilan beriladi: jami 20 ta
   savoldan kamida 19 tasi to'g'ri bo'lishi kerak. Avvalgi 30 talik
   testda bu 28 ta edi — nisbat o'sha-o'shaligicha qoldi. Ya'ni C2 ni
   faqat deyarli xatosiz ishlagan odam oladi.                          */
const C2_MIN_TOTAL = 19;
const COL = 'testq/';           // savollar
const SESS = 'testsess/';       // boshlangan testlar
const RESULT = 'placements/';   // natijalar
/* Testga berilgan vaqt — 10 daqiqa. Vaqt tugagach sahifa javoblarni
   o'zi yuboradi; kechikkan so'rov uchun bir daqiqa muhlat qoldiriladi
   (sekin internetda javob yo'qolib qolmasin).                          */
const LIMIT_MS = Number(process.env.TEST_LIMIT_MS || 10 * 60 * 1000);
const GRACE_MS = Number(process.env.TEST_GRACE_MS || 60 * 1000);
const TTL_MS = Number(process.env.TEST_TTL_MS || LIMIT_MS + GRACE_MS);

const KINDS = {};
Object.keys(DATA.KIND_LABELS).forEach(k => { KINDS[k] = DATA.KIND_LABELS[k].uz; });

/* ---------------- Yordamchilar ---------------- */
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
/** Takrorlanadigan tasodif — bir sessiya ichida barqaror */
function seeded(seed) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}
function clean(t, max) { return String(t == null ? '' : t).slice(0, max || 400); }
/** Savollar to'plamining belgisi — matn o'zgarsa o'zgaradi */
const BANK_V = sha(JSON.stringify(DATA.QUESTIONS)).slice(0, 12);

/** Savol yozuvidan tanlangan tildagi matn va variantlar */
function textOf(q, lg) {
  const L = lang(lg);
  const t = (q.t && (q.t[L] || q.t[DEF_LANG])) || null;
  if (t) return t;
  /* Eski (bir tilli) yozuv ham ishlaydi */
  return { q: q.text || '', o: Array.isArray(q.options) ? q.options : [] };
}

/**
 * Savollar bazasini birinchi ishga tushishda to'ldiradi.
 * Eski, bir tilli yozuvlar bo'lsa — uch tilli yozuvga almashtiriladi.
 */
async function ensureBank(store, opts) {
  const rows = await store.list(COL);
  const first = rows.map(r => r.data).filter(Boolean)[0];
  const multilingual = !!(first && first.t && first.t.ru && first.t.ar);
  /* Savol matni o'zgargan bo'lsa bazadagi eski to'plam qolib ketmasin:
     har bir savolga to'plam belgisi yoziladi va u solishtiriladi. */
  const sameBank = !!(first && first.bankVersion === BANK_V);
  if (rows.length && multilingual && sameBank && rows.length === DATA.QUESTIONS.length) return 0;

  /* Eski to'plamni tozalaymiz — aks holda bir xil savol ikki marta chiqardi */
  if (rows.length && store.del) {
    for (const r of rows) await store.del(r.path);
  }

  let n = 0;
  for (let i = 0; i < DATA.QUESTIONS.length; i++) {
    const s = DATA.QUESTIONS[i];
    const qid = 'q' + String(i + 1).padStart(3, '0');
    await store.set(COL + qid, {
      id: qid,
      level: s.level,
      kind: s.kind || 'lugat',
      answer: s.a,
      /* uch tildagi matn */
      t: { uz: s.uz, ru: s.ru, ar: s.ar },
      /* variantlar soni tillarda bir xil bo'lishi kerak */
      count: s.uz.o.length,
      bankVersion: BANK_V,
      active: true,
      order: i,
      createdAt: nowStamp(opts)
    });
    n++;
  }
  return n;
}

async function bank(store) {
  return (await store.list(COL))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data)
    .filter(q => q && q.active !== false);
}

/**
 * Yangi test boshlash. Javoblar QAYTARILMAYDI.
 * @param {{lang, stamp, ip}} opts
 */
async function start(store, opts) {
  const L = lang(opts && opts.lang);
  const all = await bank(store);
  const rnd = seeded(crypto.randomBytes(8).toString('hex'));
  const picked = [];
  for (const lvl of ORDER) {
    const need = COUNT[lvl] || 3;
    /* Har darajada savol TURLARI xilma-xil bo'lsin */
    const pool = shuffle(all.filter(q => q.level === lvl), rnd);
    const byKind = {};
    pool.forEach(q => { (byKind[q.kind || 'lugat'] = byKind[q.kind || 'lugat'] || []).push(q); });
    const kinds = shuffle(Object.keys(byKind), rnd);
    const take = [];
    for (const k of kinds) { if (take.length < need) take.push(byKind[k].shift()); }
    for (const q of pool) {
      if (take.length >= need) break;
      if (take.indexOf(q) < 0) take.push(q);
    }
    take.filter(Boolean).forEach(q => picked.push(q));
  }
  if (!picked.length) return null;

  const id = 'ts' + crypto.randomBytes(8).toString('hex');
  /* Variantlar tartibi har sessiyada aralashtiriladi. Aks holda "doim
     birinchi variantni bosgan" odam ham ball to'plab qolardi. */
  const mix = {};
  picked.forEach(q => {
    const n = textOf(q, L).o.length;
    mix[q.id] = shuffle(Array.from({ length: n }, (_, i) => i), rnd);
  });
  const deadline = Date.now() + LIMIT_MS;
  await store.set(SESS + id, {
    id,
    qids: picked.map(q => q.id),
    mix,
    lang: L,
    startedAt: nowStamp(opts),
    deadline,
    /* Muhlat = vaqt chegarasi + kechikish uchun bir daqiqa */
    expiresAt: Date.now() + TTL_MS,
    ip: sha(String((opts && opts.ip) || '')).slice(0, 16),
    usedAt: null
  });
  return {
    id,
    lang: L,
    rtl: !!DATA.RTL[L],
    total: picked.length,
    /* Sahifa shu soniyalarga qarab sanoqni chizadi va vaqt tugaganda
       javoblarni o'zi yuboradi. Baholash baribir serverda bo'ladi. */
    limitSec: Math.round(LIMIT_MS / 1000),
    questions: picked.map(q => {
      const t = textOf(q, L);
      return {
        id: String(q.id),
        level: String(q.level),
        kind: String(q.kind || ''),
        kindLabel: (DATA.KIND_LABELS[q.kind] && DATA.KIND_LABELS[q.kind][L]) || '',
        text: clean(t.q, 500),
        options: mix[q.id].map(i => clean(t.o[i], 300))
      };
    })
  };
}

/** Daraja hisoblash: pastdan yuqoriga, birinchi yiqilgan darajada to'xtaydi.
    C2 uchun qo'shimcha shart — jami to'g'ri javob C2_MIN_TOTAL dan kam
    bo'lmasligi kerak; aks holda bir pog'ona pastga tushiriladi.         */
function decide(perLevel, score, total) {
  let reached = '';
  for (const lvl of ORDER) {
    const r = perLevel[lvl] || { ok: 0, total: 0 };
    if (r.total && r.ok >= passFor(r.total)) reached = lvl; else break;
  }
  if (reached === 'C2' && Number(total) >= TOTAL_Q &&
    Number(score) < C2_MIN_TOTAL) {
    reached = ORDER[ORDER.indexOf('C2') - 1];   // C1
  }
  return reached || 'A0';
}

/**
 * Javoblarni baholash. Sessiya bir marta ishlatiladi.
 */
async function submit(store, opts) {
  const id = String((opts && opts.sessionId) || '');
  if (!/^ts[a-f0-9]{16}$/.test(id)) return { ok: false, reason: 'format' };
  const ses = await store.get(SESS + id);
  if (!ses) return { ok: false, reason: 'topilmadi' };
  if (ses.usedAt) return { ok: false, reason: 'ishlatilgan' };
  if (Number(ses.expiresAt) && Date.now() > Number(ses.expiresAt)) return { ok: false, reason: 'muddati' };

  const answers = {};
  (Array.isArray(opts.answers) ? opts.answers : []).forEach(a => {
    if (a && a.id != null) answers[String(a.id)] = Number(a.choice);
  });

  const perLevel = {};
  ORDER.forEach(l => { perLevel[l] = { ok: 0, total: 0 }; });
  let score = 0;
  for (const qid of ses.qids) {
    const q = await store.get(COL + qid);
    if (!q) continue;
    const lvl = perLevel[q.level] || (perLevel[q.level] = { ok: 0, total: 0 });
    lvl.total++;
    /* Ko'rsatilgan tartibdan asl indeksga qaytaramiz */
    const map = (ses.mix && ses.mix[qid]) || null;
    const shown = answers[qid];
    const real = (map && Number.isInteger(shown) && shown >= 0 && shown < map.length)
      ? Number(map[shown]) : shown;
    if (real === Number(q.answer)) { lvl.ok++; score++; }
  }
  const level = decide(perLevel, score, ses.qids.length);

  ses.usedAt = nowStamp(opts);
  await store.set(SESS + id, ses);

  const rid = 'pl' + crypto.randomBytes(6).toString('hex');
  const res = {
    id: rid,
    level,
    perLevel,
    score,
    total: ses.qids.length,
    lang: ses.lang || DEF_LANG,
    name: clean(opts.name, 80),
    phone: clean(opts.phone, 30),
    studentId: clean(opts.studentId, 40),
    at: nowStamp(opts),
    sessionId: id
  };
  await store.set(RESULT + rid, res);
  return {
    ok: true, level, perLevel, score, total: res.total, resultId: rid,
    name: res.name, phone: res.phone, lang: res.lang
  };
}

/** Eskirgan sessiyalarni tozalash */
async function cleanup(store) {
  const rows = await store.list(SESS);
  let n = 0;
  for (const r of rows) {
    const d = r.data;
    if (!d) continue;
    if (Number(d.expiresAt) && Date.now() - Number(d.expiresAt) > 7 * 864e5 && store.del) {
      await store.del(r.path); n++;
    }
  }
  return n;
}

function levelInfo(code, lg) {
  const L = lang(lg);
  if (DATA.LEVEL_NAMES[code]) {
    return { code, name: DATA.LEVEL_NAMES[code][L], about: DATA.LEVEL_ABOUT[code][L] };
  }
  return { code: 'A0', name: DATA.A0_INFO[L].name, about: DATA.A0_INFO[L].about };
}

module.exports = {
  LEVELS, KINDS, ORDER, COUNT, TOTAL_Q, passFor, C2_MIN_TOTAL, LIMIT_MS, GRACE_MS,
  COL, SESS, RESULT, LANGS, DEF_LANG,
  ensureBank, bank, start, submit, decide, cleanup, levelInfo, levelList, lang
};
