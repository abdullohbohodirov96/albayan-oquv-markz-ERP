/* PostgreSQL bazasi sinovi (Neon va boshqa Postgres xizmatlari uchun).
   Ishga tushirish:
     DATABASE_URL="postgresql://..." node tests/db-test.js
   DATABASE_URL berilmasa, sinov o'tkazib yuboriladi.                       */
'use strict';
const URL = process.env.DATABASE_URL || '';
let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

if (!URL) {
  console.log('DATABASE_URL berilmagan — Postgres sinovi o’tkazib yuborildi.');
  console.log('Ishlatish: DATABASE_URL="postgresql://..." node tests/db-test.js');
  process.exit(0);
}

const { createStore } = require('../server/store');

(async () => {
  const store = createStore();
  eq('Postgres rejimi tanlandi', store.kind, 'postgres');

  /* --- Tozalash (faqat sinov yozuvlari) --- */
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: URL,
    ssl: /localhost|127\.0\.0\.1/.test(URL) ? false : { rejectUnauthorized: false }
  });
  await pool.query("DELETE FROM docs WHERE path LIKE 'dbtest/%'").catch(() => { });

  section('1. Yozish va o’qish');
  await store.set('dbtest/a1', { id: 'a1', name: 'Birinchi', amount: 500000, nested: { x: [1, 2, 3] } });
  const a1 = await store.get('dbtest/a1');
  ok('Yozuv qaytdi', !!a1, JSON.stringify(a1));
  eq('Matn saqlandi', a1.name, 'Birinchi');
  eq('Son saqlandi (matn emas)', a1.amount, 500000);
  eq('Ichki obyekt saqlandi', JSON.stringify(a1.nested), '{"x":[1,2,3]}');

  section('   O’zbekcha va arabcha matn');
  await store.set('dbtest/a2', { id: 'a2', name: 'Yo’ldoshev Maqsud', ar: 'المركز التعليمي', ru: 'Сентябрь' });
  const a2 = await store.get('dbtest/a2');
  eq('Apostrofli matn', a2.name, 'Yo’ldoshev Maqsud');
  eq('Arabcha matn', a2.ar, 'المركز التعليمي');
  eq('Kirill matn', a2.ru, 'Сентябрь');

  section('2. Yangilash (ustiga yozish)');
  await store.set('dbtest/a1', { id: 'a1', name: 'O’zgardi', amount: 700000 });
  const a1b = await store.get('dbtest/a1');
  eq('Yangi qiymat', a1b.name, 'O’zgardi');
  eq('Eski maydon qolmadi', a1b.nested, undefined);

  section('3. Boshlanishi bo’yicha qidirish');
  for (let i = 0; i < 25; i++) await store.set('dbtest/list/s' + i, { id: 's' + i, n: i });
  const listed = await store.list('dbtest/list/');
  eq('25 ta yozuv topildi', listed.length, 25);
  ok('Boshqa yo’llar aralashmadi', listed.every(r => r.path.indexOf('dbtest/list/') === 0));
  const other = await store.list('dbtest/a');
  eq('Boshqa prefiks 2 ta', other.length, 2);

  section('4. O’chirish');
  await store.del('dbtest/a2');
  eq('O’chirilgan yozuv yo’q', await store.get('dbtest/a2'), null);
  eq('Yo’q yozuvni o’qish null qaytaradi', await store.get('dbtest/yoq'), null);

  section('5. Bir vaqtda ko’p yozish (poyga bo’lmasin)');
  await Promise.all(Array.from({ length: 30 }, (_, i) =>
    store.set('dbtest/par/p' + i, { id: 'p' + i, amount: i * 1000 })));
  const par = await store.list('dbtest/par/');
  eq('30 ta yozuv saqlandi', par.length, 30);
  const sum = par.reduce((s, r) => s + r.data.amount, 0);
  eq('Summalar to’g’ri', sum, 435000);

  section('   Bir yozuvga ketma-ket yozish');
  for (let i = 1; i <= 20; i++) await store.set('dbtest/seq', { id: 'seq', n: i });
  eq('Oxirgi qiymat turibdi', (await store.get('dbtest/seq')).n, 20);

  section('6. Katta matn va maxsus belgilar');
  const big = { id: 'big', text: 'x'.repeat(50000), quote: 'It\'s "ok"; \\ backslash', nl: 'bir\nikki' };
  await store.set('dbtest/big', big);
  const gotBig = await store.get('dbtest/big');
  eq('Katta matn uzunligi', gotBig.text.length, 50000);
  eq('Tirnoq va slash saqlandi', gotBig.quote, 'It\'s "ok"; \\ backslash');
  eq('Yangi qator saqlandi', gotBig.nl, 'bir\nikki');

  section('7. Baza hajmi ko’rsatkichi');
  const stats = store.stats ? await store.stats() : null;
  ok('Statistika qaytdi', !!stats, JSON.stringify(stats));
  ok('Yozuvlar soni musbat', stats && stats.rows > 0, String(stats && stats.rows));
  ok('Hajm o’qildi', stats && stats.bytes > 0, String(stats && stats.bytes));

  section('8. Ilova mantig’i shu baza bilan ishlaydi');
  const backup = require('../server/backup');
  // sinov uchun yaratilgan uch bo'g'inli yo'llar zaxira qoidasiga to'g'ri kelmaydi — tozalaymiz
  await pool.query("DELETE FROM docs WHERE path LIKE 'dbtest/list/%' OR path LIKE 'dbtest/par/%'");
  await store.set('users/dbtest_admin', { id: 'dbtest_admin', login: 'dbtest', hash: 'x', salt: 'y', algo: 'pbkdf2' });
  const dump = await backup.dumpOf(store);
  ok('Zaxira nusxa tuzildi', dump.count > 0, String(dump.count));
  const check = backup.validate(Object.assign({}, dump, { checksum: backup.checksum(dump) }));
  ok('Zaxira tekshiruvdan o’tdi', check.ok, JSON.stringify(check.errors));

  /* --- Tozalash --- */
  await pool.query("DELETE FROM docs WHERE path LIKE 'dbtest/%' OR path = 'users/dbtest_admin'");
  await pool.end();
  if (store.close) await store.close();

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
