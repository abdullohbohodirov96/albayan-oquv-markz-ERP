/* Ochiq saytning qidiruv tizimlari uchun tayyorlangan HTML matni.

   Nima qiladi:
     — sarlavha, tavsif, canonical va ijtimoiy tarmoq kartochkasini
       markazning SOZLAMALARIDAN to'ldiradi;
     — Google uchun tuzilgan ma'lumot (JSON-LD) yozadi: markaz, sayt va
       kurs — logotip, telefon, manzil, ish vaqti va havolalar bilan;
     — JavaScript ishlamasa ham o'qiladigan qisqa matn qo'shadi.

   Qoidalar:
     — ERP ma'lumotlari (o'quvchilar, to'lovlar) bu yerga CHIQMAYDI;
     — sozlamadagi har qanday matn HTML ga tushishdan oldin ekranlanadi —
       begona kod sahifaga kira olmaydi;
     — sozlamada bo'sh qolgan maydon yozuvga ham tushmaydi, hech narsa
       "o'ylab topilmaydi". */
'use strict';

const DEFAULT_ADDRESS = 'Toshkent, Taxtapul Darvoza ko‘chasi, 336, 2-qavat';
const DEFAULT_PHONE = '+998 (55) 588-20-28';
const DEFAULT_INSTAGRAM = 'https://www.instagram.com/albayan.cairo/';

/* Saytning Google dagi nomi. Sozlamadagi nom bo'sh bo'lsa shu ishlatiladi;
   barcha joyda (title, og:site_name, WebSite schema) BITTA nom turadi.   */
const SITE_NAME = 'AlBayan Cairo';

/* "AlBayan", "Al Bayan", "البيان" deb qidirilganda ham shu sayt
   tanilsin. Bular haqiqiy yozilish variantlari — uydirma nom emas.     */
const ALT_NAMES = ['AlBayan', 'Al Bayan', 'Al-Bayan Cairo', 'Al Bayan Cairo', 'البيان'];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

const DEFAULT_ORIGIN = 'https://albayan-oquv-markz-erp.onrender.com';

/** Bitta muhit o'zgaruvchisidan to'g'ri manzil o'qish */
function fromEnv(name) {
  let raw = String(process.env[name] || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;   // faqat host yozilgan bo'lsa
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (!u.hostname || u.hostname.indexOf('.') < 0) return '';
    return u.origin;                       // yo'l, so'rov va # tashlanadi
  } catch (e) { return ''; }
}

/** Mahalliy ishlash (dasturchi mashinasi va sinovlar) */
function isLocal(value) {
  return /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d{1,5})?$/.test(value);
}

/* ------------------------------------------------------------------
   Saytning asosiy manzili.

   XAVFSIZLIK: Host sarlavhasini MIJOZ yozadi. Unga ishonsak, begona
   odam "Host: zararli.example.com" deb so'rov yuborib, bizning
   serverimizdan robots.txt, sitemap.xml va canonical ichiga o'z
   saytini yozdirib olardi — Google esa buni bizning "asosiy
   manzilimiz" deb o'qirdi.

   Shuning uchun tartib qat'iy:
     1) SITE_URL — o'zingiz yozgan domen (eng ishonchli);
     2) RENDER_EXTERNAL_URL — Render o'zi beradigan manzil;
     3) localhost — faqat mahalliy ishlash va sinovlar uchun;
     4) qolgan hamma holatda — standart manzil.
   Ya'ni Host faqat mahalliy ishlashda ta'sir qiladi.               */
function origin(host) {
  const site = fromEnv('SITE_URL');
  if (site) return site;
  const render = fromEnv('RENDER_EXTERNAL_URL') || fromEnv('RENDER_EXTERNAL_HOSTNAME');
  if (render) return render;
  const value = String(host || '').toLowerCase();
  if (isLocal(value)) return 'http://' + value;
  return DEFAULT_ORIGIN;
}

function instagram(value) {
  try {
    const url = new URL(String(value || DEFAULT_INSTAGRAM));
    if (url.protocol === 'https:' && /^(www\.)?instagram\.com$/i.test(url.hostname)) return url.href;
  } catch (e) { /* noto'g'ri havola */ }
  return DEFAULT_INSTAGRAM;
}

/** "@albayanuz" yoki to'liq havoladan xavfsiz Telegram havolasi */
function telegram(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  if (/^https?:/i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'https:' && /^(www\.)?t\.me$/i.test(url.hostname)) return url.href;
    } catch (e) { /* noto'g'ri havola */ }
    return '';
  }
  const name = raw.replace(/^@/, '');
  return /^[A-Za-z0-9_]{3,40}$/.test(name) ? 'https://t.me/' + name : '';
}

/** "08:00"–"22:00" dan schema.org ish vaqti */
function hours(a, b) {
  const re = /^\d{1,2}:\d{2}$/;
  const from = String(a || '').trim(), to = String(b || '').trim();
  if (!re.test(from) || !re.test(to)) return null;
  return {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: from, closes: to
  };
}

