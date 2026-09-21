/* KODLAR BARQARORLIGI sinovi.

   Markaz rahbari aytgan xatolar:
     1) Guruh kodi "B020" deb yozilsa ham, kirib chiqqandan keyin o'zgarib
        qolardi — server uni majburan 4 xonali RAQAMGA almashtirardi.
     2) O'quvchining shaxsiy kodini qo'lda berib bo'lmasdi.
     3) Excel'dan import qilinganda fayldagi tayyor kod olinmasdi.
     4) Bot faqat 4 xonali raqamni tanirdi, "B020" ni topolmasdi.

   Shu sinov har bir xatoni alohida tekshiradi: eski kodda yiqiladi,
   tuzatilganda o'tadi. Rad etilgan so'rovdan keyin bazadagi ma'lumot
   o'zgarmaganini ham tekshiradi.

   Ishga tushirish:  node tests/kod-test.js                                */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = 'Albyana2026!';
const PORT = 4100 + Math.floor(Math.random() * 300);
const BASE = 'http://localhost:' + PORT;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-kod-'));
const PG = process.env.TEST_DATABASE_URL || '';
let srv = null;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

async function bootServer() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: DIR, DB_DRIVER: PG ? 'pg' : 'sqlite', PORT: String(PORT),
      DATABASE_URL: PG || '',
      BACKUP_DIR: path.join(DIR, 'backups'),
      FILES_DIR: path.join(DIR, 'files'),
      SEED_DIRECTOR_PASSWORD: PASS
    }),
    stdio: 'ignore'
  });
  for (let i = 0; i < 90; i++) {
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

let COOKIE = '';
async function req(p, opts) {
  opts = opts || {};
  const h = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
  if (COOKIE) h.cookie = COOKIE;
  const r = await fetch(BASE + p, {
    method: opts.method || 'GET', headers: h,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const set = r.headers.get('set-cookie');
  if (set) COOKIE = set.split(';')[0];
  let j = null;
  try { j = await r.json(); } catch (e) { }
  return { status: r.status, data: j };
}
const put = (p, data) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', body: { data } });
/* /api/doc javobi: { data: {...} } — shuning uchun bir qavat ochamiz */
const get = async (p) => {
  const r = await req('/api/doc?path=' + encodeURIComponent(p));
  return { status: r.status, data: (r.data && r.data.data) || null };
};

(async () => {
  if (!await bootServer()) { console.error('Server ishga tushmadi'); stopServer(); process.exit(1); }

  const login = await req('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  if (login.status !== 200) { console.error('Direktor kira olmadi'); stopServer(); process.exit(1); }

  await put('courses/kc1', { id: 'kc1', name: 'Arab tili', monthlyFee: 400000, active: true });

  /* =============== 1. GURUH KODI O'ZGARMAYDI =============== */
  section('1. Guruh kodi yozilgandek qoladi');

  const G = {
    id: 'kg1', name: 'A1 ertalab', code: 'B020', courseId: 'kc1',
    days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: '2026-01-01',
    fee: 400000, feeHistory: [{ fee: 400000, from: '2026-01' }], limit: 12, status: 'faol'
  };
  const r1 = await put('groups/kg1', G);
  ok('Guruh "B020" kodi bilan saqlandi', r1.status === 200, 'status ' + r1.status);

  const g1 = await get('groups/kg1');
  ok('Saqlangandan keyin kod hamon B020', g1.data && g1.data.code === 'B020',
    'olindi: ' + (g1.data && g1.data.code));

  /* Boshqa maydonni o'zgartirib qayta saqlaymiz — kod tegilmasin */
  const g1b = Object.assign({}, g1.data, { name: 'A1 ertalab (yangi nom)' });
  await put('groups/kg1', g1b);
  const g1c = await get('groups/kg1');
  ok('Tahrirdan keyin ham B020', g1c.data && g1c.data.code === 'B020',
    'olindi: ' + (g1c.data && g1c.data.code));

  /* Kodni umuman yubormasak ham eskisi qolsin */
  const g1d = Object.assign({}, g1c.data); delete g1d.code;
  await put('groups/kg1', g1d);
  const g1e = await get('groups/kg1');
  ok('Kod yuborilmasa ham B020 qoladi', g1e.data && g1e.data.code === 'B020',
    'olindi: ' + (g1e.data && g1e.data.code));

  /* Har xil ko'rinishdagi kodlar */
  /* Kod eng kami 3 belgi: "A1"/"B2" daraja nomi bo'lgani uchun kod bo'lolmaydi */
  for (const [kod, kutilgan] of [['A12', 'A12'], ['4821', '4821'], ['b-055', 'B055'], ['g 07', 'G07']]) {
    const id = 'kg_' + kod.replace(/[^a-z0-9]/gi, '');
    await put('groups/' + id, Object.assign({}, G, { id, code: kod, name: 'Guruh ' + kod }));
    const got = await get('groups/' + id);
    ok('Kod "' + kod + '" → "' + kutilgan + '"', got.data && got.data.code === kutilgan,
      'olindi: ' + (got.data && got.data.code));
  }

  /* Ikki belgili kod (daraja nomi) qabul qilinmaydi — server o'zi kod beradi */
  await put('groups/kg_short', Object.assign({}, G, { id: 'kg_short', code: 'A1', name: 'Qisqa' }));
  const sh = await get('groups/kg_short');
  ok('Ikki belgili "A1" kod sifatida olinmadi',
    sh.data && sh.data.code !== 'A1' && /^[A-Z0-9]{3,12}$/.test(String(sh.data.code || '')),
    'olindi: ' + (sh.data && sh.data.code));

  /* Band kod qabul qilinmaydi va bazadagi yozuv o'zgarmaydi */
  const before = await get('groups/kg1');
  const dupRes = await put('groups/kg_A12', Object.assign({}, G, { id: 'kg_A12', code: 'B020', name: 'Nusxa' }));
  ok('Band kod rad etildi', dupRes.status === 400, 'status ' + dupRes.status);
  const after = await get('groups/kg1');
  ok('Rad etilgandan keyin B020 egasi o’zgarmadi',
    after.data && after.data.code === 'B020' && after.data.name === before.data.name);
  const dupAfter = await get('groups/kg_A12');
  ok('Rad etilgan guruh kodi ham o’zgarmadi', dupAfter.data && dupAfter.data.code === 'A12',
    'olindi: ' + (dupAfter.data && dupAfter.data.code));

  /* =============== 2. SERVER QAYTA ISHGA TUSHSA =============== */
  section('2. Server qayta ishga tushganda kodlar saqlanadi');

  try { srv.kill(); } catch (e) { }
  await new Promise(r => setTimeout(r, 800));
  srv = null;
  if (!await bootServer()) { out.push('  ✗ Server qayta ishga tushmadi'); fail++; }
  else {
    COOKIE = '';
    await req('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
    const g2 = await get('groups/kg1');
    ok('Qayta ishga tushgandan keyin ham B020', g2.data && g2.data.code === 'B020',
      'olindi: ' + (g2.data && g2.data.code));
    const g3 = await get('groups/kg_A12');
    ok('"A12" kodi ham saqlanib qoldi', g3.data && g3.data.code === 'A12',
      'olindi: ' + (g3.data && g3.data.code));
  }

  /* =============== 3. O'QUVCHI KODINI QO'LDA BERISH =============== */
  section('3. O’quvchining shaxsiy kodi');

  const S = {
    id: 'ks1', firstName: 'Abdulloh', lastName: 'Bahodirov',
    phone: '+998901112233', status: 'faol', code: '7777'
  };
  const s1 = await put('students/ks1', S);
  ok('O’quvchi 7777 kodi bilan saqlandi', s1.status === 200, 'status ' + s1.status);
  const gs1 = await get('students/ks1');
  ok('Berilgan kod o’zgarmadi', gs1.data && gs1.data.code === '7777',
    'olindi: ' + (gs1.data && gs1.data.code));

  /* Tahrirda kod tegilmasin */
  await put('students/ks1', Object.assign({}, gs1.data, { note: 'izoh' }));
  const gs2 = await get('students/ks1');
  ok('Tahrirdan keyin ham 7777', gs2.data && gs2.data.code === '7777',
    'olindi: ' + (gs2.data && gs2.data.code));

  /* Kodsiz yuborilsa eskisi qoladi */
  const noCode = Object.assign({}, gs2.data); delete noCode.code;
  await put('students/ks1', noCode);
  const gs3 = await get('students/ks1');
  ok('Kod yuborilmasa ham 7777 qoladi', gs3.data && gs3.data.code === '7777',
    'olindi: ' + (gs3.data && gs3.data.code));

  /* Kodsiz yangi o'quvchiga server o'zi beradi */
  await put('students/ks2', {
    id: 'ks2', firstName: 'Diyor', lastName: 'Rahmonov',
    phone: '+998901112244', status: 'faol'
  });
  const gs4 = await get('students/ks2');
  ok('Kodsiz o’quvchiga server kod berdi',
    gs4.data && /^\d{4}$/.test(String(gs4.data.code || '')),
    'olindi: ' + (gs4.data && gs4.data.code));
  ok('Yangi kod boshqasiniki emas', gs4.data && gs4.data.code !== '7777');

  /* Band kod rad etiladi va egasi o'zgarmaydi */
  const busyRes = await put('students/ks2', Object.assign({}, gs4.data, { code: '7777' }));
  ok('Band kod rad etildi', busyRes.status === 400, 'status ' + busyRes.status);
  const gs5 = await get('students/ks1');
  ok('Rad etilgandan keyin 7777 egasi o’zgarmadi', gs5.data && gs5.data.code === '7777');
  const gs6 = await get('students/ks2');
  ok('Rad etilgan o’quvchi kodi ham o’zgarmadi', gs6.data && gs6.data.code === gs4.data.code,
    'olindi: ' + (gs6.data && gs6.data.code));

  /* Kodni ataylab almashtirish — ruxsat bor, ishlaydi */
  const chg = await put('students/ks1', Object.assign({}, gs5.data, { code: '8888' }));
  ok('Kodni ataylab almashtirish mumkin', chg.status === 200, 'status ' + chg.status);
  const gs7 = await get('students/ks1');
  ok('Yangi kod 8888 bo’ldi', gs7.data && gs7.data.code === '8888',
    'olindi: ' + (gs7.data && gs7.data.code));

  /* =============== 4. KABINET VA BOT SHU KOD BILAN =============== */
  section('4. Kabinet va bot shu kod bilan ishlaydi');

  const kabOld = await fetch(BASE + '/api/kabinet', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: '7777' })
  });
  ok('Eski kod (7777) endi ishlamaydi', kabOld.status === 404, 'status ' + kabOld.status);

  const kabNew = await fetch(BASE + '/api/kabinet', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: '8888' })
  });
  ok('Yangi kod (8888) bilan kabinetga kirildi', kabNew.status === 200, 'status ' + kabNew.status);
  const kabJson = await kabNew.json().catch(() => ({}));
  const kabName = kabJson && kabJson.student && kabJson.student.name;
  ok('Kabinet to’g’ri o’quvchini berdi',
    String(kabName || '').indexOf('Abdulloh') >= 0, JSON.stringify(kabName));
  ok('Kabinet javobida kod o’sha — 8888',
    kabJson && kabJson.student && kabJson.student.code === '8888',
    JSON.stringify(kabJson && kabJson.student && kabJson.student.code));

  /* Bot guruh nomidan kodni topadimi */
  const bot = require('../server/bot');
  const botTest = bot._test && bot._test({
    store: null, stamp: () => '2026-01-01 10:00',
    A: require('../server/shared').A, send: async () => ({ ok: true })
  });
  if (botTest && botTest.codesInTitle) {
    const c1 = botTest.codesInTitle('Arab tili A1 · B020');
    ok('Bot "B020" ni guruh nomidan topdi', c1.indexOf('B020') >= 0, c1.join(','));
    const c2 = botTest.codesInTitle('Arab tili · 4821');
    ok('Bot "4821" ni ham topadi', c2.indexOf('4821') >= 0, c2.join(','));
  } else {
    out.push('  · bot._test().codesInTitle ochiq emas — o’tkazib yuborildi');
  }

  /* =============== 5. IMPORTDAN KELGAN KOD =============== */
  section('5. Excel importidan kelgan kod');

  await put('students/ks3', {
    id: 'ks3', firstName: 'Sitora', lastName: 'Umarova',
    phone: '+998901112255', status: 'faol', code: '1234', imported: true
  });
  const gs8 = await get('students/ks3');
  ok('Importdagi 1234 kodi o’zgarmasdan saqlandi', gs8.data && gs8.data.code === '1234',
    'olindi: ' + (gs8.data && gs8.data.code));

  const kab3 = await fetch(BASE + '/api/kabinet', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: '1234' })
  });
  ok('Import qilingan o’quvchi shu kod bilan kabinetga kiradi', kab3.status === 200,
    'status ' + kab3.status);

  /* =============== YAKUN =============== */
  console.log(out.join('\n'));
  console.log('\n' + (fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') +
    ' — ' + pass + ' ta o\'tdi, ' + fail + ' ta xato');
  stopServer();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); stopServer(); process.exit(1); });
