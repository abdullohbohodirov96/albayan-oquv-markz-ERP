/* PWA sinovi: o'rnatish fayllari, kesh qoidalari va internet uzilgandagi halollik.
   Server kerak:  node server/index.js   (standart 3000)
   Ishga tushirish:  node tests/pwa-test.js [port] [parol]                   */
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || 3301;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

(async () => {
  section('1. O’rnatish fayllari serverdan ochiladi');
  const man = await fetch(BASE + '/manifest.webmanifest');
  ok('manifest.webmanifest ochildi', man.status === 200);
  const manJson = await man.json();
  ok('Nomi to’g’ri', manJson.short_name === 'Albyana', manJson.short_name);
  ok('start_url bor', !!manJson.start_url);
  ok('display: standalone', manJson.display === 'standalone');
  ok('192 va 512 belgilar bor',
    manJson.icons.some(i => i.sizes === '192x192') && manJson.icons.some(i => i.sizes === '512x512'));
  ok('maskable belgi bor', manJson.icons.some(i => i.purpose === 'maskable'));
  for (const icon of manJson.icons) {
    const r = await fetch(BASE + '/' + icon.src);
    ok('Belgi ochildi: ' + icon.src + ' (' + r.status + ')', r.status === 200);
  }
  const sw = await fetch(BASE + '/sw.js');
  ok('sw.js ochildi', sw.status === 200);
  const swText = await sw.text();
  ok('sw.js da /api/ keshlanmaydi', /isApi\(url\)\) return;/.test(swText));

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });

  section('2. Xizmat ishchisi ro’yxatdan o’tadi');
  await page.goto(BASE + '/');
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.waitForTimeout(1500);
  const swState = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r ? { scope: r.scope, has: !!(r.active || r.installing || r.waiting) } : null;
  });
  ok('Ro’yxatdan o’tdi', !!swState && swState.has, JSON.stringify(swState));

  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(1500);

  section('3. Maxfiy javoblar keshlanmaydi');
  const cacheKeys = await page.evaluate(async () => {
    const names = await caches.keys();
    const all = [];
    for (const n of names) {
      const c = await caches.open(n);
      (await c.keys()).forEach(r => all.push(r.url));
    }
    return all;
  });
  ok('Keshda fayllar bor (' + cacheKeys.length + ')', cacheKeys.length > 3);
  const apiCached = cacheKeys.filter(u => u.indexOf('/api/') >= 0);
  ok('Keshda /api/ javoblari yo’q', apiCached.length === 0, apiCached.join(', '));
  ok('CSS keshlandi', cacheKeys.some(u => /app\.css$/.test(u)));

  section('4. Internet uzilganda halol xabar');
  await ctx.setOffline(true);
  await page.waitForTimeout(600);
  const barText = await page.locator('#pwa-bar').textContent().catch(() => '');
  ok('Ogohlantirish chiqdi', /Internet yo/.test(barText || ''), barText);

  // to'lov urinishi — "saqlandi" deb ko'rsatilmasligi kerak
  const payResult = await page.evaluate(async () => {
    try {
      const r = await window.A.Data.api('POST', 'api/payment', {
        id: 'offline_test', studentId: 'x', amount: 1000, date: '2026-09-01', method: 'naqd', allocations: []
      });
      return { ok: true, r: r };
    } catch (e) { return { ok: false, msg: e.message, offline: !!e.offline }; }
  });
  ok('To’lov "saqlandi" deb ko’rsatilmadi', payResult.ok === false, JSON.stringify(payResult));
  ok('Xabar internet yo’qligini aytdi', /Internet yo/.test(payResult.msg || ''), payResult.msg);
  ok('Saqlanmagani aniq aytilgan', /saqlanmadi/i.test(payResult.msg || ''), payResult.msg);

  section('5. Internetsiz ilova baribir ochiladi');
  await page.reload();
  const opened = await page.waitForSelector('#login-user, #app', { timeout: 20000 }).then(() => true).catch(() => false);
  ok('Sahifa keshdan ochildi', opened);

  await ctx.setOffline(false);
  await page.waitForTimeout(500);

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: bu Chromium emulyatsiyasi, haqiqiy iPhone/Android emas.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
