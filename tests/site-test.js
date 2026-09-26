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
        /* Ish vaqtini SINOVNING O'ZI yozadi — bazada nima turgani
           muhim emas. Kechki dars tekshiruvi shunga tayanadi.          */
        workStart: '08:00', workEnd: '22:00', lessonMinutes: 90, breakMinutes: 30,
        /* Aniq jadval BO'SH: bu bo'limda formula bo'yicha hisoblanishi
           tekshiriladi. Qo'lda yozilgani pastda alohida sinaladi.      */
        lessonTimes: '',
        bot: Object.assign({}, st.bot || {}, { username: 'AlBayan_cairobot', staffChats: '' })
      })
    }
  });
  await api('/api/doc?path=' + encodeURIComponent('courses/' + R + '_c1'), {
    method: 'PUT', cookie: dir,
    /* order: -5 — bazada boshqa kurslar bo'lsa ham SHU kurs birinchi
       turadi. Saytdagi asosiy narx birinchi kursdan olinadi, shuning
       uchun sinov o'zi ko'rsatadigan narxni o'zi belgilaydi.           */
    body: { data: { id: R + '_c1', name: 'Arab tili — boshlang’ich', monthlyFee: 450000, active: true, order: -5, note: 'A1 daraja, haftada 3 kun' } }
  });

  /* ================= 0. Javob siqilgan holda keladi =================
     Sekin internetda sahifa tez ochilishi uchun matnli javoblar
     siqiladi. Bu MAZMUNGA tegmaydi — brauzer o'zi ochadi va aynan
     o'sha matnni oladi, faqat tarmoqdagi bayt kamayadi.          */
  section('0. Javoblar siqilgan holda yuboriladi');
  {
    const http0 = require('http');
    const wire = (p, enc) => new Promise(resolve => {
      const r = http0.request({
        host: 'localhost', port: Number(PORT), path: p, method: 'GET',
        headers: { 'Accept-Encoding': enc }
      }, res => {
        let n = 0, chunks = [];
        res.on('data', c => { n += c.length; chunks.push(c); });
        res.on('end', () => resolve({
          bytes: n, enc: res.headers['content-encoding'] || '',
          vary: res.headers['vary'] || '', code: res.statusCode,
          buf: Buffer.concat(chunks)
        }));
      });
      r.on('error', () => resolve({ bytes: 0, enc: '', vary: '', code: 0, buf: Buffer.alloc(0) }));
      r.end();
    });
    const zlib0 = require('zlib');
    for (const p of ['/css/app.css', '/js/i18n.js', '/']) {
      const xom = await wire(p, 'identity');
      const siq = await wire(p, 'gzip');
      ok(p + ' siqilgan holda keldi (' + (siq.enc || 'yo’q') + ')', !!siq.enc, String(siq.code));
      ok(p + ' hajmi kamaydi (' + Math.round(xom.bytes / 1024) + 'KB → ' +
        Math.round(siq.bytes / 1024) + 'KB)', siq.bytes < xom.bytes * 0.6,
        xom.bytes + ' → ' + siq.bytes);
      ok(p + ' Vary sarlavhasi bor', /accept-encoding/i.test(siq.vary), siq.vary);
      /* ENG MUHIMI: ochilgandan keyin mazmun AYNAN o'sha bo'lishi kerak */
      if (siq.enc === 'gzip') {
        let same = false;
        try { same = zlib0.gunzipSync(siq.buf).equals(xom.buf); } catch (e) { same = false; }
        ok(p + ' ochilgandan keyin mazmun aynan o’sha', same);
      }
    }
    /* Siqishni qo'llab-quvvatlamaydigan eski mijoz ham ishlashi kerak */
    const eski = await wire('/css/app.css', 'identity');
    ok('Siqishsiz so’ragan mijoz ham javob oladi', eski.code === 200 && eski.bytes > 1000,
      eski.code + ' / ' + eski.bytes);
    ok('Unga Content-Encoding qo’yilmaydi', !eski.enc, eski.enc);
  }

  /* ================= 0b. Google Analytics =================
     Teg ochiq saytda ishlashi kerak, LEKIN ERP manzillari
     (o'quvchi raqami bor sahifalar) Google ga yuborilmasligi shart. */
  section('0b. Google Analytics — ochiq saytda ishlaydi, ERP manzili ketmaydi');
  {
    const gaPage = await api('/');
    ok('Teg <head> ichida', /googletagmanager\.com\/gtag\/js\?id=G-/.test(gaPage.text),
      gaPage.text.slice(0, 200));
    const headPart = gaPage.text.split('</head>')[0] || '';
    ok('Teg aynan <head> qismida', /googletagmanager/.test(headPart));
    ok('Bitta marta qo’yilgan',
      (gaPage.text.match(/googletagmanager\.com\/gtag\/js/g) || []).length === 1,
      String((gaPage.text.match(/googletagmanager\.com\/gtag\/js/g) || []).length));
    ok('Avtomatik sahifa yozuvi o’chirilgan', /send_page_view:\s*false/.test(gaPage.text));

  }

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
  /* Brauzerga HAR SAFAR boshqa IP beramiz: saytdagi ariza va izoh
     yo'llarida bir IP uchun kunlik chegara bor (toshqindan himoya).
     Aks holda sinov ikkinchi marta ishga tushganda o'sha chegaraga
     urilib, yolg'on xato berardi.                                  */
  const TEST_IP = '198.51.100.' + (2 + (Date.now() % 250));
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'X-Forwarded-For': TEST_IP }
  });
  const page = await ctx.newPage();

  /* ---- Google Analytics: brauzerda tekshirish ---- */
  section('0c. Google Analytics — brauzerda');
  {
    const hits = [];
    /* Brauzerda: Google ga qanday so'rov ketayotganini kuzatamiz */
    const gaPageObj = await ctx.newPage();
    await gaPageObj.route('**://*.googletagmanager.com/**', r => {
      hits.push(r.request().url());
      /* Haqiqiy Google ga chiqmaymiz — bo'sh javob beramiz */
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });
    await gaPageObj.route('**://*.google-analytics.com/**', r => {
      hits.push(r.request().url());
      return r.fulfill({ status: 204, body: '' });
    });
    await gaPageObj.goto(BASE);
    await gaPageObj.waitForTimeout(1200);
    const sent = await gaPageObj.evaluate(() =>
      (window.dataLayer || []).map(a => JSON.stringify(Array.from(a))).join(' | '));
    ok('Ochiq saytda yozuv yuborildi', /"event","page_view"/.test(sent), sent.slice(0, 200));
    ok('Yuborilgan manzilda hash yo’q', !/%23|#/.test(sent.replace(/#?\w+"/g, '')),
      sent.slice(0, 200));

    /* ERP ekraniga o'tamiz — yangi yozuv qo'shilmasligi kerak */
    const before = await gaPageObj.evaluate(() => (window.dataLayer || []).length);
    /* Faqat # o'zgarsa sahifa qayta yuklanmaydi — haqiqiy yuklash kerak */
    await gaPageObj.goto(BASE + '#student?id=st_maxfiy_123');
    await gaPageObj.reload({ waitUntil: 'domcontentloaded' });
    await gaPageObj.waitForTimeout(1500);
    const after = await gaPageObj.evaluate(() =>
      (window.dataLayer || []).map(a => JSON.stringify(Array.from(a))).join(' | '));
    ok('ERP manzilida o’quvchi raqami Google ga ketmadi',
      !/st_maxfiy_123/.test(after), after.slice(0, 250));
    /* DIQQAT: "send_page_view" ichida ham "page_view" bor — shuning
       uchun aynan HODISA nomi qidiriladi.                          */
    ok('ERP ekranida sahifa yozuvi yuborilmadi',
      (after.match(/"event","page_view"/g) || []).length === 0, after.slice(0, 250));
    await gaPageObj.close();
    out.push('    (Google ga haqiqiy so’rov yuborilmadi — sinovda ushlab qolindi: ' +
      hits.length + ' ta)');
  }

  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });

  section('2. Sayt ochiladi (kirish talab qilinmaydi)');
  await page.goto(BASE);
  await page.waitForSelector('.site-hero', { timeout: 20000 });
  const txt = await page.evaluate(() => document.body.innerText);
  ok('Markaz nomi ko’rinadi', /AlBayan/.test(txt), txt.slice(0, 120));
  ok('Markaz haqida matn ko’rinadi', /Misr uslubida/.test(txt), txt.slice(0, 300));
  ok('Logotip bor', await page.evaluate(() => !!document.querySelector('.site-brand img') && !!document.querySelector('.hero-art img')));
  /* Yangi tuzilish: KURS bitta, DARAJA oltita.
     Darajalar serverdan keladi (server/levels.js), narx esa markazning
     kurs kartochkasidan.                                               */
  await page.waitForSelector('.lvl', { timeout: 15000 });
  await page.waitForSelector('.price-card', { timeout: 15000 });
  const txt2 = await page.evaluate(() => document.body.innerText);
  eq('Oltita daraja kartasi', await page.evaluate(() => document.querySelectorAll('.lvl').length), 6);
  ok('Daraja kodlari ko’rinadi',
    /A1/.test(txt2) && /C2/.test(txt2), txt2.slice(0, 500));
  ok('Daraja izohi ko’rinadi', /Harflar, salomlashish/.test(txt2), txt2.slice(0, 900));
  ok('Bitta narx kartasi bor',
    (await page.evaluate(() => document.querySelectorAll('.price-card').length)) === 1);
  ok('Kurs nomi ko’rinadi', /boshlang/i.test(txt2), txt2.slice(0, 400));
  ok('Narx ko’rsatilgan', /450 000/.test(txt2), txt2.slice(0, 900));
  ok('Narx daraja bilan o’zgarmasligi yozilgan',
    /A1 ham, C2 ham bir xil/.test(txt2), txt2.slice(0, 1200));
  ok('Telefon va manzil bor', /200 70 07/.test(txt) && /Chilonzor/.test(txt));
  ok('Parol maydoni yo’q', !(await page.evaluate(() => !!document.getElementById('login-pass'))));

  /* Ishonch qatoridagi doiralar. Ular odam siluetiga o'xshashi kerak
     (harf emas), lekin HAQIQIY o'quvchining surati bo'lmasligi shart. */
  const proof = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll('.proof-dot'));
    return {
      soni: dots.length,
      svg: dots.filter(d => d.querySelector('svg.proof-person')).length,
      rasm: dots.filter(d => d.querySelector('img')).length,
      matn: dots.map(d => d.textContent.trim()).join(''),
      xil: new Set(dots.map(d => (d.querySelector('svg') || {}).innerHTML)).size
    };
  });
  eq('Ishonch qatorida uchta doira', proof.soni, 3);
  eq('Har birida chizilgan odam silueti', proof.svg, 3);
  eq('Haqiqiy odam surati qo’yilmagan', proof.rasm, 0);
  ok('Harf yozilmagan', proof.matn === '', proof.matn);
  ok('Siluetlar bir xil emas', proof.xil === 3, String(proof.xil));
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
  /* Forma namunaga moslandi: erkin "izoh" o'rniga daraja (chip) va
     qulay vaqt (ro'yxat) tanlanadi. */
  /* Markazda narx bitta, shuning uchun "Qaysi kurs" savoli YO'Q.
     Ariza kursga dasturning o'zi biriktiradi — quyida tekshiriladi.   */
  ok('«Qaysi kurs» savoli yo’q',
    !(await page.evaluate(() => !!document.getElementById('lead-course'))));
  ok('Bir nechta narx ro’yxati yo’q',
    (await page.evaluate(() => document.querySelectorAll('.tier-extra').length)) === 0);
  await page.selectOption('#lead-time', { index: 1 }).catch(() => { });
  const chipOk = await page.evaluate(() => {
    const c = document.querySelectorAll('.chip-row .chip');
    if (c.length < 3) return false;
    c[1].click();
    return c[1].classList.contains('on');
  });
  ok('Daraja tanlovi ishlaydi', chipOk);
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
  eq('Tanlangan daraja saqlandi', (mine || {}).startLevel, 'O’qiy olaman');
  ok('Qulay vaqt saqlandi', !!(mine || {}).wantTime, JSON.stringify((mine || {}).wantTime));
  ok('Izohda daraja va vaqt ko’rinadi',
    /Daraja:/.test((mine || {}).note || '') && /Qulay vaqt:/.test((mine || {}).note || ''),
    (mine || {}).note);
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
  const again = await api('/api/lead', { method: 'POST', ip: TEST_IP,
    body: { name: 'Sayt Mijoz ' + R, phone: PHONE } });
  ok('Takror deb belgilandi', again.json && again.json.duplicate === true, again.text);
  const leads2 = await api('/api/collection?name=leads', { cookie: dir });
  eq('Lead soni oshmadi',
    Object.values(leads2.json.items || {}).filter(l => (l.name || '').indexOf(R) >= 0).length, 1);

  /* --- Daraja kartasi → ariza formasi ---
     Karta bosilganda forma "B1 — O'rta" degan yorliq bilan to'ladi va
     ariza aynan shu KOD bilan ketadi. Kod ro'yxati serverda yopiq:
     mijoz o'z matnini yozib yubora olmaydi.                            */
  /* --- Markaz qo'lda yozgan jadval ---
     Haqiqiy jadval har doim ham formulaga tushavermaydi (masalan 08:30
     dan boshlanadi va 20:30 da tugaydi). Yozilgan bo'lsa, sayt AYNAN
     shuni ko'rsatishi kerak.                                           */
  section('   Qo’lda yozilgan dars vaqtlari');
  const st2 = (await api('/api/doc?path=' + encodeURIComponent('meta/settings'), { cookie: dir })).json.data;
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir,
    body: { data: Object.assign({}, st2, {
      lessonTimes: '08:30–10:00\n18:30–20:00\n20:30–22:00' }) }
  });
  const pubT = await api('/api/public');
  eq('/api/public jadvalni berdi', (pubT.json.lessonTimes || []).length, 3);
  await page.goto(BASE);
  await page.waitForSelector('#vaqt .slot', { timeout: 20000 });
  await page.waitForTimeout(600);
  const qoI = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#vaqt .slot b')).map(b => b.textContent.trim()));
  eq('Saytda aynan uchta vaqt', qoI.length, 3);
  ok('08:30–10:00 bor', qoI[0] === '08:30–10:00', qoI.join(' '));
  ok('18:30–20:00 bor', qoI[1] === '18:30–20:00', qoI.join(' '));
  ok('20:30–22:00 bor', qoI[2] === '20:30–22:00', qoI.join(' '));
  ok('Formula bo’yicha vaqt qo’shilmadi', qoI.indexOf('08:00–09:30') < 0, qoI.join(' '));
  /* Arizadagi "qulay vaqt" ro'yxati ham shu jadvaldan olinadi */
  const vaqtOpt = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#lead-time option')).map(o => o.textContent.trim()));
  ok('Formadagi vaqt ro’yxati ham shu jadvaldan',
    vaqtOpt.some(t => /20:30–22:00/.test(t)), vaqtOpt.join(' | '));
  /* Sinovning qolgan qismi uchun jadvalni qaytarib bo'shatamiz */
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir, body: { data: Object.assign({}, st2, { lessonTimes: '' }) }
  });

  section('   Daraja kartasidan ariza');
  const R2 = R + 'L';
  const PHONE2 = '+99890' + String(Date.now()).slice(-7);
  await page.goto(BASE);
  await page.waitForSelector('.lvl', { timeout: 20000 });
  await page.evaluate(() => document.querySelectorAll('.lvl')[2].click());
  await page.waitForTimeout(600);
  const pill = await page.evaluate(() => {
    const p = document.getElementById('lead-level-pill');
    return p && !p.hidden ? p.innerText : '';
  });
  ok('Yorliqda daraja ko’rindi', /B1/.test(pill) && /O’rta/.test(pill), JSON.stringify(pill));
  await page.fill('#lead-name', 'Daraja Mijoz ' + R2);
  await page.fill('#lead-phone', PHONE2);
  await page.click('.lead-form button[type=submit]');
  await page.waitForTimeout(1600);
  const leads3 = await api('/api/collection?name=leads', { cookie: dir });
  const mine2 = Object.values(leads3.json.items || {}).filter(l => (l.name || '').indexOf(R2) >= 0)[0];
  ok('Ariza yaratildi', !!mine2, JSON.stringify(Object.keys(leads3.json.items || {}).length));
  eq('Daraja kodi saqlandi', (mine2 || {}).startLevel, 'B1 — O’rta');
  ok('Izohga ham tushdi', /B1/.test((mine2 || {}).note || ''), (mine2 || {}).note);

  section('   Yopiq ro’yxat: o’zboshimcha daraja qabul qilinmaydi');
  const evilPhone = '+99890' + String(Date.now() + 7).slice(-7);
  const evil = await api('/api/lead', {
    /* Bir IP uchun kunlik ariza chegarasi bor — sinov o'z IP sidan yuboradi */
    method: 'POST', ip: TEST_IP,
    body: { name: 'Yopiq Sinov ' + R2, phone: evilPhone, startLevel: '<b>Professor</b>' }
  });
  eq('So’rov o’tdi (lekin daraja tozalandi)', evil.status, 200);
  const leads4 = await api('/api/collection?name=leads', { cookie: dir });
  const evilRec = Object.values(leads4.json.items || {}).filter(l => (l.name || '').indexOf('Yopiq Sinov') >= 0)[0];
  eq('O’zboshimcha daraja yozilmadi', (evilRec || {}).startLevel, '');
  ok('Izohda ham yo’q', !/Professor/.test((evilRec || {}).note || ''), (evilRec || {}).note);

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
  /* .tch-grid sahifa chizilishi bilan paydo bo'ladi, KARTALAR esa
     /api/public javobidan keyin. Faqat gridni kutsak, sekin bazada
     bo'sh ro'yxat o'lchanib, sinov yolg'on xato berardi.          */
  await page.waitForSelector('.tch-card', { timeout: 20000 });
  await page.waitForSelector('.slot', { timeout: 20000 }).catch(() => { });
  const tv = await page.evaluate(() => ({
    cards: document.querySelectorAll('.tch-card').length,
    text: document.body.innerText,
    slots: document.querySelectorAll('.slot').length
  }));
  ok('Ustoz kartalari ko’rinadi', tv.cards >= 5, String(tv.cards));
  ok('Ustoz ismlari bor', /Asmaa/.test(tv.text) && /Ahmad/.test(tv.text));
  /* Markaz rahbari so'radi: "Misrlik" emas, ARAB ustoz; kartada
     erkak/ayol guruhi yozilmaydi.                                      */
  ok('Kartada "Arab ustoz" yozuvi bor', /Arab ustoz/i.test(tv.text), tv.text.slice(0, 400));
  ok('Kartada erkak/ayol guruhi yozilmaydi',
    !/guruhlari/i.test(tv.text.split('Dars vaqtlari')[0] || ''), tv.text.slice(0, 500));
  ok('Dars vaqtlari chiqdi', tv.slots >= 6, String(tv.slots));
  ok('Kechki dars bor', /20:00–21:30/.test(tv.text), (tv.text.match(/\d\d:\d\d–\d\d:\d\d/g) || []).join(' '));
  /* Har darsdan keyin 30 daqiqa tanaffus: 08:00–09:30 dan keyin
     keyingisi 10:00 da boshlanadi, 09:30 da emas. Vaqtlarni JADVAL
     kartalaridan o'qiymiz — sahifadagi boshqa soatlar aralashmasin.   */
  const soat = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#vaqt .slot b')).map(b => b.textContent.trim()));
  ok('Birinchi dars 08:00–09:30', soat[0] === '08:00–09:30', soat.join(' '));
  ok('Keyingisi tanaffusdan keyin — 10:00', soat[1] === '10:00–11:30', soat.join(' '));
  ok('Tanaffus yozib qo’yilgan', /30 daqiqa tanaffus/.test(tv.text),
    (tv.text.match(/Har bir dars[^\n]*/) || [''])[0]);

  await page.evaluate(() => document.querySelector('.tch-card').click());
  await page.waitForSelector('.tch-page', { timeout: 10000 });
  const prof = await page.evaluate(() => ({
    hash: location.hash, text: document.body.innerText,
    times: document.querySelectorAll('.tch-page .slot').length
  }));
  ok('Ustoz profili ochildi', /ustoz\?id=/.test(prof.hash), prof.hash);
  ok('Profilda dars vaqtlari bor', prof.times >= 6, String(prof.times));
  ok('Profilda yozilish tugmasi bor', /yozilish/i.test(prof.text));
  await page.screenshot({ path: path.join(SHOTS, 'ustoz-profil.png'), fullPage: true });
  await page.goto(BASE);
  await page.waitForSelector('.site-hero', { timeout: 15000 });

  /* ================= 4b. Izohlar ================= */
  /* Qoida: saytda FAQAT markaz tasdiqlagan izoh turadi. Shuning uchun
     sinov avval izoh yozadi, uning saytga CHIQMAGANINI tekshiradi,
     keyin tasdiqlab, chiqqanini tekshiradi. Oxirida o'zi yozganini
     o'chiradi — demo baza ifloslanmasin.                             */
  section('4b. Izohlar (sharhlar)');
  await page.setViewportSize({ width: 1280, height: 900 });
  /* Avvalgi sinovdan qolgan izohlarni tozalaymiz. Aks holda bir IP dan
     kuniga 3 ta chegara (to'g'ri qoida) sinovning o'zini to'xtatib
     qo'yardi va tasma tekshiruvi ham noto'g'ri yo'ldan ketardi.      */
  {
    const old = await api('/api/collection?name=reviews', { cookie: dir });
    for (const r of Object.values((old.json || {}).items || {})) {
      if (r && /^Sinov /.test(String(r.name || ''))) {
        await api('/api/doc?path=' + encodeURIComponent('reviews/' + r.id), { method: 'DELETE', cookie: dir });
      }
    }
  }
  const revIds = [];
  const NAME1 = 'Sinov Izoh ' + R;
  const revBefore = await api('/api/public');
  const n0 = (revBefore.json.reviews || []).length;
  const post1 = await api('/api/review', {
    method: 'POST', ip: '203.0.113.' + (10 + (Date.now() % 40)),
    body: { name: NAME1, text: 'Darslar juda yaxshi o’tyapti, ustoz tushuntirib beradi.', rating: 5, about: 'B1 guruhi' }
  });
  eq('Izoh qabul qilindi', post1.status, 200);
  const all1 = await api('/api/collection?name=reviews', { cookie: dir });
  const revOne = Object.values((all1.json || {}).items || {}).filter(r => r && r.name === NAME1)[0];
  ok('Izoh bazaga tushdi', !!revOne, JSON.stringify(Object.keys((all1.json || {}).items || {})).slice(0, 120));
  if (revOne) revIds.push(revOne.id);
  eq('Holati "yangi" — tasdiqlanmagan', revOne && revOne.status, 'yangi');

  const pubA = await api('/api/public');
  eq('Tasdiqlanmagan izoh /api/public da yo’q', (pubA.json.reviews || []).length, n0);
  ok('Ismi ham chiqmaydi', !JSON.stringify(pubA.json.reviews || []).includes(NAME1));

  await page.goto(BASE);
  await page.waitForSelector('#rev-band', { timeout: 15000 });
  const v0 = await page.evaluate(() => ({
    text: document.body.innerText,
    band: !!document.querySelector('#rev-band:not([hidden])'),
    btns: Array.from(document.querySelectorAll('button')).filter(b => /Izoh qoldirish/.test(b.textContent)).length,
    /* Pastdagi to'liq ro'yxat olib tashlandi — izohlar faqat tasmada */
    pastki: document.querySelectorAll('#izohlar').length
  }));
  ok('Tasdiqlanmagan izoh saytda ko’rinmaydi', !v0.text.includes(NAME1));
  ok('"Izoh qoldirish" tugmasi bor', v0.btns >= 1, String(v0.btns));
  ok('Pastdagi ikkinchi izohlar bo’limi yo’q', v0.pastki === 0, String(v0.pastki));

  /* Markaz tasdiqlaydi */
  if (revOne) {
    const appr = await api('/api/doc?path=' + encodeURIComponent('reviews/' + revOne.id), {
      method: 'PUT', cookie: dir, body: { data: Object.assign({}, revOne, { status: 'ochiq' }) }
    });
    eq('Markaz izohni tasdiqladi', appr.status, 200);
  }
  const pubB = await api('/api/public');
  const shown = (pubB.json.reviews || []).filter(r => r.name === NAME1)[0];
  ok('Tasdiqlangandan keyin /api/public da chiqdi', !!shown, JSON.stringify(pubB.json.reviews || []).slice(0, 160));
  if (shown) {
    ok('Faqat kerakli maydonlar beriladi',
      Object.keys(shown).sort().join(',') === 'about,date,name,rating,text',
      Object.keys(shown).join(','));
    ok('IP manzil chiqmaydi', !('ip' in shown));
    eq('Baho saqlandi', shown.rating, 5);
  }

  await page.goto(BASE);
  await page.waitForSelector('#rev-track .rev-card', { timeout: 15000 });
  const v1 = await page.evaluate(() => ({
    text: document.body.innerText,
    band: !!document.querySelector('#rev-band:not([hidden])'),
    halves: document.querySelectorAll('#rev-track .rev-half').length,
    grid: document.querySelectorAll('#rev-track .rev-card').length,
    stars: document.querySelectorAll('#rev-track .rev-card .rev-star.on').length,
    top: !!Array.from(document.querySelectorAll('#rev-band button')).some(b => /Izoh qoldirish/.test(b.textContent))
  }));
  ok('Izoh saytda chiqdi', v1.text.includes(NAME1), v1.text.slice(0, 200));
  ok('Izoh kartalari chizildi', v1.grid >= 1, String(v1.grid));
  ok('Yulduzchalar ko’rinadi', v1.stars >= 1, String(v1.stars));
  /* Tasma BITTA tasdiqlangan izoh bilan ham ochiladi — markaz birinchi
     izohni tasdiqlashi bilan sayt tirik bo'lib qoladi.                 */
  ok('Bitta izoh bo’lsa ham tepadagi tasma ochiq', v1.band, 'band=' + v1.band);
  ok('Tasma uzluksiz yurishi uchun ro’yxat ikki marta qo’yilgan', v1.halves === 2, String(v1.halves));
  ok('Tasmada ham "Izoh qoldirish" tugmasi bor', v1.top);

  section('   Tasma aylanishi: chetlari xira, tezligi bir tekis');
  const mq = await page.evaluate(() => {
    const t = document.getElementById('rev-track');
    const m = document.getElementById('rev-marquee');
    const hv = t.querySelectorAll('.rev-half');
    const edge = m.querySelector('.rev-edge');
    const mask = document.querySelector('.rev-mask');
    return {
      halves: hv.length,
      halfW: hv[0] ? Math.round(hv[0].getBoundingClientRect().width) : 0,
      view: Math.round(m.getBoundingClientRect().width),
      dur: parseFloat(getComputedStyle(t).animationDuration) || 0,
      name: getComputedStyle(t).animationName,
      edges: m.querySelectorAll('.rev-edge').length,
      blur: edge ? (getComputedStyle(edge).backdropFilter || getComputedStyle(edge).webkitBackdropFilter || '') : '',
      mask: mask ? (getComputedStyle(mask).maskImage || getComputedStyle(mask).webkitMaskImage || '') : '',
      overflow: getComputedStyle(m).overflow
    };
  });
  ok('Tasma aylanadi (animatsiya ulangan)', /rev/i.test(mq.name || ''), mq.name);
  ok('Bitta yarim ekrandan keng — oraliqda bo’sh joy qolmaydi',
    mq.halfW >= mq.view, mq.halfW + ' < ' + mq.view);
  /* Tezlik kartalar soniga bog'liq emas: taxminan 62 piksel/soniya */
  const speed = mq.dur ? mq.halfW / mq.dur : 0;
  /* Tezlik izohlar soniga bog'liq bo'lmasligi kerak: kod uni har safar
     hisoblab qo'yadi (~62 px/s). CSS dagi qat'iy vaqt bilan bu chegaraga
     tushmaydi — shuning uchun chegara tor.                             */
  ok('Tezlik bir tekis (' + Math.round(speed) + ' px/s)', speed >= 52 && speed <= 75,
    JSON.stringify(mq));
  ok('Chetlarda ikkita xira qatlam bor', mq.edges === 2, String(mq.edges));
  ok('Chetdagi qatlam xiralashtiradi (blur)', /blur\(/.test(mq.blur), mq.blur);
  ok('Karta chetda asta-sekin yo’qoladi (mask)', /gradient/.test(mq.mask), mq.mask.slice(0, 60));
  ok('Tasmadan tashqarisi ko’rinmaydi', mq.overflow === 'hidden', mq.overflow);

  section('   Tasma birinchi blokdan keyin darrov turadi');
  const order = await page.evaluate(() => {
    const hero = document.querySelector('.site-hero');
    const band = document.getElementById('rev-band');
    const stat = document.getElementById('stat-band');
    const y = e => e ? Math.round(e.getBoundingClientRect().top + window.scrollY) : null;
    return { hero: y(hero), band: y(band), stat: y(stat), statHidden: stat ? stat.hidden : null };
  });
  ok('Tasma hero blokdan keyin', order.band > order.hero, JSON.stringify(order));
  ok('Tasma ko’rsatkichlar tasmasidan oldin',
    order.stat === null || order.statHidden || order.band < order.stat, JSON.stringify(order));

  section('   Saytdan izoh yozish oynasi');
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).filter(x => /Izoh qoldirish/.test(x.textContent)).pop();
    b.click();
  });
  await page.waitForSelector('.modal .rev-pick', { timeout: 10000 });
  const NAME2 = 'Sinov Oyna ' + R;
  await page.fill('#rev-name', NAME2);
  await page.fill('#rev-text', 'Guruhda hamma gapiradi, ustoz xatoni darrov tuzatadi.');
  await page.evaluate(() => document.querySelectorAll('.rev-pick .rev-pick-b')[3].click());
  const picked = await page.evaluate(() => document.querySelectorAll('.rev-pick .rev-pick-b.on').length);
  eq('4 yulduz tanlandi', picked, 4);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.modal button')).filter(x => /Yuborish/.test(x.textContent))[0];
    b.click();
  });
  await page.waitForTimeout(1200);
  const all2 = await api('/api/collection?name=reviews', { cookie: dir });
  const revUi = Object.values((all2.json || {}).items || {}).filter(r => r && r.name === NAME2)[0];
  ok('Oynadan yozilgan izoh bazaga tushdi', !!revUi, NAME2);
  if (revUi) revIds.push(revUi.id);
  eq('U ham avval tasdiqlanadi', revUi && revUi.status, 'yangi');
  eq('Tanlangan baho saqlandi', revUi && revUi.rating, 4);
  const pubC = await api('/api/public');
  ok('Yangi izoh darrov saytga chiqmaydi',
    !JSON.stringify(pubC.json.reviews || []).includes(NAME2));

  section('   Noto’g’ri izoh qabul qilinmaydi');
  const ipBad = '203.0.113.' + (60 + (Date.now() % 30));
  eq('Ismsiz izoh rad etiladi',
    (await api('/api/review', { method: 'POST', ip: ipBad, body: { name: '', text: 'Juda yaxshi markaz ekan.', rating: 5 } })).status, 400);
  eq('Juda qisqa izoh rad etiladi',
    (await api('/api/review', { method: 'POST', ip: ipBad, body: { name: 'Sinov', text: 'zo’r', rating: 5 } })).status, 400);
  eq('Bahosiz izoh rad etiladi',
    (await api('/api/review', { method: 'POST', ip: ipBad, body: { name: 'Sinov', text: 'Darslar yaxshi o’tyapti.', rating: 0 } })).status, 400);

  /* Sinov yozganlarini o'chiramiz */
  for (const id of revIds) {
    await api('/api/doc?path=' + encodeURIComponent('reviews/' + id), { method: 'DELETE', cookie: dir });
  }
  const pubZ = await api('/api/public');
  ok('Sinov izohlari tozalandi',
    !JSON.stringify(pubZ.json.reviews || []).includes(NAME1), 'tozalanmadi');

  /* ================= 4c. Ijtimoiy tarmoq tugmalari ================= */
  /* Telegram va Instagram logotiplari — o'sha xizmatlarning rasmiy
     belgilari. Tugmalar sozlamadagi manzillardan tuziladi: bo'sh
     qolgan manzil saytda ham chiqmaydi.                             */
  section('4c. Ijtimoiy tarmoq tugmalari');
  await page.setViewportSize({ width: 1280, height: 900 });
  const socSt = (await api('/api/doc?path=' + encodeURIComponent('meta/settings'), { cookie: dir })).json.data;
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir,
    body: {
      data: Object.assign({}, socSt, {
        tgChannel: '@albayanuz',
        instagram: 'https://www.instagram.com/albayan.cairo/',
        telegram: 'AlBayan_cairobot',
        tgQabul: '@Albayan_qabul1', tgQabulLabel: 'Taxtapul filiali',
        tgQabul2: '@albayantinchlik', tgQabulLabel2: 'Tinchlik filiali',
        youtube: ''
      })
    }
  });
  await page.goto(BASE);
  await page.waitForSelector('#foot-soc .soc-btn', { timeout: 15000 });
  await page.evaluate(() => document.getElementById('foot-soc').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  const soc = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#foot-soc .soc-btn'));
    return b.map(x => {
      const img = x.querySelector('img.soc-logo');
      const r = img ? img.getBoundingClientRect() : null;
      return {
        name: (x.querySelector('b') || {}).textContent || '',
        sub: (x.querySelector('.soc-txt span') || {}).textContent || '',
        href: x.getAttribute('href'),
        logo: img ? img.getAttribute('src') : '',
        loaded: img ? img.naturalWidth > 0 : false,
        w: r ? Math.round(r.width) : 0,
        target: x.getAttribute('target'), rel: x.getAttribute('rel')
      };
    });
  });
  eq('Beshta tugma bor', soc.length, 5);
  ok('Tartibi: kanal, Instagram, bot, ikkita qabul',
    soc.map(x => x.name).join(',') === 'Telegram kanal,Instagram,Telegram bot,Qabul,Qabul',
    soc.map(x => x.name).join(','));
  ok('Ikkinchi filial qo’shildi',
    soc[3].sub === 'Taxtapul filiali' && soc[4].sub === 'Tinchlik filiali',
    soc[3].sub + ' | ' + soc[4].sub);
  ok('Ikkinchi qabul manzili to’g’ri', /albayantinchlik$/.test(soc[4].href), soc[4].href);
  ok('Har bir tugmada rasmli logotip bor',
    soc.every(x => /logo-(telegram|instagram)\.png$/.test(x.logo)), JSON.stringify(soc.map(x => x.logo)));
  ok('Instagram logotipi Instagram tugmasida',
    /logo-instagram/.test(soc[1].logo), soc[1].logo);
  ok('Qolganlari Telegram logotipi',
    [0, 2, 3, 4].every(i => /logo-telegram/.test(soc[i].logo)), JSON.stringify(soc.map(x => x.logo)));
  ok('Logotiplar haqiqatan yuklandi', soc.every(x => x.loaded), JSON.stringify(soc.map(x => x.loaded)));
  /* Tugmalar ixcham yorliq ko'rinishida — logotip 26 px atrofida,
     lekin baribir aniq ko'rinadigan o'lchamda turishi kerak.      */
  ok('Logotip ko’rinadigan o’lchamda (≥ 22px)', soc.every(x => x.w >= 22),
    JSON.stringify(soc.map(x => x.w)));
  ok('Havolalar yangi oynada va xavfsiz ochiladi',
    soc.every(x => x.target === '_blank' && /noopener/.test(x.rel || '')),
    JSON.stringify(soc.map(x => x.target + '/' + x.rel)));
  /* Logotip fayllari serverdan ham beriladi */
  for (const f of ['/assets/logo-telegram.png', '/assets/logo-instagram.png']) {
    const r = await fetch(API + f);
    ok('Serverdan ochiladi: ' + f + ' (' + r.status + ')',
      r.status === 200 && /image\/png/.test(r.headers.get('content-type') || ''),
      r.status + ' ' + r.headers.get('content-type'));
  }
  section('   Bo’sh qolgan manzil saytda chiqmaydi');
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir,
    /* Telegram bot manzili bot sozlamasidan olinadi — uni ham bo'shatamiz */
    body: {
      data: Object.assign({}, socSt, {
        tgChannel: '@albayanuz', instagram: '', tgQabul: '', tgQabul2: '', youtube: '',
        bot: Object.assign({}, socSt.bot || {}, { username: '' })
      })
    }
  });
  await page.goto(BASE);
  await page.waitForSelector('#foot-soc', { timeout: 15000 });
  await page.waitForTimeout(900);
  const soc2 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#foot-soc .soc-btn')).map(x => (x.querySelector('b') || {}).textContent));
  ok('Faqat to’ldirilgani chiqdi', soc2.length === 1 && soc2[0] === 'Telegram kanal', soc2.join(','));
  /* Sozlamani joyiga qaytaramiz */
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir, body: { data: socSt }
  });

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

    /* Pastdagi doimiy tasma: hero'dagi tugma ko'rinib turganda yopiq,
       pastga tushgach chiqadi. Odam qayerda bo'lsa ham bir bosishda
       ariza qoldiradi yoki qo'ng'iroq qiladi.                        */
    const barTop = await page.evaluate(() => {
      const b = document.getElementById('cta-bar');
      return b ? b.classList.contains('on') : null;
    });
    ok(w + ' px: tepada pastki tasma chiqmaydi', barTop === false, String(barTop));
    await page.evaluate(() => window.scrollTo(0, 2200));
    /* Tasma surish paytida chiqadi — sahifa to'liq yuklanib bo'lguncha
       biroz kutamiz (rasm va izohlar kelgach balandlik o'zgaradi). */
    await page.waitForFunction(
      () => document.getElementById('cta-bar').classList.contains('on'),
      null, { timeout: 5000 }
    ).catch(() => { });
    const bar = await page.evaluate(() => {
      const b = document.getElementById('cta-bar');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const tel = document.getElementById('cta-bar-tel');
      const go = b.querySelector('.cta-bar-go');
      return {
        on: b.classList.contains('on'),
        h: Math.round(r.height),
        bottom: Math.round(window.innerHeight - r.bottom),
        tel: tel ? tel.getAttribute('href') : '',
        telH: tel ? Math.round(tel.getBoundingClientRect().height) : 0,
        goH: go ? Math.round(go.getBoundingClientRect().height) : 0,
        goText: go ? go.textContent.trim() : ''
      };
    });
    ok(w + ' px: pastga tushganda tasma chiqdi', bar && bar.on, JSON.stringify(bar));
    ok(w + ' px: qo’ng’iroq tugmasi haqiqiy raqamga ulangan',
      bar && /^tel:\+?\d{7,}$/.test(bar.tel), bar && bar.tel);
    ok(w + ' px: tasmadagi tugmalar ≥ 48px',
      bar && bar.telH >= 48 && bar.goH >= 48, JSON.stringify(bar));
    ok(w + ' px: tasma ekran pastiga yopishgan', bar && bar.bottom <= 1, String(bar && bar.bottom));
    ok(w + ' px: yozuv "Darsga yozilish"', bar && /Darsga yozilish/.test(bar.goText), bar && bar.goText);

    /* Tasma sahifaning oxirini yopib qo'ymaydi */
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    const covered = await page.evaluate(() => {
      const b = document.getElementById('cta-bar');
      const f = document.querySelector('.site-foot');
      if (!b || !f) return null;
      const br = b.getBoundingClientRect(), fr = f.getBoundingClientRect();
      return Math.round(fr.bottom - br.top);   // musbat bo'lsa ustiga tushgan
    });
    ok(w + ' px: pastki yozuvlar tasma ostida qolmadi', covered !== null && covered <= 0,
      String(covered));
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nScreenshotlar: shots/sayt-1280.png, shots/sayt-390.png');
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: Telegram xabari soxta emas — bot tokeni yo’q, shuning uchun navbatga qo’yilishi alohida sinovda tekshiriladi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
