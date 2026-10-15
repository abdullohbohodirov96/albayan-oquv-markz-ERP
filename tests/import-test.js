/* O'QUVCHI IMPORTI sinovi — shaxsiy kod va to'lov sanasi.

   Markaz rahbari aytgan xato:
     "O'quvchini import qilganda shaxsiy KODI olinmayapti va TO'LOV
      SANASI ham qabul qilinmayapti."

   Ikki ildiz sabab bor edi:
     1) buildRecords() faylning kod ustunini .slice(0,4) bilan kesardi.
        Yangi shaxsiy kodlar 5 xonali (CODE_LEN=5), shuning uchun
        "12345" → "1234" bo'lib, noto'g'ri (yoki band) kod bilan yozilardi.
     2) buildRecords() "To'lov sanasi" / "To'lov kuni" ustunlarini
        umuman o'qimasdi — rec.payDate/rec.payDay undefined bo'lib qolar,
        doImport ularni '' deb ko'rib sanani va a'zolik dueDay ni
        tushirib yuborardi.

   Sinov import mantig'ini brauzersiz, to'g'ridan-to'g'ri chaqiradi:
   recordsFrom() ustunlardan yozuv tuzadi, doImport() esa o'quvchi va
   a'zolikni yozadi. ESKI kodda yiqiladi, tuzatilganda o'tadi.

   Ishga tushirish:  node tests/import-test.js
   Eski mantiqqa qarshi:  ALB_IMPORT_JS=/path/to/old-import.js node tests/import-test.js */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

/* --- Ilovaning haqiqiy mantig'ini yuklaymiz (server/shared.js kabi) --- */
['core.js', 'model.js'].forEach(function (f) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
});
const A = globalThis.A;

/* Brauzerga bog'liq qismlarni oddiy qalbaki bilan to'ldiramiz */
const store = {};
A.UI = {};
A.Data = {
  all: function (n) { return Object.keys(store[n] || {}).map(function (k) { return store[n][k]; }); },
  one: function (n, id) { return (store[n] || {})[id]; },
  save: async function (n, o) { (store[n] = store[n] || {})[o.id] = o; return o; },
  remove: async function (n, id) { if (store[n]) delete store[n][id]; }
};
A.Ops = { audit: async function () { } };
const App = { can: function () { return true; }, user: { id: 'u1', name: 'Test' }, render: function () { } };

/* Import modulini yuklaymiz (yo'lni ALB_IMPORT_JS bilan almashtirsa bo'ladi) */
const IMPORT_JS = process.env.ALB_IMPORT_JS || path.join(__dirname, '..', 'js', 'import.js');
(0, eval)(fs.readFileSync(IMPORT_JS, 'utf8'));
const H = A.importHelpers;

