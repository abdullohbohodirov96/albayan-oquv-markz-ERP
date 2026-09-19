/* Albyana ERP — amallar qatlami.
   Muhim: har bir hisob, to'lov, xarajat va ish haqi ALOHIDA yozuv sifatida
   saqlanadi. Shu tufayli ikki xodim bir vaqtda ishlaganda biri ikkinchisining
   yozuvini bosib ketmaydi. */
(function (global) {
  'use strict';
  var A = global.A;
  var D = A.Data;

  var MONTHLY = ['invoices', 'payments', 'expenses', 'payroll'];

  var Fin = {
    /* --- To'plangan ro'yxatlar --- */
    allInvoices: function () { return D.all('invoices'); },
    allPayments: function () { return D.all('payments'); },
    allExpenses: function () { return D.all('expenses'); },
    monthItems: function (kind, ym) {
      return D.all(kind).filter(function (x) { return x.month === ym; });
    },
    invoicesById: function () {
      var m = {};
      D.all('invoices').forEach(function (i) { m[i.id] = i; });
      return m;
    },
    payrollItem: function (ym, staffId) {
      return D.one('payroll', ym + '__' + staffId);
    },

    /* Eski versiyalar bilan moslik (endi indeks kerak emas) */
    index: { invoices: [], payments: [], expenses: [], payroll: [], audit: [] },
    async loadIndex() { },
    async addToIndex() { },
    async loadAll() { },

    /**
     * Eski (oylik hujjatli) ma'lumotni yangi ko'rinishga o'tkazish.
     * Bir marta ishlaydi, mavjud ma'lumotlarni yo'qotmaydi.
     */
    async migrate() {
      if (D.mode === 'server') return { moved: 0 };   // serverda migratsiya serverda bajariladi

      // eski indeksni o'qib, oylik hujjatlarni yuklaymiz
      var idx = null;
      if (D.mode === 'cloud') {
        try {
          var s = await D.db.doc('meta/finindex').get();
          idx = s.exists ? s.data() : null;
        } catch (e) { idx = null; }
      } else {
        try { idx = JSON.parse(global.localStorage.getItem('albyana_finindex') || 'null'); } catch (e) { idx = null; }
      }
      if (idx) {
        var kinds = ['invoices', 'payments', 'expenses', 'payroll', 'audit'];
        for (var q = 0; q < kinds.length; q++) {
          var months = idx[kinds[q]] || [];
          for (var z = 0; z < months.length; z++) {
            await D.loadMonth(kinds[q], months[z]);
          }
        }
      }

      var moved = 0;
      var paths = Object.keys(D.docs).filter(function (p) {
        var seg = p.split('/');
        return (MONTHLY.indexOf(seg[0]) >= 0 || seg[0] === 'audit') &&
          seg.length === 2 && D.docs[p] && (D.docs[p].items || D.docs[p].list);
      });
      for (var i = 0; i < paths.length; i++) {
        var p = paths[i];
        var kind = p.split('/')[0];
        var ym = p.split('/')[1];
        if (kind === 'audit') {
          var list = D.docs[p].list || [];
          for (var q2 = 0; q2 < Math.min(list.length, 300); q2++) {
            var le = list[q2];
            le.id = le.id || A.uid('log');
            le.month = ym;
            if (!D.one('audit', le.id)) { await D.save('audit', le); moved++; }
          }
          delete D.docs[p];
          try { await D._delDoc(p); } catch (e) { }
          continue;
        }
        var items = D.docs[p].items || {};
        var keys = Object.keys(items);
        for (var k = 0; k < keys.length; k++) {
          var rec = items[keys[k]];
          if (!rec || typeof rec !== 'object') continue;
          rec.id = rec.id || (kind === 'payroll' ? ym + '__' + keys[k] : keys[k]);
          rec.month = rec.month || ym;
          if (kind === 'payroll') rec.id = ym + '__' + (rec.staffId || keys[k]);
          if (!D.one(kind, rec.id)) { await D.save(kind, rec); moved++; }
        }
        delete D.docs[p];
        try { await D._delDoc(p); } catch (e) { }
      }
      return { moved: moved };
    }
  };

  /* =============== TARIX (audit) =============== */
  /**
   * Serverli rejimda tarixni FAQAT server yozadi (muallif va vaqtni
   * brauzer belgilay olmaydi). Boshqa rejimlarda mijoz yozadi.
   */
  async function audit(actor, action, entity, details) {
    if (D.mode === 'server') return;
    var rec = {
      id: A.uid('log'),
      at: A.nowStamp(),
      month: A.thisMonth(),
      by: actor ? actor.name : '—',
      byLogin: actor ? actor.login : '',
      role: actor ? actor.role : '',
      action: action,
      entity: entity || '',
      details: details || ''
    };
    await D.save('audit', rec);
    // tarix cheksiz o'smasin
    var all = D.all('audit');
    if (all.length > 500) {
      var old = A.sortBy(all, 'at').slice(0, all.length - 500);
      for (var i = 0; i < old.length; i++) { await D.remove('audit', old[i].id); }
    }
  }

  /* =============== OYLIK HISOBLAR =============== */
  function invoiceDraft(membership, group, ym, settings, actor, opts) {
    var dueDay = (settings && settings.dueDay) || 5;
    var amt = A.invoiceAmountFor(group, membership, ym);
    var finalAmt = opts && opts.amount != null ? Math.max(0, Math.round(opts.amount)) : amt.final;
    var due = (opts && opts.dueDate) || A.dueDateFor(ym, dueDay);
    // oy o'rtasida qo'shilgan o'quvchi o'tmishdagi sanadan qarzdor bo'lib qolmasin
    if (membership.joinedAt && membership.joinedAt > due) {
      due = A.addDays(membership.joinedAt, 7);
    }
    return {
      id: A.invoiceId(membership.id, ym),
      membershipId: membership.id, studentId: membership.studentId,
      groupId: membership.groupId, month: ym,
      base: amt.base, discount: Math.max(0, amt.base - finalAmt), final: finalAmt,
      dueDate: due, createdAt: A.nowStamp(),
      createdBy: actor ? actor.name : 'tizim',
      note: (opts && opts.note) || (membership.firstMonth && membership.firstMonth.month === ym && membership.firstMonth.note) || ''
    };
  }

  /** Shu oy uchun faol a'zoliklarga hisob yaratadi (takrorlanmaydi). */
  async function generateInvoices(ym, actor) {
    if (D.mode === 'server') {
      var r = await D.api('POST', 'api/invoices/generate', { month: ym });
      await D.loadBootstrap();
      return r;
    }
    var groups = A.byId(D.all('groups'));
    var students = A.byId(D.all('students'));
    var created = 0, skipped = 0;
    var mems = D.all('memberships');
    for (var i = 0; i < mems.length; i++) {
      var m = mems[i];
      if (m.status !== 'faol') continue;
      if (!A.membershipActiveIn(m, ym)) continue;
      var g = groups[m.groupId];
      var st = students[m.studentId];
      if (!g || !st || st.status === 'arxiv') continue;
      if (g.status === 'rejalashtirilgan') continue;
      if (g.startDate && g.startDate > A.monthEnd(ym)) continue;
      var id = A.invoiceId(m.id, ym);
      if (D.one('invoices', id)) { skipped++; continue; }
      await D.save('invoices', invoiceDraft(m, g, ym, D.settings, actor, null));
      created++;
    }
    if (created) await audit(actor, 'Oylik hisoblar yaratildi', A.monthLabel(ym), created + ' ta yangi hisob');
    return { created: created, skipped: skipped };
  }

  /** Bitta a'zolik uchun hisob (oy o'rtasida qo'shilgan o'quvchi) */
  async function createSingleInvoice(membership, ym, opts, actor) {
    var g = D.one('groups', membership.groupId);
    var id = A.invoiceId(membership.id, ym);
    var exists = D.one('invoices', id);
    if (exists) return exists;
    var rec = invoiceDraft(membership, g, ym, D.settings, actor, opts);
    if (D.mode === 'server') {
      await D.api('PUT', 'api/doc?path=' + encodeURIComponent('invoices/' + rec.id), {
        data: rec, action: 'Hisob yaratildi', entity: A.monthLabel(ym)
      });
      D.col.invoices[rec.id] = rec;
      return rec;
    }
    await D.save('invoices', rec);
    return rec;
  }

  async function deleteInvoice(inv, actor, reason) {
    var paid = A.paidByInvoice(Fin.allPayments())[inv.id] || 0;
    if (paid > 0) throw new Error('Bu hisobga to’lov qilingan, o’chirib bo’lmaydi.');
    await D.remove('invoices', inv.id);
    await audit(actor, 'Hisob o’chirildi', inv.id, reason || '');
  }

  /* =============== TO'LOVLAR =============== */
  function localReceiptNo(ym) {
    var n = Fin.monthItems('payments', ym).filter(function (p) { return p.type !== 'refund'; }).length + 1;
    return 'ALB-' + ym.replace('-', '') + '-' + String(n).padStart(4, '0');
  }

  /**
   * To'lov qabul qilish.
   * Serverli rejimda chek raqamini SERVER yaratadi va bir xil id bilan
   * kelgan takroriy so'rov yangi to'lov yaratmaydi.
   */
  async function createPayment(input, actor) {
    var id = input.id || A.uid('pay');
    var ym = A.ymOf(input.date);

    if (D.mode === 'server') {
      var r = await D.api('POST', 'api/payment', {
        id: id,
        type: input.type || 'payment',
        studentId: input.studentId,
        amount: Math.round(Number(input.amount) || 0),
        date: input.date,
        method: input.method || 'naqd',
        note: input.note || '',
        allocations: input.allocations || [],
        refOf: input.refOf || null,
        fromAdvance: input.fromAdvance === true
      });
      if (r && r.payment) {
        D.col.payments[r.payment.id] = r.payment;
        return r.payment;
      }
      throw new Error('Server to’lovni tasdiqlamadi.');
    }

    var existing = D.one('payments', id);
    if (existing) return existing;               // takroriy bosish
    var rec = {
      id: id,
      type: input.type || 'payment',
      studentId: input.studentId,
      amount: Math.round(Number(input.amount) || 0),
      date: input.date,
      month: ym,
      method: input.method || 'naqd',
      note: input.note || '',
      allocations: (input.allocations || []).map(function (a) {
        return { invoiceId: a.invoiceId, amount: Math.round(a.amount) };
      }),
      receiptNo: input.receiptNo || localReceiptNo(ym),
      createdAt: A.nowStamp(),
      createdBy: actor ? actor.name : '—',
      refOf: input.refOf || null,
      fromAdvance: input.fromAdvance === true
    };
    if (rec.type === 'refund') {
      var cap = refundCap(rec.refOf);
      if (rec.amount > cap) throw new Error('Qaytarish summasi ruxsat etilgandan ko’p: ' + A.som(cap));
    }
    await D.save('payments', rec);
    await audit(actor, rec.type === 'refund' ? 'Pul qaytarildi' : 'To’lov qabul qilindi',
      rec.receiptNo, A.somFull(rec.amount));
    return rec;
  }

  /**
   * Avansdan qoplash: yangi pul kirmaydi.
   * Yozuvning summasi 0 bo'ladi — daromad hisobotiga qo'shilmaydi,
   * faqat taqsimot yoziladi: qarz ham, avans ham shuncha kamayadi.
   */
  async function applyAdvance(input, actor) {
    var id = input.id || A.uid('adv');
    var ym = A.ymOf(input.date || A.today());

    if (D.mode === 'server') {
      var r = await D.api('POST', 'api/payment', {
        id: id, type: 'advance',
        studentId: input.studentId,
        amount: (input.allocations || []).reduce(function (t, a) { return t + Math.round(a.amount); }, 0),
        date: input.date || A.today(),
        note: input.note || '',
        allocations: input.allocations || []
      });
      if (r && r.payment) { D.col.payments[r.payment.id] = r.payment; return r.payment; }
      throw new Error('Server qoplashni tasdiqlamadi.');
    }

    var existing = D.one('payments', id);
    if (existing) return existing;

    var bal = A.balanceOf(input.studentId, Fin.allInvoices(), Fin.allPayments());
    var paid = A.paidByInvoice(Fin.allPayments());
    var invById = {};
    Fin.allInvoices().forEach(function (i) { invById[i.id] = i; });

    var allocations = [], sum = 0;
    (input.allocations || []).forEach(function (a) {
      var inv = invById[a.invoiceId];
      if (!inv || inv.studentId !== input.studentId) return;
      var remaining = A.invoiceRemaining(inv, paid);
      var amt = Math.min(Math.round(a.amount), remaining, bal.advance - sum);
      if (amt <= 0) return;
      allocations.push({ invoiceId: inv.id, amount: amt });
      sum += amt;
    });
    if (!allocations.length) throw new Error('Qoplash uchun ochiq hisob yo’q yoki avans yetmaydi.');

    var rec = {
      id: id, type: 'advance', studentId: input.studentId,
      amount: 0, applied: sum,
      date: input.date || A.today(), month: ym, method: 'avans',
      note: input.note || '',
      allocations: allocations,
      receiptNo: localReceiptNo(ym),
      createdAt: A.nowStamp(),
      createdBy: actor ? actor.name : '—',
      fromAdvance: true
    };
    await D.save('payments', rec);
    await audit(actor, 'Avansdan qoplandi', rec.receiptNo, A.somFull(sum));
    return rec;
  }

  /** Qaytarish mumkin bo'lgan qoldiq: asl to'lov − oldingi qaytarishlar */
  function refundCap(paymentId) {
    var p = D.one('payments', paymentId);
    if (!p || p.voided) return 0;
    var done = D.all('payments')
      .filter(function (r) { return r.type === 'refund' && r.refOf === paymentId && !r.voided; })
      .reduce(function (s, r) { return s + Math.round(r.amount); }, 0);
    return Math.max(0, Math.round(p.amount) - done);
  }

  async function voidPayment(pay, reason, actor) {
    if (D.mode === 'server') {
      var r = await D.api('POST', 'api/payment/void', { id: pay.id, reason: reason });
      if (r && r.payment) D.col.payments[r.payment.id] = r.payment;
      return;
    }
    var rec = A.clone(D.one('payments', pay.id) || pay);
    rec.voided = { reason: reason, by: actor ? actor.name : '—', at: A.nowStamp() };
    await D.save('payments', rec);
    await audit(actor, 'To’lov bekor qilindi', rec.receiptNo, reason || '');
  }

  /* =============== XARAJATLAR =============== */
  async function saveExpense(exp, actor) {
    var isNew = !exp.id;
    if (!exp.id) exp.id = A.uid('exp');
    exp.month = A.ymOf(exp.date);
    exp.createdAt = exp.createdAt || A.nowStamp();
    exp.createdBy = exp.createdBy || (actor ? actor.name : '—');
    var old = D.one('expenses', exp.id);
    if (!isNew && old) {
      exp.history = (old.history || []).concat([{
        at: A.nowStamp(), by: actor ? actor.name : '—', eski: old.amount, yangi: exp.amount
      }]);
    }
    await D.save('expenses', exp);
    await audit(actor, isNew ? 'Xarajat qo’shildi' : 'Xarajat tuzatildi', exp.category, A.somFull(exp.amount));
    return exp;
  }
  async function voidExpense(exp, reason, actor) {
    var rec = A.clone(D.one('expenses', exp.id) || exp);
    rec.voided = { reason: reason, by: actor ? actor.name : '—', at: A.nowStamp() };
    await D.save('expenses', rec);
    await audit(actor, 'Xarajat bekor qilindi', rec.category, reason || '');
  }

  /* =============== ISH HAQI =============== */
  async function payrollRecalc(ym, actor) {
    var payments = Fin.monthItems('payments', ym);
    var invById = Fin.invoicesById();
    var groupsById = A.byId(D.all('groups'));
    var staffList = D.all('staff').filter(function (s) { return s.status === 'faol'; });
    for (var i = 0; i < staffList.length; i++) {
      var s = staffList[i];
      var cur = Fin.payrollItem(ym, s.id);
      if (cur && cur.status !== 'qoralama') continue;     // yopilgan davr qayta hisoblanmaydi
      var r = A.payrollFor(s, ym, payments, invById, groupsById, D.all('groups'));
      await D.save('payroll', {
        id: ym + '__' + s.id,
        staffId: s.id, month: ym, type: r.type, rate: r.rate || 0, base: r.base || 0,
        accrued: r.amount, lines: r.lines || [],
        paid: (cur && cur.paid) || 0, status: (cur && cur.status) || 'qoralama',
        updatedAt: A.nowStamp()
      });
    }
    await audit(actor, 'Ish haqi hisoblandi', A.monthLabel(ym), staffList.length + ' xodim');
  }
  async function payrollApprove(ym, staffId, actor) {
    var it = A.clone(Fin.payrollItem(ym, staffId));
    if (!it) return;
    it.status = 'tasdiqlangan';
    it.approvedBy = actor ? actor.name : '—';
    it.approvedAt = A.nowStamp();
    await D.save('payroll', it);
    await audit(actor, 'Ish haqi tasdiqlandi', (D.one('staff', staffId) || {}).name || staffId, A.monthLabel(ym));
  }
  async function payrollPay(ym, staffId, amount, method, actor) {
    var st = D.one('staff', staffId);
    var expId = 'sal_' + staffId + '_' + ym;
    if (!D.one('expenses', expId)) {
      await D.save('expenses', {
        id: expId, date: A.today(), month: A.thisMonth(),
        category: 'Ish haqi', amount: Math.round(amount), method: method || 'naqd',
        note: (st ? st.name : staffId) + ' — ' + A.monthLabel(ym) + ' ish haqi',
        payrollRef: ym + '/' + staffId,
        createdAt: A.nowStamp(), createdBy: actor ? actor.name : '—'
      });
      await audit(actor, 'Ish haqi to’landi', st ? st.name : staffId, A.somFull(amount));
    }
    var it = A.clone(Fin.payrollItem(ym, staffId));
    if (it) {
      it.paid = Math.round(amount);
      it.status = 'to’langan';
      it.paidAt = A.nowStamp();
      await D.save('payroll', it);
    }
  }

  global.A.Fin = Fin;
  global.A.Ops = {
    audit: audit,
    generateInvoices: generateInvoices,
    createSingleInvoice: createSingleInvoice,
    deleteInvoice: deleteInvoice,
    createPayment: createPayment,
    applyAdvance: applyAdvance,
    voidPayment: voidPayment,
    refundCap: refundCap,
    localReceiptNo: localReceiptNo,
    saveExpense: saveExpense,
    voidExpense: voidExpense,
    payrollRecalc: payrollRecalc,
    payrollApprove: payrollApprove,
    payrollPay: payrollPay
  };
})(typeof window !== 'undefined' ? window : globalThis);
