/* Yangi versiya ESKI brauzerga yetib boradimi?
   Toza brauzerda sinash yetarli emas — shuning uchun bu yerda:
     1) ESKI versiya chiqariladi, brauzer uni ochadi, xizmat ishchisi va kesh hosil bo'ladi;
     2) o'sha manzilga YANGI versiya qo'yiladi (haqiqiy "deploy" kabi);
     3) o'sha brauzer profilida sahifa o'zi yangilanishi tekshiriladi;
     4) yangi menyu ishlashi o'lchanadi.
   Ishga tushirish:  node tests/sw-update-test.js                            */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Kichik statik server ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.json': 'application/json; charset=utf-8'
};
function serve(dir) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('yo’q'); return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'          // brauzer keshi emas, xizmat ishchisi sinovda
    });
    res.end(fs.readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function copyApp(to) {
  fs.mkdirSync(to, { recursive: true });
  for (const rel of ['index.html', 'sw.js', 'manifest.webmanifest']) {
    if (fs.existsSync(path.join(ROOT, rel))) fs.copyFileSync(path.join(ROOT, rel), path.join(to, rel));
  }
  for (const dir of ['js', 'css', 'assets']) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.join(to, dir), { recursive: true });
    for (const n of fs.readdirSync(src)) {
      const f = path.join(src, n);
      if (fs.statSync(f).isFile()) fs.copyFileSync(f, path.join(to, dir, n));
    }
  }
}

/** ESKI versiyani yasash: menyu tuzatilishidan oldingi holat (ikonka o'lchamsiz) */
function makeOld(dir) {
  const cssPath = path.join(dir, 'css', 'app.css');
  let css = fs.readFileSync(cssPath, 'utf8');
  css = css.replace(/\/\* -+ Telefondagi "Menyu"[\s\S]*?\/\* -+ Ro'yxat elementlari/,
    '/* ---------- Ro\'yxat elementlari');
  fs.writeFileSync(cssPath, css);

  const appPath = path.join(dir, 'js', 'app.js');
  let app = fs.readFileSync(appPath, 'utf8');
  app = app.replace("class: 'menu-sheet' }", "class: 'list' }")
    .replace("class: 'menu-item', type: 'button',",
      "class: 'list-item', type: 'button', style: 'width:100%;background:none;border:0;border-bottom:1px solid var(--line)',");
  fs.writeFileSync(appPath, app);

  // versiyani shu fayllar mazmunidan qayta hisoblaymiz (build.js dagi qoida)
  const files = ['index.html', 'manifest.webmanifest']
    .concat(fs.readdirSync(path.join(dir, 'css')).sort().map(n => 'css/' + n))
    .concat(fs.readdirSync(path.join(dir, 'js')).sort().map(n => 'js/' + n));
  const hash = crypto.createHash('sha256');
  files.forEach(rel => {
    const f = path.join(dir, rel);
    if (!fs.existsSync(f)) return;
    hash.update(rel + '\0'); hash.update(fs.readFileSync(f));
  });
  const ver = 'albayan-' + hash.digest('hex').slice(0, 12);
  const swPath = path.join(dir, 'sw.js');
  fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8')
    .replace(/const VERSION = '[^']*';/, "const VERSION = '" + ver + "';"));
  const idx = path.join(dir, 'index.html');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8')
    .replace(/<meta name="app-version" content="[^"]*">/, '<meta name="app-version" content="' + ver + '">'));
  return ver;
}

async function loginAndOpenMenu(page) {
  // ilova yuklanib bo'lsin: yo kirish oynasi, yo ichki ekran
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    const inp = document.getElementById('login-user');
    return (app && !app.hasAttribute('hidden')) || (inp && inp.offsetParent !== null);
  }, null, { timeout: 25000 });
  // allaqachon kirgan bo'lsa qayta kirmaymiz
  const logged = await page.evaluate(() => {
    const app = document.getElementById('app');
    return !!app && !app.hasAttribute('hidden');
  }).catch(() => false);
  if (!logged) {
    await page.waitForSelector('#login-user', { state: 'visible', timeout: 20000 });
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', '1234');
    await page.click('button[type=submit]');
  }
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const b = document.querySelectorAll('.tabbar button');
    b[b.length - 1].click();
  });
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.modal .menu-item, .modal .list-item'));
    if (!items.length) return { count: 0 };
    const first = items[0];
    const ic = first.querySelector('svg');
    return {
      count: items.length,
      icoW: ic ? Math.round(ic.getBoundingClientRect().width) : 0,
      rowH: Math.round(first.getBoundingClientRect().height),
      minRow: Math.min.apply(null, items.map(i => Math.round(i.getBoundingClientRect().height))),
      maxIco: Math.max.apply(null, items.map(i => {
        const s = i.querySelector('svg');
        return s ? Math.round(s.getBoundingClientRect().width) : 0;
      }))
    };
  });
}
/** Sahifa o'zi qayta yuklanayotgan paytda ham ishlaydigan kutish.
    page.waitForFunction navigatsiya vaqtida uzilib qolishi mumkin —
    bu yerda har safar yangi kontekstda qayta so'raymiz.            */
