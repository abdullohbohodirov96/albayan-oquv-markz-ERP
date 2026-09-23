/* Telefon ko'rinishini tekshirish: 360 / 390 / 430 px.
   Emulyatsiya (Chromium), haqiqiy qurilma emas.
   Ishga tushirish:  node tests/mobile-test.js                              */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, '..', 'shots');
require('fs').mkdirSync(shots, { recursive: true });

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

(async () => {
  const browser = await chromium.launch();

  async function openAs(width, height, login, pw) {
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });
    await page.goto(FILE);
    await page.waitForSelector('#login-user', { timeout: 20000 });
    await page.fill('#login-user', login);
    await page.fill('#login-pass', pw);
    await page.click('button[type=submit]');
    await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(900);
    return { ctx, page };
  }
  const overflow = page => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);

  for (const w of [360, 390, 430]) {
    section(w + 'px ekran');
    const { ctx, page } = await openAs(w, 800, 'admin', '1234');

    ok('Bosh sahifa chetga chiqmadi (' + (await overflow(page)) + 'px)', (await overflow(page)) === 0);

    // Pastki menyu — rolga mos, 5 ta element
    const tabs = await page.locator('#tabbar button').allInnerTexts();
    ok('Pastki menyuda 5 ta element', tabs.length === 5, tabs.join(' | '));
    ok('Oxirgisi "Menyu"', /Menyu/.test(tabs[tabs.length - 1]));
    const tabBox = await page.locator('#tabbar button').first().boundingBox();
    ok('Pastki menyu tugmasi ≥ 44px', tabBox.height >= 44, Math.round(tabBox.height) + 'px');

    // Jadval: kun tasmasi ko'rinishi va 7 kun
    await page.evaluate(() => window.A.App.go('schedule'));
    await page.waitForTimeout(900);
    const stripVisible = await page.locator('.day-strip').isVisible();
    ok('Kun tanlash tasmasi ko’rinadi', stripVisible);
    const days = await page.locator('.day-strip button').count();
    ok('Haftaning 7 kuni bor', days === 7, days + ' ta');
    const dayBox = await page.locator('.day-strip button').first().boundingBox();
    ok('Kun tugmasi ≥ 44×44px', dayBox.width >= 44 && dayBox.height >= 44,
      Math.round(dayBox.width) + '×' + Math.round(dayBox.height));
    // 7-kunni tanlash
    await page.locator('.day-strip button').nth(6).click();
    await page.waitForTimeout(700);
    const pressed = await page.locator('.day-strip button[aria-pressed="true"]').count();
    ok('Tanlangan kun belgilandi', pressed === 1);
    const dayTitle = await page.locator('.card .card-head h2, .card-head h2').first().textContent().catch(() => '');
    ok('Tanlangan kun sarlavhasi ko’rinadi', !!dayTitle, dayTitle);
    ok('Jadval sahifasi chetga chiqmadi', (await overflow(page)) === 0);
    const weekVisible = await page.locator('.week-wrap').isVisible().catch(() => false);
    ok('Haftalik katak telefonda yashirilgan', !weekVisible);

    // Shakl: maydonlar va saqlash tugmasi
    await page.evaluate(() => window.A.App.go('students'));
    await page.waitForTimeout(600);
    await page.click('.page-actions button:has-text("O’quvchi qo’shish")');
    await page.waitForSelector('.modal');
    await page.waitForTimeout(400);
    ok('Shakl chetga chiqmadi', (await overflow(page)) === 0);
    const saveBtn = await page.locator('.modal .m-foot button').last().boundingBox();
    ok('Saqlash tugmasi ko’rinadi va ≥ 44px',
      saveBtn && saveBtn.height >= 44 && saveBtn.y + saveBtn.height <= 800,
      JSON.stringify(saveBtn));
    // modal ichida aylantirish
    const scrollable = await page.evaluate(() => {
      const b = document.querySelector('.modal .m-body');
      return b ? b.scrollHeight > b.clientHeight || getComputedStyle(b).overflowY === 'auto' : false;
    });
    ok('Modal ichi aylantiriladi', scrollable);
    await page.screenshot({ path: path.join(shots, 'mob-' + w + '-form.png') });
    // saqlanmagan ma'lumot ogohlantirishi
    await page.locator('.modal input').first().fill('Test');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const warn = await page.locator('.modal').count();
    ok('Saqlanmagan ma’lumotda ogohlantirdi', warn >= 1);
    await page.locator('.modal .m-foot button').last().click();  // "Ha, yopilsin"
    await page.waitForTimeout(400);

    // Jadvallar telefonda karta ko'rinishida
    await page.evaluate(() => window.A.App.go('students'));
    await page.waitForTimeout(700);
    const asCards = await page.evaluate(() => {
      const td = document.querySelector('table.tbl tbody td');
      return td ? getComputedStyle(td).display === 'flex' : false;
    });
    ok('Ro’yxat kartaga aylandi', asCards);
    await ctx.close();
  }

  /* ---------- Orqaga tugmasi va yangilashda holat ---------- */
  section('Orqaga tugmasi va sahifa yangilanishi');
  {
    const { ctx, page } = await openAs(390, 800, 'admin', '1234');
    await page.evaluate(() => window.A.App.go('students'));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.A.App.go('groups'));
    await page.waitForTimeout(500);
    ok('Manzilda joriy sahifa ko’rinadi', (await page.evaluate(() => location.hash)).indexOf('groups') >= 0);
    await page.goBack();
    await page.waitForTimeout(700);
    const backTo = await page.evaluate(() => window.A.App.route.name);
    ok('Orqaga tugmasi oldingi sahifaga qaytardi', backTo === 'students', backTo);

    await page.reload();
    await page.waitForSelector('#login-user, #app:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(500);
    if (await page.locator('#login-user').count()) {
      await page.fill('#login-user', 'admin');
      await page.fill('#login-pass', '1234');
      await page.click('button[type=submit]');
      await page.waitForSelector('#app:not([hidden])');
      await page.waitForTimeout(900);
    }
    const afterReload = await page.evaluate(() => window.A.App.route.name);
    ok('Yangilangandan keyin o’sha sahifa ochildi', afterReload === 'students', afterReload);
    await ctx.close();
  }

  /* ---------- Telefonda joyni tejash va barmoqqa mos o'lchamlar ---------- */
  section('Telefonda tepa panel va menyu');
  {
    const { ctx, page } = await openAs(390, 800, 'admin', '1234');
    const topRow = await page.evaluate(() => ({
      lang: getComputedStyle(document.getElementById('lang-pick')).display,
      theme: getComputedStyle(document.getElementById('theme-toggle')).display,
      barH: Math.round(document.querySelector('.topbar').getBoundingClientRect().height)
    }));
    ok('Til tanlash tepadan olib tashlandi', topRow.lang === 'none', topRow.lang);
    ok('Mavzu tugmasi ham tepada emas', topRow.theme === 'none', topRow.theme);
    ok('Tepa panel bir qator (≤ 80px)', topRow.barH <= 80, topRow.barH + 'px');

    /* Menyu varag'ida til va mavzu turibdi */
    await page.evaluate(() => { const b = document.querySelectorAll('.tabbar button'); b[b.length - 1].click(); });
    await page.waitForSelector('.menu-sheet', { timeout: 6000 });
    await page.waitForTimeout(350);
    const menu = await page.evaluate(() => ({
      langs: Array.from(document.querySelectorAll('.menu-lang .btn')).map(b => b.textContent.trim()),
      items: document.querySelectorAll('.menu-sheet .menu-item').length,
      minH: Math.min.apply(null, Array.from(document.querySelectorAll('.menu-lang .btn'))
        .map(b => Math.round(b.getBoundingClientRect().height)))
    }));
    ok('Menyuda to’rt til bor', menu.langs.slice(0, 4).join(',') === 'UZ,RU,EN,AR', menu.langs.join(','));
    ok('Mavzu tugmasi ham shu yerda', menu.langs.length === 5, String(menu.langs.length));
    ok('Til tugmalari ≥ 40px', menu.minH >= 40, menu.minH + 'px');
    ok('Bo’limlar ro’yxati ham joyida', menu.items >= 8, String(menu.items));
    /* Mavzuni almashtirish */
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
    await page.evaluate(() => document.querySelectorAll('.menu-lang .btn')[4].click());
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
    ok('Mavzu almashdi', after && after !== before, before + ' → ' + after);
    await page.evaluate(() => { const b = document.querySelector('.m-head button'); b && b.click(); });
    await page.waitForTimeout(300);

    section('   Barmoqqa mos o’lchamlar va yon siljish');
    const ROUTES = ['dashboard', 'leads', 'students', 'groups', 'schedule', 'attendance',
      'finance', 'staff', 'reports', 'settings', 'chat', 'tasks'];
    const bad = [];
    const tiny = [];
    for (const r of ROUTES) {
      await page.evaluate(n => window.A.App.go(n), r);
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const small = [];
        /* Suriladigan tasmadagi tugmalar hisobga olinmaydi — ular
           ataylab ekrandan tashqariga chiqadi. */
        document.querySelectorAll('.seg button,.page-actions .btn,.tabs button').forEach(el => {
          const b = el.getBoundingClientRect();
          if (b.width > 0 && b.height < 38) small.push(el.textContent.trim().slice(0, 18) + ' ' + Math.round(b.height));
        });
        return { ovf: document.documentElement.scrollWidth - vw, small: small.slice(0, 3) };
      });
      if (m.ovf > 1) bad.push(r + ': ' + m.ovf + 'px');
      if (m.small.length) tiny.push(r + ': ' + m.small.join(', '));
    }
    ok('Hech bir bo’limda yon siljish yo’q', bad.length === 0, bad.join(' | '));
    ok('Filtr va amal tugmalari ≥ 38px', tiny.length === 0, tiny.join(' | '));

    section('   Sahifa boshidagi tugmalar joy yemaydi');
    await page.evaluate(() => window.A.App.go('leads'));
    await page.waitForTimeout(700);
    const acts = await page.evaluate(() => {
      const bs = Array.from(document.querySelectorAll('.page-actions .btn'));
      return bs.map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 14), y: Math.round(r.top), w: Math.round(r.width) }; });
    });
    const rows = new Set(acts.map(a => a.y)).size;
    ok('Uchta tugma ikki qatorga joylashdi (' + acts.length + ' ta, ' + rows + ' qator)',
      acts.length < 3 || rows <= 2, JSON.stringify(acts));
    await ctx.close();
  }

  /* ---------- O'qituvchi pastki menyusi ---------- */
  section('O’qituvchi pastki menyusi');
  {
    const { ctx, page } = await openAs(390, 800, 'ustoz', '1234');
    const tabs = await page.locator('#tabbar button').allInnerTexts();
    ok('O’qituvchida ham 5 ta element', tabs.length === 5, tabs.join(' | '));
    ok('Darslar va davomat bor', /Darslarim|Jadval/.test(tabs.join(' ')) && /Davomat/.test(tabs.join(' ')), tabs.join(' | '));
    ok('Moliya yo’q', !/Moliya/.test(tabs.join(' ')));
    await ctx.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') +
    ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: bu Chromium emulyatsiyasi, haqiqiy iPhone/Android emas.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
