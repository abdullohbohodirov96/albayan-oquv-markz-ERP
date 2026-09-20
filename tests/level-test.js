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
process.env.DB_DRIVER = 'sqlite';
let srv = null;

async function bootServer() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: DIR, DB_DRIVER: 'sqlite', PORT: String(PORT),
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
const start = () => req('/api/test/start', { method: 'POST', body: {} });
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

  section('   Savol turlari xilma-xil');
  const kinds = [...new Set(qs.map(q => q.kind))];
  ok('Kamida 4 xil savol turi bor (' + kinds.join(', ') + ')', kinds.length >= 4, String(kinds.length));
  ok('Har bir savolda tur nomi bor', qs.every(q => !!q.kindLabel), JSON.stringify(qs[0]));
  const perLevelKinds = {};
  qs.forEach(q => { (perLevelKinds[q.level] = perLevelKinds[q.level] || new Set()).add(q.kind); });
  ok('Har darajada kamida 2 xil tur bor',
    Object.keys(perLevelKinds).every(l => perLevelKinds[l].size >= 2),
    Object.keys(perLevelKinds).map(l => l + ':' + perLevelKinds[l].size).join(' '));

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

  section('   Faqat A1 va A2 ni bilgan odam A2 oladi');
  const s4 = await start();
  const partial = [];
  for (const q of s4.json.questions) {
    if (q.level !== 'A1' && q.level !== 'A2') continue;
    partial.push({ id: q.id, choice: await rightChoice(s4.json.id, q) });
  }
  const mid = await submit({ sessionId: s4.json.id, answers: partial });
  eq('Daraja A2', (mid.json || {}).level, 'A2');
  ok('B1 o’tilmadi', ((mid.json || {}).perLevel || {}).B1.ok < 3,
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
