/* Avtomatik oylik hisoblar sinovi.
   Serverni alohida baza bilan ishga tushiring, keyin:
     node tests/autoinvoice-test.js [port] [parol]                          */
'use strict';
const PORT = process.argv[2] || 3311;
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
/** faqat shu sinov yaratgan guruhning hisoblari */
function mine(res) {
  return Object.values((res.json && res.json.items) || {}).filter(i => i.groupId === 'aig1');
}
function thisMonth() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

(async () => {
  const cookie = (await req('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } })).cookie;
  ok('Kirish ishladi', !!cookie);
  const put = (p, data) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie, body: { data } });
  const ym = thisMonth();

  /* --- Oldingi sinovdan qolgan holatni tozalaymiz --- */
  const s0 = (await req('/api/doc?path=meta/settings', { cookie })).json.data || {};
  s0.autoInvoice = { enabled: false, day: 1 };
  await put('meta/settings', s0);
  await put('meta/autoinvoice', {});
  for (const p2 of ['memberships/aim4', 'memberships/aim5', 'students/ai5', 'students/ai4']) {
    await req('/api/doc?path=' + encodeURIComponent(p2), { method: 'DELETE', cookie });
  }
  const before = await req('/api/collection?name=invoices', { cookie });
  for (const inv of mine(before)) {
    await req('/api/doc?path=' + encodeURIComponent('invoices/' + inv.id), { method: 'DELETE', cookie });
  }
  const left = mine(await req('/api/collection?name=invoices', { cookie })).length;
  ok('Sinov toza holatdan boshladi', left === 0, left + ' ta eski hisob qoldi');

  /* --- Sun'iy ma'lumot --- */
  await put('students/ai1', { id: 'ai1', firstName: 'Bir', lastName: 'Sinov', status: 'faol' });
  await put('students/ai2', { id: 'ai2', firstName: 'Ikki', lastName: 'Sinov', status: 'faol' });
  await put('students/ai3', { id: 'ai3', firstName: 'Uch', lastName: 'Arxiv', status: 'arxiv' });
  await put('groups/aig1', {
    id: 'aig1', code: 'AI01', name: 'Sinov guruh', status: 'faol', fee: 400000,
    days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: ym + '-01'
  });
  await put('memberships/aim1', { id: 'aim1', studentId: 'ai1', groupId: 'aig1', status: 'faol', joinedAt: ym + '-01' });
  await put('memberships/aim2', { id: 'aim2', studentId: 'ai2', groupId: 'aig1', status: 'faol', joinedAt: ym + '-01' });
  await put('memberships/aim3', { id: 'aim3', studentId: 'ai3', groupId: 'aig1', status: 'faol', joinedAt: ym + '-01' });
  /* To'lov kuni HALI KELMAGAN o'quvchi: oyning 28-sida qo'shilgan.
     Uning hisobi bugun yaratilmasligi kerak (agar bugun 28 dan
     oldin bo'lsa).                                              */
  await put('students/ai5', { id: 'ai5', firstName: 'Besh', lastName: 'Keyinroq', status: 'faol' });
  await put('memberships/aim5', { id: 'aim5', studentId: 'ai5', groupId: 'aig1', status: 'faol', joinedAt: ym + '-28' });

  /* --- 1. O'chirilgan holatda ishlamaydi --- */
  section('1. O’chirilgan bo’lsa hech nima qilmaydi');
  const st0 = await req('/api/invoices/auto', { cookie });
  ok('Holat o’qildi', st0.status === 200, st0.text);
  eq('Standart holatda o’chirilgan', (st0.json.conf || {}).enabled, false);
  const run0 = await req('/api/invoices/auto/run', { method: 'POST', cookie });
  eq('"off" deb qaytardi', run0.json.off, true);
  const inv0 = await req('/api/collection?name=invoices', { cookie });
  eq('Hisob yaratilmadi', mine(inv0).length, 0);

  /* --- 2. Har o'quvchining O'Z kuni --- */
  section('2. To’lov kuni kelmaganga hisob yozilmaydi');
  const settings = (await req('/api/doc?path=meta/settings', { cookie })).json.data;
  settings.autoInvoice = { enabled: true };
  await put('meta/settings', settings);
  const today = new Date(Date.now() + 5 * 3600 * 1000).getUTCDate();
  const run1 = await req('/api/invoices/auto/run', { method: 'POST', cookie });
  ok('Ishga tushdi', run1.status === 200, run1.text.slice(0, 160));
  const inv1list = mine(await req('/api/collection?name=invoices', { cookie }));
  if (today < 28) {
    ok('28-sida qo’shilganga hali hisob yo’q',
      !inv1list.some(i => i.membershipId === 'aim5'),
      JSON.stringify(inv1list.map(i => i.membershipId)));
    ok('Kutayotganlar sanaldi', (run1.json.waiting || 0) >= 1, JSON.stringify(run1.json));
  } else {
    ok('Bugun 28-kundan keyin — bu qism o’tkazib yuborildi', true);
  }

  /* --- 3. Kuni kelganlarga yaratadi --- */
  section('3. Kuni kelganlarga hisob yaratiladi');
  const run2 = { json: run1.json, status: run1.status };
  ok('Kamida ikkita hisob yaratildi (' + run2.json.created + ')', run2.json.created >= 2, JSON.stringify(run2.json));
  ok('Oy yozildi', run2.json.lastMonth === ym, run2.json.lastMonth);
  const inv2 = await req('/api/collection?name=invoices', { cookie });
  const invoices = mine(inv2);
  ok('Sinov guruhida kamida 2 ta hisob', invoices.length >= 2, String(invoices.length));
  ok('Arxivdagi o’quvchiga yaratilmadi', !invoices.some(i => i.studentId === 'ai3'));
  ok('Summa guruh narxidan olindi', invoices.every(i => i.final === 400000),
    JSON.stringify(invoices.map(i => i.final)));
  ok('Muddat qo’yildi', invoices.every(i => !!i.dueDate));
  ok('Muallif "tizim"', invoices.every(i => i.createdBy === 'tizim'), invoices[0] && invoices[0].createdBy);

  /* --- 4. Ikki marta yaratmaydi --- */
  section('4. Ikkinchi marta takrorlanmaydi');
  const run3 = await req('/api/invoices/auto/run', { method: 'POST', cookie });
  eq('Yangi hisob yaratilmadi', run3.json.created, 0);
  const inv3 = await req('/api/collection?name=invoices', { cookie });
  eq('Hisoblar soni o’zgarmadi', mine(inv3).length, 2);

  /* --- 5. Yangi o'quvchi qo'shilsa, qayta ishga tushirishda faqat unga --- */
  section('5. Yangi o’quvchiga hisob qo’shiladi (takrorsiz)');
  await put('students/ai4', { id: 'ai4', firstName: 'To’rt', lastName: 'Sinov', status: 'faol' });
  await put('memberships/aim4', { id: 'aim4', studentId: 'ai4', groupId: 'aig1', status: 'faol', joinedAt: ym + '-05' });
  /* Qo'lda yaratish HAMMASIGA yozadi — kuni kelmaganlarga ham.
     Avtomatik yo'l esa faqat kuni kelganlarga: ikkisi ataylab
     farq qiladi, chunki qo'lda yaratish rahbarning qarori.     */
  const before5 = mine(await req('/api/collection?name=invoices', { cookie })).length;
  const manual = await req('/api/invoices/generate', { method: 'POST', cookie, body: { month: ym } });
  ok('Yangi hisob(lar) yaratildi (' + manual.json.created + ')', manual.json.created >= 1,
    JSON.stringify(manual.json));
  ok('Mavjudlari o’tkazib yuborildi (' + manual.json.skipped + ')', manual.json.skipped >= 2, String(manual.json.skipped));
  const after5 = mine(await req('/api/collection?name=invoices', { cookie })).length;
  eq('Soni yaratilganicha oshdi', after5, before5 + manual.json.created);
  ok('Yangi o’quvchiga ham hisob bor',
    mine(await req('/api/collection?name=invoices', { cookie })).some(i => i.membershipId === 'aim4'));

  /* --- 6. Holat va direktorga xabar --- */
  section('6. Natija saqlanadi va direktorga xabar boradi');
  const st1 = await req('/api/invoices/auto', { cookie });
  ok('Oxirgi ishga tushirish vaqti bor', !!st1.json.state.lastRunAt, JSON.stringify(st1.json.state));
  ok('Bugun yaratilgan soni saqlandi (' + st1.json.state.createdToday + ')',
    (st1.json.state.createdToday || 0) >= 2, JSON.stringify(st1.json.state));
  ok('Xato yo’q', !st1.json.state.lastError);

  const chats = await req('/api/collection?name=chats', { cookie });
  const sys = Object.values(chats.json.items || {}).filter(c => /sys__/.test(c.id))[0];
  ok('Tizim suhbati yaratildi', !!sys, JSON.stringify(Object.keys(chats.json.items || {})));
  ok('Xabar matni tushunarli', !!sys && sys.messages.some(m => /avtomatik yaratildi/i.test(m.text)),
    sys && JSON.stringify(sys.messages.map(m => m.text)));

  /* --- 7. Ruxsatsiz foydalanuvchi --- */
  section('7. Ruxsatsiz foydalanuvchi sozlay olmaydi');
  await req('/api/doc?path=' + encodeURIComponent('users/ai_ustoz'), {
    method: 'PUT', cookie,
    body: {
      data: { id: 'ai_ustoz', login: 'ai_ustoz', name: 'Ustoz', role: 'oqituvchi', active: true },
      password: 'Ustoz12345'
    }
  });
  const uc = (await req('/api/login', { method: 'POST', body: { login: 'ai_ustoz', password: 'Ustoz12345' } })).cookie;
  ok('O’qituvchi kirdi', !!uc);
  eq('Holatni ko’ra olmadi', (await req('/api/invoices/auto', { cookie: uc })).status, 403);
  eq('Ishga tushira olmadi', (await req('/api/invoices/auto/run', { method: 'POST', cookie: uc })).status, 403);

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