(async function () {
  /* =============== 1. recordsFrom: KOD va SANA olinadimi =============== */
  section('1. Ustunlardan yozuv tuzish (recordsFrom)');

  /* MODME eksportiga o'xshash: kod 5 xonali, sana "kun.oy.yil" */
  const map = { lastName: 0, firstName: 1, phone: 2, code: 3, payDate: 4, group: 5 };
  const rows = [['Karimov', 'Ali', '+998901234567', '12345', '01.09.2026', 'A001 · Arab A1']];
  const recs = H.recordsFrom('students', rows, map);
  ok('Bitta yozuv tuzildi', recs.length === 1, String(recs.length));
  const rec = recs[0] || {};
  ok('5 xonali shaxsiy kod kesilmay olindi', rec.code === '12345', JSON.stringify(rec.code));
  ok('To’lov sanasi ustuni o’qildi (xom)', rec.payDate === '01.09.2026', JSON.stringify(rec.payDate));

  /* 4 xonali eski kod ham buziladimi? (chegara holati) */
  const r4 = H.recordsFrom('students', [['X', 'Y', '+998900000011', '4821', '', '']], { lastName: 0, firstName: 1, phone: 2, code: 3, payDate: 4, group: 5 });
  ok('4 xonali eski kod ham to’liq qoladi', r4[0].code === '4821', JSON.stringify(r4[0].code));

  /* =============== 2. cellDate: formatlar =============== */
  section('2. Sana formatlari (cellDate)');
  ok('"01.09.2026" → ISO', H.cellDate('01.09.2026') === '2026-09-01', H.cellDate('01.09.2026'));
  ok('"2026-09-01" → ISO', H.cellDate('2026-09-01') === '2026-09-01', H.cellDate('2026-09-01'));
  ok('"2026-09-01 00:00:00" → ISO', H.cellDate('2026-09-01 00:00:00') === '2026-09-01', H.cellDate('2026-09-01 00:00:00'));
  ok('Bo’sh → bo’sh', H.cellDate('') === '', H.cellDate(''));

  /* =============== 3. doImport: o'quvchi + a'zolik yoziladi =============== */
  section('3. Import: kod, to’lov sanasi va a’zolik');
  store.students = {}; store.memberships = {}; store.groups = {}; store.courses = {}; store.leads = {};
  store.groups.g1 = { id: 'g1', code: 'A001', name: 'Arab A1', status: 'faol' };

  const res = await H.doImport('students', recs, true, App, null);
  ok('Bitta o’quvchi qo’shildi', res.added === 1, JSON.stringify(res));
  const st = A.Data.all('students')[0] || {};
  ok('O’quvchi kodi 12345 bo’lib yozildi', st.code === '12345', JSON.stringify(st.code));
  ok('To’lov sanasi o’quvchiga tushdi', st.payDate === '2026-09-01', JSON.stringify(st.payDate));
  const mem = A.Data.all('memberships')[0] || {};
  ok('Guruhga yozildi (a’zolik)', !!mem.id && mem.groupId === 'g1', JSON.stringify(mem.groupId));
  ok('A’zolik boshlanish sanasi = to’lov sanasi', mem.joinedAt === '2026-09-01', JSON.stringify(mem.joinedAt));
  ok('To’lov kuni (dueDay) sanadan olindi', mem.dueDay === 1, JSON.stringify(mem.dueDay));

  /* =============== 4. "To'lov kuni" alohida ustun bo'lsa =============== */
  section('4. "To’lov kuni" raqamli ustun');
  store.students = {}; store.memberships = {};
  store.groups = { g1: { id: 'g1', code: 'A001', name: 'Arab A1', status: 'faol' } };
  const map2 = { lastName: 0, firstName: 1, phone: 2, code: 3, payDay: 4, group: 5 };
  const rows2 = [['Toshmatov', 'Vali', '+998901234599', '67890', '15', 'A001']];
  const recs2 = H.recordsFrom('students', rows2, map2);
  ok('payDay xom o’qildi', recs2[0].payDay === '15', JSON.stringify(recs2[0].payDay));
  await H.doImport('students', recs2, true, App, null);
  const mem2 = A.Data.all('memberships')[0] || {};
  ok('dueDay = 15 (to’lov kuni ustunidan)', mem2.dueDay === 15, JSON.stringify(mem2.dueDay));

  /* =============== 5. analyse: sarlavhani tanish =============== */
  section('5. Sarlavha tanish (analyse)');
  const an = H.analyse([
    ['Familiya', 'Ism', 'Telefon', 'Shaxsiy kod', 'To’lov sanasi', 'Guruh'],
    ['Karimov', 'Ali', '+998901234567', '12345', '01.09.2026', 'A001']
  ]);
  ok('Kod ustuni tanildi', an.map.code === 3, JSON.stringify(an.map.code));
  ok('To’lov sanasi ustuni tanildi', an.map.payDate === 4, JSON.stringify(an.map.payDate));

  console.log(out.join('\n'));
  console.log('\n' + (fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') +
    ' — ' + pass + ' ta o’tdi, ' + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
