/* Telefoniya (Sipuni / OnlinePBX / umumiy webhook) va tavsiya bonusi.

   TELEFONIYA
   ----------
   Markaz IP-telefoniya (SIP) ishlatadi. PBX har qo'ng'iroq haqida
   webhook yuboradi:  POST /api/tel/webhook/<token>
   Server uni tushunadi va:
     • calls/<id> ga yozadi (raqam, yo'nalish, holat, davomiylik, yozuv havolasi)
     • raqam bo'yicha o'quvchi yoki murojaatni topadi; topilmasa va
       qo'ng'iroq KIRUVCHI bo'lsa — yangi murojaat ochadi (manba "Qo‘ng‘iroq")
     • javobsiz kiruvchi qo'ng'iroq → "Qayta qo‘ng‘iroq qiling" vazifasi
   ERP ichidan "Qo‘ng‘iroq" tugmasi PBX ga buyruq beradi (click-to-call):
   xodimning ichki raqami (ext) jiringlaydi, keyin mijozga ulaydi.

   Sirlar (API kalit, webhook tokeni) faqat meta/telsecret da — bu hujjat
   bootstrap, zaxira yuklab olish va mijozga hech qachon chiqmaydi.
   Ochiq sozlama (provayder, yoqilgan, xodim → ext) meta/settings.tel da.

   TAVSIYA BONUSI ("Do‘stingni olib kel")
   ---------------------------------------
   Har o'quvchida qisqa kod (refCode). Yangi murojaat/o'quvchi shu kod
   bilan kelsa — referrals/<id> ochiladi (kutilmoqda). Yangi o'quvchi
   birinchi to'lovini qilganda bonus "tayyor" bo'ladi; direktor uni
   tavsiya qilgan o'quvchining ochiq hisobiga chegirma qilib qo'llaydi.
   Pul avtomatik hech qayerga yozilmaydi — faqat odam tasdiqlaganda.   */
'use strict';
const crypto = require('crypto');

const CALLS = 'calls/';
const REFS = 'referrals/';
const SECRET = 'meta/telsecret';
const PROVIDERS = ['sipuni', 'onlinepbx', 'umumiy'];

