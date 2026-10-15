/* Formalar — markaz o'zi tuzadigan ariza shakllari.

   forms/<id>            — shakl: { id, slug, title, intro, thanks, bg, fields[], active,
                                    logo, banner, contact, info, courseId }
   formbg/<id>           — fon rasmi (data URL)      ┐ faqat /f/<slug> va
   formbg/<id>__logo     — logotip                   ├ /api/form-bg beradi
   formbg/<id>__banner   — banner (yuqori rasm)      ┘
   formsub/<id>          — kelgan ariza: { formId, answers, name, phone, leadId, at }
   formstat/<formId>     — statistika: ko'rildi / boshladi / yubordi, maydon bo'yicha,
                           kun bo'yicha (oxirgi 90 kun)

   Har bir yuborilgan ariza MUROJAAT (lead) ochadi — javoblar lead
   ichida ham turadi, shuning uchun CRM da hamma narsa bir joyda.

   Telefon: +998 ko'rsatiladi, odam faqat 9 ta raqamni yozadi
   (90 123 45 67). Telefon maydoni har doim bor va har doim majburiy.

   Fon: 10 ta tayyor shablon (CSS, rasm yuklanmaydi — tez ochiladi)
   yoki markaz yuklagan rasm (≤ 700 KB, JPEG/PNG/WebP).              */
'use strict';
const crypto = require('crypto');
const seo = require('./seo');

const COL = 'forms/';
const BG = 'formbg/';
const SUB = 'formsub/';
const STAT = 'formstat/';

/* Maydon turlari — har biri ochiq sahifada alohida chiziladi */
const TYPES = ['text', 'textarea', 'phone', 'select', 'radio', 'checkbox', 'number', 'date', 'referral'];
const MAX_FIELDS = 30;
const MAX_OPTIONS = 20;
const DEFAULT_CC = '+998';

/* Rasm turlari: fon, logotip, banner */
const IMG = {
  bg: { suffix: '', max: 950000 },
  logo: { suffix: '__logo', max: 420000 },
  banner: { suffix: '__banner', max: 950000 }
};
const EVENTS = ['view', 'start', 'reach', 'submit'];

/* 10 ta shablon: AlBayan uslubi — chuqur ko'k, oltin, sharq naqshi.
   Hammasi CSS — tashqi rasm yo'q, sahifa darhol ochiladi.          */
const TEMPLATES = [
  { id: 'kok', name: 'Chuqur ko’k', css: 'linear-gradient(135deg,#0f2a5a 0%,#1d4ed8 60%,#3b82f6 100%)', ink: '#fff' },
  { id: 'oltin', name: 'Oltin qum', css: 'linear-gradient(135deg,#7c4a03 0%,#d97706 55%,#fbbf24 100%)', ink: '#fff' },
  { id: 'zumrad', name: 'Zumrad', css: 'linear-gradient(135deg,#064e3b 0%,#059669 60%,#34d399 100%)', ink: '#fff' },
  { id: 'tun', name: 'Tun', css: 'linear-gradient(160deg,#0b1020 0%,#1e1b4b 50%,#312e81 100%)', ink: '#fff' },
  { id: 'naqsh', name: 'Sharq naqshi', ink: '#fff',
    css: 'radial-gradient(circle at 20% 20%,rgba(251,191,36,.25) 0 10px,transparent 11px),' +
      'radial-gradient(circle at 80% 70%,rgba(251,191,36,.2) 0 14px,transparent 15px),' +
      'repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0 12px,transparent 12px 24px),' +
      'linear-gradient(135deg,#0f2a5a,#1e3a8a)' },
  { id: 'qum', name: 'Oq qum', css: 'linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)', ink: '#1f2937' },
  { id: 'osmon', name: 'Osmon', css: 'linear-gradient(135deg,#dbeafe 0%,#93c5fd 100%)', ink: '#0f172a' },
  { id: 'atirgul', name: 'Atirgul', css: 'linear-gradient(135deg,#881337 0%,#e11d48 60%,#fb7185 100%)', ink: '#fff' },
  { id: 'kulrang', name: 'Sokin kulrang', css: 'linear-gradient(135deg,#f3f4f6 0%,#d1d5db 100%)', ink: '#111827' },
  { id: 'binafsha', name: 'Binafsha', css: 'linear-gradient(135deg,#3b0764 0%,#7e22ce 60%,#c084fc 100%)', ink: '#fff' }
];

