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
/* Kabinetga ikki yo'l bilan kiriladi:
   1) o'quvchi 4 xonali shaxsiy kodini yozadi (asosiy yo'l);
   2) administrator bergan bir martalik havola sessiyaga almashadi. */
let DIRC = null;
async function kabLink(studentId) {
  return req('/api/student/link', { method: 'POST', cookie: DIRC, body: { studentId } });
}
async function kab(studentId, ip) {
  const mk = await kabLink(studentId);
  if (mk.status !== 200) return mk;
  const ses = await req('/api/kabinet/session', { method: 'POST', body: { token: mk.json.token }, ip });
  if (ses.status !== 200) return ses;
  return req('/api/kabinet/me', { cookie: ses.cookie, ip });
}
/* 4 xonali kod bilan kirish */
const kabByCode = (code, ip) => req('/api/kabinet', { method: 'POST', body: { code }, ip });
async function login(l, p) {
  const r = await req('/api/login', { method: 'POST', body: { login: l, password: p } });
  return r.status === 200 ? r.cookie : null;
}

const R = 'k' + Date.now().toString(36);        // har bir ishga tushirish uchun alohida ID
const ID = n => R + '_' + n;
/* Guruh kodi endi takrorlanmasligi shart (server tekshiradi),
   shuning uchun har bir ishga tushirishda alohida kod olinadi. */
const GCODE = 'K' + R.slice(-5).toUpperCase();

