/* Avansdan qoplash sinovi (server).
   Serverni alohida baza bilan ishga tushiring, keyin:
     node tests/advance-test.js [port] [parol]
   Noto'g'ri natijada test YIQILADI.                                        */
'use strict';
const PORT = process.argv[2] || 3310;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + want + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.cookie ? { Cookie: opts.cookie } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

const R = 'r' + Date.now().toString(36);   // har safar yangi ID — eski yozuvlar xalaqit qilmaydi
const ID = n => R + '_' + n;

(async () => {
  const cookie = (await req('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } })).cookie;
  ok('Kirish ishladi', !!cookie);
  const put = (p, data) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie, body: { data } });


  /* --- Sun'iy ma'lumot: bitta o'quvchi, ikkita hisob --- */
  await put('students/' + ID('av1'), { id: ID('av1'), firstName: 'Avans', lastName: 'Sinov', status: 'faol', phone: '+998900000001' });
  await put('groups/' + ID('avg1'), { id: ID('avg1'), code: 'AV01', name: 'Sinov guruh', status: 'faol', fee: 500000, days: [1], startTime: '09:00', endTime: '10:00' });
  await put('invoices/' + ID('avi1'), { id: ID('avi1'), studentId: ID('av1'), groupId: ID('avg1'), month: '2026-09', final: 500000, dueDate: '2026-09-05' });
  await put('invoices/' + ID('avi2'), { id: ID('avi2'), studentId: ID('av1'), groupId: ID('avg1'), month: '2026-10', final: 500000, dueDate: '2026-10-05' });

  /* --- 1. Ortiqcha to'lov: 800 000 so'm, hisob 500 000 --- */
  section('1. Ortiqcha to’lov avansga tushadi');
  const p1 = await req('/api/payment', {
    method: 'POST', cookie,
    body: {
      id: ID('av_pay1'), studentId: ID('av1'), amount: 800000, date: '2026-09-02', method: 'naqd',
      allocations: [{ invoiceId: ID('avi1'), amount: 500000 }]
    }
  });
  ok('To’lov qabul qilindi', p1.status === 200, p1.text);
  eq('To’lov summasi', p1.json.payment.amount, 800000);
  eq('Taqsimlangani', p1.json.payment.allocations.reduce((s, a) => s + a.amount, 0), 500000);

  /* --- 2. Avansdan qoplash --- */
  section('2. Avansdan keyingi oy hisobi qoplanadi');
  const adv = await req('/api/payment', {
    method: 'POST', cookie,
    body: {
      id: ID('av_adv1'), type: 'advance', studentId: ID('av1'), amount: 300000, date: '2026-10-01',
      allocations: [{ invoiceId: ID('avi2'), amount: 300000 }]
    }
  });
  ok('Qoplash bajarildi', adv.status === 200, adv.text);
  eq('Turi "advance"', adv.json.payment.type, 'advance');
  eq('SUMMA NOL — yangi daromad emas', adv.json.payment.amount, 0);
  eq('Ishlatilgan avans yozildi', adv.json.payment.applied, 300000);
  eq('Usul "avans"', adv.json.payment.method, 'avans');
  eq('Taqsimot yozildi', adv.json.payment.allocations[0].amount, 300000);
  ok('Chek raqami berildi', !!adv.json.payment.receiptNo);

  /* --- 3. Hisob-kitob to'g'ri --- */
  section('3. Qarz, avans va tushum to’g’ri hisoblanadi');
  const all = await req('/api/bootstrap', { cookie });
  const payments = Object.values(all.json.col.payments);
  const invoices = Object.values(all.json.col.invoices).filter(i => i.studentId === ID('av1'));

  const received = payments.filter(p => p.studentId === ID('av1') && !p.voided)
    .reduce((s, p) => s + (p.type === 'refund' ? -1 : 1) * p.amount, 0);
  const allocated = payments.filter(p => p.studentId === ID('av1') && !p.voided)
    .reduce((s, p) => s + (p.allocations || []).reduce((t, a) => t + a.amount, 0), 0);
  const charged = invoices.reduce((s, i) => s + i.final, 0);

  eq('Kassaga tushgan pul o’zgarmadi (800 000)', received, 800000);
  eq('Hisoblarga yozilgani 800 000', allocated, 800000);
  eq('Jami hisoblangan 1 000 000', charged, 1000000);
  eq('Qolgan qarz 200 000', Math.max(0, charged - allocated), 200000);
  eq('Qolgan avans 0', Math.max(0, received - allocated), 0);

  section('   Oktabr tushumi soxta ko’paymadi');
  const octIncome = payments.filter(p => p.month === '2026-10' && !p.voided)
    .reduce((s, p) => s + (p.type === 'refund' ? -1 : 1) * p.amount, 0);
  eq('Oktabr tushumi 0 so’m', octIncome, 0);

  /* --- 4. Avansdan ortiq qoplab bo'lmaydi --- */
  section('4. Avansdan ortiq qoplash rad etiladi');
  const over = await req('/api/payment', {
    method: 'POST', cookie,
    body: {
      id: ID('av_adv2'), type: 'advance', studentId: ID('av1'), amount: 200000, date: '2026-10-02',
      allocations: [{ invoiceId: ID('avi2'), amount: 200000 }]
    }
  });
  ok('Avans tugagach qoplash rad etildi', over.status === 400, over.text);
  ok('Sabab tushunarli', /avans yo’q|ochiq hisob/i.test(over.json.error || ''), over.json.error);

  /* --- 5. Begona hisobga qoplab bo'lmaydi --- */
  section('5. Boshqa o’quvchining hisobiga qoplab bo’lmaydi');
  await put('students/' + ID('av2'), { id: ID('av2'), firstName: 'Ikki', lastName: 'Sinov', status: 'faol' });
  await put('invoices/' + ID('avi3'), { id: ID('avi3'), studentId: ID('av2'), groupId: ID('avg1'), month: '2026-09', final: 400000, dueDate: '2026-09-05' });
  await req('/api/payment', {
    method: 'POST', cookie,
    body: { id: ID('av_pay3'), studentId: ID('av1'), amount: 600000, date: '2026-10-03', method: 'naqd', allocations: [] }
  });
  const wrong = await req('/api/payment', {
    method: 'POST', cookie,
    body: {
      id: ID('av_adv3'), type: 'advance', studentId: ID('av1'), amount: 100000, date: '2026-10-03',
      allocations: [{ invoiceId: ID('avi3'), amount: 100000 }]
    }
  });
  eq('Begona hisob rad etildi', wrong.status, 400);

  /* --- 6. Takroriy so'rov ikkinchi yozuv yaratmaydi --- */
  section('6. Takroriy bosishda ikkinchi qoplash bo’lmaydi');
  const again = await req('/api/payment', {
    method: 'POST', cookie,
    body: {
      id: ID('av_adv1'), type: 'advance', studentId: ID('av1'), amount: 300000, date: '2026-10-01',
      allocations: [{ invoiceId: ID('avi2'), amount: 300000 }]
    }
  });
  eq('O’sha yozuv qaytdi', again.json.payment.id, ID('av_adv1'));
  const all2 = await req('/api/bootstrap', { cookie });
  const advCount = Object.values(all2.json.col.payments).filter(p => p.type === 'advance' && p.studentId === ID('av1')).length;
  eq('Faqat bitta qoplash yozuvi bor', advCount, 1);

  /* --- 7. Qolgan qarzni avansdan qoplash --- */
  section('7. Yangi avansdan qolgan qarz qoplanadi');
  const adv4 = await req('/api/payment', {
    method: 'POST', cookie,
    body: {
      id: ID('av_adv4'), type: 'advance', studentId: ID('av1'), amount: 500000, date: '2026-10-04',
      allocations: [{ invoiceId: ID('avi2'), amount: 500000 }]
    }
  });
  ok('Qoplash o’tdi', adv4.status === 200, adv4.text);
  eq('Faqat qolgan 200 000 qoplandi (ortig’i emas)', adv4.json.payment.applied, 200000);

  const all3 = await req('/api/bootstrap', { cookie });
  const pays3 = Object.values(all3.json.col.payments).filter(p => p.studentId === ID('av1') && !p.voided);
  const rec3 = pays3.reduce((s, p) => s + (p.type === 'refund' ? -1 : 1) * p.amount, 0);
  const alloc3 = pays3.reduce((s, p) => s + (p.allocations || []).reduce((t, a) => t + a.amount, 0), 0);
  eq('Kassa jami 1 400 000', rec3, 1400000);
  eq('Hisoblarga yozilgani 1 000 000', alloc3, 1000000);
  eq('Qarz qolmadi', Math.max(0, 1000000 - alloc3), 0);
  eq('Avans qoldi 400 000', Math.max(0, rec3 - alloc3), 400000);

  /* --- 8. Tarixga yozildi --- */
  section('8. O’zgarish tarixga yozildi');
  const audit = await req('/api/collection?name=audit', { cookie });
  const entries = Object.values(audit.json.items || {});
  ok('"Avansdan qoplandi" yozuvi bor', entries.some(e => /Avansdan qoplandi/.test(e.action || '')));
  ok('Muallif serverdan', entries.filter(e => /Avansdan/.test(e.action || '')).every(e => e.by && e.at));

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