function rid(p) { return p + crypto.randomBytes(6).toString('hex'); }
function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function txt(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max || 200); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cleanCc(v) {
  const s = txt(v, 6).replace(/\s/g, '');
  return /^\+\d{1,4}$/.test(s) ? s : DEFAULT_CC;
}

/** Havola uchun qisqa nom: faqat lotin harf, raqam va chiziqcha */
function slugify(s) {
  const map = { 'o’': 'o', 'g’': 'g', "o'": 'o', "g'": 'g', 'ʻ': '', 'ʼ': '' };
  let t = String(s || '').toLowerCase();
  Object.keys(map).forEach(k => { t = t.split(k).join(map[k]); });
  t = t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return t;
}
function validSlug(s) { return /^[a-z0-9][a-z0-9-]{1,39}$/.test(String(s || '')); }
function validId(s) { return /^[A-Za-z0-9_\-]{1,40}$/.test(String(s || '')); }

async function listCol(store, col) {
  return (await store.list(col))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean);
}

/** Maydonlar ro'yxatini tozalash — mijozdan kelgan JSON ga ishonilmaydi.
    Telefon maydoni har doim bor va har doim majburiy.                  */
function cleanFields(list) {
  const out = [];
  const seen = {};
  (Array.isArray(list) ? list : []).slice(0, MAX_FIELDS).forEach((f, i) => {
    if (!f || typeof f !== 'object') return;
    const type = TYPES.indexOf(f.type) >= 0 ? f.type : 'text';
    let id = txt(f.id, 24).replace(/[^A-Za-z0-9_]/g, '') || ('q' + (i + 1));
    while (seen[id]) id += 'x';
    seen[id] = 1;
    const rec = {
      id, type,
      label: txt(f.label, 120) || ('Savol ' + (i + 1)),
      required: f.required === true || type === 'phone',
      hint: txt(f.hint, 160)
    };
    if (type === 'select' || type === 'radio' || type === 'checkbox') {
      rec.options = (Array.isArray(f.options) ? f.options : String(f.options || '').split('\n'))
        .map(o => txt(o, 80)).filter(Boolean).slice(0, MAX_OPTIONS);
      if (!rec.options.length) rec.options = ['Ha', 'Yo’q'];
    }
    if (type === 'phone') rec.cc = cleanCc(f.cc);
    out.push(rec);
  });
  if (!out.some(f => f.type === 'phone')) {
    let id = 'tel';
    while (seen[id]) id += 'x';
    out.push({ id, type: 'phone', label: 'Telefon raqamingiz', required: true, hint: '', cc: DEFAULT_CC });
  }
  return out;
}

/** Shaklni saqlash (yaratish yoki yangilash) */
async function save(store, data, opts) { return serial('forms', () => saveNow(store, data, opts)); }
async function saveNow(store, data, opts) {
  const title = txt(data && data.title, 120);
  if (!title) return { ok: false, reason: 'nom' };
  const id = txt(data && data.id, 40) || rid('frm');
  if (!validId(id)) return { ok: false, reason: 'id' };
  const old = await store.get(COL + id);
  let slug = slugify(data && data.slug) || slugify(title) || id.slice(-8);
  if (!validSlug(slug)) slug = id.slice(-8);
  /* Havola takrorlanmasin */
  const others = (await listCol(store, COL)).filter(f => f.id !== id);
  let s2 = slug, n = 2;
  while (others.some(f => f.slug === s2)) s2 = slug + '-' + (n++);
  slug = s2;

  const bgTpl = TEMPLATES.some(t => t.id === (data && data.bg)) ? data.bg : '';
  const rec = {
    id, slug, title,
    intro: txt(data && data.intro, 600),
    thanks: txt(data && data.thanks, 300) || 'Rahmat! Arizangiz qabul qilindi. Tez orada bog’lanamiz.',
    button: txt(data && data.button, 40) || 'Yuborish',
    bg: bgTpl || (data && data.bg === 'rasm' ? 'rasm' : TEMPLATES[0].id),
    fields: cleanFields(data && data.fields),
    active: !(data && data.active === false),
    courseId: txt(data && data.courseId, 60),
    /* Kontaktlar bo'limi (telefon, manzil, Telegram) va qo'shimcha ma'lumot */
    contact: !(data && data.contact === false),
    contacts: cleanContacts(data && data.contacts),
    info: txt(data && data.info, 1000),
    /* Rasm belgilari faqat saveImg/delImg orqali o'zgaradi */
    logo: !!(old && old.logo), logoAt: (old && old.logoAt) || 0,
    banner: !!(old && old.banner), bannerAt: (old && old.bannerAt) || 0,
    bgAt: (old && old.bgAt) || 0,
    createdAt: (old && old.createdAt) || nowStamp(opts),
    updatedAt: nowStamp(opts),
    by: txt(opts && opts.byUserId, 60)
  };
  await store.set(COL + id, rec);
  return { ok: true, rec };
}

