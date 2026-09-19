/* Tarjima qamrovini tekshirish: barcha sahifa va oynalarni aylanib,
   tarjimasiz qolgan interfeys matnlarini yig'adi.
   Ishga tushirish:  node tests/i18n-audit.js [til]                        */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const LANG = (process.argv[2] || 'ar').toUpperCase();
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.waitForSelector('#login-user', { timeout: 20000 });

  // Tilni kirish ekranidayoq almashtiramiz
  await page.evaluate(l => window.A.I18N.set(l), LANG.toLowerCase());
  await page.waitForTimeout(400);
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', '1234');
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(900);

  async function go(route, params) {
    await page.evaluate(([r, p]) => window.A.App.go(r, p || {}), [route, params || {}]);
    await page.waitForTimeout(450);
  }
  async function openModal(fn) {
    try {
      await page.evaluate(fn);
      await page.waitForTimeout(450);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } catch (e) { /* jim */ }
  }

  /* --- Barcha sahifalar --- */
  const routes = [
    ['dashboard'], ['leads'], ['leads', { stage: 'yangi' }],
    ['students'], ['students', { status: 'arxiv' }],
    ['groups'], ['groups', { status: 'rejalashtirilgan' }], ['courses'],
    ['schedule'], ['attendance'],
    ['finance', { tab: 'payments' }], ['finance', { tab: 'debts' }],
    ['finance', { tab: 'invoices' }], ['finance', { tab: 'expenses' }],
    ['finance', { tab: 'payroll' }],
    ['staff'], ['reports'], ['reports', { period: 'today' }],
    ['chat'], ['tasks'], ['tasks', { scope: 'all' }],
    ['bot', { tab: 'holat' }], ['bot', { tab: 'xabar' }],
    ['bot', { tab: 'oquvchilar' }], ['bot', { tab: 'sozlama' }],
    ['settings', { tab: 'general' }], ['settings', { tab: 'funnels' }], ['settings', { tab: 'users' }],
    ['settings', { tab: 'cats' }], ['settings', { tab: 'data' }], ['settings', { tab: 'log' }]
  ];
  for (const r of routes) await go(r[0], r[1]);

  // O'quvchi kartasi — barcha yorliqlar
  const sid = await page.evaluate(() => Object.keys(window.A.Data.col.students)[0]);
  for (const tab of ['umumiy', 'guruhlar', 'davomat', 'hisoblar', 'tolovlar']) {
    await go('student', { id: sid, tab });
  }
  // Guruh kartasi
  const gid = await page.evaluate(() => Object.keys(window.A.Data.col.groups)[0]);
  for (const tab of ['oquvchilar', 'jadval', 'davomat']) {
    await go('group', { id: gid, tab });
  }

  /* --- Oynalar --- */
  await go('students');
  await openModal(() => window.A.studentForm(null, window.A.App));
  await openModal(() => window.A.importModal('students', window.A.App));
  await go('leads');
  await openModal(() => window.A.leadForm(null, window.A.App));
  await go('groups');
  await openModal(() => window.A.groupForm(null, window.A.App));
  await go('finance', { tab: 'payments' });
  await openModal(() => window.A.paymentForm(null, window.A.App));
  await openModal(() => {
    const p = window.A.Fin.allPayments()[0];
    if (p) window.A.receiptModal(p, window.A.App);
  });
  await go('tasks');
  await openModal(() => window.A.taskForm(null, window.A.App));
  await go('settings', { tab: 'users' });
  await openModal(() => window.A.userForm(null, window.A.App));
  await go('settings', { tab: 'funnels' });
  await openModal(() => { const b=[...document.querySelectorAll('.card-head button')].find(x=>x.textContent.includes('Voronka')); if(b) b.click(); });
  await openModal(() => { const b=[...document.querySelectorAll('table.tbl button')].find(x=>x.textContent.includes('Ko')); if(b) b.click(); });
  await openModal(() => {
    const s = window.A.Data.all('students')[0];
    if (s) window.A.membershipForm(s, null, window.A.App);
  });
  // Tasdiqlash oynasi va sabab so'rash (va'dani qaytarmaymiz — evaluate kutib qolmasin)
  await openModal(() => { window.A.UI.confirm('Sinov', 'Sinov matni'); });
  await openModal(() => { window.A.UI.askReason('Sinov', 'Sababi'); });
  await openModal(() => { window.A.UI.toast('Saqlandi.', 'ok'); });

  const misses = await page.evaluate(() => window.A.I18N.misses);
  await browser.close();

  const list = Object.keys(misses).sort((a, b) => misses[b] - misses[a]);
  console.log('TIL: ' + LANG);
  console.log('Tarjimasiz qolgan matnlar: ' + list.length + ' ta\n');
  list.forEach(s => console.log(String(misses[s]).padStart(3) + '  ' + JSON.stringify(s)));
  if (errors.length) console.log('\nXatolar: ' + errors.join('; '));
  require('fs').writeFileSync(path.join(__dirname, '..', 'i18n-misses.json'),
    JSON.stringify(list, null, 1));
})();
