/* O'quv dasturi: daraja → modul → dars → material va vazifa.

   Tuzilishi:
     daraja  — A1…C2 (server/levels.js dagi ro'yxat, alohida yozuv kerak emas)
     modul   — `modules/<id>`   { level, name, order }
     dars    — `topics/<id>`    { moduleId, order, title, goal, about }
     material— `materials/<id>` { topicId, title, kind, url | fileId }
     vazifa  — `homework/<id>`  { topicId, title, about, dueDays, fileId }

   "Dars" so'zi ikki ma'noda ishlatilmasin uchun:
     `topics/`  — dastur darsi (mavzu),
     `lessons/` — jadvaldagi o'tkazilgan dars va davomat (eski yozuv, tegilmaydi).

   Media fayllar diskda (server/files.js), bu yerda faqat fileId turadi.      */
'use strict';
const levels = require('./levels');

const MOD = 'modules/';
const TOP = 'topics/';
const MAT = 'materials/';
const HW = 'homework/';

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : (d || 0); }
function txt(v, max) { return String(v == null ? '' : v).slice(0, max || 200); }

async function listCol(store, name) {
  return (await store.list(name))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data)
    .filter(Boolean);
}

/** Darajaning kodi to'g'rimi (A1…C2) */
function validLevel(code) {
  return levels.ORDER.indexOf(String(code || '')) >= 0;
}

/** Butun dastur daraxti: darajalar → modullar → darslar (+ material/vazifa soni) */
async function tree(store) {
  const [mods, tops, mats, hws] = await Promise.all([
    listCol(store, MOD), listCol(store, TOP), listCol(store, MAT), listCol(store, HW)
  ]);
  const byTopicMat = {}, byTopicHw = {};
  mats.forEach(m => { if (m.topicId) (byTopicMat[m.topicId] = byTopicMat[m.topicId] || []).push(m); });
  hws.forEach(w => { if (w.topicId) (byTopicHw[w.topicId] = byTopicHw[w.topicId] || []).push(w); });

  const byMod = {};
  tops.filter(t => t.active !== false).forEach(t => {
    (byMod[t.moduleId] = byMod[t.moduleId] || []).push({
      id: t.id, title: t.title, order: num(t.order), goal: t.goal || '',
      materials: (byTopicMat[t.id] || []).length,
      homework: (byTopicHw[t.id] || []).length
    });
  });
  Object.keys(byMod).forEach(k => byMod[k].sort((a, b) => a.order - b.order));

  return levels.LEVELS.map(l => ({
    level: l.code,
    name: l.name,
    modules: mods
      .filter(m => m && m.active !== false && m.level === l.code)
      .sort((a, b) => num(a.order) - num(b.order))
      .map(m => ({
        id: m.id, name: m.name, order: num(m.order), about: m.about || '',
        hours: num(m.hours),
        topics: byMod[m.id] || []
      }))
  }));
}

/** Bitta darsning to'liq ko'rinishi (material va vazifalari bilan) */
async function topicFull(store, topicId) {
  const t = await store.get(TOP + String(topicId || ''));
  if (!t) return null;
  const mod = t.moduleId ? await store.get(MOD + t.moduleId) : null;
  const mats = (await listCol(store, MAT)).filter(m => m.topicId === t.id)
    .sort((a, b) => num(a.order) - num(b.order));
  const hws = (await listCol(store, HW)).filter(w => w.topicId === t.id)
    .sort((a, b) => num(a.order) - num(b.order));
  return {
    topic: t,
    module: mod ? { id: mod.id, name: mod.name, level: mod.level } : null,
    materials: mats,
    homework: hws
  };
}

/** Guruh qaysi darajada — dastur shu darajadan ko'rsatiladi */
async function levelOfGroup(store, group) {
  if (!group) return '';
  if (validLevel(group.level)) return group.level;
  if (group.courseId) {
    const c = await store.get('courses/' + group.courseId);
    if (c && validLevel(c.level)) return c.level;
  }
  return '';
}

/** Guruh uchun keyingi o'tilmagan dars (dars jurnali asosida) */
async function nextTopic(store, groupId) {
  const logs = (await store.list('lessonlog/'))
    .map(r => r.data).filter(d => d && d.groupId === String(groupId) && d.topicId);
  const done = {};
  logs.forEach(l => { done[l.topicId] = 1; });
  const g = await store.get('groups/' + String(groupId));
  const lvl = await levelOfGroup(store, g);
  const t = await tree(store);
  const lv = t.filter(x => x.level === lvl)[0] || t[0];
  if (!lv) return null;
  for (const m of lv.modules) {
    for (const top of m.topics) {
      if (!done[top.id]) return { moduleId: m.id, moduleName: m.name, topicId: top.id, title: top.title };
    }
  }
  return null;
}

/** Tozalash: modul o'chsa — darslari, darslari o'chsa — material/vazifasi */
async function cascadeDelete(store, kind, id) {
  const gone = [];
  if (kind === 'module') {
    for (const t of (await listCol(store, TOP)).filter(t => t.moduleId === id)) {
      await cascadeDelete(store, 'topic', t.id);
      gone.push(TOP + t.id);
    }
    if (store.del) await store.del(MOD + id);
    gone.push(MOD + id);
  } else if (kind === 'topic') {
    for (const m of (await listCol(store, MAT)).filter(m => m.topicId === id)) {
      if (store.del) await store.del(MAT + m.id); gone.push(MAT + m.id);
    }
    for (const w of (await listCol(store, HW)).filter(w => w.topicId === id)) {
      if (store.del) await store.del(HW + w.id); gone.push(HW + w.id);
    }
    if (store.del) await store.del(TOP + id);
    gone.push(TOP + id);
  }
  return gone;
}

/** Yangi yozuv uchun tartib raqami */
async function nextOrder(store, col, field, value) {
  const rows = (await listCol(store, col)).filter(r => !field || r[field] === value);
  return rows.reduce((mx, r) => Math.max(mx, num(r.order)), 0) + 1;
}

module.exports = {
  MOD, TOP, MAT, HW, tree, topicFull, nextTopic, levelOfGroup,
  cascadeDelete, nextOrder, validLevel, listCol, txt, num
};