function imgPath(formId, kind) { return BG + formId + IMG[kind].suffix; }
function validImage(dataUrl, kind) {
  const d = String(dataUrl || '');
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d)) return 'turi';
  if (d.length > IMG[kind].max) return 'kattaligi';
  return '';
}

/** Rasm saqlash — fon / logotip / banner. data URL, faqat rasm. */
async function saveImg(store, formId, kind, dataUrl) {
  if (!IMG[kind]) return { ok: false, reason: 'turi' };
  const bad = validImage(dataUrl, kind);
  if (bad) return { ok: false, reason: bad };
  if (!validId(formId)) return { ok: false, reason: 'topilmadi' };
  const f = await store.get(COL + formId);
  if (!f) return { ok: false, reason: 'topilmadi' };
  const at = Date.now();
  await store.set(imgPath(formId, kind), { id: formId, kind, data: String(dataUrl), at });
  if (kind === 'bg') { f.bg = 'rasm'; f.bgAt = at; }
  else { f[kind] = true; f[kind + 'At'] = at; }
  f.updatedAt = nowStamp();
  await store.set(COL + formId, f);
  return { ok: true };
}
/* Eski nom — eski chaqiruvlar buzilmasin */
async function saveBg(store, formId, dataUrl) { return saveImg(store, formId, 'bg', dataUrl); }

/** Rasmni olib tashlash (fon shablonga qaytadi) */
async function delImg(store, formId, kind) {
  if (!IMG[kind] || !validId(formId)) return { ok: false, reason: 'topilmadi' };
  const f = await store.get(COL + formId);
  if (!f) return { ok: false, reason: 'topilmadi' };
  if (store.del) await store.del(imgPath(formId, kind)).catch(() => { });
  if (kind === 'bg') { if (f.bg === 'rasm') f.bg = TEMPLATES[0].id; f.bgAt = 0; }
  else { f[kind] = false; f[kind + 'At'] = 0; }
  f.updatedAt = nowStamp();
  await store.set(COL + formId, f);
  return { ok: true };
}

async function bySlug(store, slug) {
  if (!validSlug(slug)) return null;
  return (await listCol(store, COL)).filter(f => f.slug === slug)[0] || null;
}

/** Ochiq sahifa uchun shakl (ichki maydonlarsiz) */
function publicView(f) {
  const tpl = TEMPLATES.filter(t => t.id === f.bg)[0];
  return {
    id: f.id, slug: f.slug, title: f.title, intro: f.intro, thanks: f.thanks,
    button: f.button, fields: f.fields || [],
    bg: f.bg === 'rasm' ? 'rasm' : (tpl ? tpl.id : TEMPLATES[0].id),
    bgCss: f.bg === 'rasm' ? '' : (tpl || TEMPLATES[0]).css,
    ink: f.bg === 'rasm' ? '#fff' : (tpl || TEMPLATES[0]).ink,
    logo: !!f.logo, banner: !!f.banner, contact: f.contact !== false,
    contacts: Array.isArray(f.contacts) ? f.contacts : null, info: f.info || ''
  };
}

/** Telefon: "+998" dan keyin 9 ta raqam. Kod bilan yozilsa ham qabul qiladi. */
function phoneOf(v, cc) {
  cc = cleanCc(cc);
  const ccd = cc.slice(1);
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.length > 9 && digits.indexOf(ccd) === 0) digits = digits.slice(ccd.length);
  const need = cc === DEFAULT_CC ? 9 : 0;
  if (need ? digits.length !== need : (digits.length < 6 || digits.length > 12)) return '';
  return cc + digits;
}

