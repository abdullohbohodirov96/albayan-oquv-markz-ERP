/* O'quvchi kabineti: shaxsiy kod, ma'lumot va himoya.
   Serverni alohida (sun'iy ma'lumotli) bazada ishga tushiring, keyin:
     node tests/kabinet-test.js [port] [direktor paroli]
   Noto'g'ri natijada YIQILADI (exit code 1).                                */
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
      opts.cookie ? { Cookie: opts.cookie } : {},
      opts.ip ? { 'X-Forwarded-For': opts.ip } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (path, data, cookie, extra) => req('/api/doc?path=' + encodeURIComponent(path),
  { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });
const get = (path, cookie) => req('/api/doc?path=' + encodeURIComponent(path), { cookie });
const kab = (code, ip) => req('/api/kabinet', { method: 'POST', body: { code }, ip });
async function login(l, p) {
  const r = await req('/api/login', { method: 'POST', body: { login: l, password: p } });
  return r.status === 200 ? r.cookie : null;
}

const R = 'k' + Date.now().toString(36);        // har bir ishga tushirish uchun alohida ID
const ID = n => R + '_' + n;

(async () => {
  const dir = await login('admin', PASS);
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  /* ---------- Sun'iy ma'lumot ---------- */
  section('0. Sinov ma’lumotlari (sun’iy)');
  await put('staff/' + ID('t1'), { id: ID('t1'), name: 'Ustoz Kabinet', status: 'faol', payType: 'fixed', salaryAmount: 1 }, dir);
  await put('rooms/' + ID('r1'), { id: ID('r1'), name: '3-xona', capacity: 12 }, dir);
  await put('courses/' + ID('c1'), { id: ID('c1'), name: 'Arab tili', monthlyFee: 400000, active: true }, dir);
  await put('groups/' + ID('g1'), {
    id: ID('g1'), code: 'K001', name: 'Kabinet guruhi', courseId: ID('c1'), teacherId: ID('t1'),
    roomId: ID('r1'), days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: '2026-09-01',
    fee: 400000, feeHistory: [{ fee: 400000, from: '2026-09' }], limit: 10, status: 'faol'
  }, dir);

  const s1 = await put('students/' + ID('s1'),
    { id: ID('s1'), firstName: 'Abdulloh', lastName: 'Bahodirov', phone: '+998901112233', parentName: 'Ota Bahodirov', parentPhone: '+998901112255', status: 'faol' }, dir);
  const s2 = await put('students/' + ID('s2'),
    { id: ID('s2'), firstName: 'Zuhra', lastName: 'Karimova', phone: '+998901112244', status: 'faol' }, dir);
  eq('O’quvchilar yaratildi', s1.status + s2.status, 400);

  await put('memberships/' + ID('m1'), { id: ID('m1'), studentId: ID('s1'), groupId: ID('g1'), joinedAt: '2026-09-01', status: 'faol' }, dir);
  await put('memberships/' + ID('m2'), { id: ID('m2'), studentId: ID('s2'), groupId: ID('g1'), joinedAt: '2026-09-01', status: 'faol' }, dir);

  /* ---------- 1. Kod ---------- */
  section('1. Har bir o’quvchiga shaxsiy kod beriladi');
  const st1 = (await get('students/' + ID('s1'), dir)).json.data;
  const st2 = (await get('students/' + ID('s2'), dir)).json.data;
  ok('Birinchisida kod bor: ' + st1.code, /^\d{4}$/.test(String(st1.code)), JSON.stringify(st1.code));
  ok('Ikkinchisida kod bor: ' + st2.code, /^\d{4}$/.test(String(st2.code)), JSON.stringify(st2.code));
  ok('Kodlar har xil', st1.code !== st2.code, st1.code + ' / ' + st2.code);

  section('   Kod o’zgarmaydi va mijoz uni almashtira olmaydi');
  await put('students/' + ID('s1'),
    Object.assign({}, st1, { firstName: 'Abdulloh', note: 'tahrir' }), dir);
  const again = (await get('students/' + ID('s1'), dir)).json.data;
  eq('Tahrirdan keyin ham o’sha kod', again.code, st1.code);
  await put('students/' + ID('s1'), Object.assign({}, st1, { code: '9999' }), dir);
  const forced = (await get('students/' + ID('s1'), dir)).json.data;
  eq('Qo’lda yozilgan kod qabul qilinmadi', forced.code, st1.code);

  /* ---------- 2. Kabinet ---------- */
  section('2. Kod bo’yicha ma’lumot (kirishsiz)');
  const wrongLen = await kab('40');
  eq('Qisqa kod rad etildi', wrongLen.status, 400);

  const r1 = await kab(st1.code);
  eq('To’g’ri kod bilan ochildi', r1.status, 200);
  const d = r1.json || {};
  eq('Ism to’g’ri', (d.student || {}).name, 'Bahodirov Abdulloh');
  eq('Kod javobda', (d.student || {}).code, String(st1.code));
  ok('Guruh ko’rsatilgan', (d.groups || []).some(g => g.name === 'Kabinet guruhi'), JSON.stringify(d.groups));
  const g0 = (d.groups || [])[0] || {};
  eq('O’qituvchi', g0.teacher, 'Ustoz Kabinet');
  eq('Dars vaqti', g0.startTime + '–' + g0.endTime, '09:00–10:30');
  eq('Xona', g0.room, '3-xona');
  ok('Dars kunlari', /Dushanba/.test(g0.daysText || ''), g0.daysText);
  ok('Keyingi to’lov ma’lumoti bor', !!(d.finance && d.finance.next), JSON.stringify(d.finance));
  ok('Davomat bo’limi bor', !!d.attendance, JSON.stringify(d.attendance));

  section('   Maxfiy ma’lumot yuborilmaydi');
  ok('Telefon yo’q', !/998901112233/.test(r1.text), r1.text.slice(0, 200));
  ok('Ota-ona ma’lumoti yo’q', !/Ota Bahodirov|998901112255/.test(r1.text));
  ok('Parol/hash yo’q', !/hash|salt|pbkdf2/i.test(r1.text));
  ok('Boshqa o’quvchi yo’q', !/Zuhra|Karimova/.test(r1.text));

  section('   Har kim faqat o’zinikini ko’radi');
  const r2 = await kab(st2.code);
  eq('Ikkinchi kod ishladi', r2.status, 200);
  eq('Ikkinchi o’quvchi ismi', (r2.json.student || {}).name, 'Karimova Zuhra');
  ok('Birinchisining ismi chiqmadi', !/Bahodirov/.test(r2.text));

  /* ---------- 3. Pul va davomat to'g'rimi ---------- */
  section('3. To’lov va davomat sonlari to’g’ri');
  const gen = await req('/api/invoices/generate', { method: 'POST', body: { month: '2026-09' }, cookie: dir });
  ok('Hisoblar yaratildi', gen.status === 200, gen.text.slice(0, 120));

  const inv = await req('/api/collection?name=invoices', { cookie: dir });
  const myInv = Object.values(inv.json.items || {}).filter(i => i.studentId === ID('s1'))[0];
  ok('O’quvchiga hisob chiqdi', !!myInv, JSON.stringify(Object.keys(inv.json.items || {}).length));

  const r3 = await kab(st1.code);
  const f = r3.json.finance;
  eq('Qarz hisobga mos', f.debt, myInv ? Math.round(myInv.final) : 0);
  eq('Keyingi to’lov summasi', f.next.amount, myInv ? Math.round(myInv.final) : 0);
  eq('Keyingi to’lov oyi', f.next.month, '2026-09');
  ok('To’lov sanasi bor', /^\d{4}-\d{2}-\d{2}$/.test(f.next.dueDate), f.next.dueDate);

  // qisman to'lov
  const payRes = await req('/api/payment', {
    method: 'POST', cookie: dir,
    body: {
      id: ID('pay1'), studentId: ID('s1'), amount: 100000, date: '2026-09-10', method: 'naqd',
      allocations: myInv ? [{ invoiceId: myInv.id, amount: 100000 }] : []
    }
  });
  ok('To’lov qabul qilindi', payRes.status === 200, payRes.text.slice(0, 120));
  const r4 = await kab(st1.code);
  eq('Qarz kamaydi', r4.json.finance.debt, (myInv ? Math.round(myInv.final) : 0) - 100000);
  eq('To’langan ko’rinadi', r4.json.finance.received, 100000);

  // davomat
  await put('lessons/' + ID('g1') + '__2026-09', {
    id: ID('g1') + '__2026-09',
    items: {
      '2026-09-02': { attendance: { [ID('m1')]: { status: 'keldi' }, [ID('m2')]: { status: 'keldi' } } },
      '2026-09-07': { attendance: { [ID('m1')]: { status: 'kelmadi' } } },
      '2026-09-09': { attendance: { [ID('m1')]: { status: 'kechikdi' } } },
      '2026-09-14': { attendance: { [ID('m1')]: { status: 'sababli' } } }
    }
  }, dir);
  const r5 = await kab(st1.code);
  const a = r5.json.attendance;
  eq('Jami dars', a.total, 4);
  eq('Keldi (kechikdi bilan)', a.attended, 2);
  eq('Kelmadi', a.missed, 1);
  eq('Kechikdi', a.late, 1);
  eq('Sababli', a.excused, 1);
  eq('Foiz', a.percent, 50);
  ok('Oxirgi darslar ro’yxati', (a.last || []).length === 4, JSON.stringify(a.last));

  /* ---------- 4. Himoya ---------- */
  section('4. Kodni taxmin qilishdan himoya');
  // Har bir ishga tushirish uchun boshqa manzil — oldingi qulf xalaqit bermasin
  const FAKE_IP = '203.0.113.' + (2 + Math.floor(Math.random() * 250));   // RFC 5737 sinov manzili
  let locked = false, lockAt = 0;
  for (let i = 0; i < 12; i++) {
    const guess = String(1000 + i) === String(st1.code) ? '9998' : String(1000 + i);
    const r = await kab(guess, FAKE_IP);
    if (r.status === 429) { locked = true; lockAt = i + 1; break; }
  }
  ok('Ko’p noto’g’ri urinishdan keyin qulflandi (' + lockAt + '-urinish)', locked);
  const afterLock = await kab(st1.code, FAKE_IP);
  eq('Qulf paytida to’g’ri kod ham kutadi', afterLock.status, 429);
  ok('Javobda ogohlantirish bor', /urinish/i.test(afterLock.text), afterLock.text);

  section('   Noto’g’ri kod javobi hech narsani oshkor qilmaydi');
  ok('Javobda ism yo’q', !/Bahodirov|Karimova/.test(afterLock.text));

  section('   Qulf faqat o’sha manzilga tegishli');
  const other = await kab(st1.code);
  eq('Boshqa manzil ishlayveradi', other.status, 200);

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: qulf sinovi alohida (soxta) IP bilan bajarildi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