function txt(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max || 200); }
function rid(p) { return p + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'); }
function stampOf(opts) {
  return (opts && typeof opts.stamp === 'function') ? opts.stamp() : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function safeEq(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/* ---------------- Sozlama ---------------- */
async function getSecret(store) { return (await store.get(SECRET)) || {}; }
function publicConf(settings) {
  const t = (settings && settings.tel) || {};
  return {
    enabled: t.enabled === true,
    provider: PROVIDERS.indexOf(t.provider) >= 0 ? t.provider : 'umumiy',
    exts: (t.exts && typeof t.exts === 'object') ? t.exts : {},
    missedTask: t.missedTask !== false,
    autoLead: t.autoLead !== false
  };
}
/** Sozlamani saqlash: ochiq qismi meta/settings.tel, sirlar meta/telsecret */
async function saveConf(store, body, settings) {
  const cur = publicConf(settings);
  const t = {
    enabled: body.enabled === true,
    provider: PROVIDERS.indexOf(body.provider) >= 0 ? body.provider : cur.provider,
    exts: {},
    missedTask: body.missedTask !== false,
    autoLead: body.autoLead !== false
  };
  const exts = (body.exts && typeof body.exts === 'object') ? body.exts : cur.exts;
  Object.keys(exts).slice(0, 200).forEach(k => {
    const v = txt(exts[k], 12).replace(/[^0-9A-Za-z_-]/g, '');
    if (v && /^[A-Za-z0-9_\-]{1,40}$/.test(k)) t.exts[k] = v;
  });
  const sec = await getSecret(store);
  if (!sec.webhookToken || body.rotate === true) sec.webhookToken = crypto.randomBytes(18).toString('hex');
  ['apiUser', 'apiKey', 'apiSecret', 'domain', 'apiBase'].forEach(k => {
    if (typeof body[k] === 'string' && body[k].trim()) sec[k] = txt(body[k], 300);
    if (body[k] === null) delete sec[k];
  });
  await store.set(SECRET, sec);
  settings.tel = t;
  await store.set('meta/settings', settings);
  return { conf: t, webhookToken: sec.webhookToken, has: maskOf(sec) };
}
function maskOf(sec) {
  return { apiUser: !!sec.apiUser, apiKey: !!sec.apiKey, apiSecret: !!sec.apiSecret, domain: sec.domain || '', apiBase: !!sec.apiBase };
}

/* ---------------- Raqam ---------------- */
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  if (d.length === 12 && d.slice(0, 3) === '998') return '+' + d;
  return d.length >= 7 ? '+' + d : '';
}
function last9(v) { return String(v || '').replace(/\D/g, '').slice(-9); }
function isExt(v) { return /^\d{2,5}$/.test(String(v || '').trim()); }

/* ---------------- Webhook ni tushunish ----------------
   Sipuni:     event, number (mijoz), to/dst, status (ANSWER|NOANSWER|BUSY),
               duration/timeTalk, record, call_id, user (ext)
   OnlinePBX:  event (call_start|call_end), direction (inbound|outbound),
               caller_id_number, destination_number, billsec, duration,
               hangup_cause, download_url, uuid
   Umumiy:     phone, direction (in|out), status (answered|missed|busy),
               duration, record, ext, callId, final (true = tugadi)        */
function parseEvent(raw) {
  const d = (raw && typeof raw === 'object') ? raw : {};
  const g = (...keys) => { for (const k of keys) { if (d[k] != null && d[k] !== '') return d[k]; } return ''; };
  const ev = String(g('event', 'type', 'action')).toLowerCase();
  let dir = String(g('direction', 'dir')).toLowerCase();
  if (!dir) {
    if (/incoming|inbound|in$/.test(ev)) dir = 'in';
    else if (/outgoing|outbound|out$/.test(ev)) dir = 'out';
  }
  dir = /^(in|inbound|incoming)$/.test(dir) ? 'in' : (/^(out|outbound|outgoing)$/.test(dir) ? 'out' : '');
  const from = g('caller_id_number', 'caller', 'from', 'src', 'number', 'phone');
  const to = g('destination_number', 'destination', 'to', 'dst', 'called', 'phone');
  /* Mijoz raqami: kiruvchida — kim qo'ng'iroq qilgan; chiquvchida — kimga.
     Ichki raqam (2–5 xonali) mijoz raqami bo'la olmaydi.               */
  let phone = '', ext = String(g('user', 'ext', 'internal', 'extension', 'sipnumber')).trim();
  if (!dir) {
    if (isExt(from) && !isExt(to)) dir = 'out';
    else if (isExt(to) && !isExt(from)) dir = 'in';
    else dir = 'in';
  }
  const pick = v => (v && !isExt(v)) ? normPhone(v) : '';
  if (dir === 'in') { phone = pick(from) || pick(g('number', 'phone')); if (!ext && isExt(to)) ext = String(to).trim(); }
  else { phone = pick(to) || pick(g('number', 'phone')); if (!ext && isExt(from)) ext = String(from).trim(); }
  if (!phone) phone = pick(from) || pick(to);
  const dur = Number(g('billsec', 'timeTalk', 'talk_duration', 'duration', 'talk')) || 0;
  const st = String(g('status', 'hangup_cause', 'result')).toUpperCase();
  const final = d.final === true || /end|completed|hangup|finish|missed|answered/.test(ev) || !!st;
  let status = '';
  if (dur > 0 || /^(ANSWER|ANSWERED|NORMAL_CLEARING|SUCCESS)$/.test(st)) status = 'answered';
  else if (/busy/i.test(st)) status = 'busy';
  else if (final) status = 'missed';
  else status = 'ringing';
  const record = String(g('download_url', 'record', 'record_link', 'recording', 'record_url')).trim();
  return {
    callId: txt(g('uuid', 'call_id', 'callId', 'id'), 80),
    phone, dir, ext, status, final, duration: Math.max(0, Math.round(dur)),
    record: /^https?:\/\//.test(record) ? record.slice(0, 500) : ''
  };
}

/* ---------------- Webhook ni qayta ishlash ---------------- */
async function listCol(store, col) {
  return (await store.list(col)).filter(r => r.path.split('/').length === 2).map(r => r.data).filter(Boolean);
}
async function findByPhone(store, phone) {
  const k = last9(phone);
  if (!k) return {};
  const students = (await listCol(store, 'students/')).filter(s => last9(s.phone) === k || last9(s.parentPhone) === k);
  const leads = (await listCol(store, 'leads/')).filter(l => last9(l.phone) === k);
  return { student: students[0] || null, lead: leads.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null };
}

/** Qo'ng'iroq voqeasi: calls/ ga yozish, murojaat/vazifa ochish.
    opts: { A, settings, stamp, today, writeAudit }                 */
async function handleEvent(store, raw, opts) {
  const e = parseEvent(raw);
  if (!e.phone) return { ok: false, reason: 'raqam' };
  const conf = publicConf(opts.settings);
  const now = stampOf(opts);
  const today = opts.today || now.slice(0, 10);
  /* Bir qo'ng'iroq bir yozuv: boshlanish va tugash voqealari birlashadi */
  let rec = null;
  if (e.callId) {
    const same = (await listCol(store, CALLS)).filter(c => c.callId === e.callId)[0];
    if (same) rec = same;
  }
  if (!rec) {
    rec = { id: rid('cl'), callId: e.callId, phone: e.phone, dir: e.dir, ext: e.ext, status: 'ringing', duration: 0, record: '', at: now, leadId: '', studentId: '', name: '' };
    const who = await findByPhone(store, e.phone);
    if (who.student) { rec.studentId = who.student.id; rec.name = ((who.student.lastName || '') + ' ' + (who.student.firstName || '')).trim(); }
    else if (who.lead) { rec.leadId = who.lead.id; rec.name = who.lead.name || ''; }
    else if (e.dir === 'in' && conf.autoLead) {
      /* Notanish raqam qo'ng'iroq qildi — murojaat ochiladi */
      const funnels = (await store.list('funnels/')).map(x => x.data).filter(Boolean);
      const funnel = funnels.filter(x => x.isDefault)[0] || funnels[0] || null;
      const stages = funnel && opts.A ? opts.A.funnelStages(funnel) : [];
      const lid = rid('led_');
      await store.set('leads/' + lid, {
        id: lid, funnelId: funnel ? funnel.id : '', name: 'Qo‘ng‘iroq ' + e.phone, phone: e.phone,
        courseId: '', source: 'Qo‘ng‘iroq', ownerStaffId: '', stage: stages[0] ? stages[0].id : 'yangi',
        note: 'Telefon orqali murojaat qildi (' + now + ')', nextContact: today, createdAt: now, viaCall: true
      });
      rec.leadId = lid; rec.name = 'Qo‘ng‘iroq ' + e.phone; rec.newLead = true;
    }
  }
  if (e.ext) rec.ext = e.ext;
  if (e.status === 'answered' || (e.final && rec.status !== 'answered')) rec.status = e.status === 'ringing' ? 'missed' : e.status;
  else if (!e.final && rec.status !== 'answered') rec.status = 'ringing';
  if (e.duration) rec.duration = e.duration;
  if (e.record) rec.record = e.record;
  if (e.final) rec.endedAt = now;
  rec.updatedAt = now;
  await store.set(CALLS + rec.id, rec);

  /* Javobsiz kiruvchi → vazifa (bir qo'ng'iroq uchun bitta) */
  if (e.final && rec.status === 'missed' && rec.dir === 'in' && conf.missedTask && !rec.taskId) {
    const owner = await pickOwner(store, conf, rec);
    if (owner) {
      const tid = rid('tsk_');
      await store.set('tasks/' + tid, {
        id: tid, title: 'Qayta qo‘ng‘iroq qiling: ' + (rec.name || rec.phone),
        description: 'Javobsiz qo‘ng‘iroq ' + now + ' · ' + rec.phone + (rec.leadId ? ' · murojaat ochilgan' : ''),
        assigneeId: owner, createdById: '', status: 'yangi', due: today, createdAt: now,
        leadId: rec.leadId || '', studentId: rec.studentId || '', callId: rec.id, viaCall: true
      });
      rec.taskId = tid;
      await store.set(CALLS + rec.id, rec);
    }
  }
  if (opts.writeAudit) {
    try { await opts.writeAudit(null, 'Qo‘ng‘iroq', rec.phone, (rec.dir === 'in' ? 'kiruvchi' : 'chiquvchi') + ' · ' + rec.status); } catch (x) { /* tarix yozilmasa ham qo'ng'iroq saqlandi */ }
  }
  return { ok: true, call: rec };
}
/** Vazifa kimga: ext ga biriktirilgan xodim → murojaat mas'uli → birinchi faol admin/direktor */
async function pickOwner(store, conf, rec) {
  const exts = conf.exts || {};
  const byExt = Object.keys(exts).filter(uid => rec.ext && exts[uid] === rec.ext)[0];
  if (byExt) return byExt;
  const users = (await listCol(store, 'users/')).filter(u => u.active !== false);
  if (rec.leadId) {
    const lead = await store.get('leads/' + rec.leadId);
    if (lead && lead.ownerStaffId) {
      const u = users.filter(x => x.staffId === lead.ownerStaffId)[0];
      if (u) return u.id;
    }
  }
  const admin = users.filter(u => u.role === 'administrator')[0] || users.filter(u => u.role === 'direktor')[0];
  return admin ? admin.id : '';
}

/* ---------------- ERP dan qo'ng'iroq (click-to-call) ---------------- */
/** opts: { fetchFn } — sinovda soxta. Hech qachon sirlarni qaytarmaydi. */
async function placeCall(store, settings, userId, phone, opts) {
  const conf = publicConf(settings);
  if (!conf.enabled) return { ok: false, error: 'Telefoniya yoqilmagan (Sozlamalar → Telefoniya).' };
  const ext = conf.exts[userId];
  if (!ext) return { ok: false, error: 'Sizga ichki raqam (ext) biriktirilmagan. Sozlamalar → Telefoniya.' };
  const p = normPhone(phone);
  if (!p) return { ok: false, error: 'Raqam noto’g’ri.' };
  const sec = await getSecret(store);
  const f = (opts && opts.fetchFn) || fetch;
  let url, init;
  if (conf.provider === 'sipuni') {
    if (!sec.apiUser || !sec.apiSecret) return { ok: false, error: 'Sipuni API foydalanuvchi va kaliti kiritilmagan.' };
    const num = p.replace('+', '');
    const hash = crypto.createHash('md5').update([num, ext, sec.apiUser, sec.apiSecret].join('+')).digest('hex');
    url = (sec.apiBase || 'https://sipuni.com/api') + '/callback/call_number';
    init = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ phone: num, sipnumber: ext, user: sec.apiUser, hash }).toString() };
  } else if (conf.provider === 'onlinepbx') {
    if (!sec.domain || !sec.apiKey) return { ok: false, error: 'OnlinePBX domen va kalit kiritilmagan.' };
    url = (sec.apiBase || 'https://api2.onlinepbx.ru') + '/' + sec.domain + '/call/now.json';
    init = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-pbx-authentication': sec.apiKey },
      body: new URLSearchParams({ from: ext, to: p.replace('+', '') }).toString() };
  } else {
    if (!sec.apiBase) return { ok: false, error: 'Umumiy provayder uchun API manzili kiritilmagan.' };
    url = sec.apiBase;
    init = { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, sec.apiKey ? { Authorization: 'Bearer ' + sec.apiKey } : {}),
      body: JSON.stringify({ from: ext, to: p }) };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await f(url, Object.assign({ signal: ctrl.signal }, init));
    clearTimeout(t);
    const text = await r.text().catch(() => '');
    if (!r.ok) return { ok: false, error: 'PBX javobi: ' + r.status + ' ' + text.slice(0, 120) };
    const rec = { id: rid('cl'), callId: '', phone: p, dir: 'out', ext, status: 'ringing', duration: 0, record: '', at: stampOf(opts), byUserId: userId, name: '' };
    const who = await findByPhone(store, p);
    if (who.student) { rec.studentId = who.student.id; rec.name = ((who.student.lastName || '') + ' ' + (who.student.firstName || '')).trim(); }
    else if (who.lead) { rec.leadId = who.lead.id; rec.name = who.lead.name || ''; }
    await store.set(CALLS + rec.id, rec);
    return { ok: true, call: rec };
  } catch (e) {
    return { ok: false, error: 'PBX ga ulanib bo’lmadi: ' + (e.name === 'AbortError' ? 'javob kutish vaqti tugadi' : e.message) };
  }
}