/** Javoblarni tekshirish: majburiy maydon, variant ro'yxati, telefon */
function checkAnswers(form, answers, A) {
  const out = {};
  const errs = [];
  let name = '', phone = '';
  const a = (answers && typeof answers === 'object') ? answers : {};
  for (const f of (form.fields || [])) {
    let v = a[f.id];
    if (f.type === 'checkbox') {
      v = (Array.isArray(v) ? v : (v == null ? [] : [v])).map(x => txt(x, 80))
        .filter(x => f.options.indexOf(x) >= 0);
      if (f.required && !v.length) errs.push(f.label);
      out[f.id] = v;
      continue;
    }
    v = txt(v, f.type === 'textarea' ? 1500 : 200);
    if (f.type === 'phone') {
      /* Telefon har doim majburiy */
      const p = phoneOf(v, f.cc);
      if (!p) { errs.push(f.label + (v ? ' (' + cleanCc(f.cc) + ' dan keyin 9 ta raqam)' : '')); continue; }
      v = p;
      if (!phone) phone = v;
      out[f.id] = v;
      continue;
    }
    if (f.required && !v) { errs.push(f.label); continue; }
    if (!v) { out[f.id] = ''; continue; }
    if (f.type === 'select' || f.type === 'radio') {
      if (f.options.indexOf(v) < 0) { errs.push(f.label); continue; }
    }
    if (f.type === 'referral') { v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (!v) { out[f.id] = ''; continue; } }
    if (f.type === 'number' && !/^-?\d{1,12}([.,]\d{1,4})?$/.test(v)) { errs.push(f.label); continue; }
    if (f.type === 'date' && !(A && A.isDate(v))) { errs.push(f.label); continue; }
    if (f.type === 'text' && !name && /ism|name|имя|اسم/i.test(f.label)) name = v;
    out[f.id] = v;
  }
  /* Ism topilmasa — birinchi matnli javob */
  if (!name) {
    for (const f of (form.fields || [])) {
      if (f.type === 'text' && out[f.id]) { name = out[f.id]; break; }
    }
  }
  return { ok: !errs.length, errors: errs, answers: out, name, phone };
}

/* ---------------- Navbat ----------------
   Hisoblagich (o'qi → +1 → yoz) va "bir IP dan kuniga N ta" tekshiruvi
   parallel so'rovlarda poyga qiladi: ikki so'rov bir xil eski qiymatni
   o'qib, ikkalasi ham yozsa — bittasi yo'qoladi. PostgreSQL da bu aniq
   ko'rindi (100 ta parallel ko'rish → 2 ta yozilgan). Shuning uchun bir
   kalit bo'yicha ishlar ketma-ket bajariladi. Server bitta jarayonda
   ishlaydi (Render — bitta instance), shuning uchun jarayon ichidagi
   navbat yetarli.                                                   */
const queues = new Map();
function serial(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const p = prev.then(() => fn());
  const tail = p.catch(() => { });
  queues.set(key, tail);
  tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
  return p;
}

/* ---------------- Statistika ---------------- */
function emptyStat(formId) {
  return { id: formId, views: 0, starts: 0, submits: 0, fields: {}, days: {} };
}
/** Voqea: view (sahifa ochildi), start (yozishni boshladi),
    reach (maydonga yetdi), submit (yubordi). Kun bo'yicha ham. */
async function recordEvent(store, formId, ev, fieldId, day) {
  if (EVENTS.indexOf(ev) < 0 || !validId(formId)) return false;
  return serial('stat:' + formId, () => recordEventNow(store, formId, ev, fieldId, day));
}
async function recordEventNow(store, formId, ev, fieldId, day) {
  const p = STAT + formId;
  const s = Object.assign(emptyStat(formId), (await store.get(p)) || {});
  s.fields = s.fields || {}; s.days = s.days || {};
  const dk = /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? day : new Date().toISOString().slice(0, 10);
  const d = s.days[dk] = s.days[dk] || { v: 0, s: 0, c: 0 };
  if (ev === 'view') { s.views++; d.v++; }
  else if (ev === 'start') { s.starts++; d.s++; }
  else if (ev === 'submit') { s.submits++; d.c++; }
  else {
    const k = txt(fieldId, 24).replace(/[^A-Za-z0-9_]/g, '');
    if (!k) return false;
    s.fields[k] = (s.fields[k] || 0) + 1;
  }
  const keys = Object.keys(s.days).sort();
  while (keys.length > 90) delete s.days[keys.shift()];
  s.at = Date.now();
  await store.set(p, s);
  return true;
}

