/* Kunlik tozalash sinovi.

   Nega kerak: yangi bo'limlar qo'shilgandan keyin bazada "vaqtinchalik"
   yozuvlar to'planib qolishi mumkin edi — boshlangan, lekin tugatilmagan
   test urinishlari, ishlatilgan havolalar, muddati o'tgan kabinet
   sessiyalari va bazada ma'lumotnomasi yo'q yetim fayllar.
   Tozalash yozilishidan oldin bu yozuvlar abadiy qolardi.

   Bu sinov tekshiradi:
     1) muddati o'tgan yozuvlar o'chadi;
     2) YANGI yozuvlar tegilmaydi;
     3) natijalar (quizres, placements) va tarix tegilmaydi;
     4) bazadagi ma'lumotnomasi bor fayl diskdan o'chmaydi.

   Ishga tushirish:  node tests/tozalash-test.js                          */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-tozalash-'));
process.env.DATA_DIR = DIR;
process.env.DB_DRIVER = process.env.TEST_DATABASE_URL ? 'pg' : 'sqlite';
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.FILES_DIR = path.join(DIR, 'files');

const { createStore } = require('../server/store');
const levels = require('../server/levels');
const quiz = require('../server/quiz');
const link = require('../server/link');
const kabsess = require('../server/kabsess');
const files = require('../server/files');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

const KUN = 864e5;
const ESKI = Date.now() - 30 * KUN;        // muddati 30 kun oldin tugagan
const YANGI = Date.now() + 30 * KUN;       // hali amal qiladi

