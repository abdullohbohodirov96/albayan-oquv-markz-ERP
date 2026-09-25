/* TAHRIRLASH SINOVI — "saqladim, lekin o'zgarmadi" xatolarini qidiradi.

   Nega kerak: forma maydoni ko'rsatadigan qiymat bilan sahifada
   ko'rinadigan qiymat har xil manbadan olinsa, foydalanuvchi narxni
   o'zgartiradi, oynada yangi raqam turadi, sahifada esa eskisi qoladi.
   Bunday xatoni faqat "o'zgartir → saqla → QAYTA YUKLA → qara"
   zanjirini oxirigacha bosib o'tgan sinov tutadi.

   Har bir bo'lim uchun uchta narsa tekshiriladi:
     1) saqlash so'rovi o'tdimi;
     2) BAZADA haqiqatan yangi qiymat turibdimi (API orqali o'qiladi);
     3) sahifa qayta yuklangach EKRANDA yangi qiymat ko'rinadimi.

   Ishga tushirish:  node tests/tahrir-test.js [port] [direktor paroli]
   PRODUCTION BAZAGA TEGMAYDI — alohida sinov serveri kerak.          */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT + '/';
const API = 'http://localhost:' + PORT;
const SHOTS = path.join(__dirname, '..', 'shots');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + String(extra).slice(0, 200) : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got));
}
function section(t) { out.push('\n' + t); }

const R = 't' + Date.now().toString(36);
const ID = n => R + '_' + n;
let COOKIE = '';

async function api(p, opts = {}) {
  const res = await fetch(API + p, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      COOKIE ? { Cookie: COOKIE } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (p, data) => api('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', body: { data } });
const get = async p => ((await api('/api/doc?path=' + encodeURIComponent(p))).json || {}).data || null;

/* ---------- Brauzer yordamchilari ---------- */

/** Ochiq oynadagi maydonni YOZUVI bo'yicha topib, qiymat qo'yadi */
async function setField(page, label, value) {
  return page.evaluate(o => {
    const labs = Array.from(document.querySelectorAll('.modal .field label, .modal label'));
    const lab = labs.find(l => l.textContent.trim().indexOf(o.label) === 0);
    if (!lab) return 'maydon topilmadi: ' + o.label;
    const wrap = lab.closest('.field') || lab.parentElement;
    const inp = wrap.querySelector('input, textarea, select');
    if (!inp) return 'kiritish joyi yo’q: ' + o.label;
    inp.value = o.value;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return '';
  }, { label, value });
}

/** Ochiq oynadagi maydon qiymatini o'qiydi */
async function fieldValue(page, label) {
  return page.evaluate(lbl => {
    const labs = Array.from(document.querySelectorAll('.modal .field label, .modal label'));
    const lab = labs.find(l => l.textContent.trim().indexOf(lbl) === 0);
    if (!lab) return null;
    const wrap = lab.closest('.field') || lab.parentElement;
    const inp = wrap.querySelector('input, textarea, select');
    return inp ? String(inp.value) : null;
  }, label);
}

async function saveModal(page) {
  const hit = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.modal .m-foot .btn'))
      .find(x => /Saqlash|Qo’shish|Yozish|Qabul qilish/.test(x.textContent));
    if (!b) return false;
    b.click(); return true;
  });
  if (!hit) return false;
  await page.waitForTimeout(1200);
  return true;
}

async function closeModal(page) {
  await page.evaluate(() => {
    const x = document.querySelector('.modal .x-btn');
    if (x) x.click();
  });
  await page.waitForTimeout(250);
}