/* ---------------- Ochiq sahifa ---------------- */
function fieldHtml(f) {
  const req = f.required ? ' <span class="rq">*</span>' : '';
  const hint = f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '';
  const name = 'name="' + esc(f.id) + '"';
  const must = f.required ? ' required' : '';
  let ctl = '';
  if (f.type === 'textarea') ctl = '<textarea ' + name + must + ' rows="4"></textarea>';
  else if (f.type === 'select') {
    ctl = '<select ' + name + must + '><option value="">Tanlang…</option>' +
      f.options.map(o => '<option value="' + esc(o) + '">' + esc(o) + '</option>').join('') + '</select>';
  } else if (f.type === 'radio' || f.type === 'checkbox') {
    const t = f.type;
    ctl = '<div class="opts">' + f.options.map((o, i) =>
      '<label class="opt"><input type="' + t + '" name="' + esc(f.id) + '" value="' + esc(o) + '"' +
      (t === 'radio' && f.required && i === 0 ? ' required' : '') + '><span>' + esc(o) + '</span></label>').join('') + '</div>';
  } else if (f.type === 'phone') {
    const cc = cleanCc(f.cc);
    ctl = '<div class="tel"><span class="cc">' + esc(cc) + '</span>' +
      '<input type="tel" ' + name + ' required inputmode="numeric" autocomplete="tel-national" data-cc="' + esc(cc) + '"' +
      (cc === DEFAULT_CC ? ' placeholder="90 123 45 67" maxlength="12"' : ' placeholder="Raqam" maxlength="16"') + '></div>';
  } else if (f.type === 'referral') ctl = '<input type="text" ' + name + must + ' maxlength="8" placeholder="Masalan: K7M2Q" style="text-transform:uppercase" autocomplete="off">';
  else if (f.type === 'number') ctl = '<input type="number" ' + name + must + ' inputmode="decimal">';
  else if (f.type === 'date') ctl = '<input type="date" ' + name + must + '>';
  else ctl = '<input type="text" ' + name + must + ' autocomplete="' + (/ism|name/i.test(f.label) ? 'name' : 'off') + '">';
  return '<div class="fld"><label>' + esc(f.label) + req + '</label>' + ctl + hint + '</div>';
}

/** Markaz sozlamalaridan sukutdagi kontaktlar ro'yxati (markaz tahrirlashi mumkin) */
function defaultContacts(settings) {
  const s = settings || {};
  const out = [];
  const phone = txt(s.phone || seo.DEFAULT_PHONE, 40);
  if (phone) out.push({ on: true, icon: '📞', label: 'Telefon', value: phone, link: 'tel:' + phone.replace(/[^\d+]/g, '') });
  const addr = txt(s.address || seo.DEFAULT_ADDRESS, 160);
  if (addr) out.push({ on: true, icon: '📍', label: 'Manzil', value: addr, link: '' });
  if (seo.hours(s.workStart, s.workEnd)) out.push({ on: true, icon: '🕘', label: 'Ish vaqti', value: s.workStart + ' – ' + s.workEnd + ', dushanba–shanba', link: '' });
  const tg = seo.telegram(s.tgQabul || s.telegram || s.tgChannel || (s.bot && s.bot.username));
  if (tg) out.push({ on: true, icon: '✈️', label: 'Telegram', value: 'Telegram orqali yozish', link: tg });
  const igRaw = String(s.instagram || '').trim();
  const ig = igRaw ? seo.instagram(/^https?:/i.test(igRaw) ? igRaw : 'https://www.instagram.com/' + igRaw.replace(/^@/, '') + '/') : '';
  if (ig) out.push({ on: true, icon: '📷', label: 'Instagram', value: 'Instagram', link: ig });
  return out;
}
/** Markaz tahrirlagan kontaktlar ro'yxatini tozalash. Qaytgan qiymat:
    massiv (tahrirlangan) yoki null (sukutdagi — sozlamalardan).        */
