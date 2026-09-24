/* Qidiruv tizimlari uchun ma'lumotni SOZLAMALARDAN to'ldiradi.

   index.html da standart yozuv turadi (build.js yozadi). Server uni
   berayotganda markazning HAQIQIY nomi, telefoni, manzili va ish vaqti
   bilan almashtiradi — shunda Google saytning logotipini, manzilini va
   ish vaqtini to'g'ri taniydi.

   MUHIM: bu yerda hech narsa "o'ylab topilmaydi". Sozlamada bo'sh
   qolgan maydon JSON-LD ga ham tushmaydi. */
'use strict';

/** Manzilni "https://..." ko'rinishiga keltiradi */
function siteUrl(req, env) {
  const fromEnv = String((env && env.SITE_URL) || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const host = (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  if (!host) return '';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return proto + '://' + host;
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 300);
}
/** "@albayan" yoki to'liq havoladan to'liq havola yasaydi */
function tgUrl(v) {
  const t = clean(v, 80);
  if (!t) return '';
  if (/^https?:/i.test(t)) return t;
  return 'https://t.me/' + t.replace(/^@/, '');
}
function igUrl(v) {
  const t = clean(v, 120);
  if (!t) return '';
  if (/^https?:/i.test(t)) return t;
  return 'https://instagram.com/' + t.replace(/^@/, '');
}
/** "08:00"–"22:00" dan schema.org ish vaqtini yasaydi */
function hours(a, b) {
  const re = /^\d{1,2}:\d{2}$/;
  if (!re.test(clean(a, 8)) || !re.test(clean(b, 8))) return null;
  return {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: clean(a, 8), closes: clean(b, 8)
  };
}

/**
 * JSON-LD ni sozlamalar bilan boyitadi.
 * @param {object} ld   index.html dagi yozuv
 * @param {object} s    meta/settings
 * @param {string} url  saytning asosiy manzili
 */
function enrich(ld, s, url) {
  if (!ld || !Array.isArray(ld['@graph'])) return ld;
  s = s || {};
  const org = ld['@graph'].find(x => {
    const t = x['@type'];
    return Array.isArray(t) ? t.indexOf('LocalBusiness') >= 0 : t === 'LocalBusiness';
  });
  if (!org) return ld;

  const name = clean(s.centerName, 80);
  if (name) {
    org.name = name;
    /* Boshqa nomlari ro'yxatiga qo'shamiz, takrorlanmasin */
    const alt = Array.isArray(org.alternateName) ? org.alternateName.slice() : [];
    if (alt.indexOf(name) < 0) alt.unshift(name);
    org.alternateName = alt;
  }
  const phone = clean(s.phone, 40);
  if (phone) org.telephone = phone;

  const addr = clean(s.address, 160);
  if (addr) {
    org.address = {
      '@type': 'PostalAddress',
      streetAddress: addr,
      addressLocality: 'Toshkent',
      addressCountry: 'UZ'
    };
  }
  const about = clean(s.about, 300);
  if (about) org.description = about;

  const oh = hours(s.workStart, s.workEnd);
  if (oh) org.openingHoursSpecification = oh;

  /* Ijtimoiy tarmoqlar — Google shu havolalar orqali sahifani tanidi */
  const links = [igUrl(s.instagram), tgUrl(s.tgChannel), tgUrl(s.tgQabul), tgUrl(s.telegram)]
    .filter(Boolean);
  const seen = {};
  const sameAs = links.filter(u => (seen[u] ? false : (seen[u] = true)));
  if (sameAs.length) org.sameAs = sameAs;

  if (url) {
    org['@id'] = url + '/#markaz';
    org.url = url + '/';
    org.logo = { '@type': 'ImageObject', url: url + '/assets/icon-512.png', width: 512, height: 512 };
    org.image = url + '/assets/icon-512.png';
    const site = ld['@graph'].find(x => x['@type'] === 'WebSite');
    if (site) {
      site['@id'] = url + '/#sayt';
      site.url = url + '/';
      if (name) site.name = name;
      site.publisher = { '@id': url + '/#markaz' };
    }
    const course = ld['@graph'].find(x => x['@type'] === 'Course');
    if (course) course.provider = { '@id': url + '/#markaz' };
  }
  return ld;
}

/**
 * index.html ichidagi JSON-LD va manzilga bog'liq teglarni yangilaydi.
 * Sozlama o'qib bo'lmasa — HTML o'zgarishsiz qaytadi.
 */
function inject(html, settings, url) {
  let out = String(html);
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
  const m = out.match(re);
  if (m) {
    try {
      const ld = JSON.parse(m[1].replace(/\\u003c/g, '<'));
      const next = enrich(ld, settings, url);
      out = out.replace(re, '<script type="application/ld+json">' +
        JSON.stringify(next).replace(/</g, '\\u003c') + '</script>');
    } catch (e) { /* buzuq bo'lsa tegmaymiz */ }
  }
  if (url) {
    /* canonical va og:url saytning haqiqiy manziliga moslanadi —
       o'z domeningizga o'tsangiz ham o'zi to'g'rilanadi.            */
    out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + url + '/$2');
    out = out.replace(/(<meta property="og:url" content=")[^"]*(")/, '$1' + url + '/$2');
    out = out.replace(/(<meta property="og:image" content=")[^"]*(")/, '$1' + url + '/assets/icon-512.png$2');
    out = out.replace(/(<meta name="twitter:image" content=")[^"]*(")/, '$1' + url + '/assets/icon-512.png$2');
  }
  const about = clean(settings && settings.about, 300);
  if (about) {
    const esc = about.replace(/"/g, '&quot;');
    out = out.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + esc + '$2');
    out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + esc + '$2');
    out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/, '$1' + esc + '$2');
  }
  const name = clean(settings && settings.centerName, 80);
  if (name) {
    const esc = name.replace(/"/g, '&quot;');
    out = out.replace(/(<meta property="og:site_name" content=")[^"]*(")/, '$1' + esc + '$2');
  }
  return out;
}

module.exports = { inject, enrich, siteUrl, tgUrl, igUrl };