function render(html, settings, host) {
  const s = settings || {};
  const name = String(s.centerName || SITE_NAME).slice(0, 90);
  const phone = String(s.phone || DEFAULT_PHONE).slice(0, 40);
  const address = String(s.address || DEFAULT_ADDRESS).slice(0, 200);
  const social = instagram(s.instagram);
  const url = origin(host) + '/';

  /* Sarlavha: odam nimani qidirsa, shu oldinda tursin — "arab tili
     kurslari Toshkentda". Markaz nomi oxirida. 60 belgidan oshmaydi,
     shuning uchun Google uni kesib tashlamaydi.                      */
  const title = 'Arab tili kurslari Toshkentda | ' + name;

  /* Tavsif: ixcham (~155 belgi), faqat haqiqiy ma'lumot. Manzil va
     telefon bu yerda takrorlanmaydi — ular tuzilgan ma'lumotda va
     sahifaning o'zida turadi, tavsif esa qisqa qolsin.               */
  const description = 'Toshkentda arab tili kurslari: A1–C2 darajalar, arab ' +
    'ustozlar, ayollar va erkaklar uchun alohida guruhlar. Bepul daraja ' +
    'aniqlash testi.';

  /* Havolalar: Instagram va Telegram kanallari (bo'sh bo'lsa tushmaydi) */
  const links = [social, telegram(s.tgChannel), telegram(s.tgQabul),
    telegram(s.tgQabul2), telegram(s.telegram)].filter(Boolean);
  const seen = {};
  const sameAs = links.filter(u => (seen[u] ? false : (seen[u] = true)));

  const org = {
    '@type': ['EducationalOrganization', 'LocalBusiness'],
    '@id': url + '#markaz',
    name,
    /* "bayan", "al bayan" deb qidirilganda ham topilsin */
    alternateName: ALT_NAMES.filter(x => x !== name),
    url,
    description,
    telephone: phone,
    logo: { '@type': 'ImageObject', url: url + 'assets/icon-512.png', width: 512, height: 512 },
    image: url + 'assets/icon-512.png',
    address: {
      '@type': 'PostalAddress', streetAddress: address,
      addressLocality: 'Toshkent', addressCountry: 'UZ'
    },
    areaServed: { '@type': 'City', name: 'Toshkent' },
    knowsLanguage: ['ar', 'uz', 'ru'],
    sameAs
  };
  const oh = hours(s.workStart, s.workEnd);
  if (oh) org.openingHoursSpecification = oh;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      org,
      /* Google qidiruvdagi SAYT NOMI shu yozuvdan olinadi. Google ning
         hujjatiga ko'ra `name` va `url` majburiy, `alternateName` esa
         zaxira variant. Nom bu yerda ham, og:site_name da ham,
         sarlavhada ham bir xil — Google ziddiyat ko'rmasligi kerak.  */
      {
        '@type': 'WebSite', '@id': url + '#sayt', url, name,
        alternateName: ALT_NAMES.filter(x => x !== name),
        inLanguage: 'uz', publisher: { '@id': url + '#markaz' }
      },
      {
        '@type': 'Course',
        name: 'Arab tili kurslari — A1 dan C2 gacha',
        description: 'Alifbodan erkin suhbatgacha olti daraja. Ayollar va erkaklar ' +
          'uchun alohida guruhlar.',
        inLanguage: 'uz', teaches: 'Arab tili',
        about: { '@type': 'Language', name: 'Arab tili', alternateName: 'اللغة العربية' },
        provider: { '@id': url + '#markaz' }
      }
    ]
  }).replace(/</g, '\\u003c');

  const head = '<link rel="canonical" href="' + escapeHtml(url) + '">\n' +
    '<meta name="robots" content="index, follow, max-image-preview:large">\n' +
    /* Logotip havolalari index.html ning o'zida turadi (build.js yozadi) —
       bu yerda takrorlanmaydi.                                          */
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:site_name" content="' + escapeHtml(name) + '">\n' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(description) + '">\n' +
    '<meta property="og:url" content="' + escapeHtml(url) + '">\n' +
    '<meta property="og:image" content="' + escapeHtml(url + 'assets/icon-512.png') + '">\n' +
    '<meta property="og:locale" content="uz_UZ">\n' +
    '<meta name="twitter:card" content="summary">\n' +
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">\n' +
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">\n' +
    '<meta name="twitter:image" content="' + escapeHtml(url + 'assets/icon-512.png') + '">\n' +
    '<script type="application/ld+json">' + jsonLd + '</script>\n';

  /* JavaScript O'CHIQ bo'lganda (va uni ishlatmaydigan robot uchun)
     ko'rinadigan qisqa matn.

     MUHIM: bu matn <noscript> ichida turadi. Ilgari u oddiy blok edi
     va JavaScript yuklanguncha bir soniya ekranda oq kartochka bo'lib
     turardi — foydalanuvchi "sayt ochilishidan oldin nimadir chiqyapti"
     deb ko'rardi. <noscript> ichida bo'lgani uchun endi brauzerda
     umuman chizilmaydi, lekin HTML ichida qolgani uchun qidiruv
     tizimlari va JavaScriptsiz brauzerlar uni baribir o'qiydi.       */
  const intro = '<noscript><main id="seo-prerender" style="max-width:860px;margin:24px auto;padding:28px;font:16px/1.6 system-ui,sans-serif;color:#1e335e;background:white;border-radius:18px">' +
    '<h1>' + escapeHtml(name) + ' — Toshkentda arab tili kurslari</h1>' +
    '<p>Arab tilini ona tili arab tili bo‘lgan ustozlar bilan bosqichma-bosqich ' +
    'o‘rganing. Alifbodan (A1) erkin suhbatgacha (C2) olti daraja. Ayollar va ' +
    'erkaklar uchun alohida guruhlar, kichik guruhlar, ertalabki va kechki smenalar. ' +
    'Bepul daraja aniqlash testi saytda.</p>' +
    '<p><strong>Manzil:</strong> ' + escapeHtml(address) + '</p>' +
    '<p><strong>Telefon:</strong> <a href="tel:' + escapeHtml(phone.replace(/[^+0-9]/g, '')) + '">' + escapeHtml(phone) + '</a></p>' +
    '<p><a href="' + escapeHtml(social) + '">Instagram sahifasi</a></p></main></noscript>\n';

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(title) + '</title>')
    .replace(/<meta name="description"[^>]*>/i, '<meta name="description" content="' + escapeHtml(description) + '">')
    /* Eski canonical/og teglari qaytadan yozilmasin */
    .replace(/<link rel="canonical"[^>]*>\n?/i, '')
    .replace(/<meta property="og:[^"]*"[^>]*>\n?/gi, '')
    .replace(/<meta name="twitter:[^"]*"[^>]*>\n?/gi, '')
    .replace(/<meta name="robots"[^>]*>\n?/i, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/i, '')
    .replace('</head>', head + '</head>')
    .replace('<div id="auth" hidden>', intro + '<div id="auth" hidden>');
}

