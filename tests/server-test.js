/* Serverli versiyani brauzerda tekshirish.
   Avval serverni ishga tushiring:
     SEED_DIRECTOR_LOGIN=admin SEED_DIRECTOR_PASSWORD='...' PORT=3100 node server/index.js
   Keyin:  node tests/server-test.js [port] [parol]                        */
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || 3100;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT;

(async () => {
  const browser = await chromium.launch();
  const steps = [], errors = [];

  async function open(viewport) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|fonts/.test(m.text())) errors.push(m.text()); });
    await page.goto(BASE);
    return { ctx, page };
  }
  async function login(page, u, p) {
    await page.waitForSelector('#login-user', { timeout: 15000 });
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('button[type=submit]');
    await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    await page.waitForTimeout(700);
  }

  /* 1. Direktor kiradi */
  const { ctx, page } = await open({ width: 1320, height: 900 });
  const t0 = Date.now();
  await login(page, 'admin', PASS);
  steps.push('Direktor kirdi (' + (Date.now() - t0) + ' ms)');

  const mode = await page.evaluate(() => window.A.Data.mode);
  steps.push('Ishlash rejimi: ' + mode);

  /* 2. Noto'g'ri parol */
  const bad = await page.evaluate(async () => {
    try { await window.A.Data.serverLogin('admin', 'xato-parol'); return 'kirdi (XATO!)'; }
    catch (e) { return 'rad etildi: ' + e.message; }
  });
  steps.push('Noto’g’ri parol — ' + bad);

  /* 3. O'quvchi qo'shish */
  await page.click('#nav button:has-text("O’quvchilar")');
  await page.waitForTimeout(500);
  await page.click('.page-actions button:has-text("O’quvchi qo’shish")');
  await page.waitForSelector('.modal');
  const ins = page.locator('.modal input');
  await ins.nth(0).fill('Server');
  await ins.nth(1).fill('Testov');
  await ins.nth(4).fill('901112233');
  await page.locator('.modal .m-foot button').last().click();
  await page.waitForTimeout(1500);
  steps.push('O’quvchi saqlandi → ' + (await page.locator('.page-head h1').first().textContent()));

  /* 4. Sahifa yangilanganda ma'lumot qoladi */
  await page.reload();
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  await page.waitForTimeout(900);
  const count = await page.evaluate(() => Object.keys(window.A.Data.col.students).length);
  steps.push('Sahifa yangilangandan keyin o’quvchilar soni: ' + count);

  /* 5. Guruh ochish va kod */
  await page.evaluate(async () => {
    const A = window.A, D = A.Data;
    await D.save('courses', { id: 'crs_ar', name: 'Arab tili', monthlyFee: 450000, lessonMinutes: 90, active: true });
    await D.save('rooms', { id: 'room_1', name: '1-xona', capacity: 12 });
    await D.save('staff', { id: 'stf_1', name: 'Ustoz Bir', status: 'faol', payType: 'percent', percentRate: 40, position: 'O’qituvchi' });
  });
  await page.reload();
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForTimeout(800);
  await page.click('#nav button:has-text("Guruhlar")');
  await page.waitForTimeout(500);
  await page.click('.page-actions button:has-text("Guruh ochish")');
  await page.waitForSelector('.modal');
  const code = await page.locator('.modal input').nth(1).inputValue();
  steps.push('Yangi guruh uchun taklif qilingan kod: ' + code);
  await page.keyboard.press('Escape');

  /* 6. O'qituvchi hisobini yaratish va cheklovni tekshirish */
  await page.evaluate(async () => {
    const A = window.A, D = A.Data;
    const salt = 'srv' + Math.random().toString(36).slice(2, 8);
    const hash = await A.sha256('ustoz::1234::' + salt);
    await D.save('users', {
      id: 'usr_ustoz2', login: 'ustoz', name: 'Ustoz Bir', role: 'oqituvchi',
      staffId: 'stf_1', salt, hash, active: true
    });
  });
  await page.waitForTimeout(600);
  await ctx.close();

  const { ctx: c2, page: p2 } = await open({ width: 1320, height: 900 });
  await login(p2, 'ustoz', '1234');
  const navItems = await p2.locator('#nav button').allInnerTexts();
  steps.push('O’qituvchi menyusi: ' + navItems.map(s => s.trim()).join(', '));
  const blocked = await p2.evaluate(async () => {
    try {
      await window.A.Data.api('PUT', 'api/doc?path=' + encodeURIComponent('expenses/2026-09'), { data: { month: '2026-09', items: {} } });
      return 'YOZDI (XATO!)';
    } catch (e) { return 'server rad etdi: ' + e.message; }
  });
  steps.push('O’qituvchi xarajat yozishi — ' + blocked);
  const seesPayroll = await p2.evaluate(async () => {
    const r = await window.A.Data.api('GET', 'api/doc?path=' + encodeURIComponent('payroll/2026-09')).catch(e => ({ error: e.message }));
    return r.error || JSON.stringify(r);
  });
  steps.push('O’qituvchi ish haqini o’qishi — ' + seesPayroll);
  await c2.close();

  /* 7. Telefon o'lchami */
  const { ctx: c3, page: p3 } = await open({ width: 390, height: 844 });
  await login(p3, 'admin', PASS);
  const ov = await p3.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  steps.push('Telefonda gorizontal chiqish: ' + ov + ' px');
  await c3.close();

  await browser.close();
  console.log('SERVER TEKSHIRUVI:\n' + steps.map(s => ' • ' + s).join('\n'));
  console.log('\nXatolar: ' + (errors.length ? errors.join('; ') : 'yo’q'));
})().catch(e => { console.error(e); process.exit(1); });
