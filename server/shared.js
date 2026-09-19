/* Albyana server — ilovaning o'z mantiqini serverda ham ishlatish.
   Shu tufayli ruxsatlar va hisob-kitoblar ikki joyda takrorlanmaydi. */
'use strict';
const fs = require('fs');
const path = require('path');

const files = ['core.js', 'model.js'];
files.forEach(function (f) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  (0, eval)(code);
});

const A = globalThis.A;

/** Yozish uchun kerakli ruxsat: hujjat yo'li -> ruxsat nomi */
function writePermFor(docPath) {
  const p = String(docPath || '');
  const col = p.split('/')[0];
  const map = {
    students: 'student.edit',
    memberships: 'student.edit',
    groups: 'group.edit',
    courses: 'group.edit',
    rooms: 'group.edit',
    leads: 'lead.edit',
    funnels: 'settings.edit',
    staff: 'staff.edit',
    users: 'users.manage',
    invoices: 'invoice.create',
    payments: 'payment.create',
    expenses: 'expense.edit',
    payroll: 'payroll.manage',
    tasks: 'task.view',
    chats: 'chat.use',
    botout: 'bot.broadcast',
    botreq: 'nav.bot'
  };
  if (col === 'meta') {
    if (p === 'meta/settings') return 'settings.edit';
    return null;                       // meta/finindex — har qanday kirgan foydalanuvchi
  }
  if (col === 'lessons') return 'attendance.mark';
  if (col === 'audit') return null;
  if (col === 'botstate' || col === 'botin') return '__server__';  // faqat bot yozadi
  return map[col] || '__server__';
}

/** Ba'zi hujjatlarni ko'rish ham cheklangan */
function readBlocked(docPath, user) {
  const col = String(docPath || '').split('/')[0];
  if (col === 'botstate') return true;
  if (col === 'payroll' && !A.can(user, 'finance.payroll')) return true;
  return false;
}

/** Foydalanuvchi hujjatini mijozga yuborishdan oldin tozalash */
function safeUser(u) {
  if (!u) return u;
  const c = Object.assign({}, u);
  delete c.salt;
  delete c.hash;
  return c;
}

module.exports = { A, writePermFor, readBlocked, safeUser };
