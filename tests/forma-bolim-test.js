/* FORMALAR — BO'LIMLAR (kategoriyalar) sinovi.

   Markaz talabi: formalar bo'limlarga ajralsin — bo'lim ochiladi
   (masalan "Ro'yxat"), ichida formalar bo'ladi, formaga kirsa
   tushgan murojaatlar ko'rinadi. Bo'lim o'chsa formalar yo'qolmaydi.

   FAQAT VAQTINCHALIK SINOV SERVERIGA.
   Ishga tushirish:  node tests/forma-bolim-test.js [port] [parol]   */
'use strict';
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const API = 'http://localhost:' + PORT;
let pass = 0, fail = 0; const out = [];
function ok(n, c, x) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (x ? '  → ' + String(x).slice(0, 160) : '')); } }
function eq(n, g, w) { ok(n, g === w, 'kutilgan ' + JSON.stringify(w) + ', olindi ' + JSON.stringify(g)); }
function section(t) { out.push('\n' + t); }
const R = 'b' + Date.now().toString(36);

async function req(p, opts = {}) {
  const res = await fetch(API + p, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}, opts.cookie ? { Cookie: opts.cookie } : {}),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, redirect: 'manual'
  });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const login = (l, p) => req('/api/login', { method: 'POST', body: { login: l, password: p } });
const put = (path, data, cookie, extra) => req('/api/doc?path=' + encodeURIComponent(path), { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });
const bootstrap = (cookie) => req('/api/bootstrap', { cookie });
const catsOf = (b) => ((b.json && b.json.settings && b.json.settings.formCats) || []);

(async () => {
  const dir = (await login('admin', PASS)).cookie;
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  section('1. Bo’lim yaratish');
  const add = await req('/api/forms/cats', { method: 'POST', cookie: dir, body: { op: 'add', name: 'Ro’yxat ' + R } });
  eq('Bo’lim qo’shildi', add.status, 200);
  const catId = (add.json.cats || []).filter(c => c.name === 'Ro’yxat ' + R)[0] &&
    (add.json.cats || []).filter(c => c.name === 'Ro’yxat ' + R)[0].id;
  ok('Yangi bo’lim id oldi', !!catId, JSON.stringify(add.json.cats));
  const b1 = await bootstrap(dir);
  ok('Bo’lim sozlamada (settings.formCats) saqlandi', catsOf(b1).some(c => c.id === catId), JSON.stringify(catsOf(b1)));
  const noName = await req('/api/forms/cats', { method: 'POST', cookie: dir, body: { op: 'add', name: '  ' } });
  eq('Bo’sh nomli bo’lim rad etildi', noName.status, 400);

  section('2. Forma bo’limga biriktiriladi');
  const save = await req('/api/forms/save', { method: 'POST', cookie: dir, body: { title: 'Arab A1 ' + R, slug: 'arab-a1-' + R, catId: catId } });
  eq('Forma saqlandi', save.status, 200);
  const FID = save.json.form.id;
  eq('Formaning catId si yozildi', save.json.form.catId, catId);
  const gForm = await req('/api/doc?path=' + encodeURIComponent('forms/' + FID), { cookie: dir });
  eq('Bazada ham catId turibdi', (gForm.json.data || {}).catId, catId);

  section('3. Bo’lim nomini o’zgartirish');
  const ren = await req('/api/forms/cats', { method: 'POST', cookie: dir, body: { op: 'rename', id: catId, name: 'Qabul ' + R } });
  eq('Nom o’zgardi', ren.status, 200);
  ok('Yangi nom saqlandi', (ren.json.cats || []).filter(c => c.id === catId)[0].name === 'Qabul ' + R, JSON.stringify(ren.json.cats));

  section('4. Bo’lim o’chsa — forma yo’qolmaydi');
  const del = await req('/api/forms/cats', { method: 'POST', cookie: dir, body: { op: 'del', id: catId } });
  eq('Bo’lim o’chdi', del.status, 200);
  ok('Bo’lim ro’yxatdan chiqdi', !(del.json.cats || []).some(c => c.id === catId), JSON.stringify(del.json.cats));
  const gForm2 = await req('/api/doc?path=' + encodeURIComponent('forms/' + FID), { cookie: dir });
  ok('Forma hamon joyida (o’chmadi)', !!gForm2.json.data, JSON.stringify(gForm2.status));

  section('5. Huquq — oddiy o’qituvchi bo’lim boshqara olmaydi');
  await put('staff/' + R + 'st', { id: R + 'st', name: 'Ustoz B', status: 'faol', payType: 'fixed', salaryAmount: 1 }, dir);
  await put('users/' + R + 'u', { id: R + 'u', login: 'ust' + R, name: 'Ustoz B', role: 'oqituvchi', staffId: R + 'st', active: true }, dir, { password: 'Pm7Qoriq42' });
  const ust = (await login('ust' + R, 'Pm7Qoriq42')).cookie;
  ok('O’qituvchi kirdi', !!ust);
  if (ust) {
    const tryAdd = await req('/api/forms/cats', { method: 'POST', cookie: ust, body: { op: 'add', name: 'Ruxsatsiz' } });
    eq('O’qituvchi bo’lim qo’sha olmadi (403)', tryAdd.status, 403);
  }

  console.log(out.join('\n'));
  console.log('\n' + (fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ' — ' + pass + ' ta o’tdi, ' + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
