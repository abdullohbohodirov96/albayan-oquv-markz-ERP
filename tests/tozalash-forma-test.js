/* BAZANI TOZALASH — FORMALAR QOLADI sinovi.

   Markaz rahbari aytgan talab:
     "Ma'lumotlarni o'chirsam (noldan boshlasam) FORMA ham o'chib
      ketmasin!"

   Markaz formalarni logo/banner, kontakt va statistika bilan qiyinchilik
   bilan yasaydi. "Noldan boshlash" (backup/reset) sinov va demo
   yozuvlarni tozalaydi — lekin yasalgan FORMALAR qolishi kerak.
   Formadagi SINOV to'ldirishlari (formsub) va statistikasi (formstat)
   esa tozalanadi (ular demo).

   Sinov o'zining VAQTINCHALIK serverini ko'taradi va HAQIQIY reset
   bajaradi, shuning uchun boshqa sinov bazasini bo'shatmaydi.

   Ishga tushirish:  node tests/tozalash-forma-test.js
   PostgreSQL:        TEST_DATABASE_URL=postgres://... node tests/tozalash-forma-test.js */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = 'Albyana2026!';
const PORT = 4700 + Math.floor(Math.random() * 300);
const BASE = 'http://localhost:' + PORT;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-tozf-'));
const PG = process.env.TEST_DATABASE_URL || '';
let srv = null, COOKIE = '';

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + String(extra).slice(0, 200) : '')); }
}
function section(t) { out.push('\n' + t); }

async function bootServer() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: DIR, DB_DRIVER: PG ? 'pg' : 'sqlite', PORT: String(PORT),
      DATABASE_URL: PG || '', BACKUP_DIR: path.join(DIR, 'backups'),
      FILES_DIR: path.join(DIR, 'files'), SEED_DIRECTOR_PASSWORD: PASS
    }),
    stdio: 'ignore'
  });
  for (let i = 0; i < 90; i++) {
    const st = await fetch(BASE + '/api/health').then(r => r.status).catch(() => 0);
    if (st === 200) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}