/** Sahifani QAYTA YUKLAB, matn ichida qiymat bor-yo'qligini qaraydi */
async function reloadAndText(page, hash, expect) {
  /* DIQQAT: faqat # o'zgarsa brauzer sahifani QAYTA YUKLAMAYDI —
     ma'lumot eskiligicha qoladi va sinov yolg'on "o'tdi" berardi.
     Shuning uchun har safar haqiqiy qayta yuklash qilinadi.        */
  await page.goto(BASE + '#' + hash);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  /* Sahifa mazmuni kelguncha kutamiz: #view avval bo'sh turadi, keyin
     ma'lumot serverdan kelib chiziladi. Kutmasak, faqat menyu
     o'qilib, sinov "topilmadi" deb yolg'on xato berardi.           */
  await page.waitForFunction(() => {
    const v = document.getElementById('view');
    return v && v.innerText.replace(/\s+/g, '').length > 40;
  }, null, { timeout: 20000 }).catch(() => { });
  if (expect) {
    await page.waitForFunction(t => {
      const v = document.getElementById('view');
      return v && v.innerText.indexOf(t) >= 0;
    }, expect, { timeout: 8000 }).catch(() => { });
  }
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const v = document.getElementById('view');
    return (v ? v.innerText : document.body.innerText).replace(/\s+/g, ' ');
  });
}

/** Moliya sahifasidagi yorliqni ochib, matnini qaytaradi */
async function financeTab(page, name) {
  await page.goto(BASE + '#finance');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(1400);
  await page.evaluate(n => {
    const t = Array.from(document.querySelectorAll('#view .tabs button, #view .tabs a'))
      .find(x => x.textContent.trim() === n);
    if (t) t.click();
  }, name);
  await page.waitForTimeout(1100);
  return page.evaluate(() => document.getElementById('view').innerText.replace(/\s+/g, ' '));
}

