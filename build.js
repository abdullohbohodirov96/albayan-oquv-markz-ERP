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

fs.writeFileSync(path.join(__dirname, 'index.html'), head + body.trimStart() + '\n</body>\n</html>\n');
console.log('index.html yangilandi (' + headTags.length + ' ta head tegi ko’chirildi).');
