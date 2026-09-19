/* Brauzerda asosiy jarayonlarni tekshirish (Playwright) */
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, '..', 'shots');
require('fs').mkdirSync(shots, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const steps = [];

  async function newPage(viewport, name) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push('[' + name + '] ' + m.text()); });
    page.on('pageerror', e => errors.push('[' + name + '] PAGEERROR ' + e.message));
    await page.goto(FILE);
    return { ctx, page };
  }

  async function login(page) {
    await page.waitForSelector('#login-user', { timeout: 15000 });
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', '1234');
    await page.click('button[type=submit]');
    await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
    await page.waitForTimeout(600);
  }

  /* ---------- Kompyuter ---------- */
  {
    const { ctx, page } = await newPage({ width: 1320, height: 900 }, 'desktop');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(shots, '01-login.png') });
    await login(page);
    await page.screenshot({ path: path.join(shots, '02-dashboard.png'), fullPage: true });
    steps.push('Kirish + bosh sahifa OK');

    for (const [nav, file] of [['O’quvchilar', '03-students'], ['Guruhlar', '04-groups'],
    ['Jadval', '05-schedule'], ['Davomat', '06-attendance'], ['Moliya', '07-finance'],
    ['Hisobotlar', '08-reports'], ['Murojaatlar', '09-leads'], ['Xodimlar', '10-staff'],
    ['Sozlamalar', '11-settings']]) {
      await page.click(`#nav button:has-text("${nav}")`);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(shots, file + '.png'), fullPage: true });
      steps.push(nav + ' sahifasi ochildi');
    }

    // To'lov qabul qilish oqimi
    await page.click('#nav button:has-text("Moliya")');
    await page.waitForTimeout(400);
    await page.click('.page-actions button:has-text("To’lov qabul qilish")');
    await page.waitForSelector('.modal', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shots, '12-payment-modal.png') });
    const amount = page.locator('.modal input[type=number]').first();
    await amount.fill('300000');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shots, '13-payment-alloc.png') });
    await page.click('.modal .m-foot button:has-text("Qabul qilish")');
    await page.waitForTimeout(1200);
    const receipt = await page.locator('.receipt').count();
    steps.push('To’lov qabul qilindi, chek chiqdi: ' + (receipt > 0));
    await page.screenshot({ path: path.join(shots, '14-receipt.png') });
    await page.click('.modal .m-foot button:has-text("Yopish")');
    await page.waitForTimeout(400);

    // O'quvchi qo'shish oqimi
    await page.click('#nav button:has-text("O’quvchilar")');
    await page.waitForTimeout(400);
    await page.click('.page-actions button:has-text("O’quvchi qo’shish")');
    await page.waitForSelector('.modal');
    await page.fill('.modal input#' + (await page.locator('.modal .field').first().locator('input').getAttribute('id')), 'Testov');
    const inputs = page.locator('.modal input');
    await inputs.nth(1).fill('Test');
    await inputs.nth(4).fill('901234567');
    await page.screenshot({ path: path.join(shots, '15-student-form.png') });
    await page.click('.modal .m-foot button:has-text("Saqlash")');
    await page.waitForTimeout(1400);
    const url = await page.locator('.page-head h1').first().textContent();
    steps.push('Yangi o’quvchi saqlandi → ' + url);
    await page.screenshot({ path: path.join(shots, '16-student-card.png'), fullPage: true });
    await ctx.close();
  }

  /* ---------- Telefon ---------- */
  {
    const { ctx, page } = await newPage({ width: 390, height: 844 }, 'mobile');
    await page.waitForTimeout(1200);
    await login(page);
    await page.screenshot({ path: path.join(shots, 'm01-dashboard.png'), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    steps.push('Telefonda gorizontal chiqish (px): ' + overflow);

    await page.click('#tabbar button:has-text("Menyu")');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shots, 'm02-menu.png') });
    await page.click('.modal .list-item:has-text("O’quvchilar")');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(shots, 'm03-students.png'), fullPage: true });
    const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    steps.push('O’quvchilar ro’yxatida chiqish (px): ' + ov2);

    await page.click('#tabbar button:has-text("Menyu")');
    await page.waitForTimeout(300);
    await page.click('.modal .list-item:has-text("Moliya")');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(shots, 'm04-finance.png'), fullPage: true });

    await page.click('.page-actions button:has-text("To’lov qabul qilish")');
    await page.waitForSelector('.modal');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(shots, 'm05-payment.png') });
    const btnBox = await page.locator('.modal .m-foot button').last().boundingBox();
    steps.push('Telefonda saqlash tugmasi balandligi: ' + (btnBox && Math.round(btnBox.height)) + 'px, ko’rinadi: ' +
      (btnBox && btnBox.y + btnBox.height <= 844));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.click('#tabbar button:has-text("Menyu")');
    await page.waitForTimeout(300);
    await page.click('.modal .list-item:has-text("Davomat")');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(shots, 'm06-attendance.png'), fullPage: true });
    const attBtn = await page.locator('.att-opts button').first().boundingBox();
    steps.push('Davomat tugmasi o’lchami: ' + (attBtn && Math.round(attBtn.width)) + '×' + (attBtn && Math.round(attBtn.height)));
    const ov3 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    steps.push('Davomat sahifasida chiqish (px): ' + ov3);

    await page.click('#tabbar button:has-text("Menyu")');
    await page.waitForTimeout(300);
    await page.click('.modal .list-item:has-text("Jadval")');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(shots, 'm07-schedule.png'), fullPage: true });
    const ov4 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    steps.push('Jadval sahifasida chiqish (px): ' + ov4);
    await ctx.close();
  }

  /* ---------- 360px ---------- */
  {
    const { ctx, page } = await newPage({ width: 360, height: 780 }, '360');
    await page.waitForTimeout(1200);
    await login(page);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    steps.push('360px da chiqish (px): ' + ov);
    await page.screenshot({ path: path.join(shots, 's01-360.png'), fullPage: true });
    await ctx.close();
  }

  await browser.close();
  console.log('QADAMLAR:\n' + steps.map(s => ' • ' + s).join('\n'));
  console.log('\nKONSOL XATOLARI: ' + (errors.length ? '\n' + errors.map(e => ' ! ' + e).join('\n') : 'yo’q'));
})();
