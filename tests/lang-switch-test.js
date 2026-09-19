/* Til almashtirish sinovi.
   Tekshiradi:
   1) Arabchaga o'tganda o'zbekcha so'z qolmasligi;
   2) O'zbekchaga qaytganda arabcha/ruscha matn qolmasligi;
   3) Aralash ("yarim tarjima") matn chiqmasligi;
   4) Bir necha marta u yoqdan-bu yoqqa almashtirsa ham buzilmasligi.
   Ishga tushirish:  node tests/lang-switch-test.js                         */
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
function section(t) { out.push('\n' + t); }

/* Ma'lumot (ism, kurs nomi, xona, izoh) tarjima qilinmaydi — uni hisobga olmaymiz.
   Ro'yxat ilovaning o'z ma'lumotidan olinadi, qo'lda yozilmaydi. */
let DATA_WORDS = new Set();
const ALLOW = new Set(['uz', 'ru', 'en', 'ar', 'albayan', 'cairo', 'alb', 'tel', 'start',
  'instagram', 'telegram', 'safari', 'chrome', 'android', 'iphone', 'xlsx', 'xls', 'csv',
  'tsv', 'excel', 'readme', 'ismim', 'english', 'ozbekcha', 'pdf']);

function words(text) {
  return (text.match(/[A-Za-z’']{3,}/g) || []).map(w => w.replace(/[’']/g, '').toLowerCase());
}
function latinWords(text) {
  return [...new Set((text.match(/[A-Za-z’']{3,}/g) || [])
    .map(w => w.replace(/[’']/g, ''))
    .filter(w => w && !ALLOW.has(w.toLowerCase()) && !DATA_WORDS.has(w.toLowerCase())))];
}
function arabicWords(text) {
  return [...new Set(text.match(/[؀-ۿ]{2,}/g) || [])];
}
function cyrillicWords(text) {
  return [...new Set(text.match(/[А-Яа-яЁё]{3,}/g) || [])];
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });
  await page.goto(FILE);
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', '1234');
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(900);

  const pick = async (code) => {
    // oyna ochiq bo'lsa tugmaga bosib bo'lmaydi — ilovaning o'z yo'li bilan
    await page.evaluate(c => {
      const b = Array.from(document.querySelectorAll('#lang-pick button'))
        .find(x => x.textContent.trim() === c);
      if (b) b.click();
    }, code);
    await page.waitForTimeout(700);
  };
  // ilovadagi ma'lumot so'zlarini yig'amiz (ismlar, kurs/guruh/xona nomlari, izohlar)
  const dataStrings = await page.evaluate(() => {
    const D = window.A.Data, out = [];
    const push = v => { if (typeof v === 'string') out.push(v); };
    ['students', 'staff', 'courses', 'rooms', 'groups', 'users', 'leads', 'expenses', 'funnels']
      .forEach(c => Object.values(D.col[c] || {}).forEach(r => {
        ['firstName', 'lastName', 'name', 'parentName', 'title', 'description', 'note', 'category', 'source', 'login', 'code']
          .forEach(k => push(r[k]));
      }));
    (D.settings && D.settings.expenseCategories || []).forEach(push);
    push(D.settings && D.settings.centerName);
    return out;
  });
  dataStrings.forEach(s => words(s).forEach(w => DATA_WORDS.add(w)));

  const body = () => page.evaluate(() => document.body.innerText);
  const placeholders = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('[placeholder]')).map(e => e.getAttribute('placeholder')).join(' | '));

  /* ---------- 1. O'zbekcha boshlanishi ---------- */
  section('1. Boshlanishda hammasi o’zbekcha');
  const uz0 = await body();
  ok('Arabcha matn yo’q', arabicWords(uz0).length === 0, arabicWords(uz0).slice(0, 5).join(', '));
  ok('Ruscha matn yo’q', cyrillicWords(uz0).length === 0, cyrillicWords(uz0).slice(0, 5).join(', '));

  /* ---------- 2. Arabchaga o'tish ---------- */
  section('2. Arabchaga o’tganda o’zbekcha qolmaydi');
  await pick('AR');
  const ar = await body();
  const leftUz = latinWords(ar);
  ok('O’zbekcha so’zlar qolmadi (' + leftUz.length + ')', leftUz.length === 0, leftUz.slice(0, 12).join(', '));
  ok('Arabcha matn paydo bo’ldi', arabicWords(ar).length > 20, String(arabicWords(ar).length));
  const arPh = await placeholders();
  ok('Maydon yozuvlari (placeholder) ham arabcha', latinWords(arPh).length === 0, arPh);
  const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  ok('Yozuv yo’nalishi o’ngdan chapga', dir === 'rtl', dir);

  /* ---------- 3. Qaytib o'zbekchaga ---------- */
  section('3. O’zbekchaga qaytganda arabcha qolmaydi');
  await pick('UZ');
  const uz1 = await body();
  const leftAr = arabicWords(uz1);
  ok('Arabcha matn qolmadi (' + leftAr.length + ')', leftAr.length === 0, leftAr.slice(0, 10).join(', '));
  const uzPh = await placeholders();
  ok('Maydon yozuvlari o’zbekcha', arabicWords(uzPh).length === 0, uzPh);
  ok('Yo’nalish chapdan o’ngga', (await page.evaluate(() => document.documentElement.getAttribute('dir'))) === 'ltr');

  /* ---------- 4. Rus va ingliz ---------- */
  section('4. Rus va ingliz tillari');
  await pick('RU');
  const ru = await body();
  ok('Ruscha matn paydo bo’ldi', cyrillicWords(ru).length > 20, String(cyrillicWords(ru).length));
  ok('O’zbekcha so’z qolmadi', latinWords(ru).length === 0, latinWords(ru).slice(0, 12).join(', '));
  ok('Arabcha aralashmadi', arabicWords(ru).length === 0, arabicWords(ru).slice(0, 6).join(', '));

  await pick('EN');
  const en = await body();
  ok('Ruscha qolmadi', cyrillicWords(en).length === 0, cyrillicWords(en).slice(0, 8).join(', '));
  ok('Arabcha qolmadi', arabicWords(en).length === 0, arabicWords(en).slice(0, 6).join(', '));

  /* ---------- 5. Ko'p marta almashtirish ---------- */
  section('5. Ketma-ket almashtirishda buzilmaydi');
  for (const code of ['AR', 'UZ', 'RU', 'AR', 'EN', 'UZ']) await pick(code);
  const uz2 = await body();
  ok('Oxirida arabcha yo’q', arabicWords(uz2).length === 0, arabicWords(uz2).slice(0, 8).join(', '));
  ok('Oxirida ruscha yo’q', cyrillicWords(uz2).length === 0, cyrillicWords(uz2).slice(0, 8).join(', '));
  ok('Matn birinchi holatdagidek', uz2.replace(/\s+/g, ' ').slice(0, 400) === uz0.replace(/\s+/g, ' ').slice(0, 400),
    uz2.replace(/\s+/g, ' ').slice(0, 120));

  /* ---------- 6. Boshqa sahifalarda ham ---------- */
  section('6. Boshqa sahifalarda ham toza');
  for (const route of ['students', 'groups', 'finance', 'settings', 'bot']) {
    await page.evaluate(r => window.A.App.go(r), route);
    await page.waitForTimeout(350);
    await pick('AR');
    const t = await body();
    const l = latinWords(t);
    ok(route + ': o’zbekcha qolmadi (' + l.length + ')', l.length === 0, l.slice(0, 8).join(', '));
    await pick('UZ');
    const t2 = await body();
    // sozlamalarda til tanlash tugmalari o'z tilida turadi (العربية) — bu to'g'ri
    const arLeft = arabicWords(t2).filter(w => w !== 'العربية');
    ok(route + ': arabcha qolmadi', arLeft.length === 0, arLeft.slice(0, 6).join(', '));
  }

  /* ---------- 7. Oyna ichida ham ---------- */
  section('7. Ochilgan oynada ham tarjima ishlaydi');
  await page.evaluate(() => window.A.App.go('students'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.A.studentForm(null, window.A.App));
  await page.waitForSelector('.modal');
  await pick('AR');
  const modalAr = await page.locator('.modal').innerText();
  ok('Oyna arabcha', latinWords(modalAr).length === 0, latinWords(modalAr).slice(0, 8).join(', '));
  await pick('UZ');
  const modalUz = await page.locator('.modal').innerText();
  ok('Oyna qayta o’zbekcha', arabicWords(modalUz).length === 0, arabicWords(modalUz).slice(0, 6).join(', '));

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
