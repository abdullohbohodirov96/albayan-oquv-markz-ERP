/* Xavfsizlik va ma'lumot yaxlitligi tekshiruvi (serverli versiya).
   Serverni ishga tushiring, keyin:  node tests/security-test.js [port] [parol]
   Noto'g'ri natijada test YIQILADI (exit code 1).                          */
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
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + want + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.cookie ? { Cookie: opts.cookie } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
async function login(l, p) {
  const r = await req('/api/login', { method: 'POST', body: { login: l, password: p } });
  return r.status === 200 ? r.cookie : null;
}

(async () => {
  /* ---------- 1. Maxfiy fayllar ---------- */
  section('1. Maxfiy fayllar brauzerdan ochilmaydi');
  for (const p of ['/.env', '/server/index.js', '/server/bot.js', '/data/albyana.json',
    '/package.json', '/.git/config', '/tests/run-tests.js', '/README.md', '/artifact.html']) {
    const r = await req(p);
    ok(p + ' berilmaydi (' + r.status + ')', r.status === 404);
  }
  section('   Kerakli fayllar ochiladi');
  for (const p of ['/', '/index.html', '/css/app.css', '/js/app.js']) {
    const r = await req(p);
    ok(p + ' ochildi', r.status === 200);
  }
  const envProbe = await req('/.env');
  ok('Javobda maxfiy qiymat yo’q', !/SEED_DIRECTOR_PASSWORD|TELEGRAM_BOT_TOKEN/.test(envProbe.text));

  /* ---------- 2. Kirish ---------- */
  section('2. Kirish va parol');
  const dirCookie = await login('admin', PASS);
  ok('Direktor kirdi', !!dirCookie);
  const badLogin = await req('/api/login', { method: 'POST', body: { login: 'admin', password: 'notogri' } });
  eq('Noto’g’ri parol rad etildi', badLogin.status, 401);
  ok('Xato javobida maxfiy ma’lumot yo’q', !/hash|salt/i.test(badLogin.text));

  const me = await req('/api/me', { cookie: dirCookie });
  ok('Parol hash’i javobda yo’q', !/hash|salt|pbkdf2/i.test(me.text));

  section('   Kirish urinishlari cheklovi');
  let limited = false;
  for (let i = 0; i < 12; i++) {
    const r = await req('/api/login', { method: 'POST', body: { login: 'bloklanadi', password: 'x' + i } });
    if (r.status === 429) { limited = true; break; }
  }
  ok('Ko’p urinishdan keyin bloklanadi', limited);

  /* ---------- 3. Sessiyasiz kirish ---------- */
  section('3. Sessiyasiz so’rovlar');
  eq('bootstrap yopiq', (await req('/api/bootstrap')).status, 401);
  eq('collection yopiq', (await req('/api/collection?name=students')).status, 401);
  eq('doc yopiq', (await req('/api/doc?path=students%2Fx')).status, 401);
  eq('to’lov yopiq', (await req('/api/payment', { method: 'POST', body: { amount: 1 } })).status, 401);

  /* ---------- 4. Sinov ma'lumotlari ---------- */
  section('4. Sinov ma’lumotlari tayyorlanmoqda');
  const put = (path, data, cookie) => req('/api/doc?path=' + encodeURIComponent(path),
    { method: 'PUT', body: { data }, cookie });

  await put('staff/stf_t1', { id: 'stf_t1', name: 'Ustoz Bir', status: 'faol', payType: 'percent', percentRate: 40, position: 'O’qituvchi' }, dirCookie);
  await put('staff/stf_t2', { id: 'stf_t2', name: 'Ustoz Ikki', status: 'faol', payType: 'fixed', salaryAmount: 5000000, position: 'O’qituvchi' }, dirCookie);
  await put('courses/crs1', { id: 'crs1', name: 'Arab tili', monthlyFee: 500000, active: true }, dirCookie);
  await put('groups/g1', {
    id: 'g1', code: 'A001', name: 'A1', courseId: 'crs1', teacherId: 'stf_t1', roomId: '',
    days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: '2026-09-01',
    fee: 500000, feeHistory: [{ fee: 500000, from: '2026-09' }], limit: 10, status: 'faol',
    teacherHistory: [{ teacherId: 'stf_t1', from: '2026-09-01', to: null }]
  }, dirCookie);
  await put('groups/g2', {
    id: 'g2', code: 'B001', name: 'B1', courseId: 'crs1', teacherId: 'stf_t2',
    days: [2, 4], startTime: '11:00', endTime: '12:30', startDate: '2026-09-01',
    fee: 500000, feeHistory: [{ fee: 500000, from: '2026-09' }], limit: 10, status: 'faol'
  }, dirCookie);
  await put('students/s1', { id: 's1', firstName: 'Ali', lastName: 'Valiyev', phone: '+998901112233', status: 'faol' }, dirCookie);
  await put('students/s2', { id: 's2', firstName: 'Zuhra', lastName: 'Karimova', phone: '+998901112244', status: 'faol' }, dirCookie);
  await put('memberships/m1', { id: 'm1', studentId: 's1', groupId: 'g1', joinedAt: '2026-09-01', status: 'faol' }, dirCookie);
  await put('memberships/m2', { id: 'm2', studentId: 's2', groupId: 'g2', joinedAt: '2026-09-01', status: 'faol' }, dirCookie);
  const gen = await req('/api/invoices/generate', { method: 'POST', body: { month: '2026-09' }, cookie: dirCookie });
  const invAll = await req('/api/collection?name=invoices', { cookie: dirCookie });
  const mineInv = Object.values(invAll.json.items || {}).filter(i => i.studentId === 's1' || i.studentId === 's2');
  ok('Hisoblar yaratildi', mineInv.length >= 2, JSON.stringify(gen.json) + ' / o’ziniki: ' + mineInv.length);
  const gen2 = await req('/api/invoices/generate', { method: 'POST', body: { month: '2026-09' }, cookie: dirCookie });
  eq('Takroriy hisob yaratilmadi', gen2.json.created, 0);

  // foydalanuvchilar
  await req('/api/doc?path=' + encodeURIComponent('users/usr_ustoz'), {
    method: 'PUT', cookie: dirCookie,
    body: {
      data: { id: 'usr_ustoz', login: 'ustoz', name: 'Ustoz Bir', role: 'oqituvchi', staffId: 'stf_t1', active: true },
      password: 'Ustoz12345'
    }
  });
  await req('/api/doc?path=' + encodeURIComponent('users/usr_admin2'), {
    method: 'PUT', cookie: dirCookie,
    body: {
      data: { id: 'usr_admin2', login: 'manager', name: 'Administrator', role: 'admin', active: true },
      password: 'Manager12345'
    }
  });
  await req('/api/doc?path=' + encodeURIComponent('users/usr_bux'), {
    method: 'PUT', cookie: dirCookie,
    body: {
      data: { id: 'usr_bux', login: 'hisob', name: 'Buxgalter', role: 'buxgalter', active: true },
      password: 'Buxgalter12345'
    }
  });

  const ustozCookie = await login('ustoz', 'Ustoz12345');
  const adminCookie = await login('manager', 'Manager12345');
  const buxCookie = await login('hisob', 'Buxgalter12345');
  ok('O’qituvchi kirdi', !!ustozCookie);
  ok('Administrator kirdi', !!adminCookie);
  ok('Buxgalter kirdi', !!buxCookie);

  /* ---------- 5. O'qituvchi ko'radigan ma'lumot ---------- */
  section('5. O’qituvchiga ortiqcha ma’lumot yuborilmaydi');
  const tb = await req('/api/bootstrap', { cookie: ustozCookie });
  const col = tb.json.col;
  eq('Faqat o’z guruhi', Object.keys(col.groups).join(','), 'g1');
  eq('Faqat o’z o’quvchisi', Object.keys(col.students).join(','), 's1');
  eq('Xarajatlar yuborilmadi', Object.keys(col.expenses || {}).length, 0);
  eq('Ish haqi yuborilmadi', Object.keys(col.payroll || {}).length, 0);
  eq('To’lovlar yuborilmadi', Object.keys(col.payments || {}).length, 0);
  eq('Hisoblar yuborilmadi', Object.keys(col.invoices || {}).length, 0);
  ok('Boshqa xodim oyligi yuborilmadi',
    !Object.keys(col.staff).some(k => col.staff[k].salaryAmount != null || col.staff[k].percentRate != null));
  ok('Javobda oylik summasi umuman yo’q', !/5000000/.test(tb.text));

  section('   O’qituvchi boshqa guruhni so’rasa');
  const otherGroup = await req('/api/doc?path=' + encodeURIComponent('groups/g2'), { cookie: ustozCookie });
  ok('Boshqa guruh berilmadi', otherGroup.status === 403 || !otherGroup.json.data, JSON.stringify(otherGroup.json));
  const payrollRead = await req('/api/doc?path=' + encodeURIComponent('payroll/2026-09__stf_t2'), { cookie: ustozCookie });
  eq('Ish haqi o’qilmadi', payrollRead.status, 403);
  const expWrite = await put('expenses/x1', { id: 'x1', amount: 1, date: '2026-09-01', category: 'Ijara' }, ustozCookie);
  eq('Xarajat yoza olmadi', expWrite.status, 403);
  const userWrite = await put('users/hacker', { id: 'hacker', login: 'hacker', role: 'direktor' }, ustozCookie);
  eq('Foydalanuvchi yarata olmadi', userWrite.status, 403);

  /* ---------- 6. Administrator cheklovlari ---------- */
  section('6. Administrator huquqlari');
  const invRow = await req('/api/collection?name=invoices', { cookie: adminCookie });
  const invId = Object.keys(invRow.json.items).find(k => invRow.json.items[k].studentId === 's1');
  const payA = await req('/api/payment', {
    method: 'POST', cookie: adminCookie,
    body: { id: 'pay_a1', studentId: 's1', amount: 200000, date: '2026-09-05', method: 'naqd', allocations: [{ invoiceId: invId, amount: 200000 }] }
  });
  ok('Administrator to’lov qabul qildi', payA.status === 200, payA.text);
  const voidA = await req('/api/payment/void', { method: 'POST', cookie: adminCookie, body: { id: 'pay_a1', reason: 'xato' } });
  eq('Administrator to’lovni bekor qila olmadi', voidA.status, 403);
  const delA = await req('/api/doc?path=' + encodeURIComponent('payments/pay_a1'), { method: 'DELETE', cookie: adminCookie });
  eq('Administrator to’lovni o’chira olmadi', delA.status, 403);
  const auditWrite = await put('audit/fake', { id: 'fake', by: 'Direktor', action: 'soxta' }, adminCookie);
  eq('Tarixga qo’lda yoza olmadi', auditWrite.status, 403);

  section('   Buxgalter huquqlari (hisoblash mumkin, tasdiqlash mumkin emas)');
  const PRP = 'payroll/2026-09__stf_t1';
  // oldingi ishga tushishdan qolgan yozuv bo'lmasin (direktor o'chira oladi)
  await req('/api/doc?path=' + encodeURIComponent(PRP), { method: 'DELETE', cookie: dirCookie });
  const prRead = async () => (await req('/api/doc?path=' + encodeURIComponent(PRP), { cookie: dirCookie })).json.data;

  const payrollPut = await put(PRP,
    { id: '2026-09__stf_t1', staffId: 'stf_t1', month: '2026-09', accrued: 80000, status: 'qoralama' }, buxCookie);
  eq('Buxgalter qoralama hisoblay oladi', payrollPut.status, 200);

  const payrollApprove = await put(PRP,
    { id: '2026-09__stf_t1', staffId: 'stf_t1', month: '2026-09', accrued: 80000, status: 'tasdiqlangan' }, buxCookie);
  eq('Buxgalter tasdiqlay olmadi (403)', payrollApprove.status, 403);
  eq('Bazada holat hali qoralama', (await prRead()).status, 'qoralama');

  const dirApprove = await put(PRP,
    { id: '2026-09__stf_t1', staffId: 'stf_t1', month: '2026-09', accrued: 80000, status: 'tasdiqlangan' }, dirCookie);
  eq('Direktor tasdiqlay oldi', dirApprove.status, 200);
  eq('Bazada tasdiqlangan', (await prRead()).status, 'tasdiqlangan');

  const buxUndo = await put(PRP,
    { id: '2026-09__stf_t1', staffId: 'stf_t1', month: '2026-09', accrued: 1, status: 'qoralama' }, buxCookie);
  eq('Tasdiqlanganni qoralamaga qaytara olmadi', buxUndo.status, 403);
  const afterUndo = await prRead();
  eq('Holat o’zgarmadi', afterUndo.status, 'tasdiqlangan');
  eq('Summa o’zgarmadi', afterUndo.accrued, 80000);
  const buxDel = await req('/api/doc?path=' + encodeURIComponent(PRP), { method: 'DELETE', cookie: buxCookie });
  eq('Tasdiqlanganni o’chira olmadi', buxDel.status, 403);
  ok('Yozuv bazada qoldi', !!(await prRead()));

  section('   O’qituvchi begona guruh davomatini yoza olmaydi');
  const FOR = 'lessons/g2__2026-09';
  await put(FOR, { id: 'g2__2026-09', marks: { '2026-09-03': { s2: 'keldi' } } }, dirCookie);
  const foreignMark = await put(FOR, { id: 'g2__2026-09', marks: { '2026-09-03': { s2: 'kelmadi' } } }, ustozCookie);
  eq('Begona guruhga davomat yozilmadi', foreignMark.status, 403);
  const forNow = (await req('/api/doc?path=' + encodeURIComponent(FOR), { cookie: dirCookie })).json.data;
  eq('Belgi o’zgarmadi', forNow.marks['2026-09-03'].s2, 'keldi');
  const ownMark = await put('lessons/g1__2026-09', { id: 'g1__2026-09', marks: { '2026-09-02': { s1: 'keldi' } } }, ustozCookie);
  eq('O’z guruhiga yoza oldi', ownMark.status, 200);

  section('   Begona shaxsiy suhbat hamma yo’lda yopiq');
  const SCH = 'chats/sec_dir_bux';
  await put(SCH, {
    id: 'sec_dir_bux', type: 'direct', members: ['usr_admin', 'usr_bux'],
    messages: [{ id: 'sm1', from: 'usr_admin', text: 'Maxfiy matn', at: '2026-09-19 10:00' }],
    readAt: {}, updatedAt: '2026-09-19 10:00'
  }, dirCookie);
  const chatDoc = await req('/api/doc?path=' + encodeURIComponent(SCH), { cookie: ustozCookie });
  ok('doc orqali berilmadi', chatDoc.status === 403 || !chatDoc.json.data, chatDoc.text.slice(0, 100));
  const chatCol = await req('/api/collection?name=chats', { cookie: ustozCookie });
  ok('collection orqali berilmadi', !(chatCol.json.items || {}).sec_dir_bux);
  const chatBoot = await req('/api/bootstrap', { cookie: ustozCookie });
  ok('bootstrap orqali berilmadi', !((chatBoot.json.col.chats || {}).sec_dir_bux));
  ok('Uchala yo’lda ham matn yo’q',
    !/Maxfiy matn/.test(chatDoc.text + chatCol.text + chatBoot.text));

  /* ---------- 7. Parallel to'lovlar ---------- */
  section('7. Ikki administrator bir vaqtda to’lov yozsa');
  const inv2 = Object.keys(invRow.json.items).find(k => invRow.json.items[k].studentId === 's2');
  const [r1, r2] = await Promise.all([
    req('/api/payment', {
      method: 'POST', cookie: adminCookie,
      body: { id: 'par_1', studentId: 's1', amount: 100000, date: '2026-09-06', method: 'naqd', allocations: [] }
    }),
    req('/api/payment', {
      method: 'POST', cookie: dirCookie,
      body: { id: 'par_2', studentId: 's2', amount: 150000, date: '2026-09-06', method: 'karta', allocations: [{ invoiceId: inv2, amount: 150000 }] }
    })
  ]);
  ok('Birinchi to’lov saqlandi', r1.status === 200);
  ok('Ikkinchi to’lov saqlandi', r2.status === 200);
  const pays = await req('/api/collection?name=payments', { cookie: dirCookie });
  ok('Ikkala yozuv ham bazada', !!pays.json.items.par_1 && !!pays.json.items.par_2);
  ok('Chek raqamlari har xil',
    pays.json.items.par_1.receiptNo !== pays.json.items.par_2.receiptNo,
    pays.json.items.par_1.receiptNo + ' / ' + pays.json.items.par_2.receiptNo);

  section('   Takroriy so’rov');
  const dup1 = await req('/api/payment', {
    method: 'POST', cookie: adminCookie,
    body: { id: 'dup_1', studentId: 's1', amount: 50000, date: '2026-09-07', method: 'naqd', allocations: [] }
  });
  const dup2 = await req('/api/payment', {
    method: 'POST', cookie: adminCookie,
    body: { id: 'dup_1', studentId: 's1', amount: 50000, date: '2026-09-07', method: 'naqd', allocations: [] }
  });
  eq('Takroriy so’rov yangi chek yaratmadi', dup1.json.payment.receiptNo, dup2.json.payment.receiptNo);
  const allPays = await req('/api/collection?name=payments', { cookie: dirCookie });
  eq('dup_1 bitta yozuv', Object.keys(allPays.json.items).filter(k => k === 'dup_1').length, 1);

  /* ---------- 8. Pul qaytarish chegarasi ---------- */
  section('8. Pul qaytarish chegarasi');
  const refundBig = await req('/api/payment', {
    method: 'POST', cookie: dirCookie,
    body: { id: 'ref_big', type: 'refund', studentId: 's1', amount: 999999, date: '2026-09-08', refOf: 'dup_1', allocations: [] }
  });
  eq('To’lovdan ortiq qaytarish rad etildi', refundBig.status, 400);
  const refundOk = await req('/api/payment', {
    method: 'POST', cookie: dirCookie,
    body: { id: 'ref_1', type: 'refund', studentId: 's1', amount: 30000, date: '2026-09-08', refOf: 'dup_1', allocations: [] }
  });
  ok('Qisman qaytarish o’tdi', refundOk.status === 200, refundOk.text);
  const refundRest = await req('/api/payment', {
    method: 'POST', cookie: dirCookie,
    body: { id: 'ref_2', type: 'refund', studentId: 's1', amount: 25000, date: '2026-09-08', refOf: 'dup_1', allocations: [] }
  });
  eq('Qolganidan ortiq qaytarish rad etildi', refundRest.status, 400);

  /* ---------- 9. Taqsimot cheklovi ---------- */
  section('9. Hisobdan ortiq taqsimlash');
  const over = await req('/api/payment', {
    method: 'POST', cookie: dirCookie,
    body: { id: 'over_1', studentId: 's1', amount: 100000, date: '2026-09-09', allocations: [{ invoiceId: invId, amount: 900000 }] }
  });
  ok('Ortiqcha taqsimot cheklandi',
    over.status === 400 || (over.json.payment && over.json.payment.allocations.every(a => a.amount <= 500000)),
    over.text);

  /* ---------- 10. Boshqa o'quvchining hisobiga to'lov ---------- */
  section('10. Begona hisobga to’lov');
  const wrong = await req('/api/payment', {
    method: 'POST', cookie: dirCookie,
    body: { id: 'wrong_1', studentId: 's1', amount: 10000, date: '2026-09-10', allocations: [{ invoiceId: inv2, amount: 10000 }] }
  });
  eq('Begona hisobga yozish rad etildi', wrong.status, 400);

  /* ---------- 11. Tarix ---------- */
  section('11. O’zgarishlar tarixi');
  const audit = await req('/api/collection?name=audit', { cookie: dirCookie });
  const entries = Object.values(audit.json.items || {});
  ok('Tarixda yozuvlar bor', entries.length > 0);
  ok('Muallif serverdan yozilgan', entries.every(e => e.by && e.at));
  ok('Soxta yozuv tushmadi', !entries.some(e => e.action === 'soxta'));
  const auditForTeacher = await req('/api/collection?name=audit', { cookie: ustozCookie });
  eq('O’qituvchiga tarix yuborilmadi', Object.keys(auditForTeacher.json.items || {}).length, 0);

  /* ---------- 12. Zaxira nusxa API ---------- */
  section('12. Zaxira nusxa API');
  const bkTeacher = await req('/api/backup/state', { cookie: ustozCookie });
  eq('O’qituvchi zaxirani ko’ra olmadi', bkTeacher.status, 403);
  const bkAdmin = await req('/api/backup/state', { cookie: adminCookie });
  eq('Administrator ham ko’ra olmadi', bkAdmin.status, 403);
  const bkAnon = await req('/api/backup/state');
  eq('Kirmagan foydalanuvchi rad etildi', bkAnon.status, 401);

  const bkRun = await req('/api/backup/run', { method: 'POST', cookie: dirCookie });
  ok('Direktor zaxira oldi', bkRun.status === 200 && bkRun.json.file, bkRun.text);
  const bkState = await req('/api/backup/state', { cookie: dirCookie });
  ok('Holatda oxirgi zaxira ko’rinadi', !!(bkState.json.state && bkState.json.state.lastOkAt), bkState.text);
  ok('Fayllar ro’yxati bor', (bkState.json.files || []).length > 0);

  const bkName = bkRun.json.file.name;
  const bkFile = await req('/api/backup/file?name=' + encodeURIComponent(bkName), { cookie: dirCookie });
  ok('Zaxira fayli yuklab olindi', bkFile.status === 200 && !!bkFile.json.docs);
  const traversal = await req('/api/backup/file?name=' + encodeURIComponent('../../server/index.js'), { cookie: dirCookie });
  eq('Papkadan chiqishga urinish rad etildi', traversal.status, 404);

  const noConfirm = await req('/api/backup/restore', {
    method: 'POST', cookie: dirCookie, body: { name: bkName }
  });
  eq('Tasdiqlashsiz tiklash rad etildi', noConfirm.status, 400);
  const badDump = await req('/api/backup/restore', {
    method: 'POST', cookie: dirCookie,
    body: { confirm: 'TIKLASH', dump: { app: 'albyana-erp', docs: { 'students/x': { id: 'x' } } } }
  });
  eq('Foydalanuvchisiz zaxira rad etildi', badDump.status, 400);
  const teacherRestore = await req('/api/backup/restore', {
    method: 'POST', cookie: ustozCookie, body: { confirm: 'TIKLASH', name: bkName }
  });
  eq('O’qituvchi tiklay olmadi', teacherRestore.status, 403);

  // Haqiqiy tiklash: avval yangi yozuv qo'shamiz, tiklashdan keyin yo'qolishi kerak
  await put('rooms/zax_test', { id: 'zax_test', name: 'Sinov xonasi' }, dirCookie);
  const beforeRestore = await req('/api/doc?path=rooms/zax_test', { cookie: dirCookie });
  ok('Sinov yozuvi qo’shildi', !!(beforeRestore.json && beforeRestore.json.data));
  const doRestore = await req('/api/backup/restore', {
    method: 'POST', cookie: dirCookie, body: { confirm: 'TIKLASH', name: bkName }
  });
  ok('Tiklash bajarildi', doRestore.status === 200 && doRestore.json.ok, doRestore.text);
  ok('Tiklashdan oldingi zaxira saqlandi', !!doRestore.json.safety);
  const afterRestore = await req('/api/doc?path=rooms/zax_test', { cookie: dirCookie });
  ok('Zaxiradan keyingi yozuv o’chdi', !afterRestore.json || !afterRestore.json.data,
    JSON.stringify(afterRestore.json));
  const stillLogin = await login('admin', PASS);
  ok('Tiklashdan keyin kirish ishlaydi', !!stillLogin);
  const auditAfter = await req('/api/collection?name=audit', { cookie: stillLogin });
  ok('Tiklash tarixga yozildi',
    Object.values(auditAfter.json.items || {}).some(e => /tiklandi/i.test(e.action || '')));

  section('13. Kirishdan oldingi ochiq ma’lumot (/api/public)');
  const pub = await req('/api/public');
  ok('Kirishsiz ham javob beradi', pub.status === 200, String(pub.status));
  ok('Markaz nomi bor', !!(pub.json && pub.json.centerName), pub.text);
  const pubKeys = Object.keys(pub.json || {});
  ok('Faqat markaz nomi beriladi', pubKeys.length === 1 && pubKeys[0] === 'centerName',
    pubKeys.join(', '));
  ok('Maxfiy so’z chiqmadi',
    !/parol|token|hash|salt|DATABASE|secret/i.test(pub.text), pub.text.slice(0, 120));
  const pubPost = await req('/api/public', { method: 'POST', body: { centerName: 'Boshqa' } });
  ok('POST bilan o’zgartirib bo’lmaydi', pubPost.status !== 200, String(pubPost.status));

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
