/* Moliyaviy yaxlitlik sinovi (serverli versiya).

   Tekshiriladi:
     1) pul qaytarish faqat O'SHA o'quvchining oddiy to'lovidan bo'lsin;
     2) qaytarishdan qaytarish bo'lmasin;
     3) bitta so'rovda takroriy ajratmalar hisob qoldig'idan oshirmasin;
     4) noto'g'ri summalar (manfiy, cheksiz, juda katta, kasr) rad etilsin;
     5) takroriy so'rov (bir xil id) bitta yozuv yaratsin;
     6) bir vaqtda kelgan so'rovlar limitni chetlab o'tmasin;
     7) rad etilgan so'rovdan keyin bazada hech narsa o'zgarmasin.

   Serverni ALOHIDA (sun'iy ma'lumotli) bazada ishga tushiring, keyin:
     node tests/finance-test.js [port] [direktor paroli]                     */
'use strict';
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got));
}
function section(t) { out.push('\n' + t); }

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.cookie ? { Cookie: opts.cookie } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (p, data, cookie) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie, body: { data } });
const pay = (body, cookie) => req('/api/payment', { method: 'POST', cookie, body });
async function login(l, p) {
  const r = await req('/api/login', { method: 'POST', body: { login: l, password: p } });
  return r.status === 200 ? r.cookie : null;
}
/** Hisobga haqiqatda yozilgan summa (bekor qilinmagan yozuvlar bo'yicha) */
async function paidOn(invoiceId, cookie) {
  const all = await req('/api/collection?name=payments', { cookie });
  let sum = 0;
  Object.values(all.json.items || {}).forEach(p => {
    if (!p || p.voided) return;
    const sign = p.type === 'refund' ? -1 : 1;
    (p.allocations || []).forEach(a => { if (a.invoiceId === invoiceId) sum += sign * Math.round(a.amount); });
  });
  return sum;
}

const R = 'f' + Date.now().toString(36);
const ID = n => R + '_' + n;

