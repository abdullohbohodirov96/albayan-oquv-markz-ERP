/* Serverdagi tegishlilik va maxfiylik tekshiruvi.
   Bu sinov "ruxsat nomi bor" bilan cheklanmaydi: yozuv KIMGA tegishli ekanini,
   holat o'zgarishini va rad etilgan so'rovdan keyin bazada nima qolganini tekshiradi.

   Serverni alohida (sun'iy ma'lumotli) bazada ishga tushiring, keyin:
     node tests/perm-test.js [port] [direktor paroli]
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
const del = (path, cookie) => req('/api/doc?path=' + encodeURIComponent(path), { method: 'DELETE', cookie });
const sendMsg = (chatId, text, cookie) =>
  req('/api/chat/send', { method: 'POST', cookie, body: { chatId, text } });
async function login(l, p) {
  const r = await req('/api/login', { method: 'POST', body: { login: l, password: p } });
  return r.status === 200 ? r.cookie : null;
}
/** Bazadagi haqiqiy holat (direktor ko'zi bilan) */
async function dbDoc(path, dirCookie) {
  const r = await get(path, dirCookie);
  return r.json ? r.json.data : null;
}

(async () => {
  const dir = await login('admin', PASS);
  if (!dir) { console.error('Direktor kira olmadi — parolni tekshiring.'); process.exit(1); }

  /* ---------- Sun'iy ma'lumot ---------- */
  section('0. Sinov ma’lumotlari (sun’iy)');
  await put('staff/pstf_a', { id: 'pstf_a', name: 'Ustoz A', status: 'faol', payType: 'fixed', salaryAmount: 3000000 }, dir);
  await put('staff/pstf_b', { id: 'pstf_b', name: 'Ustoz B', status: 'faol', payType: 'fixed', salaryAmount: 3000000 }, dir);
  await put('courses/pcrs', { id: 'pcrs', name: 'Arab tili', monthlyFee: 400000, active: true }, dir);
  await put('groups/pg_a', {
    id: 'pg_a', code: 'P001', name: 'A guruh', courseId: 'pcrs', teacherId: 'pstf_a',
    days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: '2026-09-01',
    fee: 400000, feeHistory: [{ fee: 400000, from: '2026-09' }], limit: 10, status: 'faol'
  }, dir);
  await put('groups/pg_b', {
    id: 'pg_b', code: 'P002', name: 'B guruh', courseId: 'pcrs', teacherId: 'pstf_b',
    days: [2, 4], startTime: '11:00', endTime: '12:30', startDate: '2026-09-01',
    fee: 400000, feeHistory: [{ fee: 400000, from: '2026-09' }], limit: 10, status: 'faol'
  }, dir);
  for (const u of [
    { id: 'usr_pust', login: 'pustoz', name: 'Ustoz A', role: 'oqituvchi', staffId: 'pstf_a', pw: 'Ustoz12345' },
    { id: 'usr_pbux', login: 'pbux', name: 'Buxgalter P', role: 'buxgalter', pw: 'Buxgalter12345' }
  ]) {
    await put('users/' + u.id,
      { id: u.id, login: u.login, name: u.name, role: u.role, staffId: u.staffId || null, active: true },
      dir, { password: u.pw });
  }
  const ustoz = await login('pustoz', 'Ustoz12345');
  const bux = await login('pbux', 'Buxgalter12345');
  ok('O’qituvchi kirdi', !!ustoz);
  ok('Buxgalter kirdi', !!bux);

  /* ================= 1. DAVOMAT TEGISHLILIGI ================= */
  section('1. O’qituvchi faqat o’z guruhi davomatini yozadi');
  const OWN = 'lessons/pg_a__2099-01';
  const FOREIGN = 'lessons/pg_b__2099-01';

  // Boshlang'ich holat: begona guruh davomatini direktor yozadi
  await put(FOREIGN, { id: 'pg_b__2099-01', marks: { '2099-01-05': { s_x: 'keldi' } }, by: 'direktor' }, dir);
  const beforeForeign = JSON.stringify(await dbDoc(FOREIGN, dir));

  const ownWrite = await put(OWN, { id: 'pg_a__2099-01', marks: { '2099-01-05': { s_y: 'keldi' } } }, ustoz);
  eq('O’z guruhiga yoza oldi', ownWrite.status, 200);

  const foreignRead = await get(FOREIGN, ustoz);
  ok('Begona guruh davomati o’qilmadi', foreignRead.status === 403 || !foreignRead.json.data,
    JSON.stringify(foreignRead.json));

  const foreignWrite = await put(FOREIGN, { id: 'pg_b__2099-01', marks: { '2099-01-05': { s_x: 'kelmadi' } }, by: 'ustoz' }, ustoz);
  eq('Begona guruhga yozish rad etildi', foreignWrite.status, 403);
  eq('Baza o’zgarmadi', JSON.stringify(await dbDoc(FOREIGN, dir)), beforeForeign);

  const foreignDel = await del(FOREIGN, ustoz);
  eq('Begona guruh davomatini o’chira olmadi', foreignDel.status, 403);
  ok('Yozuv joyida turibdi', !!(await dbDoc(FOREIGN, dir)));

  const newForeign = await put('lessons/pg_b__2099-02', { id: 'pg_b__2099-02', marks: {} }, ustoz);
  eq('Begona guruhga yangi davomat ham yarata olmadi', newForeign.status, 403);
  ok('Yangi yozuv yaratilmadi', !(await dbDoc('lessons/pg_b__2099-02', dir)));

  /* ================= 2. ISH HAQI TASDIQLASH ================= */
  section('2. Ish haqi: hisoblash va tasdiqlash ajratilgan');
  const PR = 'payroll/2099-01__pstf_a';
  await del(PR, dir);                       // oldingi ishga tushishdan qolmasin

  const draft = await put(PR, {
    id: '2099-01__pstf_a', staffId: 'pstf_a', month: '2099-01',
    type: 'fixed', accrued: 3000000, paid: 0, status: 'qoralama'
  }, bux);
  eq('Buxgalter qoralama yoza oldi', draft.status, 200);

  const approveByBux = await put(PR, {
    id: '2099-01__pstf_a', staffId: 'pstf_a', month: '2099-01',
    type: 'fixed', accrued: 3000000, paid: 0, status: 'tasdiqlangan'
  }, bux);
  eq('Buxgalter tasdiqlay olmadi', approveByBux.status, 403);
  eq('Bazada holat o’zgarmadi', (await dbDoc(PR, dir) || {}).status, 'qoralama');

  const approveByDir = await put(PR, {
    id: '2099-01__pstf_a', staffId: 'pstf_a', month: '2099-01',
    type: 'fixed', accrued: 3000000, paid: 0, status: 'tasdiqlangan'
  }, dir);
  eq('Direktor tasdiqladi', approveByDir.status, 200);
  eq('Bazada tasdiqlangan', (await dbDoc(PR, dir) || {}).status, 'tasdiqlangan');

  const backToDraft = await put(PR, {
    id: '2099-01__pstf_a', staffId: 'pstf_a', month: '2099-01',
    type: 'fixed', accrued: 3000000, paid: 0, status: 'qoralama'
  }, bux);
  eq('Qoralamaga qaytara olmadi', backToDraft.status, 403);
  eq('Holat hali ham tasdiqlangan', (await dbDoc(PR, dir) || {}).status, 'tasdiqlangan');

  const changeAmount = await put(PR, {
    id: '2099-01__pstf_a', staffId: 'pstf_a', month: '2099-01',
    type: 'fixed', accrued: 9999999, paid: 0, status: 'tasdiqlangan'
  }, bux);
  eq('Tasdiqlangan summani o’zgartira olmadi', changeAmount.status, 403);
  eq('Summa o’zgarmadi', (await dbDoc(PR, dir) || {}).accrued, 3000000);

  const delByBux = await del(PR, bux);
  eq('Tasdiqlanganni o’chira olmadi', delByBux.status, 403);
  ok('Yozuv joyida', !!(await dbDoc(PR, dir)));

  const payIt = await put(PR, {
    id: '2099-01__pstf_a', staffId: 'pstf_a', month: '2099-01',
    type: 'fixed', accrued: 3000000, paid: 3000000, status: 'to’langan'
  }, dir);
  eq('Direktor to’langan deb belgiladi', payIt.status, 200);
  const touchPaid = await put(PR, {
    id: '2099-01__pstf_a', staffId: 'pstf_a', month: '2099-01',
    type: 'fixed', accrued: 1, paid: 1, status: 'to’langan'
  }, bux);
  eq('To’langanga tegib bo’lmadi', touchPaid.status, 403);
  eq('To’langan summa o’zgarmadi', (await dbDoc(PR, dir) || {}).paid, 3000000);

  section('   Qoralama bilan ishlash hamon mumkin');
  const PR2 = 'payroll/2099-02__pstf_a';
  await del(PR2, dir);
  const d2 = await put(PR2, {
    id: '2099-02__pstf_a', staffId: 'pstf_a', month: '2099-02',
    type: 'fixed', accrued: 100, paid: 0, status: 'qoralama'
  }, bux);
  eq('Yangi qoralama yozildi', d2.status, 200);
  const d3 = await put(PR2, {
    id: '2099-02__pstf_a', staffId: 'pstf_a', month: '2099-02',
    type: 'fixed', accrued: 200, paid: 0, status: 'qoralama'
  }, bux);
  eq('Qoralama qayta hisoblandi', d3.status, 200);
  eq('Yangi summa saqlandi', (await dbDoc(PR2, dir) || {}).accrued, 200);
  const d4 = await del(PR2, bux);
  eq('Qoralamani o’chira oldi', d4.status, 200);

  /* ================= 3. SHAXSIY SUHBAT ================= */
  section('3. Shaxsiy suhbatni faqat ishtirokchilar ko’radi');
  const CH = 'chats/pchat_dir_bux';
  await put(CH, {
    id: 'pchat_dir_bux', type: 'direct', members: ['usr_admin', 'usr_pbux'],
    messages: [], readAt: {}, updatedAt: '2026-09-19 10:00'
  }, dir);
  await sendMsg('pchat_dir_bux', 'Maxfiy gap', dir);   // xabar faqat shu amal orqali

  const chatByBux = await get(CH, bux);
  ok('Ishtirokchi o’qiy oladi', chatByBux.status === 200 && !!chatByBux.json.data, chatByBux.text.slice(0, 120));

  const chatByUstoz = await get(CH, ustoz);
  ok('Begona o’qiy olmadi (doc)', chatByUstoz.status === 403 || !chatByUstoz.json.data,
    chatByUstoz.status + ' ' + chatByUstoz.text.slice(0, 120));
  ok('Xabar matni javobga tushmadi', !/Maxfiy gap/.test(chatByUstoz.text), chatByUstoz.text.slice(0, 160));

  const chatsCol = await req('/api/collection?name=chats', { cookie: ustoz });
  ok('Ro’yxatda ham ko’rinmadi', !(chatsCol.json.items || {}).pchat_dir_bux);
  ok('Ro’yxatda xabar matni yo’q', !/Maxfiy gap/.test(chatsCol.text));

  const boot = await req('/api/bootstrap', { cookie: ustoz });
  ok('Bootstrap’da ham yo’q', !((boot.json.col.chats || {}).pchat_dir_bux));

  section('   O’zini begona suhbatga qo’sha olmaydi');
  const joinTry = await put(CH, {
    id: 'pchat_dir_bux', type: 'direct', members: ['usr_admin', 'usr_pbux', 'usr_pust'],
    messages: [{ id: 'm1', from: 'usr_admin', text: 'Maxfiy gap', at: '2026-09-19 10:00' }],
    readAt: {}, updatedAt: '2026-09-19 11:00'
  }, ustoz);
  eq('Qo’shilish rad etildi', joinTry.status, 403);
  const afterJoin = await dbDoc(CH, dir);
  eq('A’zolar ro’yxati o’zgarmadi', (afterJoin.members || []).join(','), 'usr_admin,usr_pbux');

  const wipeTry = await put(CH, {
    id: 'pchat_dir_bux', type: 'direct', members: ['usr_admin', 'usr_pbux'],
    messages: [], readAt: {}, updatedAt: '2026-09-19 12:00'
  }, ustoz);
  eq('Begona xabarlarni o’chira olmadi', wipeTry.status, 403);
  const wipeBySelf = await sendMsg('pchat_dir_bux', 'Men kirdim', ustoz);
  eq('Begona xabar yubora olmadi', wipeBySelf.status, 403);
  eq('Xabar joyida', ((await dbDoc(CH, dir)).messages || []).length, 1);
  const chatDel = await del(CH, ustoz);
  eq('Begona suhbatni o’chira olmadi', chatDel.status, 403);

  section('   Xabar muallifi serverdan olinadi');
  const MY = 'chats/pchat_dir_ust';
  await del(MY, dir);
  const mk = await put(MY, {
    id: 'pchat_dir_ust', type: 'direct', members: ['usr_admin', 'usr_pust'],
    messages: [], readAt: {}, updatedAt: '2026-09-19 10:00'
  }, ustoz);
  eq('O’z suhbatini yarata oldi', mk.status, 200);
  // muallifni soxtalashtirishga urinib ko'ramiz — server o'zi qo'yadi
  const sent = await req('/api/chat/send', {
    method: 'POST', cookie: ustoz,
    body: { chatId: 'pchat_dir_ust', text: 'Ustozdan salom', from: 'usr_admin', at: '2000-01-01 00:00' }
  });
  eq('Xabar yuborildi', sent.status, 200);
  const mine = await dbDoc(MY, dir);
  eq('Muallif almashtirildi', (mine.messages[0] || {}).from, 'usr_pust');
  eq('Matn saqlandi', (mine.messages[0] || {}).text, 'Ustozdan salom');
  ok('Vaqt ham serverdan', (mine.messages[0] || {}).at !== '2000-01-01 00:00',
    String((mine.messages[0] || {}).at));

  /* ================= 4. VAZIFALAR ================= */
  section('4. Begona vazifa ID orqali ochilmaydi');
  const TSK = 'tasks/ptask1';
  await put(TSK, {
    id: 'ptask1', title: 'Maxfiy vazifa', assigneeId: 'usr_pbux', createdById: 'usr_admin',
    status: 'yangi', due: '2099-01-10'
  }, dir);
  const taskByUstoz = await get(TSK, ustoz);
  ok('Begona vazifa berilmadi', taskByUstoz.status === 403 || !taskByUstoz.json.data,
    taskByUstoz.status + ' ' + taskByUstoz.text.slice(0, 120));
  ok('Sarlavha javobga tushmadi', !/Maxfiy vazifa/.test(taskByUstoz.text));

  const taskGrab = await put(TSK, {
    id: 'ptask1', title: 'Maxfiy vazifa', assigneeId: 'usr_pust', createdById: 'usr_admin',
    status: 'bajarildi', due: '2099-01-10'
  }, ustoz);
  eq('Begona vazifani o’zgartira olmadi', taskGrab.status, 403);
  const taskNow = await dbDoc(TSK, dir);
  eq('Ijrochi o’zgarmadi', taskNow.assigneeId, 'usr_pbux');
  eq('Holat o’zgarmadi', taskNow.status, 'yangi');

  const taskByBux = await put(TSK, {
    id: 'ptask1', title: 'Maxfiy vazifa', assigneeId: 'usr_pbux', createdById: 'usr_admin',
    status: 'bajarildi', due: '2099-01-10'
  }, bux);
  eq('Ijrochi o’z vazifasini yangiladi', taskByBux.status, 200);
  eq('Yangi holat saqlandi', (await dbDoc(TSK, dir)).status, 'bajarildi');

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
