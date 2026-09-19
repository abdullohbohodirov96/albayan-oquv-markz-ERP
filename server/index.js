/* Albyana ERP — server: ilova + API + Telegram bot bir jarayonda.
   Ishga tushirish:  node server/index.js                                  */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

try { require('dotenv').config(); } catch (e) { /* dotenv ixtiyoriy */ }

const { createStore } = require('./store');
const { A, writePermFor, readBlocked, safeUser } = require('./shared');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const store = createStore();

/* ---------------- Yordamchi ---------------- */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
function hashPass(login, pass, salt) {
  return sha256(String(login).toLowerCase() + '::' + pass + '::' + salt);
}
function stamp() {
  const d = new Date(Date.now() + 5 * 3600 * 1000); // Asia/Tashkent
  const p = n => (n < 10 ? '0' + n : '' + n);
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
    ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
function send(res, code, body, headers) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, Object.assign({
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => {
      d += c;
      if (d.length > 4e6) { reject(new Error('So’rov juda katta')); req.destroy(); }
    });
    req.on('end', () => {
      if (!d) return resolve({});
      try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('Noto’g’ri JSON')); }
    });
    req.on('error', reject);
  });
}

/* ---------------- Sessiyalar ---------------- */
const sessions = new Map();               // token -> {userId, at}
const SESSION_MS = Number(process.env.SESSION_MAX_AGE_DAYS || 7) * 864e5;

function newToken() { return crypto.randomBytes(24).toString('hex'); }
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
async function currentUser(req) {
  const token = parseCookies(req).alb_session;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.at > SESSION_MS) { sessions.delete(token); return null; }
  const u = await store.get('users/' + s.userId);
  if (!u || u.active === false) return null;
  return u;
}

/* ---------------- Dastlabki sozlash ---------------- */
async function ensureSeed() {
  const settings = await store.get('meta/settings');
  if (!settings) {
    await store.set('meta/settings', {
      centerName: process.env.APP_NAME || 'Albyana',
      address: '', phone: '', workStart: '08:00', workEnd: '20:00', dueDay: 5,
      expenseCategories: ['Ijara', 'Kommunal', 'Reklama', 'Jihozlar', 'Xo’jalik', 'Ish haqi', 'Boshqa'],
      bot: {
        username: process.env.TELEGRAM_BOT_USERNAME || '',
        welcome: 'Assalomu alaykum! Albyana o’quv markazi botiga xush kelibsiz.',
        notifyAttendance: true, notifyPayment: true, notifyDebt: true, autoApprove: false
      },
      createdAt: stamp()
    });
  }
  const users = await store.list('users/');
  if (!users.length) {
    const login = (process.env.SEED_DIRECTOR_LOGIN || 'admin').toLowerCase();
    const pass = process.env.SEED_DIRECTOR_PASSWORD || '';
    if (!pass) {
      console.log('\n  DIQQAT: direktor hisobi yaratilmadi.');
      console.log('  .env faylga SEED_DIRECTOR_LOGIN va SEED_DIRECTOR_PASSWORD yozing va serverni qayta ishga tushiring.\n');
      return;
    }
    const salt = crypto.randomBytes(6).toString('hex');
    await store.set('users/usr_admin', {
      id: 'usr_admin', login, name: 'Direktor', role: 'direktor', staffId: null,
      salt, hash: hashPass(login, pass, salt), active: true, isDefault: false, createdAt: stamp()
    });
    console.log('  Direktor hisobi yaratildi: ' + login);
  }
}

/* ---------------- API ---------------- */
const COLLECTIONS = ['users', 'staff', 'courses', 'rooms', 'students', 'groups', 'memberships',
  'leads', 'tasks', 'chats', 'botreq', 'botout', 'botin'];

