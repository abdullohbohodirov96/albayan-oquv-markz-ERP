/* Telefondagi "Menyu" varag'ining haqiqiy ko'rinishi.
   Sahifa kengligini tekshirish yetarli emas — bu yerda har bir ikonka, qator
   va yopish tugmasining haqiqiy o'lchami brauzerda o'lchanadi.
   4 tilda (arabchada RTL) va 3 ta ekran kengligida.
   Ishga tushirish:  node tests/menu-test.js                                  */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const SHOTS = path.join(__dirname, '..', 'shots');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

const WIDTHS = [360, 390, 430];
const LANGS = [
  { code: 'UZ', name: 'o’zbekcha', dir: 'ltr' },
  { code: 'RU', name: 'ruscha', dir: 'ltr' },
  { code: 'EN', name: 'inglizcha', dir: 'ltr' },
  { code: 'AR', name: 'arabcha', dir: 'rtl' }
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const made = [];

  for (const w of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi (' + w + 'px): ' + e.message); });
    await page.goto(FILE);
    await page.waitForSelector('#login-user', { timeout: 20000 });
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', '1234');
    await page.click('button[type=submit]');
    await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(600);

    for (const lang of LANGS) {
      if (lang.code !== 'UZ') {
        await page.evaluate(c => {
          const b = Array.from(document.querySelectorAll('#lang-pick button'))
            .find(x => x.textContent.trim() === c);
          if (b) b.click();
        }, lang.code);
        await page.waitForTimeout(500);
      }
      section(w + ' px · ' + lang.name);

      // Menyuni ochamiz (pastki panelning oxirgi tugmasi)
      await page.evaluate(() => {
        const btns = document.querySelectorAll('.tabbar button');
        btns[btns.length - 1].click();
      });
      await page.waitForSelector('.menu-sheet', { timeout: 5000 });
      await page.waitForTimeout(350);

      const m = await page.evaluate(() => {
        const sheet = document.querySelector('.menu-sheet');
        const items = Array.from(sheet.querySelectorAll('.menu-item'));
        const box = document.querySelector('.modal');
        const x = document.querySelector('.modal .x-btn');
        const xr = x.getBoundingClientRect();
        const rows = items.map(it => {
          const r = it.getBoundingClientRect();
          const ic = it.querySelector('svg.ico');
          const ir = ic ? ic.getBoundingClientRect() : { width: 0, height: 0 };
          const label = it.querySelector('b');
          const lr = label ? label.getBoundingClientRect() : { top: 0, height: 0, width: 0 };
          return {
            text: (label ? label.textContent : '').trim(),
            h: Math.round(r.height), w: Math.round(r.width),
            icoW: Math.round(ir.width), icoH: Math.round(ir.height),
            labelW: Math.round(lr.width),
            sameRow: Math.abs((ir.top + ir.height / 2) - (lr.top + lr.height / 2)) < 12,
            clipped: label ? label.scrollWidth > label.clientWidth + 1 : false
          };
        });
        const active = items.filter(i => i.getAttribute('aria-current') === 'page');
        const styleOf = el => {
          const s = getComputedStyle(el);
          return { bg: s.backgroundColor, color: s.color, weight: s.fontWeight };
        };
        return {
          count: items.length,
          rows,
          sheetH: Math.round(sheet.getBoundingClientRect().height),
          scrollable: sheet.scrollHeight > sheet.clientHeight + 1,
          fits: sheet.scrollHeight <= sheet.clientHeight + 1,
          modalW: Math.round(box.getBoundingClientRect().width),
          xVisible: xr.top >= 0 && xr.bottom <= window.innerHeight && xr.width >= 24 && xr.height >= 24,
          xTop: Math.round(xr.top),
          activeCount: active.length,
          activeStyle: active[0] ? styleOf(active[0]) : null,
          plainStyle: items[0] ? styleOf(items.find(i => i.getAttribute('aria-current') !== 'page') || items[0]) : null,
          pageScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          dir: document.documentElement.getAttribute('dir')
        };
      });

      ok('Menyuda bo’limlar bor (' + m.count + ')', m.count >= 6, String(m.count));
      const bigIcon = m.rows.filter(r => r.icoW > 26 || r.icoH > 26);
      ok('Ikonkalar 22–24 px atrofida', bigIcon.length === 0,
        bigIcon.slice(0, 3).map(r => r.text + ': ' + r.icoW + '×' + r.icoH + ' px').join(' | '));
      const smallIcon = m.rows.filter(r => r.icoW < 18);
      ok('Ikonkalar juda kichik emas', smallIcon.length === 0,
        smallIcon.slice(0, 3).map(r => r.text + ': ' + r.icoW + ' px').join(' | '));
      const lowRow = m.rows.filter(r => r.h < 48);
      ok('Har bir qator kamida 48 px', lowRow.length === 0,
        lowRow.slice(0, 3).map(r => r.text + ': ' + r.h + ' px').join(' | '));
      const tallRow = m.rows.filter(r => r.h > 72);
      ok('Qatorlar cho’zilib ketmadi', tallRow.length === 0,
        tallRow.slice(0, 3).map(r => r.text + ': ' + r.h + ' px').join(' | '));
      const wrapped = m.rows.filter(r => !r.sameRow);
      ok('Ikonka va matn bitta qatorda', wrapped.length === 0,
        wrapped.slice(0, 3).map(r => r.text).join(' | '));
      const clipped = m.rows.filter(r => r.clipped);
      ok('Matn kesilmadi', clipped.length === 0, clipped.slice(0, 3).map(r => r.text).join(' | '));
      ok('Faol bo’lim belgilangan', m.activeCount === 1, 'topildi: ' + m.activeCount);
      ok('Faol bo’lim ajralib turadi',
        !!m.activeStyle && (m.activeStyle.bg !== m.plainStyle.bg || m.activeStyle.color !== m.plainStyle.color),
        JSON.stringify(m.activeStyle) + ' / ' + JSON.stringify(m.plainStyle));
      ok('Ro’yxat ekranga sig’di yoki aylanadi', m.fits || m.scrollable,
        'balandlik ' + m.sheetH);
      ok('Yopish tugmasi ko’rinib turibdi', m.xVisible, 'top=' + m.xTop);
      ok('Sahifa yon tomonga siljimadi', m.pageScrollX <= 1, String(m.pageScrollX));
      if (lang.dir === 'rtl') ok('Yo’nalish o’ngdan chapga', m.dir === 'rtl', String(m.dir));

      const shot = path.join(SHOTS, 'menyu-' + w + '-' + lang.code.toLowerCase() + '.png');
      await page.screenshot({ path: shot });
      made.push(shot);

      await page.evaluate(() => {
        const x = document.querySelector('.modal .x-btn');
        if (x) x.click();
      });
      await page.waitForTimeout(250);
    }
    // keyingi kenglik uchun tilni o'zbekchaga qaytaramiz
    await ctx.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nScreenshotlar:');
  made.forEach(f => console.log('  ' + f));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
