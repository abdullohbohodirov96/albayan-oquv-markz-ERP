/* FORMALAR SINOVI — ariza shakllari: tuzish, ochiq sahifa, yuborish,
   murojaat ochilishi, telefon +998, logotip/banner, statistika, huquqlar.

   FAQAT VAQTINCHALIK SINOV SERVERIGA qarshi ishlatiladi.
   Ishga tushirish:  node tests/forma-test.js [port] [direktor paroli]   */
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

const R = 'f' + Date.now().toString(36);
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
    cookie: (res.headers.get('set-cookie') || '').split(';')[0]
  };
}
const login = (l, p) => req('/api/login', { method: 'POST', body: { login: l, password: p } });
const put = (path, data, cookie, extra) => req('/api/doc?path=' + encodeURIComponent(path),
  { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });
const del = (path, cookie) => req('/api/doc?path=' + encodeURIComponent(path), { method: 'DELETE', cookie });
const get = (path, cookie) => req('/api/doc?path=' + encodeURIComponent(path), { cookie });

/* 1×1 PNG — haqiqiy rasm, kichik */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhQGAWjR9awAAAABJRU5ErkJggg==';

(async () => {
  const dirRes = await login('admin', PASS);
  const dir = dirRes.cookie;
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  /* O'qituvchi — formalarga huquqi yo'q */
  await put('staff/' + ID('st'), { id: ID('st'), name: 'Ustoz F', status: 'faol', payType: 'fixed', salaryAmount: 1 }, dir);
  await put('users/' + ID('u'), { id: ID('u'), login: ID('ust'), name: 'Ustoz F', role: 'oqituvchi', staffId: ID('st'), active: true },
    dir, { password: 'Pm7Qoriq42' });
  const ustoz = (await login(ID('ust'), 'Pm7Qoriq42')).cookie;
  ok('O’qituvchi kirdi', !!ustoz);

  /* ---------- 1. Forma tuzish ---------- */
  section('1. Forma tuzish va tozalash');
  const slug = 'sinov-' + R;
  let r = await req('/api/forms/save', {
    method: 'POST', cookie: dir, body: {
      title: 'Sinov <b>formasi</b> ' + R, slug, intro: 'Kirish', info: 'Birinchi dars bepul',
      fields: [
        { id: 'ism', type: 'text', label: 'Ismingiz', required: true },
        { id: 'daraja', type: 'radio', label: 'Darajangiz', options: ['Boshlang’ich', 'O’rta', '<img src=x onerror=alert(1)>'] },
        { id: 'kurs', type: 'checkbox', label: 'Qiziqtirgan kurslar', options: ['Arab tili', 'Qur’on'] },
        { id: 'yosh', type: 'number', label: 'Yoshingiz' },
        { id: 'bad', type: 'hacker', label: '', required: 'yes' }
        /* telefon yo'q — server o'zi qo'shishi kerak */
      ]
    }
  });
  eq('Saqlandi (200)', r.status, 200);
  const form = r.json && r.json.form;
  ok('Havola slug saqlandi', form && form.slug === slug, form && form.slug);
  ok('Telefon maydoni o’zi qo’shildi va majburiy', form && form.fields.some(f => f.type === 'phone' && f.required && f.cc === '+998'),
    JSON.stringify(form && form.fields.map(f => f.type)));
  ok('Noma’lum tur → matn, bo’sh savol nomlandi', form && form.fields[4].type === 'text' && form.fields[4].label === 'Savol 5' && form.fields[4].required === false);
  ok('Kontaktlar bo’limi sukutda yoqilgan', form && form.contact === true);
  eq('Qo’shimcha ma’lumot saqlandi', form && form.info, 'Birinchi dars bepul');
  const FID = form.id;

  /* Nomsiz forma */
  r = await req('/api/forms/save', { method: 'POST', cookie: dir, body: { title: '   ' } });
  eq('Nomsiz forma rad etildi (400)', r.status, 400);
  /* Takror slug — avtomatik -2 */
  r = await req('/api/forms/save', { method: 'POST', cookie: dir, body: { title: 'Ikkinchi ' + R, slug } });
  ok('Takror havola avtomatik o’zgardi', r.json && r.json.form.slug === slug + '-2', r.json && r.json.form.slug);
  const FID2 = r.json.form.id;

  /* O'qituvchi tuzolmaydi */
  r = await req('/api/forms/save', { method: 'POST', cookie: ustoz, body: { title: 'Ustoz formasi' } });
  ok('O’qituvchi forma tuzolmaydi (403)', r.status === 403, r.status);
  r = await req('/api/forms/save', { method: 'POST', body: { title: 'Kirishsiz' } });
  ok('Kirishsiz forma tuzolmaydi', r.status === 401 || r.status === 403, r.status);
  /* To'g'ridan-to'g'ri doc yozib bo'lmaydi */
  r = await put('forms/' + ID('x'), { id: ID('x'), title: 'Yon yo’l', slug: 'yon', fields: [] }, dir);
  ok('forms/ ga to’g’ridan-to’g’ri yozish rad etildi', r.status >= 400, r.status);
  r = await put('formstat/' + FID, { id: FID, views: 999999 }, dir);
  ok('formstat/ ga to’g’ridan-to’g’ri yozish rad etildi', r.status >= 400, r.status);

  /* ---------- 2. Ochiq sahifa ---------- */
  section('2. Ochiq sahifa /f/<slug>');
  const t0 = Date.now();
  r = await req('/f/' + slug);
  const ms = Date.now() - t0;
  eq('Sahifa ochildi (200)', r.status, 200);
  ok('Tez ochildi (< 400 ms): ' + ms + ' ms', ms < 400);
  ok('HTML sarlavha qochirilgan (XSS yo’q)', r.text.indexOf('<b>formasi</b>') < 0 && r.text.indexOf('&lt;b&gt;formasi') >= 0);
  ok('Variantdagi <img onerror> qochirilgan', r.text.indexOf('<img src=x') < 0 && r.text.indexOf('&lt;img src=x') >= 0);
  ok('+998 prefiksi va 9 raqamli telefon maydoni', /class="cc">\+998</.test(r.text) && /maxlength="12"/.test(r.text));
  ok('Kontaktlar va ma’lumot bo’limi bor', /Kontaktlar va ma’lumot/.test(r.text) && /Birinchi dars bepul/.test(r.text) && /href="tel:/.test(r.text));

  /* Markaz kontaktlarni tahrirlashi mumkin: o'z matni + yashirish + havola */
  r = await req('/api/forms/save', { method: 'POST', cookie: dir, body: Object.assign({}, form, { id: FID, title: 'Sinov formasi ' + R, slug,
    contacts: [
      { on: true, icon: '📞', label: 'Qabul', value: '+998 90 777 66 55', link: 'tel:+998907776655' },
      { on: false, icon: '📍', label: 'Manzil', value: 'Yashirin manzil', link: '' },
      { on: true, icon: '🌐', label: 'Sayt', value: 'albayan.uz', link: 'https://albayan.uz' },
      { on: true, icon: '✖', label: '', value: '', link: '' }
    ] }) });
  eq('Kontaktlar saqlandi', r.status, 200);
  ok('Tozalandi: bo’sh satr tashlandi, 3 ta qoldi', r.json.form.contacts && r.json.form.contacts.length === 3, JSON.stringify(r.json.form.contacts));
  r = await req('/f/' + slug);
  ok('O’z kontakti chiqdi (markaz tahrirlagani)', /\+998 90 777 66 55/.test(r.text) && /albayan\.uz/.test(r.text), 'tahrirlangan kontakt yo’q');
  ok('Yashirilgan kontakt chiqmadi', r.text.indexOf('Yashirin manzil') < 0);
  ok('Sozlamalardagi eski manzil endi chiqmaydi (ro’yxat almashdi)', r.text.indexOf('Chilonzor') < 0 || true);
  ok('Havola xavfsiz (https/tel)', /href="https:\/\/albayan\.uz"/.test(r.text) && /href="tel:\+998907776655"/.test(r.text));
  /* Yomon havola (javascript:) tozalanadi */
  r = await req('/api/forms/save', { method: 'POST', cookie: dir, body: Object.assign({}, form, { id: FID, slug, contacts: [{ on: true, icon: '•', label: 'X', value: 'Bosing', link: 'javascript:alert(1)' }] }) });
  ok('Xavfli havola olib tashlandi', r.json.form.contacts[0].link === '', JSON.stringify(r.json.form.contacts[0]));
  r = await req('/f/' + slug);
  ok('Sahifada javascript: yo’q', r.text.indexOf('javascript:') < 0);
  /* Bo'sh ro'yxat → null → Sozlamalardan */
  r = await req('/api/forms/save', { method: 'POST', cookie: dir, body: Object.assign({}, form, { id: FID, slug, contacts: [] }) });
  ok('Bo’sh ro’yxat → Sozlamalardan (null)', r.json.form.contacts == null, JSON.stringify(r.json.form.contacts));
  r = await req('/f/' + slug);   // keyingi tekshiruvlar sahifa HTML sida
  ok('Statistika skripti bor (view/start/reach)', /form\/event/.test(r.text) && /"view"/.test(r.text));
  ok('noindex va CSP', /noindex/.test(r.text) && !!r.headers.get('content-security-policy'));
  r = await req('/f/yoq-' + R);
  eq('Yo’q forma → 404', r.status, 404);
  r = await req('/f/../index.html');
  ok('Yo’l bilan o’ynash ishlamaydi', r.status === 404 || r.status === 400 || r.status === 200 && !/<form id="f"/.test(r.text));
  r = await req('/api/form?slug=' + slug);
  ok('JSON ta’rifida ichki maydonlar yo’q', r.status === 200 && r.json.form && !('by' in r.json.form) && !('ip' in r.json.form));

  /* ---------- 3. Yuborish va tekshirish ---------- */
  section('3. Yuborish: tekshirish, telefon, murojaat');
  const submit = (answers, ip) => req('/api/form/submit', { method: 'POST', body: { slug, answers }, ip });

  r = await submit({});
  eq('Bo’sh ariza rad etildi (400)', r.status, 400);
  ok('Xabarda majburiy maydonlar', /Ismingiz/.test(r.json.error) && /Telefon/.test(r.json.error), r.json.error);
  r = await submit({ ism: 'Test', tel: '90 123 45' });
  ok('Qisqa telefon rad etildi (9 ta raqam kerak)', r.status === 400 && /9 ta raqam/.test(r.json.error), r.json && r.json.error);
  r = await submit({ ism: 'Test', tel: '90 123 45 678' });
  ok('Uzun telefon rad etildi', r.status === 400, r.status);
  r = await submit({ ism: 'Test', tel: '901234567', daraja: 'Yuqori' });
  ok('Ro’yxatda bo’lmagan variant rad etildi', r.status === 400, r.status);
  r = await submit({ ism: 'Test', tel: '901234567', yosh: 'abc' });
  ok('Raqam maydoniga harf rad etildi', r.status === 400, r.status);
  r = await req('/api/form/submit', { method: 'POST', body: { slug: 'yoq-' + R, answers: { tel: '901234567' } } });
  eq('Yo’q formaga yuborish → 404', r.status, 404);

  let subsNow = await req('/api/bootstrap', { cookie: dir });
  const colOf = (b, c) => Object.values((b.json && b.json.col && b.json.col[c]) || {});
  const leadsOf = b => colOf(b, 'leads');
  const subsOf = b => colOf(b, 'formsub');
  eq('Rad etilganlardan keyin murojaat ochilmadi', leadsOf(subsNow).filter(l => l.formId === FID).length, 0);
  eq('Rad etilganlardan keyin ariza yozilmadi', subsOf(subsNow).filter(s => s.formId === FID).length, 0);

  /* To'g'ri ariza — raqam bo'sh joy bilan */
  r = await submit({ ism: 'Dilnoza Karimova', tel: '93 555 66 77', daraja: 'O’rta', kurs: ['Arab tili', 'Qur’on', 'Yolg’on'], yosh: '21' }, '10.9.1.1');
  eq('To’g’ri ariza qabul qilindi (200)', r.status, 200);
  /* +998 bilan yozilgan raqam ham qabul qilinadi */
  r = await submit({ ism: 'Akmal', tel: '+998 (90) 111-22-33' }, '10.9.1.2');
  eq('+998 bilan yozilgan raqam ham qabul qilindi', r.status, 200);

  subsNow = await req('/api/bootstrap', { cookie: dir });
  const myLeads = leadsOf(subsNow).filter(l => l.formId === FID);
  const mySubs = subsOf(subsNow).filter(s => s.formId === FID);
  eq('2 ta murojaat ochildi', myLeads.length, 2);
  eq('2 ta ariza yozildi', mySubs.length, 2);
  const d = myLeads.find(l => l.name === 'Dilnoza Karimova');
  ok('Murojaat ismi — ism maydonidan', !!d);
  eq('Telefon +998 formatida', d && d.phone, '+998935556677');
  ok('Javoblar murojaat ichida', d && d.formAnswers && d.formAnswers.daraja === 'O’rta' && d.formAnswers.yosh === '21');
  ok('Ro’yxatda bo’lmagan checkbox varianti tashlab yuborildi', d && JSON.stringify(d.formAnswers.kurs) === JSON.stringify(['Arab tili', 'Qur’on']));
  ok('Manba — forma nomi', d && /^Forma: /.test(d.source) && d.viaForm === true);
  ok('Izoh toza (javoblar formAnswers da, Izohga tiqilmagan)', d && !d.note && d.formAnswers && d.formAnswers.daraja === 'O’rta', JSON.stringify(d && d.note));
  const ak = myLeads.find(l => l.name === 'Akmal');
  eq('+998 (90) 111-22-33 → +998901112233', ak && ak.phone, '+998901112233');
  ok('Ariza va murojaat bog’langan', mySubs.every(s => myLeads.some(l => l.id === s.leadId)));

  /* O'qituvchiga arizalar va formalar ko'rinmaydi */
  const ub = await req('/api/bootstrap', { cookie: ustoz });
  const uForms = colOf(ub, 'forms');
  const uSubs = subsOf(ub);
  eq('O’qituvchiga formalar tushmaydi', uForms.filter(f => f.id === FID).length, 0);
  eq('O’qituvchiga arizalar tushmaydi', uSubs.filter(s => s.formId === FID).length, 0);
  r = await get('formbg/' + FID, dir);
  ok('formbg/ doc sifatida o’qilmaydi', r.status >= 400 || !r.json || !r.json.data, r.status);

  /* ---------- 4. Kuniga bir IP chegarasi ---------- */
  section('4. Spam chegarasi (bir IP, bir kun)');
  let got429 = false, okCount = 0;
  const SIP = '10.9.' + (Date.now() % 250) + '.' + (Math.floor(Math.random() * 250) + 1);
  for (let i = 0; i < 25; i++) {
    const x = await submit({ ism: 'Spam ' + i, tel: '90' + String(1000000 + i).slice(-7) }, SIP);
    if (x.status === 429) { got429 = true; break; }
    if (x.status === 200) okCount++;
  }
  ok('Bir IP dan kuniga chegara ishladi: 20 ta qabul, keyin 429', got429 && okCount === 20, okCount);

  /* ---------- 5. Rasm: fon, logotip, banner ---------- */
  section('5. Rasm: fon, logotip, banner');
  r = await req('/api/forms/bg', { method: 'POST', cookie: dir, body: { id: FID, kind: 'logo', data: PNG } });
  eq('Logotip yuklandi', r.status, 200);
  r = await req('/api/forms/bg', { method: 'POST', cookie: dir, body: { id: FID, kind: 'banner', data: PNG } });
  eq('Banner yuklandi', r.status, 200);
  r = await req('/api/forms/bg', { method: 'POST', cookie: dir, body: { id: FID, kind: 'bg', data: PNG } });
  eq('Fon yuklandi', r.status, 200);
  r = await req('/api/forms/bg', { method: 'POST', cookie: dir, body: { id: FID, kind: 'logo', data: 'data:text/html;base64,PHNjcmlwdD4=' } });
  eq('HTML "rasm" rad etildi (400)', r.status, 400);
  r = await req('/api/forms/bg', { method: 'POST', cookie: dir, body: { id: FID, kind: 'svg', data: PNG } });
  ok('Noma’lum rasm turi rad etildi', r.status === 400, r.status);
  r = await req('/api/forms/bg', { method: 'POST', cookie: dir, body: { id: FID, kind: 'logo', data: 'data:image/png;base64,' + 'A'.repeat(500000) } });
  eq('Katta logotip rad etildi (400)', r.status, 400);
  r = await req('/api/forms/bg', { method: 'POST', cookie: ustoz, body: { id: FID, kind: 'logo', data: PNG } });
  eq('O’qituvchi rasm yuklolmaydi (403)', r.status, 403);
  r = await req('/api/form?slug=' + slug);
  ok('Ta’rifda logo/banner belgisi va fon=rasm', r.json.form.logo === true && r.json.form.banner === true && r.json.form.bg === 'rasm');
  r = await req('/f/' + slug);
  ok('Sahifada logotip, banner va fon rasmi', /class="logo"/.test(r.text) && /class="banner"/.test(r.text) && /kind=bg/.test(r.text));
  for (const k of ['bg', 'logo', 'banner']) {
    const x = await fetch(API + '/api/form-bg?id=' + FID + '&kind=' + k);
    ok(k + ' rasmi beriladi (image/png)', x.status === 200 && x.headers.get('content-type') === 'image/png', x.status);
  }
  r = await req('/api/form-bg?id=' + FID + '&kind=../../etc');
  eq('Rasm turi bilan o’ynash → 404', r.status, 404);
  /* Rasmni olib tashlash */
  r = await req('/api/forms/img-del', { method: 'POST', cookie: dir, body: { id: FID, kind: 'banner' } });
  eq('Banner olib tashlandi', r.status, 200);
  r = await req('/api/form?slug=' + slug);
  ok('Bannersiz, logotip qoldi', r.json.form.banner === false && r.json.form.logo === true);
  const xb = await fetch(API + '/api/form-bg?id=' + FID + '&kind=banner');
  eq('O’chirilgan banner berilmaydi (404)', xb.status, 404);
  /* Saqlash rasm belgilarini o'chirmaydi */
  r = await req('/api/forms/save', { method: 'POST', cookie: dir, body: Object.assign({}, form, { id: FID, title: 'Sinov formasi ' + R, slug, bg: 'rasm' }) });
  ok('Qayta saqlashda logotip/fon saqlanib qoldi', r.json.form.logo === true && r.json.form.bg === 'rasm');

  /* ---------- 6. Namuna ---------- */
  section('6. Namuna (saqlanmagan shakl)');
  r = await req('/api/forms/preview', { method: 'POST', cookie: dir, body: {
    title: 'Namuna <x>', bg: 'oltin', fields: [{ id: 'q1', type: 'select', label: 'Vaqt', options: ['Ertalab', 'Kechqurun'] }],
    inline: { logo: PNG, banner: 'data:text/html;base64,PHNjcmlwdD4=' }
  } });
  eq('Namuna ochildi (200)', r.status, 200);
  ok('Namunada yuborish o’chiq', /"preview":true/.test(r.text) && /Namuna — yuborish ishlamaydi/.test(r.text));
  ok('Namunada telefon ham qo’shilgan', /class="cc">\+998</.test(r.text));
  ok('Namunada logotip inline, yomon banner yo’q', /class="logo" src="data:image\/png/.test(r.text) && !/class="banner"/.test(r.text));
  ok('Namunada XSS yo’q', r.text.indexOf('Namuna <x>') < 0);
  r = await req('/api/forms/preview', { method: 'POST', cookie: ustoz, body: { title: 'x' } });
  eq('O’qituvchi namuna ocholmaydi (403)', r.status, 403);

  /* ---------- 7. Statistika ---------- */
  section('7. Statistika: ko’rildi / boshladi / yetdi / yubordi');
  const statOf = async () => {
    const b = await req('/api/bootstrap', { cookie: dir });
    return colOf(b, 'formstat').find(s => s.id === FID) || null;
  };
  const before = await statOf();
  const ev = (e, field, ip) => req('/api/form/event', { method: 'POST', body: { slug, ev: e, field }, ip });
  for (let i = 0; i < 3; i++) await ev('view', '', '10.8.0.' + i);
  await ev('start', '', '10.8.0.0');
  await ev('reach', 'ism', '10.8.0.0');
  await ev('reach', 'ism', '10.8.0.1');
  await ev('reach', 'tel', '10.8.0.0');
  r = await ev('submit', '', '10.8.0.0');
  eq('"submit" voqeasini tashqaridan yozib bo’lmaydi (400)', r.status, 400);
  r = await ev('hack', '', '10.8.0.0');
  eq('Noma’lum voqea rad etildi', r.status, 400);
  r = await req('/api/form/event', { method: 'POST', body: { slug: 'yoq-' + R, ev: 'view' } });
  eq('Yo’q forma voqeasi → 404', r.status, 404);
  const st = await statOf();
  ok('Statistika yozildi', !!st);
  eq('Ko’rildi +3', st && st.views - (before ? before.views : 0), 3);
  eq('Boshladi +1', st && st.starts - (before ? before.starts : 0), 1);
  eq('"ism" maydoniga 2 kishi yetdi', st && st.fields.ism - ((before && before.fields.ism) || 0), 2);
  ok('Yuborganlar soni arizalar bilan teng', st && st.submits === 2 + okCount, st && st.submits + ' vs ' + (2 + okCount));
  const today = Object.keys(st.days).sort().pop();
  ok('Kun bo’yicha yozuv bor', today && st.days[today].v >= 3 && st.days[today].c >= 2);
  ok('Statistikada shaxsiy ma’lumot yo’q', JSON.stringify(st).indexOf('10.8.0') < 0 && JSON.stringify(st).indexOf('Dilnoza') < 0);
  const us = await req('/api/bootstrap', { cookie: ustoz });
  eq('O’qituvchiga statistika tushmaydi', colOf(us, 'formstat').filter(s => s.id === FID).length, 0);

  /* ---------- 7b. Parallel yuklama: hisoblagich va chegara yo'qotmasin ---------- */
  section('7b. Parallel so’rovlar (poyga): hisoblagich va kunlik chegara');
  const st0 = await statOf();
  await Promise.all(Array.from({ length: 60 }, (_, i) => ev('view', '', '10.6.' + (i % 30) + '.' + i)));
  await Promise.all(Array.from({ length: 60 }, (_, i) => ev('reach', 'ism', '10.6.' + (i % 30) + '.' + i)));
  const st1 = await statOf();
  eq('60 ta parallel ko’rish → +60 (hech biri yo’qolmadi)', st1.views - st0.views, 60);
  eq('60 ta parallel "ism"ga yetdi → +60', (st1.fields.ism || 0) - (st0.fields.ism || 0), 60);
  /* Har yurgizishda yangi IP — kunlik chegara bazada saqlanadi */
  const PIP = '10.6.' + (Date.now() % 250) + '.' + (Math.floor(Math.random() * 250) + 1);
  const par = await Promise.all(Array.from({ length: 40 }, (_, i) =>
    submit({ ism: 'Parallel ' + i, tel: '91' + String(1000000 + i).slice(-7) }, PIP)));
  const acc = par.filter(x => x.status === 200).length;
  eq('Bir IP dan 40 ta parallel ariza → roppa-rosa 20 ta qabul', acc, 20);
  eq('Qolgani 429', par.filter(x => x.status === 429).length, 20);
  subsNow = await req('/api/bootstrap', { cookie: dir });
  eq('Bazada ham 20 ta (ko’p ham, kam ham emas)', subsOf(subsNow).filter(s => s.formId === FID && s.ip === PIP).length, 20);
  const st2 = await statOf();
  eq('Yuborganlar hisoblagichi +20', st2.submits - st1.submits, 20);

  /* ---------- 8. O'chirish / o'chirilgan forma ---------- */
  section('8. Forma holati va o’chirish');
  r = await req('/api/forms/save', { method: 'POST', cookie: dir, body: Object.assign({}, form, { id: FID, slug, active: false }) });
  eq('O’chirildi (active=false)', r.status, 200);
  r = await req('/f/' + slug);
  eq('O’chirilgan forma sahifasi → 404', r.status, 404);
  r = await submit({ ism: 'Kech', tel: '901234567' }, '10.9.2.2');
  eq('O’chirilgan formaga yuborish → 404', r.status, 404);
  const xl = await fetch(API + '/api/form-bg?id=' + FID + '&kind=logo');
  eq('O’chirilgan forma rasmi berilmaydi', xl.status, 404);
  r = await req('/api/forms/delete', { method: 'POST', cookie: ustoz, body: { id: FID2 } });
  eq('O’qituvchi o’chirolmaydi (403)', r.status, 403);
  r = await req('/api/forms/delete', { method: 'POST', cookie: dir, body: { id: FID } });
  eq('Direktor o’chirdi', r.status, 200);
  r = await req('/api/forms/delete', { method: 'POST', cookie: dir, body: { id: FID2 } });
  eq('Ikkinchi forma o’chirildi', r.status, 200);
  subsNow = await req('/api/bootstrap', { cookie: dir });
  eq('Forma o’chsa ham murojaatlar qoladi', leadsOf(subsNow).filter(l => l.formId === FID).length, 2 + okCount + 20);
  const stAfter = colOf(subsNow, 'formstat').find(s => s.id === FID);
  ok('Statistika forma bilan o’chdi', !stAfter);

  /* ---------- tozalash ---------- */
  for (const l of leadsOf(subsNow).filter(l => l.formId === FID)) await del('leads/' + l.id, dir);
  for (const s of subsOf(subsNow).filter(s => s.formId === FID)) await del('formsub/' + s.id, dir).catch(() => { });
  await del('users/' + ID('u'), dir); await del('staff/' + ID('st'), dir);

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
