/* Suhbat: brauzer tomoni (ilova haqiqiy server bilan).
   Tekshiradi: ilova xabarni yangi amal orqali yuboradimi, butun ro'yxatni
   qayta yozmaydimi, sahifa yangilanganda xabar turibdimi.
   Serverni alohida bazada ishga tushiring, keyin:
     node tests/chat-ui-test.js [port] [direktor paroli]                      */
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT + '/';

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });

  // qaysi so'rovlar ketganini kuzatamiz
  const calls = [];
  page.on('request', r => {
    const u = r.url();
    if (u.indexOf('/api/') >= 0) calls.push(r.method() + ' ' + u.replace(BASE, ''));
  });

  await page.goto(BASE);
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(800);

  section('1. Xabar yuborish');
  await page.evaluate(() => window.A.App.go('chat'));
  await page.waitForSelector('#chat-input', { timeout: 10000 });
  const text = 'Brauzerdan yozildi ' + Date.now().toString(36);
  calls.length = 0;
  await page.fill('#chat-input', text);
  await page.click('.chat-form button[type=submit]');
  await page.waitForTimeout(1200);

  const shown = await page.evaluate(t => document.body.innerText.indexOf(t) >= 0, text);
  ok('Xabar ekranda ko’rindi', shown, text);
  ok('Yangi amal ishlatildi (chat/send)', calls.some(c => /POST .*api\/chat\/send/.test(c)), calls.join(' | '));
  ok('Butun suhbat PUT bilan qayta yozilmadi',
    !calls.some(c => /PUT .*api\/doc\?path=chats/.test(c)), calls.join(' | '));

  section('2. Sahifa yangilangandan keyin');
  await page.reload();
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.evaluate(() => window.A.App.go('chat'));
  await page.waitForTimeout(1200);
  const afterReload = await page.evaluate(t => document.body.innerText.indexOf(t) >= 0, text);
  ok('Xabar joyida turibdi', afterReload, text);

  section('3. Ikkinchi xabar ham ketadi');
  const text2 = 'Ikkinchi ' + Date.now().toString(36);
  await page.fill('#chat-input', text2);
  await page.click('.chat-form button[type=submit]');
  await page.waitForTimeout(1000);
  const both = await page.evaluate(o => {
    const t = document.body.innerText;
    return t.indexOf(o.a) >= 0 && t.indexOf(o.b) >= 0;
  }, { a: text, b: text2 });
  ok('Ikkala xabar ham ko’rinib turibdi', both);

  const serverSide = await page.evaluate(async () => {
    // ilova qaysi suhbatni ochgan bo'lsa — o'shani bazadan o'qiymiz
    const head = document.querySelector('.chat-main .card-head h2');
    const all = window.A.Data.all('chats');
    const active = all.filter(c => (c.messages || []).length).sort((a, b) =>
      String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || { id: 'chat_umumiy' };
    const r = await fetch('api/doc?path=' + encodeURIComponent('chats/' + active.id),
      { credentials: 'same-origin' });
    const j = await r.json();
    return (j.data && j.data.messages || []).map(m => ({ from: m.from, text: m.text, at: m.at }));
  });
  ok('Bazada ham ikkala xabar bor',
    serverSide.filter(m => m.text === text || m.text === text2).length === 2,
    JSON.stringify(serverSide.slice(-3)));
  ok('Muallif — kirgan foydalanuvchi',
    serverSide.every(m => !!m.from), JSON.stringify(serverSide.slice(-2)));

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
