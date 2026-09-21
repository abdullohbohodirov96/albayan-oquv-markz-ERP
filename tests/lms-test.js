/* O'quv qismi — server tomoni.

   Tekshiriladi:
     1) DASTUR: modul → dars → material → vazifa; huquqsiz tahrir rad etiladi;
        modul o'chsa ichidagilari ham o'chadi;
     2) FAYL: diskda saqlanadi, bazada faqat ma'lumotnoma; turi va o'lchami
        tekshiriladi; begona fayl o'quvchiga berilmaydi;
     3) BAYRAM/TANAFFUS: dam olish kuni aniqlanadi, guruh tanaffusi faqat
        o'sha guruhga ta'sir qiladi;
     4) QO'SHIMCHA DARS: faqat haqiqatda kelmagan darsga beriladi, takror
        berilmaydi, dam olish kuniga belgilanmaydi;
     5) DARS JURNALI: saqlanadi, o'zgartiriladi, begona guruhga yozilmaydi;
     6) SAVOL-JAVOB va FIKR: guruhdagi o'quvchi savol beradi, ustoz javob
        beradi; anonim fikrda o'quvchi ismi SAQLANMAYDI; takror fikr yo'q;
     7) TEST: savollar javobsiz keladi, natijani mijoz yoza olmaydi, begona
        sessiyani boshqa o'quvchi topshira olmaydi;
     8) OTA-ONA: o'z kodi bilan kiradi, faqat o'z farzandini ko'radi,
        farzandi nomidan test ishlay olmaydi;
     9) HISOBOT: davomat va test foizlari to'g'ri hisoblanadi;
    10) rad etilgan so'rovdan keyin bazadagi ma'lumot o'zgarmaydi.

   Sinov O'ZI alohida server nusxasini (vaqtinchalik, soxta bazada) ko'taradi.
     node tests/lms-test.js                                                  */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');

const PASS = 'Albyana2026!';
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = 'http://localhost:' + PORT;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'albayan-lms-'));
process.env.DATA_DIR = DIR;
/* Baza turi: standart — SQLite. TEST_DATABASE_URL berilsa,
   o'sha PostgreSQL bazasida ishlaydi (natija alohida ko'rsatiladi). */
const PG = process.env.TEST_DATABASE_URL || '';
process.env.DB_DRIVER = PG ? 'pg' : 'sqlite';
if (PG) process.env.DATABASE_URL = PG;
let srv = null;

async function bootServer() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: DIR, DB_DRIVER: PG ? 'pg' : 'sqlite', PORT: String(PORT),
      DATABASE_URL: PG || '',
      BACKUP_DIR: path.join(DIR, 'backups'),
      FILES_DIR: path.join(DIR, 'files'),
      SEED_DIRECTOR_PASSWORD: PASS
    }),
    stdio: 'ignore'
  });
  for (let i = 0; i < 80; i++) {
    const st = await fetch(BASE + '/api/health').then(r => r.status).catch(() => 0);
    if (st === 200) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}
function stopServer() {
  try { if (srv) srv.kill(); } catch (e) { }
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { }
}

