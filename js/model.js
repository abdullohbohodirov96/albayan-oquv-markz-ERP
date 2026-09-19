/* Albyana ERP — soha mantiqi (hisob-kitoblar, huquqlar, jadval) */
(function (global) {
  'use strict';
  var A = global.A;

  /* =============== HUQUQLAR =============== */
  var ROLES = {
    direktor: 'Direktor',
    admin: 'Administrator',
    oqituvchi: 'O’qituvchi',
    buxgalter: 'Buxgalter'
  };

  var PERMS = {
    direktor: ['*'],
    admin: [
      'nav.dashboard', 'nav.leads', 'nav.students', 'nav.groups', 'nav.schedule',
      'nav.attendance', 'nav.finance', 'nav.reports', 'nav.chat', 'nav.tasks', 'nav.bot',
      'lead.view', 'lead.edit', 'lead.import',
      'student.view', 'student.edit', 'student.import',
      'group.view', 'group.edit',
      'schedule.view', 'schedule.edit',
      'attendance.view', 'attendance.mark',
      'finance.payments', 'finance.debts',
      'payment.create', 'invoice.create',
      'reports.basic',
      'chat.use', 'task.view', 'task.assign',
      'bot.broadcast'
    ],
    oqituvchi: [
      'nav.dashboard', 'nav.groups', 'nav.schedule', 'nav.attendance', 'nav.students',
      'nav.chat', 'nav.tasks',
      'student.view', 'group.view', 'schedule.view',
      'attendance.view', 'attendance.mark',
      'chat.use', 'task.view'
    ],
    buxgalter: [
      'nav.dashboard', 'nav.students', 'nav.groups', 'nav.finance', 'nav.staff', 'nav.reports',
      'nav.chat', 'nav.tasks',
      'student.view', 'group.view', 'schedule.view',
      'attendance.view',
      'finance.payments', 'finance.debts', 'finance.expenses', 'finance.payroll',
      'payment.create', 'payment.void', 'invoice.create',
      'expense.edit', 'payroll.manage', 'staff.view',
      'reports.basic', 'reports.finance',
      'chat.use', 'task.view'
    ]
  };
  // Standart holatda faqat direktorda: payroll.approve, settings.edit, users.manage,
  // staff.edit, bot.manage. Ularni har bir foydalanuvchi uchun alohida berish mumkin.

  /** Interfeysda ko'rsatiladigan ruxsatlar ro'yxati */
  var PERM_GROUPS = [
    {
      key: 'leads', label: 'Murojaatlar', perms: [
        { id: 'nav.leads', label: 'Bo’limni ko’rish' },
        { id: 'lead.edit', label: 'Qo’shish va tahrirlash' },
        { id: 'lead.import', label: 'Excel’dan import' }
      ]
    },
    {
      key: 'students', label: 'O’quvchilar', perms: [
        { id: 'nav.students', label: 'Bo’limni ko’rish' },
        { id: 'student.view', label: 'Kartani ko’rish' },
        { id: 'student.edit', label: 'Qo’shish va tahrirlash' },
        { id: 'student.import', label: 'Excel’dan import' }
      ]
    },
    {
      key: 'groups', label: 'Guruhlar va kurslar', perms: [
        { id: 'nav.groups', label: 'Bo’limni ko’rish' },
        { id: 'group.view', label: 'Guruhni ko’rish' },
        { id: 'group.edit', label: 'Ochish va tahrirlash' }
      ]
    },
    {
      key: 'schedule', label: 'Jadval', perms: [
        { id: 'nav.schedule', label: 'Bo’limni ko’rish' },
        { id: 'schedule.view', label: 'Jadvalni ko’rish' },
        { id: 'schedule.edit', label: 'Dars ko’chirish va bekor qilish' }
      ]
    },
    {
      key: 'attendance', label: 'Davomat', perms: [
        { id: 'nav.attendance', label: 'Bo’limni ko’rish' },
        { id: 'attendance.view', label: 'Davomatni ko’rish' },
        { id: 'attendance.mark', label: 'Davomat olish' }
      ]
    },
    {
      key: 'finance', label: 'Moliya', perms: [
        { id: 'nav.finance', label: 'Bo’limni ko’rish' },
        { id: 'finance.payments', label: 'To’lovlar' },
        { id: 'finance.debts', label: 'Qarzdorlik' },
        { id: 'finance.expenses', label: 'Xarajatlar' },
        { id: 'finance.payroll', label: 'Ish haqi' },
        { id: 'payment.create', label: 'To’lov qabul qilish' },
        { id: 'payment.void', label: 'To’lovni bekor qilish' },
        { id: 'invoice.create', label: 'Oylik hisob yaratish' },
        { id: 'expense.edit', label: 'Xarajat kiritish' },
        { id: 'payroll.manage', label: 'Ish haqini hisoblash' },
        { id: 'payroll.approve', label: 'Ish haqini tasdiqlash' }
      ]
    },
    {
      key: 'staff', label: 'Xodimlar', perms: [
        { id: 'nav.staff', label: 'Bo’limni ko’rish' },
        { id: 'staff.view', label: 'Ro’yxatni ko’rish' },
        { id: 'staff.edit', label: 'Qo’shish va tahrirlash' }
      ]
    },
    {
      key: 'reports', label: 'Hisobotlar', perms: [
        { id: 'nav.reports', label: 'Bo’limni ko’rish' },
        { id: 'reports.basic', label: 'Umumiy hisobotlar' },
        { id: 'reports.finance', label: 'Moliyaviy hisobotlar' }
      ]
    },
    {
      key: 'team', label: 'Jamoa', perms: [
        { id: 'nav.chat', label: 'Suhbat bo’limi' },
        { id: 'chat.use', label: 'Xabar yozish' },
        { id: 'nav.tasks', label: 'Vazifalar bo’limi' },
        { id: 'task.view', label: 'Vazifalarni ko’rish' },
        { id: 'task.assign', label: 'Vazifa berish' }
      ]
    },
    {
      key: 'bot', label: 'Telegram bot', perms: [
        { id: 'nav.bot', label: 'Bo’limni ko’rish' },
        { id: 'bot.broadcast', label: 'O’quvchilarga xabar yuborish' },
        { id: 'bot.manage', label: 'Bot sozlamalari' }
      ]
    },
    {
      key: 'system', label: 'Tizim', perms: [
        { id: 'settings.edit', label: 'Sozlamalar' },
        { id: 'users.manage', label: 'Foydalanuvchilarni boshqarish' }
      ]
    }
  ];

  function allPermIds() {
    var out = [];
    PERM_GROUPS.forEach(function (g) { g.perms.forEach(function (p) { out.push(p.id); }); });
    out.push('nav.dashboard');
    return out;
  }

  /**
   * Ruxsat tekshiruvi.
   * user.perms — alohida sozlangan ruxsatlar: {perm: true|false}.
   * Aniq berilgan qiymat rolning standart ruxsatidan ustun turadi.
   */
  function can(user, perm) {
    if (!user) return false;
    if (user.perms && typeof user.perms === 'object' && Object.prototype.hasOwnProperty.call(user.perms, perm)) {
      return user.perms[perm] === true;
    }
    var list = PERMS[user.role] || [];
    if (list.indexOf('*') >= 0) return true;
    return list.indexOf(perm) >= 0;
  }

  /** Rolning standart ruxsatlari (interfeysda ko'rsatish uchun) */
  function roleHas(role, perm) {
    var list = PERMS[role] || [];
    return list.indexOf('*') >= 0 || list.indexOf(perm) >= 0;
  }
  /** O'qituvchi faqat o'z guruhlarini ko'radi */
  function scopeGroups(user, groups) {
    if (!user) return [];
    if (user.role === 'oqituvchi') {
      return groups.filter(function (g) { return g.teacherId && g.teacherId === user.staffId; });
    }
    return groups;
  }
  function canSeeGroup(user, group) {
    if (!user || !group) return false;
    if (user.role !== 'oqituvchi') return true;
    return group.teacherId === user.staffId;
  }

  /* =============== GURUH KODI =============== */
  /**
   * Guruh kodi: kurs nomining birinchi harfi + 3 xonali raqam (masalan B020).
   * Bot va ro'yxatlarda guruhni tez topish uchun ishlatiladi.
   */
  function nextGroupCode(courseName, groups) {
    var letter = String(courseName || 'G').trim().charAt(0).toUpperCase();
    if (!/[A-Z]/.test(letter)) letter = 'G';
    var max = 0;
    (groups || []).forEach(function (g) {
      var m = String(g.code || '').match(/^([A-Z])(\d+)$/);
      if (m && m[1] === letter) max = Math.max(max, Number(m[2]));
    });
    var n = String(max + 1);
    while (n.length < 3) n = '0' + n;
    return letter + n;
  }
  function groupLabel(g) {
    if (!g) return '—';
    return g.code ? g.code + ' · ' + g.name : g.name;
  }

  /* =============== NARX VA CHEGIRMA =============== */
  /** Guruhning berilgan oydagi narxi (narx tarixi bo'yicha) */
  function feeForMonth(group, ym) {
    if (!group) return 0;
    var hist = (group.feeHistory || []).slice().sort(function (a, b) {
      return String(a.from).localeCompare(String(b.from));
    });
    var fee = group.fee || 0;
    var applied = null;
    for (var i = 0; i < hist.length; i++) {
      if (String(hist[i].from) <= ym) applied = hist[i];
    }
    if (applied) return Math.round(applied.fee);
    // tarix bo'lmasa amaldagi narx
    return Math.round(fee);
  }

  /** Chegirma summasi. Manfiyga tushirmaydi. */
  function discountFor(base, discount, ym) {
    if (!discount || !discount.value) return 0;
    if (discount.from && ym < discount.from) return 0;
    if (discount.to && ym > discount.to) return 0;
    var d = 0;
    if (discount.type === 'percent') d = Math.round(base * (Number(discount.value) || 0) / 100);
    else d = Math.round(Number(discount.value) || 0);
    if (d < 0) d = 0;
    if (d > base) d = base;
    return d;
  }

  /** Bitta a'zolik uchun oylik hisob summasi */
  function invoiceAmountFor(group, membership, ym) {
    var base = feeForMonth(group, ym);
    if (membership && membership.firstMonth && membership.firstMonth.month === ym &&
      membership.firstMonth.mode === 'custom') {
      base = Math.max(0, Math.round(Number(membership.firstMonth.amount) || 0));
    }
    var disc = discountFor(base, membership && membership.discount, ym);
    return { base: base, discount: disc, final: Math.max(0, base - disc) };
  }

  /** A'zolik shu oyda faolmi? */
  function membershipActiveIn(m, ym) {
    if (!m) return false;
    var start = A.monthStart(ym), end = A.monthEnd(ym);
    if (m.joinedAt && m.joinedAt > end) return false;
    if (m.leftAt && m.leftAt < start) return false;
    return true;
  }

  function invoiceId(membershipId, ym) { return 'inv_' + membershipId + '_' + ym; }

  /** To'lov muddati sanasi */
  function dueDateFor(ym, dueDay) {
    var d = Math.min(Math.max(Number(dueDay) || 5, 1), 28);
    return ym + '-' + A.pad(d);
  }

  /* =============== TO'LOV TAQSIMOTI =============== */
  /**
   * Summani ochiq hisoblarga eng eskisidan boshlab taqsimlaydi.
   * openInvoices: [{id, remaining, month}] — oy bo'yicha tartiblangan bo'lishi shart emas.
   * Natija: {allocations: [{invoiceId, amount}], advance: n}
   */
  function allocate(amount, openInvoices) {
    var left = Math.round(Number(amount) || 0);
    var res = [];
    var list = (openInvoices || []).slice().sort(function (a, b) {
      return String(a.month).localeCompare(String(b.month));
    });
    for (var i = 0; i < list.length && left > 0; i++) {
      var rem = Math.round(list[i].remaining || 0);
      if (rem <= 0) continue;
      var take = Math.min(rem, left);
      res.push({ invoiceId: list[i].id, amount: take });
      left -= take;
    }
    return { allocations: res, advance: left };
  }

  /* =============== BALANSLAR =============== */
  /**
   * invoices: [{id, studentId, month, final}]
   * payments: [{id, studentId, amount, void, type, allocations:[{invoiceId, amount}]}]
   * Faqat bekor qilinmagan yozuvlar hisobga olinadi.
   */
  function activePayments(payments) {
    return (payments || []).filter(function (p) { return !p.voided; });
  }
  function paidByInvoice(payments) {
    var map = {};
    activePayments(payments).forEach(function (p) {
      var sign = p.type === 'refund' ? -1 : 1;
      (p.allocations || []).forEach(function (a) {
        map[a.invoiceId] = (map[a.invoiceId] || 0) + sign * Math.round(a.amount || 0);
      });
    });
    return map;
  }
  function invoiceRemaining(inv, paidMap) {
    return Math.max(0, Math.round(inv.final) - Math.round(paidMap[inv.id] || 0));
  }
  /** O'quvchi balansi */
  function balanceOf(studentId, invoices, payments) {
    var invs = (invoices || []).filter(function (i) { return i.studentId === studentId; });
    var pays = activePayments(payments).filter(function (p) { return p.studentId === studentId; });
    var charged = invs.reduce(function (s, i) { return s + Math.round(i.final); }, 0);
    var received = pays.reduce(function (s, p) {
      return s + (p.type === 'refund' ? -1 : 1) * Math.round(p.amount);
    }, 0);
    var allocated = pays.reduce(function (s, p) {
      var sign = p.type === 'refund' ? -1 : 1;
      return s + (p.allocations || []).reduce(function (t, a) { return t + sign * Math.round(a.amount); }, 0);
    }, 0);
    var debt = Math.max(0, charged - allocated);
    var advance = Math.max(0, received - allocated);
    return { charged: charged, received: received, allocated: allocated, debt: debt, advance: advance };
  }
  /** Muddati o'tgan qarz (bugungi sanaga nisbatan) */
  function overdueOf(studentId, invoices, payments, todayIso) {
    var paidMap = paidByInvoice(payments);
    return (invoices || [])
      .filter(function (i) { return i.studentId === studentId && i.dueDate && i.dueDate < todayIso; })
      .reduce(function (s, i) { return s + invoiceRemaining(i, paidMap); }, 0);
  }

  /* =============== JADVAL =============== */
  function timeToMin(t) {
    if (!t) return 0;
    var p = String(t).split(':');
    return Number(p[0]) * 60 + Number(p[1] || 0);
  }
  function overlaps(aStart, aEnd, bStart, bEnd) {
    return timeToMin(aStart) < timeToMin(bEnd) && timeToMin(bStart) < timeToMin(aEnd);
  }
  /**
   * Guruh jadvalidagi to'qnashuvlar.
   * candidate: {id, days:[1..7], startTime, endTime, teacherId, roomId, status}
   * Natija: [{type:'teacher'|'room', groupId, day}]
   */
  function scheduleConflicts(candidate, groups) {
    var out = [];
    (groups || []).forEach(function (g) {
      if (!g || g.id === candidate.id) return;
      if (g.status === 'yakunlangan') return;
      (candidate.days || []).forEach(function (d) {
        if ((g.days || []).indexOf(d) < 0) return;
        if (!overlaps(candidate.startTime, candidate.endTime, g.startTime, g.endTime)) return;
        if (candidate.teacherId && g.teacherId === candidate.teacherId) {
          out.push({ type: 'teacher', groupId: g.id, day: d });
        }
        if (candidate.roomId && g.roomId === candidate.roomId) {
          out.push({ type: 'room', groupId: g.id, day: d });
        }
      });
    });
    return out;
  }

  /** Bitta darsni ko'chirishda to'qnashuv (aniq sana bo'yicha) */
  function lessonConflicts(candidate, occupied) {
    // occupied: [{date, start, end, teacherId, roomId, groupId}]
    var out = [];
    (occupied || []).forEach(function (o) {
      if (o.groupId === candidate.groupId && o.date === candidate.date) return;
      if (o.date !== candidate.date) return;
      if (!overlaps(candidate.start, candidate.end, o.start, o.end)) return;
      if (candidate.teacherId && o.teacherId === candidate.teacherId) out.push({ type: 'teacher', groupId: o.groupId });
      if (candidate.roomId && o.roomId === candidate.roomId) out.push({ type: 'room', groupId: o.groupId });
    });
    return out;
  }

  /**
   * Guruhning bir oydagi darslari: haftalik jadvaldan hosil qilinadi,
   * lessons hujjatidagi o'zgarishlar (ko'chirish/bekor qilish) ustun turadi.
   */
  function monthLessons(group, ym, lessonDoc) {
    var out = [];
    var n = A.daysInMonth(ym);
    var items = (lessonDoc && lessonDoc.items) || {};
    for (var d = 1; d <= n; d++) {
      var iso = ym + '-' + A.pad(d);
      if (group.startDate && iso < group.startDate) continue;
      if (group.endDate && iso > group.endDate) continue;
      var planned = (group.days || []).indexOf(A.weekdayOf(iso)) >= 0;
      var ov = items[iso];
      if (!planned && !(ov && ov.added)) continue;
      out.push({
        date: iso,
        groupId: group.id,
        start: (ov && ov.start) || group.startTime,
        end: (ov && ov.end) || group.endTime,
        roomId: (ov && ov.roomId) || group.roomId,
        teacherId: (ov && ov.teacherId) || group.teacherId,
        status: (ov && ov.status) || 'rejalashtirilgan',
        movedTo: ov && ov.movedTo,
        note: ov && ov.note,
        attendance: (ov && ov.attendance) || null,
        markedBy: ov && ov.markedBy,
        markedAt: ov && ov.markedAt
      });
    }
    // ko'chirib kelingan darslar (boshqa kundan)
    Object.keys(items).forEach(function (iso) {
      if (iso.slice(0, 7) !== ym) return;
      if (!items[iso].added) return;
      if (out.some(function (l) { return l.date === iso; })) return;
      var ov = items[iso];
      out.push({
        date: iso, groupId: group.id, start: ov.start || group.startTime, end: ov.end || group.endTime,
        roomId: ov.roomId || group.roomId, teacherId: ov.teacherId || group.teacherId,
        status: ov.status || 'rejalashtirilgan', note: ov.note,
        attendance: ov.attendance || null, markedBy: ov.markedBy, markedAt: ov.markedAt
      });
    });
    return A.sortBy(out, 'date');
  }

  /* =============== DAVOMAT =============== */
  var ATT = {
    keldi: { label: 'Keldi', cls: 'ok' },
    kelmadi: { label: 'Kelmadi', cls: 'bad' },
    kechikdi: { label: 'Kechikdi', cls: 'warn' },
    sababli: { label: 'Sababli', cls: 'info' }
  };
  function attendanceStats(records) {
    var s = { keldi: 0, kelmadi: 0, kechikdi: 0, sababli: 0, belgilanmagan: 0, jami: 0 };
    (records || []).forEach(function (r) {
      s.jami++;
      if (!r || !r.status) s.belgilanmagan++;
      else if (s[r.status] !== undefined) s[r.status]++;
    });
    return s;
  }

  /* =============== ISH HAQI =============== */
  /**
   * O'qituvchi ish haqi. percent turida: shu oyda qabul qilingan va
   * o'qituvchining guruhlariga taqsimlangan haqiqiy pul asos qilinadi.
   * payments: shu oydagi to'lovlar, invoices: barcha hisoblar (oy bilan cheklanmagan),
   * groupsById: {groupId: group}
   */
  function payrollFor(staff, ym, payments, invoicesById, groupsById) {
    if (!staff) return { amount: 0, lines: [] };
    if (staff.payType === 'fixed') {
      return { amount: Math.round(staff.salaryAmount || 0), lines: [], type: 'fixed' };
    }
    var rate = Number(staff.percentRate) || 0;
    var lines = [];
    var base = 0;
    activePayments(payments).forEach(function (p) {
      var sign = p.type === 'refund' ? -1 : 1;
      (p.allocations || []).forEach(function (a) {
        var inv = invoicesById[a.invoiceId];
        if (!inv) return;
        var g = groupsById[inv.groupId];
        if (!g || g.teacherId !== staff.id) return;
        var amt = sign * Math.round(a.amount || 0);
        base += amt;
        lines.push({
          paymentId: p.id, date: p.date, studentId: p.studentId,
          groupId: inv.groupId, invoiceId: a.invoiceId, amount: amt,
          kind: p.type === 'refund' ? 'qaytarish' : 'to’lov'
        });
      });
    });
    return { amount: Math.round(base * rate / 100), base: base, rate: rate, lines: lines, type: 'percent' };
  }

  /* =============== MUROJAATLAR VA VORONKALAR =============== */
  var LEAD_STAGES = [
    { id: 'yangi', label: 'Yangi' },
    { id: 'boglanildi', label: 'Bog’lanildi' },
    { id: 'sinov', label: 'Sinov darsiga yozildi' },
    { id: 'oquvchi', label: 'O’quvchi bo’ldi', type: 'won' },
    { id: 'rad', label: 'Rad etdi', type: 'lost' }
  ];

  /** Tizim bilan keladigan voronkalar */
  var DEFAULT_FUNNELS = [
    {
      id: 'fnl_asosiy', name: 'Asosiy', isDefault: true, order: 1,
      stages: LEAD_STAGES.map(function (s) { return Object.assign({}, s); })
    },
    {
      id: 'fnl_target', name: 'Target reklama', order: 2, autoSource: 'Target',
      stages: [
        { id: 'yangi', label: 'Yangi lid' },
        { id: 'boglanildi', label: 'Bog’lanildi' },
        { id: 'qiziqdi', label: 'Qiziqdi' },
        { id: 'sinov', label: 'Sinov darsiga yozildi' },
        { id: 'oquvchi', label: 'O’quvchi bo’ldi', type: 'won' },
        { id: 'rad', label: 'Rad etdi', type: 'lost' }
      ]
    },
    {
      id: 'fnl_instagram', name: 'Instagram', order: 3, autoSource: 'Instagram',
      stages: [
        { id: 'yangi', label: 'Yangi yozuv' },
        { id: 'boglanildi', label: 'Bog’lanildi' },
        { id: 'sinov', label: 'Sinov darsiga yozildi' },
        { id: 'oquvchi', label: 'O’quvchi bo’ldi', type: 'won' },
        { id: 'rad', label: 'Rad etdi', type: 'lost' }
      ]
    }
  ];

  function funnelStages(funnel) {
    if (funnel && Array.isArray(funnel.stages) && funnel.stages.length) return funnel.stages;
    return LEAD_STAGES;
  }
  function stageOf(funnel, stageId) {
    return funnelStages(funnel).filter(function (s) { return s.id === stageId; })[0] || { id: stageId, label: stageId };
  }
  /** Matndan telefon raqamini ajratib olish (Instagram izohlari uchun) */
  function extractPhone(text) {
    var s = String(text || '').replace(/[^\d+]/g, ' ');
    var m = s.match(/\+?\d[\d\s]{6,}/);
    if (!m) return '';
    var d = m[0].replace(/\D/g, '');
    if (d.length < 7) return '';
    if (d.length === 9) d = '998' + d;
    return '+' + d;
  }

  /* =============== HISOBOTLAR =============== */
  function cashFlow(payments, expenses) {
    var income = 0, refunds = 0, spent = 0;
    activePayments(payments).forEach(function (p) {
      if (p.type === 'refund') refunds += Math.round(p.amount);
      else income += Math.round(p.amount);
    });
    (expenses || []).forEach(function (e) { if (!e.voided) spent += Math.round(e.amount); });
    return { income: income, refunds: refunds, expenses: spent, net: income - refunds - spent };
  }

  global.A = global.A || {};
  Object.assign(global.A, {
    ROLES: ROLES, PERMS: PERMS, PERM_GROUPS: PERM_GROUPS, allPermIds: allPermIds,
    can: can, roleHas: roleHas, scopeGroups: scopeGroups, canSeeGroup: canSeeGroup,
    nextGroupCode: nextGroupCode, groupLabel: groupLabel,
    feeForMonth: feeForMonth, discountFor: discountFor, invoiceAmountFor: invoiceAmountFor,
    membershipActiveIn: membershipActiveIn, invoiceId: invoiceId, dueDateFor: dueDateFor,
    allocate: allocate, activePayments: activePayments, paidByInvoice: paidByInvoice,
    invoiceRemaining: invoiceRemaining, balanceOf: balanceOf, overdueOf: overdueOf,
    timeToMin: timeToMin, overlaps: overlaps, scheduleConflicts: scheduleConflicts,
    lessonConflicts: lessonConflicts, monthLessons: monthLessons,
    ATT: ATT, attendanceStats: attendanceStats, payrollFor: payrollFor,
    LEAD_STAGES: LEAD_STAGES, DEFAULT_FUNNELS: DEFAULT_FUNNELS,
    funnelStages: funnelStages, stageOf: stageOf, extractPhone: extractPhone,
    cashFlow: cashFlow
  });
})(typeof window !== 'undefined' ? window : globalThis);
