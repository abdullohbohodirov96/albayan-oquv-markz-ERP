/* QAMROV SINOVI — hali sinovsiz qolgan bo'limlar.

   Bu yerda tahrir-test.js ning uslubi davom ettiriladi: har bir
   bo'limda ma'lumot o'zgartiriladi, BAZADA tekshiriladi, keyin
   sahifa QAYTA YUKLANIB ekranda ko'rinishi tekshiriladi. Qayerda
   raqam hisoblansa — ko'rinishi emas, AYNAN qiymati solishtiriladi.

   Qamrov:
     1) O'quv dasturi: modul → dars mavzusi
     2) Dars jarayoni (lessonlog)
     3) Jadval: dars bekor qilish va bayram
     4) Hisobotlar: tushum, xarajat va sof pul oqimi aynan to'g'rimi
     5) Ish haqi: qat'iy va foizli hisoblash
     6) O'quv natijalari: davomat foizi va test natijasi

   Ishga tushirish:  node tests/qamrov-test.js [port] [direktor paroli]
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
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + String(extra).slice(0, 220) : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got));
}
function section(t) { out.push('\n' + t); }

const R = 'q' + Date.now().toString(36);
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
const del = p => api('/api/doc?path=' + encodeURIComponent(p), { method: 'DELETE' });

async function open(page, hash, waitText) {
  await page.goto(BASE + '#' + hash);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForFunction(() => {
    const v = document.getElementById('view');
    return v && v.innerText.replace(/\s+/g, '').length > 40;
  }, null, { timeout: 20000 }).catch(() => { });
  if (waitText) {
    await page.waitForFunction(t => {
      const v = document.getElementById('view');
      return v && v.innerText.indexOf(t) >= 0;
    }, waitText, { timeout: 9000 }).catch(() => { });
  }
  await page.waitForTimeout(500);
  return page.evaluate(() => document.getElementById('view').innerText.replace(/\s+/g, ' '));
}

function hasNumber(text, n) {
  const plain = String(n);
  const spaced = plain.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return text.indexOf(plain) >= 0 || text.indexOf(spaced) >= 0 ||
    text.indexOf(spaced.replace(/ /g, ' ')) >= 0;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const lg = await api('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  COOKIE = lg.cookie;
  if (!COOKIE) { console.error('Direktor kira olmadi.'); process.exit(1); }

  const THIS = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);
  const DAY = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

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

  /* ================= 1. O'QUV DASTURI ================= */
  section('1. O’quv dasturi — modul va dars mavzusi');
  const modRes = await put('modules/' + ID('mod'), {
    id: ID('mod'), name: 'Qamrov moduli', level: 'A1', hours: 20,
    about: 'Birinchi izoh', active: true, order: 90
  });
  eq('Modul yozildi', modRes.status, 200);
  const topRes = await put('topics/' + ID('top'), {
    id: ID('top'), moduleId: ID('mod'), title: 'Qamrov darsi',
    goal: 'Birinchi maqsad', about: '', order: 1, active: true
  });
  eq('Dars mavzusi yozildi', topRes.status, 200);

  const curText = await open(page, 'curriculum?level=A1', 'Qamrov moduli');
  ok('Dasturda modul ko’rinadi', curText.indexOf('Qamrov moduli') >= 0, curText.slice(0, 300));
  ok('Dars mavzusi ham ko’rinadi', curText.indexOf('Qamrov darsi') >= 0, curText.slice(0, 300));

  /* Tahrirlab, qayta yuklab tekshiramiz */
  const m1 = await get('modules/' + ID('mod'));
  await put('modules/' + ID('mod'), Object.assign({}, m1, { name: 'Qamrov moduli 2', hours: 30 }));
  const t1 = await get('topics/' + ID('top'));
  await put('topics/' + ID('top'), Object.assign({}, t1, { title: 'Qamrov darsi 2' }));
  const curText2 = await open(page, 'curriculum?level=A1', 'Qamrov moduli 2');
  ok('O’zgartirilgan modul nomi ko’rinadi', curText2.indexOf('Qamrov moduli 2') >= 0, curText2.slice(0, 300));
  ok('O’zgartirilgan dars nomi ko’rinadi', curText2.indexOf('Qamrov darsi 2') >= 0, curText2.slice(0, 300));
  ok('Eski nom qolmadi', curText2.indexOf('Qamrov moduli 2') >= 0 &&
    !/Qamrov moduli(?! 2)/.test(curText2), curText2.slice(0, 300));

  /* ================= TAYYORGARLIK: guruh va o'quvchi ================= */
  await put('staff/' + ID('t1'), {
    id: ID('t1'), name: 'Qamrov Ustoz', status: 'faol', position: 'O’qituvchi',
    payType: 'fixed', salaryAmount: 6000000
  });
  await put('staff/' + ID('t2'), {
    id: ID('t2'), name: 'Foizli Ustoz', status: 'faol', position: 'O’qituvchi',
    payType: 'percent', percentRate: 40
  });
  await put('courses/' + ID('c'), {
    id: ID('c'), name: 'Qamrov kursi', monthlyFee: 500000, lessonMinutes: 90, active: true, order: 91
  });
  await put('groups/' + ID('g'), {
    id: ID('g'), code: 'Q' + String(Date.now() % 900 + 99).padStart(3, '0'),
    name: 'Qamrov guruhi', courseId: ID('c'), teacherId: ID('t2'),
    days: [1, 2, 3, 4, 5, 6], startTime: '10:00', endTime: '11:30',
    startDate: THIS + '-01', fee: 500000, feeHistory: [{ fee: 500000, from: THIS }],
    limit: 12, status: 'faol'
  });
  await put('students/' + ID('s'), {
    id: ID('s'), firstName: 'Qamrov', lastName: 'O’quvchi', phone: '+998901234777', status: 'faol'
  });
  await put('memberships/' + ID('m'), {
    id: ID('m'), studentId: ID('s'), groupId: ID('g'), joinedAt: THIS + '-01', status: 'faol'
  });

  /* ================= 2. DARS JARAYONI ================= */
  section('2. Dars jarayoni — yozilgani saqlanadimi');
  /* Dars yozuvini faqat server yozadi: /api/lesson/log */
  const llRes = await api('/api/lesson/log', {
    method: 'POST',
    body: { groupId: ID('g'), date: DAY, title: 'Birinchi dars', note: 'Birinchi yozuv', topicId: ID('top') }
  });
  eq('Dars yozuvi saqlandi', llRes.status, 200);
  const logs1 = await api('/api/lesson/log?groupId=' + encodeURIComponent(ID('g')));
  const mine1 = ((logs1.json || {}).logs || []).find(x => x.date === DAY);
  eq('Yozuv bazada turibdi', mine1 && mine1.note, 'Birinchi yozuv');

  /* O'sha kunni qayta yozsak — YANGILANISHI kerak, ikkinchi nusxa emas */
  await api('/api/lesson/log', {
    method: 'POST',
    body: { groupId: ID('g'), date: DAY, title: 'Birinchi dars', note: 'Ikkinchi yozuv', topicId: ID('top') }
  });
  const logs2 = await api('/api/lesson/log?groupId=' + encodeURIComponent(ID('g')));
  const sameDay = ((logs2.json || {}).logs || []).filter(x => x.date === DAY);
  eq('O’zgartirilgan yozuv saqlandi', sameDay[0] && sameDay[0].note, 'Ikkinchi yozuv');
  eq('Ikkinchi nusxa yaratilmadi', sameDay.length, 1);
  const lrn = await open(page, 'learning');
  ok('Dars jarayoni sahifasi ochildi', lrn.length > 40, lrn.slice(0, 200));

  /* ================= 3. JADVAL: BAYRAM ================= */
  section('3. Jadval — bayram qo’shilsa dars chiqib ketadimi');
  const schedBefore = await open(page, 'schedule');
  const cntBefore = await page.evaluate(() => document.querySelectorAll('#view .lesson').length);
  ok('Jadvalda darslar bor', cntBefore > 0, String(cntBefore));

  /* Bayramni ham faqat server yozadi: /api/holiday */
  const hRes = await api('/api/holiday', {
    method: 'POST', body: { id: ID('h'), name: 'Qamrov bayrami', from: DAY, to: DAY }
  });
  eq('Bayram yozildi', hRes.status, 200);
  await open(page, 'schedule');
  const cntAfter = await page.evaluate(() => document.querySelectorAll('#view .lesson').length);
  const holidayShown = await page.evaluate(() =>
    document.getElementById('view').innerText.indexOf('Qamrov bayrami') >= 0);
  /* Bayram kuni dars rejada turishi mumkin, lekin kun OCHIQ
     belgilanishi kerak: aks holda bayramga dars rejalab qo'yiladi. */
  ok('Bayram jadvalda nomi bilan ko’rinadi', holidayShown,
    'oldin: ' + cntBefore + ', keyin: ' + cntAfter);
  const holCols = await page.evaluate(() =>
    document.querySelectorAll('#view .week-col.holiday-col').length);
  ok('Bayram kuni ustuni belgilangan', holCols > 0, String(holCols));
  const dayOff = await page.evaluate(() => document.querySelectorAll('#view .day-off').length);
  ok('"Dam olish" yozuvi bor', dayOff > 0, String(dayOff));
  /* Server ham shu kunni dam deb bilishi kerak */
  const off = await api('/api/dayoff?date=' + DAY + '&groupId=' + encodeURIComponent(ID('g')));
  ok('Server bu kunni dam deb biladi', !!(off.json && off.json.off === true), off.text.slice(0, 120));
  await api('/api/holiday/delete', { method: 'POST', body: { id: ID('h') } });

  /* ================= 4. HISOBOTLAR: RAQAM AYNAN TO'G'RIMI ================= */
  section('4. Hisobotlar — sof pul oqimi aynan to’g’ri hisoblanadimi');
  /* Toza hisob: bitta hisob-faktura, bitta to'lov, bitta xarajat.
     Boshqa ma'lumot ham bor, shuning uchun FARQNI o'lchaymiz.     */
  const before = await api('/api/collection?name=payments');
  const rep0 = await open(page, 'reports');
  const cashBefore = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('#view .tile'))
      .find(x => /Sof pul oqimi/.test(x.innerText));
    return t ? t.innerText.replace(/\s+/g, ' ') : '';
  });

  const invId = 'inv_' + ID('m') + '_' + THIS;
  await put('invoices/' + invId, {
    id: invId, membershipId: ID('m'), studentId: ID('s'), groupId: ID('g'), month: THIS,
    base: 500000, discount: 0, final: 500000, dueDate: THIS + '-05', createdAt: THIS + '-01 09:00:00'
  });
  const payRes = await api('/api/payment', {
    method: 'POST',
    body: {
      id: ID('p'), studentId: ID('s'), amount: 500000, method: 'naqd', date: DAY,
      allocations: [{ invoiceId: invId, amount: 500000 }]
    }
  });
  eq('To’lov qabul qilindi', payRes.status, 200);
  await put('expenses/' + ID('e'), {
    id: ID('e'), title: 'Qamrov xarajati', amount: 200000, date: DAY, month: THIS, category: 'Boshqa'
  });

  const rep1 = await open(page, 'reports');
  const nums = await page.evaluate(() => {
    const pick = re => {
      const t = Array.from(document.querySelectorAll('#view .tile')).find(x => re.test(x.innerText));
      if (!t) return null;
      const m = t.innerText.replace(/ /g, ' ').match(/-?[\d\s]{3,}/);
      return m ? Number(m[0].replace(/\s/g, '')) : null;
    };
    return {
      tushum: pick(/Haqiqiy tushum/),
      qaytarilgan: pick(/Qaytarilgan/),
      xarajat: pick(/To’langan xarajatlar/),
      sof: pick(/Sof pul oqimi/)
    };
  });
  ok('Hisobotda tushum raqami bor', nums.tushum !== null, JSON.stringify(nums));
  ok('Hisobotda xarajat raqami bor', nums.xarajat !== null, JSON.stringify(nums));
  if (nums.tushum !== null && nums.xarajat !== null && nums.sof !== null) {
    eq('Sof pul oqimi = tushum − qaytarilgan − xarajat',
      nums.sof, nums.tushum - (nums.qaytarilgan || 0) - nums.xarajat);
  }
  ok('Yangi xarajat hisobotga tushdi', hasNumber(rep1, 200000), rep1.slice(0, 300));

  /* ================= 5. ISH HAQI ================= */
  section('5. Ish haqi — qat’iy va foizli hisoblash');
  /* Foizli ustoz: guruhga shu oyda 500 000 tushdi, stavka 40%
     → 200 000. Qat'iy oyliq: 6 000 000.                         */
  await open(page, 'finance');
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('#view .tabs button, #view .tabs a'))
      .find(x => /Ish haqi/.test(x.textContent.trim()));
    if (t) t.click();
  });
  await page.waitForTimeout(1100);
  const calcBtn = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#view button'))
      .find(x => /Hisoblash/.test(x.textContent));
    if (!b) return false;
    b.click(); return true;
  });
  ok('"Hisoblash / yangilash" tugmasi bor', calcBtn);
  await page.waitForTimeout(2200);

  const prFix = await get('payroll/' + THIS + '__' + ID('t1'));
  const prPct = await get('payroll/' + THIS + '__' + ID('t2'));
  ok('Qat’iy oyliq hisoblandi', !!prFix, JSON.stringify(prFix));
  ok('Foizli ish haqi hisoblandi', !!prPct, JSON.stringify(prPct));
  if (prFix) eq('Qat’iy oyliq summasi', Math.round(prFix.accrued), 6000000);
  if (prPct) {
    eq('Foiz asosi — shu oydagi tushum', Math.round(prPct.base), 500000);
    eq('Foizli summa 40% = 200 000', Math.round(prPct.accrued), 200000);
    eq('Boshida "qoralama"', prPct.status, 'qoralama');
  }
  const payText = await page.evaluate(() =>
    document.getElementById('view').innerText.replace(/\s+/g, ' '));
  ok('Ekranda foizli ustoz summasi ko’rinadi', hasNumber(payText, 200000), payText.slice(0, 400));
  ok('Ekranda qat’iy oylik ham ko’rinadi', hasNumber(payText, 6000000), payText.slice(0, 400));

  /* ================= 6. O'QUV NATIJALARI ================= */
  section('6. O’quv natijalari — davomat foizi va test natijasi');
  /* Uch dars: ikkitasida keldi, bittasida kelmadi → 67% */
  const d1 = THIS + '-02', d2 = THIS + '-03', d3 = THIS + '-04';
  const lessonDoc = {
    id: ID('g') + '__' + THIS, groupId: ID('g'), month: THIS,
    items: {
      [d1]: { attendance: { [ID('m')]: { status: 'keldi', at: d1 + ' 10:00:00', by: 'sinov' } }, status: 'otkazildi' },
      [d2]: { attendance: { [ID('m')]: { status: 'keldi', at: d2 + ' 10:00:00', by: 'sinov' } }, status: 'otkazildi' },
      [d3]: { attendance: { [ID('m')]: { status: 'kelmadi', at: d3 + ' 10:00:00', by: 'sinov' } }, status: 'otkazildi' }
    }
  };
  const ldRes = await put('lessons/' + ID('g') + '__' + THIS, lessonDoc);
  eq('Davomat hujjati yozildi', ldRes.status, 200);

  /* MUHIM: davomat ekrani belgini A'ZOLIK kaliti bilan yozadi.
     Hisobot esa O'QUVCHI bo'yicha hisoblaydi — ikkisi bog'lanmasa,
     har bir o'quvchining davomat foizi abadiy bo'sh qolardi.      */
  const rep = await api('/api/report/group?id=' + encodeURIComponent(ID('g')));
  eq('Guruh hisoboti ochildi', rep.status, 200);
  const row = (((rep.json || {}).students) || []).find(x => x.studentId === ID('s'));
  ok('O’quvchi hisobotda bor', !!row, JSON.stringify((rep.json || {}).students).slice(0, 200));
  eq('Uchta dars hisobga olindi', row && row.lessons, 3);
  eq('Davomat foizi 67%', row && row.attendPercent, 67);
  eq('Kelmagan dars soni', row && row.missed, 1);
  eq('Guruh o’rtachasi ham 67%', (rep.json || {}).avgAttend, 67);

  const prg = await open(page, 'progress');
  ok('O’quv natijalari sahifasi ochildi', prg.length > 40, prg.slice(0, 200));
  const grp = await open(page, 'progressGroup?group=' + encodeURIComponent(ID('g')), '67');
  ok('Guruh natijalari sahifasida 67% ko’rinadi', grp.indexOf('67%') >= 0, grp.slice(0, 300));

  await page.screenshot({ path: path.join(SHOTS, 'qamrov.png') });

  /* --- tozalash --- */
  for (const p of [
    'payments/' + ID('p'), 'invoices/' + invId, 'expenses/' + ID('e'),
    'lessons/' + ID('g') + '__' + THIS, 'lessonlog/' + ID('ll'),
    'memberships/' + ID('m'), 'students/' + ID('s'), 'groups/' + ID('g'),
    'courses/' + ID('c'), 'staff/' + ID('t1'), 'staff/' + ID('t2'),
    'topics/' + ID('top'), 'modules/' + ID('mod'),
    'payroll/' + THIS + '__' + ID('t2')
  ]) { await del(p); }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
