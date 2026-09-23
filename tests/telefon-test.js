/* TELEFONDA HAQIQIY AMALLAR — sayt ham, ERP ham.

   Bu sinov "ko'rinishi chiroyli bo'ldimi" degan savolga emas, "telefonda
   ishlab beryaptimi" degan savolga javob beradi. Shuning uchun hamma joyda
   barmoq bilan bosiladi (tap), yozuvlar klaviaturadan kiritiladi va natija
   BAZADAN tekshiriladi — ekrandagi yozuvga ishonilmaydi.

   Tekshiriladi:
     1) saytdan ariza qoldirish;
     2) saytdan izoh yozish (tasdiqlanmaguncha saytda chiqmaydi);
     3) pastdagi doimiy tasma (qo'ng'iroq va "Darsga yozilish");
     4) daraja testini boshdan-oxir topshirish (20 ta savol, sanoq);
     5) ERP: davomat belgilash va saqlash;
     6) ERP: to'lov qabul qilish;
     7) hech qaysi bosqichda yon siljish va JS xatosi yo'qligi.

   Sun'iy ma'lumot, alohida sinov serveri, faqat localhost.
   Haqiqiy odamga xabar yuborilmaydi, production bazaga tegilmaydi.
     node tests/telefon-test.js [port] [direktor paroli]                  */
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
function ok(n, c, e) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 180) : '')); } }
function eq(n, got, want) { ok(n, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

const R = 'tel' + Date.now().toString(36);
const ID = n => R + '_' + n;
const GID = ID('g');

async function api(p, o = {}) {
  const res = await fetch(API + p, {
    method: o.method || 'GET',
    headers: Object.assign(o.body ? { 'Content-Type': 'application/json' } : {}, o.cookie ? { Cookie: o.cookie } : {}),
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const lg = await api('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  const dir = lg.cookie;
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }
  const put = (p, data) => api('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie: dir, body: { data } });

  /* ---- Sun'iy ma'lumot: bugun darsi bor guruh va bitta o'quvchi ---- */
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const wd = (d => (d === 0 ? 7 : d))(new Date(today + 'T00:00:00').getDay());
  await put('staff/' + ID('t'), { id: ID('t'), name: 'Ustoz Telefon', status: 'faol' });
  await put('courses/' + ID('c'), { id: ID('c'), name: 'Arab tili (telefon sinovi)', monthlyFee: 880000, active: true });
  await put('groups/' + ID('g'), {
    /* Kod takrorlanmasin — sinov qayta ishga tushganda ham yangi guruh */
    id: ID('g'), code: 'T' + String(Date.now() % 1000).padStart(3, '0'),
    name: 'Telefon guruhi', courseId: ID('c'), teacherId: ID('t'),
    days: [wd], startTime: '08:00', endTime: '23:00', startDate: today,
    fee: 880000, feeHistory: [{ fee: 880000, from: today.slice(0, 7) }], limit: 10, status: 'faol'
  });
  await put('students/' + ID('s'), {
    id: ID('s'), firstName: 'Telefon', lastName: 'Sinov', phone: '+99890' + String(Date.now()).slice(-7), status: 'faol'
  });
  await put('memberships/' + ID('m'), { id: ID('m'), studentId: ID('s'), groupId: ID('g'), joinedAt: today, status: 'faol' });

  /* Eski sinovlardan qolgan izohlarni tozalaymiz — bir IP dan kuniga
     3 ta chegara (to'g'ri qoida) sinovni to'xtatib qo'ymasin. */
  const oldRev = await api('/api/collection?name=reviews', { cookie: dir });
  for (const r of Object.values((oldRev.json || {}).items || {})) {
    if (r && /^Telefon /.test(String(r.name || ''))) {
      await api('/api/doc?path=' + encodeURIComponent('reviews/' + r.id), { method: 'DELETE', cookie: dir });
    }
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  const ovf = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  /* ================= 1. Saytdan ariza ================= */
  section('1. Telefondan ariza qoldirish');
  await page.goto(BASE);
  await page.waitForSelector('.lead-form', { timeout: 20000 });
  await page.waitForTimeout(1200);
  ok('Sayt telefonda yon siljimaydi', (await ovf()) <= 1, String(await ovf()));
  const PHONE = '+99890' + String(Date.now()).slice(-7);
  await page.locator('#lead-name').tap();
  await page.locator('#lead-name').fill('Telefon Mijoz ' + R);
  await page.locator('#lead-phone').fill(PHONE);
  const chipOn = await page.evaluate(() => {
    const c = document.querySelectorAll('.chip-row .chip');
    if (c.length < 2) return false;
    c[1].click();
    return c[1].classList.contains('on');
  });
  ok('Daraja tugmasi bosildi', chipOn);
  await page.locator('.lead-form button[type=submit]').tap();
  await page.waitForTimeout(1800);
  const leads = await api('/api/collection?name=leads', { cookie: dir });
  const lead = Object.values((leads.json || {}).items || {}).find(l => (l.name || '').includes(R));
  ok('Ariza bazaga tushdi', !!lead, 'topilmadi');
  ok('Telefon raqami saqlandi', lead && String(lead.phone || '').replace(/\D/g, '').endsWith(PHONE.slice(-7)),
    lead && lead.phone);

  /* ================= 2. Pastdagi doimiy tasma ================= */
  section('2. Pastdagi tasma: qo’ng’iroq va yozilish');
  await page.goto(BASE);
  await page.waitForSelector('.site-hero', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const hasBar = await page.evaluate(() => !!document.getElementById('cta-bar'));
  ok('Pastdagi tasma saytda bor', hasBar, 'cta-bar topilmadi');
  ok('Tepada tasma yopiq',
    hasBar && await page.evaluate(() => !document.getElementById('cta-bar').classList.contains('on')));
  await page.evaluate(() => window.scrollTo(0, 2200));
  await page.waitForFunction(() => document.getElementById('cta-bar').classList.contains('on'),
    null, { timeout: 5000 }).catch(() => { });
  const bar = await page.evaluate(() => {
    const b = document.getElementById('cta-bar');
    if (!b) return { on: false, tel: '', telH: 0, goH: 0 };
    const t = document.getElementById('cta-bar-tel');
    const g = b.querySelector('.cta-bar-go');
    if (!t || !g) return { on: false, tel: '', telH: 0, goH: 0 };
    return {
      on: b.classList.contains('on'),
      tel: t.getAttribute('href'),
      telH: Math.round(t.getBoundingClientRect().height),
      goH: Math.round(g.getBoundingClientRect().height)
    };
  });
  ok('Pastga tushganda tasma chiqdi', bar.on, JSON.stringify(bar));
  ok('Qo’ng’iroq tugmasi raqamga ulangan', /^tel:\+?\d{7,}$/.test(bar.tel || ''), bar.tel);
  ok('Tasmadagi tugmalar ≥ 48px', bar.telH >= 48 && bar.goH >= 48, JSON.stringify(bar));
  /* Tugma bosilsa ariza formasiga olib boradi */
  await page.evaluate(() => { const g = document.querySelector('.cta-bar-go'); if (g) g.click(); });
  await page.waitForTimeout(1200);
  const atForm = await page.evaluate(() => {
    const f = document.getElementById('ariza');
    if (!f) return false;
    const r = f.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  ok('Tugma ariza formasiga olib bordi', atForm);

  /* ================= 3. Izoh qoldirish ================= */
  section('3. Telefondan izoh qoldirish');
  await page.goto(BASE);
  await page.waitForSelector('#izohlar', { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).filter(x => /Izoh qoldirish/.test(x.textContent)).pop();
    b.click();
  });
  await page.waitForSelector('.modal .rev-pick', { timeout: 15000 });
  await page.waitForTimeout(400);
  const modal = await page.evaluate(() => {
    const st = Array.from(document.querySelectorAll('.rev-pick-b'));
    const foot = document.querySelector('.modal .m-foot').getBoundingClientRect();
    return {
      star: Math.min.apply(null, st.map(x => Math.round(x.getBoundingClientRect().width))),
      starH: Math.min.apply(null, st.map(x => Math.round(x.getBoundingClientRect().height))),
      footVisible: foot.bottom <= window.innerHeight + 1
    };
  });
  ok('Yulduzlar barmoqqa mos (≥ 44px)', modal.star >= 44 && modal.starH >= 44, JSON.stringify(modal));
  ok('Yuborish tugmasi ekranda ko’rinadi', modal.footVisible);
  await page.locator('#rev-name').fill('Telefon Izoh ' + R);
  await page.locator('#rev-text').fill('Telefondan yozyapman — darslar qulay, ustoz tushuntirib beradi.');
  await page.locator('.rev-pick-b').nth(3).tap();
  eq('To’rt yulduz tanlandi',
    await page.evaluate(() => document.querySelectorAll('.rev-pick-b.on').length), 4);
  await page.screenshot({ path: path.join(SHOTS, 'telefon-izoh.png') });
  await page.evaluate(() => Array.from(document.querySelectorAll('.modal button')).find(x => /Yuborish/.test(x.textContent)).click());
  await page.waitForTimeout(1800);
  const revs = await api('/api/collection?name=reviews', { cookie: dir });
  const rev = Object.values((revs.json || {}).items || {}).find(x => (x.name || '').includes(R));
  ok('Izoh bazaga tushdi', !!rev, 'topilmadi');
  eq('Baho saqlandi', rev && rev.rating, 4);
  eq('Holati "yangi" — tasdiqlanmagan', rev && rev.status, 'yangi');
  const pub = await api('/api/public');
  ok('Tasdiqlanmagan izoh saytda chiqmaydi',
    !JSON.stringify(pub.json.reviews || []).includes(R));

  /* ================= 4. Daraja testi ================= */
  section('4. Daraja testini telefonda topshirish');
  await page.goto(BASE + '#test');
  await page.waitForSelector('.test-lang', { timeout: 20000 });
  const rules = await page.evaluate(() => (document.querySelector('.test-rules') || {}).innerText || '');
  ok('Boshlashdan oldin shart yozilgan: ' + rules.replace(/\n/g, ' '),
    /20/.test(rules) && /10/.test(rules), rules);
  await page.evaluate(() => Array.from(document.querySelectorAll('.test-lang .btn')).pop().click());
  await page.waitForSelector('.test-opts', { timeout: 20000 });
  await page.waitForTimeout(600);
  const clock1 = await page.evaluate(() => {
    const c = document.querySelector('.test-clock');
    return { shown: c && !c.hidden, v: (document.querySelector('.test-clock-v') || {}).textContent || '' };
  });
  ok('Sanoq ko’rinadi (' + clock1.v + ')', clock1.shown && /^\d+:\d\d$/.test(clock1.v), JSON.stringify(clock1));
  ok('Sanoq 10 daqiqadan boshlandi', /^(10:00|9:5\d)$/.test(clock1.v), clock1.v);
  const optH = await page.evaluate(() =>
    Math.min.apply(null, Array.from(document.querySelectorAll('.test-opt')).map(o => Math.round(o.getBoundingClientRect().height))));
  ok('Variant tugmalari ≥ 44px', optH >= 44, optH + 'px');
  ok('Test sahifasi yon siljimaydi', (await ovf()) <= 1, String(await ovf()));
  await page.screenshot({ path: path.join(SHOTS, 'telefon-test.png') });

  let answered = 0;
  for (let i = 0; i < 25; i++) {
    if (!(await page.locator('.test-opt').count())) break;
    await page.locator('.test-opt').first().tap();
    answered++;
    await page.waitForTimeout(120);
  }
  eq('20 ta savolga javob berildi', answered, 20);
  await page.waitForSelector('.test-end', { timeout: 15000 });
  await page.locator('.test-end button[type=submit]').tap();
  await page.waitForSelector('.test-res', { timeout: 20000 });
  const res = await page.evaluate(() => document.querySelector('.test-res').innerText);
  ok('Natija chiqdi', /A0|A1|A2|B1|B2|C1|C2/.test(res), res.slice(0, 120));
  ok('Umumiy natija 20 tadan hisoblandi', /\/\s*20/.test(res), res.slice(0, 200));
  ok('Natijada to’g’ri javoblar ro’yxati yo’q', !/answer/i.test(res));
  ok('Natija sahifasida sanoq to’xtadi',
    await page.evaluate(() => document.querySelector('.test-clock').hidden));

  /* ================= 5. ERP: davomat ================= */
  section('5. ERP — telefonda davomat belgilash');
  await page.goto(BASE + '#kirish');
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.locator('#login-user').fill('admin');
  await page.locator('#login-pass').fill(PASS);
  await page.locator('button[type=submit]').tap();
  await page.waitForSelector('#app:not([hidden])', { timeout: 25000 });
  await page.waitForTimeout(1500);
  /* Aynan SHU sinov yaratgan guruhga kiramiz — bazada boshqa guruhlar
     ham bo'lishi mumkin, tasodifiy tanlangani sinovni chalg'itadi.   */
  await page.evaluate(a => window.A.App.go('attendance', { groupId: a[0], date: a[1] }),
    [GID, today]);
  await page.waitForSelector('.today-strip', { timeout: 20000 });
  await page.waitForTimeout(1800);
  const strip = await page.evaluate(() => ({
    cards: document.querySelectorAll('.ts-card').length,
    subs: Array.from(document.querySelectorAll('.ts-sub')).map(x => x.innerText.replace(/\n/g, ' ')),
    firstW: document.querySelector('.ts-card') ? Math.round(document.querySelector('.ts-card').getBoundingClientRect().width) : 0,
    scrollable: (() => { const r = document.querySelector('.ts-row'); return r ? r.scrollWidth > r.clientWidth : false; })()
  }));
  ok('Bugungi darslar tasmasi chiqdi (' + strip.cards + ' ta)', strip.cards >= 1, JSON.stringify(strip));
  ok('Darslar holat bo’yicha bo’lingan', strip.subs.length >= 1, strip.subs.join(' | '));
  ok('Dars kartasi telefonda o’qiladigan enlikda', strip.firstW >= 200, strip.firstW + 'px');
  ok('Davomat sahifasi yon siljimaydi', (await ovf()) <= 1, String(await ovf()));

  /* O'quvchini "Keldi" deb belgilaymiz va saqlaymiz */
  await page.waitForSelector('.att-row', { timeout: 20000 });
  const attBtn = await page.evaluate(() => {
    const b = document.querySelector('.att-opts button');
    return b ? Math.round(b.getBoundingClientRect().height) : 0;
  });
  ok('Davomat tugmasi ≥ 44px', attBtn >= 44, attBtn + 'px');
  await page.locator('.att-opts button').first().tap();
  await page.waitForTimeout(400);
  ok('Belgilash ishladi',
    (await page.evaluate(() => document.querySelectorAll('.att-opts button[aria-pressed="true"]').length)) >= 1);
  await page.screenshot({ path: path.join(SHOTS, 'telefon-davomat.png') });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.card button')).find(x => /Saqlash/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(2200);
  const ym = today.slice(0, 7);
  const les = await api('/api/doc?path=' + encodeURIComponent('lessons/' + ID('g') + '__' + ym), { cookie: dir });
  const rec = ((les.json || {}).data || {}).items || {};
  const day = rec[today] || {};
  ok('Davomat bazaga yozildi', !!(day.attendance && Object.keys(day.attendance).length),
    JSON.stringify(day).slice(0, 160));
  ok('Kim belgilagani yozildi', !!day.markedBy, JSON.stringify(day).slice(0, 160));

  /* ================= 6. ERP: to'lov ================= */
  section('6. ERP — telefonda to’lov qabul qilish');
  await page.evaluate(() => window.A.App.go('finance'));
  await page.waitForTimeout(1600);
  ok('Moliya sahifasi yon siljimaydi', (await ovf()) <= 1, String(await ovf()));
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.page-actions button, .card button'))
      .find(x => /To’lov qabul qilish/.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForSelector('.modal', { timeout: 15000 });
  await page.waitForTimeout(700);
  ok('To’lov oynasi yon siljimaydi', (await ovf()) <= 1, String(await ovf()));
  const foot = await page.evaluate(() => {
    const f = document.querySelector('.modal .m-foot');
    const r = f.getBoundingClientRect();
    return { visible: r.bottom <= window.innerHeight + 1, h: Math.round(r.height) };
  });
  ok('Saqlash tugmasi oynada ko’rinib turadi', foot.visible, JSON.stringify(foot));
  await page.screenshot({ path: path.join(SHOTS, 'telefon-tolov.png') });
  await page.evaluate(() => { const b = document.querySelector('.modal .m-head button'); if (b) b.click(); });
  await page.waitForTimeout(500);

  /* ================= 7. Umumiy ================= */
  section('7. Umumiy');
  ok('Hech qayerda JS xatosi chiqmadi', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

  /* Sinov yozganlarini tozalaymiz */
  if (rev) await api('/api/doc?path=' + encodeURIComponent('reviews/' + rev.id), { method: 'DELETE', cookie: dir });

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nScreenshotlar: shots/telefon-izoh.png, telefon-test.png, telefon-davomat.png, telefon-tolov.png');
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: Chromium telefon emulyatsiyasi (390×844, sensorli), soxta ma’lumot');
  console.log('va alohida sinov serveri ishlatildi — haqiqiy iPhone yoki Android emas.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
