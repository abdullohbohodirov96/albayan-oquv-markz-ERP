/* Chuqurroq xavfsizlik tekshiruvi (xavfsizlik-test.js ustiga qo'shimcha).

   Tekshiriladi:
     1) bot tokeni javoblarda, sahifada, zaxirada va to'plamlarda chiqmaydi;
     2) maxfiy fayllar (.env, .git, server kodi, baza) brauzerdan ochilmaydi
        va yo'l bo'ylab chiqib ketish (path traversal) ishlamaydi;
     3) o'qituvchi o'zini direktor qila olmaydi, begona amallarni bajara olmaydi;
     4) server egalik qiladigan maydonlar (kod, telegram, guruh kodi) mijozdan yozilmaydi;
     5) in'ektsiya va XSS matni bajarilmaydi, baza buzilmaydi;
     6) CORS ochiq emas, cross-site va sessiyasiz yozuv o'tmaydi va
        rad etilgandan keyin bazadagi ma'lumot o'zgarmaydi;
     7) sessiya cookie HttpOnly va SameSite bilan beriladi.

   HAQIQIY TELEGRAM VA PRODUCTION ISHLATILMAYDI — soxta ma'lumot, vaqtinchalik
   baza va faqat localhost.

   Serverni ALOHIDA (sun'iy ma'lumotli) bazada ishga tushiring, keyin:
     node tests/audit-test.js [port] [direktor paroli]                        */
'use strict';
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const B = 'http://localhost:' + PORT;
let pass = 0, fail = 0; const out = [];
const ok = (n, c, e) => { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 160) : '')); } };
const sec = t => out.push('\n' + t);