function stopServer() {
  try { if (srv) srv.kill(); } catch (e) { }
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { }
}
async function req(p, opts) {
  opts = opts || {};
  const h = Object.assign(opts.body !== undefined ? { 'content-type': 'application/json' } : {}, opts.headers || {});
  if (COOKIE && !opts.noCookie) h.cookie = COOKIE;
  const r = await fetch(BASE + p, {
    method: opts.method || 'GET', headers: h, redirect: 'manual',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  const set = r.headers.get('set-cookie');
  if (set && !opts.noCookie) COOKIE = set.split(';')[0];
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch (e) { }
  return { status: r.status, data: j, text };
}
const put = (p, data, extra) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', body: Object.assign({ data }, extra || {}) });
const get = async (p) => { const r = await req('/api/doc?path=' + encodeURIComponent(p)); return { status: r.status, data: (r.data && r.data.data) || null }; };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhQGAWjR9awAAAABJRU5ErkJggg==';
const colOf = (b, c) => Object.values((b.data && b.data.col && b.data.col[c]) || {});

(async () => {
  if (!await bootServer()) { console.error('Server ishga tushmadi'); stopServer(); process.exit(1); }
  const login = await req('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  if (login.status !== 200) { console.error('Direktor kira olmadi'); stopServer(); process.exit(1); }

  /* =============== 1. Forma + rasm + ariza + o'quvchi =============== */
  section('1. Forma, rasm, ariza va o’quvchi tayyorlanadi');
  const slug = 'sinov-forma';
  let r = await req('/api/forms/save', { method: 'POST', body: { title: 'At-Tanal imtihoni', slug, intro: 'Kirish', info: 'Birinchi dars bepul' } });
  ok('Forma yaratildi', r.status === 200 && r.data && r.data.form && r.data.form.id, 'status ' + r.status);
  const FID = r.data && r.data.form && r.data.form.id;

  r = await req('/api/forms/bg', { method: 'POST', body: { id: FID, kind: 'logo', data: PNG } });
  ok('Logotip yuklandi', r.status === 200, 'status ' + r.status);

  /* Statistika (ochildi) + haqiqiy ariza — formstat/formsub tug'iladi */
  await req('/api/form/event', { method: 'POST', body: { slug, ev: 'view' }, noCookie: true });
  r = await req('/api/form/submit', { method: 'POST', body: { slug, answers: { ism: 'Ali', tel: '901234567' } }, noCookie: true });
  ok('Ariza yuborildi', r.status === 200, 'status ' + r.status + ' ' + (r.data && r.data.error || ''));

  await put('students/ts1', { id: 'ts1', firstName: 'Vali', lastName: 'Karim', phone: '+998901112233', status: 'faol' });

  const before = await req('/api/bootstrap');
  ok('Boshida: 1 ta forma bor', colOf(before, 'forms').length === 1, colOf(before, 'forms').length);
  ok('Boshida: ariza (formsub) bor', colOf(before, 'formsub').length >= 1, colOf(before, 'formsub').length);
  ok('Boshida: forma murojaati (lead) bor', colOf(before, 'leads').length >= 1, colOf(before, 'leads').length);
  ok('Boshida: o’quvchi bor', colOf(before, 'students').length >= 1, colOf(before, 'students').length);
  r = await req('/api/form-bg?id=' + FID + '&kind=logo');
  ok('Boshida: logotip ochiladi', r.status === 200, 'status ' + r.status);

  /* =============== 2. Noldan boshlash (reset) =============== */
  section('2. Baza tozalanadi (noldan boshlash)');
  r = await req('/api/backup/reset', { method: 'POST', body: { confirm: 'O’CHIRAMAN', password: PASS } });
  ok('Reset bajarildi', r.status === 200 && r.data && r.data.ok, 'status ' + r.status + ' ' + (r.data && r.data.error || ''));

  /* =============== 3. Forma QOLDI, demo ketdi =============== */
  section('3. Tozalashdan keyin: FORMA qoladi, sinov ma’lumoti ketadi');
  const after = await req('/api/bootstrap');
  ok('Forma O’CHMADI (qoldi)', colOf(after, 'forms').length === 1, colOf(after, 'forms').length);
  ok('Ariza (formsub) tozalandi', colOf(after, 'formsub').length === 0, colOf(after, 'formsub').length);
  ok('Statistika (formstat) tozalandi', colOf(after, 'formstat').length === 0, colOf(after, 'formstat').length);
  ok('Forma murojaatlari (leads) tozalandi', colOf(after, 'leads').length === 0, colOf(after, 'leads').length);
  ok('O’quvchilar tozalandi', colOf(after, 'students').length === 0, colOf(after, 'students').length);

  /* Forma hamon TIRIK: ochiq sahifa va ichki ma'lumot ishlaydi */
  r = await req('/f/' + slug, { noCookie: true });
  ok('Forma ochiq sahifasi hamon ochiladi (/f/slug)', r.status === 200 && /At-Tanal/.test(r.text), 'status ' + r.status);
  r = await req('/api/form?slug=' + slug, { noCookie: true });
  ok('Forma ma’lumoti hamon o’qiladi', r.status === 200 && r.data && r.data.form, 'status ' + r.status);
  r = await req('/api/form-bg?id=' + FID + '&kind=logo', { noCookie: true });
  ok('Logotip rasmi hamon ochiladi', r.status === 200, 'status ' + r.status);

  /* Kirish hisobi ham qoldi — qayta kira olamiz */
  COOKIE = '';
  r = await req('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  ok('Direktor tozalashdan keyin ham kiradi', r.status === 200, 'status ' + r.status);

  console.log(out.join('\n'));
  console.log('\n' + (fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') +
    ' — ' + pass + ' ta o’tdi, ' + fail + ' ta xato  [' + (PG ? 'PostgreSQL' : 'SQLite') + ']');
  stopServer();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); stopServer(); process.exit(1); });
