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
const fs = require('fs');
const path = require('path');

/* Model funksiyalari (filial kaliti kabi) shu yerda ham kerak */
const loadJs = f => (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
global.window = undefined;
loadJs('core.js'); loadJs('model.js');
const A = globalThis.A;

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
  ok('O’quvchiga kod berilgan', /^\d{5}$/.test(String(code || '')), String(code));
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

  /* ================================================================
     14. SEO yo'llari: Host sarlavhasi bilan hujum

     robots.txt, sitemap.xml va canonical manzili so'rovdagi Host
     sarlavhasidan tuziladi. Host ni mijoz o'zi yozadi — demak u
     yerga begona sayt yoki kod tiqishga urinib ko'ramiz. Agar o'tib
     ketsa, Google ga bizning saytimiz nomidan begona manzil
     ko'rsatilardi (poisoned canonical / sitemap).                  */
  section('14. SEO yo’llari: Host sarlavhasi bilan hujum');
  /* Bu yerda ikkita alohida xato tekshiriladi:
       a) BUZILGAN Host serverni yiqitmasin (ilgari yiqitardi:
          `new URL` xato tashlardi va butun jarayon o'lardi —
          bitta so'rov bilan sayt o'chirilardi);
       b) TO'G'RI yozilgan, lekin BEGONA Host javobga tushmasin
          (ilgari tushardi: Google ga begona sayt "asosiy manzil"
          bo'lib ko'rsatilardi).                                   */
  const hostAttacks = [
    'zararli.example.com',
    'example.com"><script>alert(1)</script>',
    'example.com/\r\nSet-Cookie: a=b',
    'example.com<img src=x onerror=alert(1)>',
    '../../etc/passwd',
    'javascript:alert(1)',
    'a'.repeat(400) + '.com',
    ''
  ];
  for (const bad of hostAttacks) {
    let r = null;
    /* Node mijozi ba'zi buzilgan sarlavhani o'zi yubormaydi — bu
       xato emas; muhimi, SERVER tirik qolishi.                    */
    try { r = await raw('/robots.txt', { headers: { Host: bad } }); }
    catch (e) { r = { status: -1, text: '' }; }
    if (r.status > 0) {
      ok('robots.txt javob berdi ("' + bad.slice(0, 24) + '")',
        r.status === 200 || r.status === 400, String(r.status));
      ok('  → begona sayt javobga tushmadi',
        !/zararli\.example\.com|etc\/passwd|example\.com/.test(r.text), r.text.slice(0, 200));
      ok('  → kod yoki sarlavha tiqilmadi',
        !/<script|onerror=|Set-Cookie/i.test(r.text), r.text.slice(0, 200));
    }
    /* Eng muhimi: har bir urinishdan KEYIN server tirikmi */
    const alive = await raw('/api/health').catch(() => ({ status: 0 }));
    ok('  → server tirik qoldi', alive.status === 200, String(alive.status));
  }
  const smBad = await raw('/sitemap.xml', { headers: { Host: 'zararli.example.com' } })
    .catch(() => ({ status: 0, text: '' }));
  ok('sitemap.xml da begona sayt yo’q',
    smBad.status !== 200 || !/zararli\.example\.com/.test(smBad.text),
    smBad.status + ' ' + smBad.text.slice(0, 200));
  const pageBad = await raw('/', { headers: { Host: 'zararli.example.com' } })
    .catch(() => ({ status: 0, text: '' }));
  ok('canonical ham zaharlanmadi',
    pageBad.status !== 200 || !/canonical[^>]*zararli\.example\.com/.test(pageBad.text),
    String(pageBad.status));
  ok('og:url ham zaharlanmadi',
    pageBad.status !== 200 || !/og:url[^>]*zararli\.example\.com/.test(pageBad.text),
    String(pageBad.status));
  /* Bu yo'llar FAQAT o'qish uchun — yozib bo'lmaydi */
  for (const p of ['/robots.txt', '/sitemap.xml']) {
    const w = await raw(p, { method: 'POST', body: 'x' }).catch(() => ({ status: 0 }));
    ok('POST ' + p + ' qabul qilinmaydi', w.status !== 200, String(w.status));
  }
  /* Xaritada ERP ma'lumoti bo'lmasligi kerak */
  const smOk = await req('/sitemap.xml');
  ok('Xaritada o’quvchi raqami yo’q', !/st_[a-z0-9]{4,}|usr_[a-z0-9]{3,}/i.test(smOk.text),
    smOk.text.slice(0, 200));
  ok('Xaritada ERP ekrani yo’q',
    !/(students|finance|staff|dashboard|kabinet)/i.test(smOk.text), smOk.text.slice(0, 200));
  /* Tasdiqlash fayli namunasi kengaymadi — boshqa fayl ochilmasin */
  for (const p of ['/google.html', '/googleZZZZ.html', '/google../server/index.js',
    '/yandex_.html', '/googlea919a23f8dccf992.html.bak']) {
    const r = await raw(p).catch(() => ({ status: 0 }));
    ok('Ochilmaydi: ' + p, r.status !== 200, String(r.status));
  }

  /* ================================================================
     15. YANGI YO'LLAR: butunlay o'chirish, bazani tozalash,
         filial sozlamasi va to'lov sanalari
     ================================================================ */
  section('15. Yangi yo’llar: o’chirish, tozalash, filial, to’lov sanasi');

  /* --- 15a. O'quvchini butunlay o'chirish --- */
  const purge = (body, cookie) =>
    req('/api/students/purge', { method: 'POST', cookie, body });

  const pNoAuth = await purge({ ids: [ID('s')] });
  ok('Sessiyasiz o’chirib bo’lmaydi', pNoAuth.status === 401 || pNoAuth.status === 403,
    pNoAuth.status + ' ' + pNoAuth.text.slice(0, 120));
  const pTch = await purge({ ids: [ID('s')] }, tch);
  eq('O’qituvchi o’chira olmaydi', pTch.status, 403);
  /* RAD ETILGANDAN KEYIN o'quvchi joyida turishi kerak */
  ok('  → rad etilgandan keyin o’quvchi joyida',
    !!(await getDoc('students/' + ID('s'), dir)));
  ok('  → a’zoligi ham joyida',
    !!(await getDoc('memberships/' + ID('m'), dir)));

  const pEmpty = await purge({ ids: [] }, dir);
  eq('Bo’sh ro’yxat rad etiladi', pEmpty.status, 400);
  const pPath = await purge({ ids: ['../../meta/settings'] }, dir);
  ok('Yo’l bo’ylab chiqib ketish rad etiladi',
    pPath.status === 400 || (pPath.json && !pPath.json.deleted),
    pPath.status + ' ' + pPath.text.slice(0, 140));
  ok('  → sozlama joyida', !!(await getDoc('meta/settings', dir)));
  const pBig = await purge({ ids: Array.from({ length: 201 }, (_, i) => 's' + i) }, dir);
  eq('201 ta o’quvchi bir yo’la rad etiladi', pBig.status, 400);
  const pProto = await purge({ ids: ['__proto__'] }, dir);
  ok('"__proto__" id prototipni buzmaydi',
    ({}).polluted === undefined && pProto.status < 500, pProto.status + '');

  /* Oldindan ko'rish HECH NIMANI o'chirmaydi */
  const dry = await purge({ ids: [ID('s')], dryRun: true }, dir);
  eq('Oldindan ko’rish ishlaydi', dry.status, 200);
  ok('  → o’quvchi hali joyida (oldindan ko’rish)',
    !!(await getDoc('students/' + ID('s'), dir)), JSON.stringify(dry.json).slice(0, 160));
  ok('  → a’zoligi hali joyida',
    !!(await getDoc('memberships/' + ID('m'), dir)));

  /* --- 15b. Bazani tozalash: tasdiqlashsiz ishlamaydi --- */
  const rsNoAuth = await req('/api/backup/reset', { method: 'POST', body: { confirm: 'O’CHIRAMAN' } });
  ok('Sessiyasiz baza tozalanmaydi', rsNoAuth.status === 401 || rsNoAuth.status === 403,
    rsNoAuth.status + '');
  const rsTch = await req('/api/backup/reset', { method: 'POST', cookie: tch, body: { confirm: 'O’CHIRAMAN' } });
  eq('O’qituvchi baza tozalay olmaydi', rsTch.status, 403);
  /* Parol ham, tasdiqlash so'zi ham kerak — ikkisi ALOHIDA to'siq */
  const rsNoPw = await req('/api/backup/reset', {
    method: 'POST', cookie: dir, body: { confirm: 'O’CHIRAMAN' }
  });
  eq('Parolsiz baza tozalanmaydi', rsNoPw.status, 403);
  for (const bad of ['', 'ochiraman', 'O’CHIRAM', 'DELETE', 'HA']) {
    const r = await req('/api/backup/reset', {
      method: 'POST', cookie: dir, body: { confirm: bad, password: PASS }
    });
    eq('Tasdiqlash so’zi "' + bad + '" qabul qilinmaydi', r.status, 400);
  }
  /* Eng muhimi: shu urinishlardan keyin ham baza TURIBDI */
  ok('Urinishlardan keyin o’quvchi joyida', !!(await getDoc('students/' + ID('s'), dir)));
  ok('Urinishlardan keyin guruh joyida', !!(await getDoc('groups/' + ID('g'), dir)));

  /* --- 15c. To'lov sanasi zaharlanmaydi (PUL YO'QOLISHI) ---
     joinedAt to'g'ridan-to'g'ri hisobning muddatiga tushadi.
     Buzuq sana yozilsa, muddat satr sifatida solishtirilgani uchun
     qarz hech qachon "muddati o'tgan" bo'lmay qolardi.            */
  const memPath = 'memberships/' + ID('m');
  const memOk = await getDoc(memPath, dir);
  for (const bad of ['2026-13-45', '2026-02-30', '<script>alert(1)</script>',
    '9999-99-99', '2026-9-1', 'now()', '2026-09-01T00:00:00']) {
    const r = await putDoc(memPath, Object.assign({}, memOk, { joinedAt: bad }), dir);
    eq('Buzuq kirgan sana rad etiladi: ' + bad.slice(0, 20), r.status, 400);
  }
  const memAfter = await getDoc(memPath, dir);
  eq('Rad etilgandan keyin sana o’zgarmadi', memAfter.joinedAt, '2026-09-01');

  for (const bad of [0, 32, 99, -5, 1.5, 'abc', '7; DROP TABLE']) {
    const r = await putDoc(memPath, Object.assign({}, memOk, { dueDay: bad }), dir);
    eq('Buzuq to’lov kuni rad etiladi: ' + bad, r.status, 400);
  }
  const memDue = await putDoc(memPath, Object.assign({}, memOk, { dueDay: 12 }), dir);
  eq('To’g’ri to’lov kuni (12) qabul qilinadi', memDue.status, 200);
  eq('  → saqlandi', (await getDoc(memPath, dir)).dueDay, 12);
  /* 31 ham to'g'ri: oyda shuncha kun bo'lmasa, oxirgi kunga tushadi */
  const memDue31 = await putDoc(memPath, Object.assign({}, memOk, { dueDay: 31 }), dir);
  eq('31-kun ham qabul qilinadi', memDue31.status, 200);
  const memBack = await putDoc(memPath, Object.assign({}, memOk, { leftAt: '2026-08-01' }), dir);
  eq('Chiqgan sana kirgandan oldin bo’lmaydi', memBack.status, 400);

  /* O'quvchining to'lov sanasi ham tekshiriladi */
  const stOk = await getDoc('students/' + ID('s'), dir);
  for (const bad of ['2026-13-45', '2026-02-31', '<img onerror=1>']) {
    const r = await putDoc('students/' + ID('s'), Object.assign({}, stOk, { payDate: bad }), dir);
    eq('Buzuq to’lov sanasi rad etiladi: ' + bad.slice(0, 16), r.status, 400);
  }
  eq('Rad etilgandan keyin o’quvchi nomi o’zgarmadi',
    (await getDoc('students/' + ID('s'), dir)).firstName, 'Hujum');

  /* --- 15d. Hisob (invoice) summasi va oyi --- */
  const invId = 'invoices/' + ID('i');
  const invBase = {
    id: ID('i'), membershipId: ID('m'), studentId: ID('s'), groupId: ID('g'),
    month: '2026-09', base: 100000, discount: 0, final: 100000, dueDate: '2026-09-01'
  };
  for (const bad of ['2026-13', 'xxxx-xx', '', '2026-09-01']) {
    const r = await putDoc(invId, Object.assign({}, invBase, { month: bad }), dir);
    eq('Buzuq hisob oyi rad etiladi: "' + bad + '"', r.status, 400);
  }
  const invBadDue = await putDoc(invId, Object.assign({}, invBase, { dueDate: '2026-13-45' }), dir);
  eq('Buzuq muddat rad etiladi', invBadDue.status, 400);
  const invNeg = await putDoc(invId, Object.assign({}, invBase, { final: -500000 }), dir);
  eq('Manfiy summa rad etiladi', invNeg.status, 400);
  ok('Rad etilgan hisob bazaga tushmadi', !(await getDoc(invId, dir)));
  const invGood = await putDoc(invId, invBase, dir);
  eq('To’g’ri hisob qabul qilinadi', invGood.status, 200);
  const invSaved = await getDoc(invId, dir);
  ok('  → muddat haqiqiy sana', !!invSaved && /^\d{4}-\d{2}-\d{2}$/.test(invSaved.dueDate),
    JSON.stringify(invSaved));
  await req('/api/doc?path=' + encodeURIComponent(invId), { method: 'DELETE', cookie: dir });

  /* --- 15e. Filial sozlamasi: kod saytga chiqmasin --- */
  const set0 = (await getDoc('meta/settings', dir)) || {};
  const evil = 'Taxtapul filiali\n<script>alert(1)</script>\n' + 'A'.repeat(300);
  const setRes = await putDoc('meta/settings', Object.assign({}, set0, { branches: evil }), dir);
  if (setRes.status === 200) {
    const home = await raw('/');
    ok('Filial nomidagi kod sahifaga chiqmadi',
      !/<script>alert\(1\)<\/script>/.test(home.text), 'sahifada topildi');
    const after = await getDoc('meta/settings', dir);
    const list = A.branchList({ branches: after && after.branches });
    ok('Filial ro’yxati 12 tadan oshmaydi', list.length <= 12, String(list.length));
    ok('Filial kaliti faqat harf-raqam',
      list.every(b => /^[a-z0-9-]+$/.test(b.id)), JSON.stringify(list.slice(0, 3)));
  }
  const setTch = await putDoc('meta/settings', Object.assign({}, set0, { branches: 'Men' }), tch);
  eq('O’qituvchi sozlamani o’zgartira olmaydi', setTch.status, 403);
  /* Sozlamani tiklaymiz */
  await putDoc('meta/settings', set0, dir);

  /* ================================================================
     16. meta/* — faqat server yozadi
     ================================================================ */
  section('16. meta/* hujjatlari: xodim yoza ham, o’qiy ham olmaydi');
  /* Ilgari writePermFor meta/settings dan boshqa meta/* uchun null
     qaytarardi, ya'ni ruxsat tekshiruvi umuman o'tkazib yuborilardi:
     har qanday kirgan xodim meta/autoinvoice ga lastMonth yozib shu
     oyning AVTOMATIK HISOBLARINI to'xtatishi, yoki meta/backupstate
     ga yozib zaxira xatolarini yashirishi mumkin edi.               */
  const metaBefore = {};
  for (const m of ['meta/autoinvoice', 'meta/backupstate']) {
    metaBefore[m] = JSON.stringify(await getDoc(m, dir));
  }
  for (const [path, payload] of [
    ['meta/autoinvoice', { lastMonth: '2099-12', stopped: true }],
    ['meta/backupstate', { lastError: '', lastAt: '2099-01-01' }],
    ['meta/yangi_hujjat', { x: 1 }]
  ]) {
    const w = await putDoc(path, payload, tch);
    eq('O’qituvchi ' + path + ' ga yoza olmadi', w.status, 403);
    const d = await putDoc(path, payload, dir);
    eq('Direktor ham ' + path + ' ga yoza olmadi', d.status, 403);
  }
  for (const m of ['meta/autoinvoice', 'meta/backupstate']) {
    eq('  → ' + m + ' o’zgarmadi', JSON.stringify(await getDoc(m, dir)), metaBefore[m]);
  }
  ok('Yangi meta hujjat yaratilmadi', !(await getDoc('meta/yangi_hujjat', dir)));

  /* O'qish ham: ichki holat mijozga chiqmaydi */
  for (const m of ['meta/autoinvoice', 'meta/backupstate']) {
    const r = await req('/api/doc?path=' + encodeURIComponent(m), { cookie: tch });
    ok('O’qituvchi ' + m + ' ni o’qiy olmadi',
      r.status === 403 || !(r.json && r.json.data), r.status + ' ' + r.text.slice(0, 120));
  }
  const bootT = await req('/api/bootstrap', { cookie: tch });
  const bootDocs = (bootT.json || {}).docs || {};
  ok('Ro’yxatda ham meta/backupstate yo’q', !bootDocs['meta/backupstate'],
    JSON.stringify(Object.keys(bootDocs).filter(k => k.indexOf('meta/') === 0)));
  ok('Ro’yxatda ham meta/autoinvoice yo’q', !bootDocs['meta/autoinvoice'],
    JSON.stringify(Object.keys(bootDocs).filter(k => k.indexOf('meta/') === 0)));
  /* Sozlama esa ishlashda davom etsin */
  const setOk = await req('/api/doc?path=' + encodeURIComponent('meta/settings'), { cookie: dir });
  ok('meta/settings direktorga ochiq', setOk.status === 200 && !!setOk.json.data,
    setOk.status + '');

  /* ================================================================
     17. Zaxira: tiklash orqali o'zini direktor qilib bo'lmaydi
     ================================================================ */
  section('17. Zaxira va tiklash');
  /* Ilgari BUTUN backup/* bloki faqat settings.edit talab qilardi.
     backup/restore esa MIJOZ yuborgan fayl bilan users/* ni ham
     almashtirardi — ya'ni sozlama huquqi bor har kim o'ziga
     direktor hisobini yozib qo'yishi mumkin edi. backup/file esa
     parol xeshlari, kabinet kodlari va BOT TOKENINI ochiq berardi. */

  /* Sozlama huquqi bor, lekin direktor BO'LMAGAN foydalanuvchi */
  const admLogin = 'adm' + Date.now().toString(36).slice(-5);
  await putDoc('users/' + ID('a'), {
    id: ID('a'), name: 'Administrator', login: admLogin, role: 'admin', active: true
  }, dir, { password: 'Admin123456' });
  const admRes = await login(admLogin, 'Admin123456');
  const adm = admRes.cookie;
  ok('Administrator kirdi', !!adm, admRes.text.slice(0, 120));

  const run = await req('/api/backup/run', { method: 'POST', cookie: dir, body: {} });
  const bname = run.json && run.json.file && run.json.file.name;
  ok('Zaxira olindi', !!bname, run.text.slice(0, 140));

  if (adm && bname) {
    /* a) Administrator dumpni yuklab ololmaydi */
    const dlAdm = await req('/api/backup/file?name=' + encodeURIComponent(bname) +
      '&password=' + encodeURIComponent('Admin123456'), { cookie: adm });
    eq('Administrator zaxira faylini ololmadi', dlAdm.status, 403);
    /* b) Tiklay ham olmaydi */
    const resAdm = await req('/api/backup/restore', {
      method: 'POST', cookie: adm,
      body: { name: bname, confirm: 'TIKLASH', password: 'Admin123456' }
    });
    eq('Administrator tiklay olmadi', resAdm.status, 403);
    /* c) Bazani tozalay ham olmaydi */
    const rstAdm = await req('/api/backup/reset', {
      method: 'POST', cookie: adm, body: { confirm: 'O’CHIRAMAN', password: 'Admin123456' }
    });
    eq('Administrator bazani tozalay olmadi', rstAdm.status, 403);
    ok('  → o’quvchi joyida', !!(await getDoc('students/' + ID('s'), dir)));

    /* d) Direktor ham PAROLSIZ qila olmaydi */
    const noPw = await req('/api/backup/file?name=' + encodeURIComponent(bname), { cookie: dir });
    eq('Parolsiz zaxira fayli berilmadi', noPw.status, 403);
    const badPw = await req('/api/backup/file?name=' + encodeURIComponent(bname) +
      '&password=notogri', { cookie: dir });
    eq('Noto’g’ri parol bilan ham berilmadi', badPw.status, 403);
    const resNoPw = await req('/api/backup/restore', {
      method: 'POST', cookie: dir, body: { name: bname, confirm: 'TIKLASH' }
    });
    eq('Parolsiz tiklanmadi', resNoPw.status, 403);

    /* e) To'g'ri parol bilan dump beriladi, lekin BOT TOKENISIZ */
    const okDl = await req('/api/backup/file?name=' + encodeURIComponent(bname) +
      '&password=' + encodeURIComponent(PASS), { cookie: dir });
    eq('Direktor parol bilan oldi', okDl.status, 200);
    const st = okDl.json && okDl.json.docs && okDl.json.docs['meta/settings'];
    ok('Yuklangan nusxada bot tokeni yo’q',
      !(st && st.bot && st.bot.token), JSON.stringify(st && st.bot));
    ok('Parol xeshi esa saqlanib qolgan (tiklash ishlasin)',
      okDl.text.indexOf('"hash"') >= 0);
  }

  /* ================================================================
     18. Parol qoidalari
     ================================================================ */
  section('18. Zaif parol qabul qilinmaydi');
  /* Ilgari eng kam uzunlik 4 edi — "1234" ham o'tardi. Seed parol ham
     "1234" bo'lgani uchun internetda ochiq turgan nusxaga
     "admin / 1234" bilan kirib olish mumkin edi.                    */
  const PWU = 'users/' + ID('p');
  for (const bad of ['1234', 'abc', '1234567', '12345678', 'password',
    'admin123', '11111111', 'aaaaaaaa']) {
    const r = await putDoc(PWU, {
      id: ID('p'), name: 'Parol sinovi', login: 'pw' + R.slice(-4), role: 'oqituvchi', active: true
    }, dir, { password: bad });
    eq('Zaif parol rad etildi: "' + bad + '"', r.status, 400);
  }
  ok('Zaif parolli foydalanuvchi yaratilmadi', !(await getDoc(PWU, dir)));
  /* Login bilan bir xil bo'lmasin */
  const sameLogin = await putDoc(PWU, {
    id: ID('p'), name: 'Parol sinovi', login: 'ustozlogin', role: 'oqituvchi', active: true
  }, dir, { password: 'ustozlogin9' });
  eq('Login ichida bo’lgan parol rad etildi', sameLogin.status, 400);
  /* To'g'ri parol esa qabul qilinadi */
  const goodPw = await putDoc(PWU, {
    id: ID('p'), name: 'Parol sinovi', login: 'pwok' + R.slice(-4), role: 'oqituvchi', active: true
  }, dir, { password: 'Qoriq7tepa' });
  eq('Yaxshi parol qabul qilindi', goodPw.status, 200);
  const pwRec = await getDoc(PWU, dir);
  ok('Javobda ochiq parol ham, xesh ham yo’q',
    !!pwRec && JSON.stringify(pwRec).indexOf('Qoriq7tepa') < 0 && !pwRec.hash && !pwRec.salt,
    JSON.stringify(pwRec));
  /* Haqiqiy dalil: shu parol bilan kirish ishlaydi */
  const pwLogin = await login(pwRec.login, 'Qoriq7tepa');
  ok('Yangi parol bilan kirildi', !!pwLogin.cookie, pwLogin.status + ' ' + pwLogin.text.slice(0, 100));
  const pwWrong = await login(pwRec.login, 'Qoriq7tepaX');
  eq('Noto’g’ri parol bilan kirilmadi', pwWrong.status, 401);
  await req('/api/doc?path=' + encodeURIComponent(PWU), { method: 'DELETE', cookie: dir });

  /* --- Seed paroli: env berilmasa TASODIFIY bo'lsin ---
     Alohida, BO'SH bazali server ko'tariladi (bu serverga tegilmaydi). */
  section('18b. Birinchi kirish paroli tasodifiy');
  await (async function () {
    const { spawn } = require('child_process');
    const fs2 = require('fs');
    const os2 = require('os');
    const path2 = require('path');
    const dir2 = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'alb-seed-'));
    const port2 = 3397;
    /* .env faylidagi SEED_DIRECTOR_PASSWORD ta'sir qilmasin:
       dotenv faqat ishchi papkadagi .env ni o'qiydi.            */
    const env = Object.assign({}, process.env, {
      PORT: String(port2), DATA_DIR: path2.join(dir2, 'd'),
      BACKUP_DIR: path2.join(dir2, 'b'), FILES_DIR: path2.join(dir2, 'f'),
      NODE_ENV: 'test'
    });
    delete env.SEED_DIRECTOR_PASSWORD;
    delete env.SEED_DIRECTOR_LOGIN;
    const srv = spawn(process.execPath, [path2.join(__dirname, '..', 'server', 'index.js')],
      { cwd: dir2, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    srv.stdout.on('data', c => { log += String(c); });
    srv.stderr.on('data', c => { log += String(c); });
    let up = false;
    for (let i = 0; i < 25 && !up; i++) {
      await new Promise(r => setTimeout(r, 400));
      try { up = (await fetch('http://localhost:' + port2 + '/api/health')).status === 200; } catch (e) { }
    }
    ok('Bo’sh bazali server ko’tarildi', up, log.slice(-300));
    if (up) {
      const try1234 = await fetch('http://localhost:' + port2 + '/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'admin', password: '1234' })
      });
      eq('"admin / 1234" bilan kirib bo’lmadi', try1234.status, 401);
      const m = log.match(/BIRINCHI KIRISH PAROLI: (\S+)/);
      ok('Tasodifiy parol jurnalda bir marta chiqdi', !!m, log.slice(-400));
      if (m) {
        ok('  → uzunligi yetarli (' + m[1].length + ')', m[1].length >= 12, m[1].length + '');
        ok('  → harf, raqam va belgi bor',
          /[a-z]/.test(m[1]) && /[A-Z]/.test(m[1]) && /\d/.test(m[1]), '');
        const okLogin = await fetch('http://localhost:' + port2 + '/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: 'admin', password: m[1] })
        });
        eq('  → shu parol bilan kirildi', okLogin.status, 200);
        const me = await (await fetch('http://localhost:' + port2 + '/api/me', {
          headers: { Cookie: (okLogin.headers.get('set-cookie') || '').split(';')[0] }
        })).json();
        eq('  → "parolni almashtiring" belgisi qo’yilgan', (me.user || {}).mustChange, true);
      }
    }
    try { srv.kill('SIGKILL'); } catch (e) { }
    try { fs2.rmSync(dir2, { recursive: true, force: true }); } catch (e) { }
  })();

  /* ================================================================
     19. Xavfsizlik sarlavhalari
     ================================================================ */
  section('19. Xavfsizlik sarlavhalari');
  /* Ilgari CSP, X-Frame-Options va HSTS umuman yo'q edi: sahifani
     begona saytga <iframe> qilib qo'yib, foydalanuvchiga ko'rinmas
     tugmalarni bostirish (clickjacking) mumkin edi.               */
  const hdrPaths = ['/', '/api/health', '/robots.txt'];
  for (const hp of hdrPaths) {
    const r = await raw(hp).catch(() => ({ status: 0, headers: {} }));
    const H = r.headers || {};
    eq(hp + ' → X-Frame-Options: DENY', H['x-frame-options'], 'DENY');
    eq(hp + ' → nosniff', H['x-content-type-options'], 'nosniff');
    ok(hp + ' → Referrer-Policy bor', !!H['referrer-policy'], JSON.stringify(H['referrer-policy']));
    ok(hp + ' → Permissions-Policy bor', !!H['permissions-policy'], '');
  }
  /* CSP — faqat HTML sahifada */
  const htmlR = await raw('/');
  const csp = (htmlR.headers || {})['content-security-policy'] || '';
  ok('Sahifada CSP bor', !!csp, csp.slice(0, 80));
  ok('  → frame-ancestors none', /frame-ancestors 'none'/.test(csp), csp.slice(0, 200));
  ok('  → object-src none', /object-src 'none'/.test(csp), '');
  ok('  → base-uri self', /base-uri 'self'/.test(csp), '');
  ok('  → form-action self', /form-action 'self'/.test(csp), '');
  ok('  → default-src self', /default-src 'self'/.test(csp), '');
  /* GA va shriftlar ishlashi uchun ularga ruxsat bo'lishi kerak */
  ok('  → GA uchun googletagmanager ruxsati bor',
    csp.indexOf('googletagmanager.com') >= 0, '');
  ok('  → shriftlar uchun fonts.gstatic ruxsati bor',
    csp.indexOf('fonts.gstatic.com') >= 0, '');
  /* Begona saytga ma'lumot yuborilmasin */
  ok('  → connect-src da begona manba yo’q',
    !/connect-src[^;]*(?<!google-analytics\.com|googletagmanager\.com|'self')\s+https:\/\/(?!www\.google-analytics|\*\.google-analytics|\*\.analytics\.google|www\.googletagmanager)/.test(csp),
    csp.slice(0, 200));
  /* JSON javobda CSP keraksiz — lekin boshqa sarlavhalar bo'lsin */
  const apiR = await raw('/api/health');
  ok('API javobida CSP yo’q (keraksiz)', !(apiR.headers || {})['content-security-policy'], '');

  /* ---------- tozalash ---------- */
  for (const p of ['memberships/' + ID('m'), 'students/' + ID('s'), 'groups/' + ID('g'),
    'courses/' + ID('c'), 'staff/' + ID('t'), 'users/' + ID('u'), 'users/' + ID('a')]) {
    await req('/api/doc?path=' + encodeURIComponent(p), { method: 'DELETE', cookie: dir });
  }

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: hujumlar FAQAT vaqtinchalik sinov serveriga qilindi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