(async () => {
  const dir = await login('admin', PASS);
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  /* ---------- Sun'iy ma'lumot ---------- */
  section('0. Sinov ma’lumotlari (sun’iy)');
  await put('courses/' + ID('c'), { id: ID('c'), name: 'Arab tili', monthlyFee: 100000, active: true }, dir);
  await put('staff/' + ID('t'), { id: ID('t'), name: 'Ustoz F', status: 'faol' }, dir);
  await put('groups/' + ID('g'), {
    id: ID('g'), name: 'Moliya guruhi', courseId: ID('c'), teacherId: ID('t'),
    days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: '2026-09-01',
    fee: 100000, feeHistory: [{ fee: 100000, from: '2026-09' }], limit: 10, status: 'faol'
  }, dir);
  for (const n of ['a', 'b']) {
    await put('students/' + ID('s' + n), {
      id: ID('s' + n), firstName: n === 'a' ? 'Ali' : 'Bobur', lastName: 'Moliya', status: 'faol'
    }, dir);
    await put('memberships/' + ID('m' + n), {
      id: ID('m' + n), studentId: ID('s' + n), groupId: ID('g'), joinedAt: '2026-09-01', status: 'faol'
    }, dir);
  }
  await put('invoices/' + ID('inv_a'), {
    id: ID('inv_a'), studentId: ID('sa'), groupId: ID('g'), month: '2026-09',
    amount: 100000, discount: 0, final: 100000, status: 'ochiq', createdAt: '2026-09-01 09:00'
  }, dir);
  await put('invoices/' + ID('inv_b'), {
    id: ID('inv_b'), studentId: ID('sb'), groupId: ID('g'), month: '2026-09',
    amount: 100000, discount: 0, final: 100000, status: 'ochiq', createdAt: '2026-09-01 09:00'
  }, dir);
  ok('Ikki o’quvchi va ikki hisob tayyor', true);

  /* ================= 1. Takroriy ajratma ================= */
  section('1. Bitta so’rovda takroriy ajratma hisobdan oshirmaydi');
  const dbl = await pay({
    id: ID('p_dbl'), studentId: ID('sa'), amount: 200000, date: '2026-09-05', method: 'naqd',
    allocations: [
      { invoiceId: ID('inv_a'), amount: 100000 },
      { invoiceId: ID('inv_a'), amount: 100000 }     // xuddi shu hisob — ikkinchi marta
    ]
  }, dir);
  ok('So’rov qabul qilindi yoki rad etildi (ikkalasi ham to’g’ri)', dbl.status === 200 || dbl.status === 400, String(dbl.status));
  const onA = await paidOn(ID('inv_a'), dir);
  ok('Hisobga faqat 100 000 yozildi', onA <= 100000, onA + ' so’m yozilgan');

  /* ================= 2. Begona to'lovdan qaytarish ================= */
  section('2. Qaytarish faqat o’sha o’quvchining to’lovidan');
  const payB = await pay({
    id: ID('p_b'), studentId: ID('sb'), amount: 100000, date: '2026-09-06', method: 'naqd',
    allocations: [{ invoiceId: ID('inv_b'), amount: 100000 }]
  }, dir);
  eq('Bobur to’ladi', payB.status, 200);

  const crossRefund = await pay({
    id: ID('p_cross'), studentId: ID('sa'), type: 'refund', refOf: ID('p_b'),
    amount: 100000, date: '2026-09-07', method: 'naqd'
  }, dir);
  eq('Begona to’lovdan qaytarish rad etildi', crossRefund.status, 400);
  ok('Sabab tushunarli', /boshqa|o’quvchi|mos/i.test((crossRefund.json || {}).error || ''), crossRefund.text.slice(0, 140));
  const crossSaved = await req('/api/doc?path=' + encodeURIComponent('payments/' + ID('p_cross')), { cookie: dir });
  ok('Bazada yozuv paydo bo’lmadi', !(crossSaved.json && crossSaved.json.data), crossSaved.text.slice(0, 120));

  /* ================= 3. Qaytarishdan qaytarish ================= */
  section('3. Qaytarishdan yana qaytarib bo’lmaydi');
  const ref1 = await pay({
    id: ID('p_ref1'), studentId: ID('sb'), type: 'refund', refOf: ID('p_b'),
    amount: 40000, date: '2026-09-08', method: 'naqd'
  }, dir);
  eq('Oddiy qaytarish o’tdi', ref1.status, 200);

  const refOfRef = await pay({
    id: ID('p_ref2'), studentId: ID('sb'), type: 'refund', refOf: ID('p_ref1'),
    amount: 40000, date: '2026-09-09', method: 'naqd'
  }, dir);
  eq('Qaytarishdan qaytarish rad etildi', refOfRef.status, 400);
  const r2saved = await req('/api/doc?path=' + encodeURIComponent('payments/' + ID('p_ref2')), { cookie: dir });
  ok('Bazada yozuv paydo bo’lmadi', !(r2saved.json && r2saved.json.data));

  section('   Jami qaytarish asl to’lovdan oshmaydi');
  const over = await pay({
    id: ID('p_ref3'), studentId: ID('sb'), type: 'refund', refOf: ID('p_b'),
    amount: 70000, date: '2026-09-09', method: 'naqd'          // 40 000 qaytgan, qoldiq 60 000
  }, dir);
  eq('Ortiqcha qaytarish rad etildi', over.status, 400);

  /* ================= 4. Noto'g'ri summalar ================= */
  section('4. Noto’g’ri summalar rad etiladi');
  const cases = [
    ['manfiy', -5000],
    ['nol', 0],
    ['matn', 'ko’p'],
    ['cheksiz', 1e999],
    ['juda katta', 1e15]
  ];
  for (const [name, amount] of cases) {
    const r = await pay({
      id: ID('p_bad_' + name.replace(/\W/g, '')), studentId: ID('sa'),
      amount, date: '2026-09-10', method: 'naqd'
    }, dir);
    ok(name + ' summa rad etildi', r.status === 400, String(r.status) + ' ' + r.text.slice(0, 80));
  }
  const nanSaved = await req('/api/collection?name=payments', { cookie: dir });
  const bad = Object.values(nanSaved.json.items || {}).filter(p =>
    p && p.id && p.id.indexOf(R + '_p_bad') === 0);
  eq('Noto’g’ri to’lovlar bazaga tushmadi', bad.length, 0);

  /* ================= 5. Takroriy so'rov ================= */
  section('5. Takroriy so’rov bitta yozuv yaratadi');
  const body = {
    id: ID('p_once'), studentId: ID('sa'), amount: 50000, date: '2026-09-11', method: 'naqd',
    allocations: []
  };
  const first = await pay(body, dir);
  const second = await pay(body, dir);
  eq('Birinchi o’tdi', first.status, 200);
  eq('Ikkinchi ham 200 qaytardi', second.status, 200);
  eq('Kvitansiya raqami bir xil', (second.json.payment || {}).receiptNo, (first.json.payment || {}).receiptNo);
  const allPays = await req('/api/collection?name=payments', { cookie: dir });
  const onces = Object.values(allPays.json.items || {}).filter(p => p && p.id === ID('p_once'));
  eq('Bitta yozuv', onces.length, 1);

  /* ================= 6. Bir vaqtdagi so'rovlar ================= */
  section('6. Bir vaqtda kelgan qaytarishlar limitni chetlab o’tmaydi');
  await put('invoices/' + ID('inv_c'), {
    id: ID('inv_c'), studentId: ID('sa'), groupId: ID('g'), month: '2026-10',
    amount: 100000, discount: 0, final: 100000, status: 'ochiq', createdAt: '2026-10-01 09:00'
  }, dir);
  const src = await pay({
    id: ID('p_src'), studentId: ID('sa'), amount: 100000, date: '2026-10-05', method: 'naqd',
    allocations: [{ invoiceId: ID('inv_c'), amount: 100000 }]
  }, dir);
  eq('Manba to’lov yaratildi', src.status, 200);

  const both = await Promise.all([
    pay({ id: ID('p_r1'), studentId: ID('sa'), type: 'refund', refOf: ID('p_src'), amount: 100000, date: '2026-10-06', method: 'naqd' }, dir),
    pay({ id: ID('p_r2'), studentId: ID('sa'), type: 'refund', refOf: ID('p_src'), amount: 100000, date: '2026-10-06', method: 'naqd' }, dir)
  ]);
  const okCount = both.filter(r => r.status === 200).length;
  eq('Faqat bittasi o’tdi', okCount, 1);
  const pays2 = await req('/api/collection?name=payments', { cookie: dir });
  const refunds = Object.values(pays2.json.items || {}).filter(p =>
    p && p.type === 'refund' && p.refOf === ID('p_src') && !p.voided);
  const refSum = refunds.reduce((s, p) => s + Math.round(p.amount), 0);
  ok('Jami qaytarish 100 000 dan oshmadi', refSum <= 100000, refSum + ' so’m');

  /* ================= 7. Bir vaqtda kelgan ajratmalar ================= */
  section('7. Bir vaqtda kelgan to’lovlar hisobdan oshirmaydi');
  await put('invoices/' + ID('inv_d'), {
    id: ID('inv_d'), studentId: ID('sb'), groupId: ID('g'), month: '2026-11',
    amount: 100000, discount: 0, final: 100000, status: 'ochiq', createdAt: '2026-11-01 09:00'
  }, dir);
  await Promise.all([
    pay({ id: ID('p_d1'), studentId: ID('sb'), amount: 100000, date: '2026-11-05', method: 'naqd', allocations: [{ invoiceId: ID('inv_d'), amount: 100000 }] }, dir),
    pay({ id: ID('p_d2'), studentId: ID('sb'), amount: 100000, date: '2026-11-05', method: 'naqd', allocations: [{ invoiceId: ID('inv_d'), amount: 100000 }] }, dir)
  ]);
  const onD = await paidOn(ID('inv_d'), dir);
  ok('Hisobga 100 000 dan ortiq yozilmadi', onD <= 100000, onD + ' so’m');

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
