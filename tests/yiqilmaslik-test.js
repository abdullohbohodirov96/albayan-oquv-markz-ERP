/* YIQILMASLIK SINOVI — ichki asinxron xato serverni o'chirmasin.

   Forma orqali ariza kelganda server xodimlarga bot xabarini "yo'l-yo'lakay"
   (await siz) yuboradi. Ilgari bu chaqiruv try/catch ichida edi, lekin u
   ASINXRON: xato bo'lsa try/catch uni ushlamaydi, "ushlanmagan rad" paydo
   bo'ladi va Node 22 butun jarayonni o'chiradi — hamma foydalanuvchi
   bir vaqtda uzilib qoladi. Bu sinov o'sha xatoni sun'iy chaqirib
   (ALB_TEST_FAULT=notify, faqat NODE_ENV=test da ishlaydi), server
   ariza qabul qilgandan keyin ham tirik qolishini tekshiradi.

   Ishga tushirish:  node tests/yiqilmaslik-test.js                      */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3000 + Math.floor(Math.random() * 2000) + 1000;
const BASE = 'http://localhost:' + PORT;
const PASS = 'Albyana2026!';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'alb-yiq-'));
const PG = process.env.TEST_DATABASE_URL || '';

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + String(extra).slice(0, 200) : '')); }
}

let srv, exited = null;
function start() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: DIR, DB_DRIVER: PG ? 'pg' : 'sqlite', PORT: String(PORT), DATABASE_URL: PG,
      BACKUP_DIR: path.join(DIR, 'backups'), SEED_DIRECTOR_PASSWORD: PASS,
      NODE_ENV: 'test', ALB_TEST_FAULT: 'notify', TRUST_PROXY_HOPS: '1'
    }),
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let err = '';
  srv.stderr.on('data', d => { err += d; });
  srv.on('exit', code => { exited = { code, err: err.slice(-600) }; });
  return new Promise(async resolve => {
    for (let i = 0; i < 60; i++) {
      const st = await fetch(BASE + '/api/health').then(r => r.status).catch(() => 0);
      if (st === 200) return resolve(true);
      await new Promise(r => setTimeout(r, 300));
    }
    resolve(false);
  });
}
const j = (p, body, cookie) => fetch(BASE + p, {
  method: body ? 'POST' : 'GET',
  headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
  body: body ? JSON.stringify(body) : undefined
});

(async () => {
  ok('Server ko’tarildi', await start());
  const lg = await j('/api/login', { login: 'admin', password: PASS });
  const ck = (lg.headers.get('set-cookie') || '').split(';')[0];
  ok('Direktor kirdi', !!ck);
  const f = await (await j('/api/forms/save', { title: 'Yiqilmaslik', slug: 'yiq' }, ck)).json();
  ok('Forma tuzildi', !!(f.form && f.form.slug));

  /* Ariza — ichida bot xabari ataylab yiqiladi */
  const r = await j('/api/form/submit', { slug: f.form.slug, answers: { tel: '901234567' } });
  ok('Ariza qabul qilindi (200)', r.status === 200, r.status);
  await new Promise(x => setTimeout(x, 1200));
  const h = await fetch(BASE + '/api/health').then(x => x.status).catch(() => 0);
  ok('Ichki bot xatosidan keyin ham server TIRIK (health 200)', h === 200 && !exited,
    exited ? 'jarayon o’chdi, kod=' + exited.code + ' ' + exited.err : 'health=' + h);
  const b = await j('/api/bootstrap', null, ck).then(x => x.json()).catch(() => null);
  const leads = b && b.col && b.col.leads ? Object.values(b.col.leads).filter(l => l.formId === f.form.id) : [];
  ok('Murojaat bazaga tushgan', leads.length === 1, leads.length);

  /* Ikkinchi ariza ham — xato har safar yiqitmasin */
  const r2 = await j('/api/form/submit', { slug: f.form.slug, answers: { tel: '901234568' } });
  await new Promise(x => setTimeout(x, 600));
  const h2 = await fetch(BASE + '/api/health').then(x => x.status).catch(() => 0);
  ok('Ikkinchi arizadan keyin ham tirik', r2.status === 200 && h2 === 200 && !exited);

  try { srv.kill('SIGTERM'); } catch (e) { }
  await new Promise(x => setTimeout(x, 500));
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { }
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); try { srv.kill(); } catch (x) { } process.exit(1); });