/* ------------------------------------------------------------------
   robots.txt

   Nima ochiq: ochiq saytning o'zi va uni chizish uchun kerak bo'lgan
   fayllar (css, js, rasm). Google sahifani CHIZIB ko'radi — css/js ni
   yopib qo'ysak, sayt unga bo'sh ko'rinadi, shuning uchun ular ochiq.

   Nima yopiq: /api/ — ERP ning butun ma'lumot yo'li shu yerda
   (o'quvchilar, to'lovlar, xodimlar, zaxira, bot). Ular baribir
   ruxsat so'raydi, lekin indeksga urinib ham ko'rilmasin.

   ERP ning ekranlari alohida manzil EMAS — ular bitta sahifa ichida
   # belgisidan keyin ochiladi (#students, #finance ...). Brauzer #
   dan keyingi qismni serverga umuman yubormaydi, shuning uchun ularni
   robots.txt bilan "yopib" bo'lmaydi va yopish SHART emas: Google
   uchun ular alohida sahifa bo'lib ko'rinmaydi.                     */
function robots(host) {
  const base = origin(host);
  return [
    '# AlBayan Cairo — ochiq sayt',
    'User-agent: *',
    'Allow: /',
    '',
    '# ERP ma’lumot yo’li — indekslanmaydi',
    'Disallow: /api/',
    '',
    '# Sahifani chizish uchun kerak — ochiq qoladi',
    'Allow: /css/',
    'Allow: /js/',
    'Allow: /assets/',
    '',
    'Sitemap: ' + base + '/sitemap.xml',
    ''
  ].join('\n');
}

/* ------------------------------------------------------------------
   sitemap.xml

   Bu sayt BITTA sahifadan iborat: kurslar, ustozlar, darajalar va
   ariza formasi — hammasi shu bitta manzilda, # dan keyin ochiladi.
   Shuning uchun xaritada HAM bitta manzil turadi.

   MUHIM: bu yerga # li manzillar (#students, #ustoz?id=...) yozilmaydi.
   Ular alohida sahifa emas; yozilsa Google ularni xato deb belgilaydi
   va ustiga ustak ERP manzillari ro'yxatga tushib qolardi.           */
function sitemap(host) {
  const base = origin(host);
  const today = new Date().toISOString().slice(0, 10);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url>\n' +
    '    <loc>' + escapeHtml(base) + '/</loc>\n' +
    '    <lastmod>' + today + '</lastmod>\n' +
    '    <changefreq>weekly</changefreq>\n' +
    '    <priority>1.0</priority>\n' +
    '  </url>\n' +
    '</urlset>\n';
}

module.exports = {
  DEFAULT_ADDRESS, DEFAULT_PHONE, SITE_NAME, ALT_NAMES,
  origin, telegram, instagram, hours, render, robots, sitemap
};
