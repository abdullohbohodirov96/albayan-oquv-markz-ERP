/* Albyana server — hujjatlar ombori.
   DATABASE_URL berilgan bo'lsa PostgreSQL, aks holda SQLite fayli ishlatiladi.
   Ma'lumotlar ilovadagi bilan bir xil ko'rinishda saqlanadi: yo'l + JSON. */
'use strict';
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

/* Zaxira ombor: oddiy JSON fayl. Hech qanday qo'shimcha kutubxona talab qilmaydi.
   Kichik markaz uchun yetarli; yozish atomik (avval .tmp, keyin rename). */
function makeJsonFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, 'albyana.json');
  let docs = {};
  try { docs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { docs = {}; }
  let writing = null, dirty = false;
  function flush() {
    if (writing) { dirty = true; return writing; }
    writing = new Promise(resolve => {
      const tmp = file + '.tmp';
      fs.writeFile(tmp, JSON.stringify(docs), err => {
        if (!err) { try { fs.renameSync(tmp, file); } catch (e) { } }
        writing = null;
        if (dirty) { dirty = false; flush(); }
        resolve();
      });
    });
    return writing;
  }
  return {
    kind: 'json',
    file,
    async get(p) { return docs[p] ? JSON.parse(JSON.stringify(docs[p])) : null; },
    async set(p, data) { docs[p] = data; await flush(); },
    async del(p) { delete docs[p]; await flush(); },
    async list(prefix) {
      return Object.keys(docs).filter(k => k.indexOf(prefix) === 0)
        .map(k => ({ path: k, data: docs[k] }));
    },
    async all() { return Object.keys(docs).map(k => ({ path: k, data: docs[k] })); },
    async close() { await flush(); }
  };
}

function makeSqlite() {
  let Database;
  try { Database = require('better-sqlite3'); }
  catch (e) {
    return null;   // o'rnatilmagan — JSON omboriga o'tamiz
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, 'albyana.db');
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
  return {
    kind: 'sqlite',
    file,
    async get(p) {
      const row = db.prepare('SELECT data FROM docs WHERE path = ?').get(p);
      return row ? JSON.parse(row.data) : null;
    },
    async set(p, data) {
      db.prepare('INSERT INTO docs (path, data, updated_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(path) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
        .run(p, JSON.stringify(data), new Date().toISOString());
    },
    async del(p) {
      db.prepare('DELETE FROM docs WHERE path = ?').run(p);
    },
    /** prefix "students/" ko'rinishida */
    async list(prefix) {
      const rows = db.prepare('SELECT path, data FROM docs WHERE path LIKE ?').all(prefix + '%');
      return rows.map(r => ({ path: r.path, data: JSON.parse(r.data) }));
    },
    async all() {
      const rows = db.prepare('SELECT path, data FROM docs').all();
      return rows.map(r => ({ path: r.path, data: JSON.parse(r.data) }));
    },
    async close() { db.close(); }
  };
}

/* PostgreSQL (Neon, Supabase, Render Postgres yoki o'z serveringiz).
   Neon uchun muhim: ulanish bo'sh turganda yopiladi — shunda Neon "compute"ni
   uxlatadi va bepul tarifdagi soatlar behuda sarflanmaydi.                   */
function makePostgres(url) {
  let Pool;
  try { Pool = require('pg').Pool; }
  catch (e) { throw new Error('pg o’rnatilmagan. "npm install" ni ishga tushiring.'); }

  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 4),
    idleTimeoutMillis: Number(process.env.PG_IDLE_MS || 15000),   // bo'sh ulanish yopilsin
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_MS || 15000),
    allowExitOnIdle: true
  });
  pool.on('error', e => console.error('  Baza ulanishi uzildi: ' + e.message));

  let ready = init();
  async function init() {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, data JSONB NOT NULL, ' +
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    // "students/" kabi boshlanishi bo'yicha qidirish tez bo'lsin
    await pool.query(
      'CREATE INDEX IF NOT EXISTS docs_path_prefix ON docs (path text_pattern_ops)');
  }

  /** Neon uyqudan uyg'onayotganda ulanish uzilishi mumkin — bir marta qayta urinamiz */
  async function q(text, params) {
    await ready;
    try {
      return await pool.query(text, params);
    } catch (e) {
      const msg = String(e.message || '');
      const retryable = /terminat|ECONNRESET|Connection terminated|timeout|ENOTFOUND|EAI_AGAIN|not ready/i.test(msg);
      if (!retryable) throw e;
      await new Promise(r => setTimeout(r, 1200));
      return await pool.query(text, params);
    }
  }

  return {
    kind: 'postgres',
    async get(p) {
      const r = await q('SELECT data FROM docs WHERE path = $1', [p]);
      return r.rows[0] ? r.rows[0].data : null;
    },
    async set(p, data) {
      await q(
        'INSERT INTO docs (path, data, updated_at) VALUES ($1, $2, now()) ' +
        'ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
        [p, JSON.stringify(data)]);
    },
    async del(p) {
      await q('DELETE FROM docs WHERE path = $1', [p]);
    },
    async list(prefix) {
      const r = await q('SELECT path, data FROM docs WHERE path LIKE $1', [prefix + '%']);
      return r.rows.map(x => ({ path: x.path, data: x.data }));
    },
    async all() {
      const r = await q('SELECT path, data FROM docs');
      return r.rows.map(x => ({ path: x.path, data: x.data }));
    },
    /** Bazaning hajmi va yozuvlar soni — sozlamalarda ko'rsatiladi */
    async stats() {
      const r = await q(
        "SELECT count(*)::int AS rows, " +
        "pg_size_pretty(pg_total_relation_size('docs')) AS size, " +
        "pg_total_relation_size('docs')::bigint AS bytes FROM docs");
      return r.rows[0] || null;
    },
    async close() { await pool.end(); }
  };
}

function createStore() {
  const url = process.env.DATABASE_URL;
  if (url) return makePostgres(url);
  return makeSqlite() || makeJsonFile();
}

module.exports = { createStore, DATA_DIR };
