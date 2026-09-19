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
  section('1. /start dan keyin shaxsiy kod so’raladi');
  await t.onMessage({ chat: { id: 555 }, text: '/start', from: { username: 'abdulloh' } });
  ok('Kod so’raldi', /4 ta raqam|kod/i.test(last()), last().slice(0, 120));
  ok('Namuna ko’rsatilgan', /4077/.test(last()), last().slice(0, 160));

  section('   Noto’g’ri kod');
  const wrong = String(Number(s1.code) === 1111 ? 2222 : 1111);
  await t.onMessage({ chat: { id: 555 }, text: wrong, from: {} });
  ok('Topilmadi deyildi', /topilmadi/i.test(last()), last().slice(0, 120));
  ok('Hech kimning ismi oshkor bo’lmadi', !/Bahodirov|Karimova/.test(last()));

  section('   To’g’ri kod — darhol to’liq ma’lumot');
  await t.onMessage({ chat: { id: 555 }, text: String(s1.code), from: { username: 'abdulloh' } });
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
  await t.onMessage({ chat: { id: 555 }, text: 'Ma’lumotim', from: {} });
  ok('"Ma’lumotim" tugmasi ishladi', /Bahodirov Abdulloh/.test(last()) && /Davomat/.test(last()));
  await t.onMessage({ chat: { id: 555 }, text: '/start', from: {} });
  ok('Qayta /start da kod so’ralmadi', !/4 ta raqam/.test(last()), last().slice(0, 120));

  /* ---------- 2. Begona kod bilan boshqa o'quvchi ---------- */
  section('2. Har kim faqat o’z ma’lumotini oladi');
  await t.onMessage({ chat: { id: 666 }, text: '/start', from: {} });
  await t.onMessage({ chat: { id: 666 }, text: String(s2.code), from: {} });
  ok('Ikkinchi chat ikkinchi o’quvchiga bog’landi', /Karimova Zuhra/.test(last()), last().slice(0, 140));
  ok('Birinchisining ma’lumoti chiqmadi', !/Bahodirov/.test(last()));

  /* ---------- 3. Taxmin qilishdan himoya ---------- */
  section('3. Kodni taxmin qilishdan himoya');
  await t.onMessage({ chat: { id: 777 }, text: '/start', from: {} });
  let locked = false;
  for (let i = 0; i < 8; i++) {
    const guess = String(3000 + i) === String(s1.code) ? '3999' : String(3000 + i);
    await t.onMessage({ chat: { id: 777 }, text: guess, from: {} });
    if (/Juda ko’p urinish/.test(last())) { locked = true; break; }
  }
  ok('Ko’p urinishdan keyin to’xtatildi', locked, last().slice(0, 120));
  await t.onMessage({ chat: { id: 777 }, text: String(s1.code), from: {} });
  ok('Qulf paytida to’g’ri kod ham o’tmadi', /Juda ko’p urinish/.test(last()), last().slice(0, 120));
  const stillOne = await store.get('students/s1');
  eq('Begona chat bog’lanmadi', (stillOne.telegram || {}).id, '555');

  await store.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: haqiqiy Telegram ishlatilmadi — xabarlar soxta qabul qiluvchiga ketdi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
