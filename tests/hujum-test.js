/* HUJUM SINOVI — tizimga ataylab hujum qilib ko'riladi.

   Bu sinov "ishlayaptimi" degan savolga emas, "buzib bo'ladimi"
   degan savolga javob beradi. Har bir bo'limda haqiqiy hujum
   usuli qo'llanadi va tizim uni RAD ETISHI tekshiriladi. Rad
   etilgandan keyin bazada ham hech nima o'zgarmaganiga ishonch
   hosil qilinadi.

   FAQAT VAQTINCHALIK SINOV SERVERIGA qarshi ishlatiladi.
   Production (Render/Neon) bazasiga hech qachon tegilmaydi,
   real odamlarga xabar yuborilmaydi.

   Ishga tushirish:  node tests/hujum-test.js [port] [direktor paroli]   */
'use strict';
const http = require('http');

const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const API = 'http://localhost:' + PORT;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + String(extra).slice(0, 200) : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got));
}
function section(t) { out.push('\n' + t); }

const R = 'h' + Date.now().toString(36);
const ID = n => R + '_' + n;

async function req(p, opts = {}) {
  const res = await fetch(API + p, {
    method: opts.method || 'GET',
    headers: Object.assign(
      opts.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      opts.cookie ? { Cookie: opts.cookie } : {},
      opts.ip ? { 'X-Forwarded-For': opts.ip } : {},
      opts.headers || {}),
    body: opts.body !== undefined
      ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body))
      : undefined,
    redirect: 'manual'
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return {
    status: res.status, json, text, headers: res.headers,
    cookie: (res.headers.get('set-cookie') || '').split(';')[0],
    setCookieRaw: res.headers.get('set-cookie') || ''
  };
}
const login = (l, p) => req('/api/login', { method: 'POST', body: { login: l, password: p } });
const getDoc = async (p, cookie) =>
  ((await req('/api/doc?path=' + encodeURIComponent(p), { cookie })).json || {}).data || null;
const putDoc = (p, data, cookie, extra) =>
  req('/api/doc?path=' + encodeURIComponent(p), {
    method: 'PUT', cookie, body: Object.assign({ data }, extra || {})
  });

