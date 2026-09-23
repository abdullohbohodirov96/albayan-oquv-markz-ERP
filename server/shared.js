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
    /* Saytdagi izohlar: markaz tasdiqlaydi yoki o'chiradi */
    reviews: 'settings.edit',
    funnels: 'settings.edit',
    staff: 'staff.edit',
    teachers: 'staff.edit',      // saytdagi ustoz profillari
    photos: 'staff.edit',       // ustoz rasmlari (alohida — ro'yxatlar yengil qolsin)
    users: 'users.manage',
    invoices: 'invoice.create',
    payments: '__server__',      // to'lovlar faqat /api/payment orqali
    audit: '__server__',         // tarixni faqat server yozadi
    expenses: 'expense.edit',
    payroll: 'payroll.manage',
    tasks: 'task.view',
    chats: 'chat.use',
    botout: 'bot.broadcast',
    botreq: 'nav.bot',
    /* O'quv dasturi — alohida huquq bilan tahrirlanadi */
    modules: 'curriculum.edit',
    topics: 'curriculum.edit',
    materials: 'curriculum.edit',
    homework: 'curriculum.edit'
    /* Qolgan o'quv to'plamlari ro'yxatda yo'q — ular '__server__' bo'lib
       qoladi, ya'ni faqat maxsus API yo'llari orqali yoziladi.          */
  };
  if (col === 'meta') {
    if (p === 'meta/settings') return 'settings.edit';
    return null;                       // meta/finindex — har qanday kirgan foydalanuvchi
  }
  if (col === 'lessons') return 'attendance.mark';
  if (col === 'botstate' || col === 'botin') return '__server__';  // faqat bot yozadi
  return map[col] || '__server__';
}

/** Ba'zi hujjatlarni ko'rish ham cheklangan */
function readBlocked(docPath, user) {
  const col = String(docPath || '').split('/')[0];
  if (col === 'botstate') return true;
  if (col === 'photos') return true;               // rasm faqat /api/photo orqali beriladi
  /* Daraja testi: savollar ichida TO'G'RI JAVOB bor — hech kimga berilmaydi.
     Boshlangan test sessiyasi ham (savol ro'yxati) mijozga chiqmaydi.       */
  if (col === 'testq' || col === 'testsess') return true;
  /* Dars testlari ham shunday: savol matni javobi bilan turadi. */
  if (col === 'quizq' || col === 'quizsess') return true;
  /* Test natijalari — faqat murojaat/o'quvchi bilan ishlaydiganlarga */
  if (col === 'placements' && !A.can(user, 'lead.view')) return true;
  if (col === 'payroll' && !A.can(user, 'finance.payroll')) return true;
  return false;
}

/** Foydalanuvchi hujjatini mijozga yuborishdan oldin tozalash */
function safeUser(u) {
  if (!u) return u;
  const c = Object.assign({}, u);
  delete c.salt;
  delete c.hash;
  delete c.iter;
  delete c.algo;
  return c;
}

/** Xodim yozuvidan ish haqi ma'lumotini olib tashlash */
function safeStaff(s, user) {
  if (!s) return s;
  if (A.can(user, 'finance.payroll') || A.can(user, 'staff.edit')) return s;
  const c = Object.assign({}, s);
  delete c.salaryAmount;
  delete c.percentRate;
  delete c.payType;
  return c;
}

/** O'quvchi yozuvidan ortiqcha shaxsiy ma'lumotni olib tashlash (o'qituvchi uchun) */
function safeStudent(s, user) {
  if (!s) return s;
  if (user.role !== 'oqituvchi') return s;
  return {
    id: s.id, firstName: s.firstName, lastName: s.lastName,
    phone: s.phone, status: s.status, telegram: s.telegram ? { id: s.telegram.id } : undefined
  };
}

/* Markazning yagona umumiy suhbati — identifikator server tomonida belgilangan */
const GENERAL_CHAT = 'chat_umumiy';

/**
 * Foydalanuvchiga ko'rsatish mumkin bo'lgan ma'lumotlarni ajratish.
 * Serverda bajariladi — brauzerga ortiqchasi umuman yuborilmaydi.
 */
