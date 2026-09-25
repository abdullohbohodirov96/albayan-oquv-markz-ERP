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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

/** Saytning asosiy manzili. Noto'g'ri host kelsa — standart manzil. */
function origin(host) {
  const value = String(host || '').toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(value) || value.length > 253) {
    return 'https://albayan-oquv-markz-erp.onrender.com';
  }
  return (value.startsWith('localhost:') || value.startsWith('127.0.0.1:') ? 'http://' : 'https://') + value;
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
  const name = String(s.centerName || 'Al Bayan Cairo').slice(0, 90);
  const phone = String(s.phone || DEFAULT_PHONE).slice(0, 40);
  const address = String(s.address || DEFAULT_ADDRESS).slice(0, 200);
  const social = instagram(s.instagram);
  const url = origin(host) + '/';
  const title = name + ' — Toshkentda arab tili kurslari';
  const description = name + ' — Toshkentda arab tili kurslari. Darslarni ona tili ' +
    'arab tili bo‘lgan ustozlar olib boradi. Ayollar va erkaklar uchun alohida ' +
    'guruhlar. Manzil: ' + address + '. Telefon: ' + phone + '.';

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
    alternateName: ['Al Bayan Cairo', 'AlBayan Cairo', 'AlBayan', 'Al-Bayan', 'البيان'],
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
      { '@type': 'WebSite', '@id': url + '#sayt', url, name, inLanguage: 'uz', publisher: { '@id': url + '#markaz' } },
      {
        '@type': 'Course',
        name: 'Arab tili — A1 dan C2 gacha',
        description: 'Alifbodan erkin suhbatgacha olti daraja. Ayollar va erkaklar ' +
          'uchun alohida guruhlar.',
        inLanguage: 'uz', teaches: 'Arab tili',
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

module.exports = { DEFAULT_ADDRESS, DEFAULT_PHONE, origin, telegram, instagram, hours, render };