function cleanContacts(list) {
  if (!Array.isArray(list)) return null;
  const out = list.slice(0, 15).map(c => {
    if (!c || typeof c !== 'object') return null;
    const label = txt(c.label, 40);
    const value = txt(c.value, 200);
    if (!label && !value) return null;
    let link = txt(c.link, 300);
    if (link && !/^(tel:|mailto:|https:\/\/)/i.test(link)) link = '';
    return { on: c.on !== false, icon: txt(c.icon, 4) || '•', label, value, link };
  }).filter(Boolean);
  return out.length ? out : null;
}

/** Kontaktlar va ma'lumot bo'limi — markaz tahrirlagan ro'yxat yoki sozlamalardan */
function contactHtml(v, settings) {
  if (!v.contact && !v.info) return '';
  const rows = [];
  if (v.info) rows.push('<p class="info-t">' + esc(v.info) + '</p>');
  if (v.contact) {
    const list = (Array.isArray(v.contacts) && v.contacts.length) ? v.contacts : defaultContacts(settings);
    list.forEach(c => {
      if (!c || c.on === false) return;
      const val = esc(c.value || c.label || '');
      if (!val) return;
      const icon = esc(c.icon || '•');
      if (c.link && /^(tel:|mailto:|https:\/\/)/i.test(c.link)) {
        const ext = /^tel:|^mailto:/.test(c.link) ? '' : ' target="_blank" rel="noopener"';
        rows.push('<div class="ct"><span>' + icon + '</span><a href="' + esc(c.link) + '"' + ext + '>' + val + '</a></div>');
      } else {
        rows.push('<div class="ct"><span>' + icon + '</span><span>' + val + '</span></div>');
      }
    });
  }
  if (!rows.length) return '';
  return '<details class="info" id="info"><summary>Kontaktlar va ma’lumot</summary><div class="info-b">' + rows.join('') + '</div></details>';
}

/** opts: { bgv, logov, bannerv } — rasm versiyalari (kesh uchun);
          { inline: { bg, logo, banner } } — namuna uchun data URL;
          { preview: true } — yuborish o'chiq, statistika yozilmaydi. */