/* ---------------- Tavsiya bonusi ---------------- */
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newRefCode() {
  let s = '';
  const b = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) s += REF_ALPHABET[b[i] % REF_ALPHABET.length];
  return s;
}
function normRefCode(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
async function ensureRefCode(store, student, others) {
  if (student.refCode && normRefCode(student.refCode) === student.refCode) return student.refCode;
  const all = others || await listCol(store, 'students/');
  const used = {};
  all.forEach(s => { if (s.refCode) used[s.refCode] = 1; });
  let c = newRefCode();
  while (used[c]) c = newRefCode();
  return c;
}
async function studentByRefCode(store, code) {
  const c = normRefCode(code);
  if (!c) return null;
  return (await listCol(store, 'students/')).filter(s => s.refCode === c)[0] || null;
}
function refConf(settings) {
  const r = (settings && settings.referral) || {};
  const amount = Math.max(0, Math.round(Number(r.amount) || 0));
  return {
    enabled: r.enabled === true,
    amount,
    text: txt(r.text, 300) || ('Do‘stingizni olib keling — ' + (amount ? amount.toLocaleString('ru-RU') + ' so‘m chegirma' : 'bonus') + ' olasiz.')
  };
}
/** Yangi o'quvchi tavsiya bilan kelgan — yozuv ochiladi (bir juft uchun bitta) */
async function openReferral(store, referrerId, referredId, opts) {
  if (!referrerId || !referredId || referrerId === referredId) return null;
  const same = (await listCol(store, REFS)).filter(r => r.referredId === referredId)[0];
  if (same) return same;
  const amount = refConf(opts && opts.settings).amount;
  const rec = { id: rid('ref_'), referrerId, referredId, status: 'kutilmoqda', amount, createdAt: stampOf(opts), leadId: (opts && opts.leadId) || '' };
  await store.set(REFS + rec.id, rec);
  return rec;
}
/** Tavsiya qilingan o'quvchi birinchi to'lovini qildi → bonus tayyor */
async function onFirstPayment(store, studentId, opts) {
  const refs = (await listCol(store, REFS)).filter(r => r.referredId === studentId && r.status === 'kutilmoqda');
  for (const r of refs) {
    r.status = 'tayyor'; r.readyAt = stampOf(opts);
    if (!r.amount) r.amount = refConf(opts && opts.settings).amount;
    await store.set(REFS + r.id, r);
  }
  return refs.length;
}
/** Bonusni hisobga qo'llash: tavsiya qilgan o'quvchining ochiq hisobidan ayiriladi */
async function applyReferral(store, refId, invoiceId, opts) {
  const r = await store.get(REFS + String(refId || ''));
  if (!r) return { ok: false, error: 'Tavsiya yozuvi topilmadi.' };
  if (r.status !== 'tayyor') return { ok: false, error: r.status === 'berildi' ? 'Bonus allaqachon berilgan.' : 'Bonus hali tayyor emas — do‘sti birinchi to‘lovini qilsin.' };
  const inv = await store.get('invoices/' + String(invoiceId || ''));
  if (!inv) return { ok: false, error: 'Hisob topilmadi.' };
  if (inv.studentId !== r.referrerId) return { ok: false, error: 'Bu hisob tavsiya qilgan o‘quvchiniki emas.' };
  const amount = Math.max(0, Math.round(Number(r.amount) || 0));
  if (!amount) return { ok: false, error: 'Bonus summasi 0 — Sozlamalar → Tavsiya bonusi.' };
  const cut = Math.min(amount, Math.max(0, Math.round(Number(inv.final) || 0)));
  if (!cut) return { ok: false, error: 'Bu hisobda qoldiq yo‘q.' };
  inv.bonus = (Number(inv.bonus) || 0) + cut;
  inv.final = Math.round(Number(inv.final)) - cut;
  inv.bonusNote = 'Tavsiya bonusi';
  await store.set('invoices/' + inv.id, inv);
  r.status = 'berildi'; r.invoiceId = inv.id; r.appliedAt = stampOf(opts); r.applied = cut; r.by = (opts && opts.byUserId) || '';
  await store.set(REFS + r.id, r);
  return { ok: true, referral: r, invoice: inv, applied: cut };
}

module.exports = {
  CALLS, REFS, SECRET, PROVIDERS,
  publicConf, saveConf, getSecret, maskOf, parseEvent, handleEvent, placeCall, findByPhone, normPhone, safeEq,
  newRefCode, normRefCode, ensureRefCode, studentByRefCode, refConf, openReferral, onFirstPayment, applyReferral, listCol
};
