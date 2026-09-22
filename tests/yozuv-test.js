/* SAYTDA YOZILIB TURADIGAN IBORALAR sinovi.

   Markaz rahbari so'ragan narsa: sayt o'rtasida iboralar harf-harf
   yozilib, navbat bilan almashib turishi ("Arab tilini arablardan
   o'rganing", "Imtihonga tayyorlov", "C2 sertifikatigacha" ...).

   Shu sinov tekshiradi:
     1) ibora harf-harf o'sib boradi (bir zumda paydo bo'lmaydi);
     2) to'liq yozilgach, keyingisiga o'tadi;
     3) ibora almashganda sahifa SAKRAMAYDI (balandlik o'zgarmaydi);
     4) Sozlamada yozilgan iboralar saytda aynan chiqadi;
     5) /api/public javobida ular bor, lekin ortiqcha ma'lumot yo'q;
     6) "harakatni kamaytirish" rejimida yozilmaydi — shunchaki almashadi;
     7) bitta ibora bo'lsa kursor yo'qoladi va u qotib turadi.

   Ishga tushirish:  node tests/yozuv-test.js                             */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PASS = 'Albyana2026!';
const PORT = 4500 + Math.floor(Math.random() * 300);
const BASE = 'http://localhost:' + PORT;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-yozuv-'));
const PG = process.env.TEST_DATABASE_URL || '';
let srv = null, browser = null;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

async function bootServer() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: DIR, DB_DRIVER: PG ? 'pg' : 'sqlite', PORT: String(PORT),
      DATABASE_URL: PG || '',
      BACKUP_DIR: path.join(DIR, 'backups'),
      FILES_DIR: path.join(DIR, 'files'),
      SEED_DIRECTOR_PASSWORD: PASS
    }),
    stdio: 'ignore'
  });
  for (let i = 0; i < 90; i++) {
    const st = await fetch(BASE + '/api/health').then(r => r.status).catch(() => 0);
    if (st === 200) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}
function stop() {
  try { if (browser) browser.close(); } catch (e) { }
  try { if (srv) srv.kill(); } catch (e) { }
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { }
}

