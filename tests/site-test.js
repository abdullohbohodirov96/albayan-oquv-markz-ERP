/* Saytning ochiq sahifasi: ma'lumot, kurslar, ariza formasi va "Kirish" tugmasi.
   Formadan kelgan ariza "Murojaatlar" bo'limiga tushishi va xabar berilishi tekshiriladi.
   Serverni alohida bazada ishga tushiring, keyin:
     node tests/site-test.js [port] [direktor paroli]                        */
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
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

const R = 's' + Date.now().toString(36);
const PHONE = '+99890' + String(Date.now()).slice(-7);

async function api(p, opts = {}) {
  const res = await fetch(API + p, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.cookie ? { Cookie: opts.cookie } : {}, opts.ip ? { 'X-Forwarded-For': opts.ip } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
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

  /* --- markaz ma'lumoti va kurs --- */
  const st = (await api('/api/doc?path=' + encodeURIComponent('meta/settings'), { cookie: dir })).json.data;
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir,
    body: {
      data: Object.assign({}, st, {
        phone: '+998 71 200 70 07', address: 'Toshkent, Chilonzor 9-kvartal',
        about: 'AlBayan Cairo — arab tilini Misr uslubida o’rgatadigan markaz.',
        bot: Object.assign({}, st.bot || {}, { username: 'AlBayan_cairobot', staffChats: '' })
      })
    }
  });
  await api('/api/doc?path=' + encodeURIComponent('courses/' + R + '_c1'), {
    method: 'PUT', cookie: dir,
    body: { data: { id: R + '_c1', name: 'Arab tili — boshlang’ich', monthlyFee: 450000, active: true, note: 'A1 daraja, haftada 3 kun' } }
  });

  /* ================= 1. Ochiq ma'lumot ================= */
  section('1. /api/public — saytga kerakli ma’lumot');
  const pub = await api('/api/public');
  eq('Kirishsiz ochiladi', pub.status, 200);
  ok('Markaz nomi bor', !!pub.json.centerName, pub.text.slice(0, 120));
  ok('Telefon bor', /200 70 07/.test(pub.json.phone || ''), pub.json.phone);
  ok('Kurslar ro’yxati bor', (pub.json.courses || []).some(c => /boshlang/.test(c.name)), pub.text.slice(0, 200));
  ok('Maxfiy narsa yo’q', !/hash|salt|token|password/i.test(pub.text), pub.text.slice(0, 160));

  /* ================= 2. Sahifa ================= */
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });

  section('2. Sayt ochiladi (kirish talab qilinmaydi)');
  await page.goto(BASE);
  await page.waitForSelector('.site-hero', { timeout: 20000 });
  const txt = await page.evaluate(() => document.body.innerText);
  ok('Markaz nomi ko’rinadi', /AlBayan/.test(txt), txt.slice(0, 120));
  ok('Markaz haqida matn ko’rinadi', /Misr uslubida/.test(txt), txt.slice(0, 300));
  ok('Logotip bor', await page.evaluate(() => !!document.querySelector('.site-brand img') && !!document.querySelector('.hero-art img')));
  ok('Kurs kartasi bor', /boshlang/.test(txt) && (await page.evaluate(() => document.querySelectorAll('.course').length)) > 0);
  ok('Narx ko’rsatilgan', /450 000/.test(txt), txt.slice(0, 600));
  ok('Telefon va manzil bor', /200 70 07/.test(txt) && /Chilonzor/.test(txt));
  ok('Parol maydoni yo’q', !(await page.evaluate(() => !!document.getElementById('login-pass'))));
  await page.screenshot({ path: path.join(SHOTS, 'sayt-1280.png'), fullPage: true });

  section('   Tepada "Kirish" tugmasi');
  const hasLogin = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.site-top button')).some(b => /Kirish/.test(b.textContent)));
  ok('Kirish tugmasi tepada', hasLogin);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.site-top button')).find(b => /Kirish/.test(b.textContent)).click();
  });
  await page.waitForSelector('#login-user', { timeout: 10000 });
  ok('Kirish oynasi ochildi', true);
  await page.goBack().catch(() => { });
  await page.goto(BASE);
  await page.waitForSelector('.site-hero', { timeout: 15000 });

  /* ================= 3. Ariza formasi ================= */
  section('3. Pastdagi ariza formasi');
  ok('Forma bor', await page.evaluate(() => !!document.querySelector('.lead-form')));
  await page.fill('#lead-name', 'Sayt Mijoz ' + R);
  await page.fill('#lead-phone', PHONE);
  await page.fill('#lead-note', 'Kechki guruh qiziqtiradi');
  await page.selectOption('#lead-course', { index: 1 }).catch(() => { });
  await page.click('.lead-form button[type=submit]');
  await page.waitForTimeout(1500);
  const okTxt = await page.evaluate(() => {
    const b = document.querySelector('.lead-ok');
    return b && !b.hidden ? b.innerText : '';
  });
  ok('Rahmat xabari chiqdi', /qabul qilindi/i.test(okTxt), JSON.stringify(okTxt));

  section('   Murojaat "Murojaatlar" bo’limiga tushdi');
  const leads = await api('/api/collection?name=leads', { cookie: dir });
  const mine = Object.values(leads.json.items || {}).filter(l => (l.name || '').indexOf(R) >= 0)[0];
  ok('Lead yaratildi', !!mine, JSON.stringify(Object.keys(leads.json.items || {}).length));
  eq('Manba — Sayt', (mine || {}).source, 'Sayt');
  ok('Telefon saqlandi', (mine || {}).phone && (mine || {}).phone.replace(/\D/g, '').slice(-9) === PHONE.replace(/\D/g, '').slice(-9),
    (mine || {}).phone);
  ok('Kurs biriktirildi', !!(mine || {}).courseId, JSON.stringify(mine));
  ok('Izoh saqlandi', /Kechki guruh/.test((mine || {}).note || ''), (mine || {}).note);
  ok('Birinchi bosqichda', !!(mine || {}).stage, JSON.stringify((mine || {}).stage));

  section('   Direktorga xabar bordi');
  const boot = await api('/api/bootstrap', { cookie: dir });
  const chats = Object.values((boot.json.col || {}).chats || {});
  const sys = chats.filter(c => (c.messages || []).some(m => /Yangi murojaat/.test(m.text || '')))[0];
  ok('Ichki suhbatga xabar tushdi', !!sys, JSON.stringify(chats.map(c => c.id)));
  ok('Xabarda ism va telefon bor',
    !!sys && sys.messages.some(m => m.text.indexOf(R) >= 0 && m.text.indexOf(PHONE.slice(-7)) >= 0),
    sys ? JSON.stringify(sys.messages.slice(-1)) : '');

  section('   Takroriy ariza ikkinchi marta yaratilmaydi');
  const again = await api('/api/lead', { method: 'POST', body: { name: 'Sayt Mijoz ' + R, phone: PHONE } });
  ok('Takror deb belgilandi', again.json && again.json.duplicate === true, again.text);
  const leads2 = await api('/api/collection?name=leads', { cookie: dir });
  eq('Lead soni oshmadi',
    Object.values(leads2.json.items || {}).filter(l => (l.name || '').indexOf(R) >= 0).length, 1);

  section('   Noto’g’ri ma’lumot qabul qilinmaydi');
  eq('Ismsiz rad etildi', (await api('/api/lead', { method: 'POST', body: { name: '', phone: '+998901112233' } })).status, 400);
  eq('Telefonsiz rad etildi', (await api('/api/lead', { method: 'POST', body: { name: 'Kimdir', phone: '123' } })).status, 400);

  /* ================= 4. Ustozlar ================= */
  section('4. Ustozlar bo’limi');
  const pub2 = await api('/api/public');
  const tchs = pub2.json.teachers || [];
  ok('Ustozlar ro’yxati bor', tchs.length >= 5, String(tchs.length));
  ok('Ustoz Asmaa bor', tchs.some(t => /Asmaa/.test(t.name)), JSON.stringify(tchs.map(t => t.name)));
  ok('Ayol ustoz guruhi belgilangan', tchs.some(t => /Asmaa/.test(t.name) && t.audience === 'ayollar'));
  ok('Erkak ustozlar bor', tchs.filter(t => t.audience === 'erkaklar').length >= 3);
  ok('Ustoz ma’lumotida telefon/oylik yo’q',
    !tchs.some(t => t.phone || t.salaryAmount || t.payType), JSON.stringify(tchs[0] || {}));
  ok('Dars uzunligi berilgan', (pub2.json.lessonMinutes || 0) === 90, String(pub2.json.lessonMinutes));

  section('   Ustoz rasmi');
  // har safar yangi profil — sinov qayta-qayta ishlaydi
  const tId = R + '_t1';
  await api('/api/doc?path=' + encodeURIComponent('teachers/' + tId), {
    method: 'PUT', cookie: dir,
    body: { data: { id: tId, name: 'Ustoz Sinov ' + R, tag: 'Misrlik ustoz', audience: 'erkaklar', active: true, order: 90 } }
  });
  eq('Rasm yo’q — 404', (await api('/api/photo?id=' + tId)).status, 404);
  // 1x1 px JPEG
  const PX = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////' +
    '/////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const put = await api('/api/doc?path=' + encodeURIComponent('photos/' + tId), {
    method: 'PUT', cookie: dir, body: { data: { id: tId, data: PX } }
  });
  eq('Rasm saqlandi', put.status, 200);
  const ph = await fetch(API + '/api/photo?id=' + tId);
  eq('Rasm ochiladi', ph.status, 200);
  ok('Rasm turi to’g’ri', /image\//.test(ph.headers.get('content-type') || ''), ph.headers.get('content-type'));
  ok('Rasm keshlanadi', /max-age=\d+/.test(ph.headers.get('cache-control') || ''), ph.headers.get('cache-control'));
  eq('Begona rasm berilmaydi', (await api('/api/photo?id=meta')).status, 404);
  eq('Kirishsiz rasm yuklab bo’lmaydi',
    (await api('/api/doc?path=' + encodeURIComponent('photos/' + tId), { method: 'PUT', body: { data: { id: tId, data: PX } } })).status, 401);
  const bad = await api('/api/doc?path=' + encodeURIComponent('photos/' + tId), {
    method: 'PUT', cookie: dir, body: { data: { id: tId, data: 'javascript:alert(1)' } }
  });
  eq('Rasm bo’lmagan fayl rad etiladi', bad.status, 400);

  section('   Saytda ko’rinishi');
  await page.goto(BASE);
  await page.waitForSelector('.tch-grid', { timeout: 15000 });
  const tv = await page.evaluate(() => ({
    cards: document.querySelectorAll('.tch-card').length,
    text: document.body.innerText,
    slots: document.querySelectorAll('.slot').length
  }));
  ok('Ustoz kartalari ko’rinadi', tv.cards >= 5, String(tv.cards));
  ok('Ustoz ismlari bor', /Asmaa/.test(tv.text) && /Ahmad/.test(tv.text));
  ok('Misrlik ustoz yozuvi bor', /Misr/.test(tv.text));
  ok('Ayollar guruhi yozilgan', /Ayollar guruhlari/.test(tv.text));
  ok('Dars vaqtlari chiqdi', tv.slots >= 8, String(tv.slots));
  ok('Kechki dars bor', /20:00–21:30/.test(tv.text), (tv.text.match(/\d\d:\d\d–\d\d:\d\d/g) || []).join(' '));

  await page.evaluate(() => document.querySelector('.tch-card').click());
  await page.waitForSelector('.tch-page', { timeout: 10000 });
  const prof = await page.evaluate(() => ({
    hash: location.hash, text: document.body.innerText,
    times: document.querySelectorAll('.tch-page .slot').length
  }));
  ok('Ustoz profili ochildi', /ustoz\?id=/.test(prof.hash), prof.hash);
  ok('Profilda dars vaqtlari bor', prof.times >= 8, String(prof.times));
  ok('Profilda yozilish tugmasi bor', /yozilish/i.test(prof.text));
  await page.screenshot({ path: path.join(SHOTS, 'ustoz-profil.png'), fullPage: true });
  await page.goto(BASE);
  await page.waitForSelector('.site-hero', { timeout: 15000 });

  /* ================= 5. Telefon ko'rinishi ================= */
  section('5. Telefon ko’rinishi');
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE);
    await page.waitForSelector('.site-hero', { timeout: 15000 });
    const m = await page.evaluate(() => ({
      scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      loginBtn: Array.from(document.querySelectorAll('.site-top button')).some(b => /Kirish/.test(b.textContent)),
      form: !!document.querySelector('.lead-form')
    }));
    ok(w + ' px: yon siljish yo’q', m.scrollX <= 1, String(m.scrollX));
    ok(w + ' px: Kirish tugmasi ko’rinadi', m.loginBtn);
    ok(w + ' px: forma bor', m.form);
    if (w === 390) await page.screenshot({ path: path.join(SHOTS, 'sayt-390.png'), fullPage: true });
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nScreenshotlar: shots/sayt-1280.png, shots/sayt-390.png');
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: Telegram xabari soxta emas — bot tokeni yo’q, shuning uchun navbatga qo’yilishi alohida sinovda tekshiriladi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
