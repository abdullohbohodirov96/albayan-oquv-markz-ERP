/* index.html ni artifact.html dan hosil qiladi.
   artifact.html — Claude Artifact uchun (u o'zi <html>/<head> qo'shadi).
   index.html   — oddiy brauzer, server yoki hosting uchun to'liq hujjat.
   Ishga tushirish:  node build.js                                        */
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'artifact.html'), 'utf8');

// <title>, <link> va <style> teglarini <head> ga ko'chiramiz
const headTags = [];
const body = src.replace(/^[\s\S]*?(?=<div id="boot")/, function (top) {
  top.replace(/<title>[\s\S]*?<\/title>|<style>[\s\S]*?<\/style>|<(?:link|meta)\b[^>]*>/gi, function (tag) {
    headTags.push('  ' + tag.trim());
    return '';
  });
  return '';
});

const head = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="AlBayan Cairo o'quv markazi boshqaruv tizimi">
<meta name="theme-color" content="#1e335e">
<style>
  :root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
  body{margin:0;font:14px system-ui,-apple-system,'Segoe UI',sans-serif;background:#f3f5fa}
  img{max-width:100%}
  [hidden]{display:none!important}
</style>
${headTags.join('\n')}
</head>
<body>
`;

const html = head + body.trimStart() + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html yangilandi (' + headTags.length + ' ta head tegi ko’chirildi).');

/* ---------------- Versiya: fayllar mazmunidan hisoblanadi ----------------
   sw.js dagi VERSION shu yerda yoziladi. Fayl o'zgarsa — versiya ham o'zgaradi,
   brauzer yangi xizmat ishchisini ko'radi va foydalanuvchiga "Yangilash" chiqadi.
   Qo'lda tahrirlash shart emas (ilgari unutilib qolardi).                    */
const crypto = require('crypto');

function filesOf(dir, ext) {
  try {
    return fs.readdirSync(path.join(__dirname, dir))
      .filter(n => ext.some(e => n.endsWith(e)))
      .sort()
      .map(n => dir + '/' + n);
  } catch (e) { return []; }
}

const VERSIONED = ['index.html', 'manifest.webmanifest']
  .concat(filesOf('css', ['.css']))
  .concat(filesOf('js', ['.js']));

const hash = crypto.createHash('sha256');
VERSIONED.forEach(rel => {
  const f = path.join(__dirname, rel);
  if (!fs.existsSync(f)) return;
  hash.update(rel + '\0');
  hash.update(fs.readFileSync(f));
});
const VERSION = 'albayan-' + hash.digest('hex').slice(0, 12);

const swPath = path.join(__dirname, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
const before = sw;
sw = sw.replace(/const VERSION = '[^']*';/, "const VERSION = '" + VERSION + "';");
if (sw === before && !/const VERSION = '/.test(sw)) {
  throw new Error('sw.js da VERSION qatori topilmadi.');
}
fs.writeFileSync(swPath, sw);

// Ilova ham o'z versiyasini bilsin (kerak bo'lsa ko'rsatish uchun)
const withVer = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  .replace(/<meta name="app-version"[^>]*>\n?/, '')
  .replace('</head>', '<meta name="app-version" content="' + VERSION + '">\n</head>');
fs.writeFileSync(path.join(__dirname, 'index.html'), withVer);

console.log('Versiya: ' + VERSION + ' (' + VERSIONED.length + ' ta fayl mazmunidan).');
