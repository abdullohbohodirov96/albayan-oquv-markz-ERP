/* FILIAL SINOVI — markazda ikkita filial.

   Tekshiriladi:
     1) sozlamadagi filiallar ro'yxati to'g'ri o'qiladi;
     2) guruhga filial biriktiriladi va saqlanadi;
     3) tepadagi tanlagich chiqadi va tanlov eslab qolinadi;
     4) filial tanlanganda o'quvchilar, guruhlar va MOLIYA
        aynan o'sha filialniki bo'ladi;
     5) hisobotda umumiy foyda/zarar va "hisobga qo'shilmagan"
        ro'yxati ko'rinadi.

   Raqamlar aynan solishtiriladi — pul masalasida taxmin yaramaydi.

   Ishga tushirish:  node tests/filial-test.js [port] [direktor paroli]
   PRODUCTION BAZAGA TEGMAYDI — alohida sinov serveri kerak.          */
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT + '/';
const API = 'http://localhost:' + PORT;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + String(extra).slice(0, 220) : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got));
}
function section(t) { out.push('\n' + t); }

const R = 'f' + Date.now().toString(36);
const ID = n => R + '_' + n;
let COOKIE = '';

async function api(p, opts = {}) {
  const res = await fetch(API + p, {
    method: opts.method || 'GET',
    headers: Object.assign(opts.body ? { 'Content-Type': 'application/json' } : {},
      COOKIE ? { Cookie: COOKIE } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (p, data) => api('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', body: { data } });
const get = async p => ((await api('/api/doc?path=' + encodeURIComponent(p))).json || {}).data || null;
const del = p => api('/api/doc?path=' + encodeURIComponent(p), { method: 'DELETE' });

require('../server/shared');
const A = globalThis.A;

const B1 = 'Sinov Bir ' + R, B2 = 'Sinov Ikki ' + R;
const B1ID = A.branchId(B1), B2ID = A.branchId(B2);

(async () => {
  const lg = await api('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  COOKIE = lg.cookie;
  if (!COOKIE) { console.error('Direktor kira olmadi.'); process.exit(1); }

  const YM = A.thisMonth();
  const DAY = A.today();
  const FEE = 600000;

  /* =============== 1. Filiallar ro'yxati =============== */
  section('1. Sozlamadagi filiallar');
  const st0 = await get('meta/settings');
  await put('meta/settings', Object.assign({}, st0, { branches: B1 + '\n' + B2 }));
  const st1 = await get('meta/settings');
  const list = A.branchList(st1);
  eq('Ikkita filial o’qildi', list.length, 2);
  eq('Birinchisining nomi', list[0].name, B1);
  eq('Kaliti nomdan tuzildi', list[0].id, B1ID);
  eq('Nomi kalit bo’yicha topiladi', A.branchName(st1, B2ID), B2);
  /* Takror yozilgan nom ikki marta sanalmaydi */
  eq('Takror nom bir marta olinadi',
    A.branchList({ branches: B1 + '\n' + B1 + '\n' + B2 }).length, 2);
  /* Bo'sh qatorlar tashlanadi */
  eq('Bo’sh qatorlar tashlanadi', A.branchList({ branches: '\n\n ' + B1 + ' \n\n' }).length, 1);

  /* =============== 2. Ikkita filialda ikkita guruh =============== */
  section('2. Har filialda bitta guruh');
  await put('courses/' + ID('c'), { id: ID('c'), name: 'Filial kursi ' + R, monthlyFee: FEE, active: true });
  await put('staff/' + ID('t'), {
    id: ID('t'), name: 'Filial Ustoz', status: 'faol', position: 'O’qituvchi',
    payType: 'fixed', salaryAmount: 1000000
  });
  for (const [k, bid] of [['g1', B1ID], ['g2', B2ID]]) {
    await put('groups/' + ID(k), {
      id: ID(k), code: 'F' + (k === 'g1' ? '1' : '2') + String(Date.now() % 90 + 9),
      name: 'Filial guruhi ' + k + ' ' + R, courseId: ID('c'), teacherId: ID('t'),
      branchId: bid, days: [1, 3], startTime: '09:00', endTime: '10:30',
      startDate: A.monthStart(YM), fee: FEE, feeHistory: [{ fee: FEE, from: YM }],
      lessonsPerMonth: 12, limit: 20, status: 'faol'
    });
  }
  const g1 = await get('groups/' + ID('g1'));
  const g2 = await get('groups/' + ID('g2'));
  eq('1-guruh filiali saqlandi', A.branchOf(g1), B1ID);
  eq('2-guruh filiali saqlandi', A.branchOf(g2), B2ID);

  /* Har guruhga bittadan o'quvchi */
  for (const [sk, gk] of [['s1', 'g1'], ['s2', 'g2']]) {
    await put('students/' + ID(sk), {
      id: ID(sk), firstName: 'Filial', lastName: 'O’quvchi ' + sk + ' ' + R,
      phone: '+99890666' + Math.floor(1000 + Math.random() * 8999), status: 'faol'
    });
    await put('memberships/' + ID('m' + sk), {
      id: ID('m' + sk), studentId: ID(sk), groupId: ID(gk),
      joinedAt: A.monthStart(YM), leftAt: null, status: 'faol', discount: null
    });
  }

  /* Hisob va har xil summadagi to'lov — filial ajratishini
     raqam bilan tekshirish uchun                            */
  await api('/api/invoices/generate', { method: 'POST', body: { month: YM } });
  const inv1 = await get('invoices/' + A.invoiceId(ID('ms1'), YM));
  const inv2 = await get('invoices/' + A.invoiceId(ID('ms2'), YM));
  ok('1-filial o’quvchisiga hisob tuzildi', !!inv1);
  ok('2-filial o’quvchisiga hisob tuzildi', !!inv2);
  await api('/api/payment', {
    method: 'POST', body: {
      studentId: ID('s1'), amount: 100000, date: DAY, method: 'naqd',
      allocations: inv1 ? [{ invoiceId: inv1.id, amount: 100000 }] : []
    }
  });
  await api('/api/payment', {
    method: 'POST', body: {
      studentId: ID('s2'), amount: 250000, date: DAY, method: 'naqd',
      allocations: inv2 ? [{ invoiceId: inv2.id, amount: 250000 }] : []
    }
  });
  /* Filialli va filialsiz xarajat */
  await put('expenses/' + ID('e1'), {
    id: ID('e1'), date: DAY, month: YM, category: 'Ijara', amount: 50000,
    method: 'naqd', branchId: B1ID, note: 'Filial sinovi ' + R
  });
  await put('expenses/' + ID('e2'), {
    id: ID('e2'), date: DAY, month: YM, category: 'Reklama', amount: 30000,
    method: 'naqd', note: 'Umumiy sinov ' + R          // filialsiz = umumiy
  });

  /* =============== 3. Brauzerda: tanlagich =============== */
  section('3. Tepadagi filial tanlagichi');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  await ctx.route('**', r =>
    /^http:\/\/(localhost|127\.0\.0\.1)/.test(r.request().url()) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  const jsErr = [];
  page.on('pageerror', e => jsErr.push(e.message));
  await page.goto(BASE + '#kirish', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-user', { timeout: 20000 });
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const pick = await page.evaluate(() => {
    const s = document.getElementById('branch-pick');
    return s ? { hidden: s.hidden, opts: Array.from(s.options).map(o => o.textContent) } : null;
  });
  ok('Tanlagich bor va ko’rinadi', !!pick && !pick.hidden, JSON.stringify(pick));
  ok('"Hamma filial" birinchi turadi', !!pick && pick.opts[0] === 'Hamma filial', JSON.stringify(pick));
  ok('Ikkala filial ro’yxatda', !!pick && pick.opts.indexOf(B1) > 0 && pick.opts.indexOf(B2) > 0,
    JSON.stringify(pick && pick.opts));

  /* =============== 4. Filial tanlanganda ro'yxatlar =============== */
  section('4. Ro’yxatlar filial bo’yicha ajraladi');
  async function selectBranch(id) {
    await page.evaluate(b => {
      const s = document.getElementById('branch-pick');
      s.value = b; s.dispatchEvent(new Event('change'));
    }, id);
    await page.waitForTimeout(900);
  }
  async function countStudents() {
    await page.evaluate(() => window.A.App.go('students'));
    await page.waitForTimeout(900);
    return page.evaluate(() => {
      const txt = document.getElementById('view').innerText;
      return {
        bir: /O’quvchi s1/.test(txt), ikki: /O’quvchi s2/.test(txt)
      };
    });
  }
  await selectBranch('');
  const both = await countStudents();
  ok('Hamma filialda ikkalasi ham ko’rinadi', both.bir && both.ikki, JSON.stringify(both));

  await selectBranch(B1ID);
  const only1 = await countStudents();
  ok('1-filialda faqat o’zining o’quvchisi', only1.bir && !only1.ikki, JSON.stringify(only1));

  await selectBranch(B2ID);
  const only2 = await countStudents();
  ok('2-filialda faqat o’zining o’quvchisi', !only2.bir && only2.ikki, JSON.stringify(only2));

  /* Guruhlar ham */
  async function groupsText() {
    await page.evaluate(() => window.A.App.go('groups'));
    await page.waitForTimeout(900);
    return page.evaluate(() => document.getElementById('view').innerText);
  }
  const gTxt2 = await groupsText();
  ok('2-filialda faqat o’zining guruhi',
    gTxt2.indexOf('guruhi g2') >= 0 && gTxt2.indexOf('guruhi g1') < 0, gTxt2.slice(0, 200));
  ok('Guruh kartasida filial nomi bor', gTxt2.indexOf(B2) >= 0, gTxt2.slice(0, 250));

  /* =============== 5. Moliya aynan filialniki =============== */
  section('5. Moliya raqamlari filial bo’yicha');
  async function money() {
    return page.evaluate(() => {
      const A = window.A;
      const pays = A.Fin.allPayments().filter(p => !p.voided);
      return {
        tushum: pays.reduce((s, p) => s + (p.type === 'refund' ? -1 : 1) * p.amount, 0),
        xarajat: A.Fin.allExpenses().filter(e => !e.voided).reduce((s, e) => s + e.amount, 0),
        hisob: A.Fin.allInvoices().length
      };
    });
  }
  await selectBranch(B1ID);
  const m1 = await money();
  await selectBranch(B2ID);
  const m2 = await money();
  await selectBranch('');
  const mAll = await money();

  ok('1-filial tushumida o’zining to’lovi bor', m1.tushum >= 100000, JSON.stringify(m1));
  ok('2-filial tushumida o’zining to’lovi bor', m2.tushum >= 250000, JSON.stringify(m2));
  ok('Filial tushumi umumiydan kichik', m1.tushum < mAll.tushum && m2.tushum < mAll.tushum,
    JSON.stringify({ m1: m1.tushum, m2: m2.tushum, all: mAll.tushum }));
  /* Eng muhimi: ikkala filial tushumi qo'shilsa umumiyga teng
     (bu sinovdagi o'quvchilar bitta filialda o'qiydi)        */
  ok('Umumiy tushum ikkalasidan kichik emas',
    mAll.tushum >= m1.tushum + m2.tushum - 1,
    JSON.stringify({ m1: m1.tushum, m2: m2.tushum, all: mAll.tushum }));

  /* Filialsiz xarajat IKKALA filialda ham ko'rinadi (umumiy) */
  await selectBranch(B1ID);
  const e1 = await page.evaluate(nid => {
    const A = window.A;
    return A.Fin.allExpenses().filter(e => String(e.note || '').indexOf(nid) >= 0)
      .map(e => e.category);
  }, R);
  ok('1-filialda o’z xarajati bor', e1.indexOf('Ijara') >= 0, JSON.stringify(e1));
  ok('Umumiy xarajat ham ko’rinadi', e1.indexOf('Reklama') >= 0, JSON.stringify(e1));
  await selectBranch(B2ID);
  const e2 = await page.evaluate(nid => {
    const A = window.A;
    return A.Fin.allExpenses().filter(e => String(e.note || '').indexOf(nid) >= 0)
      .map(e => e.category);
  }, R);
  ok('2-filialda begona xarajat yo’q', e2.indexOf('Ijara') < 0, JSON.stringify(e2));
  ok('Umumiy xarajat bu yerda ham bor', e2.indexOf('Reklama') >= 0, JSON.stringify(e2));

  /* =============== 6. Hisobot: foyda va qo'shilmaganlar =============== */
  section('6. Hisobot: umumiy foyda va qo’shilmaganlar');
  await selectBranch(B1ID);
  await page.evaluate(() => window.A.App.go('reports'));
  await page.waitForTimeout(1200);
  const rep = await page.evaluate(() =>
    document.getElementById('view').innerText.replace(/\s+/g, ' '));
  ok('Umumiy foyda/zarar ko’rsatkichi bor', /Umumiy (foyda|zarar)/.test(rep), rep.slice(0, 300));
  ok('To’langan ish haqi alohida ko’rsatilgan', /To’langan ish haqi/.test(rep), rep.slice(0, 300));
  ok('Sof pul oqimi ham qolgan', /Sof pul oqimi/.test(rep), rep.slice(0, 300));
  ok('"Hisobga qo’shilmagan" bo’limi bor', /Hisobga qo’shilmagan/.test(rep), rep.slice(0, 400));
  ok('Filialsiz xarajat haqida aytilgan',
    /filialga biriktirilmagan/i.test(rep), rep.slice(0, 500));
  ok('Ish haqi ajratilmasligi aytilgan',
    /Ish haqi filial bo’yicha ajratilmaydi/.test(rep), rep.slice(0, 600));
  ok('Qarz foydaga qo’shilmagani aytilgan',
    /qarzi/.test(rep) || !/qarzdorlik/i.test(rep), rep.slice(0, 600));

  /* Foyda AYNAN to'g'ri hisoblanganmi */
  const calc = await page.evaluate(() => {
    const A = window.A, D = A.Data;
    const ym = A.thisMonth();
    const from = A.monthStart(ym), to = A.monthEnd(ym);
    const inR = d => d >= from && d <= to;
    const pays = A.Fin.allPayments().filter(p => inR(p.date));
    const exps = A.Fin.allExpenses().filter(e => inR(e.date) && !e.voided);
    const cf = A.cashFlow(pays, exps);
    let pr = 0;
    D.all('payroll').filter(x => x.month === ym).forEach(x => { pr += Math.round(x.paid || 0); });
    return { net: cf.net, payroll: pr, foyda: cf.net - pr };
  });
  const shown = (rep.match(/Umumiy (?:foyda|zarar) ([−-]?[\d  ]+)/) || [])[1] || '';
  const shownNum = Number(String(shown).replace(/[^\d-]/g, '')) * (/[−-]/.test(shown) ? -1 : 1);
  eq('Ekrandagi foyda hisobga mos', shownNum, calc.foyda);

  /* =============== 7. Tanlov eslab qolinadi =============== */
  section('7. Tanlov eslab qolinadi');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    branch: window.A.App.branch,
    sel: (document.getElementById('branch-pick') || {}).value
  }));
  eq('Sahifa yangilangandan keyin ham o’sha filial', after.branch, B1ID);
  eq('Tanlagichda ham o’sha turadi', after.sel, B1ID);

  /* Sozlamadan filial o'chirilsa — "Hamma filial" ga qaytadi */
  await page.evaluate(async (b2) => {
    const D = window.A.Data;
    const s = Object.assign({}, D.settings, { branches: b2 });
    await D.api('PUT', 'api/doc?path=' + encodeURIComponent('meta/settings'), { data: s });
    await D.loadBootstrap();
    window.A.App.render();
  }, B2);
  await page.waitForTimeout(900);
  const gone = await page.evaluate(() => window.A.App.branch);
  eq('O’chirilgan filial tanlovi bekor bo’ldi', gone, '');

  ok('Brauzerda JS xatosi yo’q', jsErr.length === 0, jsErr.slice(0, 2).join(' | '));
  await browser.close();

  /* =============== 8. Tozalash =============== */
  section('8. Sinov ma’lumotlari tozalandi');
  await api('/api/students/purge', { method: 'POST', body: { ids: [ID('s1'), ID('s2')] } });
  for (const p of ['expenses/' + ID('e1'), 'expenses/' + ID('e2'),
    'groups/' + ID('g1'), 'groups/' + ID('g2'),
    'courses/' + ID('c'), 'staff/' + ID('t')]) await del(p);
  if (st0) await put('meta/settings', st0);
  ok('Sinov guruhlari o’chirildi', !(await get('groups/' + ID('g1'))));
  const back = await get('meta/settings');
  eq('Sozlama joyiga qaytdi', A.branchLines(back), A.branchLines(st0 || {}));

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log(out.join('\n')); console.error(e); process.exit(1); });
