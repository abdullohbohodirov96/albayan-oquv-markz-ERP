/* Ochiq saytning boshlang'ich HTML matni. ERP ma'lumotlari bu yerga chiqmaydi. */
'use strict';

const DEFAULT_ADDRESS = 'Toshkent, Taxtapul Darvoza ko‘chasi, 336, 2-qavat';
const DEFAULT_PHONE = '+998 (55) 588-20-28';
const DEFAULT_INSTAGRAM = 'https://www.instagram.com/albayan.cairo/';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

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

function render(html, settings, host) {
  const s = settings || {};
  const name = String(s.centerName || 'Al Bayan Cairo').slice(0, 90);
  const phone = String(s.phone || DEFAULT_PHONE).slice(0, 40);
  const address = String(s.address || DEFAULT_ADDRESS).slice(0, 200);
  const social = instagram(s.instagram);
  const url = origin(host) + '/';
  const title = name + ' — Toshkentda arab tili kurslari';
  const description = name + ' — Toshkentda misrlik ustozlar bilan arab tili kurslari. Manzil: ' + address + '. Telefon: ' + phone + '.';
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'EducationalOrganization',
    name, url, description, telephone: phone,
    address: { '@type': 'PostalAddress', streetAddress: address, addressLocality: 'Toshkent', addressCountry: 'UZ' },
    sameAs: [social]
  }).replace(/</g, '\\u003c');
  const head = '<link rel="canonical" href="' + escapeHtml(url) + '">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(description) + '">\n' +
    '<meta property="og:url" content="' + escapeHtml(url) + '">\n' +
    '<meta property="og:image" content="' + escapeHtml(url + 'assets/logo.png') + '">\n' +
    '<script type="application/ld+json">' + jsonLd + '</script>\n';
  const intro = '<main id="seo-prerender" style="max-width:860px;margin:24px auto;padding:28px;font:16px/1.6 system-ui,sans-serif;color:#1e335e;background:white;border-radius:18px">' +
    '<h1>' + escapeHtml(name) + ' — Toshkentda arab tili kurslari</h1>' +
    '<p>Arab tilini misrlik ustozlar bilan bosqichma-bosqich o‘rganing. Boshlang‘ich darajadan yuqori darajagacha darslar, ustozlar, jadval va kurs narxi haqida ma’lumot saytda berilgan.</p>' +
    '<p><strong>Manzil:</strong> ' + escapeHtml(address) + '</p>' +
    '<p><strong>Telefon:</strong> <a href="tel:' + escapeHtml(phone.replace(/[^+0-9]/g, '')) + '">' + escapeHtml(phone) + '</a></p>' +
    '<p><a href="' + escapeHtml(social) + '">Instagram sahifasi</a></p></main>\n';

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(title) + '</title>')
    .replace(/<meta name="description"[^>]*>/i, '<meta name="description" content="' + escapeHtml(description) + '">')
    .replace('</head>', head + '</head>')
    .replace('<div id="auth" hidden>', intro + '<div id="auth" hidden>');
}

module.exports = { DEFAULT_ADDRESS, origin, render };