function visibleData(user, all) {
  const col = {};
  const docs = {};
  let settings = null;

  const byPath = {};
  all.forEach(({ path: p, data }) => { byPath[p] = data; });

  const groups = all.filter(x => x.path.indexOf('groups/') === 0 && x.path.split('/').length === 2)
    .map(x => x.data);
  const memberships = all.filter(x => x.path.indexOf('memberships/') === 0 && x.path.split('/').length === 2)
    .map(x => x.data);

  // O'qituvchi uchun ko'rinadigan guruh va o'quvchilar
  const myGroupIds = {};
  const myStudentIds = {};
  if (user.role === 'oqituvchi') {
    groups.forEach(g => { if (g.teacherId && g.teacherId === user.staffId) myGroupIds[g.id] = 1; });
    memberships.forEach(m => { if (myGroupIds[m.groupId]) myStudentIds[m.studentId] = 1; });
  }

  function allowCollection(name) {
    switch (name) {
      case 'users': return true;                       // faqat nom/rol yuboriladi
      case 'staff': return true;                       // ish haqi olib tashlanadi
      case 'teachers': return true;                    // ochiq ma'lumot — hamma ko'radi
      case 'students': return A.can(user, 'student.view');
      case 'groups': case 'courses': case 'rooms': case 'memberships':
        return A.can(user, 'group.view') || A.can(user, 'student.view');
      case 'leads': case 'funnels': return A.can(user, 'nav.leads');
      /* Saytdagi izohlar — sozlamani boshqaradiganlarga (tasdiqlash uchun) */
      case 'reviews': return A.can(user, 'settings.edit');
      /* Daraja testi natijalari — murojaatlar bilan ishlaydiganlarga.
         Savollar ('testq') va sessiyalar ('testsess') hech kimga chiqmaydi. */
      case 'placements': return A.can(user, 'lead.view');
      /* O'quv dasturi — ko'rish hamma xodimga, tahrir alohida huquq bilan */
      case 'modules': case 'topics': case 'materials': case 'homework':
        return A.can(user, 'curriculum.view') || A.can(user, 'group.view');
      case 'lessonlog': case 'holidays': case 'pauses': case 'makeups':
        return A.can(user, 'group.view') || A.can(user, 'schedule.view');
      case 'quizzes': case 'quizres': case 'asks':
        return A.can(user, 'group.view') || A.can(user, 'student.view');
      case 'questions': case 'feedback':
        return A.can(user, 'group.view');
      /* Ota-ona hisobi — o'quvchi bilan ishlaydiganlarga */
      case 'parents': return A.can(user, 'student.view');
      /* Fayl ma'lumotnomasi (mazmuni emas) — /api/file orqali olinadi */
      case 'files': return A.can(user, 'group.view') || A.can(user, 'student.view');
      case 'invoices': case 'payments': return A.can(user, 'finance.payments') || A.can(user, 'finance.debts');
      case 'expenses': return A.can(user, 'finance.expenses');
      case 'payroll': return A.can(user, 'finance.payroll');
      case 'tasks': return A.can(user, 'nav.tasks');
      case 'chats': return A.can(user, 'nav.chat');
      case 'botreq': case 'botout': case 'botin': return A.can(user, 'nav.bot');
      case 'audit': return A.can(user, 'settings.edit');
      default: return false;
    }
  }

  function filterDoc(name, d) {
    if (!d) return null;
    switch (name) {
      case 'users':
        if (A.can(user, 'users.manage')) return safeUser(d);
        return { id: d.id, name: d.name, role: d.role, active: d.active, staffId: d.staffId };
      case 'staff': return safeStaff(d, user);
      case 'students':
        if (user.role === 'oqituvchi' && !myStudentIds[d.id]) return null;
        return safeStudent(d, user);
      case 'groups':
        if (user.role === 'oqituvchi' && !myGroupIds[d.id]) return null;
        return d;
      case 'memberships':
        if (user.role === 'oqituvchi' && !myGroupIds[d.groupId]) return null;
        return d;
      case 'invoices': case 'payments':
        if (user.role === 'oqituvchi') return null;
        return d;
      case 'chats':
        // "type" mijozdan keladi — unga ishonilmaydi. Umumiy suhbat faqat bitta.
        if (d.id === GENERAL_CHAT) return d;
        return (d.members || []).indexOf(user.id) >= 0 ? d : null;
      case 'tasks':
        if (A.can(user, 'task.assign') || A.can(user, 'settings.edit')) return d;
        return (d.assigneeId === user.id || d.createdById === user.id) ? d : null;
      default: return d;
    }
  }

  all.forEach(({ path: p, data }) => {
    const seg = p.split('/');
    if (p === 'meta/settings') {
      settings = Object.assign({}, data);
      if (settings.bot) settings.bot = Object.assign({}, settings.bot, { token: undefined });
      return;
    }
    if (seg[0] === 'botstate') return;
    if (seg[0] === 'meta') { docs[p] = data; return; }

    if (seg.length === 2) {
      if (!allowCollection(seg[0])) return;
      const f = filterDoc(seg[0], data);
      if (!f) return;
      (col[seg[0]] = col[seg[0]] || {})[seg[1]] = f;
      return;
    }
    // ko'p segmentli hujjatlar (lessons/...)
    if (seg[0] === 'lessons') {
      if (user.role === 'oqituvchi') {
        const gid = String(seg[1] || '').split('__')[0];
        if (!myGroupIds[gid]) return;
      }
      docs[p] = data;
    }
  });

  return { col, docs, settings };
}

module.exports = { A, writePermFor, readBlocked, safeUser, safeStaff, safeStudent, visibleData, GENERAL_CHAT };
