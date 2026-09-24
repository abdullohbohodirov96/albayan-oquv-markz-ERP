'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seo = require('../server/seo');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const rendered = seo.render(html, {
  centerName: 'Al Bayan Cairo', phone: '+998 55 588 20 28',
  address: 'Toshkent, Taxtapul Darvoza ko‘chasi, 336',
  instagram: 'https://www.instagram.com/albayan.cairo/'
}, 'example.uz');

assert.match(rendered, /<h1>Al Bayan Cairo — Toshkentda arab tili kurslari<\/h1>/);
assert.match(rendered, /<link rel="canonical" href="https:\/\/example\.uz\/">/);
assert.match(rendered, /Taxtapul Darvoza/);
assert.match(rendered, /tel:\+998555882028/);
assert.match(rendered, /"@type":"EducationalOrganization"/);
assert.doesNotMatch(rendered, /<meta name="description" content="[^"]*boshqaruv tizimi/);
assert.doesNotMatch(rendered, /Tizim yuklanmoqda/);
assert.match(rendered, /<div id="boot" class="screen" hidden>/);

const hostile = seo.render(html, {
  centerName: '<script>alert(1)</script>',
  instagram: 'javascript:alert(1)'
}, 'bad.example.com"><script>alert(1)</script>');
assert.doesNotMatch(hostile, /<script>alert\(1\)<\/script>/);
assert.doesNotMatch(hostile, /href="javascript:/);
assert.match(hostile, /https:\/\/albayan-oquv-markz-erp\.onrender\.com/);

console.log('SEO HTML va xavfsiz matn sinovlari o‘tdi.');