async function waitFor(page, fn, arg, ms, note) {
  const until = Date.now() + (ms || 20000);
  let tries = 0, lastErr = '';
  while (Date.now() < until) {
    tries++;
    /* Navigatsiya paytida page.evaluate uzoq muddat osilib qolishi mumkin —
       shuning uchun har bir urinishga qisqa muhlat beramiz.               */
    const attempt = page.evaluate(fn, arg).catch(e => {
      lastErr = String(e.message || e).split('\n')[0]; return false;
    });
    const res = await Promise.race([attempt, sleep(1500).then(() => null)]);
    if (res === true) return true;
    if (res === null) lastErr = 'javob bermadi (navigatsiya)';
    await sleep(250);
  }
  if (note) { note.tries = tries; note.lastErr = lastErr; }
  return false;
}
async function closeMenu(page) {
  await page.evaluate(() => { const x = document.querySelector('.modal .x-btn'); if (x) x.click(); });
  await page.waitForTimeout(250);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-sw-'));
  const site = path.join(tmp, 'site');

  /* ---------- 1. ESKI versiyani chiqaramiz ---------- */
  section('1. Eski versiya brauzerda ochiladi va keshga tushadi');
  copyApp(site);
  const oldVer = makeOld(site);
  const server = await serve(site);
  const BASE = 'http://127.0.0.1:' + server.address().port + '/';
  out.push('    Eski versiya: ' + oldVer);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  /* Sinov faqat o'z serverimizga tegsin: shrift va CDN so'rovlari tarmoqni
     kutib turmasin. Bu telefonda internet sekin bo'lgan holatga ham yaqin. */
  await ctx.route(url => url.hostname !== '127.0.0.1', r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; out.push('  ✗ JS xatosi: ' + e.message); });
  await page.goto(BASE);
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== undefined, null, { timeout: 20000 });
  // xizmat ishchisi boshqaruvni olsin
  for (let i = 0; i < 40; i++) {
    const has = await page.evaluate(() => !!navigator.serviceWorker.controller);
    if (has) break;
    await sleep(250);
    if (i === 8) await page.reload();
  }
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  ok('Xizmat ishchisi boshqaruvni oldi', controlled);
  const cacheNames1 = await page.evaluate(() => caches.keys());
  ok('Eski versiya keshi yaratildi', cacheNames1.indexOf(oldVer) >= 0, cacheNames1.join(', '));

  const oldMenu = await loginAndOpenMenu(page);
  ok('Eski menyu ochildi', oldMenu.count > 0, JSON.stringify(oldMenu));
  ok('Eski menyuda ikonka katta (xato takrorlandi: ' + oldMenu.maxIco + ' px)',
    oldMenu.maxIco > 100, JSON.stringify(oldMenu));
  await page.screenshot({ path: path.join(SHOTS, 'yangilanish-1-eski.png') });
  await closeMenu(page);

  /* ---------- 2. Yangi versiyani "deploy" qilamiz ---------- */
  section('2. Serverga yangi versiya qo’yiladi');
  copyApp(site);                                   // haqiqiy (tuzatilgan) fayllar
  const newVer = (fs.readFileSync(path.join(site, 'sw.js'), 'utf8')
    .match(/const VERSION = '([^']*)';/) || [])[1];
  out.push('    Yangi versiya: ' + newVer);
  ok('Versiya o’zgardi', !!newVer && newVer !== oldVer, oldVer + ' → ' + newVer);

  /* ---------- 3. Eski profil avtomatik yangilanadimi ---------- */
  section('3. Eski brauzer profilida yangi versiya avtomatik ochiladi');
  /* Sahifa shu vaqtda O'ZI qayta yuklanadi (hech kim tugma bosmaydi).
     Shuning uchun avval "load" hodisasiga quloq solamiz, keyin yangilanishni
     boshlaymiz: aks holda tekshiruv navigatsiyaga urilib qoladi.          */
  let navs = 0;
  const onNav = () => { navs++; };
  page.on('framenavigated', onNav);
  const t0 = Date.now();
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update()))
    .catch(() => { /* shu payt sahifa yangilanib ketgan bo'lishi mumkin */ });
  const note = {};
  const gotVersion = await waitFor(page, ver =>
    (document.querySelector('meta[name="app-version"]') || {}).content === ver, newVer, 60000, note);
  const took = Date.now() - t0;
  page.off('framenavigated', onNav);
  note.navs = navs; note.ms = took;
  ok('Sahifa o’zi qayta yuklandi (hech kim tugma bosmadi)', navs > 0, JSON.stringify(note));
  ok('Yangi versiya o’zi ochildi', gotVersion,
    'meta app-version ' + newVer + ' bo’lmadi; ' + JSON.stringify(note));
  /* Xizmat ishchisi activate ichida client.navigate() ni KUTMASLIGI kerak:
     kutsa, faollashuv navigatsiyani kutadi va yangilanish brauzer muhlati
     tugaguncha (~40 s) cho'ziladi. Foydalanuvchi buni "sayt qotdi" deb biladi. */
  ok('Yangilanish darhol bo’ldi (' + Math.round(took / 1000) + ' s)', gotVersion && took < 15000,
    JSON.stringify(note));
  ok('Yangilash tugmasi ko’rinmadi', !await page.locator('#pwa-bar').count());

  /* ---------- 4. Yangi interfeys ---------- */
  section('4. Avtomatik yangilanishdan keyin');
  const nowVer = await page.evaluate(() =>
    (document.querySelector('meta[name="app-version"]') || {}).content || '');
  eq('Sahifa yangi versiyada', nowVer, newVer);

  const newMenu = await loginAndOpenMenu(page);
  ok('Yangi menyu ochildi', newMenu.count > 0, JSON.stringify(newMenu));
  ok('Ikonka 22–24 px (' + newMenu.maxIco + ')', newMenu.maxIco > 0 && newMenu.maxIco <= 26, JSON.stringify(newMenu));
  ok('Qator kamida 48 px (' + newMenu.minRow + ')', newMenu.minRow >= 48, JSON.stringify(newMenu));
  await page.screenshot({ path: path.join(SHOTS, 'yangilanish-3-yangi.png') });
  await closeMenu(page);

  const cacheNames2 = await page.evaluate(() => caches.keys());
  ok('Eski kesh o’chirildi', cacheNames2.indexOf(oldVer) < 0, cacheNames2.join(', '));
  ok('Faqat shu ilova keshi qoldi',
    cacheNames2.length === 1 && cacheNames2[0] === newVer, cacheNames2.join(', '));

  /* ---------- 5. Boshqa kenglliklarda o'lcham ---------- */
  section('5. 360 / 390 / 430 px da o’lcham (yangilangan profilda)');
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.reload();
    const m = await loginAndOpenMenu(page);
    ok(w + ' px: ikonka ' + m.maxIco + ' px', m.maxIco > 0 && m.maxIco <= 26, JSON.stringify(m));
    ok(w + ' px: qator ' + m.minRow + ' px', m.minRow >= 48, JSON.stringify(m));
    await page.screenshot({ path: path.join(SHOTS, 'yangilanish-menyu-' + w + '.png') });
    await closeMenu(page);
  }

  /* ---------- 6. /api/ keshlanmaydi ---------- */
  section('6. /api/ javoblari keshlanmaydi');
  await page.evaluate(() => fetch('api/health').catch(() => { }));
  await sleep(500);
  const apiCached = await page.evaluate(async () => {
    const names = await caches.keys();
    for (const n of names) {
      const c = await caches.open(n);
      const keys = await c.keys();
      if (keys.some(r => r.url.indexOf('/api/') >= 0)) return true;
    }
    return false;
  });
  ok('Keshda /api/ javobi yo’q', apiCached === false);

  await ctx.close();
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(out.join('\n'));
  console.log('\nScreenshotlar:');
  ['yangilanish-1-eski.png', 'yangilanish-2-taklif.png', 'yangilanish-3-yangi.png',
    'yangilanish-menyu-360.png', 'yangilanish-menyu-390.png', 'yangilanish-menyu-430.png']
    .forEach(f => console.log('  ' + path.join(SHOTS, f)));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: Chromium (ish stoli) bilan o’lchandi — haqiqiy telefon emas.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
