/* O'quv qismi — brauzer tomoni.

   Tekshiriladi:
     1) O'quv dasturi sahifasi: modul va dars qo'shiladi, ko'rinadi;
     2) Dars jarayoni: dars yozuvi saqlanadi, test tuziladi;
     3) O'quvchi kabineti: uy vazifasi, test va savol ko'rinadi, test ishlanadi;
     4) Ota-ona kabineti: farzandi ko'rinadi, "Testni ishlash" tugmasi YO'Q;
     5) Bayram sahifasi va ota-onalar sahifasi ochiladi;
     6) Telefon o'lchamida yon tomonga siljish yo'q, JS xatosi yo'q.

   Sinov O'ZI alohida server nusxasini (vaqtinchalik baza) ko'taradi.
     node tests/lms-ui-test.js                                              */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
/* Baza turi: standart — SQLite. TEST_DATABASE_URL berilsa, PostgreSQL. */
const PG = process.env.TEST_DATABASE_URL || '';
const { chromium } = require('playwright');

const PASS = 'Albyana2026!';
const PORT = 4100 + Math.floor(Math.random() * 90);
const BASE = 'http://localhost:' + PORT;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-lmsui-'));
const SHOTS = path.join(__dirname, '..', 'shots');
let srv = null;

async function bootServer() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: DIR, DB_DRIVER: PG ? 'pg' : 'sqlite', PORT: String(PORT),
      DATABASE_URL: PG || '',
      BACKUP_DIR: path.join(DIR, 'backups'), FILES_DIR: path.join(DIR, 'files'),
      SEED_DIRECTOR_PASSWORD: PASS
    }),
    stdio: 'ignore'
  });
  for (let i = 0; i < 80; i++) {
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
function ok(n, c, e) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 200) : '')); } }
function eq(n, got, want) { ok(n, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function api(p, o = {}) {
  const r = await fetch(BASE + p, {
    method: o.method || 'GET',
    headers: Object.assign(o.body ? { 'Content-Type': 'application/json' } : {},
      o.cookie ? { Cookie: o.cookie } : {}, o.csrf ? { 'X-Kab-Csrf': o.csrf } : {}),
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, text: t, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (p, data, cookie, extra) => api('/api/doc?path=' + encodeURIComponent(p),
  { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });

const R = 'U' + Date.now().toString(36);
const ID = n => R + '_' + n;

(async () => {
  if (!await bootServer()) { stopServer(); console.error('Sinov serveri ko’tarilmadi.'); process.exit(1); }
  fs.mkdirSync(SHOTS, { recursive: true });
  const dir = (await api('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } })).cookie;

  /* ---- sun'iy ma'lumot ---- */
  await put('staff/' + ID('t'), { id: ID('t'), name: 'Ustoz UI', status: 'faol' }, dir);
  await put('courses/' + ID('c'), { id: ID('c'), name: 'Arab tili', monthlyFee: 300000, active: true }, dir);
  await put('groups/' + ID('g'), {
    id: ID('g'), name: 'UI guruh', courseId: ID('c'), teacherId: ID('t'), level: 'A1',
    days: [1, 3], startTime: '10:00', endTime: '11:30', startDate: '2026-09-01',
    fee: 300000, limit: 10, status: 'faol'
  }, dir);
  await put('students/' + ID('s'), {
    id: ID('s'), firstName: 'Abdulloh', lastName: 'Bahodirov', phone: '+998901119988', status: 'active'
  }, dir);
  await put('memberships/' + ID('m'), {
    id: ID('m'), studentId: ID('s'), groupId: ID('g'), status: 'faol', from: '2026-09-01'
  }, dir);
  const st = (await api('/api/doc?path=' + encodeURIComponent('students/' + ID('s')), { cookie: dir })).json.data;

  await api('/api/lesson/log', {
    method: 'POST', cookie: dir,
    body: {
      groupId: ID('g'), date: '2026-09-09', title: 'Harflar',
      homeworkText: '10 ta harf yozish', dueDate: '2026-09-11'
    }
  });
  const qz = await api('/api/quiz', {
    method: 'POST', cookie: dir,
    body: {
      title: 'Alifbo testi', groupId: ID('g'), pass: 50,
      questions: [
        { text: 'Birinchi harf?', options: ['أ', 'ب'], answer: 0 },
        { text: 'Ikkinchi harf?', options: ['أ', 'ب'], answer: 1 }
      ]
    }
  });
  const par = await api('/api/parent', {
    method: 'POST', cookie: dir,
    body: { name: 'Ota Bahodirov', relation: 'ota', studentIds: [ID('s')] }
  });

  const browser = await chromium.launch();

  /* ================= 1. Xodim tomoni ================= */
  section('1. Xodim: dastur va dars jarayoni');
  const admin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await admin.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/#kirish');
  await p.waitForSelector('#login-user', { timeout: 20000 });
  await p.fill('#login-user', 'admin');
  await p.fill('#login-pass', PASS);
  await p.click('button[type=submit]');
  await p.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await p.waitForTimeout(700);

  await p.goto(BASE + '/#curriculum');
  await p.waitForTimeout(1200);
  ok('Dastur sahifasi ochildi', /O’quv dasturi|O'quv dasturi/.test(await p.evaluate(() => document.body.innerText)));

  /* modul qo'shamiz */
  await p.click('.page-actions .btn.primary');
  await p.waitForSelector('.modal-back', { timeout: 10000 });
  await p.waitForSelector('.modal-back .form-grid input, .modal-back .m-body input', { timeout: 15000 });
  await p.evaluate(() => {
    const i = document.querySelector('.modal-back .form-grid input') ||
      document.querySelector('.modal-back .m-body input');
    i.value = 'Alifbo moduli';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.click('.modal-back .m-foot .btn.primary');
  await p.waitForTimeout(1500);
  const afterMod = await p.evaluate(() => document.body.innerText);
  ok('Modul ro’yxatda ko’rindi', /Alifbo moduli/.test(afterMod), afterMod.slice(0, 200));

  await p.goto(BASE + '/#learning');
  await p.waitForTimeout(1500);
  const learnTxt = await p.evaluate(() => document.body.innerText);
  ok('Dars jarayoni sahifasi ochildi', /Dars jarayoni/.test(learnTxt), learnTxt.slice(0, 160));
  ok('Dars yozuvi ko’rinadi', /Harflar/.test(learnTxt), learnTxt.slice(0, 400));

  await p.goto(BASE + '/#learning?group=' + ID('g') + '&tab=quiz');
  await p.waitForTimeout(1200);
  ok('Testlar bo’limida test ko’rinadi',
    /Alifbo testi/.test(await p.evaluate(() => document.body.innerText)));

  await p.goto(BASE + '/#progress');
  await p.waitForTimeout(1800);
  ok('O’quv natijalari sahifasi ochildi',
    /O’quv natijalari|O'quv natijalari/.test(await p.evaluate(() => document.body.innerText)));

  await p.goto(BASE + '/#holidays');
  await p.waitForTimeout(1000);
  ok('Bayram sahifasi ochildi',
    /Bayram va tanaffus/.test(await p.evaluate(() => document.body.innerText)));

  await p.goto(BASE + '/#parents');
  await p.waitForTimeout(1200);
  const parTxt = await p.evaluate(() => document.body.innerText);
  ok('Ota-onalar sahifasi ochildi', /Ota-onalar/.test(parTxt), parTxt.slice(0, 160));
  ok('Ota-ona ro’yxatda', /Ota Bahodirov/.test(parTxt), parTxt.slice(0, 300));
  ok('Xodim tomonida JS xatosi yo’q', errs.length === 0, errs.join(' | '));
  await admin.close();

  /* ================= 2. O'quvchi kabineti ================= */
  section('2. O’quvchi kabineti');
  const stCtx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const sp = await stCtx.newPage();
  const sErrs = [];
  sp.on('pageerror', e => sErrs.push(e.message));
  await sp.goto(BASE + '/#kabinet');
  await sp.waitForSelector('#kab-code', { timeout: 20000 });
  await sp.fill('#kab-code', String(st.code));
  await sp.waitForSelector('.kab-card', { timeout: 20000 });
  await sp.waitForTimeout(2000);
  const kabTxt = await sp.evaluate(() => document.body.innerText);
  ok('Ism ko’rindi', /Bahodirov Abdulloh/.test(kabTxt), kabTxt.slice(0, 150));
  ok('Uy vazifasi ko’rindi', /uy vazifasi/i.test(kabTxt), kabTxt.slice(0, 500));
  ok('10 ta harf vazifasi matni bor', /10 ta harf/.test(kabTxt));
  ok('Testlar bo’limi bor', /testlar/i.test(kabTxt), kabTxt.slice(0, 700));
  ok('Testni ishlash tugmasi bor', !!(await sp.$('button:has-text("Testni ishlash")')));
  ok('Savol berish tugmasi bor', !!(await sp.$('button:has-text("Ustozga savol berish")')));
  await sp.screenshot({ path: path.join(SHOTS, 'kabinet-oquvchi.png'), fullPage: true });

  section('   Kabinetda test ishlash');
  await sp.click('button:has-text("Testni ishlash")');
  await sp.waitForSelector('.modal-back .test-opt', { timeout: 15000 });
  for (let i = 0; i < 6; i++) {
    const b = await sp.$('.modal-back .test-opt');
    if (!b) break;
    await b.click();
    await sp.waitForTimeout(200);
  }
  await sp.waitForSelector('.modal-back .test-res', { timeout: 15000 });
  const resTxt = await sp.evaluate(() => document.querySelector('.modal-back .test-res').innerText);
  ok('Natija ko’rsatildi', /%/.test(resTxt), resTxt.slice(0, 120));
  await sp.screenshot({ path: path.join(SHOTS, 'kabinet-test.png'), fullPage: true });

  const sScroll = await sp.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('O’quvchi kabinetida yon siljish yo’q', sScroll <= 1, String(sScroll));
  ok('O’quvchi tomonida JS xatosi yo’q', sErrs.length === 0, sErrs.join(' | '));
  await stCtx.close();

  /* ================= 3. Ota-ona kabineti ================= */
  section('3. Ota-ona kabineti');
  const pCtx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const pp = await pCtx.newPage();
  const pErrs = [];
  pp.on('pageerror', e => pErrs.push(e.message));
  await pp.goto(BASE + '/#kabinet');
  await pp.waitForSelector('#kab-code', { timeout: 20000 });
  await pp.fill('#kab-code', String(par.json.parent.code));
  await pp.waitForSelector('.kab-card', { timeout: 20000 });
  await pp.waitForTimeout(2000);
  const parKab = await pp.evaluate(() => document.body.innerText);
  ok('Ota-ona ismi ko’rindi', /Ota Bahodirov/.test(parKab), parKab.slice(0, 150));
  ok('Farzandi ko’rindi', /Bahodirov Abdulloh/.test(parKab), parKab.slice(0, 300));
  ok('Ota-ona kabineti deb yozilgan', /Ota-ona kabineti/.test(parKab));
  ok('Uy vazifasi ota-onaga ham ko’rinadi', /10 ta harf/i.test(parKab), parKab.slice(0, 600));
  eq('Ota-onada "Testni ishlash" tugmasi yo’q',
    await pp.$('button:has-text("Testni ishlash")'), null);
  eq('Ota-onada "Ustozga savol berish" tugmasi yo’q',
    await pp.$('button:has-text("Ustozga savol berish")'), null);
  await pp.screenshot({ path: path.join(SHOTS, 'kabinet-ota-ona.png'), fullPage: true });
  const pScroll = await pp.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('Ota-ona kabinetida yon siljish yo’q', pScroll <= 1, String(pScroll));
  ok('Ota-ona tomonida JS xatosi yo’q', pErrs.length === 0, pErrs.join(' | '));
  await pCtx.close();

  await browser.close();
  stopServer();
  console.log(out.join('\n'));
  console.log('\nScreenshotlar: ' + SHOTS + '/kabinet-oquvchi.png, kabinet-test.png, kabinet-ota-ona.png');
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: Chromium emulyatsiyasi, alohida sinov serveri va soxta ma’lumot.');
  process.exit(fail ? 1 : 0);
})().catch(e => { stopServer(); console.error(e); process.exit(1); });
