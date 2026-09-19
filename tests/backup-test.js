/* Zaxira nusxa va tiklash sinovi.
   Alohida (vaqtinchalik) baza va alohida zaxira papkasida ishlaydi —
   haqiqiy ma'lumotlarga tegmaydi.
   Ishga tushirish:  node tests/backup-test.js                               */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'albyana-bk-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.BACKUP_DIR = path.join(tmp, 'backups');
process.env.BACKUP_KEEP = '3';

const { createStore } = require('../server/store');
const backup = require('../server/backup');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }

(async () => {
  const store = createStore();

  /* --- Sun'iy ma'lumot --- */
  await store.set('users/u1', { id: 'u1', login: 'admin', name: 'Direktor', role: 'direktor', hash: 'x', salt: 's', algo: 'pbkdf2' });
  await store.set('meta/settings', { centerName: 'Albyana (sinov)', currency: 'so’m' });
  for (let i = 1; i <= 5; i++) {
    await store.set('students/st' + i, { id: 'st' + i, fullName: 'O’quvchi ' + i, phone: '+99890000000' + i });
  }
  await store.set('payments/p1', { id: 'p1', amount: 500000, studentId: 'st1' });

  section('Zaxira olish');
  const b1 = await backup.makeBackup(store, 'sinov');
  ok('Fayl yaratildi', fs.existsSync(b1.file), b1.file);
  ok('Yozuvlar soni to’g’ri (' + b1.count + ')', b1.count === 8, 'kutilgan 8');
  const dump1 = backup.read(b1.name);
  ok('Fayl qayta o’qildi', !!dump1 && !!dump1.docs);
  ok('Nazorat summasi bor', !!dump1.checksum);
  ok('O’quvchi ichida bor', dump1.docs['students/st3'].fullName === 'O’quvchi 3');

  section('Tekshirish: yaxshi va buzuq fayllar');
  ok('To’g’ri fayl o’tadi', backup.validate(dump1).ok);

  const noUsers = JSON.parse(JSON.stringify(dump1));
  delete noUsers.docs['users/u1'];
  noUsers.checksum = backup.checksum(noUsers);
  const v1 = backup.validate(noUsers);
  ok('Foydalanuvchisiz fayl rad etiladi', !v1.ok, JSON.stringify(v1.errors));

  const tampered = JSON.parse(JSON.stringify(dump1));
  tampered.docs['payments/p1'].amount = 999999999;    // summani o'zgartirdik
  const v2 = backup.validate(tampered);
  ok('O’zgartirilgan fayl aniqlanadi (nazorat summasi)', !v2.ok &&
    v2.errors.join(' ').indexOf('Nazorat') >= 0, JSON.stringify(v2.errors));

  const broken = { app: 'albyana-erp', docs: { 'students': { x: 1 } } };
  ok('Noto’g’ri yo’l rad etiladi', !backup.validate(broken).ok);

  ok('Boshqa dasturning fayli rad etiladi', !backup.validate({ app: 'boshqa', docs: dump1.docs }).ok);

  const newer = JSON.parse(JSON.stringify(dump1));
  newer.format = 99;
  ok('Yangiroq formatli fayl rad etiladi', !backup.validate(newer).ok);

  section('Ta’sir ko’rinishi');
  await store.set('students/st6', { id: 'st6', fullName: 'Keyin qo’shilgan' });
  await store.del('students/st5');
  const pv = await backup.preview(store, dump1);
  const stRow = pv.rows.filter(r => r.collection === 'students')[0];
  ok('Hozirgi soni to’g’ri (' + stRow.hozir + ')', stRow.hozir === 5);
  ok('Tiklangandan keyingi soni to’g’ri (' + stRow.keyin + ')', stRow.keyin === 5);
  ok('O’chadigan yozuv ko’rsatildi', pv.rows.some(r => r.ochiriladi >= 0));

  section('Tiklash');
  const beforeHas6 = !!(await store.get('students/st6'));
  const beforeHas5 = !!(await store.get('students/st5'));
  const r = await backup.restore(store, dump1);
  ok('Tiklash bajarildi', r.ok);
  ok('Tiklashdan oldingi holat saqlandi', fs.existsSync(path.join(process.env.BACKUP_DIR, r.safety)));
  const st6 = await store.get('students/st6');
  ok('Zaxiradan keyin qo’shilgan yozuv o’chdi', st6 === null, JSON.stringify(st6));
  const st5 = await store.get('students/st5');
  ok('O’chirilgan yozuv qaytdi', !!st5 && st5.fullName === 'O’quvchi 5');
  const pay = await store.get('payments/p1');
  ok('To’lov summasi asl holida (500000)', pay.amount === 500000, String(pay && pay.amount));
  const all = await store.all();
  ok('Umumiy yozuvlar soni zaxiradagidek (' + all.length + ')', all.length === 8);
  ok('Sozlamalar tiklandi', (await store.get('meta/settings')).centerName === 'Albyana (sinov)');
  ok('Tiklashdan oldin holat boshqacha edi', beforeHas6 === true && beforeHas5 === false);

  section('Buzuq zaxira bilan tiklash rad etiladi');
  let threw = '';
  try { await backup.restore(store, tampered); } catch (e) { threw = e.message; }
  ok('Xato qaytardi', !!threw, threw);
  const payAfter = await store.get('payments/p1');
  ok('Ma’lumot o’zgarmadi', payAfter.amount === 500000);

  section('Eski (v2) formatdagi zaxira');
  const oldStyle = {
    version: 2, settings: { centerName: 'Eski' },
    collections: { users: { u1: { id: 'u1', hash: 'x' } }, students: { s1: { id: 's1', fullName: 'Eski o’quvchi' } } },
    docs: {}
  };
  const v3 = backup.validate(oldStyle);
  ok('Eski format qabul qilinadi', v3.ok, JSON.stringify(v3.errors));
  ok('Eski formatda ogohlantirish bor', v3.warnings.length > 0);

  section('Eski fayllarni tozalash (KEEP=3)');
  for (let i = 0; i < 5; i++) {
    await new Promise(r2 => setTimeout(r2, 1100));   // nom soniyaga bog'liq
    await backup.makeBackup(store, 'sinov');
  }
  const files = backup.list().filter(f => /^(albayan|albyana)-/.test(f.name));
  ok('Faqat ' + process.env.BACKUP_KEEP + ' ta saqlandi (' + files.length + ')', files.length <= 3);

  section('Kunlik jadval holati');
  const sch = backup.startSchedule(store, null);
  await new Promise(r2 => setTimeout(r2, 400));
  const st = await backup.readState(store);
  ok('Oxirgi muvaffaqiyat sanasi yozildi', !!st.lastOkDate, JSON.stringify(st));
  ok('Xato yo’q', !st.lastError);
  sch.stop();

  section('Xato bo’lganda holat yoziladi');
  const badStore = {
    kind: 'test',
    async all() { throw new Error('baza javob bermadi'); },
    async get(p) { return store.get(p); },
    async set(p, d) { return store.set(p, d); },
    async del(p) { return store.del(p); },
    async list(p) { return store.list(p); }
  };
  await backup.writeState(store, { lastOkDate: '' });
  let notified = null;
  const sch2 = backup.startSchedule(badStore, e => { notified = e.message; });
  await new Promise(r2 => setTimeout(r2, 400));
  ok('Xato ushlandi va direktorga xabar chaqirildi', notified === 'baza javob bermadi', String(notified));
  const st2 = await backup.readState(store);
  ok('Xato holati saqlandi', !!st2.lastError, JSON.stringify(st2));
  sch2.stop();

  if (store.close) await store.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
