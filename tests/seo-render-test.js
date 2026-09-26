'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seo = require('../server/seo');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const rendered = seo.render(html, {
  centerName: 'Al Bayan Cairo', phone: '+998 55 588 20 28',
  address: 'Toshkent, Taxtapul Darvoza ko‘chasi, 336',
  instagram: 'https://www.instagram.com/albayan.cairo/',
  workStart: '08:00', workEnd: '22:00',
  tgChannel: '@albayanuz', tgQabul2: '@albayantinchlik'
}, 'example.uz');

/* Telegram havolalari ham yozuvga tushadi */
assert.match(rendered, /https:\/\/t\.me\/albayanuz/);
assert.match(rendered, /https:\/\/t\.me\/albayantinchlik/);
/* Yaroqsiz Telegram nomi tushmaydi */
assert.doesNotMatch(seo.render(html, { tgChannel: 'javascript:alert(1)' }, 'example.uz'), /javascript:/);

assert.match(rendered, /<h1>Al Bayan Cairo — Toshkentda arab tili kurslari<\/h1>/);
/* Sarlavha: qidiruv so'zi oldinda, nom oxirida; 65 belgidan oshmaydi */
const t1 = (rendered.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
assert.match(t1, /^Arab tili kurslari Toshkentda \| Al Bayan Cairo$/);
assert.ok(t1.length <= 65, 'sarlavha juda uzun: ' + t1.length);
/* Tavsif ixcham va faqat bitta */
const d1 = (rendered.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
assert.ok(d1.length >= 90 && d1.length <= 170, 'tavsif uzunligi: ' + d1.length);
assert.equal((rendered.match(/name="description"/g) || []).length, 1);
assert.equal((rendered.match(/rel="canonical"/g) || []).length, 1);
assert.equal((rendered.match(/<title>/g) || []).length, 1);
assert.equal((rendered.match(/property="og:site_name"/g) || []).length, 1);
assert.equal((rendered.match(/application\/ld\+json/g) || []).length, 1);
/* Sayt nomi: WebSite yozuvi, og:site_name va sarlavha — bir xil nom */
const ld1 = JSON.parse(
  (rendered.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]
    .replace(/\\u003c/g, '<'));
const web1 = ld1['@graph'].find(x => x['@type'] === 'WebSite');
assert.equal(web1.name, 'Al Bayan Cairo');
assert.ok(web1.alternateName.length >= 3);
assert.match(rendered, /<meta property="og:site_name" content="Al Bayan Cairo">/);

/* ---- robots.txt ---- */
const rb1 = seo.robots('localhost:3300');
assert.match(rb1, /User-agent: \*/);
assert.match(rb1, /Disallow: \/api\//);
assert.match(rb1, /Sitemap: http:\/\/localhost:3300\/sitemap\.xml/);
assert.doesNotMatch(rb1, /Disallow: \/css\//);
assert.doesNotMatch(rb1, /Disallow: \/js\//);
assert.doesNotMatch(rb1, /Disallow: \/assets\//);
/* Butun saytni yopib qo'ymaymiz */
assert.doesNotMatch(rb1, /Disallow: \/\s*$/m);

/* ---- sitemap.xml ---- */
const sm1 = seo.sitemap('localhost:3300');
assert.match(sm1, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
assert.match(sm1, /<loc>http:\/\/localhost:3300\/<\/loc>/);
assert.match(sm1, /<\/urlset>/);
assert.doesNotMatch(sm1, /#/);            // # li manzil yo'q
assert.doesNotMatch(sm1, /\/api\//);
assert.doesNotMatch(sm1, /student|finance|staff|dashboard|kabinet/i);
assert.equal((sm1.match(/<loc>/g) || []).length, 1);

/* ---- SITE_URL: o'z domeningiz qo'yilganda hamma narsa unga o'tadi ---- */
{
  const old = process.env.SITE_URL;
  process.env.SITE_URL = 'https://albayancairo.uz/qandaydir/yo-l?x=1#z';
  assert.equal(seo.origin('eski.onrender.com'), 'https://albayancairo.uz');
  assert.match(seo.robots('eski.onrender.com'), /Sitemap: https:\/\/albayancairo\.uz\/sitemap\.xml/);
  assert.match(seo.sitemap('eski.onrender.com'), /<loc>https:\/\/albayancairo\.uz\/<\/loc>/);
  assert.match(seo.render(html, {}, 'eski.onrender.com'),
    /<link rel="canonical" href="https:\/\/albayancairo\.uz\/">/);
  /* Noto'g'ri yozilgan SITE_URL e'tiborga olinmaydi — sayt buzilmaydi */
  process.env.SITE_URL = 'shunchaki-matn';
  assert.equal(seo.origin('localhost:3300'), 'http://localhost:3300');
  process.env.SITE_URL = 'javascript:alert(1)';
  assert.equal(seo.origin('localhost:3300'), 'http://localhost:3300');
  if (old == null) delete process.env.SITE_URL; else process.env.SITE_URL = old;
}

/* ---- XAVFSIZLIK: begona Host bilan "canonical zaharlash" ----
   Topilgan xato: Host sarlavhasini mijoz o'zi yozadi. Ilgari u
   to'g'ridan-to'g'ri robots.txt, sitemap.xml va canonical ichiga
   tushardi — ya'ni "Host: zararli.example.com" deb so'rov yuborgan
   odam bizning serverimizdan Google ga o'z saytini ko'rsatib
   olardi. Endi Host faqat mahalliy ishlashda ta'sir qiladi.      */
{
  const old = process.env.SITE_URL;
  delete process.env.SITE_URL;
  const yot = ['zararli.example.com', 'evil.uz', 'google.com', 'albayan.attacker.net'];
  for (const bad of yot) {
    assert.equal(seo.origin(bad), 'https://albayan-oquv-markz-erp.onrender.com',
      'begona host o‘tib ketdi: ' + bad);
    assert.doesNotMatch(seo.robots(bad), new RegExp(bad.replace(/\./g, '\\.')));
    assert.doesNotMatch(seo.sitemap(bad), new RegExp(bad.replace(/\./g, '\\.')));
    assert.doesNotMatch(seo.render(html, {}, bad), new RegExp('canonical[^>]*' + bad.replace(/\./g, '\\.')));
  }
  /* Mahalliy ishlash esa ishlashda davom etadi */
  assert.equal(seo.origin('localhost:3300'), 'http://localhost:3300');
  assert.equal(seo.origin('127.0.0.1:3300'), 'http://127.0.0.1:3300');
  /* Render o'zi bergan manzil ham qabul qilinadi */
  process.env.RENDER_EXTERNAL_URL = 'https://albayan-oquv-markz-erp.onrender.com';
  assert.equal(seo.origin('zararli.example.com'), 'https://albayan-oquv-markz-erp.onrender.com');
  delete process.env.RENDER_EXTERNAL_URL;
  if (old != null) process.env.SITE_URL = old;
}
/* Begona Host e'tiborga olinmaydi — canonical standart manzilda qoladi */
assert.match(rendered, /<link rel="canonical" href="https:\/\/albayan-oquv-markz-erp\.onrender\.com\/">/);
assert.match(rendered, /Taxtapul Darvoza/);
assert.match(rendered, /tel:\+998555882028/);
assert.match(rendered, /"EducationalOrganization"/);
assert.doesNotMatch(rendered, /<meta name="description" content="[^"]*boshqaruv tizimi/);
assert.match(rendered, /<div id="boot" class="screen" hidden>/);
/* Logotip va boyitilgan yozuv ham bo'lishi kerak */
assert.match(rendered, /rel="icon"[^>]*icon-32\.png/);
assert.match(rendered, /"alternateName":\[[^\]]*"AlBayan"/);
assert.match(rendered, /"openingHoursSpecification"/);
assert.match(rendered, /"@type":"Course"/);
assert.match(rendered, /icon-512\.png/);

const hostile = seo.render(html, {
  centerName: '<script>alert(1)</script>',
  instagram: 'javascript:alert(1)'
}, 'bad.example.com"><script>alert(1)</script>');
assert.doesNotMatch(hostile, /<script>alert\(1\)<\/script>/);
assert.doesNotMatch(hostile, /href="javascript:/);
assert.match(hostile, /https:\/\/albayan-oquv-markz-erp\.onrender\.com/);

console.log('✓ SEO HTML, tuzilgan ma\u2019lumot va xavfsiz matn sinovlari o\u2019tdi.');
