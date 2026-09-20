/* Telegram hisobini bog'lash xavfsizligi.
   Tekshiriladi:
     1) 4 xonali kod bilan begona odam mavjud bog'lanishni EGALLAY OLMAYDI;
     2) guruh/supergroup/kanalda shaxsiy ma'lumot UMUMAN berilmaydi;
     3) bog'lash faqat bir martalik, muddatli va xeshlangan token bilan bo'ladi;
     4) bog'lanish bekor qilinsa, eski suhbat darhol ma'lumot ololmaydi.

   HAQIQIY TELEGRAM ISHLATILMAYDI — xabarlar soxta qabul qiluvchiga boradi,
   baza vaqtinchalik papkada, ma'lumotlar sun'iy.
   Ishga tushirish:  node tests/link-test.js                                  */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-link-'));
process.env.DATA_DIR = tmp;
process.env.BACKUP_DIR = path.join(tmp, 'backups');
delete process.env.TELEGRAM_BOT_TOKEN;

const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');

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
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }

const OWNER = 5001;        // o'quvchining o'z Telegram suhbati
const STRANGER = 6002;     // begona odam
const GROUP = -100777;     // Telegram guruhi

(async () => {
  const store = createStore();
  const sent = [];
  const B = bot._test({
    store, stamp, A,
    send: async (chatId, text) => { sent.push({ chatId: String(chatId), text: String(text) }); return { ok: true }; }
  });
  const lastTo = (id) => {
    const l = sent.filter(m => m.chatId === String(id));
    return l.length ? l[l.length - 1].text : '';
  };
  const allTo = (id) => sent.filter(m => m.chatId === String(id)).map(m => m.text).join('\n');

  /* ---------- Sun'iy ma'lumot ---------- */
  section('0. Sinov ma’lumotlari (sun’iy)');
  await store.set('meta/settings', {
    centerName: 'AlBayan Cairo', dueDay: 5,
    bot: { welcome: 'Xush kelibsiz!', notify: { davomat: true, tolov: true, qarz: true, elon: true, ulash: true } }
  });
  await store.set('staff/t1', { id: 't1', name: 'Ustoz Sinov', status: 'faol' });
  await store.set('courses/c1', { id: 'c1', name: 'Arab tili', monthlyFee: 300000, active: true });
  await store.set('groups/g1', {
    id: 'g1', code: '5150', name: 'Sinov guruhi', courseId: 'c1', teacherId: 't1',
    days: [1, 3], startTime: '09:00', endTime: '10:30', startDate: '2026-09-01',
    fee: 300000, feeHistory: [{ fee: 300000, from: '2026-09' }], limit: 10, status: 'faol'
  });
  await store.set('students/s1', {
    id: 's1', firstName: 'Abdulloh', lastName: 'Bahodirov', code: '4077',
    phone: '+998901112233', parentPhone: '+998901112244', status: 'faol',
    telegram: { id: String(OWNER), name: 'Abdulloh', linkedAt: stamp(), via: 'token' }
  });
  await store.set('memberships/m1', { id: 'm1', studentId: 's1', groupId: 'g1', joinedAt: '2026-09-01', status: 'faol' });
  await store.set('invoices/inv1', {
    id: 'inv1', studentId: 's1', groupId: 'g1', month: '2026-09',
    amount: 300000, discount: 0, final: 300000, status: 'ochiq', createdAt: stamp()
  });
  await store.set('botstate/' + OWNER, { chatId: String(OWNER), step: 'linked', studentId: 's1' });
  ok('O’quvchi o’z suhbatiga bog’langan', (await store.get('students/s1')).telegram.id === String(OWNER));

  /* ================= 1. Kod bilan egallash ================= */
  section('1. Begona odam 4 xonali kod bilan hisobni egallay olmaydi');
  await B.onMessage({ chat: { id: STRANGER, type: 'private' }, from: { id: STRANGER, first_name: 'Begona' }, text: '/start' });
  await B.onMessage({ chat: { id: STRANGER, type: 'private' }, from: { id: STRANGER, first_name: 'Begona' }, text: '4077' });

  const afterTry = await store.get('students/s1');
  eq('Bog’lanish o’zgarmadi', String(afterTry.telegram && afterTry.telegram.id), String(OWNER));
  const strangerText = allTo(STRANGER);
  ok('Begonaga ism berilmadi', !/Bahodirov|Abdulloh/.test(strangerText), strangerText.slice(0, 160));
  ok('Begonaga qarz/to’lov berilmadi', !/300 000|qarz/i.test(strangerText), strangerText.slice(0, 160));
  ok('Begonaga nima qilish kerakligi tushuntirildi',
    /havola|administrator|token/i.test(strangerText), strangerText.slice(0, 160));

  const stState = await store.get('botstate/' + STRANGER);
  ok('Begona "ulangan" holatga o’tmadi', !stState || stState.step !== 'linked' || stState.studentId !== 's1',
    JSON.stringify(stState));

  section('   Egasining o’zi hali ham ko’ra oladi');
  await B.onMessage({ chat: { id: OWNER, type: 'private' }, from: { id: OWNER }, text: 'Ma’lumotim' });
  ok('Egasiga ma’lumot berildi', /Bahodirov|Abdulloh/.test(lastTo(OWNER)), lastTo(OWNER).slice(0, 120));

  /* ================= 2. Guruhda shaxsiy ma'lumot ================= */
  section('2. Guruh chatida shaxsiy ma’lumot chiqmaydi');
  const beforeGroup = sent.length;
  await B.onMessage({ chat: { id: GROUP, type: 'group', title: 'Sinov guruhi' }, from: { id: 9001 }, text: '4077' });
  await B.onMessage({ chat: { id: GROUP, type: 'supergroup', title: 'Sinov guruhi' }, from: { id: 9001 }, text: 'Ma’lumotim' });
  await B.onMessage({ chat: { id: GROUP, type: 'group', title: 'Sinov guruhi' }, from: { id: 9001 }, text: 'To’lovim' });
  const groupText = sent.slice(beforeGroup).map(m => m.text).join('\n');
  ok('Guruhga ism chiqmadi', !/Bahodirov|Abdulloh/.test(groupText), groupText.slice(0, 200));
  ok('Guruhga qarz chiqmadi', !/300 000|qarz/i.test(groupText), groupText.slice(0, 200));
  const gState = await store.get('botstate/' + GROUP);
  ok('Guruh o’quvchiga bog’lanmadi', !gState || gState.studentId !== 's1', JSON.stringify(gState));
  const afterGroup = await store.get('students/s1');
  eq('Guruh bog’lanishni o’zgartirmadi', String(afterGroup.telegram && afterGroup.telegram.id), String(OWNER));

  /* ================= 3. Bir martalik token ================= */
  section('3. Bog’lash faqat bir martalik, muddatli token bilan');
  let link = null;
  try { link = require('../server/link'); } catch (e) { link = null; }
  ok('server/link.js moduli bor', !!link, String(e_(link)));
  function e_(x) { return x ? '' : 'topilmadi'; }
  if (!link) {
    out.push('  ! token sinovlari o’tkazilmadi — modul yo’q');
  } else {
  await store.set('students/s2', { id: 's2', firstName: 'Zuhra', lastName: 'Karimova', code: '4088', status: 'faol' });

  const made = await link.create(store, { studentId: 's2', byUserId: 'usr_admin', stamp });
  ok('Token yaratildi', !!(made && made.token && made.token.length >= 20), JSON.stringify(made && { l: (made.token || '').length }));
  const stored = await store.get('linktokens/' + made.id);
  ok('Bazada ochiq token saqlanmadi',
    !!stored && JSON.stringify(stored).indexOf(made.token.split('.')[1] || made.token) < 0,
    JSON.stringify(stored));

  const NEWCHAT = 7003;
  await B.onMessage({ chat: { id: NEWCHAT, type: 'private' }, from: { id: NEWCHAT, first_name: 'Zuhra' }, text: '/start ' + made.token });
  const s2 = await store.get('students/s2');
  eq('Token bilan bog’landi', String(s2.telegram && s2.telegram.id), String(NEWCHAT));
  ok('Ulangan odamga ma’lumot berildi', /Karimova|Zuhra/.test(lastTo(NEWCHAT)), lastTo(NEWCHAT).slice(0, 120));

  section('   Bir marta ishlatilgan token qayta ishlamaydi');
  const OTHER = 7004;
  await B.onMessage({ chat: { id: OTHER, type: 'private' }, from: { id: OTHER }, text: '/start ' + made.token });
  const s2b = await store.get('students/s2');
  eq('Ikkinchi odam bog’lanmadi', String(s2b.telegram && s2b.telegram.id), String(NEWCHAT));
  ok('Ikkinchi odamga ma’lumot berilmadi', !/Karimova|Zuhra/.test(allTo(OTHER)), allTo(OTHER).slice(0, 160));

  section('   Muddati o’tgan token ishlamaydi');
  const old = await link.create(store, { studentId: 's2', byUserId: 'usr_admin', stamp });
  const oldRec = await store.get('linktokens/' + old.id);
  oldRec.expiresAt = Date.now() - 60000;
  await store.set('linktokens/' + old.id, oldRec);
  const EXP = 7005;
  await B.onMessage({ chat: { id: EXP, type: 'private' }, from: { id: EXP }, text: '/start ' + old.token });
  ok('Muddati o’tgan token rad etildi', !/Karimova/.test(allTo(EXP)), allTo(EXP).slice(0, 160));

  section('   Bir vaqtda ikki marta ishlatib bo’lmaydi');
  await store.set('students/s3', { id: 's3', firstName: 'Olim', lastName: 'Sobirov', code: '4099', status: 'faol' });
  const race = await link.create(store, { studentId: 's3', byUserId: 'usr_admin', stamp });
  const A1 = 7101, A2 = 7102;
  await Promise.all([
    B.onMessage({ chat: { id: A1, type: 'private' }, from: { id: A1 }, text: '/start ' + race.token }),
    B.onMessage({ chat: { id: A2, type: 'private' }, from: { id: A2 }, text: '/start ' + race.token })
  ]);
  const s3 = await store.get('students/s3');
  const winner = String(s3.telegram && s3.telegram.id || '');
  ok('Faqat bittasi bog’landi', winner === String(A1) || winner === String(A2), winner);
  const loser = winner === String(A1) ? A2 : A1;
  ok('Ikkinchisiga ma’lumot berilmadi', !/Sobirov|Olim/.test(allTo(loser)), allTo(loser).slice(0, 160));

  }

  /* ================= 4. Bog'lanishni bekor qilish ================= */
  section('4. Bog’lanish bekor qilinsa, eski suhbat ma’lumot ololmaydi');
  if (link) await link.revoke(store, { studentId: 's1', stamp });
  else { const st1 = await store.get('students/s1'); delete st1.telegram; await store.set('students/s1', st1); }
  const s1r = await store.get('students/s1');
  ok('Bog’lanish o’chirildi', !(s1r.telegram && s1r.telegram.id), JSON.stringify(s1r.telegram));
  const beforeRevoke = sent.length;
  await B.onMessage({ chat: { id: OWNER, type: 'private' }, from: { id: OWNER }, text: 'Ma’lumotim' });
  const afterText = sent.slice(beforeRevoke).map(m => m.text).join('\n');
  ok('Eski suhbatga ma’lumot berilmadi', !/Bahodirov/.test(afterText), afterText.slice(0, 160));

  section('   Eski kod bilan qayta ulanib bo’lmaydi');
  await B.onMessage({ chat: { id: OWNER, type: 'private' }, from: { id: OWNER }, text: '4077' });
  const s1r2 = await store.get('students/s1');
  ok('Kod bilan qayta bog’lanmadi', !(s1r2.telegram && s1r2.telegram.id), JSON.stringify(s1r2.telegram));

  /* ================= 5. Xavfsiz yuborish ================= */
  section('5. Shaxsiy xabar guruh suhbatiga yuborilmaydi');
  await store.set('students/s4', {
    id: 's4', firstName: 'Eski', lastName: 'Bog’lanish', code: '4055', status: 'faol',
    telegram: { id: '-100999', name: 'guruh', linkedAt: stamp(), via: 'eski' }
  });
  const guard = require('../server/link');
  const before5 = sent.length;
  await B.onMessage({ chat: { id: -100999, type: 'group', title: 'Eski guruh' }, from: { id: 9 }, text: 'Ma’lumotim' });
  const txt5 = sent.slice(before5).map(m => m.text).join('\n');
  ok('Guruhga shaxsiy ma’lumot ketmadi', !/Eski|4055/.test(txt5), txt5.slice(0, 160));
  const gAttach = await guard.attach(store, { studentId: 's4', chatId: '-100999', stamp, force: true });
  ok('link.attach guruh suhbatini qabul qilmaydi', !gAttach.ok && gAttach.reason === 'guruh', JSON.stringify(gAttach));
  const qRes = await B.enqueue({ studentId: 's4', chatId: '-100999', text: 'Qarzingiz bor', kind: 'qarz' });
  ok('Guruhga shaxsiy xabar navbatga qo’yilmadi', qRes && qRes.skipped === 'guruh', JSON.stringify(qRes));

  section('   Ism ichidagi HTML belgilar xavfsiz chiqadi');
  const kab = require('../server/kabinet');
  const html = kab.summaryText({
    student: { name: '<b>Xato</b> & "ism"', code: '4055' },
    groups: [], finance: { debt: 0, advance: 0, paid: 0 }, attendance: { total: 0, came: 0, missed: 0, percent: 0, last: [] },
    center: { name: 'Markaz', phone: '' }
  });
  ok('Ismdagi teg qochirildi', html.indexOf('&lt;b&gt;Xato&lt;/b&gt;') >= 0, html.slice(0, 120));

  if (store.close) await store.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: haqiqiy Telegram ishlatilmadi, baza vaqtinchalik va ma’lumot sun’iy.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