let pass = 0, fail = 0; const out = [];
function ok(n, c, e) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 200) : '')); } }
function eq(n, got, want) { ok(n, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function req(p, o = {}) {
  const r = await fetch(BASE + p, {
    method: o.method || 'GET',
    headers: Object.assign(
      o.body ? { 'Content-Type': 'application/json' } : {},
      o.cookie ? { Cookie: o.cookie } : {},
      o.csrf ? { 'X-Kab-Csrf': o.csrf } : {},
      o.headers || {}),
    body: o.body ? JSON.stringify(o.body) : undefined,
    redirect: 'manual'
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, text: t, cookie: (r.headers.get('set-cookie') || '').split(';')[0], raw: r };
}
const login = (l, p) => req('/api/login', { method: 'POST', body: { login: l, password: p } }).then(r => r.cookie);
const put = (p, data, cookie, extra) => req('/api/doc?path=' + encodeURIComponent(p),
  { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });
const get = (p, cookie) => req('/api/doc?path=' + encodeURIComponent(p), { cookie });

const R = 'L' + Date.now().toString(36);
const ID = n => R + '_' + n;

(async () => {
  if (!await bootServer()) { stopServer(); console.error('Sinov serveri ko’tarilmadi.'); process.exit(1); }
  const dir = await login('admin', PASS);
  if (!dir) { stopServer(); console.error('Direktor kira olmadi.'); process.exit(1); }

  /* ---------- 0. Sun'iy ma'lumot ---------- */
  section('0. Sinov ma’lumotlari (sun’iy)');
  await put('staff/' + ID('t1'), { id: ID('t1'), name: 'Ustoz Lms', status: 'faol' }, dir);
  await put('staff/' + ID('t2'), { id: ID('t2'), name: 'Ustoz Begona', status: 'faol' }, dir);
  await put('courses/' + ID('c'), { id: ID('c'), name: 'Arab tili', monthlyFee: 300000, active: true }, dir);
  await put('groups/' + ID('g1'), {
    id: ID('g1'), name: 'LMS guruh', courseId: ID('c'), teacherId: ID('t1'),
    level: 'A1', days: [1, 3], startTime: '10:00', endTime: '11:30',
    startDate: '2026-09-01', fee: 300000, limit: 10, status: 'faol'
  }, dir);
  await put('groups/' + ID('g2'), {
    id: ID('g2'), name: 'Begona guruh', courseId: ID('c'), teacherId: ID('t2'),
    days: [2, 4], startTime: '14:00', endTime: '15:30',
    startDate: '2026-09-01', fee: 300000, limit: 10, status: 'faol'
  }, dir);
  for (const [n, g] of [['s1', 'g1'], ['s2', 'g1'], ['s3', 'g2']]) {
    await put('students/' + ID(n), {
      id: ID(n), firstName: 'O’quvchi', lastName: n.toUpperCase(),
      phone: '+99890000000' + n.slice(-1), status: 'active'
    }, dir);
    await put('memberships/' + ID('m' + n), {
      id: ID('m' + n), studentId: ID(n), groupId: ID(g), status: 'faol', from: '2026-09-01'
    }, dir);
  }
  const s1 = (await get('students/' + ID('s1'), dir)).json.data;
  ok('O’quvchida kabinet kodi bor', /^\d{4}$/.test(String(s1.code)), String(s1.code));

  /* o'qituvchi hisobi */
  await put('users/' + ID('u1'), {
    id: ID('u1'), login: 'ust_' + R, name: 'Ustoz Lms', role: 'oqituvchi',
    staffId: ID('t1'), active: true
  }, dir, { password: 'Ustoz12345' });
  const teach = await login('ust_' + R, 'Ustoz12345');
  ok('O’qituvchi kirdi', !!teach);

  /* ---------- 1. Dastur ---------- */
  section('1. O’quv dasturi: modul → dars → material → vazifa');
  const modPut = await put('modules/' + ID('mod1'), {
    id: ID('mod1'), name: 'Alifbo moduli', level: 'A1', hours: 20, active: true
  }, dir);
  eq('Modul saqlandi', modPut.status, 200);
  const badLevel = await put('modules/' + ID('modX'), {
    id: ID('modX'), name: 'Xato daraja', level: 'Z9', active: true
  }, dir);
  eq('Noto’g’ri daraja rad etildi', badLevel.status, 400);

  const topPut = await put('topics/' + ID('top1'), {
    id: ID('top1'), moduleId: ID('mod1'), title: 'Harflar', goal: 'Alifboni o’qish', active: true
  }, dir);
  eq('Dars saqlandi', topPut.status, 200);
  const noMod = await put('topics/' + ID('topX'), { id: ID('topX'), title: 'Modulsiz' }, dir);
  eq('Modulsiz dars rad etildi', noMod.status, 400);

  await put('materials/' + ID('mat1'), {
    id: ID('mat1'), topicId: ID('top1'), title: 'Alifbo jadvali', url: 'https://example.org/a'
  }, dir);
  await put('homework/' + ID('hw1'), {
    id: ID('hw1'), topicId: ID('top1'), title: 'Harflarni yozing', about: '10 marta'
  }, dir);

  const tree = await req('/api/curriculum', { cookie: dir });
  eq('Dastur daraxti keldi', tree.status, 200);
  const a1 = (tree.json.tree || []).filter(l => l.level === 'A1')[0];
  ok('A1 da modul bor', !!(a1 && a1.modules.length), JSON.stringify(a1 && a1.modules.length));
  const m1 = a1.modules.filter(m => m.id === ID('mod1'))[0];
  ok('Modulda dars ko’rinadi', !!(m1 && m1.topics.length));
  eq('Material soni', m1.topics[0].materials, 1);
  eq('Vazifa soni', m1.topics[0].homework, 1);

  section('   Huquqsiz tahrir rad etiladi');
  const teachEdit = await put('modules/' + ID('mod1'), {
    id: ID('mod1'), name: 'O’qituvchi o’zgartirdi', level: 'A1'
  }, teach);
  eq('O’qituvchi dasturni tahrirlay olmaydi', teachEdit.status, 403);
  const stillName = (await get('modules/' + ID('mod1'), dir)).json.data.name;
  eq('Nom o’zgarmadi', stillName, 'Alifbo moduli');
  const teachView = await req('/api/curriculum', { cookie: teach });
  eq('O’qituvchi dasturni ko’ra oladi', teachView.status, 200);

  section('   Modul o’chsa ichidagilari ham o’chadi');
  await put('modules/' + ID('mod2'), { id: ID('mod2'), name: 'Vaqtinchalik', level: 'A2' }, dir);
  await put('topics/' + ID('top2'), { id: ID('top2'), moduleId: ID('mod2'), title: 'Vaqtinchalik dars' }, dir);
  await put('materials/' + ID('mat2'), { id: ID('mat2'), topicId: ID('top2'), title: 'M' }, dir);
  const del = await req('/api/curriculum/delete', { method: 'POST', cookie: dir, body: { kind: 'module', id: ID('mod2') } });
  eq('O’chirish so’rovi qabul qilindi', del.status, 200);
  ok('Modul o’chdi', !(await get('modules/' + ID('mod2'), dir)).json ||
    !(await get('modules/' + ID('mod2'), dir)).json.data);
  ok('Darsi ham o’chdi', !((await get('topics/' + ID('top2'), dir)).json || {}).data);
  ok('Materiali ham o’chdi', !((await get('materials/' + ID('mat2'), dir)).json || {}).data);

  /* ---------- 2. Fayl ombori ---------- */
  section('2. Fayl diskda saqlanadi, bazada faqat ma’lumotnoma');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  const up = await req('/api/file', {
    method: 'POST', cookie: dir,
    body: {
      name: 'rasm.png', type: 'image/png', data: png.toString('base64'),
      purpose: 'material', refPath: 'materials/' + ID('mat1')
    }
  });
  eq('Fayl yuklandi', up.status, 200);
  const fid = up.json.file.id;
  ok('Fayl diskda bor', fs.existsSync(path.join(DIR, 'files', fid + '.png')),
    fs.readdirSync(path.join(DIR, 'files')).join(','));
  const fdoc = (await get('files/' + fid, dir)).json;
  ok('Bazada fayl mazmuni yo’q', !/iVBORw0/.test(JSON.stringify(fdoc || {})),
    JSON.stringify(fdoc || {}).slice(0, 120));
  eq('Bazada o’lcham yozilgan', (fdoc && fdoc.data && fdoc.data.bytes), png.length);

  const badType = await req('/api/file', {
    method: 'POST', cookie: dir,
    body: { name: 'x.html', type: 'text/html', data: Buffer.from('<script>').toString('base64') }
  });
  eq('Bajariladigan fayl rad etildi', badType.status, 400);
  const tooBig = await req('/api/file', {
    method: 'POST', cookie: dir,
    body: { name: 'big.png', type: 'image/png', data: Buffer.alloc(11 * 1024 * 1024).toString('base64') }
  });
  ok('Juda katta fayl rad etildi (' + tooBig.status + ')',
    tooBig.status === 400 || tooBig.status === 413, tooBig.text.slice(0, 120));

  const fileGet = await req('/api/file?id=' + fid, { cookie: dir });
  eq('Xodim faylni ocha oladi', fileGet.status, 200);
  const noAuth = await req('/api/file?id=' + fid);
  ok('Sessiyasiz fayl berilmaydi', noAuth.status === 401, String(noAuth.status));

  /* ---------- 3. Bayram va tanaffus ---------- */
  section('3. Bayram va guruh tanaffusi');
  const hol = await req('/api/holiday', {
    method: 'POST', cookie: dir,
    body: { name: 'Mustaqillik', from: '2026-09-01', to: '2026-09-02', scope: 'markaz' }
  });
  eq('Bayram saqlandi', hol.status, 200);
  const gh = await req('/api/holiday', {
    method: 'POST', cookie: dir,
    body: { name: 'Guruh tanaffusi', from: '2026-09-10', scope: 'guruh', groupId: ID('g1') }
  });
  eq('Guruh tanaffusi saqlandi', gh.status, 200);

  const d1 = await req('/api/dayoff?date=2026-09-01&groupId=' + ID('g1'), { cookie: dir });
  ok('1-sentabr dam olish kuni', d1.json.off === true, JSON.stringify(d1.json));
  const d2 = await req('/api/dayoff?date=2026-09-10&groupId=' + ID('g1'), { cookie: dir });
  ok('10-sentabr g1 uchun dam', d2.json.off === true, JSON.stringify(d2.json));
  const d3 = await req('/api/dayoff?date=2026-09-10&groupId=' + ID('g2'), { cookie: dir });
  ok('10-sentabr g2 uchun oddiy kun', d3.json.off === false, JSON.stringify(d3.json));
  const badHol = await req('/api/holiday', {
    method: 'POST', cookie: dir, body: { name: 'Teskari', from: '2026-10-10', to: '2026-10-01' }
  });
  eq('Teskari sana rad etildi', badHol.status, 400);

  /* o'quvchi tanaffusi */
  const pau = await req('/api/pause', {
    method: 'POST', cookie: dir,
    body: { studentId: ID('s2'), from: '2026-09-15', to: '2026-09-30', reason: 'Safar' }
  });
  eq('O’quvchi tanaffusi saqlandi', pau.status, 200);

  /* ---------- 4. Qo'shimcha dars ---------- */
  section('4. Qo’shimcha dars faqat kelmagan darsga beriladi');
  const early = await req('/api/makeup', {
    method: 'POST', cookie: dir,
    body: { studentId: ID('s1'), groupId: ID('g1'), missedDate: '2026-09-07', date: '2026-09-14' }
  });
  eq('Kelgan darsga qo’shimcha berilmadi', early.status, 400);

  await put('lessons/' + ID('g1') + '__2026-09', {
    id: ID('g1') + '__2026-09',
    items: {
      '2026-09-07': { attendance: { [ID('s1')]: { status: 'kelmadi' }, [ID('s2')]: { status: 'keldi' } } },
      '2026-09-09': { attendance: { [ID('s1')]: { status: 'keldi' } } }
    }
  }, dir);

  const mk = await req('/api/makeup', {
    method: 'POST', cookie: dir,
    body: { studentId: ID('s1'), groupId: ID('g1'), missedDate: '2026-09-07', date: '2026-09-14', time: '16:00' }
  });
  eq('Kelmagan darsga qo’shimcha berildi', mk.status, 200);
  const dup = await req('/api/makeup', {
    method: 'POST', cookie: dir,
    body: { studentId: ID('s1'), groupId: ID('g1'), missedDate: '2026-09-07', date: '2026-09-16' }
  });
  eq('Takror qo’shimcha berilmadi', dup.status, 409);
  const onOff = await req('/api/makeup', {
    method: 'POST', cookie: dir,
    body: { studentId: ID('s2'), groupId: ID('g1'), missedDate: '2026-09-07', date: '2026-09-10' }
  });
  ok('Dam olish kuniga belgilanmadi', onOff.status === 400, onOff.text.slice(0, 120));

  const st1 = await req('/api/makeup/status', {
    method: 'POST', cookie: dir, body: { id: mk.json.makeup.id, status: 'bajarildi' }
  });
  eq('Holat "bajarildi" bo’ldi', st1.status, 200);
  const st2 = await req('/api/makeup/status', {
    method: 'POST', cookie: dir, body: { id: mk.json.makeup.id, status: 'taklif' }
  });
  eq('Bajarilganni qaytarib bo’lmaydi', st2.status, 400);

  section('   O’qituvchi begona guruhga qo’shimcha bera olmaydi');
  await put('lessons/' + ID('g2') + '__2026-09', {
    id: ID('g2') + '__2026-09',
    items: { '2026-09-08': { attendance: { [ID('s3')]: { status: 'kelmadi' } } } }
  }, dir);
  const foreign = await req('/api/makeup', {
    method: 'POST', cookie: teach,
    body: { studentId: ID('s3'), groupId: ID('g2'), missedDate: '2026-09-08', date: '2026-09-15' }
  });
  eq('Begona guruh rad etildi', foreign.status, 403);

  /* ---------- 5. Dars jurnali ---------- */
  section('5. Dars jurnali (darsdan keyingi jarayon)');
  const log1 = await req('/api/lesson/log', {
    method: 'POST', cookie: teach,
    body: {
      groupId: ID('g1'), date: '2026-09-09', title: 'Harflar',
      note: 'Alifbo o’tildi', homeworkText: '10 ta harf yozish',
      dueDate: '2026-09-11', topicId: ID('top1')
    }
  });
  eq('Ustoz dars yozuvini saqladi', log1.status, 200);
  const log2 = await req('/api/lesson/log', {
    method: 'POST', cookie: teach,
    body: { groupId: ID('g1'), date: '2026-09-09', title: 'Harflar (tuzatildi)' }
  });
  eq('Yozuv yangilandi', log2.status, 200);
  const logs = await req('/api/lesson/log?groupId=' + ID('g1'), { cookie: teach });
  eq('Bitta sana uchun bitta yozuv', logs.json.logs.length, 1);
  eq('Yangi sarlavha saqlandi', logs.json.logs[0].title, 'Harflar (tuzatildi)');
  eq('Uy vazifasi o’chib ketmadi', logs.json.logs[0].homeworkText, '10 ta harf yozish');
  const cleared = await req('/api/lesson/log', {
    method: 'POST', cookie: teach,
    body: { groupId: ID('g1'), date: '2026-09-09', homeworkText: '' }
  });
  eq('Ataylab bo’shatish ishlaydi', cleared.status, 200);
  const logs2 = await req('/api/lesson/log?groupId=' + ID('g1'), { cookie: teach });
  eq('Vazifa bo’shatildi', logs2.json.logs[0].homeworkText, '');
  await req('/api/lesson/log', {
    method: 'POST', cookie: teach,
    body: { groupId: ID('g1'), date: '2026-09-09', homeworkText: '10 ta harf yozish' }
  });

  const logForeign = await req('/api/lesson/log', {
    method: 'POST', cookie: teach,
    body: { groupId: ID('g2'), date: '2026-09-09', title: 'Begona' }
  });
  eq('Begona guruhga yozilmadi', logForeign.status, 403);
  const directWrite = await put('lessonlog/' + ID('g1') + '__2026-09-09',
    { id: ID('g1') + '__2026-09-09', groupId: ID('g1'), title: 'Qo’lda' }, dir);
  eq('Jurnalni qo’lda yozib bo’lmaydi', directWrite.status, 403);
  const afterDirect = await req('/api/lesson/log?groupId=' + ID('g1'), { cookie: teach });
  eq('Rad etilgandan keyin o’zgarmadi', afterDirect.json.logs[0].title, 'Harflar (tuzatildi)');

  /* ---------- 6. Kabinet: o'quvchi ---------- */
  section('6. O’quvchi kabineti: vazifa, savol, fikr');
  const kab = await req('/api/kabinet', { method: 'POST', body: { code: s1.code } });
  eq('O’quvchi kodi bilan kirdi', kab.status, 200);
  const kc = kab.cookie, csrf = kab.json.csrf;
  ok('CSRF siri berildi', !!csrf);

  const learn = await req('/api/kabinet/learning', { cookie: kc });
  eq('O’quv sahifasi keldi', learn.status, 200);
  eq('O’quvchi topshira oladi', learn.json.canSubmit, true);
  ok('Uy vazifasi ko’rinadi', (learn.json.homework || []).length >= 1,
    JSON.stringify(learn.json.homework));
  ok('Qo’shimcha dars ko’rinadi', (learn.json.makeups || []).length >= 1);

  section('   CSRF sirisiz o’zgartirish rad etiladi');
  const noCsrf = await req('/api/kabinet/question', {
    method: 'POST', cookie: kc, body: { groupId: ID('g1'), text: 'Savol' }
  });
  eq('CSRFsiz rad etildi', noCsrf.status, 403);

  const q1 = await req('/api/kabinet/question', {
    method: 'POST', cookie: kc, csrf,
    body: { groupId: ID('g1'), text: 'Bu harfni qanday o’qiymiz?' }
  });
  eq('Savol yuborildi', q1.status, 200);
  const qForeign = await req('/api/kabinet/question', {
    method: 'POST', cookie: kc, csrf, body: { groupId: ID('g2'), text: 'Begona guruhga' }
  });
  eq('Begona guruhga savol berilmadi', qForeign.status, 403);

  const ans = await req('/api/question/answer', {
    method: 'POST', cookie: teach, body: { id: q1.json.question.id, text: 'Mana shunday o’qiladi.' }
  });
  eq('Ustoz javob berdi', ans.status, 200);
  const qlist = await req('/api/questions?groupId=' + ID('g1'), { cookie: teach });
  eq('Javob saqlandi', (qlist.json.questions[0].answers || []).length, 1);

  section('   Anonim fikrda ism saqlanmaydi');
  const fb = await req('/api/kabinet/feedback', {
    method: 'POST', cookie: kc, csrf,
    body: { groupId: ID('g1'), rating: 5, text: 'Yaxshi dars', anon: true, date: '2026-09-09' }
  });
  eq('Fikr qabul qilindi', fb.status, 200);
  const fbList = await req('/api/feedback?groupId=' + ID('g1'), { cookie: dir });
  eq('Fikr soni', fbList.json.count, 1);
  eq('O’rtacha baho', fbList.json.avg, 5);
  ok('Anonim fikrda o’quvchi id yo’q', !fbList.text.includes(ID('s1')), fbList.text.slice(0, 200));
  const fbDup = await req('/api/kabinet/feedback', {
    method: 'POST', cookie: kc, csrf,
    body: { groupId: ID('g1'), rating: 3, anon: true, date: '2026-09-09' }
  });
  eq('Takror fikr rad etildi', fbDup.status, 409);
  const fbBad = await req('/api/kabinet/feedback', {
    method: 'POST', cookie: kc, csrf, body: { groupId: ID('g1'), rating: 9, date: '2026-09-20' }
  });
  eq('Noto’g’ri baho rad etildi', fbBad.status, 400);

  /* ---------- 7. Dars testi ---------- */
  section('7. Dars testi: javoblar yopiq, natijani mijoz yozolmaydi');
  const qz = await req('/api/quiz', {
    method: 'POST', cookie: teach,
    body: {
      title: 'Alifbo testi', groupId: ID('g1'), pass: 60,
      questions: [
        { text: 'Birinchi harf?', options: ['أ', 'ب', 'ت'], answer: 0 },
        { text: 'Ikkinchi harf?', options: ['أ', 'ب', 'ت'], answer: 1 }
      ]
    }
  });
  eq('Test saqlandi', qz.status, 200);
  const quizId = qz.json.quiz.id;
  const badQz = await req('/api/quiz', {
    method: 'POST', cookie: teach,
    body: { title: 'Yomon', groupId: ID('g1'), questions: [{ text: 'X', options: ['bitta'], answer: 0 }] }
  });
  eq('Bitta variantli savol rad etildi', badQz.status, 400);

  const qStart = await req('/api/kabinet/quiz/start', {
    method: 'POST', cookie: kc, csrf, body: { quizId }
  });
  eq('O’quvchi testni boshladi', qStart.status, 200);
  ok('Javob maydoni yo’q', !/"answer"/.test(qStart.text), qStart.text.slice(0, 160));
  eq('Savollar soni', qStart.json.total, 2);

  const colQ = await req('/api/collection?name=quizq', { cookie: dir });
  ok('quizq to’plami berilmaydi', colQ.status >= 400 || !/"answer"/.test(colQ.text), colQ.text.slice(0, 120));
  const oneQ = await get('quizq/' + quizId + '_q001', dir);
  ok('Savol hujjati ham berilmaydi', oneQ.status >= 400 || !/"answer"/.test(oneQ.text), oneQ.text.slice(0, 120));

  /* to'g'ri javoblarni server kodidan olamiz (mijoz ularni bilmaydi) */
  const { createStore } = require(path.join(__dirname, '..', 'server', 'store'));
  const quizMod = require(path.join(__dirname, '..', 'server', 'quiz'));
  const store = createStore();
  if (store.ready) await store.ready;
  async function rightChoice(sessId, q) {
    const doc = await store.get(quizMod.QQ + q.id);
    const ses = await store.get(quizMod.QS + sessId);
    const map = ses && ses.mix && ses.mix[q.id];
    const real = doc ? Number(doc.answer) : 0;
    return map ? map.indexOf(real) : real;
  }
  const answers = [];
  for (const q of qStart.json.questions) answers.push({ id: q.id, choice: await rightChoice(qStart.json.id, q) });
  const qSub = await req('/api/kabinet/quiz/submit', {
    method: 'POST', cookie: kc, csrf, body: { sessionId: qStart.json.id, answers }
  });
  eq('Natija qaytdi', qSub.status, 200);
  eq('Hammasi to’g’ri', qSub.json.result.score, 2);
  eq('Foiz 100', qSub.json.result.percent, 100);
  ok('O’tdi deb belgilandi', qSub.json.result.passed === true);
  const qAgain = await req('/api/kabinet/quiz/submit', {
    method: 'POST', cookie: kc, csrf, body: { sessionId: qStart.json.id, answers }
  });
  eq('Ikkinchi marta rad etildi', qAgain.status, 409);

  section('   Natijani qo’lda yozib bo’lmaydi');
  const forge = await put('quizres/' + ID('fake'), { id: ID('fake'), quizId, studentId: ID('s1'), percent: 100 }, dir);
  eq('quizres qo’lda yozilmaydi', forge.status, 403);
  const forgeQz = await put('quizzes/' + quizId, { id: quizId, title: 'Buzildi' }, dir);
  eq('quizzes qo’lda yozilmaydi', forgeQz.status, 403);
  const qzStill = await req('/api/quiz?id=' + quizId, { cookie: teach });
  eq('Test nomi o’zgarmadi', qzStill.json.quiz.title, 'Alifbo testi');

  section('   Begona sessiyani boshqa o’quvchi topshira olmaydi');
  const s2doc = (await get('students/' + ID('s2'), dir)).json.data;
  const kab2 = await req('/api/kabinet', { method: 'POST', body: { code: s2doc.code } });
  const kc2 = kab2.cookie, csrf2 = kab2.json.csrf;
  const start2 = await req('/api/kabinet/quiz/start', { method: 'POST', cookie: kc2, csrf: csrf2, body: { quizId } });
  eq('Ikkinchi o’quvchi boshladi', start2.status, 200);
  const cross = await req('/api/kabinet/quiz/submit', {
    method: 'POST', cookie: kc, csrf, body: { sessionId: start2.json.id, answers: [] }
  });
  ok('Begona sessiya rad etildi', cross.status === 400, String(cross.status));

  /* ---------- 8. Ota-ona kabineti ---------- */
  section('8. Ota-ona: o’z kodi, faqat o’z farzandi');
  const par = await req('/api/parent', {
    method: 'POST', cookie: dir,
    body: { name: 'Ota Sinov', phone: '+998901234567', relation: 'ota', studentIds: [ID('s1')] }
  });
  eq('Ota-ona saqlandi', par.status, 200);
  const pcode = par.json.parent.code;
  ok('Ota-onaga kod berildi', /^\d{4}$/.test(String(pcode)), String(pcode));
  ok('Kod o’quvchinikidan boshqa', String(pcode) !== String(s1.code));

  const pk = await req('/api/kabinet', { method: 'POST', body: { code: pcode } });
  eq('Ota-ona kirdi', pk.status, 200);
  eq('Kabinet turi "parent"', pk.json.kind, 'parent');
  eq('Bitta farzand ko’rinadi', (pk.json.children || []).length, 1);
  ok('Farzandning ismi to’g’ri', pk.json.children[0].student.name.indexOf('S1') >= 0,
    JSON.stringify(pk.json.children[0].student));
  ok('Boshqa oila bolasi ko’rinmadi', !pk.text.includes(ID('s3')), pk.text.slice(0, 200));

  const pLearn = await req('/api/kabinet/learning', { cookie: pk.cookie });
  eq('Ota-ona o’quv sahifasini ko’radi', pLearn.status, 200);
  eq('Ota-ona topshira olmaydi', pLearn.json.canSubmit, false);
  const pQuiz = await req('/api/kabinet/quiz/start', {
    method: 'POST', cookie: pk.cookie, csrf: pk.json.csrf, body: { quizId }
  });
  eq('Ota-ona test ishlay olmaydi', pQuiz.status, 403);
  const pAsk = await req('/api/kabinet/question', {
    method: 'POST', cookie: pk.cookie, csrf: pk.json.csrf, body: { groupId: ID('g1'), text: 'Ota savoli' }
  });
  eq('Ota-ona savol bera olmaydi', pAsk.status, 403);
  const pOther = await req('/api/kabinet/learning?studentId=' + ID('s3'), { cookie: pk.cookie });
  eq('Begona o’quvchi ma’lumoti berilmadi', pOther.status, 403);
  const pDirect = await put('parents/' + par.json.parent.id, { id: par.json.parent.id, code: '0000' }, dir);
  eq('Ota-ona yozuvi qo’lda yozilmaydi', pDirect.status, 403);

  /* ---------- 9. Hisobotlar ---------- */
  section('9. O’quv hisobotlari');
  const rs = await req('/api/report/student?id=' + ID('s1'), { cookie: dir });
  eq('O’quvchi hisoboti keldi', rs.status, 200);
  eq('Belgilangan dars soni', rs.json.attendance.total, 2);
  eq('Davomat foizi', rs.json.attendance.percent, 50);
  eq('Test soni', rs.json.quizzes.count, 1);
  eq('Test o’rtachasi', rs.json.quizzes.avgPercent, 100);
  eq('Qo’shimcha dars bajarildi', rs.json.makeups.done, 1);

  const rg = await req('/api/report/group?id=' + ID('g1'), { cookie: teach });
  eq('Guruh hisoboti keldi', rg.status, 200);
  eq('Guruhda ikki o’quvchi', rg.json.students.length, 2);
  const rgForeign = await req('/api/report/group?id=' + ID('g2'), { cookie: teach });
  eq('Begona guruh hisoboti berilmadi', rgForeign.status, 403);

  const ov = await req('/api/report/overview', { cookie: dir });
  eq('Umumiy hisobot keldi', ov.status, 200);
  ok('Guruhlar ro’yxati bor', (ov.json.groups || []).length >= 2, String((ov.json.groups || []).length));

  /* ---------- 10. Fayl huquqi kabinetda ---------- */
  section('10. Kabinetda fayl huquqi');
  const upLog = await req('/api/file', {
    method: 'POST', cookie: teach,
    body: {
      name: 'dars.png', type: 'image/png', data: png.toString('base64'),
      purpose: 'material', refPath: 'lessonlog/' + ID('g1') + '__2026-09-09'
    }
  });
  eq('Ustoz dars fayli yukladi', upLog.status, 200);
  const myFile = await req('/api/kabinet/file?id=' + upLog.json.file.id, { cookie: kc });
  eq('O’z guruhi fayli ochildi', myFile.status, 200);

  const upOther = await req('/api/file', {
    method: 'POST', cookie: dir,
    body: {
      name: 'begona.png', type: 'image/png', data: png.toString('base64'),
      purpose: 'material', refPath: 'lessonlog/' + ID('g2') + '__2026-09-09'
    }
  });
  const notMine = await req('/api/kabinet/file?id=' + upOther.json.file.id, { cookie: kc });
  eq('Begona guruh fayli berilmadi', notMine.status, 403);
  /* Dastur materiali: guruhda o'sha mavzu o'tilgan bo'lsa ochiladi */
  const matFile = await req('/api/kabinet/file?id=' + fid, { cookie: kc });
  eq('O’tilgan mavzu materiali ochildi', matFile.status, 200);

  /* Hech narsaga biriktirilmagan fayl — hech kimga ochilmaydi */
  const loose = await req('/api/file', {
    method: 'POST', cookie: dir,
    body: { name: 'bogliqmas.png', type: 'image/png', data: png.toString('base64'), purpose: 'material' }
  });
  const noRef = await req('/api/kabinet/file?id=' + loose.json.file.id, { cookie: kc });
  eq('Biriktirilmagan fayl berilmadi', noRef.status, 403);

  /* Boshqa guruh o'quvchisi o'sha materialni ko'rmaydi (mavzu o'tilmagan) */
  const s3doc = (await get('students/' + ID('s3'), dir)).json.data;
  const kab3 = await req('/api/kabinet', { method: 'POST', body: { code: s3doc.code } });
  const otherMat = await req('/api/kabinet/file?id=' + fid, { cookie: kab3.cookie });
  eq('O’tilmagan mavzu materiali berilmadi', otherMat.status, 403);

  stopServer();
  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  console.log('Eslatma: alohida sinov serveri, soxta o’quvchi va vaqtinchalik baza ishlatildi;');
  console.log('haqiqiy odamga xabar yuborilmadi, production bazaga tegilmadi.');
  process.exit(fail ? 1 : 0);
})().catch(e => { stopServer(); console.error(e); process.exit(1); });
