/* Zaxiradan tiklash sinovi — ALOHIDA, bo'sh sinov bazasiga.

   Tekshiriladi:
     1) zaxira yaratiladi va o'qiladi;
     2) tasdiqlash so'zisiz tiklash rad etiladi va baza o'zgarmaydi;
     3) tasdiqlash bilan tiklanganda yozuvlar soni manbaga mos keladi;
     4) zaxira faylida bot tokeni va ochiq parol yo'q;
     5) tiklangandan keyin server ishlaydi va kirish mumkin.

   Ikkita sinov serveri kerak (ikkalasi ham sun'iy ma'lumotli):
     node tests/restore-test.js [manba-port] [sinov-port] [direktor paroli]
   PRODUCTION BAZAGA TEGILMAYDI.                                              */
'use strict';
const SRC = 'http://localhost:' + (process.argv[2] || 3300);
const DST = 'http://localhost:' + (process.argv[3] || 3400);
const PASS = process.argv[4] || 'Albyana2026!';
let pass = 0, fail = 0; const out = [];
const ok = (n, c, e) => { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 160) : '')); } };

async function api(base, p, o = {}) {
  const r = await fetch(base + p, {
    method: o.method || 'GET',
    headers: Object.assign(o.body ? { 'Content-Type': 'application/json' } : {}, o.cookie ? { Cookie: o.cookie } : {}),
    body: o.body ? JSON.stringify(o.body) : undefined, redirect: 'manual'
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, text: t, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const login = b => api(b, '/api/login', { method: 'POST', body: { login: 'admin', password: PASS } }).then(r => r.cookie);

(async () => {
  const s = await login(SRC), d = await login(DST);
  ok('manba serverga kirildi', !!s); ok('sinov (bo’sh) serverga kirildi', !!d);

  /* Sinov o'zgalar qoldirgan ma'lumotga TAYANMAYDI: manbaga o'zining
     belgili o'quvchisini yozadi. Shunda "manbada ko'proq yozuv bor"
     sharti har qanday holatda bajariladi va tiklash aynan shu yozuv
     bo'yicha tekshiriladi.                                           */
  const MARK = 'tik_' + Date.now().toString(36);
  const markName = 'Tiklash Belgisi ' + MARK;
  const put = await api(SRC, '/api/doc?path=' + encodeURIComponent('students/' + MARK), {
    method: 'PUT', cookie: s,
    body: { data: { id: MARK, name: markName, phone: '+998900000000', status: 'faol' } }
  });
  ok('manbaga belgili o’quvchi yozildi (' + put.status + ')', put.status === 200, put.text.slice(0, 160));

  const run = await api(SRC, '/api/backup/run', { method: 'POST', cookie: s, body: {} });
  ok('zaxira yaratildi (' + run.status + ')', run.status === 200 && !!(run.json && run.json.file), run.text.slice(0, 160));
  const name = run.json && run.json.file && run.json.file.name;
  const dump = await api(SRC, '/api/backup/file?name=' + encodeURIComponent(name || ''), { cookie: s });
  ok('zaxira fayli o’qildi (' + dump.status + ')', dump.status === 200 && !!dump.json, dump.text.slice(0, 160));
  const before = await api(DST, '/api/collection?name=students', { cookie: d });
  const nBefore = Object.keys((before.json || {}).items || {}).length;
  const srcStudents = await api(SRC, '/api/collection?name=students', { cookie: s });
  const nSrc = Object.keys((srcStudents.json || {}).items || {}).length;
  /* Shart — sonlar farqi EMAS (sinov serveri avvalgi yugurishdan keyin
     to'la bo'lishi mumkin), balki shu yugurish belgisining sinov
     bazasida YO'Qligi. Aynan u tiklanganini keyin tekshiramiz.        */
  ok('belgili o’quvchi zaxirada bor', dump.text.indexOf(markName) >= 0, MARK);
  ok('belgili o’quvchi sinov bazasida hali yo’q (' + nBefore + ' / ' + nSrc + ')',
    !JSON.stringify((before.json || {}).items || {}).includes(markName));

  const noWord = await api(DST, '/api/backup/restore', { method: 'POST', cookie: d, body: { dump: dump.json } });
  ok('tasdiqlash so’zisiz tiklanmadi (' + noWord.status + ')', noWord.status === 400);
  const midway = await api(DST, '/api/collection?name=students', { cookie: d });
  ok('rad etilgandan keyin baza o’zgarmadi', Object.keys((midway.json || {}).items || {}).length === nBefore);
  const res = await api(DST, '/api/backup/restore', { method: 'POST', cookie: d, body: { dump: dump.json, confirm: 'TIKLASH' } });
  ok('tiklash so’rovi qabul qilindi (' + res.status + ')', res.status === 200, res.text.slice(0, 200));
  const after = await api(DST, '/api/collection?name=students', { cookie: d });
  const nAfter = Object.keys((after.json || {}).items || {}).length;
  ok('tiklangandan keyin o’quvchilar soni mos (' + nAfter + ' = ' + nSrc + ')', nAfter === nSrc);
  ok('belgili o’quvchi tiklangan bazada paydo bo’ldi',
    JSON.stringify((after.json || {}).items || {}).includes(markName), markName);
  const TOKEN_RE = /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/;
  ok('zaxira faylida bot tokeni yo’q', !TOKEN_RE.test(dump.text));
  ok('zaxira faylida parol xeshi bor, ochiq parol yo’q', !/"password"\s*:\s*"[^"]{4,}"/.test(dump.text), (dump.text.match(/"password"[^,]{0,40}/) || [''])[0]);
  const hp = await api(DST, '/api/health');
  ok('tiklangandan keyin server sog’lom', hp.status === 200, hp.text.slice(0, 80));
  const relog = await login(DST);
  ok('tiklangandan keyin kirish ishlaydi', !!relog);

  /* Belgini manbadan olib tashlaymiz — keyingi yugurishlar toza boshlanadi */
  await api(SRC, '/api/doc?path=' + encodeURIComponent('students/' + MARK),
    { method: 'DELETE', cookie: s });
  const gone = await api(SRC, '/api/collection?name=students', { cookie: s });
  ok('sinov belgisi manbadan o’chirildi',
    !JSON.stringify((gone.json || {}).items || {}).includes(markName));

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? '✗ XATOLAR BOR — ' + pass + ' ta o\'tdi, ' + fail + ' ta xato'
    : '✓ HAMMASI O’TDI — ' + pass + ' ta o\'tdi, 0 ta xato');
  console.log('Eslatma: tiklash ALOHIDA sinov bazasiga bajarildi; production bazaga tegilmadi.');
  process.exit(fail ? 1 : 0);
})();
