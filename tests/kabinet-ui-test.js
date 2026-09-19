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
    id: ID('g'), code: 'S001', name: 'Sayt guruhi', courseId: ID('c'), teacherId: ID('t'),
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
  section('1. Kirish sahifasida "O’quvchimisiz?" havolasi');
  await page.goto(BASE + '#kirish');
  await page.waitForSelector('#login-user', { timeout: 20000 });
  const hasLink = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll('button')).find(b => /Shaxsiy kod/.test(b.textContent)));
  ok('Havola bor', hasLink);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => /Shaxsiy kod/.test(b.textContent)).click();
  });
  await page.waitForSelector('#kab-code', { timeout: 10000 });
  ok('Kabinet sahifasi ochildi', true);
  ok('Kirish talab qilinmadi (parol maydoni yo’q)',
    !(await page.evaluate(() => !!document.getElementById('login-pass'))));

  /* ---------- 2. Noto'g'ri kod ---------- */
  section('2. Noto’g’ri kod');
  await page.fill('#kab-code', '0001');
  await page.click('.kabinet button[type=submit]');
  await page.waitForTimeout(900);
  const errText = await page.evaluate(() => {
    const e = document.querySelector('.kabinet .err-msg');
    return e && !e.hidden ? e.textContent : '';
  });
  ok('Xato yozuvi chiqdi', /topilmadi|kod/i.test(errText), JSON.stringify(errText));
  ok('Hech kimning ismi chiqmadi', !/Bahodirov/.test(await page.evaluate(() => document.body.innerText)));

  /* ---------- 3. To'g'ri kod ---------- */
  section('3. To’g’ri kod — ma’lumot chiqadi');
  await page.fill('#kab-code', code);
  await page.click('.kabinet button[type=submit]');
  await page.waitForSelector('.kab-card', { timeout: 10000 });
  const txt = await page.evaluate(() => document.querySelector('.kab-card').innerText);
  ok('Ism ko’rindi', /Bahodirov Abdulloh/.test(txt), txt.slice(0, 120));
  ok('Kod ko’rindi', txt.indexOf(code) >= 0, txt.slice(0, 120));
  ok('Guruh ko’rindi', /Sayt guruhi/.test(txt), txt.slice(0, 250));
  ok('O’qituvchi ko’rindi', /Ustoz Sayt/.test(txt));
  ok('Dars vaqti ko’rindi', /16:00–17:30/.test(txt));
  ok('To’lov bo’limi bor', /To’lov|Qarz/.test(txt));
  ok('Davomat bo’limi bor', /Davomat/i.test(txt));
  ok('Telefon raqami ko’rsatilmadi', !/998901119988/.test(txt), txt.slice(0, 300));
  await page.screenshot({ path: path.join(SHOTS, 'kabinet-390.png'), fullPage: true });

  const noScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('Sahifa yon tomonga siljimadi', noScroll <= 1, String(noScroll));

  /* ---------- 4. Havola orqali ---------- */
  section('4. Havola orqali to’g’ridan-to’g’ri');
  await page.goto(BASE + '#kabinet?kod=' + code);
  await page.waitForSelector('.kab-card', { timeout: 15000 });
  const txt2 = await page.evaluate(() => document.querySelector('.kab-card').innerText);
  ok('Havoladan ochilganda ham chiqdi', /Bahodirov Abdulloh/.test(txt2), txt2.slice(0, 120));

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
    await page.goto(BASE + '#kabinet?kod=' + code);
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
