/* HISOB-KITOB SINOVI — markaz rahbari so'ragan uchta o'zgarish.

   1) O'quvchi kodi 5 xonali bo'ldi (eski 4 xonali kodlar ishlaydi);
   2) Har o'quvchining O'Z to'lov kuni — guruhga qo'shilgan kunidan;
   3) Sababli qoldirilgan dars uchun pul olinmaydi: bir dars narxi
      (oylik ÷ oyiga dars soni) keyingi oy hisobidan chegiriladi.

   Har bir tekshiruvda RAQAM aynan solishtiriladi — "taxminan"
   emas. Pul masalasida taxmin yaramaydi.

   Ishga tushirish:  node tests/hisob-test.js [port] [direktor paroli]
   PRODUCTION BAZAGA TEGMAYDI — alohida sinov serveri kerak.          */
'use strict';
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const API = 'http://localhost:' + PORT;

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

const R = 'h' + Date.now().toString(36);
const ID = n => R + '_' + n;
let COOKIE = '';

async function api(p, opts = {}) {
  const res = await fetch(API + p, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      COOKIE ? { Cookie: COOKIE } : {}, opts.headers || {}),
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

/* Oy nomlari serverdagi bilan bir xil bo'lsin deb ilovaning
   o'z hisob-kitobini ishlatamiz — ikki joyda takrorlamaymiz. */
require('../server/shared');
const A = globalThis.A;

(async () => {
  const lg = await api('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  COOKIE = lg.cookie;
  if (!COOKIE) { console.error('Direktor kira olmadi.'); process.exit(1); }

  /* Sinov oyi: KELASI oy. Shunda o'tgan oy = joriy oy bo'ladi va
     davomatni bemalol yozamiz; mavjud hisoblarga tegilmaydi.      */
  const YM = A.addMonths(A.thisMonth(), 1);
  const PREV = A.thisMonth();
  const FEE = 880000;

  /* =============== 0. Tayyorgarlik =============== */
  section('0. Sinov guruhi va o’quvchilari');
  await put('courses/' + ID('c'), {
    id: ID('c'), name: 'Hisob kursi ' + R, monthlyFee: FEE, active: true, lessonMinutes: 90
  });
  await put('staff/' + ID('t'), {
    id: ID('t'), name: 'Hisob Ustoz', status: 'faol', position: 'O’qituvchi',
    payType: 'fixed', salaryAmount: 1000000
  });
  const gPut = await put('groups/' + ID('g'), {
    id: ID('g'), code: 'H' + String(Date.now() % 900 + 99).padStart(3, '0'),
    name: 'Hisob guruhi ' + R, courseId: ID('c'), teacherId: ID('t'),
    days: [1, 3], startTime: '09:00', endTime: '10:30',
    startDate: A.monthStart(PREV), fee: FEE,
    feeHistory: [{ fee: FEE, from: PREV }],
    lessonsPerMonth: 12, limit: 20, status: 'faol'
  });
  eq('Guruh yozildi', gPut.status, 200);

  /* Uch o'quvchi: turli kunlarda qo'shilgan */
  const JOIN = { a: PREV + '-03', b: PREV + '-17', c: PREV + '-26' };
  for (const k of Object.keys(JOIN)) {
    await put('students/' + ID('s' + k), {
      id: ID('s' + k), firstName: 'Hisob', lastName: 'O’quvchi ' + k.toUpperCase(),
      phone: '+99890111' + Math.floor(1000 + Math.random() * 8999), status: 'faol'
    });
    await put('memberships/' + ID('m' + k), {
      id: ID('m' + k), studentId: ID('s' + k), groupId: ID('g'),
      joinedAt: JOIN[k], leftAt: null, status: 'faol', discount: null
    });
  }
  const gotA = await get('students/' + ID('sa'));
  ok('O’quvchilar yozildi', !!gotA, JSON.stringify(gotA).slice(0, 80));

  /* =============== 1. Shaxsiy kod 5 xonali =============== */
  section('1. Shaxsiy kod 5 xonali');
  const kabinet = require('../server/kabinet');
  eq('Kod uzunligi 5', kabinet.CODE_LEN, 5);
  /* Server kodni o'zi beradi — qanday uzunlikda berishini ko'ramiz */
  await put('students/' + ID('skod'), {
    id: ID('skod'), firstName: 'Kod', lastName: 'Sinov ' + R,
    phone: '+99890222' + Math.floor(1000 + Math.random() * 8999), status: 'faol', code: ''
  });
  const kodSt = await get('students/' + ID('skod'));
  ok('Serverning o’zi kod berdi', !!(kodSt && kodSt.code), JSON.stringify(kodSt && kodSt.code));
  ok('Berilgan kod AYNAN 5 xonali', /^\d{5}$/.test(String((kodSt || {}).code)),
    'olindi: ' + ((kodSt || {}).code));
  /* Kod boshqa o'quvchiniki bilan bir xil bo'lmasin */
  const allSt = (await api('/api/collection?name=students')).json || {};
  const codes = Object.values(allSt.items || {}).map(s => String(s.code || '')).filter(Boolean);
  eq('Kodlar takrorlanmaydi', codes.length, new Set(codes).size);

  /* Shu kod bilan kabinetga kiriladi */
  const kabOk = await api('/api/kabinet', {
    method: 'POST', body: { code: String((kodSt || {}).code) },
    headers: { 'X-Forwarded-For': '203.0.113.' + (10 + (Date.now() % 40)) }
  });
  eq('5 xonali kod bilan kabinetga kirildi', kabOk.status, 200);
  ok('Kabinet shu o’quvchini berdi',
    !!(kabOk.json && kabOk.json.student && kabOk.json.student.id === ID('skod')),
    JSON.stringify(kabOk.json && kabOk.json.student && kabOk.json.student.id));

  /* ESKI 4 xonali kod ham ishlashda davom etsin — markazda allaqachon
     kodini olgan o'quvchilar bor, ularning kartasi bekor bo'lmasin. */
  const OLD4 = String(4000 + (Date.now() % 900));
  await put('students/' + ID('seski'), {
    id: ID('seski'), firstName: 'Eski', lastName: 'Kod ' + R,
    phone: '+99890333' + Math.floor(1000 + Math.random() * 8999), status: 'faol', code: OLD4
  });
  const eskiSt = await get('students/' + ID('seski'));
  eq('Eski 4 xonali kod saqlandi', eskiSt && eskiSt.code, OLD4);
  const kabOld = await api('/api/kabinet', {
    method: 'POST', body: { code: OLD4 },
    headers: { 'X-Forwarded-For': '203.0.113.' + (60 + (Date.now() % 30)) }
  });
  eq('Eski 4 xonali kod bilan ham kirildi', kabOld.status, 200);
  /* Juda qisqa kod baribir rad etiladi */
  const kabShort = await api('/api/kabinet', {
    method: 'POST', body: { code: '123' },
    headers: { 'X-Forwarded-For': '203.0.113.' + (100 + (Date.now() % 30)) }
  });
  eq('3 xonali kod rad etildi', kabShort.status, 400);

  /* =============== 2. Bir dars narxi =============== */
  section('2. Bir dars narxi');
  const g = await get('groups/' + ID('g'));
  eq('Oyiga dars soni saqlandi', A.lessonsPerMonth(g), 12);
  eq('880 000 / 12 = 73 333', A.lessonPrice(g, YM), 73333);
  /* Soni yozilmagan guruhda standart 12 ishlaydi */
  eq('Soni yozilmasa — 12', A.lessonsPerMonth({ fee: FEE }), 12);
  eq('Nol yozilsa ham 12', A.lessonsPerMonth({ lessonsPerMonth: 0 }), 12);
  /* Oyda nechta dars bo'lishidan QAT'I NAZAR bir dars narxi o'zgarmaydi —
     markaz rahbari shuni so'radi (qat'iy bo'luvchi).                   */
  eq('Keyingi oyda ham o’sha narx', A.lessonPrice(g, A.addMonths(YM, 1)), 73333);

  /* =============== 3. Har o’quvchining o’z to’lov kuni =============== */
  section('3. Har o’quvchining o’z to’lov kuni');
  const mA = await get('memberships/' + ID('ma'));
  const mB = await get('memberships/' + ID('mb'));
  const mC = await get('memberships/' + ID('mc'));
  eq('3-sida qo’shilgan — kuni 3', A.dueDayOf(mA, { dueDay: 5 }), 3);
  eq('17-sida qo’shilgan — kuni 17', A.dueDayOf(mB, { dueDay: 5 }), 17);
  eq('26-sida qo’shilgan — kuni 26', A.dueDayOf(mC, { dueDay: 5 }), 26);
  eq('Sana to’liq to’g’ri', A.dueDateOf(mB, YM, { dueDay: 5 }), YM + '-17');
  /* Qo'lda yozilgan kun ustun turadi */
  eq('Qo’lda yozilgan kun ustun', A.dueDayOf({ joinedAt: PREV + '-17', dueDay: 10 }, { dueDay: 5 }), 10);
  /* 29, 30, 31 da qo'shilgan o'quvchi fevralda ham sanaga ega bo'lsin */
  eq('31-sida qo’shilgan — 28 ga tushadi', A.dueDayOf({ joinedAt: '2026-01-31' }, {}), 28);
  /* Guruhga qo'shilgan kunidan OLDIN muddat qo'yilmaydi */
  eq('Birinchi oyda muddat qo’shilgan kunidan oldin emas',
    A.dueDateOf(mC, PREV, { dueDay: 5 }), PREV + '-26');

  /* =============== 4. Davomat: sababli, kelmadi, keldi =============== */
  section('4. O’tgan oy davomati');
  /* O'tgan oyda 4 ta dars: A — 2 ta SABABLI, B — 2 ta KELMADI,
     C — hammasiga kelgan.                                        */
  const d1 = PREV + '-05', d2 = PREV + '-07', d3 = PREV + '-12', d4 = PREV + '-14';
  const items = {};
  [d1, d2, d3, d4].forEach(d => {
    items[d] = {
      date: d, status: 'o’tdi',
      attendance: {
        [ID('ma')]: 'keldi', [ID('mb')]: 'keldi', [ID('mc')]: 'keldi'
      }
    };
  });
  items[d1].attendance[ID('ma')] = 'sababli';
  items[d2].attendance[ID('ma')] = 'sababli';
  items[d1].attendance[ID('mb')] = 'kelmadi';
  items[d3].attendance[ID('mb')] = 'kelmadi';
  const lesPut = await api('/api/lesson/save', {
    method: 'POST', body: { groupId: ID('g'), month: PREV, items }
  });
  if (lesPut.status !== 200) {
    /* Yo'l boshqacha nomlangan bo'lsa — to'g'ridan-to'g'ri hujjat */
    await put('lessons/' + ID('g') + '__' + PREV,
      { groupId: ID('g'), month: PREV, items });
  }
  const lesDoc = await get('lessons/' + ID('g') + '__' + PREV);
  ok('Davomat yozildi', !!(lesDoc && lesDoc.items), JSON.stringify(lesDoc).slice(0, 120));
  eq('A — 2 ta sababli', A.excusedCount(lesDoc, ID('ma')), 2);
  eq('B — sababli yo’q (kelmadi sanalmaydi)', A.excusedCount(lesDoc, ID('mb')), 0);
  eq('C — sababli yo’q', A.excusedCount(lesDoc, ID('mc')), 0);
  /* Bekor qilingan dars sanalmaydi — markaz o'zi o'tkazmagan */
  const bekor = JSON.parse(JSON.stringify(lesDoc));
  bekor.items[d3] = { date: d3, status: 'bekor', attendance: { [ID('ma')]: 'sababli' } };
  eq('Bekor qilingan dars sanalmaydi', A.excusedCount(bekor, ID('ma')), 2);

  /* =============== 5. Chegirma summasi =============== */
  section('5. Sababli dars uchun chegirma');
  eq('2 ta sababli = 146 666 so’m', A.excusedCredit(g, YM, 2), 73333 * 2);
  eq('0 ta sababli = 0', A.excusedCredit(g, YM, 0), 0);
  /* Chegirma oylik narxdan oshmasin: 20 ta dars qoldirsa ham
     o'quvchiga pul QAYTARILMAYDI — hisob noldan pastga tushmaydi. */
  eq('Chegirma oylik narxdan oshmaydi', A.excusedCredit(g, YM, 20), FEE);

  /* =============== 6. Keyingi oy hisobi =============== */
  section('6. Keyingi oy hisobi');
  /* Avval shu oy uchun eski hisoblar bo'lmasin */
  for (const k of ['ma', 'mb', 'mc']) {
    await del('invoices/' + A.invoiceId(ID(k), YM));
  }
  const gen = await api('/api/invoices/generate', { method: 'POST', body: { month: YM } });
  eq('Hisoblar yaratildi', gen.status, 200);

  const invA = await get('invoices/' + A.invoiceId(ID('ma'), YM));
  const invB = await get('invoices/' + A.invoiceId(ID('mb'), YM));
  const invC = await get('invoices/' + A.invoiceId(ID('mc'), YM));
  ok('A ning hisobi bor', !!invA, JSON.stringify(invA));
  ok('B ning hisobi bor', !!invB);
  ok('C ning hisobi bor', !!invC);

  eq('A: asos 880 000', invA && invA.base, FEE);
  eq('A: 2 ta sababli dars chegirildi', invA && invA.missedLessons, 2);
  eq('A: chegirma 146 666', invA && invA.missedCredit, 73333 * 2);
  eq('A: to’laydigan summa 733 334', invA && invA.final, FEE - 73333 * 2);
  ok('A: izohda sabab yozilgan', /sababli/.test((invA || {}).note || ''), (invA || {}).note);

  /* "Kelmadi" uchun pul OLINADI — joy band turadi.
     Markaz rahbari aynan shuni tanladi.                      */
  eq('B: sababsiz qolgani uchun chegirma yo’q', invB && invB.missedCredit, 0);
  eq('B: to’liq 880 000', invB && invB.final, FEE);
  eq('C: hammasiga kelgan — to’liq 880 000', invC && invC.final, FEE);

  /* To'lov kuni har kimda O'ZINIKI */
  eq('A ning muddati 3-si', invA && invA.dueDate, YM + '-03');
  eq('B ning muddati 17-si', invB && invB.dueDate, YM + '-17');
  eq('C ning muddati 26-si', invC && invC.dueDate, YM + '-26');
  ok('Muddatlar bir xil emas',
    new Set([invA, invB, invC].map(i => i && i.dueDate)).size === 3,
    [invA, invB, invC].map(i => i && i.dueDate).join(' | '));

  /* =============== 7. Chegirma IKKI MARTA berilmaydi =============== */
  section('7. Chegirma ikki marta berilmaydi');
  const gen2 = await api('/api/invoices/generate', { method: 'POST', body: { month: YM } });
  eq('Takroriy yaratish qabul qilindi', gen2.status, 200);
  const invA2 = await get('invoices/' + A.invoiceId(ID('ma'), YM));
  eq('A ning summasi o’zgarmadi', invA2 && invA2.final, FEE - 73333 * 2);
  eq('Chegirma ham o’zgarmadi', invA2 && invA2.missedCredit, 73333 * 2);
  ok('Yangi hisob yaratilmadi (hammasi o’tkazib yuborildi)',
    (gen2.json || {}).created === 0, JSON.stringify(gen2.json));

  /* Keyingi oyga o'tganda o'sha sababli darslar QAYTA chegirilmasin:
     chegirma faqat BIR OY oldingi davomatga qaraydi.               */
  const NEXT2 = A.addMonths(YM, 1);
  await del('invoices/' + A.invoiceId(ID('ma'), NEXT2));
  await api('/api/invoices/generate', { method: 'POST', body: { month: NEXT2 } });
  const invA3 = await get('invoices/' + A.invoiceId(ID('ma'), NEXT2));
  eq('Keyingi oyda chegirma yo’q', invA3 && invA3.missedCredit, 0);
  eq('Keyingi oyda to’liq 880 000', invA3 && invA3.final, FEE);

  /* =============== 8. Tozalash =============== */
  section('8. Sinov ma’lumotlari tozalandi');
  const paths = [
    'invoices/' + A.invoiceId(ID('ma'), YM), 'invoices/' + A.invoiceId(ID('mb'), YM),
    'invoices/' + A.invoiceId(ID('mc'), YM), 'invoices/' + A.invoiceId(ID('ma'), NEXT2),
    'invoices/' + A.invoiceId(ID('mb'), NEXT2), 'invoices/' + A.invoiceId(ID('mc'), NEXT2),
    'lessons/' + ID('g') + '__' + PREV,
    'memberships/' + ID('ma'), 'memberships/' + ID('mb'), 'memberships/' + ID('mc'),
    'students/' + ID('sa'), 'students/' + ID('sb'), 'students/' + ID('sc'),
    'students/' + ID('skod'), 'students/' + ID('seski'),
    'groups/' + ID('g'), 'courses/' + ID('c'), 'staff/' + ID('t')
  ];
  for (const p of paths) await del(p);
  const leftover = await get('groups/' + ID('g'));
  ok('Sinov guruhi o’chirildi', !leftover, JSON.stringify(leftover));

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
