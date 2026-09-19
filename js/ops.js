/* Albyana ERP — amallar qatlami: hisob yaratish, to'lov, xarajat, ish haqi, tarix */
(function (global) {
  'use strict';
  var A = global.A;
  var D = A.Data;

  var Fin = {
    index: { invoices: [], payments: [], expenses: [], payroll: [], audit: [] },

    async loadIndex() {
      if (D.mode === 'cloud') {
        try {
          var s = await D.db.doc('meta/finindex').get();
          if (s.exists) {
            var v = s.data();
            ['invoices', 'payments', 'expenses', 'payroll', 'audit'].forEach(function (k) {
              Fin.index[k] = Array.isArray(v[k]) ? v[k] : [];
            });
          }
        } catch (e) { console.error('finindex', e); }
      } else {
        var raw = null;
        try { raw = global.localStorage.getItem('albyana_finindex'); } catch (e) { }
        if (raw) { try { Fin.index = JSON.parse(raw); } catch (e) { } }
      }
    },
    async addToIndex(kind, ym) {
      if (Fin.index[kind].indexOf(ym) >= 0) return;
      Fin.index[kind].push(ym);
      Fin.index[kind].sort();
      if (D.mode === 'cloud') {
        try { await D.db.doc('meta/finindex').set(A.clone(Fin.index)); } catch (e) { console.error(e); }
      } else {
        try { global.localStorage.setItem('albyana_finindex', JSON.stringify(Fin.index)); } catch (e) { }
      }
    },
    async loadAll() {
      var kinds = ['invoices', 'payments', 'expenses', 'payroll'];
      var jobs = [];
      var cur = A.thisMonth();
      kinds.forEach(function (k) {
        var months = (Fin.index[k] || []).slice();
        if (months.indexOf(cur) < 0) months.push(cur);
        months.forEach(function (m) { jobs.push(D.loadMonth(k, m)); });
      });
      await Promise.all(jobs);   // barchasi bir vaqtda — kirish tezroq
    },

    /* --- to'plangan ro'yxatlar --- */
    allInvoices: function () {
      var out = [];
      Object.keys(D.docs).forEach(function (p) {
        if (p.indexOf('invoices/') !== 0) return;
        var items = D.docs[p].items || {};
        Object.keys(items).forEach(function (k) { out.push(items[k]); });
      });
      return out;
    },
    allPayments: function () {
      var out = [];
      Object.keys(D.docs).forEach(function (p) {
        if (p.indexOf('payments/') !== 0) return;
        var items = D.docs[p].items || {};
        Object.keys(items).forEach(function (k) { out.push(items[k]); });
      });
      return out;
    },
    monthItems: function (kind, ym) {
      var doc = D.monthCached(kind, ym);
      if (!doc) return [];
      var items = doc.items || {};
      return Object.keys(items).map(function (k) { return items[k]; });
    },
    invoicesById: function () {
      var m = {};
      Fin.allInvoices().forEach(function (i) { m[i.id] = i; });
      return m;
    }
  };

  /* =============== TARIX (audit) =============== */
  async function audit(actor, action, entity, details) {
    var ym = A.thisMonth();
    await Fin.addToIndex('audit', ym);
    await D.mutateMonth('audit', ym, function (doc) {
      if (!Array.isArray(doc.list)) doc.list = [];
      doc.list.unshift({
        id: A.uid('log'),
        at: A.nowStamp(),
        by: actor ? actor.name : '—',
        byLogin: actor ? actor.login : '',
        role: actor ? actor.role : '',
        action: action,
        entity: entity || '',
        details: details || ''
      });
      if (doc.list.length > 400) doc.list = doc.list.slice(0, 400);
    });
  }

  /* =============== OYLIK HISOBLAR =============== */
  /**
   * Shu oy uchun faol a'zoliklarga hisob yaratadi.
   * Bitta a'zolik + bitta oy uchun hisob ID si qat'iy: takroriy ishga tushirish yangi hisob yaratmaydi.
   */
  async function generateInvoices(ym, actor) {
    var groups = A.byId(D.all('groups'));
    var students = A.byId(D.all('students'));
    var dueDay = (D.settings && D.settings.dueDay) || 5;
    var created = 0, skipped = 0;
    await Fin.addToIndex('invoices', ym);
    await D.mutateMonth('invoices', ym, function (doc) {
      D.all('memberships').forEach(function (m) {
        if (m.status !== 'faol') return;
        if (!A.membershipActiveIn(m, ym)) return;
        var g = groups[m.groupId];
        var st = students[m.studentId];
        if (!g || !st) return;
        if (st.status === 'arxiv') return;
        if (g.status === 'rejalashtirilgan') return;
        if (g.startDate && g.startDate > A.monthEnd(ym)) return;
        var id = A.invoiceId(m.id, ym);
        if (doc.items[id]) { skipped++; return; }
        var amt = A.invoiceAmountFor(g, m, ym);
        doc.items[id] = {
          id: id, membershipId: m.id, studentId: m.studentId, groupId: m.groupId,
          month: ym, base: amt.base, discount: amt.discount, final: amt.final,
          dueDate: A.dueDateFor(ym, dueDay),
          createdAt: A.nowStamp(), createdBy: actor ? actor.name : 'tizim',
          note: (m.firstMonth && m.firstMonth.month === ym && m.firstMonth.note) || ''
        };
        created++;
      });
    });
    if (created) await audit(actor, 'Oylik hisoblar yaratildi', A.monthLabel(ym), created + ' ta yangi hisob');
    return { created: created, skipped: skipped };
  }

  /** Bitta a'zolik uchun hisob (o'rtada qo'shilgan o'quvchi) */
  async function createSingleInvoice(membership, ym, opts, actor) {
    var g = D.one('groups', membership.groupId);
    var dueDay = (D.settings && D.settings.dueDay) || 5;
    var id = A.invoiceId(membership.id, ym);
    var res = null;
    await Fin.addToIndex('invoices', ym);
    await D.mutateMonth('invoices', ym, function (doc) {
      if (doc.items[id]) { res = doc.items[id]; return; }
      var amt = A.invoiceAmountFor(g, membership, ym);
      var finalAmt = opts && opts.amount != null ? Math.max(0, Math.round(opts.amount)) : amt.final;
      doc.items[id] = {
        id: id, membershipId: membership.id, studentId: membership.studentId,
        groupId: membership.groupId, month: ym,
        base: amt.base, discount: Math.max(0, amt.base - finalAmt), final: finalAmt,
        dueDate: A.dueDateFor(ym, dueDay), createdAt: A.nowStamp(),
        createdBy: actor ? actor.name : 'tizim', note: (opts && opts.note) || ''
      };
      res = doc.items[id];
    });
    return res;
  }

  /** Hisobni o'chirish (faqat to'lanmagan bo'lsa) */
  async function deleteInvoice(inv, actor, reason) {
    var paid = A.paidByInvoice(Fin.allPayments())[inv.id] || 0;
    if (paid > 0) throw new Error('Bu hisobga to’lov qilingan, o’chirib bo’lmaydi.');
    await D.mutateMonth('invoices', inv.month, function (doc) { delete doc.items[inv.id]; });
    await audit(actor, 'Hisob o’chirildi', inv.id, reason || '');
  }

  /* =============== TO'LOVLAR =============== */
  function nextReceiptNo(ym) {
    var items = Fin.monthItems('payments', ym).filter(function (p) { return p.type !== 'refund'; });
    var n = items.length + 1;
    return 'ALB-' + ym.replace('-', '') + '-' + String(n).padStart(4, '0');
  }

  /**
   * To'lov qabul qilish. id oldindan beriladi (takroriy bosishda bir xil id —
   * shuning uchun ikkinchi marta yozilmaydi).
   */
  async function createPayment(input, actor) {
    var ym = A.ymOf(input.date);
    var id = input.id || A.uid('pay');
    var existing = null;
    await D.loadMonth('payments', ym);
    var doc = D.monthCached('payments', ym);
    if (doc && doc.items[id]) return doc.items[id]; // takroriy so'rov — yangi to'lov yaratilmaydi

    var rec = {
      id: id,
      type: input.type || 'payment',
      studentId: input.studentId,
      amount: Math.round(Number(input.amount) || 0),
      date: input.date,
      method: input.method || 'naqd',
      note: input.note || '',
      allocations: (input.allocations || []).map(function (a) {
        return { invoiceId: a.invoiceId, amount: Math.round(a.amount) };
      }),
      receiptNo: input.receiptNo || nextReceiptNo(ym),
      createdAt: A.nowStamp(),
      createdBy: actor ? actor.name : '—',
      refOf: input.refOf || null
    };
    await Fin.addToIndex('payments', ym);
    await D.mutateMonth('payments', ym, function (d) {
      if (d.items[id]) { existing = d.items[id]; return; }
      d.items[id] = rec;
    });
    await audit(actor,
      rec.type === 'refund' ? 'Pul qaytarildi' : 'To’lov qabul qilindi',
      rec.receiptNo,
      A.somFull(rec.amount));
    return existing || rec;
  }

  async function voidPayment(pay, reason, actor) {
    await D.mutateMonth('payments', A.ymOf(pay.date), function (d) {
      var p = d.items[pay.id];
      if (!p) return;
      p.voided = { reason: reason, by: actor ? actor.name : '—', at: A.nowStamp() };
    });
    await audit(actor, 'To’lov bekor qilindi', pay.receiptNo, reason || '');
  }

  /* =============== XARAJATLAR =============== */
  async function saveExpense(exp, actor) {
    var ym = A.ymOf(exp.date);
    var isNew = !exp.id;
    if (!exp.id) exp.id = A.uid('exp');
    exp.createdAt = exp.createdAt || A.nowStamp();
    exp.createdBy = exp.createdBy || (actor ? actor.name : '—');
    await Fin.addToIndex('expenses', ym);
    await D.mutateMonth('expenses', ym, function (d) {
      if (!isNew && d.items[exp.id]) {
        exp.history = (d.items[exp.id].history || []).concat([{
          at: A.nowStamp(), by: actor ? actor.name : '—',
          eski: d.items[exp.id].amount, yangi: exp.amount
        }]);
      }
      d.items[exp.id] = exp;
    });
    await audit(actor, isNew ? 'Xarajat qo’shildi' : 'Xarajat tuzatildi',
      exp.category, A.somFull(exp.amount));
    return exp;
  }
  async function voidExpense(exp, reason, actor) {
    await D.mutateMonth('expenses', A.ymOf(exp.date), function (d) {
      var e = d.items[exp.id];
      if (e) e.voided = { reason: reason, by: actor ? actor.name : '—', at: A.nowStamp() };
    });
    await audit(actor, 'Xarajat bekor qilindi', exp.category, reason || '');
  }

  /* =============== ISH HAQI =============== */
  async function payrollRecalc(ym, actor) {
    await D.loadMonth('payments', ym);
    var payments = Fin.monthItems('payments', ym);
    var invById = Fin.invoicesById();
    var groupsById = A.byId(D.all('groups'));
    var staffList = D.all('staff').filter(function (s) { return s.status === 'faol'; });
    await Fin.addToIndex('payroll', ym);
    await D.mutateMonth('payroll', ym, function (doc) {
      staffList.forEach(function (s) {
        var cur = doc.items[s.id];
        if (cur && cur.status !== 'qoralama') return; // yopilgan davr qayta hisoblanmaydi
        var r = A.payrollFor(s, ym, payments, invById, groupsById);
        doc.items[s.id] = {
          staffId: s.id, month: ym, type: r.type, rate: r.rate || 0, base: r.base || 0,
          accrued: r.amount, lines: r.lines || [],
          paid: (cur && cur.paid) || 0, status: (cur && cur.status) || 'qoralama',
          updatedAt: A.nowStamp()
        };
      });
    });
    await audit(actor, 'Ish haqi hisoblandi', A.monthLabel(ym), staffList.length + ' xodim');
  }
  async function payrollApprove(ym, staffId, actor) {
    await D.mutateMonth('payroll', ym, function (doc) {
      var it = doc.items[staffId];
      if (it) { it.status = 'tasdiqlangan'; it.approvedBy = actor ? actor.name : '—'; it.approvedAt = A.nowStamp(); }
    });
    await audit(actor, 'Ish haqi tasdiqlandi', (D.one('staff', staffId) || {}).name || staffId, A.monthLabel(ym));
  }
  /** Ish haqi to'lovi — moliyaviy hisobotda bir marta xarajat bo'lib aks etadi */
  async function payrollPay(ym, staffId, amount, method, actor) {
    var st = D.one('staff', staffId);
    var exp = {
      id: 'sal_' + staffId + '_' + ym,
      date: A.today(), category: 'Ish haqi', amount: Math.round(amount),
      method: method || 'naqd',
      note: (st ? st.name : staffId) + ' — ' + A.monthLabel(ym) + ' ish haqi',
      payrollRef: ym + '/' + staffId,
      createdAt: A.nowStamp(), createdBy: actor ? actor.name : '—'
    };
    var eym = A.ymOf(exp.date);
    await Fin.addToIndex('expenses', eym);
    var already = false;
    await D.mutateMonth('expenses', eym, function (d) {
      if (d.items[exp.id]) { already = true; return; }
      d.items[exp.id] = exp;
    });
    await D.mutateMonth('payroll', ym, function (doc) {
      var it = doc.items[staffId];
      if (it) { it.paid = Math.round(amount); it.status = 'to’langan'; it.paidAt = A.nowStamp(); }
    });
    if (!already) await audit(actor, 'Ish haqi to’landi', st ? st.name : staffId, A.somFull(amount));
    return exp;
  }

  global.A.Fin = Fin;
  global.A.Ops = {
    audit: audit,
    generateInvoices: generateInvoices,
    createSingleInvoice: createSingleInvoice,
    deleteInvoice: deleteInvoice,
    createPayment: createPayment,
    voidPayment: voidPayment,
    nextReceiptNo: nextReceiptNo,
    saveExpense: saveExpense,
    voidExpense: voidExpense,
    payrollRecalc: payrollRecalc,
    payrollApprove: payrollApprove,
    payrollPay: payrollPay
  };
})(typeof window !== 'undefined' ? window : globalThis);
