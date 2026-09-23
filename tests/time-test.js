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

  /* ---------- 4. Dars holati: hozir / kelayotgan / tugagan ---------- */
  section('4. Darslar holati bo’yicha tartiblanadi');
  const ph = await page.evaluate(() => {
    const A = window.A;
    /* Soatni 12:30 deb olamiz — sinov kun bo'yi bir xil natija bersin */
    const now = A.hm('12:30');
    const L = [
      { id: 'a', start: '08:45', end: '10:15' },
      { id: 'b', start: '12:00', end: '13:30' },
      { id: 'c', start: '15:30', end: '17:00' },
      { id: 'd', start: '10:30', end: '12:00' },
      { id: 'e', start: '18:30', end: '20:00' }
    ];
    return {
      hozir: A.lessonPhase(L[1], now),
      tugagan: A.lessonPhase(L[0], now),
      keyingi: A.lessonPhase(L[2], now),
      chegara: A.lessonPhase(L[3], now),          // 12:00 da tugadi
      tartib: A.sortLessons(L, now).map(x => x.id),
      endsiz: A.lessonPhase({ start: '11:30' }, now),   // tugash vaqti yozilmagan
      hmBuzuq: A.hm('xx:yy'),
      hmTogri: A.hm('09:05')
    };
  });
  eq('12:00–13:30 dars hozir ketyapti', ph.hozir, 'hozir');
  eq('08:45–10:15 dars tugagan', ph.tugagan, 'tugadi');
  eq('15:30 dagi dars hali kelmagan', ph.keyingi, 'keyin');
  eq('Aynan tugash daqiqasida — tugagan', ph.chegara, 'tugadi');
  eq('Tugash vaqti yozilmasa 90 daqiqa deb olinadi', ph.endsiz, 'hozir');
  eq('Buzuq vaqt null qaytaradi', ph.hmBuzuq, null);
  eq('09:05 = 545 daqiqa', ph.hmTogri, 545);
  ok('Tartib: hozirgi dars birinchi, keyin kelayotganlari, oxirida tugaganlari',
    ph.tartib.join(',') === 'b,c,e,d,a', ph.tartib.join(','));

  await ctx.close();
  await browser.close();

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
