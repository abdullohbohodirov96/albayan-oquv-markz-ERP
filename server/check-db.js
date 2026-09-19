/* Baza ulanishini tekshirish.
   Ishga tushirish:
     node server/check-db.js                 (.env dagi DATABASE_URL bilan)
     DATABASE_URL="postgresql://..." node server/check-db.js
     npm run check:db

   Nima qiladi:
   1) Manzilni tahlil qiladi (qaysi server, SSL kerakmi, ichki yoki tashqi);
   2) Ulanadi va yozish/o'qish/o'chirishni haqiqatda sinab ko'radi;
   3) Nechta yozuv borligini va hajmini aytadi.
   Parol hech qayerda ko'rsatilmaydi.                                         */
'use strict';
try { require('dotenv').config(); } catch (e) { }

const { pgConf } = require('./store');

function mask(url) {
  try {
    const u = new URL(url);
    return u.protocol + '//' + (u.username ? u.username + ':***@' : '') +
      u.hostname + (u.port ? ':' + u.port : '') + u.pathname;
  } catch (e) { return '(manzil noto’g’ri)'; }
}

function bad(msg, tip) {
  console.log('\n✗ ' + msg);
  if (tip) console.log('  → ' + tip);
  process.exit(1);
}

(async () => {
  const url = process.env.DATABASE_URL || '';
  console.log('\nBaza ulanishini tekshiramiz');
  console.log('─'.repeat(46));

  if (!url) {
    console.log('DATABASE_URL berilmagan.');
    console.log('Ilova diskdagi fayl bazasi bilan ishlaydi (DATA_DIR): ' +
      (process.env.DATA_DIR || './data'));
    console.log('\nBu ham to’g’ri holat — kichik markaz uchun yetarli.');
    process.exit(0);
  }

  if (!/^postgres(ql)?:\/\//.test(url)) {
    bad('DATABASE_URL postgresql:// bilan boshlanishi kerak.',
      'Render/Neon bergan manzilni to’liq nusxalang.');
  }

  const conf = pgConf(url);
  console.log('Manzil : ' + mask(url));
  console.log('Server : ' + (conf.host || '?'));
  console.log('Baza   : ' + (conf.db || '?'));
  console.log('SSL    : ' + (conf.ssl ? 'ha' : 'yo’q') +
    (conf.internal ? '  (Render ichki tarmog’i)' :
      conf.local ? '  (shu kompyuter)' : ''));

  if (conf.internal) {
    console.log('\nEslatma: bu ICHKI manzil. U faqat Render ichida ishlaydi.');
    console.log('Shu kompyuterdan tekshirmoqchi bo’lsangiz TASHQI manzilni oling.');
  }

  let Pool;
  try { Pool = require('pg').Pool; }
  catch (e) { bad('pg kutubxonasi o’rnatilmagan.', 'npm install'); }

  const pool = new Pool({
    connectionString: url,
    ssl: conf.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_MS || 15000)
  });

  const t0 = Date.now();
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    const m = String(e.message || e);
    let tip = '';
    if (/ENOTFOUND|EAI_AGAIN/.test(m)) tip = 'Server nomi topilmadi. Ichki manzilni tashqaridan ishlatyapsizmi?';
    else if (/password|authentication/i.test(m)) tip = 'Foydalanuvchi yoki parol noto’g’ri.';
    else if (/SSL|ssl/.test(m)) tip = 'SSL muammosi: PGSSLMODE=require yoki disable qilib ko’ring.';
    else if (/timeout|ETIMEDOUT/i.test(m)) tip = 'Ulanish vaqti tugadi. Manzil va tarmoqni tekshiring.';
    else if (/does not exist/i.test(m)) tip = 'Bunday baza yo’q — manzil oxiridagi nomni tekshiring.';
    await pool.end().catch(() => { });
    bad('Ulanib bo’lmadi: ' + m, tip);
  }
  console.log('\n✓ Ulandi  (' + (Date.now() - t0) + ' ms)');

  try {
    const v = await client.query('SELECT version()');
    console.log('  ' + String(v.rows[0].version).split(',')[0]);

    await client.query(
      'CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, data JSONB NOT NULL, ' +
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    console.log('✓ "docs" jadvali joyida');

    // Haqiqiy yozish/o'qish sinovi — o'z yo'limizda, hech kimning ma'lumotiga tegmaydi
    const p = 'meta/__ulanish_sinovi';
    const val = { at: new Date().toISOString(), n: Math.random() };
    await client.query(
      'INSERT INTO docs (path, data, updated_at) VALUES ($1, $2, now()) ' +
      'ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
      [p, JSON.stringify(val)]);
    const back = await client.query('SELECT data FROM docs WHERE path = $1', [p]);
    if (!back.rows[0] || back.rows[0].data.n !== val.n) {
      throw new Error('Yozilgan ma’lumot qaytib kelmadi.');
    }
    console.log('✓ Yozish va o’qish ishladi');
    await client.query('DELETE FROM docs WHERE path = $1', [p]);
    const gone = await client.query('SELECT 1 FROM docs WHERE path = $1', [p]);
    if (gone.rowCount !== 0) throw new Error('O’chirish ishlamadi.');
    console.log('✓ O’chirish ishladi');

    const st = await client.query(
      "SELECT count(*)::int AS rows, pg_size_pretty(pg_total_relation_size('docs')) AS size FROM docs");
    console.log('\nHozir bazada: ' + st.rows[0].rows + ' ta yozuv · ' + st.rows[0].size);
  } catch (e) {
    client.release();
    await pool.end().catch(() => { });
    bad('Sinov paytida xato: ' + (e.message || e),
      'Foydalanuvchida jadval yaratish huquqi bormi?');
  }

  client.release();
  await pool.end();
  console.log('\n' + '─'.repeat(46));
  console.log('✓ HAMMASI JOYIDA — ilovani shu manzil bilan ishga tushirsa bo’ladi.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
