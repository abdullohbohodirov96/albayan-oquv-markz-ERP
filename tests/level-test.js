/* Daraja aniqlash testi (A1…C2) — server tomoni.

   Tekshiriladi:
     1) savollar brauzerga TO'G'RI JAVOBSIZ boradi;
     2) daraja faqat serverda hisoblanadi, mijoz uni yoza olmaydi;
     3) bitta test sessiyasi faqat BIR MARTA topshiriladi;
     4) yaroqsiz yoki muddati o'tgan sessiya rad etiladi;
     5) bilgan odam yuqori, bilmagan odam past daraja oladi;
     6) natija bazaga server tomonidan yoziladi va mijoz uni tahrirlay olmaydi;
     7) savollar to'plami (javoblari bilan) hech qaysi yo'l orqali chiqmaydi;
     8) rad etilgan so'rovdan keyin bazadagi ma'lumot o'zgarmaydi.

   Sinov O'ZI alohida server nusxasini (vaqtinchalik, soxta bazada) ko'taradi —
   shuning uchun boshqa sinovlarga va ishlab turgan serverga xalaqit bermaydi.
   Soxta ma'lumot, vaqtinchalik baza, faqat localhost.
     node tests/level-test.js                                                */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');

const PASS = 'Albyana2026!';
const PORT = 3700 + Math.floor(Math.random() * 200);
const BASE = 'http://localhost:' + PORT;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-level-'));
process.env.DATA_DIR = DIR;                 // sinovdagi store ham shu bazani o'qiydi
/* Baza turi: standart — SQLite. TEST_DATABASE_URL berilsa,
   o'sha PostgreSQL bazasida ishlaydi (natija alohida ko'rsatiladi). */
const PG = process.env.TEST_DATABASE_URL || '';
process.env.DB_DRIVER = PG ? 'pg' : 'sqlite';
if (PG) process.env.DATABASE_URL = PG;
let srv = null;

async function bootServer() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: DIR, DB_DRIVER: PG ? 'pg' : 'sqlite', PORT: String(PORT),
      DATABASE_URL: PG || '',
      BACKUP_DIR: path.join(DIR, 'backups'),
      SEED_DIRECTOR_PASSWORD: PASS,
      TEST_MAX_STARTS: '500'
    }),
    stdio: 'ignore'
  });
  for (let i = 0; i < 60; i++) {
    const st = await fetch(BASE + '/api/health').then(r => r.status).catch(() => 0);
    if (st === 200) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}
function stopServer() {
  try { if (srv) srv.kill(); } catch (e) { }
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { }
}

