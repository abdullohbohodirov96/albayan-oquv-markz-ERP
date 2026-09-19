/* Suhbat: maxfiylik va xabar yuborish.
   Serverni alohida (sun'iy ma'lumotli) bazada ishga tushiring, keyin:
     node tests/chat-test.js [port] [direktor paroli]
   Noto'g'ri natijada YIQILADI (exit code 1).                                */
'use strict';
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got));
}
function section(t) { out.push('\n' + t); }

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.cookie ? { Cookie: opts.cookie } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (path, data, cookie, extra) => req('/api/doc?path=' + encodeURIComponent(path),
  { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });
const get = (path, cookie) => req('/api/doc?path=' + encodeURIComponent(path), { cookie });
const send = (chatId, text, cookie, msgId) =>
  req('/api/chat/send', { method: 'POST', cookie, body: { chatId, text, msgId } });
async function login(l, p) {
  const r = await req('/api/login', { method: 'POST', body: { login: l, password: p } });
  return r.status === 200 ? r.cookie : null;
}
async function doc(path, dir) { const r = await get(path, dir); return r.json ? r.json.data : null; }

const R = 'r' + Date.now().toString(36);      // har bir ishga tushirish uchun alohida ID

(async () => {
  const dir = await login('admin', PASS);
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  section('0. Sinov foydalanuvchilari (sun’iy)');
  const users = [
    { id: 'usr_cbux', login: 'cbux', name: 'Buxgalter C', role: 'buxgalter', pw: 'Buxgalter12345' },
    { id: 'usr_cust', login: 'cust', name: 'Ustoz C', role: 'oqituvchi', pw: 'Ustoz12345' },
    { id: 'usr_cadm', login: 'cadm', name: 'Administrator C', role: 'admin', pw: 'Admin123456' }
  ];
  for (const u of users) {
    await put('users/' + u.id, { id: u.id, login: u.login, name: u.name, role: u.role, active: true },
      dir, { password: u.pw });
  }
  const bux = await login('cbux', 'Buxgalter12345');
  const ust = await login('cust', 'Ustoz12345');
  const adm = await login('cadm', 'Admin123456');
  ok('Uchalasi ham kirdi', !!bux && !!ust && !!adm);

  /* ============ 1. type ni o'zgartirib maxfiylikni buzish ============ */
  section('1. Shaxsiy suhbatni "umumiy" qilib bo’lmaydi');
  const CH = ('chats/' + R + '_cchat_dir_bux');
  await put(CH, {
    id: R + '_cchat_dir_bux', type: 'direct', members: ['usr_admin', 'usr_cbux'],
    messages: [], readAt: {}, updatedAt: '2026-09-19 10:00'
  }, dir);
  await send((R + '_cchat_dir_bux'), 'Juda maxfiy gap', dir);

  const before = await get(CH, ust);
  ok('Boshida begona o’qiy olmaydi', before.status === 403 || !before.json.data, String(before.status));

  // ishtirokchi (buxgalter) uni "group" qilib saqlashga urinadi
  const escalate = await put(CH, {
    id: R + '_cchat_dir_bux', type: 'group', title: 'Umumiy',
    members: ['usr_admin', 'usr_cbux'], messages: [], readAt: {}, updatedAt: '2026-09-19 11:00'
  }, bux);
  const now = await doc(CH, dir);
  eq('Bazada type o’zgarmadi', (now || {}).type, 'direct');
  eq('A’zolar o’zgarmadi', ((now || {}).members || []).join(','), 'usr_admin,usr_cbux');
  eq('Xabar joyida', ((now || {}).messages || []).length, 1);
  out.push('    (PUT javobi: ' + escalate.status + ' — maydonlar saqlanib qoldi)');

  const afterDoc = await get(CH, ust);
  ok('doc: begona baribir o’qiy olmadi', afterDoc.status === 403 || !afterDoc.json.data, afterDoc.text.slice(0, 90));
  const afterCol = await req('/api/collection?name=chats', { cookie: ust });
  ok('collection: ko’rinmadi', !(afterCol.json.items || {})[R + '_cchat_dir_bux']);
  const afterBoot = await req('/api/bootstrap', { cookie: ust });
  ok('bootstrap: ko’rinmadi', !((afterBoot.json.col.chats || {})[R + '_cchat_dir_bux']));
  ok('Matn uchala javobda ham yo’q',
    !/Juda maxfiy gap/.test(afterDoc.text + afterCol.text + afterBoot.text));

  section('   Faqat "type" ni o’zgartirish ham ish bermaydi');
  const asIs = await doc(CH, bux);                 // xabarlar aynan o'sha, faqat type boshqa
  const onlyType = await put(CH, Object.assign({}, asIs, { type: 'group' }), bux);
  const afterOnlyType = await doc(CH, bux);
  eq('Javob 200 bo’lsa ham type o’zgarmadi', (afterOnlyType || {}).type, 'direct');
  out.push('    (javob: ' + onlyType.status + ')');
  const stillHidden = await get(CH, ust);
  ok('Begona hamon ko’ra olmaydi', stillHidden.status === 403 || !stillHidden.json.data, String(stillHidden.status));

  section('   Yangi suhbatni ham "umumiy" qilib yaratib bo’lmaydi');
  const FAKE = ('chats/' + R + '_cchat_fake_group');
  await put(FAKE, {
    id: (R + '_cchat_fake_group'), type: 'group', title: 'Soxta umumiy',
    members: ['usr_cbux'], messages: [], readAt: {}, updatedAt: '2026-09-19 11:00'
  }, bux);
  const fake = await doc(FAKE, bux);
  eq('Yangi suhbat "direct" bo’lib qoldi', fake ? fake.type : null, 'direct');
  const fakeRead = await get(FAKE, ust);
  ok('Begona uni ko’ra olmadi', fakeRead.status === 403 || !fakeRead.json.data, String(fakeRead.status));

  section('   Haqiqiy umumiy suhbat ishlayveradi');
  await put('chats/chat_umumiy', {
    id: 'chat_umumiy', type: 'group', title: 'Umumiy suhbat',
    members: [], messages: [], readAt: {}, updatedAt: '2026-09-19 10:00'
  }, dir);
  const gsend = await send('chat_umumiy', 'Hammaga salom', ust);
  eq('O’qituvchi umumiyga yoza oldi', gsend.status, 200);
  const gread = await get('chats/chat_umumiy', bux);
  ok('Buxgalter umumiyni o’qidi', gread.status === 200 && !!gread.json.data);

  /* ============ 2. 200 tadan keyin ham xabar ketadi ============ */
  section('2. 199-, 200-, 201-, 202-xabarlar saqlanadi');
  const LONG = ('chats/' + R + '_cchat_long');
  await put(LONG, {
    id: (R + '_cchat_long'), type: 'direct', members: ['usr_admin', 'usr_cbux'],
    messages: [], readAt: {}, updatedAt: '2026-09-19 10:00'
  }, dir);
  let lastCount = 0;
  for (let i = 1; i <= 198; i++) {
    const r = await send((R + '_cchat_long'), 'Xabar ' + i, i % 2 ? dir : bux);
    if (r.status !== 200) { ok('Xabar ' + i + ' ketdi', false, r.text); break; }
    lastCount = r.json.count;
  }
  eq('198 ta xabar saqlandi', lastCount, 198);
  for (const n of [199, 200, 201, 202]) {
    const r = await send((R + '_cchat_long'), 'Xabar ' + n, n % 2 ? dir : bux);
    eq(n + '-xabar yuborildi', r.status, 200);
    eq(n + '-xabar ro’yxatda', (r.json && r.json.count) || 0, n);
  }
  const longDoc = await doc(LONG, dir);
  eq('Bazada ham 202 ta', ((longDoc || {}).messages || []).length, 202);
  const texts = ((longDoc || {}).messages || []).map(m => m.text);
  ok('201-xabar matni bazada', texts.indexOf('Xabar 201') >= 0);
  ok('202-xabar matni bazada', texts.indexOf('Xabar 202') >= 0);
  ok('Birinchi xabar ham joyida', texts.indexOf('Xabar 1') >= 0);

  /* ============ 3. Parallel yozish ============ */
  section('3. Ikki kishi bir vaqtda yozsa — ikkalasi ham saqlanadi');
  const PAR = ('chats/' + R + '_cchat_par');
  await put(PAR, {
    id: (R + '_cchat_par'), type: 'direct', members: ['usr_admin', 'usr_cbux'],
    messages: [], readAt: {}, updatedAt: '2026-09-19 10:00'
  }, dir);
  const batch = [];
  for (let i = 0; i < 10; i++) {
    batch.push(send((R + '_cchat_par'), 'Direktor ' + i, dir));
    batch.push(send((R + '_cchat_par'), 'Buxgalter ' + i, bux));
  }
  const results = await Promise.all(batch);
  eq('Hamma so’rov 200 qaytardi', results.filter(r => r.status === 200).length, 20);
  const parDoc = await doc(PAR, dir);
  eq('Yigirmatasi ham bazada', ((parDoc || {}).messages || []).length, 20);
  const ids = new Set(((parDoc || {}).messages || []).map(m => m.id));
  eq('ID lar takrorlanmadi', ids.size, 20);

  /* ============ 4. Takroriy so'rov ============ */
  section('4. Bir so’rov ikki marta ketsa — bitta xabar');
  const one = 'takror_' + Date.now().toString(36);
  const r1 = await send((R + '_cchat_par'), 'Bir marta', dir, one);
  const r2 = await send((R + '_cchat_par'), 'Bir marta', dir, one);
  eq('Ikkalasi ham 200', r1.status + r2.status, 400);
  ok('Ikkinchisi takror deb belgilandi', !!(r2.json && r2.json.duplicate === true), JSON.stringify(r2.json));
  const parDoc2 = await doc(PAR, dir);
  eq('Faqat bitta qo’shildi', ((parDoc2 || {}).messages || []).filter(m => m.text === 'Bir marta').length, 1);

  /* ============ 5. Begona yozolmaydi, muallif serverdan ============ */
  section('5. Begona yoza olmaydi; muallif serverdan olinadi');
  const outsider = await send((R + '_cchat_par'), 'Men kirdim', ust);
  eq('Begona yoza olmadi', outsider.status, 403);
  const parDoc3 = await doc(PAR, dir);
  ok('Uning xabari bazada yo’q', !((parDoc3 || {}).messages || []).some(m => m.text === 'Men kirdim'));

  const mine = await send((R + '_cchat_par'), 'Muallif sinovi', bux);
  const mineMsg = (mine.json && mine.json.message) || {};
  eq('Muallif serverdan', mineMsg.from, 'usr_cbux');
  ok('Vaqt serverdan', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(mineMsg.at), String(mineMsg.at));

  section('   Eski yo’l bilan xabar tahrirlab bo’lmaydi');
  const tamper = await put(PAR, Object.assign({}, parDoc3 || {}, {
    messages: [{ id: 'x', from: 'usr_admin', text: 'Soxta', at: '2026-09-19 10:00' }]
  }), bux);
  eq('PUT bilan almashtirish rad etildi', tamper.status, 400);
  const parDoc4 = await doc(PAR, dir);
  ok('Xabarlar joyida', ((parDoc4 || {}).messages || []).length >= 21, String(((parDoc4 || {}).messages || []).length));
  ok('Soxta xabar qo’shilmadi', !((parDoc4 || {}).messages || []).some(m => m.text === 'Soxta'));

  /* ============ 6. "O'qildi" belgisi ============ */
  section('6. O’qilganini belgilash boshqaning xabarini yo’qotmaydi');
  const beforeRead = ((await doc(PAR, dir)) || {}).messages ? (await doc(PAR, dir)).messages.length : 0;
  const rd = await req('/api/chat/read', { method: 'POST', cookie: bux, body: { chatId: (R + '_cchat_par') } });
  eq('Belgilash ishladi', rd.status, 200);
  const afterRead = await doc(PAR, dir);
  eq('Xabarlar soni o’zgarmadi', ((afterRead || {}).messages || []).length, beforeRead);
  ok('O’z belgisi yangilandi', !!((afterRead || {}).readAt || {}).usr_cbux, JSON.stringify((afterRead || {}).readAt));

  // o'zganing belgisini o'zgartirishga urinish
  const fakeRead2 = await put(PAR, Object.assign({}, afterRead || {}, {
    readAt: Object.assign({}, (afterRead || {}).readAt || {}, { usr_admin: '2099-01-01 00:00' })
  }), bux);
  const afterFake = await doc(PAR, dir);
  ok('Boshqaning belgisi o’zgarmadi',
    (afterFake.readAt || {}).usr_admin !== '2099-01-01 00:00',
    JSON.stringify(afterFake.readAt) + ' / javob ' + fakeRead2.status);

  /* ============ 7. Sahifa yangilangach ko'rinadi ============ */
  section('7. Yuborilgan xabar qayta yuklaganda ham turibdi');
  const boot = await req('/api/bootstrap', { cookie: bux });
  const chatInBoot = (boot.json.col.chats || {})[R + '_cchat_par'];
  ok('Bootstrap’da suhbat bor', !!chatInBoot);
  ok('Yuborilgan xabar bootstrap’da', ((chatInBoot || {}).messages || []).some(m => m.text === 'Muallif sinovi'));

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
