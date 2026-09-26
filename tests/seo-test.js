/* QIDIRUV TIZIMLARI VA LOGOTIP.

   Tekshiriladi:
     1) brauzer yorlig'idagi logotip (favicon) haqiqatan ochiladi;
     2) sarlavha, tavsif, canonical va robots teglari joyida;
     3) havola ulashilganda chiqadigan kartochka (Open Graph) to'liq;
     4) qidiruv tizimi uchun tuzilgan ma'lumot (JSON-LD) to'g'ri va
        markazning HAQIQIY telefoni, manzili va ish vaqtini oladi;
     5) robots.txt va sitemap.xml beriladi (va yo'q bo'lsa sahifa emas,
        404 qaytadi);
     6) JavaScript o'chirilgan brauzerda ham asosiy matn ko'rinadi;
     7) sozlamada markaz nomi o'zgarsa, qidiruv ma'lumoti ham o'zgaradi.

   Sun'iy ma'lumot, alohida sinov serveri, faqat localhost.
     node tests/seo-test.js [port] [direktor paroli]                     */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT + '/';
const API = 'http://localhost:' + PORT;

let pass = 0, fail = 0;
const out = [];
function ok(n, c, e) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 180) : '')); } }
function eq(n, got, want) { ok(n, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function api(p, o = {}) {
  const res = await fetch(API + p, {
    method: o.method || 'GET',
    headers: Object.assign(o.body ? { 'Content-Type': 'application/json' } : {}, o.cookie ? { Cookie: o.cookie } : {}),
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, type: res.headers.get('content-type') || '' };
}

(async () => {
  const lg = await fetch(API + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'admin', password: PASS })
  });
  const dir = (lg.headers.get('set-cookie') || '').split(';')[0];
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  /* Markaz ma'lumotini sinov o'zi yozadi — bazada nima turgani muhim emas */
  const st = (await api('/api/doc?path=' + encodeURIComponent('meta/settings'), { cookie: dir })).json.data;
  const NAME = 'AlBayan Cairo';
  const ADDR = 'Toshkent, Yunusobod 4-mavze';
  const PHONE = '+998 55 588 20 28';
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir,
    body: {
      data: Object.assign({}, st, {
        centerName: NAME, phone: PHONE, address: ADDR,
        about: 'AlBayan Cairo — arab tilini noldan erkin suhbatgacha o’rgatadigan markaz.',
        workStart: '08:00', workEnd: '22:00',
        instagram: 'https://www.instagram.com/albayan.cairo/',
        tgChannel: '@albayanuz', tgQabul: '@Albayan_qabul1'
      })
    }
  });

  /* ================= 1. Logotip ================= */
  section('1. Logotip brauzer yorlig’ida');
  const htmlRes = await api('/');
  const html = htmlRes.text;
  eq('Bosh sahifa ochiladi', htmlRes.status, 200);
  const icons = [...html.matchAll(/<link[^>]+rel="(?:shortcut )?(?:icon|apple-touch-icon)"[^>]*>/gi)].map(m => m[0]);
  ok('Yorliq ikonkasi ulangan (' + icons.length + ' ta)', icons.length >= 4, html.slice(0, 200));
  const hrefs = icons.map(t => (t.match(/href="([^"]+)"/) || [])[1]).filter(Boolean);
  ok('favicon.ico ham bor', hrefs.some(h => /favicon\.ico/.test(h)), hrefs.join(' '));
  ok('32px va 16px ikonka bor',
    hrefs.some(h => /icon-32/.test(h)) && hrefs.some(h => /icon-16/.test(h)), hrefs.join(' '));
  ok('Apple uchun 180px ikonka bor', hrefs.some(h => /icon-180/.test(h)), hrefs.join(' '));
  /* Har bir ikonka haqiqatan ochilishi kerak */
  for (const href of [...new Set(hrefs)]) {
    const r = await api(href.replace(/^\//, '/'));
    ok('Ochiladi: ' + href + ' (' + r.status + ', ' + r.type.split(';')[0] + ')',
      r.status === 200 && /image\//.test(r.type), r.status + ' ' + r.type);
  }
  const man = await api('/manifest.webmanifest');
  ok('Telefon ekrani uchun ikonkalar manifestda',
    man.status === 200 && ((man.json || {}).icons || []).length >= 4,
    String(man.status));

  /* ================= 2. Sarlavha va tavsif ================= */
  section('2. Qidiruv natijasidagi sarlavha va tavsif');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  ok('Sarlavha bor: ' + title, title.length > 10 && title.length <= 65, title);
  ok('Sarlavhada markaz nomi va yo’nalishi bor',
    /albayan/i.test(title) && /arab tili/i.test(title), title);
  eq('Ikkita sarlavha yo’q', (html.match(/<title>/gi) || []).length, 1);
  /* Odam nimani qidirsa, sarlavhaning BOSHIDA shu tursin: Google
     sarlavhani kesganda ham asosiy so'z ko'rinib qoladi.            */
  ok('Sarlavha "arab tili kurslari" bilan boshlanadi',
    /^arab tili kurslari/i.test(title), title);
  ok('Sarlavhada shahar ko’rsatilgan', /toshkent/i.test(title), title);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
  /* Tavsif ixcham bo'lsin — Google ~160 belgidan keyin kesib tashlaydi */
  ok('Tavsif bor va ixcham (' + desc.length + ' belgi)',
    desc.length >= 90 && desc.length <= 170, desc);
  eq('Ikkita tavsif yo’q', (html.match(/name="description"/gi) || []).length, 1);
  ok('Tavsifda qidiruv so’zi bor', /arab tili kurslari/i.test(desc), desc);
  ok('Tavsifda darajalar bor', /A1/.test(desc) && /C2/.test(desc), desc);
  ok('Canonical havola bor', /<link rel="canonical" href="https?:\/\/[^"]+"/.test(html));
  eq('Canonical BITTA', (html.match(/rel="canonical"/gi) || []).length, 1);
  const canon = (html.match(/<link rel="canonical" href="([^"]*)"/i) || [])[1] || '';
  ok('Canonical da so’rov va # yo’q', canon.indexOf('?') < 0 && canon.indexOf('#') < 0, canon);
  ok('Canonical bosh sahifaga ishora qiladi', /\/$/.test(canon), canon);
  ok('Robots: indeksga ruxsat', /<meta name="robots" content="[^"]*index/.test(html),
    (html.match(/<meta name="robots"[^>]*>/) || [])[0]);
  ok('Sahifa tili ko’rsatilgan', /<html lang="uz"/.test(html));

  /* ================= 3. Ulashilgan havola kartochkasi ================= */
  section('3. Havola ulashilganda (Telegram, Facebook)');
  const og = {};
  [...html.matchAll(/<meta property="(og:[^"]+)" content="([^"]*)"/gi)].forEach(m => { og[m[1]] = m[2]; });
  ok('og:title bor', !!og['og:title'], JSON.stringify(og).slice(0, 120));
  ok('og:description bor', !!og['og:description']);
  ok('og:image logotipga ishora qiladi', /icon-512\.png$/.test(og['og:image'] || ''), og['og:image']);
  ok('og:url bor', /^https?:\/\//.test(og['og:url'] || ''), og['og:url']);
  eq('og:type — website', og['og:type'], 'website');
  const ogImg = await api((og['og:image'] || '').replace(/^https?:\/\/[^/]+/, ''));
  ok('og:image haqiqatan ochiladi', ogImg.status === 200 && /image\//.test(ogImg.type),
    ogImg.status + ' ' + ogImg.type);
  ok('Twitter kartochkasi ham bor', /<meta name="twitter:card"/.test(html));

  /* ================= 4. Tuzilgan ma'lumot (JSON-LD) ================= */
  section('4. Google uchun tuzilgan ma’lumot');
  const ldRaw = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  ok('JSON-LD yozuvi bor', !!ldRaw);
  let ld = null;
  try { ld = JSON.parse(String(ldRaw).replace(/\\u003c/g, '<')); } catch (e) { }
  ok('JSON-LD to’g’ri yozilgan', !!ld && Array.isArray(ld['@graph']), String(ldRaw).slice(0, 120));
  if (ld && ld['@graph']) {
    const types = ld['@graph'].map(x => [].concat(x['@type']).join('+'));
    ok('Markaz, sayt va kurs tavsiflangan (' + types.join(', ') + ')',
      types.some(t => /LocalBusiness/.test(t)) && types.indexOf('WebSite') >= 0 &&
      types.indexOf('Course') >= 0, types.join(', '));
    const org = ld['@graph'].find(x => /LocalBusiness/.test([].concat(x['@type']).join('+')));
    eq('Nomi sozlamadan olindi', org.name, NAME);
    eq('Telefoni sozlamadan olindi', org.telephone, PHONE);
    ok('Manzili sozlamadan olindi', (org.address || {}).streetAddress === ADDR,
      JSON.stringify(org.address));
    ok('Logotip ko’rsatilgan', /icon-512\.png$/.test(((org.logo || {}).url) || ''),
      JSON.stringify(org.logo));
    ok('Ish vaqti ko’rsatilgan',
      ((org.openingHoursSpecification || {}).opens) === '08:00', JSON.stringify(org.openingHoursSpecification));
    ok('Instagram va Telegram havolalari bor',
      (org.sameAs || []).some(u => /instagram/.test(u)) && (org.sameAs || []).some(u => /t\.me/.test(u)),
      JSON.stringify(org.sameAs));
    ok('Boshqa nomlari ham yozilgan ("bayan" deb qidirilganda)',
      (org.alternateName || []).some(n => /bayan/i.test(n)), JSON.stringify(org.alternateName));
    ok('Arabcha nomi ham bor', (org.alternateName || []).some(n => /[؀-ۿ]/.test(n)),
      JSON.stringify(org.alternateName));

    /* --- Google qidiruvdagi SAYT NOMI shu yozuvdan olinadi --- */
    const site = ld['@graph'].find(x => x['@type'] === 'WebSite');
    ok('WebSite yozuvi bor', !!site);
    if (site) {
      eq('Sayt nomi — sozlamadagi nom', site.name, NAME);
      ok('Sayt nomida "AlBayan" bor', /albayan/i.test(site.name || ''), site.name);
      ok('Sayt manzili ko’rsatilgan', /^https?:\/\/[^/]+\/$/.test(site.url || ''), site.url);
      ok('Zaxira nomlar ham bor', (site.alternateName || []).length >= 3,
        JSON.stringify(site.alternateName));
      /* Nom har joyda BIR XIL bo'lsin — Google ziddiyat ko'rmasin */
      const ogName = (html.match(/<meta property="og:site_name" content="([^"]*)"/i) || [])[1];
      eq('og:site_name ham o’sha nom', ogName, site.name);
      ok('Sarlavhada ham o’sha nom', title.indexOf(site.name) >= 0, title);
    }
    /* Kurs yozuvi "arab tili" so'roviga bog'lansin */
    const course = ld['@graph'].find(x => x['@type'] === 'Course');
    ok('Kurs "arab tili" ni o’rgatadi', /arab tili/i.test((course || {}).teaches || ''),
      JSON.stringify((course || {}).teaches));
    ok('Kurs nomida "arab tili kurslari" bor',
      /arab tili kurslari/i.test((course || {}).name || ''), (course || {}).name);

    /* --- ERP ma'lumoti tuzilgan ma'lumotga CHIQMASLIGI kerak --- */
    const ldTxt = JSON.stringify(ld);
    ok('Tuzilgan ma’lumotda o’quvchi yo’q',
      !/"studentId"|st_[a-z0-9]{4,}|usr_[a-z0-9]{3,}/i.test(ldTxt));
    ok('Tuzilgan ma’lumotda ERP manzili yo’q',
      !/#(students?|finance|staff|dashboard|kabinet|groups?)\b/.test(ldTxt));
  }

  /* ================= 5. robots.txt va sitemap.xml ================= */
  section('5. robots.txt va sitemap.xml');
  const rb = await api('/robots.txt');
  eq('robots.txt beriladi', rb.status, 200);
  ok('Turi matn', /text\/plain/.test(rb.type), rb.type);
  ok('Indeksga ruxsat berilgan', /Allow:\s*\//.test(rb.text), rb.text.slice(0, 120));
  ok('Ichki API yopilgan', /Disallow:\s*\/api\//.test(rb.text), rb.text.slice(0, 120));
  ok('Sitemap ko’rsatilgan', /Sitemap:\s*https?:\/\//.test(rb.text), rb.text.slice(0, 160));
  /* Google sahifani CHIZIB ko'radi — css/js yopilgan bo'lsa, unga
     sayt bo'm-bo'sh ko'rinadi. Shuning uchun ular ochiq bo'lishi shart. */
  ok('css ochiq qoldirilgan', !/Disallow:\s*\/css\//.test(rb.text), rb.text);
  ok('js ochiq qoldirilgan', !/Disallow:\s*\/js\//.test(rb.text), rb.text);
  ok('rasm papkasi ochiq', !/Disallow:\s*\/assets\//.test(rb.text), rb.text);
  ok('Hamma robot uchun yozilgan', /User-agent:\s*\*/.test(rb.text), rb.text.slice(0, 80));

  const sm = await api('/sitemap.xml');
  eq('sitemap.xml beriladi', sm.status, 200);
  ok('Turi XML', /xml/.test(sm.type), sm.type);
  ok('Bosh sahifa ro’yxatda', /<loc>https?:\/\/[^<]+<\/loc>/.test(sm.text), sm.text.slice(0, 160));
  ok('XML e’loni bor', /^<\?xml version="1\.0"/.test(sm.text.trim()), sm.text.slice(0, 60));
  ok('To’g’ri urlset nomlar fazosi',
    /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(sm.text), sm.text.slice(0, 200));
  ok('XML yopilgan (buzilmagan)', /<\/urlset>\s*$/.test(sm.text.trim()), sm.text.slice(-80));
  /* XML haqiqatan o'qiladimi — brauzerning o'z tahlilchisi bilan */
  const xmlBrowser = await chromium.launch();
  const xmlPage = await (await xmlBrowser.newContext()).newPage();
  const xmlOk = await xmlPage.evaluate(txt => {
    const d = new DOMParser().parseFromString(txt, 'application/xml');
    return {
      err: !!d.querySelector('parsererror'),
      locs: Array.from(d.getElementsByTagName('loc')).map(n => n.textContent)
    };
  }, sm.text).catch(e => ({ err: true, locs: [], why: String(e) }));
  await xmlBrowser.close();
  ok('XML tahlilchidan o’tdi (xato yo’q)', !!xmlOk && !xmlOk.err, JSON.stringify(xmlOk));
  const locs = (xmlOk && xmlOk.locs) || [];
  ok('Kamida bitta manzil bor', locs.length >= 1, JSON.stringify(locs));
  /* MUHIM: xaritada ERP yoki # li manzil bo'lmasin */
  ok('Xaritada # li manzil yo’q', !locs.some(u => u.indexOf('#') >= 0), JSON.stringify(locs));
  ok('Xaritada ERP manzili yo’q',
    !locs.some(u => /(students?|finance|staff|dashboard|kabinet|groups?|progress|reports|chat|tasks|bot|settings)/i.test(u)),
    JSON.stringify(locs));
  ok('Xaritada /api/ yo’q', !locs.some(u => u.indexOf('/api/') >= 0), JSON.stringify(locs));
  ok('Xaritadagi manzillar haqiqiy (so’rovsiz)',
    locs.every(u => /^https?:\/\/[^?#]+$/.test(u)), JSON.stringify(locs));
  /* Xaritadagi manzil canonical bilan bir xil bo'lsin */
  ok('Xaritadagi manzil canonical bilan bir xil',
    locs.some(u => u.replace(/^https?:\/\/[^/]+/, '') === canon.replace(/^https?:\/\/[^/]+/, '')),
    JSON.stringify(locs) + ' | ' + canon);
  /* Xaritadagi manzil haqiqatan ochiladimi */
  for (const u of locs.slice(0, 5)) {
    const r = await api(u.replace(/^https?:\/\/[^/]+/, '') || '/');
    ok('Xaritadagi manzil ochiladi: ' + u, r.status === 200, String(r.status));
  }

  /* --- Logotip Google uchun ochiqmi (qidiruvda favicon shundan chiqadi) --- */
  section('5b. Logotip va favicon qidiruv uchun ochiq');
  const iconLinks = [...html.matchAll(/<link rel="(?:apple-touch-)?icon"[^>]*href="([^"]+)"/gi)]
    .map(m => m[1]);
  ok('Sahifada logotip havolalari bor (' + iconLinks.length + ' ta)', iconLinks.length >= 3,
    JSON.stringify(iconLinks));
  for (const u of iconLinks) {
    const r = await api(u.replace(/^https?:\/\/[^/]+/, ''));
    ok('Ochiladi: ' + u, r.status === 200 && /image\//.test(r.type), r.status + ' ' + r.type);
  }
  /* Favicon robots.txt bilan yopilgan bo'lmasin */
  ok('favicon robots.txt da yopilmagan', !/Disallow:\s*\/favicon/.test(rb.text), rb.text);
  /* Tuzilgan ma'lumotdagi logotip ham haqiqatan ochiladi */
  if (ld && ld['@graph']) {
    const o = ld['@graph'].find(x => /LocalBusiness/.test([].concat(x['@type']).join('+'))) || {};
    const lu = ((o.logo || {}).url) || '';
    const lr = await api(lu.replace(/^https?:\/\/[^/]+/, ''));
    ok('Tuzilgan ma’lumotdagi logotip ochiladi', lr.status === 200 && /image\//.test(lr.type),
      lu + ' → ' + lr.status);
  }
  /* Bo'lmagan fayl o'rniga sahifa berilmasligi kerak */
  const miss = await api('/yoq-bunday-fayl.txt');
  ok('Bo’lmagan .txt o’rniga sahifa berilmaydi',
    miss.status === 404 || !/<!doctype html/i.test(miss.text), miss.status + ' ' + miss.text.slice(0, 60));

  /* ================= 6. JavaScriptsiz ko'rinish ================= */
  section('6. JavaScript o’chirilgan brauzerda');
  ok('noscript bloki bor', /<noscript>/.test(html));
  const ns = (html.match(/<noscript>([\s\S]*?)<\/noscript>/) || [])[1] || '';
  ok('Sarlavha bor', /<h1>/.test(ns), ns.slice(0, 120));
  ok('Darajalar ro’yxati bor', /A1/.test(ns) && /C2/.test(ns), ns.slice(0, 200));
  ok('Arab tili haqida yozilgan', /arab tili/i.test(ns), ns.slice(0, 200));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE);
  const noJs = await page.evaluate(() => document.body.innerText).catch(() => '');
  ok('JavaScriptsiz ham matn ko’rinadi', /arab tili/i.test(noJs), noJs.slice(0, 160));
  await ctx.close();

  /* ================= 7. Sozlama o'zgarsa — ma'lumot ham ================= */
  section('7. Sozlama o’zgarsa qidiruv ma’lumoti ham o’zgaradi');
  const NAME2 = 'AlBayan Cairo — Taxtapul';
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir,
    body: { data: Object.assign({}, st, { centerName: NAME2, phone: PHONE, address: ADDR, workStart: '08:00', workEnd: '22:00' }) }
  });
  /* Server ma'lumotni bir daqiqa eslab turadi — yangisini kutamiz */
  let seen = '';
  for (let i = 0; i < 14; i++) {
    const h2 = (await api('/')).text;
    const raw = (h2.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
    try {
      const g = JSON.parse(String(raw).replace(/\\u003c/g, '<'))['@graph'];
      seen = (g.find(x => /LocalBusiness/.test([].concat(x['@type']).join('+'))) || {}).name || '';
    } catch (e) { }
    if (seen === NAME2) break;
    await new Promise(r => setTimeout(r, 5000));
  }
  eq('Yangi nom qidiruv ma’lumotiga tushdi', seen, NAME2);

  /* Sozlamani joyiga qaytaramiz */
  await api('/api/doc?path=' + encodeURIComponent('meta/settings'), {
    method: 'PUT', cookie: dir, body: { data: st }
  });

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: bu sinov teglar va fayllar to’g’ri berilayotganini tekshiradi.');
  console.log('Qidiruvdagi o’rin (reyting) kodga emas, Google’ning o’z qaroriga bog’liq —');
  console.log('uni hech bir sinov kafolatlay olmaydi.');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
