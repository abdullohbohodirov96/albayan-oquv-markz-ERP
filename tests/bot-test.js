/* Telegram bot mantiqi sinovi.
   HAQIQIY TELEGRAMGA ULANMAYDI: xabarlar soxta qabul qiluvchiga boradi,
   baza esa vaqtinchalik papkada. Hech kimga haqiqiy xabar yuborilmaydi.
   Ishga tushirish:  node tests/bot-test.js                                  */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'albyana-bot-'));
process.env.DATA_DIR = path.join(tmp, 'data');
delete process.env.TELEGRAM_BOT_TOKEN;              // haqiqiy token ishlatilmasin

const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }

/* Soxta Telegram: hamma xabar shu yerga tushadi */
const sent = [];
let failNext = 0;
async function fakeSend(chatId, text) {
  if (failNext > 0) { failNext--; throw new Error('Telegram javob bermadi'); }
  sent.push({ chatId: String(chatId), text: String(text) });
  return { message_id: sent.length };
}
function lastTo(chatId) {
  const list = sent.filter(m => m.chatId === String(chatId));
  return list.length ? list[list.length - 1].text : '';
}

(async () => {
  const store = createStore();
  const B = bot._test({ store, stamp, A, send: fakeSend });

  /* --- Sun'iy ma'lumot --- */
  await store.set('meta/settings', {
    centerName: 'Albyana (sinov)',
    bot: { welcome: 'Xush kelibsiz', notify: { davomat: true, tolov: true, qarz: true, elon: true, ulash: true }, remindDays: 3, remindEvery: 7 }
  });
  await store.set('groups/g1', { id: 'g1', code: 'B020', name: 'Arab tili boshlang’ich', days: [1, 3], startTime: '10:00', endTime: '11:30' });
  await store.set('students/s1', { id: 's1', firstName: 'Ali', lastName: 'Valiyev', phone: '+998901112233' });
  await store.set('students/s2', { id: 's2', firstName: 'Ali', lastName: 'Valiyev', phone: '+998901112244' });   // BIR XIL ISM
  await store.set('memberships/m1', { id: 'm1', studentId: 's1', groupId: 'g1', status: 'faol' });
  await store.set('memberships/m2', { id: 'm2', studentId: 's2', groupId: 'g1', status: 'faol' });

  const msg = (chatId, text) => B.onMessage({ chat: { id: chatId }, from: { username: 'test' + chatId }, text });

  /* ---------- 1. Kodsiz odam avtomatik ulanmaydi ---------- */
  section('1. Ism bo’yicha avtomatik ulash YO’Q');
  await msg(100, '/start');
  ok('Bot kod so’radi', /kod/i.test(lastTo(100)), lastTo(100));
  await msg(100, 'ismim');
  await msg(100, 'Ali Valiyev');
  await msg(100, 'B020');
  const s1 = await store.get('students/s1');
  const s2 = await store.get('students/s2');
  ok('Hech kim avtomatik ulanmadi', !s1.telegram && !s2.telegram);
  const req = await store.get('botreq/req_100');
  ok('Administrator uchun so’rov yaratildi', !!req && req.status === 'kutilmoqda');
  ok('O’quvchiga kutish haqida aytildi', /administrator/i.test(lastTo(100)), lastTo(100));

  /* ---------- 2. Bir martalik havola bilan ulash ---------- */
  section('2. Bir martalik havola (token) bilan ulash');
  const link = require('../server/link');

  await msg(200, '/start');
  await msg(200, '4077');                                  // 4 xonali kod — endi bog'lamaydi
  ok('Kod bilan bog’lanmaydi', !(await store.get('students/s1')).telegram,
    JSON.stringify((await store.get('students/s1')).telegram));
  ok('Nima qilish kerakligi aytiladi', /havola|administrator/i.test(lastTo(200)), lastTo(200).slice(0, 120));

  await msg(200, 'lt000000000000.AAAAAAAAAAAAAAAAAAAAAA');  // soxta havola
  ok('Soxta havola rad etildi', /yaroqsiz|muddati|ishlatilgan/i.test(lastTo(200)), lastTo(200).slice(0, 120));
  ok('Soxta havolada ulanmadi', !(await store.get('students/s1')).telegram);

  const mk = await link.create(store, { studentId: 's1', byUserId: 'usr_admin', stamp });
  await msg(200, '/start ' + mk.token);
  const linked = await store.get('students/s1');
  ok('Havola bilan ulandi', !!(linked.telegram && linked.telegram.id === '200'),
    JSON.stringify(linked.telegram));
  ok('Ulanish "havola" orqali deb yozildi', linked.telegram.via === 'havola', linked.telegram.via);
  ok('Barqaror Telegram identifikatori saqlandi', !!linked.telegram.tgUserId, JSON.stringify(linked.telegram));
  ok('Boshqa o’quvchi ulanmadi', !(await store.get('students/s2')).telegram);

  section('   Ishlatilgan havola qayta yaramaydi');
  const used = await link.use(store, mk.token, { stamp });
  ok('Ikkinchi marta ishlatib bo’lmaydi', !used.ok && used.reason === 'ishlatilgan', JSON.stringify(used));

  /* ---------- 3. To'lov ma'lumoti (yangi hujjat tuzilishi) ---------- */
  section('3. To’lov holati to’g’ri hisoblanadi');
  await store.set('invoices/inv1', {
    id: 'inv1', studentId: 's1', groupId: 'g1', month: '2026-09',
    final: 500000, dueDate: '2026-09-05'
  });
  await store.set('payments/pay1', {
    id: 'pay1', studentId: 's1', amount: 200000, date: '2026-09-02',
    allocations: [{ invoiceId: 'inv1', amount: 200000 }]
  });
  const bal = await B.balanceText(await store.get('students/s1'));
  ok('Hisoblangan summa ko’rindi', bal.indexOf('500 000') >= 0, bal);
  ok('To’langan summa ko’rindi', bal.indexOf('200 000') >= 0, bal);
  ok('Qarz 300 000 deb yozildi', bal.indexOf('300 000') >= 0, bal);

  /* ---------- 4. Takroriy xabar ---------- */
  section('4. Bir xil xabar ikki marta ketmaydi');
  const e1 = await B.enqueue({ studentId: 's1', chatId: '200', text: 'Salom', kind: 'elon' });
  const e2 = await B.enqueue({ studentId: 's1', chatId: '200', text: 'Salom', kind: 'elon' });
  ok('Birinchi xabar navbatga tushdi', e1.skipped === false);
  ok('Ikkinchisi takror deb tashlandi', e2.skipped === true);
  const e3 = await B.enqueue({ studentId: 's1', chatId: '200', text: 'Boshqa xabar', kind: 'elon' });
  ok('Boshqa matn navbatga tushdi', e3.skipped === false);

  /* ---------- 5. Yuborish, xato va qayta urinish ---------- */
  section('5. Yuborish, xato va qayta urinish');
  const before = sent.length;
  let r = await B.flushQueue();
  ok('Xabarlar yuborildi (' + r.sent + ')', r.sent === 2, JSON.stringify(r));
  ok('Soxta qabul qiluvchiga tushdi', sent.length === before + 2);
  const q1 = await store.get('botout/' + e1.id);
  ok('Holat "sent"', q1.status === 'sent', q1.status);
  ok('Yuborilgan vaqt yozildi', !!q1.sentAt);

  failNext = 1;
  const e4 = await B.enqueue({ studentId: 's1', chatId: '200', text: 'Xato bo’ladigan xabar', kind: 'elon' });
  r = await B.flushQueue();
  let q4 = await store.get('botout/' + e4.id);
  ok('Xato belgilandi', q4.status === 'error', q4.status);
  ok('Xato matni saqlandi', /javob bermadi/.test(q4.error || ''), q4.error);
  ok('Keyingi urinish vaqti belgilandi', !!q4.nextTryAt);
  ok('Urinishlar soni 1', q4.tries === 1, String(q4.tries));

  r = await B.flushQueue(Date.now() + 20 * 60 * 1000);   // vaqt o'tdi deb hisoblaymiz
  q4 = await store.get('botout/' + e4.id);
  ok('Qayta urinishda yuborildi', q4.status === 'sent', q4.status);

  section('   Uch marta xato bo’lsa to’xtaydi');
  failNext = 5;
  const e5 = await B.enqueue({ studentId: 's1', chatId: '200', text: 'Hech qachon ketmaydi', kind: 'elon' });
  for (let i = 0; i < 4; i++) await B.flushQueue(Date.now() + (i + 1) * 60 * 60 * 1000);
  const q5 = await store.get('botout/' + e5.id);
  ok('Holat "failed"', q5.status === 'failed', q5.status);
  ok('Urinishlar 3 tadan oshmadi', q5.tries === 3, String(q5.tries));
  failNext = 0;

  /* ---------- 6. Xabar turini o'chirish ---------- */
  section('6. O’chirilgan turdagi xabar yuborilmaydi');
  const conf = await store.get('meta/settings');
  conf.bot.notify.elon = false;
  await store.set('meta/settings', conf);
  const e6 = await B.enqueue({ studentId: 's1', chatId: '200', text: 'E’lon: dars bekor', kind: 'elon' });
  const beforeSkip = sent.length;
  await B.flushQueue();
  const q6 = await store.get('botout/' + e6.id);
  ok('Xabar yuborilmadi', sent.length === beforeSkip, lastTo('200'));
  ok('Holat "skipped"', q6.status === 'skipped', q6.status);
  conf.bot.notify.elon = true;
  await store.set('meta/settings', conf);

  /* ---------- 7. Qarz eslatmasi ---------- */
  section('7. To’lov muddati o’tganda eslatma');
  const today = '2026-09-20';   // muddatdan 15 kun keyin
  let rem = await B.remindDebtors(today);
  ok('Eslatma navbatga qo’yildi', rem.queued === 1, JSON.stringify(rem));
  await B.flushQueue();
  ok('Eslatma matnida summa bor', /300 000/.test(lastTo('200')), lastTo('200'));
  ok('Eslatma matnida muddat bor', /muddat/i.test(lastTo('200')), lastTo('200'));

  rem = await B.remindDebtors(today);
  ok('Ikkinchi marta takrorlanmadi', rem.queued === 0 && rem.skipped === 1, JSON.stringify(rem));

  section('   Muddat o’tmagan bo’lsa eslatma yo’q');
  await store.set('invoices/inv1', {
    id: 'inv1', studentId: 's1', groupId: 'g1', month: '2026-10',
    final: 500000, dueDate: '2026-10-05'
  });
  await store.del('botout/' + (await store.list('botout/')).map(x => x.data)
    .filter(m => m.kind === 'qarz')[0].id);
  rem = await B.remindDebtors('2026-10-06');   // 1 kun o'tdi, remindDays=3
  ok('Erta eslatma yuborilmadi', rem.queued === 0, JSON.stringify(rem));

  section('   Qarz xabarlari o’chirilgan bo’lsa');
  const conf2 = await store.get('meta/settings');
  conf2.bot.notify.qarz = false;
  await store.set('meta/settings', conf2);
  rem = await B.remindDebtors('2026-10-20');
  ok('Eslatma umuman tuzilmadi', rem.off === true, JSON.stringify(rem));

  /* ---------- 8. To'langan bo'lsa eslatma yo'q ---------- */
  section('8. To’lab bo’lgan o’quvchiga eslatma yo’q');
  conf2.bot.notify.qarz = true;
  await store.set('meta/settings', conf2);
  await store.set('payments/pay2', {
    id: 'pay2', studentId: 's1', amount: 500000, date: '2026-10-01',
    allocations: [{ invoiceId: 'inv1', amount: 500000 }]
  });
  rem = await B.remindDebtors('2026-10-20');
  ok('Qarzsiz o’quvchiga yozilmadi', rem.queued === 0, JSON.stringify(rem));

  /* ---------- 9. Administrator tasdig'i ---------- */
  section('9. Administrator so’rovni tasdiqlaganda');
  const r2 = await store.get('botreq/req_100');
  r2.status = 'tasdiqlangan';
  await store.set('botreq/req_100', r2);
  await B.notifyApproved();
  ok('O’quvchiga xabar ketdi', /tasdiqlandi/i.test(lastTo(100)), lastTo(100));
  const r3 = await store.get('botreq/req_100');
  ok('Ikki marta xabar bermaslik uchun belgilandi', r3.notified === true);
  const cnt = sent.filter(m => m.chatId === '100' && /tasdiqlandi/i.test(m.text)).length;
  await B.notifyApproved();
  ok('Takroriy tasdiq xabari ketmadi',
    sent.filter(m => m.chatId === '100' && /tasdiqlandi/i.test(m.text)).length === cnt);

  /* ================= Telegram guruhiga ulanish ================= */
  section('Telegram guruhiga ulanish (guruh kodi nom ichida)');
  await store.set('groups/g9', {
    id: 'g9', code: '4821', name: 'Kechki A1', days: [2, 4], startTime: '18:30', endTime: '20:00'
  });

  ok('Nomdan kod ajratiladi',
    JSON.stringify(B.codesInTitle('AlBayan · Kechki A1 · 4821')) === '["4821"]',
    JSON.stringify(B.codesInTitle('AlBayan · Kechki A1 · 4821')));

  await B.linkGroupChat(-100200, 'AlBayan Kechki A1');
  const g9a = await store.get('groups/g9');
  ok('Kodsiz nom bilan ulanmaydi', !g9a.tgChat);
  ok('Nima qilish kerakligi tushuntiriladi', /kod/i.test(lastTo(-100200)), lastTo(-100200).slice(0, 80));

  await B.linkGroupChat(-100200, 'AlBayan · Kechki A1 · 9999');
  ok('Notanish kod bilan ulanmaydi', !(await store.get('groups/g9')).tgChat);

  await B.linkGroupChat(-100200, 'AlBayan · Kechki A1 · 4821');
  const g9b = await store.get('groups/g9');
  ok('Kod bo’yicha guruhga ulandi', String(g9b.tgChat) === '-100200', String(g9b.tgChat));
  ok('Guruh nomi saqlandi', /4821/.test(g9b.tgTitle || ''), g9b.tgTitle);
  ok('Guruhga "ulandim" xabari bordi', /Ulandim/.test(lastTo(-100200)), lastTo(-100200).slice(0, 90));
  ok('Xabarda guruh nomi bor', /Kechki A1/.test(lastTo(-100200)));

  ok('Boshqa guruh tegilmadi', !(await store.get('groups/g1')).tgChat);

  await B.onGroupUpdate(-100200, 'AlBayan · Kechki A1 · 4821', '/ulash');
  ok('/ulash qayta ulaydi', /yangilandi|Ulandim/.test(lastTo(-100200)), lastTo(-100200).slice(0, 60));

  const nBefore = sent.length;
  await B.onGroupUpdate(-100200, 'AlBayan · Kechki A1 · 4821', 'shunchaki suhbat');
  ok('Oddiy suhbatga aralashmaydi', sent.length === nBefore, String(sent.length - nBefore));

  const res = await B.sendToGroup(await store.get('groups/g9'), 'Ertaga dars 19:00 da');
  ok('Guruhga xabar yuborildi', res.ok && /19:00/.test(lastTo(-100200)), lastTo(-100200));
  const no = await B.sendToGroup(await store.get('groups/g1'), 'salom');
  ok('Ulanmagan guruhga yuborilmaydi', !no.ok, JSON.stringify(no));

  bot.stop();
  if (store.close) await store.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: haqiqiy Telegram ishlatilmadi — barcha xabarlar soxta qabul qiluvchiga ketdi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
