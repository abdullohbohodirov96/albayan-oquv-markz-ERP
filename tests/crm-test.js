/* CRM SINOVI — telefoniya (webhook → qo'ng'iroq → murojaat/vazifa, ERP dan
   qo'ng'iroq), tavsiya bonusi (kod → murojaat → o'quvchi → birinchi to'lov →
   bonus → hisobga qo'llash) va ketish sababi.

   FAQAT VAQTINCHALIK SINOV SERVERIGA. PBX — shu testdagi soxta server,
   haqiqiy Sipuni/OnlinePBX ga hech narsa yuborilmaydi.
   Ishga tushirish:  node tests/crm-test.js [port] [direktor paroli]       */
'use strict';
const http = require('http');
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const API = 'http://localhost:' + PORT;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + String(extra).slice(0, 220) : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }
const R = 'c' + Date.now().toString(36);
const ID = n => R + '_' + n;

async function req(p, opts = {}) {
  const res = await fetch(API + p, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body !== undefined ? { 'Content-Type': opts.ctype || 'application/json' } : {},
      opts.cookie ? { Cookie: opts.cookie } : {}, opts.ip ? { 'X-Forwarded-For': opts.ip } : {}),
    body: opts.body !== undefined ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
    redirect: 'manual'
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const login = (l, p) => req('/api/login', { method: 'POST', body: { login: l, password: p } });
const put = (path, data, cookie, extra) => req('/api/doc?path=' + encodeURIComponent(path), { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });
const del = (path, cookie) => req('/api/doc?path=' + encodeURIComponent(path), { method: 'DELETE', cookie });
const boot = async cookie => { const b = await req('/api/bootstrap', { cookie }); return b.json; };
const colOf = (b, c) => Object.values((b && b.col && b.col[c]) || {});

(async () => {
  const dir = (await login('admin', PASS)).cookie;
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }
  await put('staff/' + ID('st'), { id: ID('st'), name: 'Ustoz C', status: 'faol', payType: 'fixed', salaryAmount: 1 }, dir);
  await put('users/' + ID('u'), { id: ID('u'), login: ID('ust'), name: 'Ustoz C', role: 'oqituvchi', staffId: ID('st'), active: true }, dir, { password: 'Pm7Qoriq42' });
  const ustoz = (await login(ID('ust'), 'Pm7Qoriq42')).cookie;
  ok('O’qituvchi kirdi', !!ustoz);

  /* ================= 1. Telefoniya sozlamasi ================= */
  section('1. Telefoniya sozlamasi va sirlar');
  let r = await req('/api/tel/config', { cookie: ustoz });
  eq('O’qituvchi sozlamani ko’rolmaydi (403)', r.status, 403);
  r = await req('/api/tel/config', { method: 'POST', cookie: dir, body: { enabled: true, provider: 'onlinepbx', domain: 'sinov.onpbx.ru', apiKey: 'KEY-' + R, exts: { usr_admin: '101' } } });
  eq('Sozlama saqlandi', r.status, 200);
  const TOKEN = r.json.webhookToken;
  ok('Webhook tokeni berildi', /^[a-f0-9]{30,}$/.test(TOKEN || ''), TOKEN);
  ok('Javobda sir yo’q, faqat "bor/yo’q"', r.json.has && r.json.has.apiKey === true && JSON.stringify(r.json).indexOf('KEY-' + R) < 0);
  const b0 = await boot(dir);
  ok('Bootstrap: sozlamada provayder bor, sir yo’q', b0.settings.tel && b0.settings.tel.provider === 'onlinepbx' && JSON.stringify(b0).indexOf('KEY-' + R) < 0 && JSON.stringify(b0).indexOf(TOKEN) < 0);
  r = await req('/api/doc?path=' + encodeURIComponent('meta/telsecret'), { cookie: dir });
  ok('meta/telsecret to’g’ridan-to’g’ri o’qilmaydi', r.status >= 400 || !r.json || !r.json.data || !r.json.data.apiKey, r.status);
  r = await put('meta/telsecret', { webhookToken: 'x' }, dir);
  ok('meta/telsecret ga yozib bo’lmaydi', r.status >= 400, r.status);
  /* Zaxira yuklab olinganda ham chiqmaydi */
  r = await req('/api/backup/run', { method: 'POST', cookie: dir, body: {} });
  const bname = r.json && r.json.file && r.json.file.name;
  if (bname) {
    const d = await req('/api/backup/file?name=' + encodeURIComponent(bname) + '&password=' + encodeURIComponent(PASS), { cookie: dir });
    ok('Zaxira nusxasida telefoniya siri yo’q', d.status === 200 && d.text.indexOf('KEY-' + R) < 0 && d.text.indexOf(TOKEN) < 0, d.status);
    /* Sir olib tashlangan nusxa baribir TIKLANADI (nazorat summasi qayta hisoblangan) */
    const pv = await req('/api/backup/preview', { method: 'POST', cookie: dir, body: { dump: d.json } });
    ok('Yuklab olingan (sirsiz) nusxani tiklash mumkin — nazorat summasi mos', pv.status === 200 && pv.json.ok === true && !(pv.json.errors || []).some(e => /Nazorat/.test(e)), JSON.stringify(pv.json && pv.json.errors));
  } else out.push('  · zaxira yo’li boshqa nomda — tekshirilmadi (' + JSON.stringify(r.json).slice(0, 80) + ')');

  /* ================= 2. Webhook ================= */
  section('2. PBX webhook → qo’ng’iroq → murojaat / vazifa');
  const hook = (body, tok, ctype) => req('/api/tel/webhook/' + (tok || TOKEN), { method: 'POST', body, ctype, ip: '10.40.1.' + Math.floor(Math.random() * 200) });
  r = await hook({ event: 'call_end', direction: 'inbound', caller_id_number: '998901234567', destination_number: '101', billsec: 0 }, 'notogri-token');
  eq('Noto’g’ri token → 404', r.status, 404);
  const PH1 = '+99890' + String(1000000 + Math.floor(Math.random() * 8999999));
  /* OnlinePBX uslubi: boshlanish, keyin tugash (javobsiz) */
  r = await hook({ event: 'call_start', direction: 'inbound', caller_id_number: PH1.slice(1), destination_number: '101', uuid: 'u1-' + R });
  eq('call_start qabul qilindi', r.status, 200);
  ok('Notanish raqam → murojaat ochildi', !!r.json.leadId, JSON.stringify(r.json));
  const LEAD1 = r.json.leadId;
  r = await hook({ event: 'call_end', direction: 'inbound', caller_id_number: PH1.slice(1), destination_number: '101', uuid: 'u1-' + R, billsec: 0, duration: 14, hangup_cause: 'NO_ANSWER' });
  eq('call_end: holat javobsiz', r.json.status, 'missed');
  ok('Javobsiz → vazifa ochildi', !!r.json.taskId, JSON.stringify(r.json));
  let b = await boot(dir);
  const calls1 = colOf(b, 'calls').filter(c => c.callId === 'u1-' + R);
  eq('Bir qo’ng’iroq — bitta yozuv (uuid bo’yicha birlashdi)', calls1.length, 1);
  eq('Qo’ng’iroq murojaatga bog’langan', calls1[0] && calls1[0].leadId, LEAD1);
  const lead1 = colOf(b, 'leads').find(l => l.id === LEAD1);
  ok('Murojaat: manba "Qo‘ng‘iroq", telefon normal', lead1 && lead1.source === 'Qo‘ng‘iroq' && lead1.phone === PH1 && lead1.viaCall === true, JSON.stringify(lead1 && [lead1.source, lead1.phone]));
  const task1 = colOf(b, 'tasks').find(t => t.id === r.json.taskId);
  ok('Vazifa: "Qayta qo‘ng‘iroq qiling", ext 101 egasiga', task1 && /Qayta qo‘ng‘iroq/.test(task1.title) && task1.assigneeId === 'usr_admin' && task1.status === 'yangi', JSON.stringify(task1 && [task1.title, task1.assigneeId]));
  /* Takror call_end — ikkinchi vazifa ochilmasin */
  r = await hook({ event: 'call_end', direction: 'inbound', caller_id_number: PH1.slice(1), uuid: 'u1-' + R, hangup_cause: 'NO_ANSWER' });
  b = await boot(dir);
  eq('Takror voqea — vazifa bitta', colOf(b, 'tasks').filter(t => t.callId === calls1[0].id).length, 1);
  eq('Takror voqea — murojaat bitta', colOf(b, 'leads').filter(l => l.phone === PH1).length, 1);

  /* O'sha raqam yana qo'ng'iroq qildi — mavjud murojaatga bog'lanadi, yangi ochilmaydi */
  r = await hook({ event: 'call_end', direction: 'inbound', caller_id_number: PH1, destination_number: '101', uuid: 'u2-' + R, billsec: 45, hangup_cause: 'NORMAL_CLEARING' });
  eq('Javob berilgan qo’ng’iroq', r.json.status, 'answered');
  eq('Mavjud murojaatga bog’landi', r.json.leadId, LEAD1);
  ok('Javob berilganda vazifa ochilmadi', !r.json.taskId);
  b = await boot(dir);
  eq('Hali ham bitta murojaat', colOf(b, 'leads').filter(l => l.phone === PH1).length, 1);

  /* Sipuni uslubi: o'quvchi raqami → o'quvchiga bog'lanadi */
  const PH2 = '+99893' + String(1000000 + Math.floor(Math.random() * 8999999));
  await put('students/' + ID('s'), { id: ID('s'), firstName: 'Ali', lastName: 'Valiyev', phone: PH2, status: 'faol' }, dir);
  r = await hook({ event: 'INCOMING_COMPLETED', number: PH2.slice(1), to: '101', status: 'ANSWER', timeTalk: 60, record: 'https://sipuni.com/rec/' + R + '.mp3', call_id: 's1-' + R, user: '101' });
  eq('Sipuni voqeasi qabul qilindi', r.status, 200);
  b = await boot(dir);
  const c2 = colOf(b, 'calls').find(c => c.callId === 's1-' + R);
  ok('O’quvchi raqami → o’quvchiga bog’landi, yozuv havolasi saqlandi', c2 && c2.studentId === ID('s') && c2.status === 'answered' && c2.duration === 60 && /sipuni\.com\/rec/.test(c2.record), JSON.stringify(c2));
  eq('O’quvchi uchun murojaat ochilmadi', colOf(b, 'leads').filter(l => l.phone === PH2).length, 0);
  /* Chiquvchi (xodim mijozga) */
  r = await hook({ event: 'OUTGOING_COMPLETED', number: PH2.slice(1), status: 'NOANSWER', call_id: 's2-' + R, user: '101', from: '101' });
  b = await boot(dir);
  const c3 = colOf(b, 'calls').find(c => c.callId === 's2-' + R);
  ok('Chiquvchi javobsiz — vazifa ochilmaydi, murojaat ochilmaydi', c3 && c3.dir === 'out' && !c3.taskId, JSON.stringify(c3));
  /* Yomon ma'lumot */
  r = await hook({ event: 'call_end', direction: 'inbound', caller_id_number: 'abc' });
  eq('Raqamsiz voqea → 400', r.status, 400);
  r = await hook('<xml/>', TOKEN, 'text/xml');
  ok('JSON bo’lmagan tana → 400', r.status === 400, r.status);
  /* O'qituvchiga qo'ng'iroqlar tushmaydi */
  const ub = await boot(ustoz);
  eq('O’qituvchiga qo’ng’iroqlar ro’yxati tushmaydi', colOf(ub, 'calls').length, 0);
  /* O'chirilgan telefoniya webhookni qabul qilmaydi */
  await req('/api/tel/config', { method: 'POST', cookie: dir, body: { enabled: false, provider: 'onlinepbx' } });
  r = await hook({ event: 'call_end', direction: 'inbound', caller_id_number: '998901112233', uuid: 'off-' + R });
  eq('O’chirilgan telefoniya → 503', r.status, 503);
  b = await boot(dir);
  eq('O’chirilganda yozuv yaratilmadi', colOf(b, 'calls').filter(c => c.callId === 'off-' + R).length, 0);

  /* ================= 2b. Jonli oqim (SSE) ================= */
  section('2b. Jonli oqim: qo’ng’iroq ochiq brauzerga darhol boradi');
  await req('/api/tel/config', { method: 'POST', cookie: dir, body: { enabled: true, provider: 'onlinepbx', exts: { usr_admin: '101' } } });
  const streamOf = cookie => new Promise(resolve => {
    const chunks = [];
    const rq = http.get(API + '/api/tel/stream', { headers: { Cookie: cookie } }, res => {
      res.on('data', d => { chunks.push(String(d)); if (chunks.join('').indexOf('event: call') >= 0) { rq.destroy(); resolve({ status: res.status || res.statusCode, text: chunks.join('') }); } });
      res.on('end', () => resolve({ status: res.statusCode, text: chunks.join('') }));
      if (res.statusCode !== 200) { res.resume(); setTimeout(() => { rq.destroy(); resolve({ status: res.statusCode, text: chunks.join('') }); }, 300); }
    });
    rq.on('error', () => resolve({ status: 0, text: '' }));
    setTimeout(() => { rq.destroy(); resolve({ status: 200, text: chunks.join(''), timeout: true }); }, 4000);
  });
  const t403 = await streamOf(ustoz);
  eq('O’qituvchi oqimga ulanolmaydi (403)', t403.status, 403);
  const PH4 = '+99894' + String(1000000 + Math.floor(Math.random() * 8999999));
  const pr = streamOf(dir);
  await new Promise(x => setTimeout(x, 400));
  await hook({ event: 'call_start', direction: 'inbound', caller_id_number: PH4.slice(1), destination_number: '101', uuid: 'sse-' + R });
  const got = await pr;
  ok('Direktor oqimida qo’ng’iroq voqeasi keldi (event: call, raqam, leadId)', got.status === 200 && /event: hello/.test(got.text) && /event: call/.test(got.text) && got.text.indexOf(PH4) >= 0 && /"leadId":"led_/.test(got.text), got.text.slice(0, 200));
  ok('Oqimda sir yo’q', got.text.indexOf(TOKEN) < 0);
  b = await boot(dir);
  for (const l of colOf(b, 'leads').filter(l => l.phone === PH4)) await del('leads/' + l.id, dir);

  /* ================= 3. ERP dan qo'ng'iroq (soxta PBX) ================= */
  section('3. ERP dan qo’ng’iroq — soxta PBX');
  const seen = [];
  const fake = http.createServer((rq, rs) => {
    let d = ''; rq.on('data', c => d += c); rq.on('end', () => {
      seen.push({ url: rq.url, auth: rq.headers['x-pbx-authentication'] || rq.headers.authorization || '', body: d });
      if (/fail/.test(rq.url)) { rs.writeHead(500); return rs.end('pbx down'); }
      rs.writeHead(200, { 'Content-Type': 'application/json' }); rs.end('{"status":"1"}');
    });
  });
  await new Promise(res => fake.listen(0, '127.0.0.1', res));
  const FP = fake.address().port;
  await req('/api/tel/config', { method: 'POST', cookie: dir, body: { enabled: true, provider: 'onlinepbx', domain: 'sinov.onpbx.ru', apiKey: 'KEY-' + R, apiBase: 'http://127.0.0.1:' + FP, exts: { usr_admin: '101' } } });
  r = await req('/api/tel/call', { method: 'POST', cookie: dir, body: { phone: '90 123 45 67' } });
  eq('Qo’ng’iroq buyurildi (200)', r.status, 200);
  ok('PBX ga so’rov ketdi: domen, kalit, from=101, to=998901234567', seen.length === 1 && /sinov\.onpbx\.ru\/call\/now\.json/.test(seen[0].url) && seen[0].auth === 'KEY-' + R && /from=101/.test(seen[0].body) && /to=998901234567/.test(seen[0].body), JSON.stringify(seen[0]));
  ok('Javobda sir yo’q', JSON.stringify(r.json).indexOf('KEY-' + R) < 0);
  b = await boot(dir);
  const oc = colOf(b, 'calls').find(c => c.dir === 'out' && c.byUserId === 'usr_admin' && c.phone === '+998901234567');
  ok('Chiquvchi qo’ng’iroq ro’yxatga tushdi', !!oc);
  r = await req('/api/tel/call', { method: 'POST', cookie: ustoz, body: { phone: '901234567' } });
  ok('Ext biriktirilmagan xodim → tushunarli xato', r.status === 400 && /ichki raqam/.test(r.json.error), r.status + ' ' + (r.json && r.json.error));
  r = await req('/api/tel/call', { method: 'POST', cookie: dir, body: { phone: '12' } });
  eq('Noto’g’ri raqam → 400', r.status, 400);
  await req('/api/tel/config', { method: 'POST', cookie: dir, body: { enabled: true, provider: 'onlinepbx', apiBase: 'http://127.0.0.1:' + FP + '/fail', exts: { usr_admin: '101' } } });
  r = await req('/api/tel/call', { method: 'POST', cookie: dir, body: { phone: '901234567' } });
  ok('PBX yiqilsa — 400 va tushunarli xabar, server tirik', r.status === 400 && /PBX/.test(r.json.error) && (await req('/api/health')).status === 200, r.status);
  /* Sipuni hash */
  await req('/api/tel/config', { method: 'POST', cookie: dir, body: { enabled: true, provider: 'sipuni', apiUser: '0123', apiSecret: 'SEC-' + R, apiBase: 'http://127.0.0.1:' + FP, exts: { usr_admin: '201' } } });
  seen.length = 0;
  r = await req('/api/tel/call', { method: 'POST', cookie: dir, body: { phone: '+998 90 123 45 67' } });
  const md5 = require('crypto').createHash('md5').update(['998901234567', '201', '0123', 'SEC-' + R].join('+')).digest('hex');
  ok('Sipuni: callback/call_number, hash to’g’ri, sir yuborilmadi', r.status === 200 && seen.length === 1 && /callback\/call_number/.test(seen[0].url) && seen[0].body.indexOf('hash=' + md5) >= 0 && seen[0].body.indexOf('SEC-') < 0, JSON.stringify(seen[0]));
  fake.close();
  await req('/api/tel/config', { method: 'POST', cookie: dir, body: { enabled: false, provider: 'umumiy', exts: {} } });

  /* ================= 4. Tavsiya bonusi ================= */
  section('4. Tavsiya bonusi: kod → murojaat → o’quvchi → to’lov → bonus');
  /* Eski (telefoniya yoqilgan paytdagi) sozlama bilan saqlash — telefoniya
     bo'limi serverda saqlanib qoladi: u faqat /api/tel/config orqali o'zgaradi */
  await put('meta/settings', Object.assign({}, b.settings, { referral: { enabled: true, amount: 100000, text: 'Do‘st olib kel' } }), dir);
  b = await boot(dir);
  ok('Eski sozlama saqlansa ham telefoniya holati o’zgarmadi (o’chiq qoldi)', b.settings.tel && b.settings.tel.enabled === false, JSON.stringify(b.settings.tel));
  const s1 = colOf(b, 'students').find(s => s.id === ID('s'));
  ok('O’quvchida tavsiya kodi bor (server bergan, 5 belgi)', s1 && /^[A-Z0-9]{5}$/.test(s1.refCode || ''), s1 && s1.refCode);
  const CODE = s1.refCode;
  r = await put('students/' + ID('s'), Object.assign({}, s1, { refCode: 'HACK1' }), dir);
  b = await boot(dir);
  eq('Kodni mijoz o’zgartira olmaydi', colOf(b, 'students').find(s => s.id === ID('s')).refCode, CODE);
  r = await req('/api/referral/lookup?code=' + CODE.toLowerCase(), { cookie: dir });
  ok('Kod bo’yicha qidirish (kichik harf ham)', r.status === 200 && r.json.student.id === ID('s'), r.status);
  r = await req('/api/referral/lookup?code=ZZZZZ', { cookie: dir });
  eq('Yo’q kod → 404', r.status, 404);
  /* Kabinet: kod ko'rinadi */
  const kb = await req('/api/kabinet', { method: 'POST', body: { code: colOf(b, 'students').find(s => s.id === ID('s')).code } });
  if (kb.status === 200 && kb.cookie) {
    const me = await req('/api/kabinet/me', { cookie: kb.cookie });
    ok('Kabinetda tavsiya kodi va matn ko’rinadi', me.json && me.json.referral && me.json.referral.code === CODE && /Do‘st/.test(me.json.referral.text), JSON.stringify(me.json && me.json.referral));
    ok('Kabinetda bonus summasi raqam sifatida chiqmaydi', !me.json.referral.amount);
  } else out.push('  · kabinet kirishi boshqacha — tekshirilmadi');
  /* Forma orqali tavsiya kodi bilan ariza */
  r = await req('/api/forms/save', { method: 'POST', cookie: dir, body: { title: 'Tavsiya ' + R, slug: 'tavsiya-' + R, fields: [
    { id: 'ism', type: 'text', label: 'Ismingiz', required: true }, { id: 'tel', type: 'phone', label: 'Telefon' }, { id: 'kod', type: 'referral', label: 'Do‘stingiz kodi' }] } });
  const FORM = r.json.form;
  ok('Formada "tavsiya kodi" maydoni', FORM && FORM.fields.some(f => f.type === 'referral'));
  const PH3 = '+99897' + String(1000000 + Math.floor(Math.random() * 8999999));
  r = await req('/api/form/submit', { method: 'POST', body: { slug: FORM.slug, answers: { ism: 'Dilshod Karimov', tel: PH3.slice(4), kod: ' ' + CODE.toLowerCase() + ' ' } }, ip: '10.41.0.9' });
  eq('Ariza qabul qilindi', r.status, 200);
  b = await boot(dir);
  const lead3 = colOf(b, 'leads').find(l => l.phone === PH3);
  ok('Murojaatda tavsiya qilgan o’quvchi aniqlandi', lead3 && lead3.referrerStudentId === ID('s') && lead3.refCode === CODE, JSON.stringify(lead3 && [lead3.referrerStudentId, lead3.refCode]));
  /* Murojaat → o'quvchi (referredBy bilan) */
  r = await put('students/' + ID('s2'), { id: ID('s2'), firstName: 'Dilshod', lastName: 'Karimov', phone: PH3, status: 'faol', referredBy: ID('s') }, dir);
  eq('Yangi o’quvchi saqlandi', r.status, 200);
  b = await boot(dir);
  let ref = colOf(b, 'referrals').find(x => x.referredId === ID('s2'));
  ok('Tavsiya yozuvi ochildi: kutilmoqda, 100 000', ref && ref.status === 'kutilmoqda' && ref.referrerId === ID('s') && ref.amount === 100000, JSON.stringify(ref));
  r = await put('students/' + ID('s2'), Object.assign({}, colOf(b, 'students').find(s => s.id === ID('s2')), { referredBy: ID('s2') }), dir);
  b = await boot(dir);
  eq('"Kim tavsiya qildi" keyin o’zgartirilmaydi', colOf(b, 'students').find(s => s.id === ID('s2')).referredBy, ID('s'));
  eq('Takror yozuv ochilmadi', colOf(b, 'referrals').filter(x => x.referredId === ID('s2')).length, 1);
  r = await put('students/' + ID('s3'), { id: ID('s3'), firstName: 'O‘zi', lastName: 'O‘zi', phone: '+998971111111', status: 'faol', referredBy: ID('s3') }, dir);
  b = await boot(dir);
  ok('O’zini o’zi tavsiya qilolmaydi', !colOf(b, 'students').find(s => s.id === ID('s3')).referredBy && !colOf(b, 'referrals').find(x => x.referredId === ID('s3')));
  r = await put('students/' + ID('s4'), { id: ID('s4'), firstName: 'Yo‘q', lastName: 'Kod', phone: '+998971111112', status: 'faol', referredBy: 'stu_yoq_' + R }, dir);
  b = await boot(dir);
  ok('Mavjud bo’lmagan o’quvchi tavsiya qilgan bo’lolmaydi', !colOf(b, 'students').find(s => s.id === ID('s4')).referredBy);
  /* Bonus tayyor emas — qo'llab bo'lmaydi */
  await put('courses/' + ID('c'), { id: ID('c'), name: 'Kurs C', monthlyFee: 500000, active: true }, dir);
  await put('groups/' + ID('g'), { id: ID('g'), code: 'C' + R.slice(-3), name: 'C guruh', courseId: ID('c'), teacherId: ID('st'), days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: '2026-01-05', fee: 500000, feeHistory: [{ fee: 500000, from: '2026-01' }], limit: 10, status: 'faol' }, dir);
  await put('memberships/' + ID('m1'), { id: ID('m1'), studentId: ID('s'), groupId: ID('g'), joinedAt: '2026-01-05', status: 'faol' }, dir);
  await put('memberships/' + ID('m2'), { id: ID('m2'), studentId: ID('s2'), groupId: ID('g'), joinedAt: '2026-10-01', status: 'faol' }, dir);
  const YM = (() => { const d = new Date(); d.setMonth(d.getMonth() + 5); return d.toISOString().slice(0, 7); })();
  r = await req('/api/invoices/generate', { method: 'POST', cookie: dir, body: { month: YM } });
  eq('Hisoblar yaratildi', r.status, 200);
  b = await boot(dir);
  const invRef = colOf(b, 'invoices').find(i => i.studentId === ID('s') && i.month === YM);
  ok('Tavsiya qilgan o’quvchida ochiq hisob bor', !!invRef, YM);
  r = await req('/api/referral/apply', { method: 'POST', cookie: dir, body: { id: ref.id, invoiceId: invRef.id } });
  ok('Bonus hali tayyor emas — rad (400)', r.status === 400 && /tayyor emas/.test(r.json.error), r.status + ' ' + (r.json && r.json.error));
  /* Birinchi to'lov → tayyor */
  r = await req('/api/payment', { method: 'POST', cookie: dir, body: { studentId: ID('s2'), amount: 200000, date: new Date().toISOString().slice(0, 10), method: 'naqd' } });
  eq('Do’sti to’lov qildi', r.status, 200);
  b = await boot(dir);
  ref = colOf(b, 'referrals').find(x => x.referredId === ID('s2'));
  eq('Bonus tayyor bo’ldi', ref && ref.status, 'tayyor');
  r = await req('/api/payment', { method: 'POST', cookie: dir, body: { studentId: ID('s2'), amount: 100000, date: new Date().toISOString().slice(0, 10), method: 'naqd' } });
  b = await boot(dir);
  eq('Ikkinchi to’lov holatni buzmadi', colOf(b, 'referrals').find(x => x.referredId === ID('s2')).status, 'tayyor');
  /* Qo'llash — huquq, noto'g'ri hisob, to'g'ri */
  r = await req('/api/referral/apply', { method: 'POST', cookie: ustoz, body: { id: ref.id, invoiceId: invRef.id } });
  eq('O’qituvchi bonus qo’llolmaydi (403)', r.status, 403);
  const invOther = colOf(b, 'invoices').find(i => i.studentId === ID('s2'));
  if (invOther) {
    r = await req('/api/referral/apply', { method: 'POST', cookie: dir, body: { id: ref.id, invoiceId: invOther.id } });
    ok('Boshqa o’quvchi hisobiga qo’llab bo’lmaydi', r.status === 400, r.status);
  }
  const before = colOf(b, 'invoices').find(i => i.id === invRef.id).final;
  r = await req('/api/referral/apply', { method: 'POST', cookie: dir, body: { id: ref.id, invoiceId: invRef.id } });
  eq('Bonus qo’llandi (200)', r.status, 200);
  b = await boot(dir);
  const invAfter = colOf(b, 'invoices').find(i => i.id === invRef.id);
  eq('Hisob 100 000 ga kamaydi', invAfter.final, before - 100000);
  eq('Hisobda bonus belgisi', invAfter.bonus, 100000);
  eq('Tavsiya: berildi', colOf(b, 'referrals').find(x => x.id === ref.id).status, 'berildi');
  r = await req('/api/referral/apply', { method: 'POST', cookie: dir, body: { id: ref.id, invoiceId: invRef.id } });
  ok('Ikkinchi marta qo’llab bo’lmaydi', r.status === 400 && /allaqachon/.test(r.json.error), r.status);
  b = await boot(dir);
  eq('Rad etilgandan keyin hisob o’zgarmadi', colOf(b, 'invoices').find(i => i.id === invRef.id).final, before - 100000);

  /* ================= 5. Ketish sababi ================= */
  section('5. Ketish sababi saqlanadi');
  const s4 = colOf(b, 'students').find(s => s.id === ID('s4'));
  r = await put('students/' + ID('s4'), Object.assign({}, s4, { status: 'arxiv', leftAt: '2026-10-10', leftReason: 'narx', leftNote: 'qimmat dedi' }), dir);
  b = await boot(dir);
  const s4b = colOf(b, 'students').find(s => s.id === ID('s4'));
  ok('Arxivlangan o’quvchida sabab, sana, izoh', s4b.status === 'arxiv' && s4b.leftReason === 'narx' && s4b.leftAt === '2026-10-10' && s4b.leftNote === 'qimmat dedi');

  /* ---------- tozalash ---------- */
  for (const l of colOf(b, 'leads').filter(l => [PH1, PH3].indexOf(l.phone) >= 0)) await del('leads/' + l.id, dir);
  for (const t of colOf(b, 'tasks').filter(t => t.viaCall)) await del('tasks/' + t.id, dir).catch(() => { });
  await req('/api/forms/delete', { method: 'POST', cookie: dir, body: { id: FORM.id } });
  for (const p of ['memberships/' + ID('m1'), 'memberships/' + ID('m2'), 'students/' + ID('s'), 'students/' + ID('s2'), 'students/' + ID('s3'), 'students/' + ID('s4'),
    'groups/' + ID('g'), 'courses/' + ID('c'), 'users/' + ID('u'), 'staff/' + ID('st')]) await del(p, dir);

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: PBX — soxta server; haqiqiy Sipuni/OnlinePBX ga so’rov ketmadi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
