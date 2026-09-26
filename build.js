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
    /* Sarlavha va tavsif index.html uchun pastdagi shablonda — to'liqroq
       va qidiruv tizimiga moslangan. Shuning uchun artifact.html dagi
       qisqa nusxasi ko'chirilmaydi (ikkita <title> bo'lib qolmasin).   */
    if (/^<title>/i.test(tag.trim())) return '';
    if (/name=["']description["']/i.test(tag)) return '';
    if (/rel=["']apple-touch-icon["']/i.test(tag)) return '';
    headTags.push('  ' + tag.trim());
    return '';
  });
  return '';
});

/* ---------------- Qidiruv tizimlari va ijtimoiy tarmoqlar uchun ----------------
   SITE_URL — saytning asosiy manzili. O'z domeningiz bo'lsa, uni shu yerga
   yozing (yoki SITE_URL muhit o'zgaruvchisida bering): havolalar, canonical
   va sitemap shunga qarab tuziladi.                                        */
const SITE_URL = (process.env.SITE_URL || 'https://albayan-oquv-markz-erp.onrender.com')
  .replace(/\/+$/, '');
const SITE_NAME = 'AlBayan Cairo';
const SITE_DESC = 'AlBayan Cairo — Toshkentdagi arab tili o‘quv markazi. ' +
  'Darslarni ona tili arab tili bo‘lgan ustozlar olib boradi. Ayollar va ' +
  'erkaklar uchun alohida guruhlar. A1 dan C2 gacha olti daraja, kichik ' +
  'guruhlar, ertalabki va kechki smenalar. Bepul daraja aniqlash testi.';

/* Google Analytics 4. Bo'sh qoldirilsa (GA_ID='') teg umuman
   qo'yilmaydi — mahalliy ishlaganda yoki sinovda statistika
   yuborilmaydi.                                                    */
const GA_ID = process.env.GA_MEASUREMENT_ID != null
  ? process.env.GA_MEASUREMENT_ID : 'G-3MYVLL1HML';

/* MUHIM — MAXFIYLIK.
   Bu bitta sahifali dastur: ochiq sayt ham, ERP ham bitta manzilda
   ishlaydi va ichki ekranlar manzilida o'quvchi raqami turadi
   (masalan #student?id=st_123). Agar oddiy teg qo'yilsa, o'sha
   manzillar Google ga yuborilardi — ya'ni o'quvchilar haqidagi
   ma'lumot tashqariga chiqardi.

   Shuning uchun:
     — avtomatik "sahifa ko'rildi" O'CHIRILGAN (send_page_view:false);
     — yozuv FAQAT ochiq saytda va FAQAT bitta manzil bilan
       yuboriladi (hash va so'rov qismisiz);
     — ERP ga kirilgandan keyin (#dashboard, #student, ...) hech
       narsa yuborilmaydi.                                          */
const GA_TAG = !GA_ID ? '' : `
<!-- Google tag (gtag.js) -->
<script>
(function () {
  /* ---------------------------------------------------------------
     Google Analytics 4 — UCH QAVATLI HIMOYA.

     Muammo: bu bitta sahifali dastur. Ochiq sayt ham, ERP ham bitta
     manzilda ishlaydi, ERP ichida esa manzilda o'quvchi raqami
     turadi (#student?id=st_123). GA4 ning "Enhanced Measurement"
     sozlamasi brauzer tarixi o'zgarganda (pushState, popstate,
     hashchange) O'ZI page_view yuboradi — bu sozlama Google
     tomonda yoqilgan bo'lib, send_page_view:false uni to'xtatmaydi.
     Ya'ni ERP ichida yurgan har bir qadam manzili bilan Google ga
     ketishi mumkin edi.

     Shuning uchun uch qavat qo'yilgan:

       1-qavat. ERP manzilida sahifa ochilsa — gtag.js UMUMAN
                yuklanmaydi. Skript yo'q, tinglovchi yo'q.
       2-qavat. Ochiq saytda yuklangach ERP ga o'tilsa, dataLayer ga
                tushayotgan HAR BIR yozuv suzgichdan o'tadi: ERP
                manzilida hech narsa o'tmaydi (Enhanced Measurement
                yuborgan page_view ham).
       3-qavat. O'tgan yozuvlarda ham manzil tozalanadi: page_location,
                page_referrer va page_path faqat asosiy manzil bo'ladi
                (hash va so'rov qismisiz), shaxsiy maydonlar
                (user_id, email, phone, ism, o'quvchi raqami)
                o'chiriladi.
     --------------------------------------------------------------- */
  var ID = '${GA_ID}';
  var ERP = /^(dashboard|students|student|groups|group|courses|schedule|attendance|curriculum|learning|finance|staff|reports|progress|progressGroup|chat|tasks|bot|settings|kirish|kabinet|test)\\b/;

  function erpda() {
    var h = String(location.hash || '').replace(/^#/, '');
    return !!h && ERP.test(h);
  }
  function tozaManzil() { return location.origin + '/'; }

  /* Shaxsiy bo'lishi mumkin bo'lgan maydonlar — hech qachon ketmaydi */
  var MAXFIY = ['user_id', 'userId', 'email', 'phone', 'name', 'student_id',
    'studentId', 'login', 'user_properties', 'client_name'];

  function tozala(args) {
    var p = args[2];
    if (p && typeof p === 'object') {
      if ('page_location' in p) p.page_location = tozaManzil();
      if ('page_referrer' in p) p.page_referrer = tozaManzil();
      if ('page_path' in p) p.page_path = '/';
      for (var i = 0; i < MAXFIY.length; i++) { delete p[MAXFIY[i]]; }
    }
    return args;
  }
  function otsinmi(args) {
    var turi = args && args[0];
    if (turi === 'consent') return true;          // rozilik har doim o'tadi
    return !erpda();                              // ERP da — hech narsa
  }

  window.dataLayer = window.dataLayer || [];
  var dl = window.dataLayer;

  /* dataLayer.push ni o'rab qo'yamiz. gtag.js keyinroq o'z
     ishlovchisini qo'yadi — setter orqali biz uni ushlab qolamiz,
     shunda suzgich baribir ustida turadi.                          */
  var ichki = Array.prototype.push;
  function suzgich() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (!otsinmi(a)) continue;
      out.push(tozala(a));
    }
    if (!out.length) return dl.length;
    return ichki.apply(dl, out);
  }
  try {
    Object.defineProperty(dl, 'push', {
      configurable: true,
      get: function () { return suzgich; },
      set: function (fn) { ichki = fn; }
    });
  } catch (e) { dl.push = suzgich; }

  function gtag() { dl.push(arguments); }
  window.gtag = gtag;

  /* 1-qavat: ERP manzilida ochilgan bo'lsa — skript ham yuklanmaydi */
  if (erpda()) return;

  var sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(sc);

  gtag('js', new Date());
  /* Avtomatik "sahifa ko'rildi" o'chirilgan — o'zimiz yuboramiz */
  gtag('config', ID, { send_page_view: false, anonymize_ip: true });

  function yubor() {
    if (erpda()) return;
    gtag('event', 'page_view', {
      page_location: tozaManzil(),
      page_title: document.title
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', yubor);
  } else { yubor(); }
})();
</script>
`;

