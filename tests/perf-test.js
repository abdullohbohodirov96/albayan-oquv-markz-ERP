/* Katta ma'lumot bilan tezlik sinovi (sun'iy ma'lumot, brauzerda).
   2000 o'quvchi, 24 000 hisob va to'lov yaratib, sahifa ochilish vaqtini o'lchaydi.
   Sekin bo'lsa test YIQILADI.
   Ishga tushirish:  node tests/perf-test.js                                */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

const LIMIT_RENDER = 2500;   // ms — ro'yxat ochilishi
const LIMIT_SEARCH = 1200;   // ms — qidiruv natijasi

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });
  await page.goto(FILE);
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', '1234');
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(1000);

  section('1. Sun’iy ma’lumot yaratish');
  const built = await page.evaluate(() => {
    const A = window.A, D = A.Data;
    const g = D.all('groups')[0];
    const t0 = performance.now();
    // to'g'ridan-to'g'ri xotiraga yozamiz (diskka yozish sinov maqsadi emas)
    for (let i = 0; i < 2000; i++) {
      const id = 'perf_s' + i;
      D.col.students[id] = {
        id, firstName: 'Ism' + i, lastName: 'Familiya' + i,
        phone: '+99890' + String(1000000 + i), status: 'faol', createdAt: '2026-01-01 09:00'
      };
      const mid = 'perf_m' + i;
      D.col.memberships[mid] = { id: mid, studentId: id, groupId: g.id, status: 'faol', joinedAt: '2026-01-05' };
      for (let m = 1; m <= 6; m++) {
        const ym = '2026-0' + m;
        const iid = 'perf_i' + i + '_' + m;
        D.col.invoices[iid] = {
          id: iid, membershipId: mid, studentId: id, groupId: g.id, month: ym,
          base: 500000, discount: 0, final: 500000, dueDate: ym + '-05'
        };
        if (m % 2 === 0) {
          const pid = 'perf_p' + i + '_' + m;
          D.col.payments[pid] = {
            id: pid, studentId: id, amount: 500000, date: ym + '-03', month: ym,
            method: 'naqd', allocations: [{ invoiceId: iid, amount: 500000 }]
          };
        }
      }
    }
    return {
      ms: Math.round(performance.now() - t0),
      students: Object.keys(D.col.students).length,
      invoices: Object.keys(D.col.invoices).length,
      payments: Object.keys(D.col.payments).length
    };
  });
  ok('2000 o’quvchi yaratildi (' + built.students + ')', built.students >= 2000);
  ok('12 000 hisob yaratildi (' + built.invoices + ')', built.invoices >= 12000);
  ok('6 000 to’lov yaratildi (' + built.payments + ')', built.payments >= 6000);

  section('2. O’quvchilar ro’yxati tez ochiladi');
  const render = await page.evaluate(() => {
    const t0 = performance.now();
    window.A.App.go('students');
    return Math.round(performance.now() - t0);
  });
  await page.waitForTimeout(300);
  ok('Ochilish ' + render + ' ms (chegara ' + LIMIT_RENDER + ')', render < LIMIT_RENDER, render + ' ms');

  const rowCount = await page.locator('table.tbl tbody tr').count();
  ok('Birinchi sahifada 100 ta qator (' + rowCount + ')', rowCount === 100, String(rowCount));
  const moreText = await page.locator('.tbl-more').innerText();
  ok('"Yana ko’rsatish" tugmasi bor', /Yana/.test(moreText), moreText.replace(/\n/g, ' '));
  ok('Jami soni ko’rsatilgan', /\/\s*20\d\d/.test(moreText.replace(/\n/g, ' ')), moreText.replace(/\n/g, ' '));

  section('   Yana ko’rsatish');
  await page.locator('.tbl-more button').click();
  await page.waitForTimeout(400);
  const rows2 = await page.locator('table.tbl tbody tr').count();
  ok('Qatorlar qo’shildi (' + rows2 + ')', rows2 === 200, String(rows2));

  section('3. Hisob (qarz/avans) to’g’ri va tez');
  const bal = await page.evaluate(() => {
    const t0 = performance.now();
    const map = window.A.Q.balanceMap();
    const ms = Math.round(performance.now() - t0);
    const one = map['perf_s7'];
    // 6 ta hisob × 500 000 = 3 000 000; 3 ta to'lov × 500 000 = 1 500 000
    return { ms, charged: one.charged, received: one.received, debt: one.debt, advance: one.advance, n: Object.keys(map).length };
  });
  ok('Barcha hisoblar ' + bal.ms + ' ms da hisoblandi', bal.ms < 1500, bal.ms + ' ms');
  ok('Hisoblangan 3 000 000', bal.charged === 3000000, String(bal.charged));
  ok('To’langan 1 500 000', bal.received === 1500000, String(bal.received));
  ok('Qarz 1 500 000', bal.debt === 1500000, String(bal.debt));
  ok('Avans yo’q', bal.advance === 0, String(bal.advance));
  ok('Hamma o’quvchi hisoblandi', bal.n >= 2000, String(bal.n));

  section('   Eski usul bilan solishtirish');
  const cmp = await page.evaluate(() => {
    const A = window.A;
    const ids = Object.keys(A.Data.col.students).slice(0, 60);
    const t0 = performance.now();
    const old = ids.map(id => A.Q.balance(id).debt);
    const oldMs = Math.round(performance.now() - t0);
    const map = A.Q.balanceMap();
    const same = ids.every((id, i) => (map[id] ? map[id].debt : 0) === old[i]);
    return { oldMs, same, per60: oldMs };
  });
  ok('Natijalar bir xil (eski va yangi usul)', cmp.same);
  out.push('    eslatma: 60 ta o’quvchini eski usulda hisoblash ' + cmp.oldMs + ' ms');

  section('4. Qidiruv tez ishlaydi');
  const searchMs = await page.evaluate(() => {
    const t0 = performance.now();
    window.A.App.go('students', { q: 'Familiya1234' });
    return Math.round(performance.now() - t0);
  });
  await page.waitForTimeout(300);
  ok('Qidiruv ' + searchMs + ' ms (chegara ' + LIMIT_SEARCH + ')', searchMs < LIMIT_SEARCH, searchMs + ' ms');
  const found = await page.locator('table.tbl tbody tr').count();
  ok('Aniq bitta o’quvchi topildi (' + found + ')', found === 1, String(found));

  section('5. Bosh sahifa ham tez');
  const dash = await page.evaluate(() => {
    const t0 = performance.now();
    window.A.App.go('dashboard');
    return Math.round(performance.now() - t0);
  });
  ok('Bosh sahifa ' + dash + ' ms', dash < LIMIT_RENDER, dash + ' ms');

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
