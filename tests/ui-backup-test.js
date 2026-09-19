/* Zaxira/tiklash oynasi brauzerda ishlashini tekshirish (serversiz rejim).
   Ishga tushirish:  node tests/ui-backup-test.js                            */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });
  await page.goto(FILE);
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', '1234');
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(900);

  await page.evaluate(() => window.A.App.go('settings', { tab: 'data' }));
  await page.waitForTimeout(800);

  ok('Zaxira bo’limi ochildi', await page.locator('#backup-card').count() > 0);
  ok('"Hozir zaxira olish" tugmasi bor',
    await page.locator('#backup-card button:has-text("Hozir zaxira olish")').count() > 0);
  ok('"Zaxiradan tiklash" tugmasi bor',
    await page.locator('#backup-card button:has-text("Zaxiradan tiklash")').count() > 0);

  /* Zaxira yuklab olish */
  const dlp = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('#backup-card button:has-text("Hozir zaxira olish")').click();
  let dumpText = null;
  try {
    const dl = await dlp;
    const p = path.join(require('os').tmpdir(), dl.suggestedFilename());
    await dl.saveAs(p);
    dumpText = require('fs').readFileSync(p, 'utf8');
  } catch (e) { }
  ok('Zaxira fayli yuklandi', !!dumpText);
  let dump = null;
  try { dump = JSON.parse(dumpText); } catch (e) { }
  ok('Fayl JSON', !!dump);
  if (dump) {
    ok('Ichida foydalanuvchilar bor', Object.keys(dump.docs || {}).some(k => k.indexOf('users/') === 0));
    ok('Ichida o’quvchilar bor', Object.keys(dump.docs || {}).some(k => k.indexOf('students/') === 0));
    ok('Sozlamalar bor', !!(dump.docs || {})['meta/settings']);
  }

  /* Tekshirish mantiqi: buzuq zaxira rad etiladi */
  const checks = await page.evaluate((good) => {
    const B = window.A.Backup;
    const okDump = B.validateDump(good);
    const noUsers = JSON.parse(JSON.stringify(good));
    Object.keys(noUsers.docs).forEach(k => { if (k.indexOf('users/') === 0) delete noUsers.docs[k]; });
    const broken = { app: 'albyana-erp', docs: { 'students': { a: 1 } } };
    const alien = { app: 'boshqa-dastur', docs: good.docs };
    return {
      good: okDump.ok,
      noUsers: B.validateDump(noUsers).ok,
      noUsersMsg: B.validateDump(noUsers).errors.join(' '),
      broken: B.validateDump(broken).ok,
      alien: B.validateDump(alien).ok,
      empty: B.validateDump({ docs: {} }).ok,
      rows: B.previewRows(okDump).length
    };
  }, dump);

  ok('To’g’ri zaxira qabul qilindi', checks.good === true);
  ok('Foydalanuvchisiz zaxira rad etildi', checks.noUsers === false, checks.noUsersMsg);
  ok('Noto’g’ri tuzilishdagi fayl rad etildi', checks.broken === false);
  ok('Boshqa dastur fayli rad etildi', checks.alien === false);
  ok('Bo’sh fayl rad etildi', checks.empty === false);
  ok('Ta’sir jadvali qatorlari tuzildi (' + checks.rows + ')', checks.rows > 3);

  /* Tiklash oynasi ochiladi va tasdiqlashsiz ishlamaydi */
  await page.locator('#backup-card button:has-text("Zaxiradan tiklash")').click();
  await page.waitForSelector('.modal', { timeout: 5000 });
  ok('Tiklash oynasi ochildi', await page.locator('.modal h2:has-text("Zaxiradan tiklash")').count() > 0);
  const applyDisabled = await page.locator('.modal .m-foot button.danger').isDisabled();
  ok('Fayl tanlanmaguncha tugma o’chiq', applyDisabled);

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
