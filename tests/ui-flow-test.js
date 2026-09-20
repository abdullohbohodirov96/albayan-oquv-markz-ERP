/* Oynalarni yopish, xodimga hisob ochish va o'qituvchining bosh sahifasi.
   Serverni alohida bazada ishga tushiring, keyin:
     node tests/ui-flow-test.js [port] [direktor paroli]                      */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT + '/';
const SHOTS = path.join(__dirname, '..', 'shots');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

const R = 'w' + Date.now().toString(36);
const LOGIN = 'ustoz' + Date.now().toString(36).slice(-4);
const PW = 'Ustoz12345';

async function modals(page) {
  return page.evaluate(() => ({
    n: document.querySelectorAll('.modal').length,
    titles: Array.from(document.querySelectorAll('.modal .m-head h2')).map(x => x.textContent),
    backs: document.querySelectorAll('.modal-back').length
  }));
}
async function clickBtn(page, re) {
  return page.evaluate(rx => {
    const b = Array.from(document.querySelectorAll('.modal .m-foot .btn'))
      .find(x => new RegExp(rx).test(x.textContent));
    if (!b) return false;
    b.click(); return true;
  }, re.source || String(re));
}
async function typeIn(page, sel, val) {
  await page.evaluate(o => {
    const i = document.querySelector(o.sel);
    i.value = o.val;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }, { sel, val });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });

  await page.goto(BASE + '#kirish');
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(700);

  /* ================= 1. Oynani yopish ================= */
  section('1. "Bekor qilish" oynani yopadi');

  section('   Bo’sh forma');
  await page.evaluate(() => window.A.studentForm(null, window.A.App));
  await page.waitForSelector('.modal');
  ok('Oyna ochildi', (await modals(page)).n === 1);
  await clickBtn(page, /Bekor/);
  await page.waitForTimeout(400);
  eq('Bo’sh formada darhol yopildi', (await modals(page)).n, 0);

  section('   To’ldirilgan forma — avval so’raydi');
  await page.evaluate(() => window.A.studentForm(null, window.A.App));
  await page.waitForSelector('.modal');
  await typeIn(page, '.modal input', 'Sinov Ism');
  await clickBtn(page, /Bekor/);
  await page.waitForTimeout(400);
  let m = await modals(page);
  eq('Tasdiq oynasi chiqdi', m.n, 2);
  ok('So’rov matni to’g’ri', /Saqlanmagan/.test(m.titles.join(' ')), JSON.stringify(m.titles));

  section('   "Ha, yopilsin" — ikkala oyna ham yopiladi (oldin yopilmasdi)');
  await clickBtn(page, /Ha,/);
  await page.waitForTimeout(500);
  m = await modals(page);
  eq('Oyna qolmadi', m.n, 0);
  eq('Fon ham tozalandi', m.backs, 0);

  section('   "Bekor qilish" (tasdiqda) — forma ochiq qoladi');
  await page.evaluate(() => window.A.studentForm(null, window.A.App));
  await page.waitForSelector('.modal');
  await typeIn(page, '.modal input', 'Yana sinov');
  await clickBtn(page, /Bekor/);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.modal .m-foot .btn'));
    // tasdiq oynasidagi "Bekor qilish" — oxirgi oynaning tugmasi
    const last = btns.filter(b => /Bekor/.test(b.textContent)).pop();
    last.click();
  });
  await page.waitForTimeout(400);
  m = await modals(page);
  eq('Forma ochiq qoldi', m.n, 1);
  ok('Yozilgan matn saqlanib qoldi',
    (await page.evaluate(() => document.querySelector('.modal input').value)) === 'Yana sinov');

  section('   X tugmasi va Escape ham ishlaydi');
  await page.evaluate(() => { document.querySelector('.modal .x-btn').click(); });
  await page.waitForTimeout(400);
  await clickBtn(page, /Ha,/);
  await page.waitForTimeout(400);
  eq('X orqali yopildi', (await modals(page)).n, 0);

  await page.evaluate(() => window.A.studentForm(null, window.A.App));
  await page.waitForSelector('.modal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  eq('Escape bilan yopildi', (await modals(page)).n, 0);

  section('   Boshqa oynalar ham yopiladi');
  for (const [name, open] of [
    ['To’lov oynasi', () => window.A.paymentForm(null, window.A.App)],
    ['Guruh formasi', () => window.A.groupForm(null, window.A.App)],
    ['Foydalanuvchi formasi', () => window.A.userForm(null, window.A.App)]
  ]) {
    await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(x => x.remove()); });
    await page.waitForTimeout(150);
    await page.evaluate(open);
    await page.waitForSelector('.modal', { timeout: 5000 });
    // ba'zi forma o'rniga ogohlantirish chiqishi mumkin (masalan "Avval kurs qo'shing")
    const single = await page.evaluate(() =>
      document.querySelectorAll('.modal .m-foot .btn').length === 1);
    if (single) {
      await page.evaluate(() => { document.querySelector('.modal .x-btn').click(); });
      await page.waitForTimeout(400);
      eq(name + ' (ogohlantirish) yopildi', (await modals(page)).n, 0);
      continue;
    }
    // eng ustki oynaning "Bekor qilish" tugmasi
    await page.evaluate(() => {
      const ms = document.querySelectorAll('.modal');
      const top = ms[ms.length - 1];
      const b = Array.from(top.querySelectorAll('.m-foot .btn'))
        .find(x => /Bekor|Yopish/.test(x.textContent));
      if (b) b.click();
    });
    await page.waitForTimeout(500);
    if ((await modals(page)).n > 0) {
      await page.evaluate(() => {
        const ms = document.querySelectorAll('.modal');
        const top = ms[ms.length - 1];
        const b = Array.from(top.querySelectorAll('.m-foot .btn')).find(x => /Ha,/.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(500);
    }
    const stM = await modals(page);
    eq(name + ' yopildi', stM.n, 0);
    if (stM.n) out.push('      qolgan oyna: ' + JSON.stringify(stM.titles) +
      ' · tugmalar: ' + JSON.stringify(await page.evaluate(() =>
        Array.from(document.querySelectorAll('.modal .m-foot .btn')).map(x => x.textContent))));
  }

  /* ================= 2. Xodimga hisob ================= */
  section('2. Xodim qo’shilganda login va parol darhol beriladi');
  await page.evaluate(() => window.A.App.go('staff'));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /Xodim qo’shish/.test(x.textContent));
    b.click();
  });
  await page.waitForSelector('.modal', { timeout: 5000 });
  const hasAcc = await page.evaluate(() => !!document.getElementById('staff-acc'));
  ok('Hisob bo’limi formada bor', hasAcc);
  ok('Belgilangan holatda (yangi xodim uchun)',
    await page.evaluate(() => document.getElementById('staff-acc').checked));

  const filled = await page.evaluate(o => {
    function set(label, val) {
      const wrap = Array.from(document.querySelectorAll('.modal .field'))
        .find(w => w.textContent.trim().indexOf(label) === 0);
      if (!wrap) return false;
      const i = wrap.querySelector('input,select');
      i.value = val;
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    const okName = set('Ism familiya', o.name);
    const okLogin = set('Login', o.login);
    const okPass = set('Parol', o.pw);
    const roleWrap = Array.from(document.querySelectorAll('.modal .field'))
      .find(w => w.textContent.trim().indexOf('Rol') === 0);
    const role = roleWrap ? roleWrap.querySelector('select').value : '';
    return { okName, okLogin, okPass, role };
  }, { name: 'Ustoz Sinov ' + R, login: LOGIN, pw: PW });
  ok('Maydonlar to’ldirildi', filled.okName && filled.okLogin && filled.okPass, JSON.stringify(filled));
  eq('Rol lavozimdan o’zi tanlandi', filled.role, 'oqituvchi');

  await clickBtn(page, /Saqlash/);
  await page.waitForTimeout(1500);
  const madeBox = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.modal .m-head h2')).map(x => x.textContent);
    return t.join('|');
  });
  ok('"Hisob tayyor" oynasi chiqdi', /Hisob tayyor/.test(madeBox), madeBox);
  await clickBtn(page, /Yopish/);
  await page.waitForTimeout(400);

  const created = await page.evaluate(l => {
    const u = window.A.Data.all('users').filter(x => x.login === l)[0];
    if (!u) return null;
    const st = window.A.Data.one('staff', u.staffId);
    return { role: u.role, staffId: !!u.staffId, staffName: st ? st.name : '', active: u.active };
  }, LOGIN);
  ok('Foydalanuvchi yaratildi', !!created, JSON.stringify(created));
  eq('Roli — o’qituvchi', (created || {}).role, 'oqituvchi');
  ok('Xodimga bog’langan', (created || {}).staffId === true, JSON.stringify(created));

  /* ================= 3. O'qituvchi kirib davomat ko'radi ================= */
  section('3. O’qituvchi kirganda bosh sahifada davomat birinchi turadi');
  // yangi xodimni bugun dars bo'ladigan guruhga biriktiramiz
  await page.evaluate(async (o) => {
    const A = window.A, D = A.Data;
    const u = D.all('users').filter(x => x.login === o.login)[0];
    const staffId = u.staffId;
    let course = D.all('courses')[0];
    if (!course) {
      course = { id: 'crs_' + o.r, name: 'Arab tili', monthlyFee: 300000, active: true };
      await D.save('courses', course);
    }
    const g = {
      id: 'grp_' + o.r, code: 'W' + String(o.r).slice(-3).toUpperCase(), name: 'Sinov guruhi ' + o.r,
      courseId: course.id, teacherId: staffId, roomId: '',
      days: [A.weekdayOf(A.today())], startTime: '10:00', endTime: '11:30',
      startDate: A.addDays(A.today(), -30),
      fee: 300000, feeHistory: [{ fee: 300000, from: A.thisMonth() }], limit: 10, status: 'faol'
    };
    await D.save('groups', g);
    const st = { id: 'stu_' + o.r, firstName: 'Sinov', lastName: 'O’quvchi', phone: '+998901110000', status: 'faol' };
    await D.save('students', st);
    await D.save('memberships', { id: 'mem_' + o.r, studentId: st.id, groupId: g.id, joinedAt: A.today(), status: 'faol' });
  }, { login: LOGIN, r: R });
  await page.waitForTimeout(800);

  // chiqib, o'qituvchi bo'lib kiramiz
  // o'qituvchi uchun toza oyna (direktor sessiyasi aralashmasin)
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const tpage = await tctx.newPage();
  tpage.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi (ustoz): ' + e.message); });
  await tpage.goto(BASE + '#kirish');
  await tpage.waitForSelector('#login-user', { state: 'visible', timeout: 20000 });
  await tpage.fill('#login-user', LOGIN);
  await tpage.fill('#login-pass', PW);
  await tpage.click('button[type=submit]');
  await tpage.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await tpage.waitForTimeout(1000);
  await page.close();
  page = tpage;

  const dash = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#view .card'));
    const first = cards[0];
    return {
      firstTitle: first ? (first.querySelector('h2') || {}).textContent || '' : '',
      hasAttRow: !!document.querySelector('.att-row'),
      attText: (document.querySelector('.att-row') || {}).innerText || '',
      groups: window.A.Data.all('groups').length
    };
  });
  ok('Birinchi karta — davomat', /davomat/i.test(dash.firstTitle), JSON.stringify(dash.firstTitle));
  ok('Bugungi dars qatori bor', dash.hasAttRow, JSON.stringify(dash));
  ok('Qatorda guruh nomi bor', /Sinov guruhi/.test(dash.attText), dash.attText);
  ok('"Davomat olish" tugmasi bor', /Davomat olish/.test(dash.attText), dash.attText);
  await page.screenshot({ path: path.join(SHOTS, 'ustoz-bosh-sahifa.png') });

  section('   Bosilganda to’g’ri guruh davomati ochiladi');
  await page.evaluate(() => document.querySelector('.att-row').click());
  await page.waitForTimeout(1200);
  const att = await page.evaluate(() => ({
    route: window.A.App.route,
    text: document.querySelector('#view').innerText.slice(0, 400)
  }));
  eq('Davomat sahifasi ochildi', att.route.name, 'attendance');
  ok('O’sha guruh tanlangan', String(att.route.groupId || '').indexOf('grp_') === 0, JSON.stringify(att.route));
  ok('Bugungi sana', att.route.date === await page.evaluate(() => window.A.today()), JSON.stringify(att.route));

  section('   Keldi/kelmadi belgilash va tuzatish');
  const gid = await page.evaluate(() => window.A.App.route.groupId);

  async function mark(label) {
    // kerak bo'lsa davomat sahifasiga qaytamiz
    await page.evaluate(g => {
      if (window.A.App.route.name !== 'attendance') {
        window.A.App.go('attendance', { groupId: g, date: window.A.today() });
      }
    }, gid);
    await page.waitForTimeout(900);
    const clicked = await page.evaluate(async (lbl) => {
      const btns = Array.from(document.querySelectorAll('#view button'))
        .filter(b => b.textContent.trim() === lbl);
      if (!btns.length) return false;
      btns[0].click();
      await new Promise(r => setTimeout(r, 250));
      const save = Array.from(document.querySelectorAll('#view button'))
        .find(b => /^Saqlash$/.test(b.textContent.trim()));
      if (save) save.click();
      return true;
    }, label);
    await page.waitForTimeout(1500);
    return page.evaluate(async (g) => {
      const A = window.A, D = A.Data, ym = A.thisMonth();
      await D.loadLessons(g, ym);
      const doc = D.lessonsCached(g, ym) || {};
      const day = (doc.items || {})[A.today()] || {};
      const first = Object.values(day.attendance || {})[0] || {};
      return { status: first.status, clicked: true };
    }, gid);
  }

  const marked = await mark('Keldi');
  eq('"Keldi" saqlandi', marked.status, 'keldi');

  const fixed = await mark('Kelmadi');
  eq('Xatoni tuzatish ishladi (kelmadi)', fixed.status, 'kelmadi');

  section('   Telefon ko’rinishida ham');
  await page.setViewportSize({ width: 390, height: 850 });
  await page.evaluate(() => window.A.App.go('dashboard'));
  await page.waitForTimeout(800);
  const mob = await page.evaluate(() => ({
    hasAtt: !!document.querySelector('.att-row'),
    rowH: document.querySelector('.att-row') ? Math.round(document.querySelector('.att-row').getBoundingClientRect().height) : 0,
    scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  ok('Telefonda ham davomat qatori bor', mob.hasAtt, JSON.stringify(mob));
  ok('Qator balandligi qulay (' + mob.rowH + ' px)', mob.rowH >= 48, JSON.stringify(mob));
  ok('Yon tomonga siljimadi', mob.scrollX <= 1, String(mob.scrollX));
  await page.screenshot({ path: path.join(SHOTS, 'ustoz-telefon.png'), fullPage: true });

  /* ================= 4. ERP: ustozlar va Telegram guruhi ================= */
  section('4. ERP’da saytdagi ustozlar va guruh kodi');
  // bu bo'lim direktor ko'zi bilan tekshiriladi — yangi, toza oyna
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dpage = await dctx.newPage();
  dpage.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi (direktor): ' + e.message); });
  await dpage.goto(BASE + '#kirish');
  await dpage.waitForSelector('#login-user', { timeout: 20000 });
  await dpage.fill('#login-user', 'admin');
  await dpage.fill('#login-pass', PASS);
  await dpage.click('button[type=submit]');
  await dpage.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await dpage.evaluate(() => window.A.App.go('staff'));
  await dpage.waitForSelector('.tch-admin-item', { timeout: 15000 }).catch(() => { });
  const tAdmin = await dpage.evaluate(() => ({
    who: (window.A.App.user || {}).login + '/' + (window.A.App.user || {}).role,
    route: window.A.App.route.name,
    tcount: Object.keys((window.A.Data.col.teachers) || {}).length,
    card: !!document.querySelector('.tch-admin'),
    items: document.querySelectorAll('.tch-admin-item').length,
    text: document.body.innerText
  }));
  ok('“Saytdagi ustozlar” bo’limi bor', tAdmin.card, JSON.stringify({ who: tAdmin.who, route: tAdmin.route, t: tAdmin.tcount, n: tAdmin.items }));
  ok('Ustozlar ro’yxati to’lgan', tAdmin.items >= 5, String(tAdmin.items));
  ok('Ustoz ismi ko’rinadi', /Ustoz/.test(tAdmin.text));

  const tgInfo = await dpage.evaluate(async () => {
    const A = window.A, D = A.Data;
    const g = D.all('groups')[0];
    if (!g) return { none: true };
    A.App.go('group', { id: g.id });
    await new Promise(r => setTimeout(r, 900));
    const code = document.querySelector('.tg-code b');
    return {
      code: code ? code.textContent.trim() : '',
      hasCard: !!document.querySelector('.tg-group'),
      text: document.body.innerText
    };
  });
  ok('Guruhda Telegram kartasi bor', !!tgInfo.hasCard, JSON.stringify(tgInfo).slice(0, 120));
  ok('Guruh kodi 4 raqam', /^\d{4}$/.test(tgInfo.code || ''), tgInfo.code);
  ok('Nima qilish kerakligi yozilgan', /guruh nomiga/i.test(tgInfo.text || ''), (tgInfo.text || '').slice(0, 80));
  await dctx.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nScreenshotlar: shots/ustoz-bosh-sahifa.png, shots/ustoz-telefon.png');
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
