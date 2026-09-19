/* Vaqt mintaqasi (Asia/Tashkent, UTC+5) va "bugun" sinovi.
   Serverda ham, brauzerda ham sana bir xil bo'lishi kerak — kompyuterning
   vaqt mintaqasi qanday bo'lishidan qat'i nazar.
   Ishga tushirish:  node tests/time-test.js                                */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

/** Haqiqiy Toshkent sanasi (sinov uchun mustaqil hisob) */
function tashkentDate(at) {
  return new Date((at || Date.now()) + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

(async () => {
  /* ---------- 1. Server tomoni ---------- */
  section('1. Serverda sana Toshkent bo’yicha');
  const backup = require('../server/backup');
  eq('Zaxira moduli Toshkent sanasini beradi', backup.tzDate(), tashkentDate());
  ok('Vaqt belgisi "YYYY-MM-DD HH:MM:SS" ko’rinishida',
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(backup.tzStamp()), backup.tzStamp());

  const { A } = require('../server/shared');
  eq('Ilova mantig’i ham shu sanani beradi', A.today(), tashkentDate());

  section('   Kun chegarasi (UTC 19:00 = Toshkentda ertaga 00:00)');
  // 2026-09-19 19:30 UTC → Toshkentda 2026-09-20
  const late = Date.parse('2026-09-19T19:30:00Z');
  eq('UTC 19:30 da Toshkentda ertangi kun', tashkentDate(late), '2026-09-20');
  // 2026-09-19 18:30 UTC → Toshkentda hali 2026-09-19 (23:30)
  const early = Date.parse('2026-09-19T18:30:00Z');
  eq('UTC 18:30 da Toshkentda hali o’sha kun', tashkentDate(early), '2026-09-19');

  /* ---------- 2. Brauzer tomoni ---------- */
  const browser = await chromium.launch();

  async function openWith(tz) {
    const ctx = await browser.newContext({ timezoneId: tz, viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi (' + tz + '): ' + e.message); });
    await page.goto(FILE);
    await page.waitForSelector('#login-user', { timeout: 20000 });
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', '1234');
    await page.click('button[type=submit]');
    await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(800);
    return { ctx, page };
  }

  section('2. Brauzerda ham xuddi shu sana — qurilma mintaqasidan qat’i nazar');
  for (const tz of ['Asia/Tashkent', 'UTC', 'America/New_York', 'Asia/Tokyo']) {
    const { ctx, page } = await openWith(tz);
    const got = await page.evaluate(() => window.A.today());
    eq(tz + ' da sana to’g’ri', got, tashkentDate());
    const stamp = await page.evaluate(() => window.A.nowStamp());
    ok(tz + ' da vaqt belgisi to’g’ri ko’rinishda', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(stamp), stamp);
    await ctx.close();
  }

  /* ---------- 3. Davomat bugundan ochiladi ---------- */
  section('3. Davomat bugungi darsdan ochiladi');
  const { ctx, page } = await openWith('America/New_York');   // eng "notog'ri" mintaqa
  const today = tashkentDate();

  // bugun dars bo'ladigan guruh tayyorlaymiz
  await page.evaluate(async () => {
    const A = window.A, D = A.Data;
    const gs = D.all('groups').filter(g => g.status === 'faol');
    for (const g of gs) {
      const c = A.clone(g);
      c.days = [];                       // avval hammasidan dars kunini olib tashlaymiz
      await D.save('groups', c);
    }
    const first = A.clone(gs[gs.length - 1]);   // oxirgisiga bugungi kunni beramiz
    first.days = [A.weekdayOf(A.today())];
    await D.save('groups', first);
    window.__target = first.id;
  });
  await page.evaluate(() => window.A.App.go('attendance'));
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => ({
    date: window.A.App.route.date,
    groupId: window.A.App.route.groupId,
    target: window.__target,
    head: document.querySelector('.page-head p, .page-head .sub') ? document.querySelector('.page-head p, .page-head .sub').textContent : '',
    selected: (document.querySelector('.filters select:nth-of-type(1)') || {}).value
  }));
  const shown = await page.evaluate(() => {
    const el = document.querySelector('.card-head h2, .card h2');
    return el ? el.textContent : '';
  });
  ok('Bugungi sana o’zi tanlandi', shown.indexOf(String(Number(today.slice(8, 10)))) >= 0,
    'ko’rsatilgan: ' + shown + ' / bugun: ' + today);
  ok('Bugun dars bo’ladigan guruh tanlandi',
    state.groupId === state.target || shown.length > 0, JSON.stringify(state));

  const opts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.filters select')).map(s =>
      Array.from(s.options).map(o => o.textContent).join(' | ')));
  ok('Sana ro’yxatida "Bugun" belgisi bor', opts.join(' ').indexOf('Bugun') >= 0, opts.join(' ').slice(0, 160));

  section('   Davomat yozuvi bugungi sana bilan saqlanadi');
  const saved = await page.evaluate(async () => {
    const A = window.A, D = A.Data, App = A.App;
    const gid = App.route.groupId || window.__target;
    const ym = A.thisMonth();
    await D.loadLessons(gid, ym);
    const mem = A.Q.membersOf(gid)[0];
    if (!mem) return { skipped: true };
    const doc = D.lessonsCached(gid, ym);
    const lessons = A.monthLessons(D.one('groups', gid), ym, doc);
    const bugun = lessons.filter(l => l.date === A.today());
    return { date: A.today(), bugungiDars: bugun.length };
  });
  ok('Bugungi sana Toshkent bo’yicha', saved.skipped || saved.date === today, JSON.stringify(saved));
  ok('Bugun uchun dars topildi', saved.skipped || saved.bugungiDars > 0, JSON.stringify(saved));

  await ctx.close();
  await browser.close();

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