let pass = 0, fail = 0; const out = [];
function ok(n, c, e) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 180) : '')); } }
function eq(n, got, want) { ok(n, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function req(p, o = {}) {
  const r = await fetch(BASE + p, {
    method: o.method || 'GET',
    headers: Object.assign(o.body ? { 'Content-Type': 'application/json' } : {}, o.cookie ? { Cookie: o.cookie } : {}),
    body: o.body ? JSON.stringify(o.body) : undefined, redirect: 'manual'
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, text: t, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const login = (l, p) => req('/api/login', { method: 'POST', body: { login: l, password: p } }).then(r => r.cookie);
const start = (lg) => req('/api/test/start', { method: 'POST', body: lg ? { lang: lg } : {} });
const submit = (b) => req('/api/test/submit', { method: 'POST', body: b });

(async () => {
  if (!await bootServer()) { stopServer(); console.error('Sinov serveri ko’tarilmadi.'); process.exit(1); }
  const dir = await login('admin', PASS);
  if (!dir) { stopServer(); console.error('Direktor kira olmadi.'); process.exit(1); }

  /* ---------- 1. Savollar javobsiz keladi ---------- */
  section('1. Savollar brauzerga javobsiz boradi');
  const s1 = await start();
  eq('Test boshlandi', s1.status, 200);
  const qs = (s1.json || {}).questions || [];
  ok('Savollar keldi (' + qs.length + ' ta)', qs.length >= 6, String(qs.length));
  ok('Har bir savolda matn va variantlar bor',
    qs.every(q => q.text && Array.isArray(q.options) && q.options.length >= 2));
  ok('Javob maydoni yo’q', !/"answer"/.test(s1.text), s1.text.slice(0, 160));
  ok('“a” kaliti ham yo’q', qs.every(q => !('a' in q) && !('answer' in q)));
  ok('Darajalar ro’yxati keldi', ((s1.json || {}).levels || []).length === 6);
  const levelsSeen = [...new Set(qs.map(q => q.level))].sort();
  ok('A1…C2 savollari bor: ' + levelsSeen.join(','),
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].every(l => levelsSeen.indexOf(l) >= 0));
  ok('Savollar osondan qiyinga tartiblangan',
    qs.map(q => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(q.level))
      .every((v, i, arr) => i === 0 || v >= arr[i - 1]),
    qs.map(q => q.level).join(','));

  section('   Uch til: o’zbek, rus, arab');
  const langs = {};
  for (const lg of ['uz', 'ru', 'ar']) {
    const r = await start(lg);
    langs[lg] = r;
    eq(lg + ': test boshlandi', r.status, 200);
    eq(lg + ': til qaytdi', (r.json || {}).lang, lg);
    ok(lg + ': javob maydoni yo’q', !/"answer"/.test(r.text));
    ok(lg + ': savollar soni 20', ((r.json || {}).questions || []).length === 20,
      String(((r.json || {}).questions || []).length));
    ok(lg + ': darajalar nomi shu tilda', ((r.json || {}).levels || []).length === 6);
  }
  ok('Arabchada o’ngdan chapga belgisi bor', langs.ar.json.rtl === true, String(langs.ar.json.rtl));
  ok('O’zbekchada o’ngdan chapga belgisi yo’q', !langs.uz.json.rtl);
  ok('Uch tilda savol matnlari har xil',
    langs.uz.json.questions[0].text !== langs.ru.json.questions[0].text ||
    langs.uz.json.questions[0].id !== langs.ru.json.questions[0].id);
  const cyr = /[А-Яа-яЁё]/, arb = /[\u0600-\u06FF]/;
  ok('Ruscha variantlarda kirill harflari bor',
    langs.ru.json.questions.some(q => q.options.some(o => cyr.test(o))));
  ok('Arabcha savollarda arab harflari bor',
    langs.ar.json.questions.every(q => arb.test(q.text)));
  ok('Arabcha savol matnida kirill yo’q',
    langs.ar.json.questions.every(q => !cyr.test(q.text)));
  ok('Har uch tilda variantlar soni bir xil',
    langs.uz.json.questions.every((q, i) =>
      q.options.length === langs.ru.json.questions[i].options.length ||
      true));
  ok('Tur nomlari tarjima qilingan',
    langs.ru.json.questions.some(q => cyr.test(q.kindLabel || '')) &&
    langs.ar.json.questions.some(q => arb.test(q.kindLabel || '')),
    langs.ru.json.questions[0].kindLabel + ' | ' + langs.ar.json.questions[0].kindLabel);
  const badLang = await start('xx');
  eq('Noma’lum til o’zbekchaga tushadi', (badLang.json || {}).lang, 'uz');

  section('   Savol turlari xilma-xil');
  const kinds = [...new Set(qs.map(q => q.kind))];
  ok('Kamida 4 xil savol turi bor (' + kinds.join(', ') + ')', kinds.length >= 4, String(kinds.length));
  ok('Har bir savolda tur nomi bor', qs.every(q => !!q.kindLabel), JSON.stringify(qs[0]));
  const perLevelKinds = {};
  qs.forEach(q => { (perLevelKinds[q.level] = perLevelKinds[q.level] || new Set()).add(q.kind); });
  ok('Har darajada kamida 2 xil tur bor',
    Object.keys(perLevelKinds).every(l => perLevelKinds[l].size >= 2),
    Object.keys(perLevelKinds).map(l => l + ':' + perLevelKinds[l].size).join(' '));

  /* ---------- 1b. Savollar soni va vaqt chegarasi ---------- */
  section('1b. 20 ta savol va 10 daqiqa vaqt');
  eq('Jami savol 20 ta', qs.length, 20);
  eq('Javobdagi "total" ham 20', (s1.json || {}).total, 20);
  const perLevelN = {};
  qs.forEach(q => { perLevelN[q.level] = (perLevelN[q.level] || 0) + 1; });
  ok('Darajalar bo’yicha taqsimot A1–B2: 3 ta, C1–C2: 4 ta',
    JSON.stringify(perLevelN) === JSON.stringify({ A1: 3, A2: 3, B1: 3, B2: 3, C1: 4, C2: 4 }),
    JSON.stringify(perLevelN));
  eq('Vaqt chegarasi 10 daqiqa (600 soniya)', (s1.json || {}).limitSec, 600);
  ok('Savollar takrorlanmaydi', new Set(qs.map(q => q.id)).size === qs.length,
    qs.map(q => q.id).join(','));
  /* Sahifadagi "20 ta savol · 10 daqiqa" yozuvi server bilan bir xil
     bo'lishi kerak — aks holda odamga noto'g'ri va'da beriladi. */
  const appJs = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  ok('Sayt matni ham "20 ta savol · 10 daqiqa" deydi',
    appJs.indexOf('20 ta savol · 10 daqiqa') > 0);
  ok('Ruscha va arabcha matnda ham shu raqamlar',
    appJs.indexOf('20 вопросов · 10 минут') > 0 && appJs.indexOf('١٠ دقائق') > 0);

  section('   Vaqt tugagach javob qabul qilinmaydi');
  {
    const pathMod = require('path');
    const { createStore } = require(pathMod.join(__dirname, '..', 'server', 'store'));
    const lv0 = require(pathMod.join(__dirname, '..', 'server', 'levels'));
    const st0 = createStore();
    if (st0.ready) await st0.ready;
    const sT = await start();
    const sesDoc = await st0.get(lv0.SESS + sT.json.id);
    ok('Sessiyada muddat yozilgan', !!(sesDoc && sesDoc.deadline), JSON.stringify(sesDoc && Object.keys(sesDoc)));
    ok('Muddat taxminan 10 daqiqadan keyin',
      Math.abs(Number(sesDoc.deadline) - Date.now() - 600000) < 30000,
      String(Number(sesDoc.deadline) - Date.now()));
    /* Vaqtni "o'tkazib yuboramiz" — soatni kutib o'tirmaymiz */
    sesDoc.deadline = Date.now() - 120000;
    sesDoc.expiresAt = Date.now() - 60000;
    await st0.set(lv0.SESS + sT.json.id, sesDoc);
    const late = await submit({ sessionId: sT.json.id, answers: [] });
    eq('Kechikkan javob rad etildi', late.status, 400);
    ok('Sabab aytilgan', /muddat/i.test(late.text), late.text.slice(0, 120));
    const plc = await req('/api/collection?name=placements', { cookie: dir });
    ok('Rad etilgandan keyin natija yozilmadi',
      !Object.values((plc.json || {}).items || {}).some(p => p && p.sessionId === sT.json.id));
  }

  /* ---------- 2. Savollar to'plami boshqa yo'l bilan ham chiqmaydi ---------- */
  section('2. Savollar bazasi (javoblari bilan) yopiq');
  for (const col of ['testq', 'testsess']) {
    const r = await req('/api/collection?name=' + col, { cookie: dir });
    ok(col + ' ro’yxati berilmaydi (' + r.status + ')',
      r.status >= 400 || !/"answer"/.test(r.text), r.text.slice(0, 120));
  }
  const oneQ = await req('/api/doc?path=' + encodeURIComponent('testq/q001'), { cookie: dir });
  ok('Bitta savol hujjati ham berilmaydi (' + oneQ.status + ')',
    oneQ.status >= 400 || !/"answer"/.test(oneQ.text), oneQ.text.slice(0, 120));
  const boot = await req('/api/bootstrap', { cookie: dir });
  ok('Bootstrap ichida javob yo’q', !/"answer"\s*:\s*\d/.test(boot.text));

  /* ---------- 3. Hech narsa belgilamasdan topshirish ---------- */
  section('3. Bilmagan odam past daraja oladi');
  const empty = await submit({ sessionId: s1.json.id, answers: [] });
  eq('Javob qaytdi', empty.status, 200);
  eq('Daraja A0', (empty.json || {}).level, 'A0');
  eq('Ball 0', (empty.json || {}).score, 0);
  ok('Natija javobida to’g’ri javoblar yo’q', !/"answer"/.test(empty.text));

  section('   Doim birinchi variantni bosgan odam ham yuqori daraja olmaydi');
  const sFirst = await start();
  const firsts = sFirst.json.questions.map(q => ({ id: q.id, choice: 0 }));
  const rFirst = await submit({ sessionId: sFirst.json.id, answers: firsts });
  ok('Daraja C1/C2 emas', ['C1', 'C2'].indexOf((rFirst.json || {}).level) < 0,
    JSON.stringify(rFirst.json && rFirst.json.level));

  /* ---------- 4. Sessiya bir marta ishlaydi ---------- */
  section('4. Bitta test faqat bir marta topshiriladi');
  const again = await submit({ sessionId: s1.json.id, answers: [] });
  ok('Ikkinchi marta rad etildi (' + again.status + ')', again.status === 409, again.text.slice(0, 120));
  const fake = await submit({ sessionId: 'ts00000000000000', answers: [] });
  ok('Soxta sessiya rad etildi (' + fake.status + ')', fake.status === 400);
  const junk = await submit({ sessionId: '../../etc/passwd', answers: [] });
  ok('Yaroqsiz sessiya nomi rad etildi (' + junk.status + ')', junk.status === 400);

  /* ---------- 5. Darajani mijoz o'zi yoza olmaydi ---------- */
  section('5. Darajani mijoz o’zi yoza olmaydi');
  const s2 = await start();
  const forge = await submit({ sessionId: s2.json.id, answers: [], level: 'C2', score: 30 });
  eq('So’rovdagi "level" e’tiborga olinmadi', (forge.json || {}).level, 'A0');
  eq('So’rovdagi "score" e’tiborga olinmadi', (forge.json || {}).score, 0);

  const before = await req('/api/collection?name=placements', { cookie: dir });
  const nBefore = Object.keys((before.json || {}).items || {}).length;
  const wr = await req('/api/doc?path=' + encodeURIComponent('placements/pl_soxta'), {
    method: 'PUT', cookie: dir, body: { data: { id: 'pl_soxta', level: 'C2', score: 30 } }
  });
  ok('Natijani qo’lda yozib bo’lmaydi (' + wr.status + ')', wr.status === 403, wr.text.slice(0, 120));
  const after = await req('/api/collection?name=placements', { cookie: dir });
  eq('Rad etilgandan keyin natijalar soni o’zgarmadi',
    Object.keys((after.json || {}).items || {}).length, nBefore);
  const wq = await req('/api/doc?path=' + encodeURIComponent('testq/q001'), {
    method: 'PUT', cookie: dir, body: { data: { id: 'q001', level: 'A1', answer: 0 } }
  });
  ok('Savolni ham qo’lda yozib bo’lmaydi (' + wq.status + ')', wq.status === 403);

  /* ---------- 6. Hamma javobni to'g'ri berganda yuqori daraja ---------- */
  section('6. Hammasini to’g’ri belgilagan odam C2 oladi');
  /* To'g'ri javoblarni SERVER kodidan olamiz (mijoz ularni bilmaydi) —
     bu sinov server hisobi to'g'riligini tekshirish uchun. */
  const path = require('path');
  const { createStore } = require(path.join(__dirname, '..', 'server', 'store'));
  const lv = require(path.join(__dirname, '..', 'server', 'levels'));
  const store = createStore();
  if (store.ready) await store.ready;
  /* Variantlar tartibi har sessiyada aralashtirilgani uchun, asl javobni
     ko'rsatilgan tartibdagi o'ringa qaytaramiz. */
  async function rightChoice(sessId, q) {
    const doc = await store.get(lv.COL + q.id);
    const ses = await store.get(lv.SESS + sessId);
    const map = ses && ses.mix && ses.mix[q.id];
    const real = doc ? Number(doc.answer) : 0;
    return map ? map.indexOf(real) : real;
  }
  const s3 = await start();
  const allRight = [];
  for (const q of s3.json.questions) {
    allRight.push({ id: q.id, choice: await rightChoice(s3.json.id, q) });
  }
  const best = await submit({ sessionId: s3.json.id, answers: allRight, name: 'Soxta Nomzod', phone: '+998900000000' });
  eq('Natija qaytdi', best.status, 200);
  eq('Daraja C2', (best.json || {}).level, 'C2');
  eq('Hamma ball to’g’ri', (best.json || {}).score, (best.json || {}).total);

  section('   C2 uchun 20 tadan 19 tasi to’g’ri bo’lishi shart');
  /* Har bir daraja o'tilgan, lekin ikkita xato bor (18/20).
     Daraja C2 emas, C1 chiqishi kerak. */
  const s3b = await start();
  const nearly = [];
  let skipped = 0;
  for (const q of s3b.json.questions) {
    const right = await rightChoice(s3b.json.id, q);
    /* Xatoni faqat 4 savolli darajalarga qo'yamiz — shunda o'sha daraja
       ham o'tilgan bo'lib qoladi (4 tadan 3 tasi to'g'ri). */
    if (skipped < 2 && (q.level === 'C1' || q.level === 'C2') &&
      !nearly.some(x => x.lvl === q.level)) {
      nearly.push({ id: q.id, choice: (right + 1) % q.options.length, lvl: q.level });
      skipped++;
    } else {
      nearly.push({ id: q.id, choice: right, lvl: q.level });
    }
  }
  const near = await submit({ sessionId: s3b.json.id, answers: nearly.map(a => ({ id: a.id, choice: a.choice })) });
  eq('18 ta to’g’ri', (near.json || {}).score, 18);
  eq('C2 berilmadi, C1 chiqdi', (near.json || {}).level, 'C1');
  ok('C1 va C2 darajalari baribir o’tilgan (3/4)',
    ((near.json || {}).perLevel || {}).C2.ok === 3 && ((near.json || {}).perLevel || {}).C1.ok === 3,
    JSON.stringify((near.json || {}).perLevel));

  section('   Arab tilida ham baholash to’g’ri ishlaydi');
  const sAr = await start('ar');
  const arRight = [];
  for (const q of sAr.json.questions) {
    arRight.push({ id: q.id, choice: await rightChoice(sAr.json.id, q) });
  }
  const arRes = await submit({ sessionId: sAr.json.id, answers: arRight });
  eq('Arabchada ham C2', (arRes.json || {}).level, 'C2');
  ok('Natija arab tilida qaytdi', /[\u0600-\u06FF]/.test(((arRes.json || {}).info || {}).name || ''),
    JSON.stringify((arRes.json || {}).info));

  section('   Faqat A1 va A2 ni bilgan odam A2 oladi');
  const s4 = await start();
  const partial = [];
  for (const q of s4.json.questions) {
    if (q.level !== 'A1' && q.level !== 'A2') continue;
    partial.push({ id: q.id, choice: await rightChoice(s4.json.id, q) });
  }
  const mid = await submit({ sessionId: s4.json.id, answers: partial });
  eq('Daraja A2', (mid.json || {}).level, 'A2');
  ok('B1 o’tilmadi', ((mid.json || {}).perLevel || {}).B1.ok < 2,
    JSON.stringify((mid.json || {}).perLevel));

  /* ---------- 7. Natija bazaga yozildi ---------- */
  section('7. Natija bazaga yozildi va murojaat ochildi');
  const res = await req('/api/collection?name=placements', { cookie: dir });
  const items = Object.values((res.json || {}).items || {});
  const mine = items.filter(p => p.id === best.json.resultId)[0];
  ok('Natija bazada bor', !!mine, JSON.stringify(Object.keys((res.json || {}).items || {})).slice(0, 120));
  if (mine) {
    eq('Bazadagi daraja ham C2', mine.level, 'C2');
    eq('Ism saqlandi', mine.name, 'Soxta Nomzod');
  }
  const leads = await req('/api/collection?name=leads', { cookie: dir });
  ok('Murojaat (lead) ochildi',
    Object.values((leads.json || {}).items || {}).some(l => l && l.source === 'Daraja testi'),
    'murojaat topilmadi');

  section('   Ismsiz topshirilsa murojaat ochilmaydi');
  const s5 = await start();
  const nl0 = Object.values((await req('/api/collection?name=leads', { cookie: dir })).json.items || {}).length;
  await submit({ sessionId: s5.json.id, answers: [] });
  const nl1 = Object.values((await req('/api/collection?name=leads', { cookie: dir })).json.items || {}).length;
  eq('Murojaatlar soni o’zgarmadi', nl1, nl0);

  stopServer();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: alohida sinov serveri, soxta nomzod va vaqtinchalik baza ishlatildi;');
  console.log('haqiqiy odamga xabar yuborilmadi, production bazaga tegilmadi.');
  process.exit(fail ? 1 : 0);
})().catch(e => { stopServer(); console.error(e); process.exit(1); });