/* Sozlamani to'g'ridan-to'g'ri yozish uchun direktor sessiyasi */
let COOKIE = '';
async function req(p, opts) {
  opts = opts || {};
  const h = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
  if (COOKIE) h.cookie = COOKIE;
  const r = await fetch(BASE + p, {
    method: opts.method || 'GET', headers: h,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const set = r.headers.get('set-cookie');
  if (set) COOKIE = set.split(';')[0];
  let j = null; try { j = await r.json(); } catch (e) { }
  return { status: r.status, data: j };
}

const txtOf = (p) => p.$eval('#hero-type-txt', e => e.textContent);

(async () => {
  if (!await bootServer()) { console.error('Server ishga tushmadi'); stop(); process.exit(1); }
  browser = await chromium.launch();

  /* ============ 1. HARF-HARF YOZILISHI ============ */
  section('1. Ibora harf-harf yoziladi');

  let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/');
  await p.waitForSelector('#hero-type-txt', { timeout: 20000 });

  /* Uzunlik o'sib borishini kuzatamiz */
  const lens = [];
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(320);
    lens.push((await txtOf(p)).length);
  }
  const osdi = lens.some((v, i) => i > 0 && v > lens[i - 1]);
  ok('Matn asta-sekin o’sib boradi', osdi, lens.join(','));

  /* To'liq ibora chiqishini kutamiz */
  await p.waitForFunction(
    () => (document.getElementById('hero-type-txt').textContent || '').length > 20,
    { timeout: 20000 });
  const birinchi = (await txtOf(p)).trim();

  /* "Bir zumda paydo bo'lmadi" — birinchi o'lchov to'liq iboradan ANIQ qisqa
     bo'lishi kerak. Qat'iy son emas: sekin/tez mashinada ham to'g'ri ishlashi
     uchun to'liq uzunlikning yarmidan kam ekani tekshiriladi. */
  const chegara = Math.max(10, Math.round(birinchi.length * 0.5));
  ok('Bir zumda to’liq paydo bo’lmaydi', lens[0] < chegara,
    'boshlanishi: ' + lens[0] + ', to’liq: ' + birinchi.length + ', chegara: ' + chegara);
  ok('To’liq ibora yozildi: “' + birinchi + '”', birinchi.length > 20, birinchi);

  section('2. Keyingi iboraga o’tadi');
  /* O'chirilib, boshqa ibora yozilishini kutamiz */
  await p.waitForFunction((old) => {
    const t = (document.getElementById('hero-type-txt').textContent || '').trim();
    return t.length > 8 && t !== old && !old.startsWith(t);
  }, birinchi, { timeout: 25000 });
  const ikkinchi = (await txtOf(p)).trim();
  ok('Ikkinchi ibora boshqa: “' + ikkinchi + '”', ikkinchi !== birinchi, birinchi + ' / ' + ikkinchi);

  section('3. Sahifa sakramaydi');
  const h = [];
  for (let i = 0; i < 6; i++) {
    h.push(await p.$eval('.hero-type', e => Math.round(e.getBoundingClientRect().height)));
    await p.waitForTimeout(800);
  }
  ok('Qator balandligi o’zgarmaydi', new Set(h).size === 1, h.join(','));
  ok('Sahifada gorizontal chiqish yo’q',
    await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  ok('Konsolda xato yo’q', errs.length === 0, errs.join(' | '));
  await ctx.close();

  /* ============ 4. SOZLAMADAGI IBORALAR ============ */
  section('4. Sozlamada yozilgan iboralar saytda chiqadi');

  const login = await req('/api/login', { method: 'POST', body: { login: 'admin', password: PASS } });
  ok('Direktor kirdi', login.status === 200, 'status ' + login.status);

  const cur = await req('/api/doc?path=' + encodeURIComponent('meta/settings'));
  const st = (cur.data && cur.data.data) || {};
  const mine = ['Al-Azhar imtihoniga tayyorlov', 'Misrlik ustozlar bilan'];
  const saved = await req('/api/doc?path=' + encodeURIComponent('meta/settings'),
    { method: 'PUT', body: { data: Object.assign({}, st, { taglines: mine.join('\n') }) } });
  ok('Sozlama saqlandi', saved.status === 200, 'status ' + saved.status);

  const pub = await req('/api/public');
  const tl = (pub.data && pub.data.taglines) || [];
  ok('/api/public ikkita iborani berdi', tl.length === 2, JSON.stringify(tl));
  ok('Iboralar aynan o’sha', tl[0] === mine[0] && tl[1] === mine[1], JSON.stringify(tl));
  ok('Javobda maxfiy ma’lumot yo’q',
    !/parol|token|hash|salt|DATABASE|secret/i.test(JSON.stringify(pub.data || {})));

  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  p = await ctx.newPage();
  await p.goto(BASE + '/');
  await p.waitForSelector('#hero-type-txt');
  await p.waitForFunction(
    (w) => (document.getElementById('hero-type-txt').textContent || '').indexOf(w) === 0,
    'Al-Azhar', { timeout: 20000 });
  ok('Saytda mening iborasi chiqdi', true);
  const koringan = (await txtOf(p)).trim();
  ok('Standart ibora chiqmayapti', koringan.indexOf('Kichik guruhlar, aniq') !== 0, koringan);
  await ctx.close();

  /* ============ 5. BITTA IBORA ============ */
  section('5. Bitta ibora bo’lsa qotib turadi');
  await req('/api/doc?path=' + encodeURIComponent('meta/settings'),
    { method: 'PUT', body: { data: Object.assign({}, st, { taglines: 'Faqat bitta ibora' }) } });
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  p = await ctx.newPage();
  await p.goto(BASE + '/');
  await p.waitForSelector('#hero-type-txt');
  await p.waitForTimeout(1500);
  const bitta = (await txtOf(p)).trim();
  ok('Ibora to’liq turadi', bitta === 'Faqat bitta ibora', bitta);
  ok('Kursor yashirildi',
    await p.evaluate(() => {
      const c = document.querySelector('.hero-type-cur');
      return !c || getComputedStyle(c).display === 'none';
    }));
  await p.waitForTimeout(2500);
  ok('2.5 soniyadan keyin ham o’zgarmadi', (await txtOf(p)).trim() === 'Faqat bitta ibora');
  await ctx.close();

  /* ============ 6. HARAKAT KAMAYTIRILGAN REJIM ============ */
  section('6. “Harakatni kamaytirish” rejimi');
  await req('/api/doc?path=' + encodeURIComponent('meta/settings'),
    { method: 'PUT', body: { data: Object.assign({}, st, { taglines: mine.join('\n') }) } });
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  p = await ctx.newPage();
  await p.goto(BASE + '/');
  await p.waitForSelector('#hero-type-txt');
  await p.waitForTimeout(900);
  const rm1 = (await txtOf(p)).trim();
  ok('Darhol to’liq ibora ko’rinadi', rm1 === mine[0], rm1);
  ok('Kursor ko’rinmaydi',
    await p.evaluate(() => {
      const c = document.querySelector('.hero-type-cur');
      if (!c) return true;
      const s = getComputedStyle(c);
      return s.display === 'none' || Number(s.opacity) === 0;
    }));
  await ctx.close();

  /* ============ 7. TELEFON ============ */
  section('7. Telefonda');
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p = await ctx.newPage();
  await p.goto(BASE + '/');
  await p.waitForSelector('#hero-type-txt');
  await p.waitForTimeout(2600);
  ok('Telefonda ham yoziladi', (await txtOf(p)).trim().length > 5, await txtOf(p));
  ok('Telefonda gorizontal chiqish yo’q',
    await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await ctx.close();

  /* ============ YAKUN ============ */
  console.log(out.join('\n'));
  console.log('\n' + (fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') +
    ' — ' + pass + ' ta o\'tdi, ' + fail + ' ta xato');
  stop();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); stop(); process.exit(1); });