async function req(p, o = {}) {
  const r = await fetch(B + p, {
    method: o.method || 'GET',
    headers: Object.assign(o.body ? { 'Content-Type': 'application/json' } : {}, o.cookie ? { Cookie: o.cookie } : {}, o.headers || {}),
    body: o.body ? JSON.stringify(o.body) : undefined, redirect: 'manual'
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, text: t, h: r.headers, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (p, data, ck) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie: ck, body: { data } });
const get = (p, ck) => req('/api/doc?path=' + encodeURIComponent(p), { cookie: ck });
const R = 'a' + Date.now().toString(36); const ID = n => R + '_' + n;

(async () => {
  const dir = (await req('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } })).cookie;
  if (!dir) { console.error('Direktor kira olmadi'); process.exit(1); }

  /* ---- 6. Bot tokeni hech qayerda chiqmasin ---- */
  sec('6. Bot tokeni oshkor bo’lmaydi');
  const TOKEN_RE = /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/;
  const boot = await req('/api/bootstrap', { cookie: dir });
  ok('bootstrap javobida token yo’q', !TOKEN_RE.test(boot.text));
  const pub = await req('/api/public');
  ok('/api/public javobida token yo’q', !TOKEN_RE.test(pub.text));
  ok('/api/public sessiyasiz ham ishlaydi', pub.status === 200, pub.status);
  const idx = await req('/');
  ok('index.html ichida token yo’q', !TOKEN_RE.test(idx.text));
  const bk = await req('/api/backup', { cookie: dir });
  ok('zaxira nusxada token yo’q', !TOKEN_RE.test(bk.text), bk.status);
  const envs = await req('/api/settings', { cookie: dir });
  ok('sozlamalar javobida token yo’q', !TOKEN_RE.test(envs.text));
  for (const c of ['botstate', 'botqueue', 'linktokens', 'kabsess']) {
    const r = await req('/api/collection?name=' + c, { cookie: dir });
    ok(c + ' to’plamida token yo’q', !TOKEN_RE.test(r.text), r.status);
  }
  const lt = await req('/api/collection?name=linktokens', { cookie: dir });
  const anyPlain = /"secret"|"token"\s*:/.test(lt.text);
  ok('linktokens ichida ochiq sir saqlanmagan', !anyPlain);
  ok('linktokens ichida xesh bor', /"hash"\s*:\s*"[a-f0-9]{64}"/.test(lt.text) || (lt.json && Object.keys(lt.json.items || {}).length === 0));

  /* ---- 7a. Maxfiy fayllar va yo'l bo'ylab chiqish ---- */
  sec('7a. Maxfiy fayl va yo’l bo’ylab chiqish (path traversal)');
  const paths = ['/.env', '/.env.example', '/.git/config', '/server/index.js', '/server/bot.js',
    '/package.json', '/..%2f..%2fetc%2fpasswd', '/static/../server/index.js',
    '/%2e%2e/%2e%2e/etc/passwd', '/backups/', '/data/albyana.db'];
  for (const p of paths) {
    const r = await req(p);
    const leaked = r.status === 200 && /TELEGRAM_BOT_TOKEN|require\(|root:x:|SQLite format/.test(r.text);
    ok('yopiq: ' + p + ' (' + r.status + ')', !leaked, r.text.slice(0, 60));
  }
  for (const p of ['../../../etc/passwd', 'students/../../users/u1', '../server/index.js']) {
    const r = await get(p, dir);
    ok('/api/doc yo’li rad etildi: ' + p + ' (' + r.status + ')', r.status >= 400 || !r.json || !r.json.data, r.text.slice(0, 60));
  }

  /* ---- 7b. Rolni ko'tarish ---- */
  sec('7b. Rolni ko’tarish (role escalation)');
  const tid = ID('t'), uid = ID('u');
  await put('staff/' + tid, { id: tid, name: 'Ustoz Sinov', status: 'faol' }, dir);
  const mk = await req('/api/doc?path=' + encodeURIComponent('users/' + uid), {
    method: 'PUT', cookie: dir,
    body: {
      data: { id: uid, login: 'ust_' + R, name: 'Ustoz Sinov', role: 'oqituvchi', staffId: tid, active: true },
      password: 'Sinov12345!'
    }
  });
  ok('o’qituvchi hisobi yaratildi', mk.status === 200, mk.status + ' ' + mk.text.slice(0, 120));
  const tck = (await req('/api/login', { method: 'POST', body: { login: 'ust_' + R, password: 'Sinov12345!' } })).cookie;
  ok('o’qituvchi kira oldi', !!tck);
  if (tck) {
    const esc1 = await put('users/' + uid, { id: uid, login: 'ust_' + R, name: 'Ustoz Sinov', role: 'direktor', staffId: tid, active: true }, tck);
    const after = await get('users/' + uid, dir);
    ok('o’zini direktor qila olmadi (' + esc1.status + ')', (after.json && after.json.data && after.json.data.role) !== 'direktor',
      after.json && after.json.data && after.json.data.role);
    const nid = ID('x');
    const esc2 = await req('/api/doc?path=' + encodeURIComponent('users/' + nid), {
      method: 'PUT', cookie: tck,
      body: { data: { id: nid, login: 'x' + R, name: 'X', role: 'direktor', active: true }, password: 'Sinov12345!' }
    });
    ok('o’qituvchi yangi direktor yarata olmadi (' + esc2.status + ')', esc2.status >= 400);
    const esc3 = await put('settings/main', { id: 'main', centerName: 'Buzildi' }, tck);
    ok('o’qituvchi sozlamani o’zgartira olmadi (' + esc3.status + ')', esc3.status >= 400);
    const esc4 = await req('/api/collection?name=users', { cookie: tck });
    const hasHash = /"passwordHash"|"hash"\s*:\s*"\$/.test(esc4.text);
    ok('o’qituvchiga parol xeshi ko’rinmadi', !hasHash);
    const esc5 = await req('/api/backup', { cookie: tck });
    ok('o’qituvchi zaxira ola olmadi (' + esc5.status + ')', esc5.status >= 400);
  }

  /* ---- 7c. Server egalik qiladigan maydonlar ---- */
  sec('7c. Server egalik qiladigan maydonlar');
  const sid = ID('s');
  await put('students/' + sid, { id: sid, firstName: 'Soxta', lastName: 'Sinov', status: 'active' }, dir);
  const s0 = (await get('students/' + sid, dir)).json.data;
  const code0 = s0.code;
  await put('students/' + sid, Object.assign({}, s0, { code: '9999' }), dir);
  const s1 = (await get('students/' + sid, dir)).json.data;
  ok('kodni qo’lda o’zgartirib bo’lmaydi', s1.code === code0, s1.code + ' vs ' + code0);
  await put('students/' + sid, Object.assign({}, s1, { telegram: { id: '424242', name: 'Begona' } }), dir);
  const s2 = (await get('students/' + sid, dir)).json.data;
  ok('telegram bog’lanishini qo’lda yozib bo’lmaydi', !(s2.telegram && s2.telegram.id === '424242'), JSON.stringify(s2.telegram));
  const gid = ID('g');
  await put('groups/' + gid, { id: gid, name: 'Sinov guruh', teacherId: tid, status: 'faol' }, dir);
  const g0 = (await get('groups/' + gid, dir)).json.data;
  await put('groups/' + gid, Object.assign({}, g0, { code: 'AAAA', tgChat: '-100999' }), dir);
  const g1 = (await get('groups/' + gid, dir)).json.data;
  ok('guruh kodini qo’lda o’zgartirib bo’lmaydi', g1.code === g0.code, g1.code + ' vs ' + g0.code);
  ok('guruh Telegram suhbatini qo’lda yozib bo’lmaydi', String(g1.tgChat || '') !== '-100999', String(g1.tgChat));

  /* ---- 7d. SQL/NoSQL in'ektsiya va XSS ---- */
  sec('7d. In’ektsiya va XSS');
  const evil = "'; DROP TABLE docs; --";
  const r1 = await req('/api/collection?name=' + encodeURIComponent(evil), { cookie: dir });
  ok('yaroqsiz to’plam nomi rad etildi (' + r1.status + ')', r1.status >= 400 || !r1.json || !r1.json.items || Object.keys(r1.json.items).length === 0);
  const still = await req('/api/collection?name=students', { cookie: dir });
  ok('baza buzilmadi (students hali o’qiladi)', still.status === 200 && !!still.json);
  const xid = ID('x');
  const XSS = '<img src=x onerror=alert(1)>';
  await put('students/' + xid, { id: xid, firstName: XSS, lastName: 'Sinov', status: 'active' }, dir);
  const xr = await get('students/' + xid, dir);
  ok('matn JSON sifatida qaytadi (bajarilmaydi)', xr.json.data.firstName === XSS);
  ok('javob Content-Type json', /application\/json/.test(xr.h.get('content-type') || ''), xr.h.get('content-type'));
  const idx2 = await req('/');
  ok('index.html ichiga foydalanuvchi matni qo’shilmaydi', idx2.text.indexOf('onerror=alert') < 0);

  /* ---- 7e. CORS / CSRF ---- */
  sec('7e. CORS va CSRF');
  const cors = await req('/api/bootstrap', { cookie: dir, headers: { Origin: 'https://evil.example' } });
  const acao = cors.h.get('access-control-allow-origin');
  ok('cross-site Origin uchun CORS ruxsati berilmagan', !acao || acao === 'null', acao);
  const opt = await fetch(B + '/api/doc?path=students/' + sid, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PUT' } });
  ok('preflight ruxsat bermaydi', !opt.headers.get('access-control-allow-origin'), opt.headers.get('access-control-allow-origin'));
  const form = await fetch(B + '/api/doc?path=students/' + sid, {
    method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: dir, Origin: 'https://evil.example' },
    body: JSON.stringify({ data: { id: sid, firstName: 'CSRF' } }), redirect: 'manual'
  });
  const s3 = (await get('students/' + sid, dir)).json.data;
  ok('cross-site yozuv o’tmadi (' + form.status + ')', s3.firstName !== 'CSRF', s3.firstName);
  const noCk = await put('students/' + sid, { id: sid, firstName: 'Sessiyasiz' }, '');
  ok('sessiyasiz yozuv rad etildi (' + noCk.status + ')', noCk.status >= 400);
  const s4 = (await get('students/' + sid, dir)).json.data;
  ok('rad etilgandan keyin baza o’zgarmadi', s4.firstName === s3.firstName, s4.firstName);
  const ck = boot.h.get('set-cookie') || '';

  /* ---- 7f. Sessiya cookie sozlamalari ---- */
  sec('7f. Sessiya cookie');
  const lr = await fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'admin', password: PASS }) });
  const sc = lr.headers.get('set-cookie') || '';
  ok('HttpOnly', /HttpOnly/i.test(sc), sc);
  ok('SameSite', /SameSite=(Lax|Strict)/i.test(sc), sc);
  ok('Path=/', /Path=\//.test(sc), sc);

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? '✗ XATOLAR BOR — ' + pass + ' ta o\'tdi, ' + fail + ' ta xato'
    : '✓ HAMMASI O’TDI — ' + pass + ' ta o\'tdi, 0 ta xato');
  console.log('Eslatma: vaqtinchalik baza, soxta foydalanuvchilar; haqiqiy Telegram va production ishlatilmadi.');
  process.exit(fail ? 1 : 0);
})();