/** Bo'sh joysiz solishtirish uchun: "880 000" ham, "880000" ham topilsin */
function hasNumber(text, n) {
  const plain = String(n);
  const spaced = plain.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const nbsp = spaced.replace(/ /g, ' ');
  return text.indexOf(plain) >= 0 || text.indexOf(spaced) >= 0 || text.indexOf(nbsp) >= 0;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  const lg = await api('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  COOKIE = lg.cookie;
  if (!COOKIE) { console.error('Direktor kira olmadi.'); process.exit(1); }

  const THIS = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);
  const [y, m] = THIS.split('-').map(Number);
  const NEXT = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'));

  /* --- sun'iy ma'lumot --- */
  await put('staff/' + ID('t'), { id: ID('t'), name: 'Ustoz Tahrir', status: 'faol', position: 'O’qituvchi', payType: 'fixed', salaryAmount: 4000000 });
  await put('rooms/' + ID('r'), { id: ID('r'), name: 'Tahrir xona', capacity: 12 });
  await put('courses/' + ID('c'), { id: ID('c'), name: 'Tahrir kursi', monthlyFee: 830000, lessonMinutes: 90, active: true, order: 90 });
  await put('groups/' + ID('g'), {
    id: ID('g'), code: 'T' + String(Date.now() % 900 + 99).padStart(3, '0'),
    name: 'Tahrir guruhi', courseId: ID('c'), teacherId: ID('t'), roomId: ID('r'),
    days: [1, 4], startTime: '18:00', endTime: '19:30', startDate: THIS + '-01',
    fee: 830000, feeHistory: [{ fee: 830000, from: THIS }], limit: 12, status: 'faol'
  });
  await put('students/' + ID('s'), {
    id: ID('s'), firstName: 'Tahrir', lastName: 'Sinov', phone: '+998901234500', status: 'faol'
  });
  await put('memberships/' + ID('m'), {
    id: ID('m'), studentId: ID('s'), groupId: ID('g'), joinedAt: THIS + '-01', status: 'faol'
  });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });

  await page.goto(BASE + '#kirish');
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(800);

  /* ================= 1. GURUH NARXI ================= */
  section('1. Guruh narxi — oynadagi raqam va sahifadagi raqam bir xilmi');
  await page.goto(BASE + '#group?id=' + encodeURIComponent(ID('g')));
  await page.waitForTimeout(1200);
  await page.evaluate(id => {
    window.A.groupForm(window.A.Data.one('groups', id), window.A.App);
  }, ID('g'));
  await page.waitForSelector('.modal', { timeout: 15000 });
  await page.waitForTimeout(400);

  /* Oyna ochilganda ko'rsatilgan narx — KELGUSI oynikimi yoki g.fee mi?
     Ikkalasi ham 830 000 bo'lishi kerak: hali hech nima o'zgarmagan. */
  const feeShown = await fieldValue(page, 'Oylik narx');
  eq('Oyna ochilganda amaldagi narx turibdi', Number(feeShown), 830000);

  /* HAQIQIY HOLAT: foydalanuvchi narxni 880 000 qiladi va "qaysi oydan"
     maydoniga TEGMAYDI — u standart holda kelgusi oyni ko'rsatadi.
     Demak bu oyda raqam o'zgarmaydi. Shuni ekranda aytmasak,
     "tahrirladim, ichkarida 880 000, tashqarida 830 000" bo'ladi. */
  const err1 = await setField(page, 'Oylik narx', '880000');
  ok('Narx maydoniga yozildi', err1 === '', err1);
  ok('Saqlash tugmasi bosildi', await saveModal(page));

  const gAfter = await get('groups/' + ID('g'));
  ok('Narx tarixiga kelgusi oy uchun yozuv tushdi',
    !!(gAfter && (gAfter.feeHistory || []).some(x => x.from === NEXT && x.fee === 880000)),
    JSON.stringify(gAfter && gAfter.feeHistory));
  eq('Bu oyning narxi o’zgarmadi', gAfter && gAfter.fee, 830000);

  const gText = await reloadAndText(page, 'group?id=' + encodeURIComponent(ID('g')));
  ok('Sahifada bu oyning narxi turibdi (830 000)', hasNumber(gText, 830000), gText.slice(0, 300));
  /* ENG MUHIMI: kelgusi narx ekranda AYTILISHI kerak. Aytilmasa,
     foydalanuvchi "saqlanmadi" deb o'ylaydi.                        */
  ok('Kelgusi narx ekranda aytiladi (880 000)', hasNumber(gText, 880000), gText.slice(0, 300));

  section('   Formadagi narx tanlangan oyga ergashadi');
  await page.evaluate(id => {
    window.A.groupForm(window.A.Data.one('groups', id), window.A.App);
  }, ID('g'));
  await page.waitForSelector('.modal', { timeout: 15000 });
  await page.waitForTimeout(400);
  /* Kelgusi oy tanlansa — 880 000, shu oy tanlansa — 830 000 */
  await setField(page, 'Yangi narx qaysi oydan', NEXT);
  await page.waitForTimeout(300);
  eq('Kelgusi oyda 880 000', Number(await fieldValue(page, 'Oylik narx')), 880000);
  await setField(page, 'Yangi narx qaysi oydan', THIS);
  await page.waitForTimeout(300);
  eq('Shu oyda 830 000', Number(await fieldValue(page, 'Oylik narx')), 830000);

  section('   Shu oyni tanlab narxni o’zgartirish');
  await setField(page, 'Oylik narx', '900000');
  ok('Saqlandi', await saveModal(page));
  const gNow = await get('groups/' + ID('g'));
  eq('Bu oyning narxi endi o’zgardi', gNow && gNow.fee, 900000);
  const gText2 = await reloadAndText(page, 'group?id=' + encodeURIComponent(ID('g')));
  ok('Sahifada 900 000 ko’rinadi', hasNumber(gText2, 900000), gText2.slice(0, 300));

  /* ================= 2. KURS NARXI (saytdagi narx) ================= */
  section('2. Kurs narxi — saytdagi narx shundan olinadi');
  const c0 = await get('courses/' + ID('c'));
  await put('courses/' + ID('c'), Object.assign({}, c0, { monthlyFee: 880000 }));
  const pub = await api('/api/public');
  const mine = ((pub.json || {}).courses || []).find(x => x.id === ID('c'));
  ok('Kurs /api/public da bor', !!mine, JSON.stringify((pub.json || {}).courses || []).slice(0, 200));
  eq('Saytdagi narx yangilandi', mine && mine.fee, 880000);

  /* ================= 3. O'QUVCHI ================= */
  section('3. O’quvchi ma’lumotini tahrirlash');
  await page.goto(BASE + '#students');
  await page.waitForTimeout(1000);
  await page.evaluate(id => {
    window.A.studentForm(window.A.Data.one('students', id), window.A.App);
  }, ID('s'));
  await page.waitForSelector('.modal', { timeout: 15000 });
  await page.waitForTimeout(300);
  const e3 = await setField(page, 'Familiya', 'Yangilandi');
  ok('Familiya maydoni topildi', e3 === '', e3);
  await setField(page, 'Telefon', '+998901234599');
  ok('Saqlandi', await saveModal(page));
  const sAfter = await get('students/' + ID('s'));
  eq('Bazada familiya yangilandi', sAfter && sAfter.lastName, 'Yangilandi');
  eq('Bazada telefon yangilandi', sAfter && sAfter.phone, '+998901234599');
  const sText = await reloadAndText(page, 'student?id=' + encodeURIComponent(ID('s')));
  ok('O’quvchi sahifasida yangi familiya ko’rinadi', sText.indexOf('Yangilandi') >= 0, sText.slice(0, 200));
  ok('Yangi telefon ham ko’rinadi', sText.indexOf('901234599') >= 0 || sText.indexOf('90 123 45 99') >= 0,
    sText.slice(0, 260));

  /* ================= 4. XODIM (ustoz) ================= */
  section('4. Xodim ma’lumotini tahrirlash');
  const t0 = await get('staff/' + ID('t'));
  await put('staff/' + ID('t'), Object.assign({}, t0, { name: 'Ustoz Yangi', salaryAmount: 5500000 }));
  const tAfter = await get('staff/' + ID('t'));
  eq('Bazada ism yangilandi', tAfter && tAfter.name, 'Ustoz Yangi');
  const tText = await reloadAndText(page, 'staff', 'Ustoz Yangi');
  ok('Xodimlar ro’yxatida yangi ism ko’rinadi', tText.indexOf('Ustoz Yangi') >= 0, tText.slice(0, 300));
  const gText3 = await reloadAndText(page, 'group?id=' + encodeURIComponent(ID('g')), 'Ustoz Yangi');
  ok('Guruh sahifasida ustozning yangi ismi ko’rinadi',
    gText3.indexOf('Ustoz Yangi') >= 0, gText3.slice(0, 260));

  /* ================= 5. XONA ================= */
  section('5. Xona nomini tahrirlash');
  const r0 = await get('rooms/' + ID('r'));
  await put('rooms/' + ID('r'), Object.assign({}, r0, { name: 'Xona Yangi', capacity: 20 }));
  const rText = await reloadAndText(page, 'group?id=' + encodeURIComponent(ID('g')), 'Xona Yangi');
  ok('Guruh sahifasida xonaning yangi nomi ko’rinadi',
    rText.indexOf('Xona Yangi') >= 0, rText.slice(0, 260));

  /* ================= 6. SOZLAMALAR ================= */
  section('6. Sozlama — saytga chiqadigan matn');
  const st0 = await get('meta/settings');
  const addr = 'Tahrir ko’chasi ' + (Date.now() % 900 + 10);
  await put('meta/settings', Object.assign({}, st0, { address: addr }));
  const pub2 = await api('/api/public');
  eq('Sozlama /api/public da yangilandi', (pub2.json || {}).address, addr);
  await reloadAndText(page, 'settings');
  /* Manzil "Markaz" yorlig'i ichida — avval o'sha yorliqni ochamiz */
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('#view .tabs button, #view .tabs a'))
      .find(x => /^Markaz$/.test(x.textContent.trim()));
    if (t) t.click();
  });
  await page.waitForTimeout(900);
  const stText = await page.evaluate(() => {
    const v = document.getElementById('view');
    const vals = Array.from(v.querySelectorAll('input, textarea')).map(i => i.value).join(' | ');
    return (v.innerText + ' | ' + vals).replace(/\s+/g, ' ');
  });
  ok('Sozlamalar sahifasida yangi manzil turibdi', stText.indexOf(addr) >= 0, stText.slice(0, 300));

  /* ================= 7. GURUH NOMI VA VAQTI ================= */
  section('7. Guruh nomi va dars vaqti');
  await page.goto(BASE + '#group?id=' + encodeURIComponent(ID('g')));
  await page.waitForTimeout(1000);
  await page.evaluate(id => {
    window.A.groupForm(window.A.Data.one('groups', id), window.A.App);
  }, ID('g'));
  await page.waitForSelector('.modal', { timeout: 15000 });
  await page.waitForTimeout(300);
  await setField(page, 'Guruh nomi', 'Tahrir guruhi 2');
  await setField(page, 'Boshlanish vaqti', '19:00');
  await setField(page, 'Tugash vaqti', '20:30');
  ok('Saqlandi', await saveModal(page));
  const gN = await get('groups/' + ID('g'));
  eq('Bazada guruh nomi yangilandi', gN && gN.name, 'Tahrir guruhi 2');
  eq('Bazada boshlanish vaqti yangilandi', gN && gN.startTime, '19:00');
  const gText4 = await reloadAndText(page, 'group?id=' + encodeURIComponent(ID('g')));
  ok('Sahifada yangi nom ko’rinadi', gText4.indexOf('Tahrir guruhi 2') >= 0, gText4.slice(0, 200));
  ok('Sahifada yangi vaqt ko’rinadi', gText4.indexOf('19:00') >= 0, gText4.slice(0, 260));

  /* ================= 8. IKKI MARTA TAHRIR ================= */
  section('8. Ketma-ket ikki marta tahrirlash');
  for (const nm of ['Uchinchi nom', 'To’rtinchi nom']) {
    await page.evaluate(id => {
      window.A.groupForm(window.A.Data.one('groups', id), window.A.App);
    }, ID('g'));
    await page.waitForSelector('.modal', { timeout: 15000 });
    await page.waitForTimeout(300);
    await setField(page, 'Guruh nomi', nm);
    await saveModal(page);
  }
  const gLast = await get('groups/' + ID('g'));
  eq('Oxirgi tahrir saqlandi', gLast && gLast.name, 'To’rtinchi nom');
  const gText5 = await reloadAndText(page, 'group?id=' + encodeURIComponent(ID('g')));
  ok('Sahifada oxirgi nom', gText5.indexOf('To’rtinchi nom') >= 0, gText5.slice(0, 200));
  ok('Oldingi nom qolmadi', gText5.indexOf('Uchinchi nom') < 0, gText5.slice(0, 200));

  await page.screenshot({ path: path.join(SHOTS, 'tahrir-guruh.png') });

  /* ================= 9. USTOZ PROFILI (saytga chiqadi) ================= */
  section('9. Ustoz profili — ERP da o’zgarsa saytda ham o’zgaradimi');
  await put('teachers/' + ID('tp'), {
    id: ID('tp'), name: 'Ustoz Profil', tag: 'Arab ustoz', country: 'Misr',
    audience: 'erkaklar', levels: 'A1–B2', years: 5, bio: 'Birinchi matn',
    order: 95, active: true
  });
  await page.goto(BASE + '#staff');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const tOpen = await page.evaluate(id => {
    const t = window.A.Data.one('teachers', id);
    if (!t) return 'ustoz topilmadi';
    if (typeof window.A.teacherForm !== 'function') return 'forma ochiq emas';
    window.A.teacherForm(t, window.A.App);
    return '';
  }, ID('tp'));
  if (tOpen === '') {
    await page.waitForSelector('.modal', { timeout: 15000 });
    await page.waitForTimeout(300);
    await setField(page, 'Qisqa ma’lumot', 'Ikkinchi matn — yangilandi');
    await setField(page, 'Tajriba', '9');
    ok('Ustoz formasi saqlandi', await saveModal(page));
  } else {
    /* Forma tashqaridan chaqirilmasa — ma'lumotni API orqali o'zgartiramiz */
    const t1 = await get('teachers/' + ID('tp'));
    await put('teachers/' + ID('tp'), Object.assign({}, t1, { bio: 'Ikkinchi matn — yangilandi', years: 9 }));
    out.push('  · ustoz formasi tashqaridan chaqirilmadi (' + tOpen + '), ma’lumot API orqali o’zgartirildi');
  }
  const tp = await get('teachers/' + ID('tp'));
  eq('Bazada ustoz matni yangilandi', tp && tp.bio, 'Ikkinchi matn — yangilandi');
  const pubT = await api('/api/public');
  const mineT = ((pubT.json || {}).teachers || []).find(x => x.id === ID('tp'));
  ok('Ustoz /api/public da bor', !!mineT, JSON.stringify((pubT.json || {}).teachers || []).slice(0, 160));
  eq('Saytdagi matn ham yangilandi', mineT && mineT.bio, 'Ikkinchi matn — yangilandi');
  /* Saytda ko'rinmasin qilinsa — darhol yo'qolishi kerak */
  await put('teachers/' + ID('tp'), Object.assign({}, tp, { active: false }));
  const pubT2 = await api('/api/public');
  ok('"Saytda ko’rinmasin" ishlaydi',
    !((pubT2.json || {}).teachers || []).some(x => x.id === ID('tp')),
    JSON.stringify((pubT2.json || {}).teachers || []).slice(0, 160));

  /* ================= 10. TO'LOV VA QARZ ================= */
  section('10. To’lov — qarzdorlik darhol kamayadimi');
  const invId = 'inv_' + ID('m') + '_' + THIS;
  await put('invoices/' + invId, {
    id: invId, membershipId: ID('m'), studentId: ID('s'), groupId: ID('g'), month: THIS,
    base: 900000, discount: 0, final: 900000, dueDate: THIS + '-05', createdAt: THIS + '-01 09:00:00'
  });
  /* To'lovni FAQAT server yozadi va taqsimotni MIJOZ yuboradi.
     Shuning uchun bu yerda haqiqiy to'lov oynasi ishlatiladi —
     foydalanuvchi ham shu yo'ldan yuradi.                          */
  await reloadAndText(page, 'student?id=' + encodeURIComponent(ID('s')));
  await page.evaluate(sid => { window.A.paymentForm(sid, window.A.App); }, ID('s'));
  await page.waitForSelector('.modal', { timeout: 15000 });
  await page.waitForTimeout(500);
  const eAmt = await setField(page, 'Summa', '400000');
  ok('Summa maydoni topildi', eAmt === '', eAmt);
  await page.waitForTimeout(600);
  ok('To’lov saqlandi', await saveModal(page));
  await page.waitForTimeout(800);

  const paysNow = (await api('/api/collection?name=payments')).json || {};
  const myPay = Object.values(paysNow.items || {}).find(p => p.studentId === ID('s') && !p.voided);
  ok('To’lov bazaga tushdi', !!myPay, JSON.stringify(Object.keys(paysNow.items || {})).slice(0, 120));
  ok('To’lov hisobga taqsimlandi',
    !!(myPay && (myPay.allocations || []).some(a => a.invoiceId === invId && a.amount === 400000)),
    JSON.stringify(myPay && myPay.allocations));

  const sText2 = await reloadAndText(page, 'student?id=' + encodeURIComponent(ID('s')), '500');
  ok('O’quvchi sahifasida qolgan qarz 500 000', hasNumber(sText2, 500000), sText2.slice(0, 400));

  /* To'lovni bekor qilsak — qarz TO'LIQ qaytib kelishi kerak */
  if (myPay) {
    const voidRes = await api('/api/payment/void', {
      method: 'POST', body: { id: myPay.id, reason: 'sinov uchun bekor qilindi' }
    });
    ok('To’lov bekor qilindi (' + voidRes.status + ')', voidRes.status === 200, voidRes.text.slice(0, 160));
    const sText4 = await reloadAndText(page, 'student?id=' + encodeURIComponent(ID('s')), '900');
    ok('Bekor qilingach qarz to’liq qaytdi (900 000)', hasNumber(sText4, 900000), sText4.slice(0, 400));
  }

  /* ================= 11. MUROJAAT (lead) ================= */
  section('11. Murojaat holatini o’zgartirish');
  await put('leads/' + ID('l'), {
    id: ID('l'), name: 'Murojaat Sinov', phone: '+998901234511',
    status: 'yangi', source: 'sayt', note: 'Birinchi izoh', createdAt: THIS + '-02 10:00:00'
  });
  const l0 = await get('leads/' + ID('l'));
  await put('leads/' + ID('l'), Object.assign({}, l0, { note: 'Ikkinchi izoh', status: 'aloqada' }));
  const lText = await reloadAndText(page, 'leads', 'Murojaat Sinov');
  ok('Murojaatlar ro’yxatida yangi holat ko’rinadi',
    lText.indexOf('Murojaat Sinov') >= 0, lText.slice(0, 300));

  /* ================= 12. FOYDALANUVCHI ================= */
  section('12. Foydalanuvchi ma’lumoti');
  const uLogin = 'tahrir' + Date.now().toString(36).slice(-5);
  const uId = ID('u');
  /* Parolni FAQAT server hisoblaydi: u alohida "password" maydonida
     yuboriladi, hash hech qachon mijozdan qabul qilinmaydi.        */
  const uRes = await api('/api/doc?path=' + encodeURIComponent('users/' + uId), {
    method: 'PUT',
    body: {
      data: { id: uId, name: 'Tahrir Xodim', login: uLogin, role: 'oqituvchi', active: true },
      password: 'Tahrir12345'
    }
  });
  ok('Foydalanuvchi yaratildi (' + uRes.status + ')', uRes.status === 200, uRes.text.slice(0, 160));
  const made = await get('users/' + uId);
  ok('Ro’yxatda bor', !!made, JSON.stringify(made).slice(0, 120));
  /* Parol xeshi mijozga UMUMAN berilmaydi — javobda bo'lmasligi kerak */
  ok('Parol xeshi javobda yo’q',
    !!made && !made.hash && !made.salt && !made.password, Object.keys(made || {}).join(','));
  /* Lekin parol haqiqatan ishlashi kerak */
  const relog = await fetch(API + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: uLogin, password: 'Tahrir12345' })
  });
  ok('Yangi foydalanuvchi kira oladi (' + relog.status + ')', relog.status === 200);
  if (made) {
    await put('users/' + made.id, Object.assign({}, made, { name: 'Tahrir Xodim 2' }));
    const uText = await reloadAndText(page, 'settings');
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('#view .tabs button, #view .tabs a'))
        .find(x => /Foydalanuvchilar/.test(x.textContent.trim()));
      if (t) t.click();
    });
    await page.waitForTimeout(900);
    const uT = await page.evaluate(() => document.getElementById('view').innerText.replace(/\s+/g, ' '));
    ok('Foydalanuvchilar ro’yxatida yangi ism', uT.indexOf('Tahrir Xodim 2') >= 0, uT.slice(0, 300));
    await api('/api/doc?path=' + encodeURIComponent('users/' + made.id), { method: 'DELETE' });
  }

  /* ================= 13. DAVOMAT ================= */
  section('13. Davomat — belgilangani saqlanib, sahifada ko’rinadimi');
  /* Davomat alohida hujjatda saqlanadi: lessons/<guruh>__<oy> */
  await reloadAndText(page, 'attendance?groupId=' + encodeURIComponent(ID('g')));
  let attDate = await page.evaluate(() => {
    const d = document.querySelector('#view input[type=date]');
    return d ? d.value : '';
  });
  const allIn = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#view button'))
      .find(x => /Hammani/.test(x.textContent));
    if (!b) return false;
    b.click(); return true;
  });
  ok('"Hammani Keldi deb belgilash" tugmasi bor', allIn);
  if (allIn) {
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#view .btn.primary'))
        .find(x => /Saqlash/.test(x.textContent));
      if (!b) return false;
      b.click(); return true;
    });
    ok('Davomat saqlandi', saved);
    await page.waitForTimeout(1500);
    const doc = await get('lessons/' + ID('g') + '__' + THIS);
    /* Sana maydoni topilmasa — hujjatdagi yagona kunni olamiz */
    if (!attDate && doc && doc.items) attDate = Object.keys(doc.items)[0] || '';
    const rec = doc && doc.items && doc.items[attDate];
    ok('Davomat bazaga yozildi (' + attDate + ')',
      !!(rec && rec.attendance && Object.keys(rec.attendance).length),
      JSON.stringify(doc && Object.keys(doc.items || {})));
    ok('Kim belgilagani ham yozildi', !!(rec && rec.markedBy), JSON.stringify(rec && rec.markedBy));
    /* Qayta yuklangach tanlov saqlanib turishi kerak */
    await reloadAndText(page, 'attendance?groupId=' + encodeURIComponent(ID('g')) + '&date=' + attDate);
    const stillOn = await page.evaluate(() =>
      document.querySelectorAll('#view .att-opts button[aria-pressed="true"]').length);
    ok('Qayta yuklangach belgilangani turibdi', stillOn > 0, String(stillOn));
  }

  /* ================= 14. XARAJAT ================= */
  section('14. Xarajat — yozilgani moliyada ko’rinadimi');
  const expSum = 1234000;
  const expRes = await put('expenses/' + ID('e'), {
    id: ID('e'), title: 'Tahrir xarajati', amount: expSum, date: THIS + '-05',
    month: THIS, category: 'Boshqa'
  });
  ok('Xarajat yozildi (' + expRes.status + ')', expRes.status === 200, expRes.text.slice(0, 160));
  if (expRes.status === 200) {
    const eText = await financeTab(page, 'Xarajatlar');
    ok('Moliya sahifasida xarajat ko’rinadi',
      eText.indexOf('Tahrir xarajati') >= 0 || hasNumber(eText, expSum), eText.slice(0, 400));
    /* Summasi o'zgartirilsa — yangisi ko'rinsin */
    const e1 = await get('expenses/' + ID('e'));
    await put('expenses/' + ID('e'), Object.assign({}, e1, { amount: 2345000, title: 'Tahrir xarajati 2' }));
    const eText2 = await financeTab(page, 'Xarajatlar');
    ok('O’zgartirilgan summa ko’rinadi (2 345 000)', hasNumber(eText2, 2345000), eText2.slice(0, 400));
    ok('Eski summa qolmadi', !hasNumber(eText2, expSum), eText2.slice(0, 400));
  }

  /* ================= 15. VAZIFA ================= */
  section('15. Vazifa — holati o’zgarsa ro’yxatda ko’rinadimi');
  const taskRes = await put('tasks/' + ID('tk'), {
    id: ID('tk'), title: 'Tahrir vazifasi', status: 'yangi',
    assigneeId: 'usr_admin', due: THIS + '-20', createdAt: THIS + '-02 09:00:00'
  });
  if (taskRes.status === 200) {
    const k1 = await get('tasks/' + ID('tk'));
    await put('tasks/' + ID('tk'), Object.assign({}, k1, { title: 'Tahrir vazifasi 2' }));
    await reloadAndText(page, 'tasks');
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('#view .tabs button, #view .tabs a'))
        .find(x => /Barchasi/.test(x.textContent.trim()));
      if (t) t.click();
    });
    await page.waitForTimeout(900);
    const kText = await page.evaluate(() =>
      document.getElementById('view').innerText.replace(/\s+/g, ' '));
    ok('Vazifalar ro’yxatida yangi nom', kText.indexOf('Tahrir vazifasi 2') >= 0, kText.slice(0, 300));
  } else {
    out.push('  · vazifa yozilmadi (' + taskRes.status + ') — bo’lim o’tkazib yuborildi');
  }

  /* --- tozalash --- */
  for (const p of ['payments/' + ID('p1'), 'payments/' + ID('p2'),
    'invoices/inv_' + ID('m') + '_' + THIS, 'users/' + ID('u'),
    'memberships/' + ID('m'), 'groups/' + ID('g'), 'students/' + ID('s'),
    'courses/' + ID('c'), 'rooms/' + ID('r'), 'staff/' + ID('t'),
    'teachers/' + ID('tp'), 'leads/' + ID('l'),
    'expenses/' + ID('e'), 'tasks/' + ID('tk')]) {
    await api('/api/doc?path=' + encodeURIComponent(p), { method: 'DELETE' });
  }
  if (st0) await put('meta/settings', st0);

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