function page(form, settings, opts) {
  opts = opts || {};
  const v = publicView(form);
  const inline = opts.inline || {};
  const center = esc((settings && settings.centerName) || 'AlBayan Cairo');
  const src = (kind, ver) => inline[kind]
    ? inline[kind]
    : '/api/form-bg?id=' + encodeURIComponent(form.id) + '&kind=' + kind + '&v=' + (ver || 0);
  const hasBg = v.bg === 'rasm' || !!inline.bg;
  const bgStyle = hasBg
    ? 'background:#0f2a5a url(' + esc(src('bg', opts.bgv)) + ') center/cover no-repeat fixed'
    : 'background:' + v.bgCss;
  const dark = hasBg || /#fff/i.test(v.ink);
  const logo = (v.logo || inline.logo) ? '<img class="logo" src="' + esc(src('logo', opts.logov)) + '" alt="' + center + '">' : '';
  const banner = (v.banner || inline.banner) ? '<img class="banner" src="' + esc(src('banner', opts.bannerv)) + '" alt="">' : '';
  return '<!doctype html><html lang="uz"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="robots" content="noindex">' +
    '<title>' + esc(form.title) + ' — ' + center + '</title>' +
    '<style>' +
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%}' +
    'body{font:16px/1.5 -apple-system,"Segoe UI",Roboto,Inter,sans-serif;color:#111;' + bgStyle + ';padding:24px 16px calc(32px + env(safe-area-inset-bottom))}' +
    '.card{max-width:560px;margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:26px 22px 22px;overflow:hidden}' +
    '.card:has(.banner){padding-top:0}.banner{display:block;width:calc(100% + 44px);margin:0 -22px 18px;max-height:260px;object-fit:cover}' +
    '.logo{display:block;max-height:76px;max-width:220px;margin:0 auto 14px;object-fit:contain}' +
    '.brand{text-align:center;color:' + (dark ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.7)') + ';font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:12px;margin:0 0 14px}' +
    'h1{font-size:24px;line-height:1.2;margin:0 0 8px;text-wrap:balance}.intro{color:#555;margin:0 0 18px;white-space:pre-line}' +
    '.fld{margin:0 0 16px}label{display:block;font-weight:600;font-size:14px;margin:0 0 6px}.rq{color:#dc2626}' +
    'input[type=text],input[type=tel],input[type=number],input[type=date],select,textarea{width:100%;font:inherit;padding:11px 12px;border:1.5px solid #d1d5db;border-radius:10px;background:#fff;color:#111}' +
    'input:focus,select:focus,textarea:focus{outline:none;border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(29,78,216,.15)}' +
    '.tel{display:flex;align-items:stretch}.tel .cc{display:flex;align-items:center;padding:0 12px;border:1.5px solid #d1d5db;border-right:0;border-radius:10px 0 0 10px;background:#f3f4f6;font-weight:600;color:#374151;white-space:nowrap}' +
    '.tel input{border-radius:0 10px 10px 0;letter-spacing:.04em}' +
    '.opts{display:flex;flex-direction:column;gap:8px}.opt{display:flex;gap:10px;align-items:center;font-weight:400;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;margin:0}' +
    '.opt:has(input:checked){border-color:#1d4ed8;background:#eff6ff}.opt input{width:18px;height:18px;margin:0;accent-color:#1d4ed8}' +
    '.hint{font-size:12px;color:#6b7280;margin-top:4px}' +
    'button{width:100%;font:inherit;font-weight:700;font-size:16px;padding:14px;border:0;border-radius:12px;background:#1d4ed8;color:#fff;cursor:pointer;margin-top:4px}' +
    'button:disabled{opacity:.6}.err{color:#b91c1c;font-size:14px;margin:8px 0 0;min-height:1em}' +
    '.ok{text-align:center;padding:30px 10px}.ok .t{font-size:40px}.ok p{font-size:17px;white-space:pre-line}' +
    '.info{max-width:560px;margin:14px auto 0;background:rgba(255,255,255,.94);border-radius:14px;padding:4px 16px;color:#111}' +
    '.info summary{cursor:pointer;font-weight:600;padding:10px 0;list-style:none;display:flex;justify-content:space-between}.info summary::-webkit-details-marker{display:none}' +
    '.info summary::after{content:"+";font-weight:400;color:#6b7280}.info[open] summary::after{content:"–"}' +
    '.info-b{padding:0 0 12px;display:flex;flex-direction:column;gap:8px}.info-t{margin:0 0 4px;white-space:pre-line;color:#374151}' +
    '.ct{display:flex;gap:10px;align-items:flex-start}.ct a{color:#1d4ed8;text-decoration:none;font-weight:600}' +
    '.foot{text-align:center;font-size:12px;color:' + (dark ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.5)') + ';margin-top:18px}' +
    '.pv{position:fixed;top:0;left:0;right:0;background:#f59e0b;color:#111;text-align:center;font-size:13px;font-weight:600;padding:6px;z-index:9}' +
    '@media(prefers-reduced-motion:no-preference){.card{animation:in .35s ease-out}@keyframes in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}}' +
    '</style></head><body>' +
    (opts.preview ? '<div class="pv">Namuna — yuborish ishlamaydi</div>' : '') +
    '<p class="brand">' + center + '</p>' +
    '<div class="card" id="card">' + banner + logo +
    '<form id="f" novalidate>' +
    '<h1>' + esc(form.title) + '</h1>' +
    (v.intro ? '<p class="intro">' + esc(v.intro) + '</p>' : '') +
    v.fields.map(fieldHtml).join('') +
    '<button type="submit" id="btn">' + esc(v.button) + '</button>' +
    '<div class="err" id="err" aria-live="polite"></div>' +
    '</form></div>' +
    contactHtml(v, settings) +
    '<p class="foot">' + center + '</p>' +
    '<script>' +
    'var F=' + JSON.stringify({ slug: form.slug, thanks: v.thanks, preview: !!opts.preview }).replace(/</g, '\\u003c') + ';' +
    'var fm=document.getElementById("f"),btn=document.getElementById("btn"),er=document.getElementById("err");' +
    /* Statistika: sahifa ochildi / yozishni boshladi / maydonga yetdi */
    'function ev(e,f){if(F.preview)return;try{var b=JSON.stringify({slug:F.slug,ev:e,field:f||""});' +
    'if(navigator.sendBeacon){navigator.sendBeacon("/api/form/event",new Blob([b],{type:"application/json"}));}' +
    'else{fetch("/api/form/event",{method:"POST",headers:{"Content-Type":"application/json"},body:b,keepalive:true}).catch(function(){});}}catch(x){}}' +
    'ev("view");var started=false,reached={};' +
    'fm.addEventListener("focusin",function(e){var el=e.target;if(!el||!el.name)return;' +
    'if(!started){started=true;ev("start");}if(!reached[el.name]){reached[el.name]=1;ev("reach",el.name);}});' +
    /* Telefon: faqat raqam, "90 123 45 67" ko'rinishida */
    'Array.prototype.forEach.call(fm.querySelectorAll("input[type=tel]"),function(t){' +
    'function fmt(){var cc=(t.getAttribute("data-cc")||"+998").slice(1);var raw=t.value;var d=raw.replace(/\\D/g,"");' +
    'if(/^\\s*\\+/.test(raw)){if(d.length<=cc.length&&cc.indexOf(d)===0){t.value="+"+d;return;}if(d.indexOf(cc)===0)d=d.slice(cc.length);}' +
    'else if(d.length>9&&d.indexOf(cc)===0)d=d.slice(cc.length);' +
    'if(cc==="998"){d=d.slice(0,9);t.value=d.replace(/^(\\d{2})(\\d{0,3})(\\d{0,2})(\\d{0,2}).*$/,function(m,a,b,c,e){return[a,b,c,e].filter(Boolean).join(" ");});}' +
    'else t.value=d.slice(0,12);}' +
    't.addEventListener("input",fmt);t.addEventListener("blur",fmt);});' +
    'fm.addEventListener("submit",function(e){e.preventDefault();' +
    'var a={};Array.prototype.forEach.call(fm.elements,function(el){if(!el.name)return;' +
    'if(el.type==="checkbox"){a[el.name]=a[el.name]||[];if(el.checked)a[el.name].push(el.value);return;}' +
    'if(el.type==="radio"){if(el.checked)a[el.name]=el.value;else if(!(el.name in a))a[el.name]="";return;}' +
    'a[el.name]=el.value;});' +
    'if(F.preview){er.textContent="Bu namuna: haqiqiy havolada ariza Murojaatlarga tushadi.";return;}' +
    'btn.disabled=true;er.textContent="";' +
    'fetch("/api/form/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:F.slug,answers:a})})' +
    '.then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})' +
    '.then(function(x){if(!x.ok){er.textContent=x.j.error||"Yuborilmadi. Qayta urinib ko\\u2019ring.";btn.disabled=false;return;}' +
    'document.getElementById("card").innerHTML=\'<div class="ok"><div class="t">\\u2705</div><p>\'+F.thanks.replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c]})+\'</p></div>\';' +
    'window.scrollTo(0,0);})' +
    '.catch(function(){er.textContent="Internet bilan muammo. Qayta urinib ko\\u2019ring.";btn.disabled=false;});});' +
    '</script></body></html>';
}

