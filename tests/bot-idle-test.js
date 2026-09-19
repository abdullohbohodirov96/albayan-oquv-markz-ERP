/* Bot fon vazifasi bazani qancha bezovta qiladi — o'lchab ko'ramiz.
   Sanoqchi ombor: har bir get/list/set/del hisoblanadi.
   Haqiqiy Telegram ishlatilmaydi — xabarlar soxta yo'lga ketadi.
   Ishga tushirish:  node tests/bot-idle-test.js                              */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-botidle-'));
process.env.DATA_DIR = tmp;
process.env.BACKUP_DIR = path.join(tmp, 'backups');

const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function stamp() { return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '); }

/** Ombor ustidan sanoqchi: nechta so'rov ketganini ko'ramiz */
function counting(inner) {
  const n = { get: 0, list: 0, set: 0, del: 0, all: 0 };
  return {
    counts: n,
    reset() { n.get = n.list = n.set = n.del = n.all = 0; },
    get total() { return n.get + n.list + n.set + n.del + n.all; },
    get reads() { return n.get + n.list + n.all; },
    kind: inner.kind,
    async get(p) { n.get++; return inner.get(p); },
    async set(p, d) { n.set++; return inner.set(p, d); },
    async del(p) { n.del++; return inner.del(p); },
    async list(p) { n.list++; return inner.list(p); },
    async all() { n.all++; return inner.all(); },
    async close() { return inner.close(); }
  };
}

(async () => {
  const base = createStore();
  const store = counting(base);
  const sent = [];
  const t = bot._test({
    store, stamp, A,
    send: async (chatId, text) => { sent.push({ chatId, text }); return { ok: true }; }
  });

  await store.set('meta/settings', {
    centerName: 'Sinov', bot: { notify: { davomat: true, tolov: true, qarz: true, elon: true, ulash: true } }
  });

  /* ---------- 1. Bo'sh turganda ---------- */
  section('1. Navbat bo’sh: baza bezovta qilinmaydi');
  t.startQueue({ idleMs: 60000 });          // ehtiyot tekshiruvi — 60 soniyada bir marta
  await sleep(400);                          // birinchi tekshiruv o'tsin
  const afterFirst = store.total;
  ok('Birinchi tekshiruv bo’ldi', afterFirst > 0, String(afterFirst));

  store.reset();
  await sleep(2500);                         // 2,5 soniya bo'sh turish
  const idleQueries = store.total;
  eq('2,5 soniyada bitta ham so’rov yo’q', idleQueries, 0);
  out.push('    (eski kodda bu vaqtda ~1 tekshiruv = 2 so’rov bo’lardi, soatiga ~1440)');

  /* ---------- 2. Yangi xabar — darhol uyg'onadi ---------- */
  section('2. Yangi xabar kelganda darhol uyg’onadi');
  store.reset();
  const before = Date.now();
  await t.enqueue({ kind: 'elon', chatId: '111', text: 'Sinov xabari' });
  for (let i = 0; i < 40 && !sent.length; i++) await sleep(50);
  const took = Date.now() - before;
  ok('Xabar yuborildi', sent.length === 1, JSON.stringify(sent));
  ok('Kutmasdan ketdi (' + took + ' ms)', took < 1500, String(took));
  ok('Bu safar baza so’ralgan', store.reads > 0, String(store.reads));

  store.reset();
  await sleep(1500);
  eq('Yuborgandan keyin yana tinch', store.total, 0);

  /* ---------- 3. Tasdiq ham uyg'otadi ---------- */
  section('3. Administrator tasdig’i ham uyg’otadi');
  await store.set('botreq/req1', { id: 'req1', chatId: '222', status: 'tasdiqlangan', notified: false });
  bot.wake();
  for (let i = 0; i < 40 && sent.length < 2; i++) await sleep(50);
  ok('Tasdiq xabari ketdi', sent.length >= 2, JSON.stringify(sent.map(s => s.chatId)));

  /* ---------- 4. Qayta ishga tushsa xabar yo'qolmaydi ---------- */
  section('4. Server qayta ishga tushsa navbat yo’qolmaydi');
  t.stopQueue();
  await sleep(150);
  let failNext = true;
  const t2 = bot._test({
    store, stamp, A,
    send: async (chatId, text) => {
      if (failNext) throw new Error('tarmoq yo’q');
      sent.push({ chatId, text }); return { ok: true };
    }
  });
  await t2.enqueue({ kind: 'elon', chatId: '333', text: 'Qayta urinish' });
  await t2.flushQueue();                     // birinchi urinish — xato
  const rows1 = (await base.list('botout/')).map(r => r.data);
  const rec = rows1.filter(m => m.chatId === '333')[0];
  ok('Xabar bazada saqlanib qoldi', !!rec, JSON.stringify(rows1.map(r => r.chatId)));
  eq('Holati "error"', rec.status, 'error');
  eq('Urinish soni 1', rec.tries, 1);
  ok('Keyingi urinish vaqti belgilangan', !!rec.nextTryAt, JSON.stringify(rec));

  // "Qayta ishga tushirish": yangi navbatchi shu bazadan davom etadi
  failNext = false;
  const wasSent = sent.length;
  await t2.flushQueue(Date.now() + 2 * 60 * 1000);    // qayta urinish vaqti kelgandan keyin
  ok('Qayta urinishda yuborildi', sent.length === wasSent + 1,
    'oldin ' + wasSent + ', hozir ' + sent.length);
  const rec2 = (await base.get('botout/' + rec.id));
  eq('Holati "sent"', rec2.status, 'sent');

  /* ---------- 5. Takror yuborish cheklovi ---------- */
  section('5. Takror va cheksiz urinish yo’q');
  const a = await t2.enqueue({ kind: 'elon', chatId: '444', text: 'Bir xil matn' });
  const b = await t2.enqueue({ kind: 'elon', chatId: '444', text: 'Bir xil matn' });
  ok('Ikkinchi marta navbatga qo’yilmadi', b.skipped === true, JSON.stringify(b));
  eq('Bir xil yozuv', b.id, a.id);

  failNext = true;
  await t2.enqueue({ kind: 'elon', chatId: '555', text: 'Doim xato' });
  let tries = 0;
  for (let i = 0; i < 6; i++) { await t2.flushQueue(Date.now() + i * 20 * 60 * 1000); }
  const bad = (await base.list('botout/')).map(r => r.data).filter(m => m.chatId === '555')[0];
  tries = bad.tries;
  eq('Holati "failed"', bad.status, 'failed');
  eq('Urinish soni chegarada', tries, t2.MAX_TRIES);

  /* ---------- 6. Bir aylanishda nechta so'rov ---------- */
  section('6. Bitta tekshiruvning narxi');
  store.reset();
  await t2.flushQueue();
  await t2.notifyApproved();
  const perSweep = store.reads;
  ok('Bitta tekshiruv ≤ 4 ta o’qish (' + perSweep + ')', perSweep <= 4, String(perSweep));
  const perHourOld = Math.round(3600 / 5) * 2;
  const perHourNew = Math.round(3600000 / 60000) * perSweep;   // idleMs=60s bilan
  out.push('    Eski: soatiga ~' + perHourOld + ' so’rov · Yangi (60 s tekshiruv): ~' + perHourNew);
  out.push('    Ish rejimida tekshiruv oralig’i 10 daqiqa (BOT_IDLE_MS) — soatiga ~' + (6 * perSweep));

  t.stopQueue();
  await store.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: bu o’lchov soxta yuborish yo’li va mahalliy baza bilan bajarildi.');
  console.log('Haqiqiy Neon’dagi sarf o’lchanmagan.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
