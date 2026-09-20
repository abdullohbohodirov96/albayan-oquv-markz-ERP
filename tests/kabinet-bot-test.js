/* Telegram bot: shaxsiy kod bilan ulanish va ma'lumot olish.
   Haqiqiy Telegram ISHLATILMAYDI — xabarlar soxta qabul qiluvchiga boradi.
   Ishga tushirish:  node tests/kabinet-bot-test.js                          */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-kabbot-'));
process.env.DATA_DIR = tmp;
process.env.BACKUP_DIR = path.join(tmp, 'backups');

const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const kabinet = require('../server/kabinet');
const bot = require('../server/bot');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }
function stamp() { return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '); }

(async () => {
  const store = createStore();
  const sent = [];
  const t = bot._test({
    store, stamp, A,
    send: async (chatId, text) => { sent.push({ chatId: String(chatId), text }); return { ok: true }; }
  });
  const last = () => (sent[sent.length - 1] || {}).text || '';

  /* ---------- Sun'iy ma'lumot ---------- */
  section('0. Sinov ma’lumotlari (sun’iy)');
  await store.set('meta/settings', {
    centerName: 'AlBayan Cairo', dueDay: 5,
    bot: { welcome: 'Xush kelibsiz!', notify: { davomat: true, tolov: true, qarz: true, elon: true, ulash: true } }
  });
  await store.set('staff/t1', { id: 't1', name: 'Ustoz Bot', status: 'faol' });
  await store.set('rooms/r1', { id: 'r1', name: '2-xona' });
  await store.set('courses/c1', { id: 'c1', name: 'Arab tili', monthlyFee: 300000, active: true });
  await store.set('groups/g1', {
    id: 'g1', code: 'B010', name: 'Bot guruhi', courseId: 'c1', teacherId: 't1', roomId: 'r1',
    days: [2, 4], startTime: '14:00', endTime: '15:30', startDate: '2026-09-01',
    fee: 300000, feeHistory: [{ fee: 300000, from: '2026-09' }], limit: 10, status: 'faol'
  });
  await store.set('students/s1', {
    id: 's1', firstName: 'Abdulloh', lastName: 'Bahodirov',
    phone: '+998901112233', parentPhone: '+998901112255', status: 'faol'
  });
  await store.set('students/s2', { id: 's2', firstName: 'Zuhra', lastName: 'Karimova', status: 'faol' });
  await store.set('memberships/m1', { id: 'm1', studentId: 's1', groupId: 'g1', joinedAt: '2026-09-01', status: 'faol' });
  await store.set('invoices/inv1', {
    id: 'inv1', studentId: 's1', groupId: 'g1', month: '2026-09',
    amount: 300000, discount: 0, final: 300000, status: 'ochiq', createdAt: stamp()
  });
  await store.set('lessons/g1__2026-09', {
    id: 'g1__2026-09',
    items: {
      '2026-09-01': { attendance: { m1: { status: 'keldi' } } },
      '2026-09-03': { attendance: { m1: { status: 'kelmadi' } } },
      '2026-09-08': { attendance: { m1: { status: 'keldi' } } }
    }
  });

  const added = await kabinet.ensureAllCodes(store);
  eq('Ikkala o’quvchiga kod berildi', added, 2);
  const s1 = await store.get('students/s1');
  const s2 = await store.get('students/s2');
  ok('Kod 4 xonali: ' + s1.code, /^\d{4}$/.test(String(s1.code)));
  ok('Kodlar takrorlanmadi', s1.code !== s2.code, s1.code + ' / ' + s2.code);

  /* ---------- 1. Ulanish ---------- */
  const link = require('../server/link');
  section('1. /start dan keyin bog’lash yo’li tushuntiriladi');
  await t.onMessage({ chat: { id: 555, type: 'private' }, text: '/start', from: { username: 'abdulloh' } });
  ok('Nima qilish kerakligi aytildi', /kod|havola/i.test(last()), last().slice(0, 140));

  section('   4 xonali kod bog’lamaydi (u maxfiy emas)');
  await t.onMessage({ chat: { id: 555, type: 'private' }, text: String(s1.code), from: {} });
  ok('Kod rad etildi', /o’chirilgan|havola/i.test(last()), last().slice(0, 140));
  ok('Hech kimning ismi oshkor bo’lmadi', !/Bahodirov|Karimova/.test(last()));
  ok('Bog’lanish yaratilmadi', !(await store.get('students/s1')).telegram);

  section('   Bir martalik havola — darhol to’liq ma’lumot');
  const mk1 = await link.create(store, { studentId: 's1', byUserId: 'usr_admin', stamp });
  await t.onMessage({ chat: { id: 555, type: 'private' }, text: '/start ' + mk1.token, from: { username: 'abdulloh', id: 555 } });
  const info = last();
  ok('Ism chiqdi', /Bahodirov Abdulloh/.test(info), info.slice(0, 160));
  ok('Guruh chiqdi', /Bot guruhi/.test(info), info.slice(0, 300));
  ok('O’qituvchi chiqdi', /Ustoz Bot/.test(info));
  ok('Dars vaqti chiqdi', /14:00–15:30/.test(info));
  ok('Dars kunlari chiqdi', /Seshanba/.test(info));
  ok('Qarz chiqdi', /300 000/.test(info), info.slice(0, 400));
  ok('Keyingi to’lov sanasi chiqdi', /Keyingi to’lov/.test(info));
  ok('Davomat chiqdi', /Davomat/.test(info) && /Keldi: 2/.test(info), info.slice(-300));
  ok('Kelmagani chiqdi', /Kelmadi: 1/.test(info));
  ok('Boshqa o’quvchi yo’q', !/Zuhra|Karimova/.test(info));

  section('   Chat o’quvchiga bog’landi');
  const linked = await store.get('students/s1');
  eq('Telegram ID saqlandi', (linked.telegram || {}).id, '555');
  await t.onMessage({ chat: { id: 555, type: 'private' }, text: 'Ma’lumotim', from: {} });
  ok('"Ma’lumotim" tugmasi ishladi', /Bahodirov Abdulloh/.test(last()) && /Davomat/.test(last()));
  await t.onMessage({ chat: { id: 555, type: 'private' }, text: '/start', from: {} });
  ok('Qayta /start da havola so’ralmadi', !/havola so’rang/.test(last()), last().slice(0, 120));

  /* ---------- 2. Har kim faqat o'zinikini ---------- */
  section('2. Har kim faqat o’z ma’lumotini oladi');
  const mk2 = await link.create(store, { studentId: 's2', byUserId: 'usr_admin', stamp });
  await t.onMessage({ chat: { id: 666, type: 'private' }, text: '/start ' + mk2.token, from: { id: 666 } });
  ok('Ikkinchi chat ikkinchi o’quvchiga bog’landi', /Karimova Zuhra/.test(last()), last().slice(0, 140));
  ok('Birinchisining ma’lumoti chiqmadi', !/Bahodirov/.test(last()));

  section('   Begona odam mavjud bog’lanishni egallay olmaydi');
  await t.onMessage({ chat: { id: 777, type: 'private' }, text: '/start', from: { id: 777 } });
  await t.onMessage({ chat: { id: 777, type: 'private' }, text: String(s1.code), from: { id: 777 } });
  const stillOne = await store.get('students/s1');
  eq('Begona chat bog’lanmadi', (stillOne.telegram || {}).id, '555');
  ok('Begonaga ma’lumot berilmadi', !/Bahodirov/.test(last()), last().slice(0, 140));

  /* ---------- 3. Havolani taxmin qilishdan himoya ---------- */
  section('3. Havolani taxmin qilishdan himoya');
  let locked = false;
  for (let i = 0; i < 8; i++) {
    await t.onMessage({
      chat: { id: 888, type: 'private' }, from: { id: 888 },
      text: 'lt00000000000' + i + '.AAAAAAAAAAAAAAAAAAAAAA'
    });
    if (/Juda ko’p urinish/.test(last())) { locked = true; break; }
  }
  ok('Ko’p urinishdan keyin to’xtatildi', locked, last().slice(0, 120));

  /* ---------- 4. Saytdagi formadan xabar ---------- */
  section('4. Saytdagi formadan kelgan murojaat botga tushadi');
  await store.set('meta/settings', Object.assign((await store.get('meta/settings')) || {}, {
    bot: { welcome: 'Xush kelibsiz!', staffChats: '900900, 800800', notify: { elon: true } }
  }));
  const before = sent.length;
  const res = await t.notifyStaff('Yangi murojaat (sayt)\nIsm: Mijoz\nTelefon: +998901234567');
  eq('Ikkita chatga navbatga qo’yildi', res.queued, 2);
  await t.flushQueue();
  const fresh = sent.slice(before);
  eq('Ikkita xabar ketdi', fresh.length, 2);
  ok('Matnda ism va telefon bor', fresh.every(m => /Mijoz/.test(m.text) && /998901234567/.test(m.text)),
    JSON.stringify(fresh.map(m => m.chatId)));
  ok('Ikkala chatga ham', fresh.map(m => m.chatId).sort().join(',') === '800800,900900',
    JSON.stringify(fresh.map(m => m.chatId)));

  section('   /id buyrug’i chat raqamini aytadi');
  await t.onMessage({ chat: { id: 4242 }, text: '/id', from: {} });
  ok('Chat raqami qaytdi', /4242/.test(last()), last().slice(0, 120));

  await store.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: haqiqiy Telegram ishlatilmadi — xabarlar soxta qabul qiluvchiga ketdi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