(async () => {
  const dir = await login('admin', PASS);
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  /* ---------- Sun'iy ma'lumot ---------- */
  section('0. Sinov ma’lumotlari (sun’iy)');
  await put('staff/' + ID('t1'), { id: ID('t1'), name: 'Ustoz Kabinet', status: 'faol', payType: 'fixed', salaryAmount: 1 }, dir);
  await put('rooms/' + ID('r1'), { id: ID('r1'), name: '3-xona', capacity: 12 }, dir);
  await put('courses/' + ID('c1'), { id: ID('c1'), name: 'Arab tili', monthlyFee: 400000, active: true }, dir);
  await put('groups/' + ID('g1'), {
    id: ID('g1'), code: GCODE, name: 'Kabinet guruhi', courseId: ID('c1'), teacherId: ID('t1'),
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

  section('   Kod o’z-o’zidan o’zgarmaydi, lekin markaz uni bera oladi');
  await put('students/' + ID('s1'),
    Object.assign({}, st1, { firstName: 'Abdulloh', note: 'tahrir' }), dir);
  const again = (await get('students/' + ID('s1'), dir)).json.data;
  eq('Tahrirdan keyin ham o’sha kod', again.code, st1.code);

  /* Kod yuborilmasa ham eskisi qoladi */
  const bare = Object.assign({}, again); delete bare.code;
  await put('students/' + ID('s1'), bare, dir);
  const kept = (await get('students/' + ID('s1'), dir)).json.data;
  eq('Kod yuborilmasa ham saqlanadi', kept.code, st1.code);

  /* Markaz rahbari kodni ataylab bera oladi (band bo'lmasa) */
  const wantCode = String(1000 + ((Number(st1.code) + 137) % 8999));
  const free = wantCode !== String(st2.code);
  if (free) {
    const setRes = await put('students/' + ID('s1'), Object.assign({}, kept, { code: wantCode }), dir);
    const changed = (await get('students/' + ID('s1'), dir)).json.data;
    ok('Markaz kodni o’zi bera oladi',
      setRes.status === 200 && changed.code === wantCode,
      'status ' + setRes.status + ', kod ' + changed.code);
    /* Orqaga qaytaramiz — keyingi sinovlar eski kod bilan ishlaydi */
    await put('students/' + ID('s1'), Object.assign({}, changed, { code: st1.code }), dir);
    const back = (await get('students/' + ID('s1'), dir)).json.data;
    eq('Eski kodga qaytarildi', back.code, st1.code);
  }

  /* Band kod rad etiladi va egasi o'zgarmaydi */
  const busy = await put('students/' + ID('s1'),
    Object.assign({}, kept, { code: String(st2.code) }), dir);
  eq('Band kod rad etildi', busy.status, 400);
  const afterBusy = (await get('students/' + ID('s1'), dir)).json.data;
  eq('Rad etilgandan keyin kod o’zgarmadi', afterBusy.code, st1.code);
  const owner = (await get('students/' + ID('s2'), dir)).json.data;
  eq('Kod egasi ham o’zgarmadi', owner.code, st2.code);

  /* ---------- 2. Kabinet ---------- */
  DIRC = dir;
  section('2. Kabinet 4 xonali kod bilan ham, havola bilan ham ochiladi');
  const noSes = await req('/api/kabinet/me');
  eq('Sessiyasiz ma’lumot berilmaydi', noSes.status, 401);

  /* Markaz rahbari tanlagan yo'l: faqat kod. Kod maxfiy emas — shuning uchun
     pastda taxmin qilishga qarshi cheklov va begona kodni ko'rmaslik sinaladi. */
  const byCode = await kabByCode(st1.code, '203.0.113.41');
  eq('To’g’ri kod bilan ochildi', byCode.status, 200);
  eq('O’z ismi chiqdi', (byCode.json.student || {}).name, 'Bahodirov Abdulloh');
  ok('Begona o’quvchi ko’rinmadi', !/Zuhra|Karimova/.test(byCode.text));
  ok('Telefon chiqmadi', !/998901112233/.test(byCode.text), byCode.text.slice(0, 160));
  ok('Kirgandan keyin sessiya berildi', /alb_kab=/.test(byCode.cookie || ''), byCode.cookie);
  const mine = await req('/api/kabinet/me', { cookie: (byCode.cookie || '').split(';')[0] });
  eq('Sessiya bilan qayta ochildi (kod so’ralmaydi)', mine.status, 200);
  eq('Sessiyadagi ism o’sha', (mine.json.student || {}).name, 'Bahodirov Abdulloh');

  const wrong = await kabByCode('0000' === String(st1.code) ? '0001' : '0000', '203.0.113.42');
  ok('Noto’g’ri kod rad etildi', wrong.status === 404, String(wrong.status));
  ok('Noto’g’ri kodda ism chiqmadi', !/Bahodirov|Karimova/.test(wrong.text), wrong.text.slice(0, 120));
  const short = await kabByCode('12', '203.0.113.43');
  eq('Qisqa kod rad etildi', short.status, 400);

  const r1 = await kab(ID('s1'));
  eq('Havola bilan ochildi', r1.status, 200);
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
  const r2 = await kab(ID('s2'));
  eq('Ikkinchi o’quvchi havolasi ishladi', r2.status, 200);
  eq('Ikkinchi o’quvchi ismi', (r2.json.student || {}).name, 'Karimova Zuhra');
  ok('Birinchisining ismi chiqmadi', !/Bahodirov/.test(r2.text));

  /* ---------- 3. Pul va davomat to'g'rimi ---------- */
  section('3. To’lov va davomat sonlari to’g’ri');
  const gen = await req('/api/invoices/generate', { method: 'POST', body: { month: '2026-09' }, cookie: dir });
  ok('Hisoblar yaratildi', gen.status === 200, gen.text.slice(0, 120));

  const inv = await req('/api/collection?name=invoices', { cookie: dir });
  const myInv = Object.values(inv.json.items || {}).filter(i => i.studentId === ID('s1'))[0];
  ok('O’quvchiga hisob chiqdi', !!myInv, JSON.stringify(Object.keys(inv.json.items || {}).length));

  const r3 = await kab(ID('s1'));
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
  const r4 = await kab(ID('s1'));
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
  const r5 = await kab(ID('s1'));
  const a = r5.json.attendance;
  eq('Jami dars', a.total, 4);
  eq('Keldi (kechikdi bilan)', a.attended, 2);
  eq('Kelmadi', a.missed, 1);
  eq('Kechikdi', a.late, 1);
  eq('Sababli', a.excused, 1);
  eq('Foiz', a.percent, 50);
  ok('Oxirgi darslar ro’yxati', (a.last || []).length === 4, JSON.stringify(a.last));

  /* ---------- 4. Himoya ---------- */
  section('   Ishlatilgan havola qayta ishlamaydi');
  const once = await kabLink(ID('s1'));
  const s1a = await req('/api/kabinet/session', { method: 'POST', body: { token: once.json.token } });
  eq('Birinchi marta ishladi', s1a.status, 200);
  const s1b = await req('/api/kabinet/session', { method: 'POST', body: { token: once.json.token } });
  eq('Ikkinchi marta rad etildi', s1b.status, 401);

  section('   Bog’lanish bekor qilinsa, sessiya ham yopiladi');
  const live = await kabLink(ID('s2'));
  const liveSes = await req('/api/kabinet/session', { method: 'POST', body: { token: live.json.token } });
  eq('Sessiya ochildi', liveSes.status, 200);
  eq('Ma’lumot ko’rinadi', (await req('/api/kabinet/me', { cookie: liveSes.cookie })).status, 200);
  const un = await req('/api/student/unlink', { method: 'POST', cookie: dir, body: { studentId: ID('s2') } });
  eq('Bekor qilindi', un.status, 200);
  const after = await req('/api/kabinet/me', { cookie: liveSes.cookie });
  eq('Eski sessiya endi ishlamaydi', after.status, 401);
  ok('Javobda ism yo’q', !/Karimova/.test(after.text), after.text.slice(0, 120));


  /* Qulflash sinovi ALOHIDA server nusxasida bajariladi: u IP ni qulflaydi,
     shuning uchun asosiy serverga va boshqa sinovlarga xalaqit bermaydi.   */
  section('   Havolani taxmin qilishdan himoya (alohida server nusxasida)');
  {
    const { spawn } = require('child_process');
    const fs2 = require('fs'); const os2 = require('os'); const path2 = require('path');
    const dir2 = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'albayan-kablock-'));
    const port2 = 3600 + Math.floor(Math.random() * 300);
    const srv = spawn(process.execPath, [path2.join(__dirname, '..', 'server', 'index.js')], {
      env: Object.assign({}, process.env, {
        DATA_DIR: dir2, DB_DRIVER: 'sqlite', PORT: String(port2),
        BACKUP_DIR: path2.join(dir2, 'backups'), SEED_DIRECTOR_PASSWORD: 'Albyana2026!'
      }),
      stdio: 'ignore'
    });
    const B2 = 'http://localhost:' + port2;
    const tryToken = (tok) => fetch(B2 + '/api/kabinet/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tok })
    }).then(r => r.status).catch(() => 0);

    for (let i = 0; i < 40; i++) {                      // server ko'tarilguncha kutamiz
      const st = await fetch(B2 + '/api/health').then(r => r.status).catch(() => 0);
      if (st === 200) break;
      await new Promise(r => setTimeout(r, 300));
    }
    let locked = false, lockAt = 0;
    for (let i = 0; i < 12; i++) {
      const st = await tryToken('lt00000000000' + i + '.AAAAAAAAAAAAAAAAAAAAAA');
      if (st === 429) { locked = true; lockAt = i + 1; break; }
    }
    ok('Ko’p noto’g’ri havoladan keyin qulflandi (' + lockAt + '-urinish)', locked);
    const st2 = await tryToken('lt000000000099.AAAAAAAAAAAAAAAAAAAAAA');
    eq('Qulf paytida ham kutadi', st2, 429);

    /* 4 xonali kodni ketma-ket taxmin qilish ham shu qulfga tushadi.
       (Qulf yuqorida allaqachon yopilgan — demak kod yo'li ham yopiq.) */
    const tryCode = (c) => fetch(B2 + '/api/kabinet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: c })
    }).then(async r => ({ st: r.status, t: await r.text() })).catch(() => ({ st: 0, t: '' }));
    const guess = await tryCode('4077');
    eq('Qulflangan IP kod bilan ham kira olmaydi', guess.st, 429);
    ok('Qulflanganda ma’lumot chiqmaydi', !/"student"/.test(guess.t), guess.t.slice(0, 120));
    try { srv.kill(); } catch (e) { }
    try { fs2.rmSync(dir2, { recursive: true, force: true }); } catch (e) { }
  }

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: qulf sinovi alohida (soxta) IP bilan bajarildi; haqiqiy odamga xabar yuborilmadi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
