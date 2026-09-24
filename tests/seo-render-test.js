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
assert.match(rendered, /<link rel="canonical" href="https:\/\/example\.uz\/">/);
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