/** Namuna uchun: saqlanmagan ma'lumotdan vaqtinchalik shakl */
function draft(data) {
  const title = txt(data && data.title, 120) || 'Forma nomi';
  const bgTpl = TEMPLATES.some(t => t.id === (data && data.bg)) ? data.bg : '';
  return {
    id: validId(data && data.id) ? data.id : 'namuna', slug: 'namuna', title,
    intro: txt(data && data.intro, 600),
    thanks: txt(data && data.thanks, 300) || 'Rahmat! Arizangiz qabul qilindi.',
    button: txt(data && data.button, 40) || 'Yuborish',
    bg: bgTpl || (data && data.bg === 'rasm' ? 'rasm' : TEMPLATES[0].id),
    fields: cleanFields(data && data.fields),
    contact: !(data && data.contact === false), contacts: cleanContacts(data && data.contacts), info: txt(data && data.info, 1000),
    logo: !!(data && data.logo), banner: !!(data && data.banner), active: true
  };
}

module.exports = {
  COL, BG, SUB, STAT, TYPES, TEMPLATES, MAX_FIELDS, IMG, EVENTS, DEFAULT_CC,
  slugify, validSlug, validId, save, saveBg, saveImg, delImg, imgPath, validImage, bySlug,
  publicView, checkAnswers, phoneOf, recordEvent, emptyStat, serial, page, draft, defaultContacts, cleanContacts, listCol, rid, txt
};