const head = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${GA_TAG}
<title>${SITE_NAME} — Toshkentda arab tili o‘quv markazi</title>
<meta name="description" content="${SITE_DESC}">
<meta name="theme-color" content="#1e335e">
<link rel="canonical" href="${SITE_URL}/">
<meta name="robots" content="index, follow, max-image-preview:large">

<!-- Logotip: brauzer yorlig'i, xatcho'p, telefon ekrani -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/icon-16.png">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icon-180.png">
<meta name="msapplication-TileColor" content="#1e335e">
<meta name="msapplication-TileImage" content="/assets/icon-192.png">

<!-- Havola ulashilganda chiqadigan kartochka (Telegram, Facebook, WhatsApp) -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${SITE_NAME} — Toshkentda arab tili o‘quv markazi">
<meta property="og:description" content="${SITE_DESC}">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${SITE_URL}/assets/icon-512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:locale" content="uz_UZ">
<meta property="og:locale:alternate" content="ru_RU">
<meta property="og:locale:alternate" content="ar_AR">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${SITE_NAME} — arab tili o‘quv markazi">
<meta name="twitter:description" content="${SITE_DESC}">
<meta name="twitter:image" content="${SITE_URL}/assets/icon-512.png">
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

/* ---------------- Qidiruv tizimi uchun tuzilgan ma'lumot (JSON-LD) ----------
   Google shu yozuvga qarab saytning logotipini, nomini, manzilini va ish
   vaqtini taniydi — qidiruv natijasida logotip shu bilan chiqadi.
   Telefon va manzil serverda SOZLAMALARDAN yangilanadi (server/seo.js),
   bu yerdagilari — standart qiymat.                                       */
const LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['EducationalOrganization', 'LocalBusiness'],
      '@id': SITE_URL + '/#markaz',
      name: SITE_NAME,
      alternateName: ['Al Bayan Cairo', 'AlBayan', 'Al-Bayan', 'Albayan Cairo o‘quv markazi', 'البيان'],
      url: SITE_URL + '/',
      logo: { '@type': 'ImageObject', url: SITE_URL + '/assets/icon-512.png', width: 512, height: 512 },
      image: SITE_URL + '/assets/icon-512.png',
      description: SITE_DESC,
      address: { '@type': 'PostalAddress', addressLocality: 'Toshkent', addressCountry: 'UZ' },
      areaServed: { '@type': 'City', name: 'Toshkent' },
      knowsLanguage: ['ar', 'uz', 'ru'],
      sameAs: ['https://www.instagram.com/albayan.cairo/']
    },
    {
      '@type': 'WebSite',
      '@id': SITE_URL + '/#sayt',
      url: SITE_URL + '/',
      name: SITE_NAME,
      inLanguage: 'uz',
      publisher: { '@id': SITE_URL + '/#markaz' }
    },
    {
      '@type': 'Course',
      name: 'Arab tili — A1 dan C2 gacha',
      description: 'Alifbodan erkin suhbatgacha olti daraja. Darslarni ona tili ' +
        'arab tili bo‘lgan ustozlar olib boradi.',
      inLanguage: 'uz',
      teaches: 'Arab tili',
      provider: { '@id': SITE_URL + '/#markaz' },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'onsite',
        courseWorkload: 'PT4H30M',
        location: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Toshkent', addressCountry: 'UZ' } }
      }
    }
  ]
};
const ldTag = '<script type="application/ld+json">' +
  JSON.stringify(LD).replace(/</g, '\\u003c') + '</script>\n';

const html = head + ldTag + body.trimStart() + '\n</body>\n</html>\n';
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