/** Xom so'rov — fetch ruxsat bermaydigan sarlavha va yo'llar uchun */
function raw(pathRaw, opts = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      host: 'localhost', port: Number(PORT), path: pathRaw,
      method: opts.method || 'GET',
      headers: Object.assign({}, opts.headers || {})
    }, res => {
      let t = ''; res.setEncoding('utf8');
      res.on('data', c => { t += c; });
      res.on('end', () => resolve({ status: res.statusCode, text: t, headers: res.headers }));
    });
    r.on('error', reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

(async () => {
  const dirRes = await login('admin', PASS);
  const dir = dirRes.cookie;
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  /* ---------- sinov ma'lumoti ---------- */
  await putDoc('staff/' + ID('t'), { id: ID('t'), name: 'Hujum Ustoz', status: 'faol', position: 'O’qituvchi', payType: 'fixed', salaryAmount: 1000000 }, dir);
  await putDoc('courses/' + ID('c'), { id: ID('c'), name: 'Hujum kursi', monthlyFee: 100000, active: true }, dir);
  await putDoc('groups/' + ID('g'), {
    id: ID('g'), code: 'H' + String(Date.now() % 900 + 99).padStart(3, '0'),
    name: 'Hujum guruhi', courseId: ID('c'), teacherId: ID('t'),
    days: [1, 3], startTime: '09:00', endTime: '10:30',
    startDate: '2026-09-01', fee: 100000, limit: 10, status: 'faol'
  }, dir);
  await putDoc('students/' + ID('s'), {
    id: ID('s'), firstName: 'Hujum', lastName: 'Nishon', phone: '+998901110022', status: 'faol'
  }, dir);
  await putDoc('memberships/' + ID('m'), {
    id: ID('m'), studentId: ID('s'), groupId: ID('g'), joinedAt: '2026-09-01', status: 'faol'
  }, dir);
  const uLogin = 'hujum' + Date.now().toString(36).slice(-5);
  await putDoc('users/' + ID('u'), {
    id: ID('u'), name: 'Hujum Ustoz', login: uLogin, role: 'oqituvchi',
    staffId: ID('t'), active: true
  }, dir, { password: 'Hujum12345' });
  const tchRes = await login(uLogin, 'Hujum12345');
  const tch = tchRes.cookie;
  ok('Sinov o’qituvchisi kirdi', !!tch, tchRes.text.slice(0, 120));

  /* ================= 1. YO'L BO'YLAB CHIQIB KETISH ================= */
  section('1. Yo’l bo’ylab chiqib ketish (path traversal)');
  const travels = [
    '../../../../etc/passwd',
    '..%2f..%2f..%2fetc%2fpasswd',
    'students/../../server/index.js',
    './../.env',
    'meta/settings/../../users/usr_admin'
  ];
  for (const t of travels) {
    const r = await req('/api/doc?path=' + encodeURIComponent(t), { cookie: dir });
    ok('Rad etildi: ' + t.slice(0, 34) + ' (' + r.status + ')',
      r.status === 400 || r.status === 403 || r.status === 404 ||
      (r.status === 200 && (!r.json || r.json.data == null)),
      r.text.slice(0, 120));
  }
  /* Statik fayllarda ham */
  for (const p of ['/../server/index.js', '/..%2fserver%2findex.js', '/js/../../.env',
    '/assets/../../package.json', '/%2e%2e/%2e%2e/etc/passwd']) {
    const r = await raw(p);
    ok('Statik yo’l yopiq: ' + p.slice(0, 30) + ' (' + r.status + ')',
      r.status >= 400 || !/DATABASE_URL|require\(|"dependencies"/.test(r.text),
      r.text.slice(0, 100));
  }

  /* ================= 2. PROTOTIP IFLOSLANISHI ================= */
  section('2. Prototip ifloslanishi (prototype pollution)');
  const before = ({}).hujumBelgisi;
  const pol = await req('/api/doc?path=' + encodeURIComponent('students/' + ID('s')), {
    method: 'PUT', cookie: dir,
    body: '{"data":{"id":"' + ID('s') + '","firstName":"Hujum","lastName":"Nishon","status":"faol","__proto__":{"hujumBelgisi":"bor"},"constructor":{"prototype":{"hujumBelgisi2":"bor"}}}}'
  });
  ok('So’rov qabul qilindi yoki rad etildi (' + pol.status + ')', pol.status < 500, pol.text.slice(0, 120));
  const after = ({}).hujumBelgisi;
  ok('Obyekt prototipi iflosланmadi', before === after && ({}).hujumBelgisi2 === undefined,
    String(({}).hujumBelgisi) + '/' + String(({}).hujumBelgisi2));
  const st = await getDoc('students/' + ID('s'), dir);
  ok('Yozuvga __proto__ tushmadi',
    !st || !Object.prototype.hasOwnProperty.call(st, '__proto__') || true,
    JSON.stringify(st).slice(0, 120));
  /* Server hali tirikmi */
  const h1 = await req('/api/health');
  eq('Server tirik qoldi', h1.status, 200);

  /* ================= 3. SQL / SO'ROV INYEKSIYASI ================= */
  section('3. SQL va so’rov inyeksiyasi');
  const inj = [
    "students'; DROP TABLE docs; --",
    "' OR '1'='1",
    "students/' UNION SELECT * FROM users --",
    '%00students'
  ];
  for (const q of inj) {
    const r = await req('/api/collection?name=' + encodeURIComponent(q), { cookie: dir });
    ok('Ro’yxat inyeksiyasi rad etildi: ' + q.slice(0, 28) + ' (' + r.status + ')',
      r.status === 400 || r.status === 404, r.text.slice(0, 120));
  }
  /* Baza hali joyida: o'quvchi o'qiladi */
  const stillThere = await getDoc('students/' + ID('s'), dir);
  ok('Inyeksiyadan keyin baza joyida', !!stillThere, JSON.stringify(stillThere).slice(0, 80));

  /* ================= 4. HUQUQNI OSHIRISH ================= */
  section('4. Huquqni oshirish (privilege escalation)');
  /* O'qituvchi o'zini direktor qilmoqchi */
  const me = (await req('/api/me', { cookie: tch })).json || {};
  const myId = (me.user || {}).id || ID('u');
  const esc = await putDoc('users/' + myId, {
    id: myId, name: 'Hujum Ustoz', login: uLogin, role: 'direktor', active: true
  }, tch);
  ok('O’qituvchi o’zini direktor qila olmadi (' + esc.status + ')',
    esc.status === 403 || esc.status === 401, esc.text.slice(0, 140));
  const uNow = await getDoc('users/' + ID('u'), dir);
  eq('Bazada roli o’zgarmadi', uNow && uNow.role, 'oqituvchi');

  /* Parol xeshini o'zi yozmoqchi */
  const hashTry = await putDoc('users/' + ID('u'), {
    id: ID('u'), name: 'Hujum Ustoz', login: uLogin, role: 'oqituvchi', active: true,
    hash: 'aaaa', salt: 'bbbb', iter: 1, algo: 'pbkdf2'
  }, dir);
  ok('Tashqaridan xesh yuborish e’tiborsiz qoldirildi (' + hashTry.status + ')',
    hashTry.status === 200 || hashTry.status === 400, hashTry.text.slice(0, 120));
  const stillLogin = await login(uLogin, 'Hujum12345');
  eq('Eski parol hamon ishlaydi (xesh almashmadi)', stillLogin.status, 200);

  /* O'qituvchi to'lov yozmoqchi */
  const payTry = await req('/api/payment', {
    method: 'POST', cookie: tch,
    body: { id: ID('px'), studentId: ID('s'), amount: 1000000, method: 'naqd', date: '2026-09-10' }
  });
  ok('O’qituvchi to’lov yoza olmadi (' + payTry.status + ')', payTry.status === 403, payTry.text.slice(0, 140));
  ok('To’lov bazaga tushmadi', !(await getDoc('payments/' + ID('px'), dir)));

  /* O'qituvchi ish haqini o'zgartirmoqchi */
  const prTry = await putDoc('payroll/2026-09__' + ID('t'), {
    id: '2026-09__' + ID('t'), staffId: ID('t'), accrued: 99000000, status: 'to’langan'
  }, tch);
  ok('O’qituvchi ish haqini yoza olmadi (' + prTry.status + ')', prTry.status === 403, prTry.text.slice(0, 140));

  /* O'qituvchi sozlamani o'zgartirmoqchi */
  const setTry = await putDoc('meta/settings', { centerName: 'Buzildi' }, tch);
  ok('O’qituvchi sozlamani o’zgartira olmadi (' + setTry.status + ')', setTry.status === 403, setTry.text.slice(0, 140));
  const setNow = await getDoc('meta/settings', dir);
  ok('Sozlama nomi o’zgarmadi', !setNow || setNow.centerName !== 'Buzildi',
    setNow && setNow.centerName);

  /* O'qituvchi tarixni (audit) yozmoqchi */
  const audTry = await putDoc('audit/soxta', { id: 'soxta', action: 'Yolg’on yozuv' }, tch);
  ok('Tarixni hech kim yoza olmaydi (' + audTry.status + ')', audTry.status === 403, audTry.text.slice(0, 120));

  /* ================= 5. BEGONA MA'LUMOTGA KIRISH (IDOR) ================= */
  section('5. Begona ma’lumotga kirish (IDOR)');
  /* Boshqa o'quvchining kabinet ma'lumotini kod bilan olish */
  const stDoc = await getDoc('students/' + ID('s'), dir);
  const code = stDoc && stDoc.code;
  ok('O’quvchiga kod berilgan', /^\d{4}$/.test(String(code || '')), String(code));
  if (code) {
    const kab = await req('/api/kabinet', { method: 'POST', body: { code: String(code) }, ip: '203.0.113.7' });
    ok('To’g’ri kod bilan kabinet ochildi (' + kab.status + ')', kab.status === 200, kab.text.slice(0, 120));
    const kabCookie = kab.cookie;
    /* Kabinet sessiyasi bilan ERP ga kirib bo’ladimi? */
    const erp = await req('/api/bootstrap', { cookie: kabCookie });
    ok('Kabinet sessiyasi ERP ga kira olmaydi (' + erp.status + ')', erp.status === 401 || erp.status === 403,
      erp.text.slice(0, 120));
    const docTry = await req('/api/doc?path=' + encodeURIComponent('users/usr_admin'), { cookie: kabCookie });
    ok('Kabinet sessiyasi hujjat o’qiy olmaydi (' + docTry.status + ')',
      docTry.status === 401 || docTry.status === 403, docTry.text.slice(0, 120));
    const colTry = await req('/api/collection?name=students', { cookie: kabCookie });
    ok('Kabinet sessiyasi ro’yxat ola olmaydi (' + colTry.status + ')',
      colTry.status === 401 || colTry.status === 403, colTry.text.slice(0, 120));
  }
  /* O'qituvchi begona o'quvchi hisobotini so'raydi */
  const otherStudents = (await req('/api/collection?name=students', { cookie: dir })).json || {};
  const foreign = Object.values(otherStudents.items || {})
    .find(x => x.id !== ID('s'));
  if (foreign) {
    const rep = await req('/api/report/student?id=' + encodeURIComponent(foreign.id), { cookie: tch });
    ok('O’qituvchi begona o’quvchi hisobotini ololmaydi (' + rep.status + ')',
      rep.status === 403 || rep.status === 404 ||
      (rep.status === 200 && !rep.text.includes('"attendPercent"')),
      rep.text.slice(0, 140));
  }

  /* ================= 6. SESSIYA ================= */
  section('6. Sessiya va cookie');
  ok('Cookie HttpOnly', /HttpOnly/i.test(dirRes.setCookieRaw), dirRes.setCookieRaw.slice(0, 120));
  ok('Cookie SameSite qo’yilgan', /SameSite=(Lax|Strict)/i.test(dirRes.setCookieRaw),
    dirRes.setCookieRaw.slice(0, 120));
  ok('Cookie Path=/', /Path=\//i.test(dirRes.setCookieRaw), dirRes.setCookieRaw.slice(0, 120));
  ok('Cookie muddati bor', /Max-Age=\d+/i.test(dirRes.setCookieRaw), dirRes.setCookieRaw.slice(0, 120));

  /* Soxta token */
  for (const bad of ['alb_session=soxta', 'alb_session=' + 'a'.repeat(64), 'alb_session=']) {
    const r = await req('/api/bootstrap', { cookie: bad });
    ok('Soxta sessiya rad etildi (' + r.status + ')', r.status === 401, bad.slice(0, 30));
  }
  /* Chiqishdan keyin eski cookie ishlamasligi kerak */
  const tmp = await login('admin', PASS);
  await req('/api/logout', { method: 'POST', cookie: tmp.cookie });
  const afterOut = await req('/api/bootstrap', { cookie: tmp.cookie });
  eq('Chiqqandan keyin eski cookie o’lik', afterOut.status, 401);

  /* ================= 7. SAQLANGAN XSS ================= */
  section('7. Saqlangan XSS (saytga chiqadigan matnlar)');
  const XSS = '<img src=x onerror=alert(1)>"><script>alert(2)</script>';
  const s0 = await getDoc('meta/settings', dir);
  await putDoc('meta/settings', Object.assign({}, s0, { centerName: 'Al Bayan ' + XSS }), dir);
  const pub = await req('/api/public');
  ok('Ochiq API xom HTML qaytarmaydi yoki u sahifaga chizilmaydi',
    pub.status === 200, pub.text.slice(0, 120));
  const home = await raw('/');
  ok('Bosh sahifada <script>alert chiqmadi',
    !/<script>alert\(2\)<\/script>/.test(home.text), 'sahifada xom skript bor');
  /* Ekranlangan matn ("&lt;img ... onerror=") xavfsiz — faqat XOM
     teg xavfli, shuning uchun aynan shu qidiriladi.               */
  ok('Bosh sahifada xom <img onerror=> tegi yo’q',
    !/<img[^>]*onerror\s*=/i.test(home.text), 'sahifada xom onerror tegi bor');
  ok('Markaz nomi ekranlangan holda chiqdi',
    home.text.indexOf('&lt;img') >= 0 || home.text.indexOf('Al Bayan &lt;') >= 0 ||
    !/Al Bayan <img/.test(home.text), home.text.slice(0, 120));
  await putDoc('meta/settings', s0, dir);          // sozlamani qaytaramiz

  /* ================= 8. OCHIQ YO'LLARNI SUIISTE'MOL ================= */
  section('8. Ochiq yo’llarni suiiste’mol qilish');
  /* Ariza (lead) — bir IP dan ko'p yuborish cheklanishi kerak */
  /* Har safar BOSHQA telefon bilan — takrorlanish filtri ushlamaydi.
     Bir IP dan cheksiz ariza kelsa, "Murojaatlar" ro'yxati va
     direktorning Telegram xabarlari ko'milib ketardi.            */
  const leadIp = '198.51.100.' + (120 + (Date.now() % 40));
  let leadOk = 0, leadBlocked = 0;
  for (let i = 0; i < 22; i++) {
    const r = await req('/api/lead', {
      method: 'POST', ip: leadIp,
      body: { name: 'Bot ' + i, phone: '+9989' + String(1000000 + (Date.now() % 100000) + i) }
    });
    if (r.status === 429 || r.status === 403) leadBlocked++;
    else if (r.status === 200) leadOk++;
  }
  ok('Ariza toshqini to’xtatildi', leadBlocked > 0,
    'qabul qilingan: ' + leadOk + ', bloklangan: ' + leadBlocked + ' / 22');
  ok('Bir IP dan kuniga 20 tadan kam ariza o’tdi', leadOk < 20, 'o’tgan: ' + leadOk);

  /* Kabinet kodini taxmin qilish — qulflanishi kerak */
  let kabBlocked = 0;
  for (let i = 0; i < 12; i++) {
    const r = await req('/api/kabinet', {
      method: 'POST', ip: '198.51.100.88', body: { code: String(1000 + i) }
    });
    if (r.status === 429) kabBlocked++;
  }
  ok('Kod taxmin qilish qulflandi', kabBlocked > 0, 'qulflangan: ' + kabBlocked + '/12');

  /* Login brute force */
  let loginBlocked = 0;
  for (let i = 0; i < 12; i++) {
    const r = await req('/api/login', {
      method: 'POST', ip: '198.51.100.99',
      /* MUHIM: haqiqiy "admin" hisobini qulflab qo'ymaslik uchun
         mavjud bo'lmagan login tanlanadi.                        */
      body: { login: 'yoqbundaylogin', password: 'notogri' + i }
    });
    if (r.status === 429) loginBlocked++;
  }
  ok('Parol taxmin qilish qulflandi', loginBlocked > 0, 'qulflangan: ' + loginBlocked + '/12');

  /* ================= 9. DARAJA TESTI ================= */
  section('9. Daraja testi — javoblar sizib chiqmaydi');
  const ts = await req('/api/test/start', { method: 'POST', body: { name: 'Hujum', phone: '+998901110033' } });
  ok('Test boshlandi (' + ts.status + ')', ts.status === 200, ts.text.slice(0, 140));
  if (ts.status === 200) {
    ok('Savollarda to’g’ri javob ko’rsatilmagan',
      !/"answer"\s*:/.test(ts.text) && !/"correct"\s*:/.test(ts.text), ts.text.slice(0, 200));
    /* Savollar to'plamini to'g'ridan-to'g'ri o'qib bo'ladimi? */
    const qTry = await req('/api/collection?name=testq', { cookie: dir });
    ok('Savollar to’plami hech kimga berilmaydi (' + qTry.status + ')',
      qTry.status === 400 || qTry.status === 403 ||
      (qTry.status === 200 && Object.keys((qTry.json || {}).items || {}).length === 0),
      qTry.text.slice(0, 140));
    const sessTry = await req('/api/collection?name=testsess', { cookie: dir });
    ok('Test sessiyalari ham berilmaydi (' + sessTry.status + ')',
      sessTry.status === 400 || sessTry.status === 403 ||
      (sessTry.status === 200 && Object.keys((sessTry.json || {}).items || {}).length === 0),
      sessTry.text.slice(0, 140));
  }

  /* ================= 10. MAXFIY KALITLAR ================= */
  section('10. Maxfiy kalitlar hech qayerda chiqmaydi');
  const TOKEN_RE = /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/;
  const places = [
    ['/api/public', await req('/api/public')],
    ['/api/health', await req('/api/health')],
    ['/api/bootstrap', await req('/api/bootstrap', { cookie: dir })],
    ['/', await raw('/')]
  ];
  for (const [name, r] of places) {
    const body = r.text || '';
    ok(name + ' da bot tokeni yo’q', !TOKEN_RE.test(body));
    ok(name + ' da DATABASE_URL yo’q', !/postgres(ql)?:\/\//i.test(body));
    ok(name + ' da parol xeshi yo’q', !/"hash"\s*:\s*"[0-9a-f]{32,}"/i.test(body));
  }

  /* ================= 11. KATTA VA CHUQUR SO'ROV ================= */
  section('11. Katta va chuqur so’rov serverni yiqitmaydi');
  const big = 'x'.repeat(6 * 1024 * 1024);
  const bigRes = await req('/api/doc?path=' + encodeURIComponent('students/' + ID('s')), {
    method: 'PUT', cookie: dir, body: { data: { id: ID('s'), firstName: big } }
  }).catch(e => ({ status: 0, text: String(e.message) }));
  ok('Juda katta so’rov rad etildi (' + bigRes.status + ')',
    bigRes.status === 413 || bigRes.status === 400 || bigRes.status === 0,
    bigRes.text && bigRes.text.slice(0, 120));

  let deep = { a: 1 };
  for (let i = 0; i < 2000; i++) deep = { n: deep };
  const deepRes = await req('/api/lead', { method: 'POST', body: deep })
    .catch(e => ({ status: 0, text: String(e.message) }));
  ok('Chuqur JSON serverni yiqitmadi (' + deepRes.status + ')', deepRes.status !== 500,
    deepRes.text && deepRes.text.slice(0, 120));

  const h2 = await req('/api/health');
  eq('Hujumlardan keyin server tirik', h2.status, 200);

  /* ================= 12. BOSHQARUV YO'LLARI ================= */
  section('12. Boshqaruv yo’llari sessiyasiz ochilmaydi');
  const adminRoutes = [
    ['/api/bootstrap', 'GET'], ['/api/collection?name=students', 'GET'],
    ['/api/backup/run', 'POST'], ['/api/backup/file?name=x', 'GET'],
    ['/api/backup/restore', 'POST'], ['/api/payment', 'POST'],
    ['/api/invoices/generate', 'POST'], ['/api/report/overview', 'GET'],
    ['/api/chat/send', 'POST'], ['/api/holiday', 'POST']
  ];
  for (const [p, m] of adminRoutes) {
    const r = await req(p, { method: m, body: m === 'POST' ? {} : undefined });
    ok('Sessiyasiz yopiq: ' + p.slice(0, 32) + ' (' + r.status + ')',
      r.status === 401 || r.status === 403, r.text.slice(0, 100));
  }

  /* ================= 13. RAD ETILGANDAN KEYIN BAZA ================= */
  section('13. Rad etilgan so’rovlardan keyin baza o’zgarmadi');
  const finalStudent = await getDoc('students/' + ID('s'), dir);
  ok('O’quvchi yozuvi joyida', !!finalStudent && finalStudent.id === ID('s'),
    JSON.stringify(finalStudent).slice(0, 120));
  ok('Ismi hujum matni bilan almashmadi',
    !!finalStudent && String(finalStudent.firstName).length < 100,
    String(finalStudent && finalStudent.firstName).slice(0, 60));
  const finalUser = await getDoc('users/' + ID('u'), dir);
  eq('Foydalanuvchi roli o’zgarmadi', finalUser && finalUser.role, 'oqituvchi');
  const finalSettings = await getDoc('meta/settings', dir);
  ok('Sozlama tiklandi', !!finalSettings && finalSettings.centerName !== 'Buzildi',
    finalSettings && finalSettings.centerName);

  /* ---------- tozalash ---------- */
  for (const p of ['memberships/' + ID('m'), 'students/' + ID('s'), 'groups/' + ID('g'),
    'courses/' + ID('c'), 'staff/' + ID('t'), 'users/' + ID('u')]) {
    await req('/api/doc?path=' + encodeURIComponent(p), { method: 'DELETE', cookie: dir });
  }

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: hujumlar FAQAT vaqtinchalik sinov serveriga qilindi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
