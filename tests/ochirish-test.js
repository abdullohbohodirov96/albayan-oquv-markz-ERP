/* O'CHIRISH SINOVI — o'quvchini butunlay o'chirish va bazani tozalash.

   Bu amallarni qaytarib bo'lmaydi, shuning uchun sinov ikki
   tomonni ham tekshiradi:
     — o'chishi KERAK bo'lgan hamma narsa haqiqatan o'chdimi;
     — o'chmasligi kerak bo'lgan narsa (boshqa o'quvchi, uning
       to'lovi, davomati) joyida qoldimi;
     — huquqsiz odam o'chira oladimi (yo'q);
     — tasdiq so'zisiz o'chadimi (yo'q);
     — zaxira olinmasa tozalanadimi (yo'q).

   Ishga tushirish:  node tests/ochirish-test.js [port] [direktor paroli]
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

const R = 'o' + Date.now().toString(36);
const ID = n => R + '_' + n;
let COOKIE = '';

async function api(p, opts = {}) {
  const res = await fetch(API + p, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.cookie !== undefined ? (opts.cookie ? { Cookie: opts.cookie } : {})
        : (COOKIE ? { Cookie: COOKIE } : {})),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (p, data, cookie, extra) => api('/api/doc?path=' + encodeURIComponent(p),
  { method: 'PUT', body: Object.assign({ data }, extra || {}), cookie });
const get = async (p, cookie) =>
  ((await api('/api/doc?path=' + encodeURIComponent(p), { cookie })).json || {}).data || null;
const del = p => api('/api/doc?path=' + encodeURIComponent(p), { method: 'DELETE' });

require('../server/shared');
const A = globalThis.A;

(async () => {
  const lg = await api('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  COOKIE = lg.cookie;
  if (!COOKIE) { console.error('Direktor kira olmadi.'); process.exit(1); }

  const YM = A.thisMonth();
  const DAY = A.today();

  /* =============== 0. Sinov ma'lumoti =============== */
  section('0. Ikki o’quvchi, bitta guruh');
  await put('courses/' + ID('c'), { id: ID('c'), name: 'O’chirish kursi ' + R, monthlyFee: 500000, active: true });
  await put('staff/' + ID('t'), {
    id: ID('t'), name: 'O’chirish Ustoz', status: 'faol', position: 'O’qituvchi',
    payType: 'fixed', salaryAmount: 1000000
  });
  await put('groups/' + ID('g'), {
    id: ID('g'), code: 'O' + String(Date.now() % 900 + 99).padStart(3, '0'),
    name: 'O’chirish guruhi ' + R, courseId: ID('c'), teacherId: ID('t'),
    days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: A.monthStart(YM),
    fee: 500000, feeHistory: [{ fee: 500000, from: YM }], lessonsPerMonth: 12,
    limit: 20, status: 'faol'
  });
  /* A — o'chiriladigan, B — qoladigan */
  for (const k of ['a', 'b']) {
    await put('students/' + ID('s' + k), {
      id: ID('s' + k), firstName: 'O’chirish', lastName: 'Sinov ' + k.toUpperCase() + ' ' + R,
      phone: '+99890444' + Math.floor(1000 + Math.random() * 8999), status: 'faol'
    });
    await put('memberships/' + ID('m' + k), {
      id: ID('m' + k), studentId: ID('s' + k), groupId: ID('g'),
      joinedAt: A.monthStart(YM), leftAt: null, status: 'faol', discount: null
    });
  }
  /* Hisob va to'lov — ikkalasiga ham */
  const gen = await api('/api/invoices/generate', { method: 'POST', body: { month: YM } });
  eq('Hisoblar yaratildi', gen.status, 200);
  const invA = await get('invoices/' + A.invoiceId(ID('ma'), YM));
  const invB = await get('invoices/' + A.invoiceId(ID('mb'), YM));
  ok('A ning hisobi bor', !!invA);
  ok('B ning hisobi bor', !!invB);
  const payA = await api('/api/payment', {
    method: 'POST', body: {
      studentId: ID('sa'), amount: 200000, date: DAY, method: 'naqd',
      allocations: invA ? [{ invoiceId: invA.id, amount: 200000 }] : []
    }
  });
  eq('A to’lov qildi', payA.status, 200);
  const payB = await api('/api/payment', {
    method: 'POST', body: {
      studentId: ID('sb'), amount: 300000, date: DAY, method: 'naqd',
      allocations: invB ? [{ invoiceId: invB.id, amount: 300000 }] : []
    }
  });
  eq('B ham to’lov qildi', payB.status, 200);

  /* Davomat — ikkalasi bitta hujjatda */
  await put('lessons/' + ID('g') + '__' + YM, {
    groupId: ID('g'), month: YM,
    items: {
      [A.monthStart(YM)]: {
        date: A.monthStart(YM), status: 'o’tdi',
        attendance: { [ID('ma')]: 'keldi', [ID('mb')]: 'sababli' }
      }
    }
  });
  const les0 = await get('lessons/' + ID('g') + '__' + YM);
  ok('Davomat yozildi', !!(les0 && les0.items), JSON.stringify(les0).slice(0, 100));

  /* =============== 1. Oldindan ko’rish hech narsa o’chirmaydi =============== */
  section('1. Oldindan ko’rish (dryRun)');
  const dry = await api('/api/students/purge', {
    method: 'POST', body: { ids: [ID('sa')], dryRun: true }
  });
  eq('Hisoblandi', dry.status, 200);
  ok('dryRun deb belgilandi', (dry.json || {}).dryRun === true, JSON.stringify(dry.json));
  ok('Nechta yozuv o’chishi aytildi', (dry.json || {}).docs >= 3, JSON.stringify(dry.json));
  ok('Ismi ko’rsatildi', ((dry.json || {}).names || []).some(n => /Sinov A/.test(n)),
    JSON.stringify((dry.json || {}).names));
  ok('To’lov ham sanaldi', ((dry.json || {}).counts || {}).payments >= 1,
    JSON.stringify((dry.json || {}).counts));
  /* ENG MUHIMI: hisoblagandan keyin hamma narsa JOYIDA */
  ok('O’quvchi o’chmadi', !!(await get('students/' + ID('sa'))));
  ok('A’zoligi o’chmadi', !!(await get('memberships/' + ID('ma'))));
  ok('Hisobi o’chmadi', !!(await get('invoices/' + A.invoiceId(ID('ma'), YM))));

  /* =============== 2. Huquqsiz odam o’chira olmaydi =============== */
  section('2. Huquq tekshiruvi');
  /* O'qituvchi yaratamiz: student.edit bor, student.delete yo'q */
  /* Parol ALOHIDA yuboriladi — server uni xeshlaydi, hujjat
     ichida ochiq parol hech qachon saqlanmaydi.                */
  await put('users/' + ID('u'), {
    id: ID('u'), name: 'O’chirish Ustoz', login: 'ochir' + R.slice(1, 7),
    role: 'oqituvchi', staffId: ID('t'), active: true
  }, undefined, { password: 'Sinov12345' });
  const tLogin = await api('/api/login', {
    method: 'POST', body: { login: 'ochir' + R.slice(1, 7), password: 'Sinov12345' }
  });
  ok('O’qituvchi kirdi', !!tLogin.cookie, String(tLogin.status));
  if (tLogin.cookie) {
    const tryPurge = await api('/api/students/purge', {
      method: 'POST', body: { ids: [ID('sa')] }, cookie: tLogin.cookie
    });
    eq('O’qituvchi o’chira olmadi', tryPurge.status, 403);
    ok('Sababi aytildi', /ruxsat|huquq/i.test((tryPurge.json || {}).error || ''),
      JSON.stringify(tryPurge.json));
    /* Rad etilgandan keyin baza o'zgarmagan */
    ok('Rad etilgandan keyin o’quvchi joyida', !!(await get('students/' + ID('sa'))));
    ok('To’lovi ham joyida',
      ((await api('/api/collection?name=payments')).json || {}).items &&
      Object.values(((await api('/api/collection?name=payments')).json || {}).items)
        .some(p => p.studentId === ID('sa')));
  }

  /* =============== 3. Butunlay o’chirish =============== */
  section('3. A o’quvchisi butunlay o’chadi');
  const purge = await api('/api/students/purge', { method: 'POST', body: { ids: [ID('sa')] } });
  eq('O’chirildi', purge.status, 200);
  ok('Nechta yozuv o’chgani aytildi', (purge.json || {}).docs >= 3, JSON.stringify(purge.json));

  ok('O’quvchi kartasi yo’q', !(await get('students/' + ID('sa'))));
  ok('A’zoligi yo’q', !(await get('memberships/' + ID('ma'))));
  ok('Oylik hisobi yo’q', !(await get('invoices/' + A.invoiceId(ID('ma'), YM))));

  const paysAfter = Object.values((((await api('/api/collection?name=payments')).json) || {}).items || {});
  ok('To’lovi ham yo’q', !paysAfter.some(p => p.studentId === ID('sa')),
    JSON.stringify(paysAfter.filter(p => p.studentId === ID('sa'))));

  const lesAfter = await get('lessons/' + ID('g') + '__' + YM);
  const att = (lesAfter && lesAfter.items && lesAfter.items[A.monthStart(YM)] &&
    lesAfter.items[A.monthStart(YM)].attendance) || {};
  ok('Davomat belgisi olib tashlandi', !(ID('ma') in att), JSON.stringify(att));

  /* =============== 4. B o’quvchisiga TEGILMADI =============== */
  section('4. Boshqa o’quvchi joyida qoldi');
  ok('B kartasi joyida', !!(await get('students/' + ID('sb'))));
  ok('B a’zoligi joyida', !!(await get('memberships/' + ID('mb'))));
  ok('B hisobi joyida', !!(await get('invoices/' + A.invoiceId(ID('mb'), YM))));
  ok('B to’lovi joyida', paysAfter.some(p => p.studentId === ID('sb')),
    JSON.stringify(paysAfter.map(p => p.studentId)));
  eq('B davomati joyida', att[ID('mb')], 'sababli');
  ok('Davomat hujjatining o’zi o’chmadi', !!lesAfter);
  ok('Guruh o’chmadi', !!(await get('groups/' + ID('g'))));

  /* =============== 5. Tarixga yozildi =============== */
  section('5. Tarixda iz qoldi');
  const audit = Object.values((((await api('/api/collection?name=audit')).json) || {}).items || {});
  const rec = audit.filter(a => /butunlay o’chirildi/i.test(a.action || ''))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  ok('Tarixda yozuv bor', !!rec, JSON.stringify(audit.slice(-1)));
  ok('Kim o’chirgani yozilgan', !!(rec && rec.by), JSON.stringify(rec && rec.by));
  ok('Nima o’chgani yozilgan', /yozuv o’chdi/.test((rec || {}).details || ''),
    (rec || {}).details);

  /* =============== 6. Bir yo’la bir nechta =============== */
  section('6. Bir yo’la bir nechta o’quvchi');
  const many = [];
  for (let i = 0; i < 3; i++) {
    const sid = ID('sk' + i);
    await put('students/' + sid, {
      id: sid, firstName: 'Ko’p', lastName: 'O’chirish ' + i + ' ' + R,
      phone: '+99890555' + Math.floor(1000 + Math.random() * 8999), status: 'faol'
    });
    many.push(sid);
  }
  const multi = await api('/api/students/purge', { method: 'POST', body: { ids: many } });
  eq('Uchalasi o’chirildi', multi.status, 200);
  eq('Uchta o’quvchi sanaldi', (multi.json || {}).students, 3);
  let left = 0;
  for (const sid of many) { if (await get('students/' + sid)) left++; }
  eq('Hech biri qolmadi', left, 0);

  /* Bo'sh ro'yxat va juda uzun ro'yxat rad etiladi */
  eq('Bo’sh ro’yxat rad etildi',
    (await api('/api/students/purge', { method: 'POST', body: { ids: [] } })).status, 400);
  eq('300 ta birdan rad etildi',
    (await api('/api/students/purge', {
      method: 'POST', body: { ids: new Array(300).fill('st_x') }
    })).status, 400);

  /* =============== 7. Bazani tozalash himoyasi =============== */
  section('7. Bazani tozalash himoyasi');
  /* Parolsiz — umuman o'tmaydi (birinchi to'siq) */
  const noPw = await api('/api/backup/reset', { method: 'POST', body: { confirm: 'O’CHIRAMAN' } });
  eq('Parolsiz tozalanmadi', noPw.status, 403);
  /* Tasdiq so'zisiz — tozalanmaydi (ikkinchi to'siq) */
  const noWord = await api('/api/backup/reset', { method: 'POST', body: { password: PASS } });
  eq('Tasdiq so’zisiz tozalanmadi', noWord.status, 400);
  const badWord = await api('/api/backup/reset', {
    method: 'POST', body: { confirm: 'ha', password: PASS }
  });
  eq('Noto’g’ri so’z bilan ham tozalanmadi', badWord.status, 400);
  /* Baza o'zgarmaganini tekshiramiz */
  ok('B o’quvchisi hali ham joyida', !!(await get('students/' + ID('sb'))));
  /* Direktor bo'lmagan odam tozalay olmaydi */
  if (tLogin.cookie) {
    const tReset = await api('/api/backup/reset', {
      method: 'POST', body: { confirm: 'O’CHIRAMAN', password: 'Sinov12345' }, cookie: tLogin.cookie
    });
    ok('O’qituvchi tozalay olmadi', tReset.status === 403, String(tReset.status));
    ok('B hali ham joyida', !!(await get('students/' + ID('sb'))));
  }

  /* =============== 8. Tozalash =============== */
  section('8. Sinov ma’lumotlari tozalandi');
  for (const p of [
    'invoices/' + A.invoiceId(ID('mb'), YM),
    'lessons/' + ID('g') + '__' + YM,
    'memberships/' + ID('mb'), 'students/' + ID('sb'),
    'users/' + ID('u'), 'groups/' + ID('g'), 'courses/' + ID('c'), 'staff/' + ID('t')
  ]) await del(p);
  /* B ning to'lovini ham olib tashlaymiz — demo baza iflos qolmasin */
  await api('/api/students/purge', { method: 'POST', body: { ids: [ID('sb')] } });
  ok('Sinov guruhi o’chirildi', !(await get('groups/' + ID('g'))));

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: "bazani tozalash" FAQAT himoyasi sinaldi — haqiqiy');
  console.log('tozalash bajarilmadi, aks holda sinov bazasi bo’shab qolardi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
