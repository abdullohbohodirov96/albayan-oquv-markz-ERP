/* Albyana ERP — moliyaviy hisoblar va huquqlar uchun avtomatik testlar
   Ishga tushirish:  node tests/run-tests.js                              */
'use strict';
const path = require('path');
const fs = require('fs');

// Brauzer muhitini minimal taqlid qilish
global.window = undefined;
const load = (f) => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  (0, eval)(code);
};
load('core.js');
load('model.js');
load('ops.js');

const A = globalThis.A;
const D = A.Data;

let pass = 0, fail = 0;
const results = [];
function ok(name, cond, extra) {
  if (cond) { pass++; results.push('  ✓ ' + name); }
  else { fail++; results.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'kutilgan ' + want + ', olindi ' + got);
}
function section(t) { results.push('\n' + t); }

/* ---------------- 0. Sozlash ---------------- */
(async function main() {
  await D.init();
  D.settings = JSON.parse(JSON.stringify({
    centerName: 'Albyana', dueDay: 5, expenseCategories: ['Ijara', 'Ish haqi']
  }));
  const YM = '2026-09';
  const NEXT = '2026-10';
  const actor = { name: 'Test Direktor', login: 'admin', role: 'direktor' };

  await D.save('rooms', { id: 'r1', name: '1-xona', capacity: 10 });
  await D.save('rooms', { id: 'r2', name: '2-xona', capacity: 10 });
  await D.save('courses', { id: 'c1', name: 'Ingliz tili', monthlyFee: 500000 });
  await D.save('staff', { id: 't1', name: 'O’qituvchi Bir', status: 'faol', payType: 'percent', percentRate: 40 });
  await D.save('staff', { id: 't2', name: 'O’qituvchi Ikki', status: 'faol', payType: 'fixed', salaryAmount: 4000000 });
  await D.save('groups', {
    id: 'g1', name: 'A1', courseId: 'c1', teacherId: 't1', roomId: 'r1',
    days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: '2026-09-01',
    fee: 500000, feeHistory: [{ fee: 500000, from: '2026-09' }], limit: 10, status: 'faol'
  });
  await D.save('groups', {
    id: 'g2', name: 'B1', courseId: 'c1', teacherId: 't2', roomId: 'r2',
    days: [2, 4], startTime: '09:00', endTime: '10:30', startDate: '2026-09-01',
    fee: 600000, feeHistory: [{ fee: 600000, from: '2026-09' }], limit: 10, status: 'faol'
  });
  await D.save('students', { id: 's1', firstName: 'Ali', lastName: 'Valiyev', status: 'faol', parentPhone: '+998901112233' });
  await D.save('students', { id: 's2', firstName: 'Zuhra', lastName: 'Karimova', status: 'faol', parentPhone: '+998901112244' });
  await D.save('memberships', { id: 'm1', studentId: 's1', groupId: 'g1', joinedAt: '2026-09-01', status: 'faol', discount: null });
  await D.save('memberships', {
    id: 'm2', studentId: 's2', groupId: 'g1', joinedAt: '2026-09-01', status: 'faol',
    discount: { type: 'percent', value: 10, reason: 'Oiladan ikkinchi bola', from: '2026-09', to: '' }
  });

  /* ---------------- 1. Oylik hisob ---------------- */
  section('1. Oylik hisoblar');
  const r1 = await A.Ops.generateInvoices(YM, actor);
  eq('Ikkita a’zolikka ikkita hisob yaratildi', r1.created, 2);
  const r2 = await A.Ops.generateInvoices(YM, actor);
  eq('Qayta ishga tushirishda yangi hisob yaratilmadi', r2.created, 0);
  eq('Takroriy hisob yo’q (jami 2 ta)', A.Fin.monthItems('invoices', YM).length, 2);

  const inv1 = A.Fin.monthItems('invoices', YM).find(i => i.studentId === 's1');
  const inv2 = A.Fin.monthItems('invoices', YM).find(i => i.studentId === 's2');
  eq('Chegirmasiz hisob = 500 000', inv1.final, 500000);
  eq('10% chegirma bilan = 450 000', inv2.final, 450000);
  eq('To’lov muddati sozlamadan olindi', inv1.dueDate, '2026-09-05');

  /* ---------------- 2. Chegirma chegaralari ---------------- */
  section('2. Chegirma');
  eq('Chegirma hisobni manfiyga tushirmaydi',
    A.invoiceAmountFor({ fee: 100000, feeHistory: [{ fee: 100000, from: YM }] },
      { discount: { type: 'sum', value: 999999, from: YM } }, YM).final, 0);
  eq('Amal qilish davridan tashqarida chegirma yo’q',
    A.discountFor(500000, { type: 'percent', value: 50, from: '2026-10' }, YM), 0);

  /* ---------------- 3. Qisman to'lov ---------------- */
  section('3. Qisman to’lov va qarz');
  await A.Ops.createPayment({
    id: 'p1', studentId: 's1', amount: 200000, date: '2026-09-03', method: 'naqd',
    allocations: [{ invoiceId: inv1.id, amount: 200000 }]
  }, actor);
  let bal = A.balanceOf('s1', A.Fin.allInvoices(), A.Fin.allPayments());
  eq('Qisman to’lovdan keyin qarz = 300 000', bal.debt, 300000);
  eq('Avans yo’q', bal.advance, 0);

  /* ---------------- 4. Takroriy bosish ---------------- */
  section('4. Takroriy bosish');
  await A.Ops.createPayment({
    id: 'p1', studentId: 's1', amount: 200000, date: '2026-09-03', method: 'naqd',
    allocations: [{ invoiceId: inv1.id, amount: 200000 }]
  }, actor);
  eq('Bir xil id bilan ikkinchi so’rov yangi to’lov yaratmadi',
    A.Fin.monthItems('payments', YM).filter(p => p.studentId === 's1').length, 1);
  bal = A.balanceOf('s1', A.Fin.allInvoices(), A.Fin.allPayments());
  eq('Balans o’zgarmadi', bal.debt, 300000);

  /* ---------------- 5. Avans va taqsimlash ---------------- */
  section('5. Avans va keyingi oyga taqsimlash');
  await A.Ops.createPayment({
    id: 'p2', studentId: 's1', amount: 500000, date: '2026-09-10', method: 'karta',
    allocations: [{ invoiceId: inv1.id, amount: 300000 }]
  }, actor);
  bal = A.balanceOf('s1', A.Fin.allInvoices(), A.Fin.allPayments());
  eq('Qarz yopildi', bal.debt, 0);
  eq('Ortiqcha pul avansga tushdi', bal.advance, 200000);

  await A.Ops.generateInvoices(NEXT, actor);
  const invOct = A.Fin.monthItems('invoices', NEXT).find(i => i.studentId === 's1');
  const open = A.Fin.allInvoices()
    .filter(i => i.studentId === 's1')
    .map(i => ({ id: i.id, month: i.month, remaining: A.invoiceRemaining(i, A.paidByInvoice(A.Fin.allPayments())) }))
    .filter(i => i.remaining > 0);
  const alloc = A.allocate(200000, open);
  eq('Avans eng eski ochiq hisobga taklif qilindi', alloc.allocations[0].invoiceId, invOct.id);
  eq('Taklif summasi 200 000', alloc.allocations[0].amount, 200000);

  /* ---------------- 6. Eski qarzdan boshlab taqsimlash ---------------- */
  section('6. Taqsimlash tartibi');
  const order = A.allocate(700000, [
    { id: 'i_okt', month: '2026-10', remaining: 500000 },
    { id: 'i_sen', month: '2026-09', remaining: 400000 }
  ]);
  eq('Avval eng eski oy yopildi', order.allocations[0].invoiceId, 'i_sen');
  eq('Eski qarz to’liq', order.allocations[0].amount, 400000);
  eq('Qolgani keyingi oyga', order.allocations[1].amount, 300000);
  eq('Avans qolmadi', order.advance, 0);

  /* ---------------- 7. Bekor qilish ---------------- */
  section('7. To’lovni bekor qilish');
  const p2 = A.Fin.monthItems('payments', YM).find(p => p.id === 'p2');
  await A.Ops.voidPayment(p2, 'Xato kiritilgan', actor);
  bal = A.balanceOf('s1', A.Fin.allInvoices(), A.Fin.allPayments());
  const remSen = A.invoiceRemaining(
    A.Fin.monthItems('invoices', YM).find(i => i.studentId === 's1'),
    A.paidByInvoice(A.Fin.allPayments()));
  eq('Bekor qilingandan keyin sentabr qarzi qaytdi', remSen, 300000);
  eq('Avans yo’qoldi', bal.advance, 0);
  eq('Umumiy qarz = sentabr 300 000 + oktabr 500 000', bal.debt, 800000);
  ok('Yozuv o’chmadi, faqat bekor belgilandi',
    A.Fin.monthItems('payments', YM).some(p => p.id === 'p2' && p.voided && p.voided.reason === 'Xato kiritilgan'));

  /* ---------------- 8. Pul qaytarish ---------------- */
  section('8. Pul qaytarish');
  await A.Ops.createPayment({
    id: 'p3', studentId: 's2', amount: 450000, date: '2026-09-04', method: 'naqd',
    allocations: [{ invoiceId: inv2.id, amount: 450000 }]
  }, actor);
  let bal2 = A.balanceOf('s2', A.Fin.allInvoices(), A.Fin.allPayments());
  eq('Sentabr hisobi to’liq yopildi',
    A.invoiceRemaining(inv2, A.paidByInvoice(A.Fin.allPayments())), 0);
  await A.Ops.createPayment({
    id: 'p3r', type: 'refund', studentId: 's2', amount: 150000, date: '2026-09-20',
    method: 'naqd', note: 'Qisman qaytarish', allocations: [{ invoiceId: inv2.id, amount: 150000 }], refOf: 'p3'
  }, actor);
  bal2 = A.balanceOf('s2', A.Fin.allInvoices(), A.Fin.allPayments());
  eq('Qaytarishdan keyin sentabr qarzi tiklandi',
    A.invoiceRemaining(inv2, A.paidByInvoice(A.Fin.allPayments())), 150000);
  eq('Haqiqiy tushum kamaydi', bal2.received, 300000);

  /* ---------------- 9. Narx o'zgarishi ---------------- */
  section('9. Narx o’zgarishi');
  const g1 = D.one('groups', 'g1');
  g1.feeHistory.push({ fee: 700000, from: '2026-11' });
  g1.fee = 700000;
  await D.save('groups', g1);
  eq('Sentabr narxi o’zgarmadi', A.feeForMonth(g1, '2026-09'), 500000);
  eq('Oktabr narxi o’zgarmadi', A.feeForMonth(g1, '2026-10'), 500000);
  eq('Noyabrdan yangi narx', A.feeForMonth(g1, '2026-11'), 700000);
  eq('Yaratilgan sentabr hisobi o’zgarmadi',
    A.Fin.monthItems('invoices', YM).find(i => i.studentId === 's1').final, 500000);

  /* ---------------- 10. Jadval to'qnashuvi ---------------- */
  section('10. Jadval to’qnashuvi');
  let cf = A.scheduleConflicts(
    { id: 'yangi', days: [1], startTime: '10:00', endTime: '11:00', teacherId: 't1', roomId: 'r2' },
    D.all('groups'));
  ok('O’qituvchi band vaqtga qo’yilmaydi', cf.some(c => c.type === 'teacher'));
  cf = A.scheduleConflicts(
    { id: 'yangi', days: [1], startTime: '10:00', endTime: '11:00', teacherId: 't2', roomId: 'r1' },
    D.all('groups'));
  ok('Xona band vaqtga qo’yilmaydi', cf.some(c => c.type === 'room'));
  cf = A.scheduleConflicts(
    { id: 'yangi', days: [1], startTime: '11:00', endTime: '12:00', teacherId: 't1', roomId: 'r1' },
    D.all('groups'));
  eq('Bo’sh vaqtda to’qnashuv yo’q', cf.length, 0);
  cf = A.scheduleConflicts(
    { id: 'yangi', days: [2], startTime: '09:00', endTime: '10:30', teacherId: 't1', roomId: 'r1' },
    D.all('groups'));
  eq('Boshqa kunda to’qnashuv yo’q', cf.length, 0);

  /* ---------------- 11. Huquqlar ---------------- */
  section('11. Huquqlar');
  const direktor = { role: 'direktor', name: 'D' };
  const admin = { role: 'admin', name: 'A' };
  const ustoz = { role: 'oqituvchi', name: 'U', staffId: 't1' };
  const buxgalter = { role: 'buxgalter', name: 'B' };

  ok('Direktor sozlamalarni ko’radi', A.can(direktor, 'settings.edit'));
  ok('Administrator ish haqini ko’rmaydi', !A.can(admin, 'finance.payroll'));
  ok('Administrator moliyaviy hisobotni ko’rmaydi', !A.can(admin, 'reports.finance'));
  ok('Administrator xarajatlarni ko’rmaydi', !A.can(admin, 'finance.expenses'));
  ok('Administrator to’lov qabul qiladi', A.can(admin, 'payment.create'));
  ok('Administrator to’lovni bekor qila olmaydi', !A.can(admin, 'payment.void'));
  ok('O’qituvchi moliyaga kira olmaydi', !A.can(ustoz, 'nav.finance'));
  ok('O’qituvchi davomat oladi', A.can(ustoz, 'attendance.mark'));
  ok('O’qituvchi foydalanuvchi qo’sha olmaydi', !A.can(ustoz, 'users.manage'));
  ok('Buxgalter xarajat kiritadi', A.can(buxgalter, 'expense.edit'));
  ok('Buxgalter ish haqini tasdiqlay olmaydi', !A.can(buxgalter, 'payroll.approve'));
  ok('Buxgalter sozlamalarni o’zgartira olmaydi', !A.can(buxgalter, 'settings.edit'));

  const visible = A.scopeGroups(ustoz, D.all('groups'));
  eq('O’qituvchi faqat o’z guruhini ko’radi', visible.length, 1);
  eq('Ko’rinadigan guruh — o’ziniki', visible[0].id, 'g1');
  ok('Boshqa guruhga kirish rad etiladi', !A.canSeeGroup(ustoz, D.one('groups', 'g2')));
  ok('Direktor barcha guruhni ko’radi', A.scopeGroups(direktor, D.all('groups')).length === 2);

  /* ---------------- 12. Ish haqi ---------------- */
  section('12. Ish haqi');
  await A.Ops.payrollRecalc(YM, actor);
  const pr = D.monthCached('payroll', YM).items;
  // t1 guruhi: s1 to'lovi 200 000 (p2 bekor qilingan) + s2: 450 000 − 150 000 qaytarish = 300 000
  eq('Foiz asosi — faqat amaldagi pul', pr['t1'].base, 500000);
  eq('40% ish haqi', pr['t1'].accrued, 200000);
  eq('Belgilangan oylik o’zgarmaydi', pr['t2'].accrued, 4000000);

  await A.Ops.payrollApprove(YM, 't1', actor);
  eq('Tasdiqlangan holat', D.monthCached('payroll', YM).items['t1'].status, 'tasdiqlangan');
  // tasdiqlangandan keyin qayta hisoblash summani o'zgartirmasligi kerak
  await A.Ops.createPayment({
    id: 'p4', studentId: 's1', amount: 300000, date: '2026-09-25', method: 'naqd',
    allocations: [{ invoiceId: inv1.id, amount: 300000 }]
  }, actor);
  await A.Ops.payrollRecalc(YM, actor);
  eq('Yopilgan davr qayta hisoblanmadi', D.monthCached('payroll', YM).items['t1'].accrued, 200000);

  await A.Ops.payrollPay(YM, 't1', 200000, 'naqd', actor);
  await A.Ops.payrollPay(YM, 't1', 200000, 'naqd', actor); // takroriy bosish
  const salaryExpenses = A.Fin.monthItems('expenses', A.thisMonth()).filter(e => e.payrollRef);
  eq('Ish haqi xarajatda faqat bir marta', salaryExpenses.length, 1);
  eq('Xarajat summasi to’g’ri', salaryExpenses[0].amount, 200000);

  /* ---------------- 13. Sof pul oqimi ---------------- */
  section('13. Sof pul oqimi');
  const cfRes = A.cashFlow(
    [{ id: 'a', amount: 1000000, type: 'payment' },
    { id: 'b', amount: 200000, type: 'refund' },
    { id: 'c', amount: 500000, type: 'payment', voided: { reason: 'x' } }],
    [{ amount: 300000 }]);
  eq('Tushum bekor qilinganni hisobga olmaydi', cfRes.income, 1000000);
  eq('Qaytarish alohida', cfRes.refunds, 200000);
  eq('Sof oqim = 1 000 000 − 200 000 − 300 000', cfRes.net, 500000);

  /* ---------------- 14. Davomat ---------------- */
  section('14. Davomat');
  const lessons = A.monthLessons(D.one('groups', 'g1'), YM, null);
  ok('Sentabrda dars kunlari hosil bo’ldi', lessons.length > 0);
  ok('Faqat dushanba va chorshanba', lessons.every(l => [1, 3].includes(A.weekdayOf(l.date))));
  await D.mutateLessons('g1', YM, (doc) => {
    // 2026-09-05 — shanba, guruhning odatdagi kuni emas (ko'chirilgan dars)
    doc.items['2026-09-05'] = { added: true, start: '09:00', end: '10:30', status: 'rejalashtirilgan' };
  });
  const lessons2 = A.monthLessons(D.one('groups', 'g1'), YM, D.lessonsCached('g1', YM));
  eq('Ko’chirib qo’shilgan dars qo’shildi', lessons2.length, lessons.length + 1);
  const st = A.attendanceStats([{ status: 'keldi' }, { status: 'kelmadi' }, {}, { status: 'keldi' }]);
  eq('Belgilanmagan avtomatik "Kelmadi" bo’lmaydi', st.kelmadi, 1);
  eq('Belgilanmaganlar alohida sanaladi', st.belgilanmagan, 1);

  /* ---------------- 15. Pul formatlash ---------------- */
  section('15. Pul va sana');
  eq('Pul butun songa yaxlitlanadi', A.som(1234567.4), '1 234 567');
  eq('Kiritilgan matndan son olinadi', A.parseSom('1 250 000 so’m'), 1250000);
  eq('To’lov muddati 28-kundan oshmaydi', A.dueDateFor('2026-09', 31), '2026-09-28');
  eq('Telefon normallashtiriladi', A.normPhone('901234567'), '+998901234567');

  /* ---------------- Natija ---------------- */
  console.log(results.join('\n'));
  console.log('\n' + '─'.repeat(48));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