async function apiBootstrap(user) {
  const all = await store.all();
  const col = {};
  COLLECTIONS.forEach(c => { col[c] = {}; });
  const docs = {};
  let settings = null;

  all.forEach(({ path: p, data }) => {
    const seg = p.split('/');
    if (p === 'meta/settings') { settings = data; return; }
    if (seg[0] === 'botstate') return;
    if (COLLECTIONS.indexOf(seg[0]) >= 0 && seg.length === 2) {
      if (seg[0] === 'users') col.users[seg[1]] = safeUser(data);
      else col[seg[0]][seg[1]] = data;
      return;
    }
    if (readBlocked(p, user)) return;
    docs[p] = data;
  });

  return {
    settings,
    col,
    docs,
    finindex: (await store.get('meta/finindex')) || { invoices: [], payments: [], expenses: [], payroll: [], audit: [] },
    me: safeUser(user),
    serverTime: stamp()
  };
}

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/^\/api\//, '');

  if (route === 'health') return send(res, 200, { ok: true, mode: store.kind });

  if (route === 'login' && req.method === 'POST') {
    const body = await readBody(req);
    const login = String(body.login || '').toLowerCase().trim();
    const pass = String(body.password || '');
    const users = await store.list('users/');
    const u = users.map(x => x.data).filter(x => String(x.login).toLowerCase() === login)[0];
    if (!u || u.active === false || hashPass(u.login, pass, u.salt) !== u.hash) {
      return send(res, 401, { error: 'Login yoki parol xato.' });
    }
    const token = newToken();
    sessions.set(token, { userId: u.id, at: Date.now() });
    return send(res, 200, { user: safeUser(u) }, {
      'Set-Cookie': 'alb_session=' + token + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' +
        Math.floor(SESSION_MS / 1000) + (process.env.NODE_ENV === 'production' ? '; Secure' : '')
    });
  }

  if (route === 'logout' && req.method === 'POST') {
    const token = parseCookies(req).alb_session;
    if (token) sessions.delete(token);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'alb_session=; HttpOnly; Path=/; Max-Age=0' });
  }

  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Kirish talab qilinadi.' });

  if (route === 'me') return send(res, 200, { user: safeUser(user) });
  if (route === 'bootstrap') return send(res, 200, await apiBootstrap(user));

  if (route === 'collection' && req.method === 'GET') {
    const name = String(url.searchParams.get('name') || '');
    if (COLLECTIONS.indexOf(name) < 0) return send(res, 400, { error: 'Noma’lum ro’yxat.' });
    const rows = await store.list(name + '/');
    const items = {};
    rows.forEach(({ path: p, data }) => {
      const seg = p.split('/');
      if (seg.length !== 2) return;
      items[seg[1]] = name === 'users' ? safeUser(data) : data;
    });
    return send(res, 200, { items });
  }

  if (route === 'doc') {
    const p = String(url.searchParams.get('path') || '');
    if (!/^[A-Za-z0-9_\-./~:@+]+$/.test(p) || p.split('/').length % 2 !== 0) {
      return send(res, 400, { error: 'Noto’g’ri yo’l.' });
    }
    if (req.method === 'GET') {
      if (readBlocked(p, user)) return send(res, 403, { error: 'Ruxsat yo’q.' });
      const data = await store.get(p);
      if (p.indexOf('users/') === 0) return send(res, 200, { data: safeUser(data) });
      return send(res, 200, { data });
    }
    const perm = writePermFor(p);
    if (perm === '__server__') return send(res, 403, { error: 'Bu ma’lumotni faqat server yozadi.' });
    if (perm && !A.can(user, perm)) return send(res, 403, { error: 'Sizda bu amal uchun ruxsat yo’q.' });

    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!body || typeof body.data !== 'object' || body.data === null) {
        return send(res, 400, { error: 'Ma’lumot noto’g’ri.' });
      }
      // parol hash'ini mijoz o'zgartira olmasin (faqat users.manage orqali keladi)
      if (p.indexOf('users/') === 0) {
        const old = await store.get(p);
        if (old && !body.data.hash) { body.data.salt = old.salt; body.data.hash = old.hash; }
      }
      await store.set(p, body.data);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      await store.del(p);
      return send(res, 200, { ok: true });
    }
  }

  return send(res, 404, { error: 'Topilmadi.' });
}

/* ---------------- Statik fayllar ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  rel = rel.replace(/\.\./g, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) return send(res, 403, 'Taqiqlangan');
  fs.readFile(file, (err, data) => {
    if (err) {
      if (rel !== '/index.html') return serveStatic(req, res, '/index.html');
      return send(res, 404, 'Topilmadi');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------------- Server ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  try {
    if (url.pathname.indexOf('/api/') === 0) return await handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message || 'Server xatosi' });
  }
});

(async function start() {
  await ensureSeed();
  server.listen(PORT, () => {
    console.log('\n  Albyana ERP ishga tushdi: http://localhost:' + PORT);
    console.log('  Ombor: ' + store.kind + (store.file ? ' (' + store.file + ')' : ''));
  });
  if (process.env.TELEGRAM_BOT_TOKEN) {
    require('./bot').start({ store, stamp, A });
  } else {
    console.log('  Telegram bot o’chirilgan (TELEGRAM_BOT_TOKEN berilmagan).\n');
  }
})();

module.exports = { server, store };
