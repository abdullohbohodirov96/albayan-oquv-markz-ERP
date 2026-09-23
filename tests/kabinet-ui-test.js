/* O'quvchi kabineti — brauzer tomoni (kirishsiz sahifa).
   Serverni alohida bazada ishga tushiring, keyin:
     node tests/kabinet-ui-test.js [port] [direktor paroli]                   */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT + '/';
const SHOTS = path.join(__dirname, '..', 'shots');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function api(path, body, cookie) {
  const res = await fetch('http://localhost:' + PORT + path, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => null), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

const R = 'u' + Date.now().toString(36);
const ID = n => R + '_' + n;

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* --- sun'iy ma'lumot (API orqali) --- */
  const lg = await api('/api/login', { login: 'admin', password: PASS });
  const dir = lg.cookie;
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }
  const put = async (p, data) => {
    const res = await fetch('http://localhost:' + PORT + '/api/doc?path=' + encodeURIComponent(p), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: dir },
      body: JSON.stringify({ data })
    });
    return res.status;
  };
  await put('staff/' + ID('t'), { id: ID('t'), name: 'Ustoz Sayt', status: 'faol' });
  await put('courses/' + ID('c'), { id: ID('c'), name: 'Arab tili', monthlyFee: 250000, active: true });
  await put('groups/' + ID('g'), {
    /* Guruh kodi bazada TAKRORLANMASLIGI kerak. Qattiq 'S001' yozilsa,
       sinov ikkinchi marta ishga tushganda kod band bo'lib, guruh
       yaratilmay qolardi — keyin kabinetda guruh ko'rinmasdi.        */
    id: ID('g'), code: 'S' + String(Date.now() % 1000).padStart(3, '0'),
    name: 'Sayt guruhi', courseId: ID('c'), teacherId: ID('t'),
    days: [1, 5], startTime: '16:00', endTime: '17:30', startDate: '2026-09-01',
    fee: 250000, feeHistory: [{ fee: 250000, from: '2026-09' }], limit: 10, status: 'faol'
  });
  await put('students/' + ID('s'), {
    id: ID('s'), firstName: 'Abdulloh', lastName: 'Bahodirov', phone: '+998901119988', status: 'faol'
  });
  await put('memberships/' + ID('m'), { id: ID('m'), studentId: ID('s'), groupId: ID('g'), joinedAt: '2026-09-01', status: 'faol' });
  const got = await fetch('http://localhost:' + PORT + '/api/doc?path=' + encodeURIComponent('students/' + ID('s')),
    { headers: { Cookie: dir } }).then(r => r.json());
  const code = String(((got || {}).data || {}).code || '');
  ok('O’quvchiga kod berildi: ' + code, /^\d{4}$/.test(code), code);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });

  /* ---------- 1. Kirish sahifasidan kabinetga ---------- */
  section('1. Kabinet sahifasi 4 xonali kod so’raydi');
  await page.goto(BASE + '#kabinet');
  await page.waitForSelector('#kab-code', { timeout: 20000 });
  await page.waitForTimeout(400);
  const first = await page.evaluate(() => {
    const i = document.getElementById('kab-code');
    return { max: i.getAttribute('maxlength'), mode: i.getAttribute('inputmode'), text: document.body.innerText };
  });
  eq('Kod maydoni 4 belgilik', first.max, '4');
  eq('Telefonda raqam klaviaturasi ochiladi', first.mode, 'numeric');
  ok('Parol maydoni yo’q', !(await page.evaluate(() => !!document.getElementById('login-pass'))));

  section('   Noto’g’ri kod bilan ma’lumot chiqmaydi');
  await page.fill('#kab-code', '0000');
  await page.waitForTimeout(1600);
  const badCode = await page.evaluate(() => document.body.innerText);
  ok('Ism chiqmadi', !/Bahodirov/.test(badCode), badCode.slice(0, 200));
  ok('Xato aytildi', /topilmad|urinish|kod/i.test(badCode), badCode.slice(0, 200));

  section('   To’g’ri kod bilan o’z ma’lumoti chiqadi');
  const myCode = await fetch('http://localhost:' + PORT + '/api/doc?path=' +
    encodeURIComponent('students/' + ID('s')), { headers: { Cookie: dir } })
    .then(r => r.json()).then(j => String(j.data.code));
  ok('O’quvchida kod bor: ' + myCode, /^\d{4}$/.test(myCode));
  await page.fill('#kab-code', myCode);
  await page.waitForSelector('.kab-card', { timeout: 15000 });
  const byCodeTxt = await page.evaluate(() => document.querySelector('.kab-card').innerText);
  ok('Kod bilan ism ko’rindi', /Bahodirov Abdulloh/.test(byCodeTxt), byCodeTxt.slice(0, 120));
  ok('Chiqish tugmasi bor', /Chiqish/.test(byCodeTxt), byCodeTxt.slice(-120));

  section('   Chiqishdan keyin qayta kod so’raladi');
  await page.click('.kab-out .btn');
  await page.waitForSelector('#kab-code', { timeout: 15000 });
  const afterOut = await page.evaluate(() => document.body.innerText);
  ok('Chiqqandan keyin ism ko’rinmaydi', !/Bahodirov Abdulloh/.test(afterOut), afterOut.slice(0, 200));

  /* ---------- 2. Soxta havola ---------- */
  section('2. Soxta havola bilan ochilmaydi');
  await page.goto(BASE + '#kabinet?t=lt000000000000.AAAAAAAAAAAAAAAAAAAAAA');
  await page.waitForSelector('.kabinet', { timeout: 20000 });
  await page.waitForTimeout(900);
  const badTxt = await page.evaluate(() => document.body.innerText);
  ok('Ism chiqmadi', !/Bahodirov/.test(badTxt), badTxt.slice(0, 200));
  ok('Xato aytildi', /yaroqsiz|muddati|ishlatilgan|havola/i.test(badTxt), badTxt.slice(0, 200));

  /* ---------- 3. To'g'ri havola ---------- */
  section('3. Bir martalik havola — ma’lumot chiqadi');
  const mk = await fetch('http://localhost:' + PORT + '/api/student/link', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: dir },
    body: JSON.stringify({ studentId: ID('s') })
  }).then(r => r.json());
  ok('Havola yaratildi', !!(mk && mk.token), JSON.stringify(mk).slice(0, 160));
  if (!mk || !mk.token) { console.log(out.join('\n')); console.log('Havola yaratilmadi — sinov to’xtadi.'); process.exit(1); }

  await page.goto(BASE + '#kabinet?t=' + mk.token);
  await page.waitForSelector('.kab-card', { timeout: 15000 });
  /* Karta avval sarlavha bilan chiziladi, guruh va to'lov keyin keladi —
     shuning uchun guruh bloki paydo bo'lguncha kutamiz.                */
  await page.waitForSelector('.kab-card .kab-groups', { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(500);
  const txt = await page.evaluate(() => document.querySelector('.kab-card').innerText);
  ok('Ism ko’rindi', /Bahodirov Abdulloh/.test(txt), txt.slice(0, 120));
  ok('Guruh ko’rindi', /Sayt guruhi/.test(txt), txt.slice(0, 250));
  ok('O’qituvchi ko’rindi', /Ustoz Sayt/.test(txt));
  ok('Dars vaqti ko’rindi', /16:00–17:30/.test(txt));
  ok('To’lov bo’limi bor', /To’lov|Qarz/.test(txt));
  ok('Davomat bo’limi bor', /Davomat/i.test(txt));
  ok('Telefon raqami ko’rsatilmadi', !/998901119988/.test(txt), txt.slice(0, 300));
  ok('Havola manzil satrida qolmadi', !/[?&]t=/.test(await page.evaluate(() => location.hash)),
    await page.evaluate(() => location.hash));
  await page.screenshot({ path: path.join(SHOTS, 'kabinet-390.png'), fullPage: true });

  const noScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('Sahifa yon tomonga siljimadi', noScroll <= 1, String(noScroll));

  /* ---------- 4. Sessiya saqlanadi, havola qayta ishlamaydi ---------- */
  section('4. Sessiya saqlanadi, havola esa bir marta ishlaydi');
  await page.goto(BASE + '#kabinet');
  await page.waitForSelector('.kab-card', { timeout: 15000 });
  ok('Qayta kirganda sessiya bilan ochildi', true);

  const reuse = await page.evaluate(async (tok) => {
    const r = await fetch('api/kabinet/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tok }), credentials: 'same-origin'
    });
    return r.status;
  }, mk.token);
  eq('Ishlatilgan havola rad etildi', reuse, 401);

  /* ---------- 5. Xodimlar tizimiga kirish mumkin emas ---------- */
  section('5. Kabinet xodimlar tizimini ochmaydi');
  const appHidden = await page.evaluate(() => {
    const a = document.getElementById('app');
    return !a || a.hasAttribute('hidden');
  });
  ok('Ichki tizim yopiq', appHidden);
  const bootData = await page.evaluate(async () => {
    const r = await fetch('api/bootstrap', { credentials: 'same-origin' });
    return r.status;
  });
  eq('Bootstrap kirishsiz berilmadi', bootData, 401);

  /* ---------- 6. Boshqa kenglliklar ---------- */
  section('6. 360 va 430 px');
  for (const w of [360, 430]) {
    await page.setViewportSize({ width: w, height: 860 });
    await page.goto(BASE + '#kabinet');
    await page.waitForSelector('.kab-card', { timeout: 15000 });
    const sx = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(w + ' px: yon siljish yo’q', sx <= 1, String(sx));
    await page.screenshot({ path: path.join(SHOTS, 'kabinet-' + w + '.png'), fullPage: true });
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nScreenshotlar: ' + SHOTS + '/kabinet-360.png, kabinet-390.png, kabinet-430.png');
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