(async () => {
  const store = createStore();

  /* ===================== 1. TEST URINISHLARI ===================== */
  section('1. Daraja testi va dars testi urinishlari');

  await store.set(levels.SESS + 'eski1', { id: 'eski1', expiresAt: ESKI, answers: {} });
  await store.set(levels.SESS + 'eski2', { id: 'eski2', expiresAt: ESKI, answers: {} });
  await store.set(levels.SESS + 'yangi', { id: 'yangi', expiresAt: YANGI, answers: {} });
  /* Natija — TEGILMAYDI */
  await store.set(levels.RESULT + 'r1', { id: 'r1', level: 'B1', at: '2026-01-01 10:00' });

  await store.set(quiz.QS + 'qeski', { id: 'qeski', expiresAt: ESKI, quizId: 'qz1' });
  await store.set(quiz.QS + 'qyangi', { id: 'qyangi', expiresAt: YANGI, quizId: 'qz1' });
  /* Test natijasi — TEGILMAYDI */
  await store.set(quiz.QR + 'qr1', { id: 'qr1', quizId: 'qz1', studentId: 's1', score: 80 });

  const nTest = await levels.cleanup(store);
  const nQuiz = await quiz.cleanup(store);

  ok('Eski daraja urinishlari o’chdi (2)', nTest === 2, 'olindi ' + nTest);
  ok('Yangi daraja urinishi qoldi', !!(await store.get(levels.SESS + 'yangi')));
  ok('Eski daraja urinishi yo’q', !(await store.get(levels.SESS + 'eski1')));
  ok('Daraja NATIJASI tegilmadi', !!(await store.get(levels.RESULT + 'r1')));

  ok('Eski dars testi urinishi o’chdi (1)', nQuiz === 1, 'olindi ' + nQuiz);
  ok('Yangi dars testi urinishi qoldi', !!(await store.get(quiz.QS + 'qyangi')));
  ok('Test NATIJASI tegilmadi', !!(await store.get(quiz.QR + 'qr1')));

  /* ===================== 2. KABINET SESSIYALARI ===================== */
  section('2. Kabinet sessiyalari');

  const ses = await kabsess.create(store, { studentId: 's1', kind: 'student', ttlMs: 30 * KUN });
  await store.set(kabsess.COL + 'kseski', {
    id: 'kseski', hash: 'a'.repeat(64), csrf: 'x', kind: 'student',
    studentId: 's9', expiresAt: ESKI, revokedAt: null
  });
  await store.set(kabsess.COL + 'ksbekor', {
    id: 'ksbekor', hash: 'b'.repeat(64), csrf: 'x', kind: 'student',
    studentId: 's8', expiresAt: ESKI, revokedAt: '2026-01-01 10:00'
  });
  /* Muddati yaqinda tugagan — hali 7 kun turadi (shikoyat bo'lsa ko'rinsin) */
  await store.set(kabsess.COL + 'ksyaqin', {
    id: 'ksyaqin', hash: 'c'.repeat(64), csrf: 'x', kind: 'student',
    studentId: 's7', expiresAt: Date.now() - 2 * KUN, revokedAt: null
  });

  const nSes = await kabsess.cleanup(store);
  ok('Eski sessiyalar o’chdi (2)', nSes === 2, 'olindi ' + nSes);
  ok('Amaldagi sessiya qoldi', !!(await store.get(kabsess.COL + ses.id)));
  ok('Yaqinda tugagani hali qoldi (7 kun)', !!(await store.get(kabsess.COL + 'ksyaqin')));
  ok('Muddati o’tgani yo’q', !(await store.get(kabsess.COL + 'kseski')));
  ok('Bekor qilingan eskisi yo’q', !(await store.get(kabsess.COL + 'ksbekor')));

  /* Amaldagi sessiya tozalashdan keyin ham ISHLAYDI */
  const oq = await kabsess.read(store, ses.cookie);
  ok('Amaldagi sessiya tozalashdan keyin ham ochiladi', !!oq && oq.studentId === 's1');

  /* ===================== 3. BIR MARTALIK HAVOLALAR ===================== */
  section('3. Bir martalik havolalar');

  const h = await link.create(store, { studentId: 's1' });
  await store.set(link.COL + 'lneski', {
    id: 'lneski', hash: 'd'.repeat(64), studentId: 's2',
    expiresAt: ESKI, usedAt: null, revokedAt: null
  });
  const nLink = await link.cleanup(store);
  ok('Eski havola o’chdi', nLink >= 1, 'olindi ' + nLink);
  ok('Yangi havola qoldi', !!(await store.get(link.COL + (h.id || String(h.token || '').split('.')[0]))));

  /* ===================== 4. YETIM FAYLLAR ===================== */
  section('4. Diskdagi yetim fayllar');

  fs.mkdirSync(files.DIR, { recursive: true });
  /* Bazada ma'lumotnomasi BOR fayl */
  fs.writeFileSync(path.join(files.DIR, 'fkerak.pdf'), 'kerakli hujjat');
  await store.set(files.COL + 'fkerak', {
    id: 'fkerak', ext: 'pdf', name: 'dars.pdf', type: 'application/pdf',
    bytes: 14, ref: 'materials/mat1', at: '2026-01-01 10:00'
  });
  /* Bazada ma'lumotnomasi YO'Q fayl (yetim) */
  fs.writeFileSync(path.join(files.DIR, 'fyetim.pdf'), 'unutilgan fayl');

  const nFile = await files.sweep(store);
  ok('Yetim fayl o’chdi (1)', nFile === 1, 'olindi ' + nFile);
  ok('Kerakli fayl diskda qoldi', fs.existsSync(path.join(files.DIR, 'fkerak.pdf')));
  ok('Bazadagi ma’lumotnoma tegilmadi', !!(await store.get(files.COL + 'fkerak')));
  ok('Yetim fayl diskda yo’q', !fs.existsSync(path.join(files.DIR, 'fyetim.pdf')));

  /* ===================== 5. TAKROR ISHLATISH ===================== */
  section('5. Tozalash ikkinchi marta ishlatilsa');

  const ikki = [
    await levels.cleanup(store), await quiz.cleanup(store),
    await kabsess.cleanup(store), await link.cleanup(store), await files.sweep(store)
  ];
  ok('Ikkinchi marta hech narsa o’chmaydi', ikki.every(n => n === 0), ikki.join(','));
  ok('Amaldagi sessiya hamon joyida', !!(await kabsess.read(store, ses.cookie)));
  ok('Natijalar hamon joyida',
    !!(await store.get(quiz.QR + 'qr1')) && !!(await store.get(levels.RESULT + 'r1')));

  /* ===================== YAKUN ===================== */
  console.log(out.join('\n'));
  console.log('\n' + (fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') +
    ' — ' + pass + ' ta o\'tdi, ' + fail + ' ta xato');
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (x) { }
  process.exit(1);
});
