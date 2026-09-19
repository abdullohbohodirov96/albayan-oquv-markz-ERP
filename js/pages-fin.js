/* Albyana ERP — Moliya, Xodimlar, Hisobotlar, Sozlamalar */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  var Q = A.Q;
  A.Pages = A.Pages || {};

  var METHODS = [
    { value: 'naqd', label: 'Naqd' },
    { value: 'karta', label: 'Karta' },
    { value: 'bank', label: 'Bank o’tkazmasi' }
  ];
  function methodLabel(m) {
    var x = METHODS.filter(function (o) { return o.value === m; })[0];
    return x ? x.label : m;
  }

  /* ================= TO'LOV QABUL QILISH ================= */
  A.paymentForm = function (studentId, App) {
    App.guard('payment.create');
    var payId = A.uid('pay'); // takroriy bosishda bir xil id — ikkinchi yozuv yaratilmaydi
    var students = A.sortBy(D.all('students').filter(function (s) { return s.status !== 'arxiv'; }),
      function (s) { return s.lastName + ' ' + s.firstName; });

    var search = UI.field({ label: 'O’quvchini qidirish', placeholder: 'Ism yoki telefon' });
    var pick = UI.field({ label: 'O’quvchi', type: 'select', required: true, options: [] });
    function fillOptions() {
      var q = search.input.value.trim().toLowerCase();
      var list = students.filter(function (s) {
        if (!q) return true;
        return (s.lastName + ' ' + s.firstName + ' ' + s.phone + ' ' + (s.parentPhone || '')).toLowerCase().indexOf(q) >= 0;
      }).slice(0, 200);
      UI.clear(pick.input);
      if (!list.length) pick.input.appendChild(h('option', { value: '' }, 'Topilmadi'));
      list.forEach(function (s) {
        pick.input.appendChild(h('option', { value: s.id }, s.lastName + ' ' + s.firstName + ' · ' + (s.phone || s.parentPhone || '')));
      });
      if (studentId && list.some(function (s) { return s.id === studentId; })) pick.input.value = studentId;
    }
    fillOptions();
    search.input.addEventListener('input', function () { fillOptions(); refresh(); });

    var fAmount = UI.field({ label: 'Summa (so’m)', type: 'number', required: true, value: '' });
    var fDate = UI.field({ label: 'Sana', type: 'date', required: true, value: A.today() });
    var fMethod = UI.field({ label: 'To’lov usuli', type: 'select', options: METHODS });
    var fNote = UI.field({ label: 'Izoh', full: true });

    var allocBox = h('div', { class: 'field full' });
    var allocInputs = {};

    function openInvoices() {
      var sid = pick.input.value;
      if (!sid) return [];
      return Q.openInvoices(sid);
    }
    function refresh() {
      UI.clear(allocBox);
      allocInputs = {};
      var sid = pick.input.value;
      if (!sid) return;
      var bal = Q.balance(sid);
      var open = openInvoices();
      var amount = A.parseSom(fAmount.input.value);
      var auto = A.allocate(amount, open);
      var autoMap = {};
      auto.allocations.forEach(function (a) { autoMap[a.invoiceId] = a.amount; });

      var head = h('div', { class: 'rowflex', style: 'margin-bottom:8px' }, [
        UI.pill('Qarz: ' + A.som(bal.debt) + ' so’m', bal.debt > 0 ? 'warn' : 'ok'),
        bal.advance > 0 ? UI.pill('Avans: ' + A.som(bal.advance) + ' so’m', 'info') : null
      ]);
      allocBox.appendChild(head);

      if (!open.length) {
        allocBox.appendChild(h('div', { class: 'banner info', style: 'margin:0' },
          h('div', {}, 'Ochiq hisob yo’q. Bu pul avans sifatida saqlanadi va keyingi oy hisobiga o’tkaziladi.')));
        return;
      }
      var rows = h('div', { class: 'list', style: 'border:1px solid var(--line);border-radius:10px' });
      open.forEach(function (inv) {
        var f = UI.field({ type: 'number', value: autoMap[inv.id] || 0 });
        f.input.style.maxWidth = '150px';
        f.input.addEventListener('input', updateSummary);
        allocInputs[inv.id] = { input: f.input, inv: inv };
        rows.appendChild(h('div', { class: 'att-row' }, [
          h('div', { class: 'nm' }, [
            h('div', {}, A.monthLabel(inv.month) + ' · ' + Q.groupName(inv.groupId)),
            h('div', { class: 'small muted' }, 'Qoldiq: ' + A.som(inv.remaining) + ' so’m · muddat ' + A.dateLabel(inv.dueDate) +
              (inv.dueDate < A.today() ? ' (o’tgan)' : ''))
          ]),
          f.wrap
        ]));
      });
      allocBox.appendChild(h('div', {}, [
        h('div', { class: 'rowflex', style: 'justify-content:space-between;margin-bottom:6px' }, [
          h('b', {}, 'Qaysi hisoblarga yozilsin'),
          h('button', {
            class: 'btn sm', type: 'button', onclick: function () {
              var a2 = A.allocate(A.parseSom(fAmount.input.value), openInvoices());
              var map = {};
              a2.allocations.forEach(function (x) { map[x.invoiceId] = x.amount; });
              Object.keys(allocInputs).forEach(function (id) { allocInputs[id].input.value = map[id] || 0; });
              updateSummary();
            }
          }, 'Avtomatik taqsimlash')
        ]),
        rows
      ]));
      var summary = h('div', { class: 'rowflex', style: 'margin-top:8px' });
      allocBox.appendChild(summary);

      function updateSummary() {
        UI.clear(summary);
        var amt = A.parseSom(fAmount.input.value);
        var sum = 0;
        Object.keys(allocInputs).forEach(function (id) { sum += A.parseSom(allocInputs[id].input.value); });
        var rest = amt - sum;
        summary.appendChild(UI.pill('Taqsimlandi: ' + A.som(sum) + ' so’m', 'ok'));
        if (rest > 0) summary.appendChild(UI.pill('Avansga: ' + A.som(rest) + ' so’m', 'info'));
        if (rest < 0) summary.appendChild(UI.pill('Summadan ' + A.som(-rest) + ' so’m ortiq taqsimlandi', 'bad'));
      }
      updateSummary();
    }
    pick.input.addEventListener('change', refresh);
    fAmount.input.addEventListener('input', refresh);
    if (studentId) pick.input.value = studentId;
    refresh();

    var warn = h('div');
    UI.modal({
      title: 'To’lov qabul qilish',
      wide: true,
      body: [h('div', { class: 'form-grid' }, [search.wrap, pick.wrap, fAmount.wrap, fDate.wrap, fMethod.wrap, fNote.wrap]), allocBox, warn],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Qabul qilish', cls: 'primary', onClick: function (c, btn) {
            UI.clear(warn);
            var sid = pick.input.value;
            var amount = A.parseSom(fAmount.input.value);
            if (!sid) { warn.appendChild(msg('O’quvchini tanlang.')); return; }
            if (amount <= 0) { warn.appendChild(msg('Summani kiriting.')); return; }
            if (!fDate.input.value) { warn.appendChild(msg('Sanani kiriting.')); return; }
            var allocations = [];
            var sum = 0;
            Object.keys(allocInputs).forEach(function (id) {
              var v = A.parseSom(allocInputs[id].input.value);
              if (v > 0) {
                if (v > allocInputs[id].inv.remaining) v = allocInputs[id].inv.remaining;
                allocations.push({ invoiceId: id, amount: v });
                sum += v;
              }
            });
            if (sum > amount) { warn.appendChild(msg('Taqsimlangan summa to’lovdan ko’p. Tuzating.')); return; }
            UI.busy(btn, async function () {
              var rec = await A.Ops.createPayment({
                id: payId, studentId: sid, amount: amount, date: fDate.input.value,
                method: fMethod.input.value, note: fNote.input.value, allocations: allocations
              }, App.user);
              c();
              UI.toast('To’lov qabul qilindi.', 'ok');
              A.receiptModal(rec, App);
              App.render();
            });
          }
        }
      ]
    });
    function msg(t) { return h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, t)); }
  };

  /* ================= CHEK ================= */
  A.receiptModal = function (pay, App) {
    var s = D.one('students', pay.studentId);
    var set = D.settings || {};
    var lines = [];
    lines.push((set.centerName || 'Albyana') + ' o’quv markazi');
    if (set.address) lines.push(set.address);
    if (set.phone) lines.push('Tel: ' + set.phone);
    lines.push('--------------------------------');
    lines.push('Chek raqami: ' + pay.receiptNo);
    lines.push('Sana: ' + A.dateLabel(pay.date));
    lines.push('O’quvchi: ' + (s ? s.lastName + ' ' + s.firstName : '—'));
    lines.push('Turi: ' + (pay.type === 'refund' ? 'Pul qaytarish' : 'To’lov'));
    lines.push('Usul: ' + methodLabel(pay.method));
    lines.push('--------------------------------');
    (pay.allocations || []).forEach(function (a) {
      var inv = A.Fin.invoicesById()[a.invoiceId];
      lines.push((inv ? A.monthLabel(inv.month) + ' · ' + Q.groupName(inv.groupId) : a.invoiceId));
      lines.push('   ' + A.som(a.amount) + ' so’m');
    });
    var allocSum = (pay.allocations || []).reduce(function (t, a) { return t + a.amount; }, 0);
    if (pay.amount - allocSum > 0) lines.push('Avansga: ' + A.som(pay.amount - allocSum) + ' so’m');
    lines.push('--------------------------------');
    lines.push('JAMI: ' + A.som(pay.amount) + ' so’m');
    if (pay.note) lines.push('Izoh: ' + pay.note);
    lines.push('Qabul qildi: ' + (pay.createdBy || '—'));
    lines.push('');
    lines.push('Bu markazning ichki to’lov tasdig’i.');
    lines.push('Fiskal chek emas.');

    var bal = s ? Q.balance(s.id) : null;
    UI.modal({
      title: 'To’lov cheki',
      body: [
        h('div', { class: 'receipt' }, lines.join('\n')),
        bal ? h('div', { class: 'rowflex' }, [
          bal.debt > 0 ? UI.pill('Qolgan qarz: ' + A.som(bal.debt) + ' so’m', 'warn') : UI.pill('Qarz yo’q', 'ok'),
          bal.advance > 0 ? UI.pill('Avans: ' + A.som(bal.advance) + ' so’m', 'info') : null
        ]) : null
      ],
      actions: [
        { label: 'Chop etish', onClick: function () { try { window.print(); } catch (e) { UI.toast('Chop etish mavjud emas.', 'bad'); } } },
        { label: 'Yopish', cls: 'primary' }
      ]
    });
  };

  /* ================= MOLIYA ================= */
  A.Pages.finance = function (view, route, App) {
    App.guard('nav.finance');
    var tab = route.tab || (App.can('finance.payments') ? 'payments' : 'debts');
    var ym = route.ym || A.thisMonth();

    var tabItems = [];
    if (App.can('finance.payments')) tabItems.push({ id: 'payments', label: 'To’lovlar' });
    if (App.can('finance.debts')) tabItems.push({ id: 'debts', label: 'Qarzdorlik' });
    if (App.can('invoice.create')) tabItems.push({ id: 'invoices', label: 'Hisoblangan to’lovlar' });
    if (App.can('finance.expenses')) tabItems.push({ id: 'expenses', label: 'Xarajatlar' });
    if (App.can('finance.payroll')) tabItems.push({ id: 'payroll', label: 'Ish haqi' });
    if (!tabItems.some(function (t) { return t.id === tab; })) tab = tabItems[0].id;

    view.appendChild(UI.pageHead('Moliya', A.monthLabel(ym), [
      App.can('payment.create') ? h('button', { class: 'btn primary', onclick: function () { A.paymentForm(null, App); } },
        [UI.icon('money'), 'To’lov qabul qilish']) : null
    ]));
    view.appendChild(UI.tabs(tabItems, tab, function (id) { App.go('finance', { tab: id, ym: ym }); }));

    var monthNav = h('div', { class: 'filters' }, [
      h('div', { class: 'rowflex', style: 'gap:8px;flex-wrap:nowrap;width:100%;justify-content:space-between' }, [
        h('button', { class: 'btn sm', 'aria-label': 'Oldingi oy', onclick: function () { goMonth(A.addMonths(ym, -1)); } }, '‹'),
        h('b', { style: 'align-self:center;text-align:center;flex:1' }, A.monthLabel(ym)),
        h('button', { class: 'btn sm', 'aria-label': 'Keyingi oy', onclick: function () { goMonth(A.addMonths(ym, 1)); } }, '›'),
        ym !== A.thisMonth() ? h('button', { class: 'btn sm', onclick: function () { goMonth(A.thisMonth()); } }, 'Joriy oy') : null
      ])
    ]);
    function goMonth(next) {
      if (!D.monthCached('payments', next)) {
        (async function () {
          await D.loadMonth('payments', next); await D.loadMonth('invoices', next);
          await D.loadMonth('expenses', next); await D.loadMonth('payroll', next);
          App.go('finance', { tab: tab, ym: next });
        })();
        return;
      }
      App.go('finance', { tab: tab, ym: next });
    }
    if (tab !== 'debts') view.appendChild(monthNav);

    if (tab === 'payments') renderPayments(view, ym, App);
    if (tab === 'debts') renderDebts(view, App);
    if (tab === 'invoices') renderInvoices(view, ym, App);
    if (tab === 'expenses') renderExpenses(view, ym, App);
    if (tab === 'payroll') renderPayroll(view, ym, App);
  };

  function renderPayments(view, ym, App) {
    var pays = A.sortBy(A.Fin.monthItems('payments', ym), 'date', 'desc');
    var active = A.activePayments(pays);
    var income = active.filter(function (p) { return p.type !== 'refund'; }).reduce(function (s, p) { return s + p.amount; }, 0);
    var refunds = active.filter(function (p) { return p.type === 'refund'; }).reduce(function (s, p) { return s + p.amount; }, 0);
    var byMethod = {};
    active.forEach(function (p) {
      if (p.type === 'refund') return;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    });

    var tiles = h('div', { class: 'tiles' }, [
      UI.tile({ label: 'Qabul qilingan', value: A.som(income), hint: 'so’m', cls: 'money' }),
      UI.tile({ label: 'Qaytarilgan', value: A.som(refunds), hint: 'so’m', cls: refunds > 0 ? 'alert' : '' }),
      UI.tile({ label: 'Naqd', value: A.som(byMethod.naqd || 0), hint: 'so’m' }),
      UI.tile({ label: 'Karta + bank', value: A.som((byMethod.karta || 0) + (byMethod.bank || 0)), hint: 'so’m' })
    ]);
    view.appendChild(tiles);

    view.appendChild(UI.card(null, pays.length ? UI.table([
      { label: 'Sana', render: function (p) { return A.dateLabel(p.date); } },
      { label: 'Chek', render: function (p) { return h('span', { class: 'mono small' }, p.receiptNo); } },
      { label: 'O’quvchi', render: function (p) { return h('b', {}, Q.studentName(p.studentId)); } },
      { label: 'Usul', render: function (p) { return methodLabel(p.method); } },
      {
        label: 'Summa', right: true, render: function (p) {
          return h('span', {
            class: 'mono strong',
            style: p.voided ? 'text-decoration:line-through;opacity:.6' : (p.type === 'refund' ? 'color:var(--bad)' : '')
          }, (p.type === 'refund' ? '−' : '') + A.som(p.amount));
        }
      },
      {
        label: 'Holat', render: function (p) {
          if (p.voided) return UI.pill('Bekor qilingan', 'mute');
          return p.type === 'refund' ? UI.pill('Qaytarish', 'bad') : UI.pill('Amalda', 'ok');
        }
      },
      {
        label: '', right: true, render: function (p) {
          return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
            h('button', { class: 'btn sm', onclick: function (e) { e.stopPropagation(); A.receiptModal(p, App); } }, 'Chek'),
            (!p.voided && p.type !== 'refund' && App.can('payment.void')) ? h('button', {
              class: 'btn sm danger', onclick: function (e) { e.stopPropagation(); voidOrRefund(p, App); }
            }, 'Tuzatish') : null
          ]);
        }
      }
    ], pays, { onRow: function (p) { App.go('student', { id: p.studentId, tab: 'tolovlar' }); } })
      : UI.empty({
        title: 'Bu oyda to’lov yo’q',
        text: 'To’lov qabul qilganingizda shu yerda ko’rinadi.',
        action: App.can('payment.create') ? { label: 'To’lov qabul qilish', onClick: function () { A.paymentForm(null, App); } } : null
      }), [
      h('button', {
        class: 'btn sm', onclick: function () {
          UI.exportCsv('tolovlar-' + ym + '.csv', [['Sana', 'Chek', 'O’quvchi', 'Usul', 'Summa', 'Turi', 'Holat', 'Qabul qildi', 'Izoh']].concat(
            pays.map(function (p) {
              return [p.date, p.receiptNo, Q.studentName(p.studentId), methodLabel(p.method), p.amount,
              p.type === 'refund' ? 'Qaytarish' : 'To’lov', p.voided ? 'Bekor' : 'Amalda', p.createdBy || '', p.note || ''];
            })));
        }
      }, 'Excel')
    ], true));
  }

  function voidOrRefund(pay, App) {
    UI.modal({
      title: 'To’lovni tuzatish',
      body: [
        h('p', { style: 'margin:0' }, 'Moliyaviy yozuv yashirin o’chirilmaydi. Ikki xil amal bor:'),
        h('ul', { class: 'small muted', style: 'margin:0;padding-left:18px' }, [
          h('li', {}, 'Bekor qilish — yozuv xato kiritilgan bo’lsa. Yozuv ro’yxatda qoladi, lekin hisobga olinmaydi.'),
          h('li', {}, 'Pul qaytarish — mijozga pul qaytarilganda alohida yangi yozuv yaratiladi.')
        ])
      ],
      actions: [
        {
          label: 'Bekor qilish (xato yozuv)', cls: 'danger', onClick: async function (c) {
            var reason = await UI.askReason('To’lovni bekor qilish', 'Sababi');
            if (!reason) return;
            await A.Ops.voidPayment(pay, reason, App.user);
            c(); UI.toast('To’lov bekor qilindi.', 'ok'); App.render();
          }
        },
        {
          label: 'Pul qaytarish', onClick: function (c) { c(); refundForm(pay, App); }
        },
        { label: 'Yopish' }
      ]
    });
  }

  function refundForm(pay, App) {
    var refId = A.uid('ref');
    var f = UI.form([
      { name: 'amount', label: 'Qaytariladigan summa (so’m)', type: 'number', required: true, value: pay.amount },
      { name: 'date', label: 'Sana', type: 'date', required: true, value: A.today() },
      { name: 'method', label: 'Usul', type: 'select', options: METHODS, value: pay.method },
      { name: 'note', label: 'Sababi', required: true, full: true }
    ]);
    UI.modal({
      title: 'Pul qaytarish',
      body: f.node,
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Qaytarish', cls: 'danger', onClick: function (c, btn) {
            if (!f.validate()) return;
            var v = f.values();
            if (v.amount <= 0 || v.amount > pay.amount) { UI.toast('Summa noto’g’ri.', 'bad'); return; }
            UI.busy(btn, async function () {
              // qaytarish asl to'lovning taqsimotidan proporsional ayiriladi
              var allocs = [];
              var left = v.amount;
              (pay.allocations || []).forEach(function (a) {
                if (left <= 0) return;
                var take = Math.min(a.amount, left);
                allocs.push({ invoiceId: a.invoiceId, amount: take });
                left -= take;
              });
              var rec = await A.Ops.createPayment({
                id: refId, type: 'refund', studentId: pay.studentId, amount: v.amount,
                date: v.date, method: v.method, note: v.note, allocations: allocs, refOf: pay.id
              }, App.user);
              c(); UI.toast('Pul qaytarildi.', 'ok');
              A.receiptModal(rec, App);
              App.render();
            });
          }
        }
      ]
    });
  }

  function renderDebts(view, App) {
    var debtors = A.sortBy(Q.debtors(), 'overdue', 'desc');
    var total = debtors.reduce(function (s, d) { return s + d.debt; }, 0);
    var overdue = debtors.reduce(function (s, d) { return s + d.overdue; }, 0);
    view.appendChild(h('div', { class: 'tiles' }, [
      UI.tile({ label: 'Jami qarzdorlik', value: A.som(total), hint: 'so’m' }),
      UI.tile({ label: 'Muddati o’tgan', value: A.som(overdue), hint: 'so’m', cls: overdue > 0 ? 'alert' : '' }),
      UI.tile({ label: 'Qarzdor o’quvchilar', value: debtors.length })
    ]));
    view.appendChild(UI.card(null, debtors.length ? UI.table([
      { label: 'O’quvchi', render: function (d) { return h('b', {}, Q.studentName(d.studentId)); } },
      {
        label: 'Telefon', render: function (d) {
          var s = D.one('students', d.studentId);
          return h('span', { class: 'mono small' }, (s && (s.parentPhone || s.phone)) || '—');
        }
      },
      {
        label: 'Guruhlar', render: function (d) {
          return Q.membershipsOf(d.studentId).filter(function (m) { return m.status === 'faol'; })
            .map(function (m) { return Q.groupName(m.groupId); }).join(', ') || '—';
        }
      },
      { label: 'Oylar', render: function (d) { return d.months.map(function (m) { return A.monthLabel(m).split(' ')[0]; }).join(', '); } },
      { label: 'Qarz', right: true, render: function (d) { return h('span', { class: 'mono strong' }, A.som(d.debt)); } },
      {
        label: 'Muddati o’tgan', right: true, render: function (d) {
          return d.overdue > 0 ? UI.pill(A.som(d.overdue), 'bad') : h('span', { class: 'muted' }, '—');
        }
      },
      {
        label: '', right: true, render: function (d) {
          return App.can('payment.create') ? h('button', {
            class: 'btn sm primary', onclick: function (e) { e.stopPropagation(); A.paymentForm(d.studentId, App); }
          }, 'To’lov') : '';
        }
      }
    ], debtors, { onRow: function (d) { App.go('student', { id: d.studentId, tab: 'hisoblar' }); } })
      : UI.empty({ title: 'Qarzdorlik yo’q', text: 'Barcha hisoblar to’langan.' }), [
      h('button', {
        class: 'btn sm', onclick: function () {
          UI.exportCsv('qarzdorlar.csv', [['O’quvchi', 'Telefon', 'Guruhlar', 'Qarz', 'Muddati o’tgan']].concat(
            debtors.map(function (d) {
              var s = D.one('students', d.studentId);
              return [Q.studentName(d.studentId), (s && (s.parentPhone || s.phone)) || '',
              Q.membershipsOf(d.studentId).filter(function (m) { return m.status === 'faol'; }).map(function (m) { return Q.groupName(m.groupId); }).join(', '),
              d.debt, d.overdue];
            })));
        }
      }, 'Excel')
    ], true));
  }

  function renderInvoices(view, ym, App) {
    var invs = A.sortBy(A.Fin.monthItems('invoices', ym), function (i) { return Q.studentName(i.studentId); });
    var paidMap = A.paidByInvoice(A.Fin.allPayments());
    var charged = invs.reduce(function (s, i) { return s + i.final; }, 0);
    var collected = invs.reduce(function (s, i) { return s + Math.min(i.final, paidMap[i.id] || 0); }, 0);
    var expected = D.all('memberships').filter(function (m) {
      return m.status === 'faol' && A.membershipActiveIn(m, ym);
    }).length;

    view.appendChild(h('div', { class: 'tiles' }, [
      UI.tile({ label: 'Hisoblangan', value: A.som(charged), hint: invs.length + ' ta hisob' }),
      UI.tile({ label: 'Yig’ilgan', value: A.som(collected), hint: 'so’m', cls: 'money' }),
      UI.tile({ label: 'Qolgan', value: A.som(charged - collected), hint: 'so’m', cls: charged - collected > 0 ? 'alert' : '' }),
      UI.tile({ label: 'Faol a’zoliklar', value: expected, hint: invs.length < expected ? (expected - invs.length) + ' ta hisobsiz' : 'hammasi hisoblangan' })
    ]));

    view.appendChild(h('div', { class: 'banner info' }, [
      h('div', {}, [h('b', {}, 'Oylik hisoblar. '),
      'Har bir faol a’zolik uchun oyiga bitta hisob yaratiladi. Tugmani qayta bossangiz ham takroriy hisob paydo bo’lmaydi.']),
      App.can('invoice.create') ? h('button', {
        class: 'btn sm primary', onclick: function (e) {
          var btn = e.currentTarget;
          UI.busy(btn, async function () {
            var r = await A.Ops.generateInvoices(ym, App.user);
            UI.toast(r.created ? (r.created + ' ta yangi hisob yaratildi.') : 'Yangi hisob yo’q — hammasi allaqachon yaratilgan.', 'ok');
            App.render();
          });
        }
      }, A.monthLabel(ym) + ' hisoblarini yaratish') : null
    ]));

    view.appendChild(UI.card(null, invs.length ? UI.table([
      { label: 'O’quvchi', render: function (i) { return h('b', {}, Q.studentName(i.studentId)); } },
      { label: 'Guruh', render: function (i) { return Q.groupName(i.groupId); } },
      { label: 'Asos', right: true, render: function (i) { return h('span', { class: 'mono' }, A.som(i.base)); } },
      { label: 'Chegirma', right: true, render: function (i) { return h('span', { class: 'mono' }, i.discount ? '−' + A.som(i.discount) : '—'); } },
      { label: 'Hisob', right: true, render: function (i) { return h('span', { class: 'mono strong' }, A.som(i.final)); } },
      { label: 'To’langan', right: true, render: function (i) { return h('span', { class: 'mono' }, A.som(Math.min(i.final, paidMap[i.id] || 0))); } },
      {
        label: 'Holat', render: function (i) {
          var rem = A.invoiceRemaining(i, paidMap);
          if (rem <= 0) return UI.pill('To’langan', 'ok');
          if (i.dueDate < A.today()) return UI.pill('Muddati o’tgan', 'bad');
          return UI.pill('Kutilmoqda', 'warn');
        }
      },
      {
        label: '', right: true, render: function (i) {
          var rem = A.invoiceRemaining(i, paidMap);
          return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
            App.can('payment.create') && rem > 0 ? h('button', {
              class: 'btn sm primary', onclick: function (e) { e.stopPropagation(); A.paymentForm(i.studentId, App); }
            }, 'To’lov') : null,
            App.can('payment.void') && (paidMap[i.id] || 0) === 0 ? h('button', {
              class: 'btn sm danger', onclick: async function (e) {
                e.stopPropagation();
                var reason = await UI.askReason('Hisobni o’chirish', 'Sababi');
                if (!reason) return;
                try {
                  await A.Ops.deleteInvoice(i, App.user, reason);
                  UI.toast('Hisob o’chirildi.', 'ok'); App.render();
                } catch (err) { UI.toast(err.message, 'bad'); }
              }
            }, 'O’chirish') : null
          ]);
        }
      }
    ], invs, { onRow: function (i) { App.go('student', { id: i.studentId, tab: 'hisoblar' }); } })
      : UI.empty({ title: 'Hisob yaratilmagan', text: 'Yuqoridagi tugma bilan shu oy hisoblarini yarating.' }), [
      h('button', {
        class: 'btn sm', onclick: function () {
          UI.exportCsv('hisoblar-' + ym + '.csv', [['O’quvchi', 'Guruh', 'Asos', 'Chegirma', 'Hisob', 'To’langan', 'Muddat']].concat(
            invs.map(function (i) {
              return [Q.studentName(i.studentId), Q.groupName(i.groupId), i.base, i.discount, i.final,
              Math.min(i.final, paidMap[i.id] || 0), i.dueDate];
            })));
        }
      }, 'Excel')
    ], true));
  }

  function renderExpenses(view, ym, App) {
    var items = A.sortBy(A.Fin.monthItems('expenses', ym), 'date', 'desc');
    var live = items.filter(function (e) { return !e.voided; });
    var total = live.reduce(function (s, e) { return s + e.amount; }, 0);
    var byCat = {};
    live.forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });

    view.appendChild(h('div', { class: 'tiles' }, [
      UI.tile({ label: 'Jami xarajat', value: A.som(total), hint: 'so’m' })
    ].concat(cats.slice(0, 3).map(function (c) {
      return UI.tile({ label: c, value: A.som(byCat[c]), hint: 'so’m' });
    }))));

    view.appendChild(h('div', { class: 'rowflex', style: 'margin-bottom:14px' }, [
      App.can('expense.edit') ? h('button', {
        class: 'btn primary', onclick: function () { expenseForm(null, App, ym); }
      }, [UI.icon('plus'), 'Xarajat qo’shish']) : null
    ]));

    view.appendChild(UI.card(null, items.length ? UI.table([
      { label: 'Sana', render: function (e) { return A.dateLabel(e.date); } },
      { label: 'Kategoriya', render: function (e) { return h('b', {}, e.category); } },
      { label: 'Izoh', render: function (e) { return h('span', { class: 'small muted' }, e.note || '—'); } },
      { label: 'Usul', render: function (e) { return methodLabel(e.method); } },
      {
        label: 'Summa', right: true, render: function (e) {
          return h('span', { class: 'mono strong', style: e.voided ? 'text-decoration:line-through;opacity:.6' : '' }, A.som(e.amount));
        }
      },
      { label: 'Kiritgan', render: function (e) { return h('span', { class: 'small muted' }, e.createdBy || '—'); } },
      {
        label: '', right: true, render: function (e) {
          if (!App.can('expense.edit') || e.voided) return '';
          return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
            e.payrollRef ? null : h('button', { class: 'btn sm', onclick: function () { expenseForm(e, App, ym); } }, 'Tahrirlash'),
            h('button', {
              class: 'btn sm danger', onclick: async function () {
                var reason = await UI.askReason('Xarajatni bekor qilish', 'Sababi');
                if (!reason) return;
                await A.Ops.voidExpense(e, reason, App.user);
                UI.toast('Bekor qilindi.', 'ok'); App.render();
              }
            }, 'Bekor')
          ]);
        }
      }
    ], items) : UI.empty({
      title: 'Xarajat yo’q', text: 'Ijara, kommunal, reklama kabi xarajatlarni shu yerga kiriting.',
      action: App.can('expense.edit') ? { label: 'Xarajat qo’shish', onClick: function () { expenseForm(null, App, ym); } } : null
    }), [
      h('button', {
        class: 'btn sm', onclick: function () {
          UI.exportCsv('xarajatlar-' + ym + '.csv', [['Sana', 'Kategoriya', 'Summa', 'Usul', 'Izoh', 'Kiritgan', 'Holat']].concat(
            items.map(function (e) { return [e.date, e.category, e.amount, methodLabel(e.method), e.note || '', e.createdBy || '', e.voided ? 'Bekor' : 'Amalda']; })));
        }
      }, 'Excel')
    ], true));
  }

  function expenseForm(exp, App, ym) {
    App.guard('expense.edit');
    var isNew = !exp;
    var cats = (D.settings && D.settings.expenseCategories) || A.Seed.DEFAULT_SETTINGS.expenseCategories;
    var e = exp || { date: ym === A.thisMonth() ? A.today() : A.monthStart(ym), category: cats[0], method: 'naqd' };
    var f = UI.form([
      { name: 'date', label: 'Sana', type: 'date', required: true, value: e.date },
      { name: 'category', label: 'Kategoriya', type: 'select', required: true, value: e.category, options: cats.map(function (c) { return { value: c, label: c }; }) },
      { name: 'amount', label: 'Summa (so’m)', type: 'number', required: true, value: e.amount },
      { name: 'method', label: 'To’lov usuli', type: 'select', value: e.method, options: METHODS },
      { name: 'note', label: 'Izoh', type: 'textarea', value: e.note, full: true }
    ]);
    UI.modal({
      title: isNew ? 'Yangi xarajat' : 'Xarajatni tahrirlash',
      body: f.node,
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            var v = f.values();
            if (v.amount <= 0) { UI.toast('Summani kiriting.', 'bad'); return; }
            UI.busy(btn, async function () {
              await A.Ops.saveExpense(Object.assign({}, e, v), App.user);
              c(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  function renderPayroll(view, ym, App) {
    App.guard('finance.payroll');
    var doc = D.monthCached('payroll', ym) || { items: {} };
    var items = Object.keys(doc.items || {}).map(function (k) { return doc.items[k]; });
    var staffList = D.all('staff').filter(function (s) { return s.status === 'faol'; });
    var accrued = items.reduce(function (s, i) { return s + (i.accrued || 0); }, 0);
    var paid = items.reduce(function (s, i) { return s + (i.paid || 0); }, 0);

    view.appendChild(h('div', { class: 'tiles' }, [
      UI.tile({ label: 'Hisoblangan ish haqi', value: A.som(accrued), hint: 'so’m' }),
      UI.tile({ label: 'To’langan', value: A.som(paid), hint: 'so’m', cls: 'money' }),
      UI.tile({ label: 'Qolgan', value: A.som(accrued - paid), hint: 'so’m' })
    ]));

    view.appendChild(h('div', { class: 'banner info' }, [
      h('div', {}, [h('b', {}, 'Qanday hisoblanadi. '),
      'Belgilangan oylik — to’g’ridan-to’g’ri summa. Foiz — o’qituvchining guruhlariga shu oyda haqiqatda tushgan puldan foiz. ',
        'Tasdiqlangan davr qayta hisoblanmaydi.']),
      h('button', {
        class: 'btn sm primary', onclick: function (e) {
          var btn = e.currentTarget;
          UI.busy(btn, async function () {
            await A.Ops.payrollRecalc(ym, App.user);
            UI.toast('Hisoblandi.', 'ok'); App.render();
          });
        }
      }, 'Hisoblash / yangilash')
    ]));

    var rows = staffList.map(function (s) {
      return { staff: s, item: doc.items[s.id] || null };
    });
    view.appendChild(UI.card(null, rows.length ? UI.table([
      { label: 'Xodim', render: function (r) { return h('div', {}, [h('b', {}, r.staff.name), h('div', { class: 'small muted' }, r.staff.position)]); } },
      {
        label: 'Turi', render: function (r) {
          return r.staff.payType === 'fixed' ? UI.pill('Belgilangan oylik', 'mute') : UI.pill(r.staff.percentRate + '% tushumdan', 'info');
        }
      },
      {
        label: 'Asos', right: true, render: function (r) {
          return h('span', { class: 'mono' }, r.item && r.item.type === 'percent' ? A.som(r.item.base) : '—');
        }
      },
      { label: 'Hisoblangan', right: true, render: function (r) { return h('span', { class: 'mono strong' }, r.item ? A.som(r.item.accrued) : '—'); } },
      { label: 'To’langan', right: true, render: function (r) { return h('span', { class: 'mono' }, r.item ? A.som(r.item.paid) : '—'); } },
      {
        label: 'Holat', render: function (r) {
          if (!r.item) return UI.pill('Hisoblanmagan', 'mute');
          if (r.item.status === 'to’langan') return UI.pill('To’langan', 'ok');
          if (r.item.status === 'tasdiqlangan') return UI.pill('Tasdiqlangan', 'info');
          return UI.pill('Qoralama', 'warn');
        }
      },
      {
        label: '', right: true, render: function (r) {
          if (!r.item) return '';
          return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
            h('button', { class: 'btn sm', onclick: function () { payrollDetail(r, ym, App); } }, 'Tafsilot'),
            (r.item.status === 'qoralama' && App.can('payroll.approve')) ? h('button', {
              class: 'btn sm primary', onclick: function (e) {
                UI.busy(e.currentTarget, async function () {
                  await A.Ops.payrollApprove(ym, r.staff.id, App.user);
                  UI.toast('Tasdiqlandi.', 'ok'); App.render();
                });
              }
            }, 'Tasdiqlash') : null,
            (r.item.status === 'tasdiqlangan') ? h('button', {
              class: 'btn sm primary', onclick: function () { payPayroll(r, ym, App); }
            }, 'To’lash') : null
          ]);
        }
      }
    ], rows) : UI.empty({ title: 'Xodim yo’q', text: 'Xodimlar bo’limida xodim qo’shing.' }), null, null, true));
  }

  function payrollDetail(r, ym, App) {
    var lines = (r.item && r.item.lines) || [];
    UI.modal({
      title: r.staff.name + ' · ' + A.monthLabel(ym),
      wide: true,
      body: [
        h('dl', { class: 'kv' }, [
          h('dt', {}, 'Hisoblash turi'), h('dd', {}, r.staff.payType === 'fixed' ? 'Belgilangan oylik' : r.staff.percentRate + '% tushumdan'),
          h('dt', {}, 'Asos (tushum)'), h('dd', {}, r.item.type === 'percent' ? A.somFull(r.item.base) : '—'),
          h('dt', {}, 'Hisoblangan'), h('dd', {}, A.somFull(r.item.accrued)),
          h('dt', {}, 'To’langan'), h('dd', {}, A.somFull(r.item.paid)),
          h('dt', {}, 'Holat'), h('dd', {}, r.item.status),
          r.item.approvedBy ? h('dt', {}, 'Tasdiqladi') : null,
          r.item.approvedBy ? h('dd', {}, r.item.approvedBy + ' · ' + (r.item.approvedAt || '')) : null
        ]),
        lines.length ? UI.table([
          { label: 'Sana', render: function (l) { return A.dateLabel(l.date); } },
          { label: 'O’quvchi', render: function (l) { return Q.studentName(l.studentId); } },
          { label: 'Guruh', render: function (l) { return Q.groupName(l.groupId); } },
          { label: 'Turi', render: function (l) { return l.kind; } },
          { label: 'Summa', right: true, render: function (l) { return h('span', { class: 'mono' }, A.som(l.amount)); } }
        ], lines) : h('p', { class: 'muted small' }, 'Foiz hisobi uchun to’lovlar ro’yxati bo’sh.')
      ],
      actions: [{ label: 'Yopish', cls: 'primary' }]
    });
  }

  function payPayroll(r, ym, App) {
    var f = UI.form([
      { name: 'amount', label: 'To’lanadigan summa (so’m)', type: 'number', required: true, value: r.item.accrued },
      { name: 'method', label: 'Usul', type: 'select', options: METHODS }
    ]);
    UI.modal({
      title: 'Ish haqini to’lash · ' + r.staff.name,
      body: [f.node, h('p', { class: 'small muted', style: 'margin:0' },
        'To’lov moliyaviy hisobotda "Ish haqi" xarajati sifatida bir marta aks etadi.')],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'To’lash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              await A.Ops.payrollPay(ym, r.staff.id, f.values().amount, f.values().method, App.user);
              c(); UI.toast('To’landi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  /* ================= XODIMLAR ================= */
  A.Pages.staff = function (view, route, App) {
    App.guard('nav.staff');
    var list = A.sortBy(D.all('staff'), 'name');
    view.appendChild(UI.pageHead('Xodimlar', list.length + ' ta xodim', [
      App.can('staff.edit') ? h('button', { class: 'btn primary', onclick: function () { staffForm(null, App); } },
        [UI.icon('plus'), 'Xodim qo’shish']) : null
    ]));
    view.appendChild(UI.card(null, list.length ? UI.table([
      { label: 'Ism', render: function (s) { return h('b', {}, s.name); } },
      { label: 'Lavozim', key: 'position' },
      { label: 'Telefon', render: function (s) { return h('span', { class: 'mono small' }, s.phone || '—'); } },
      { label: 'Ish boshlagan', render: function (s) { return A.dateLabel(s.startDate); } },
      {
        label: 'Guruhlari', right: true, render: function (s) {
          return D.all('groups').filter(function (g) { return g.teacherId === s.id && g.status === 'faol'; }).length;
        }
      },
      {
        label: 'Ish haqi', right: true, render: function (s) {
          return s.payType === 'fixed' ? h('span', { class: 'mono' }, A.som(s.salaryAmount)) : UI.pill(s.percentRate + '%', 'info');
        }
      },
      { label: 'Holat', render: function (s) { return s.status === 'faol' ? UI.pill('Faol', 'ok') : UI.pill('Arxiv', 'mute'); } }
    ], list, { onRow: function (s) { if (App.can('staff.edit')) staffForm(s, App); } })
      : UI.empty({
        title: 'Xodim yo’q', text: 'O’qituvchi va boshqa xodimlarni qo’shing.',
        action: App.can('staff.edit') ? { label: 'Xodim qo’shish', onClick: function () { staffForm(null, App); } } : null
      }), null, null, true));
  };

  function staffForm(staff, App) {
    App.guard('staff.edit');
    var isNew = !staff;
    var s = staff || { status: 'faol', payType: 'fixed', startDate: A.today(), position: 'O’qituvchi' };
    var f = UI.form([
      { name: 'name', label: 'Ism familiya', required: true, value: s.name },
      { name: 'phone', label: 'Telefon', value: s.phone, placeholder: '+998 90 123 45 67' },
      {
        name: 'position', label: 'Lavozim', type: 'select', value: s.position,
        options: ['O’qituvchi', 'Administrator', 'Direktor', 'Buxgalter', 'Boshqa'].map(function (p) { return { value: p, label: p }; })
      },
      { name: 'startDate', label: 'Ish boshlagan sana', type: 'date', value: s.startDate },
      {
        name: 'payType', label: 'Ish haqi turi', type: 'select', value: s.payType,
        options: [{ value: 'fixed', label: 'Belgilangan oylik' }, { value: 'percent', label: 'Tushumdan foiz' }]
      },
      { name: 'salaryAmount', label: 'Oylik summa (so’m)', type: 'number', value: s.salaryAmount },
      { name: 'percentRate', label: 'Foiz (%)', type: 'number', value: s.percentRate },
      {
        name: 'status', label: 'Holat', type: 'select', value: s.status,
        options: [{ value: 'faol', label: 'Faol' }, { value: 'arxiv', label: 'Arxivlangan' }]
      }
    ]);
    UI.modal({
      title: isNew ? 'Yangi xodim' : 'Xodimni tahrirlash',
      wide: true,
      body: f.node,
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              var rec = Object.assign({}, s, f.values(), { phone: A.normPhone(f.values().phone) });
              if (isNew) rec.id = A.uid('stf');
              await D.save('staff', rec);
              await A.Ops.audit(App.user, isNew ? 'Xodim qo’shildi' : 'Xodim tahrirlandi', rec.name, rec.position);
              c(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  /* ================= HISOBOTLAR ================= */
  A.Pages.reports = function (view, route, App) {
    App.guard('nav.reports');
    var period = route.period || 'month';
    var from = route.from, to = route.to;
    var today = A.today();
    if (period === 'today') { from = today; to = today; }
    else if (period === 'week') { from = A.addDays(today, -(A.weekdayOf(today) - 1)); to = A.addDays(from, 6); }
    else if (period === 'month') { from = A.monthStart(A.thisMonth()); to = A.monthEnd(A.thisMonth()); }
    else if (!from || !to) { from = A.monthStart(A.thisMonth()); to = A.monthEnd(A.thisMonth()); }

    view.appendChild(UI.pageHead('Hisobotlar', A.dateLabel(from) + ' — ' + A.dateLabel(to)));

    var fFrom = UI.field({ label: 'Boshlanish', type: 'date', value: from });
    var fTo = UI.field({ label: 'Tugash', type: 'date', value: to });
    function applyRange() {
      App.go('reports', { period: 'custom', from: fFrom.input.value, to: fTo.input.value });
    }
    fFrom.input.addEventListener('change', applyRange);
    fTo.input.addEventListener('change', applyRange);
    view.appendChild(h('div', { class: 'filters' }, [
      h('div', { class: 'seg' }, [
        { id: 'today', label: 'Bugun' }, { id: 'week', label: 'Shu hafta' },
        { id: 'month', label: 'Shu oy' }, { id: 'custom', label: 'Oraliq' }
      ].map(function (p) {
        return h('button', {
          type: 'button', 'aria-pressed': period === p.id ? 'true' : 'false',
          onclick: function () { App.go('reports', { period: p.id }); }
        }, p.label);
      })),
      fFrom.wrap, fTo.wrap
    ]));

    var inRange = function (d) { return d >= from && d <= to; };
    var pays = A.Fin.allPayments().filter(function (p) { return inRange(p.date); });
    var exps = [];
    Object.keys(D.docs).forEach(function (p) {
      if (p.indexOf('expenses/') !== 0) return;
      var items = D.docs[p].items || {};
      Object.keys(items).forEach(function (k) { if (inRange(items[k].date)) exps.push(items[k]); });
    });
    var cf = A.cashFlow(pays, exps.filter(function (e) { return !e.voided; }));

    var invs = A.Fin.allInvoices().filter(function (i) {
      return i.month >= A.ymOf(from) && i.month <= A.ymOf(to);
    });
    var charged = invs.reduce(function (s, i) { return s + i.final; }, 0);
    var debtors = Q.debtors();
    var totalDebt = debtors.reduce(function (s, d) { return s + d.debt; }, 0);

    var tiles = h('div', { class: 'tiles' }, [
      UI.tile({ label: 'Hisoblangan o’quv to’lovi', value: A.som(charged), hint: 'so’m' }),
      UI.tile({ label: 'Haqiqiy tushum', value: A.som(cf.income), hint: 'so’m', cls: 'money' }),
      UI.tile({ label: 'Qaytarilgan', value: A.som(cf.refunds), hint: 'so’m' }),
      UI.tile({ label: 'To’langan xarajatlar', value: A.som(cf.expenses), hint: 'so’m' }),
      UI.tile({ label: 'Sof pul oqimi', value: A.som(cf.net), hint: 'tushum − qaytarish − xarajat', cls: cf.net < 0 ? 'alert' : 'money' }),
      UI.tile({ label: 'Jami qarzdorlik', value: A.som(totalDebt), hint: debtors.length + ' o’quvchi', cls: totalDebt > 0 ? 'alert' : '' })
    ]);
    if (!App.can('reports.finance')) UI.clear(tiles);
    view.appendChild(tiles);

    if (App.can('reports.finance')) {
      view.appendChild(h('div', { class: 'banner info' }, h('div', {}, [
        h('b', {}, '"Sof pul oqimi" '), '— shu davrda kassaga kirgan va kassadan chiqqan pul farqi. Bu buxgalteriya foydasi emas.'
      ])));
    }

    var cols = h('div', { class: 'grid cols-2' });

    // O'quvchilar
    var st = { faol: 0, toxtatgan: 0, arxiv: 0 };
    D.all('students').forEach(function (s) { st[s.status] = (st[s.status] || 0) + 1; });
    cols.appendChild(UI.card('O’quvchilar', h('dl', { class: 'kv' }, [
      h('dt', {}, 'Faol'), h('dd', {}, st.faol || 0),
      h('dt', {}, 'Vaqtincha to’xtatgan'), h('dd', {}, st.toxtatgan || 0),
      h('dt', {}, 'Arxivlangan'), h('dd', {}, st.arxiv || 0),
      h('dt', {}, 'Jami'), h('dd', {}, D.all('students').length)
    ])));

    // Guruhlar bandligi
    var groupRows = D.all('groups').filter(function (g) { return g.status === 'faol'; }).map(function (g) {
      var n = Q.membersOf(g.id).length;
      return { name: g.name, n: n, limit: g.limit || 0, pct: g.limit ? Math.round(n / g.limit * 100) : 0 };
    });
    cols.appendChild(UI.card('Guruhlar bandligi', groupRows.length ? UI.table([
      { label: 'Guruh', render: function (r) { return r.name; } },
      { label: 'O’quvchi', right: true, render: function (r) { return r.n + (r.limit ? ' / ' + r.limit : ''); } },
      {
        label: 'Bandlik', right: true, render: function (r) {
          return h('div', { style: 'min-width:90px' }, h('div', { class: 'bar' + (r.pct > 90 ? ' warn' : '') }, h('i', { style: 'width:' + Math.min(100, r.pct) + '%' })));
        }
      }
    ], groupRows) : h('p', { class: 'muted' }, 'Faol guruh yo’q.'), null, null, true));

    // Murojaatlar
    var leads = D.all('leads');
    var conv = leads.filter(function (l) { return l.stage === 'oquvchi'; }).length;
    cols.appendChild(UI.card('Murojaatlar', h('dl', { class: 'kv' }, [
      h('dt', {}, 'Jami murojaat'), h('dd', {}, leads.length),
      h('dt', {}, 'O’quvchiga aylandi'), h('dd', {}, conv),
      h('dt', {}, 'Rad etdi'), h('dd', {}, leads.filter(function (l) { return l.stage === 'rad'; }).length),
      h('dt', {}, 'Aylanish darajasi'), h('dd', {}, (leads.length ? Math.round(conv / leads.length * 100) : 0) + '%')
    ])));

    // Davomat
    var attTotals = { keldi: 0, kelmadi: 0, kechikdi: 0, sababli: 0 };
    Object.keys(D.docs).forEach(function (p) {
      if (p.indexOf('lessons/') !== 0) return;
      var items = D.docs[p].items || {};
      Object.keys(items).forEach(function (date) {
        if (!inRange(date)) return;
        var att = items[date].attendance || {};
        Object.keys(att).forEach(function (mid) {
          var s = att[mid].status;
          if (attTotals[s] !== undefined) attTotals[s]++;
        });
      });
    });
    var attTotal = attTotals.keldi + attTotals.kelmadi + attTotals.kechikdi + attTotals.sababli;
    cols.appendChild(UI.card('Davomat', attTotal ? h('dl', { class: 'kv' }, [
      h('dt', {}, 'Keldi'), h('dd', {}, attTotals.keldi),
      h('dt', {}, 'Kechikdi'), h('dd', {}, attTotals.kechikdi),
      h('dt', {}, 'Sababli'), h('dd', {}, attTotals.sababli),
      h('dt', {}, 'Kelmadi'), h('dd', {}, attTotals.kelmadi),
      h('dt', {}, 'Qatnashuv'), h('dd', {}, Math.round((attTotals.keldi + attTotals.kechikdi) / attTotal * 100) + '%')
    ]) : h('p', { class: 'muted' }, 'Bu davrda davomat yozuvi yo’q.')));

    if (App.can('reports.finance')) {
      // Xarajat kategoriyalari
      var byCat = {};
      exps.filter(function (e) { return !e.voided; }).forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
      var catRows = Object.keys(byCat).map(function (k) { return { cat: k, sum: byCat[k] }; })
        .sort(function (a, b) { return b.sum - a.sum; });
      cols.appendChild(UI.card('Xarajatlar', catRows.length ? UI.table([
        { label: 'Kategoriya', render: function (r) { return r.cat; } },
        { label: 'Summa', right: true, render: function (r) { return h('span', { class: 'mono' }, A.som(r.sum)); } }
      ], catRows) : h('p', { class: 'muted' }, 'Xarajat yo’q.'), null, null, true));

      // O'qituvchi ish haqi
      var payrollRows = [];
      Object.keys(D.docs).forEach(function (p) {
        if (p.indexOf('payroll/') !== 0) return;
        var ymk = p.split('/')[1];
        if (ymk < A.ymOf(from) || ymk > A.ymOf(to)) return;
        var items = D.docs[p].items || {};
        Object.keys(items).forEach(function (sid) {
          payrollRows.push({ name: Q.staffName(sid), ym: ymk, accrued: items[sid].accrued, paid: items[sid].paid });
        });
      });
      cols.appendChild(UI.card('Ish haqi', payrollRows.length ? UI.table([
        { label: 'Xodim', render: function (r) { return r.name; } },
        { label: 'Oy', render: function (r) { return A.monthLabel(r.ym); } },
        { label: 'Hisoblangan', right: true, render: function (r) { return h('span', { class: 'mono' }, A.som(r.accrued)); } },
        { label: 'To’langan', right: true, render: function (r) { return h('span', { class: 'mono' }, A.som(r.paid)); } }
      ], payrollRows) : h('p', { class: 'muted' }, 'Ish haqi hisoblanmagan.'), null, null, true));
    }

    view.appendChild(cols);

    view.appendChild(h('div', { style: 'margin-top:14px' }, h('button', {
      class: 'btn', onclick: function () {
        var rows = [['Hisobot', A.dateLabel(from) + ' — ' + A.dateLabel(to)], []];
        if (App.can('reports.finance')) {
          rows.push(['Hisoblangan o’quv to’lovi', charged]);
          rows.push(['Haqiqiy tushum', cf.income]);
          rows.push(['Qaytarilgan', cf.refunds]);
          rows.push(['Xarajatlar', cf.expenses]);
          rows.push(['Sof pul oqimi', cf.net]);
          rows.push(['Jami qarzdorlik', totalDebt]);
          rows.push([]);
        }
        rows.push(['Faol o’quvchilar', st.faol || 0]);
        rows.push(['Murojaatlar', leads.length]);
        rows.push(['O’quvchiga aylandi', conv]);
        rows.push([]);
        rows.push(['Guruh', 'O’quvchi', 'Limit']);
        groupRows.forEach(function (r) { rows.push([r.name, r.n, r.limit]); });
        UI.exportCsv('hisobot-' + from + '_' + to + '.csv', rows);
      }
    }, [UI.icon('down'), 'Hisobotni Excel’ga yuklash'])));
  };

  /* ================= SOZLAMALAR ================= */
  A.Pages.settings = function (view, route, App) {
    App.guard('settings.edit');
    var tab = route.tab || 'general';
    view.appendChild(UI.pageHead('Sozlamalar', 'Markaz ma’lumotlari, foydalanuvchilar va tizim tarixi'));
    view.appendChild(UI.tabs([
      { id: 'general', label: 'Markaz' },
      { id: 'users', label: 'Foydalanuvchilar' },
      { id: 'cats', label: 'Xarajat kategoriyalari' },
      { id: 'data', label: 'Ma’lumotlar' },
      { id: 'log', label: 'O’zgarishlar tarixi' }
    ], tab, function (id) { App.go('settings', { tab: id }); }));

    if (tab === 'general') {
      var s = D.settings || A.Seed.DEFAULT_SETTINGS;
      var f = UI.form([
        { name: 'centerName', label: 'Markaz nomi', required: true, value: s.centerName },
        { name: 'phone', label: 'Telefon', value: s.phone },
        { name: 'address', label: 'Manzil', value: s.address, full: true },
        { name: 'workStart', label: 'Ish boshlanishi', type: 'time', value: s.workStart },
        { name: 'workEnd', label: 'Ish tugashi', type: 'time', value: s.workEnd },
        {
          name: 'dueDay', label: 'To’lov muddati (oyning kuni)', type: 'number', value: s.dueDay,
          help: 'Shu kundan keyin to’lanmagan hisob "muddati o’tgan" hisoblanadi.'
        }
      ]);
      view.appendChild(UI.card('Markaz ma’lumotlari', [f.node, h('div', { style: 'margin-top:14px' },
        h('button', {
          class: 'btn primary', onclick: function (e) {
            if (!f.validate()) return;
            UI.busy(e.currentTarget, async function () {
              var v = f.values();
              v.dueDay = Math.min(28, Math.max(1, v.dueDay || 5));
              await D.saveSettings(Object.assign({}, s, v));
              await A.Ops.audit(App.user, 'Sozlamalar o’zgartirildi', v.centerName, 'to’lov muddati: ' + v.dueDay);
              UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }, 'Saqlash'))]));
    }

    if (tab === 'users') {
      var users = A.sortBy(D.all('users'), 'name');
      view.appendChild(UI.card('Foydalanuvchilar', UI.table([
        { label: 'Ism', render: function (u) { return h('b', {}, u.name); } },
        { label: 'Login', render: function (u) { return h('span', { class: 'mono' }, u.login); } },
        { label: 'Rol', render: function (u) { return UI.pill(A.ROLES[u.role] || u.role, u.role === 'direktor' ? 'info' : 'mute'); } },
        { label: 'Xodim', render: function (u) { return u.staffId ? Q.staffName(u.staffId) : '—'; } },
        {
          label: 'Parol', render: function (u) {
            return u.isDefault ? UI.pill('Standart (1234)', 'bad') : UI.pill('O’zgartirilgan', 'ok');
          }
        },
        { label: 'Holat', render: function (u) { return u.active === false ? UI.pill('O’chirilgan', 'mute') : UI.pill('Faol', 'ok'); } },
        {
          label: '', right: true, render: function (u) {
            return h('button', { class: 'btn sm', onclick: function () { userForm(u, App); } }, 'Ochish');
          }
        }
      ], users), [h('button', { class: 'btn sm primary', onclick: function () { userForm(null, App); } }, 'Foydalanuvchi qo’shish')], true));
      view.appendChild(h('div', { class: 'banner warn', style: 'margin-top:14px' }, h('div', {}, [
        h('b', {}, 'Parollar haqida. '),
        'Standart parol (1234) faqat sinov uchun. Haqiqiy ishda har bir xodimga alohida login va kuchli parol bering.'
      ])));
    }

    if (tab === 'cats') {
      var cats = ((D.settings && D.settings.expenseCategories) || []).slice();
      var box = h('div', { class: 'list', style: 'border:1px solid var(--line);border-radius:10px' });
      function paintCats() {
        UI.clear(box);
        cats.forEach(function (c, i) {
          box.appendChild(h('div', { class: 'att-row' }, [
            h('div', { class: 'nm' }, c),
            h('button', {
              class: 'btn sm danger', onclick: function () {
                if (c === 'Ish haqi') { UI.toast('Bu kategoriya tizimga kerak.', 'bad'); return; }
                cats.splice(i, 1); paintCats();
              }
            }, 'O’chirish')
          ]));
        });
      }
      paintCats();
      var nf = UI.field({ label: 'Yangi kategoriya' });
      view.appendChild(UI.card('Xarajat kategoriyalari', [
        box,
        h('div', { class: 'rowflex', style: 'margin-top:12px;align-items:flex-end' }, [
          nf.wrap,
          h('button', {
            class: 'btn', onclick: function () {
              var v = nf.input.value.trim();
              if (!v) return;
              if (cats.indexOf(v) >= 0) { UI.toast('Bunday kategoriya bor.', 'bad'); return; }
              cats.push(v); nf.input.value = ''; paintCats();
            }
          }, 'Qo’shish'),
          h('button', {
            class: 'btn primary', onclick: function (e) {
              UI.busy(e.currentTarget, async function () {
                await D.saveSettings(Object.assign({}, D.settings, { expenseCategories: cats }));
                UI.toast('Saqlandi.', 'ok'); App.render();
              });
            }
          }, 'Saqlash')
        ])
      ]));
    }

    if (tab === 'data') {
      var hasDemo = D.all('students').some(function (x) { return x.demo; }) || D.all('groups').some(function (x) { return x.demo; });
      view.appendChild(UI.card('Namuna (demo) ma’lumotlar', [
        h('p', { style: 'margin:0 0 12px' }, hasDemo
          ? 'Tizimda demo o’quvchi, guruh, to’lov va xarajatlar bor. Haqiqiy ish boshlashdan oldin ularni o’chiring — haqiqiy ma’lumotlaringizga tegmaydi.'
          : 'Demo ma’lumotlar o’chirilgan. Kerak bo’lsa qayta yuklashingiz mumkin.'),
        h('div', { class: 'rowflex' }, [
          hasDemo ? h('button', {
            class: 'btn danger', onclick: async function (e) {
              var btn = e.currentTarget;
              if (!await UI.confirm('Demo ma’lumotlarni o’chirish',
                'Barcha demo o’quvchi, guruh, to’lov va xarajatlar o’chiriladi. Bu amalni qaytarib bo’lmaydi.', 'O’chirish', true)) return;
              UI.busy(btn, async function () {
                await A.Seed.clearDemo();
                await A.Ops.audit(App.user, 'Demo ma’lumotlar o’chirildi', '', '');
                UI.toast('O’chirildi.', 'ok'); App.render();
              });
            }
          }, 'Demo ma’lumotlarni o’chirish') : h('button', {
            class: 'btn', onclick: function (e) {
              UI.busy(e.currentTarget, async function () {
                await A.Seed.demo();
                UI.toast('Demo ma’lumotlar yuklandi.', 'ok'); App.render();
              });
            }
          }, 'Demo ma’lumotlarni yuklash')
        ])
      ]));

      view.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Zaxira nusxa', [
        h('p', { style: 'margin:0 0 12px' }, 'Barcha ma’lumotni bitta faylga yuklab oling. Faylni xavfsiz joyda saqlang.'),
        h('div', { class: 'rowflex' }, [
          h('button', {
            class: 'btn', onclick: async function () {
              var dump = {
                exportedAt: A.nowStamp(), settings: D.settings,
                collections: {}, docs: {}
              };
              A.COLLECTIONS.forEach(function (c) { dump.collections[c] = D.col[c]; });
              Object.keys(D.docs).forEach(function (p) { dump.docs[p] = D.docs[p]; });
              var text = JSON.stringify(dump, null, 1);
              var dl = null;
              try { if (global.claude && global.claude.use) dl = await global.claude.use('downloads'); } catch (e) { }
              if (dl) {
                try {
                  await dl.save({ filename: 'albyana-zaxira-' + A.today() + '.json', data: text });
                  UI.toast('Zaxira yuklab olindi.', 'ok'); return;
                } catch (e) { }
              }
              var ta = h('textarea', { style: 'width:100%;min-height:240px;font-family:var(--mono);font-size:11px' });
              ta.value = text;
              UI.modal({ title: 'Zaxira nusxa', wide: true, body: ta, actions: [{ label: 'Yopish', cls: 'primary' }] });
            }
          }, [UI.icon('down'), 'Zaxira nusxa olish'])
        ]),
        h('p', { class: 'small muted', style: 'margin:12px 0 0' },
          'Tiklash: zaxira faylini saqlab qo’ying va kerak bo’lganda tizim yaratuvchisiga bering — ma’lumotlar qayta yuklanadi. ' +
          'Har oy boshida bir marta zaxira olish tavsiya etiladi.')
      ])));
    }

    if (tab === 'log') {
      var entries = [];
      Object.keys(D.docs).forEach(function (p) {
        if (p.indexOf('audit/') !== 0) return;
        (D.docs[p].list || []).forEach(function (e) { entries.push(e); });
      });
      entries = A.sortBy(entries, 'at', 'desc').slice(0, 200);
      view.appendChild(UI.card('Muhim harakatlar tarixi', entries.length ? UI.table([
        { label: 'Vaqt', render: function (e) { return h('span', { class: 'mono small' }, e.at); } },
        { label: 'Kim', render: function (e) { return h('div', {}, [h('b', {}, e.by), h('div', { class: 'small muted' }, A.ROLES[e.role] || '')]); } },
        { label: 'Nima qildi', render: function (e) { return e.action; } },
        { label: 'Obyekt', render: function (e) { return e.entity || '—'; } },
        { label: 'Tafsilot', render: function (e) { return h('span', { class: 'small muted' }, e.details || '—'); } }
      ], entries) : h('p', { class: 'muted' }, 'Hozircha yozuv yo’q.'), null, null, true));
      view.appendChild(h('p', { class: 'small muted', style: 'margin-top:10px' },
        'Parollar va maxfiy ma’lumotlar tarixga yozilmaydi.'));
    }
  };

  function userForm(user, App) {
    App.guard('users.manage');
    var isNew = !user;
    var u = user || { role: 'admin', active: true };
    var f = UI.form([
      { name: 'name', label: 'Ism familiya', required: true, value: u.name },
      {
        name: 'login', label: 'Login', required: true, value: u.login,
        validate: function (v) {
          if (!/^[a-z0-9_.]+$/i.test(v)) return 'Faqat harf, raqam va _ belgisi.';
          var dup = D.all('users').filter(function (x) { return x.id !== u.id && String(x.login).toLowerCase() === v.toLowerCase(); });
          return dup.length ? 'Bu login band.' : null;
        }
      },
      {
        name: 'role', label: 'Rol', type: 'select', value: u.role,
        options: Object.keys(A.ROLES).map(function (r) { return { value: r, label: A.ROLES[r] }; })
      },
      {
        name: 'staffId', label: 'Qaysi xodim', type: 'select', value: u.staffId,
        options: [{ value: '', label: '— bog’lanmagan —' }].concat(
          D.all('staff').filter(function (s) { return s.status === 'faol'; }).map(function (s) { return { value: s.id, label: s.name }; })),
        help: 'O’qituvchi roli uchun majburiy — u faqat shu xodimning guruhlarini ko’radi.'
      },
      { name: 'password', label: isNew ? 'Parol' : 'Yangi parol (bo’sh qoldirsangiz o’zgarmaydi)', type: 'password', value: '' },
      {
        name: 'active', label: 'Holat', type: 'select', value: u.active === false ? 'no' : 'yes',
        options: [{ value: 'yes', label: 'Faol' }, { value: 'no', label: 'O’chirilgan' }]
      }
    ]);
    UI.modal({
      title: isNew ? 'Yangi foydalanuvchi' : 'Foydalanuvchi: ' + u.name,
      wide: true,
      body: f.node,
      actions: [
        (!isNew && u.id !== App.user.id) ? {
          label: 'O’chirish', cls: 'danger', onClick: async function (c) {
            if (await UI.confirm('Foydalanuvchini o’chirish', 'Bu hisob butunlay o’chiriladi.', 'O’chirish', true)) {
              await D.remove('users', u.id);
              await A.Ops.audit(App.user, 'Foydalanuvchi o’chirildi', u.login, '');
              c(); UI.toast('O’chirildi.', 'ok'); App.render();
            }
          }
        } : null,
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            var v = f.values();
            if (isNew && !v.password) { UI.toast('Parol kiriting.', 'bad'); return; }
            if (v.password && v.password.length < 4) { UI.toast('Parol kamida 4 belgidan iborat bo’lsin.', 'bad'); return; }
            if (v.role === 'oqituvchi' && !v.staffId) { UI.toast('O’qituvchi uchun xodimni tanlang.', 'bad'); return; }
            UI.busy(btn, async function () {
              var rec = Object.assign({}, u, {
                name: v.name, login: v.login.toLowerCase(), role: v.role,
                staffId: v.staffId || null, active: v.active === 'yes'
              });
              if (isNew) { rec.id = A.uid('usr'); rec.createdAt = A.nowStamp(); }
              if (v.password) {
                rec.salt = A.Seed.salt();
                rec.hash = await A.Seed.mkHash(rec.login, v.password, rec.salt);
                rec.isDefault = false;
              }
              await D.save('users', rec);
              await A.Ops.audit(App.user, isNew ? 'Foydalanuvchi qo’shildi' : 'Foydalanuvchi o’zgartirildi',
                rec.login, A.ROLES[rec.role]);
              c(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }
  A.userForm = userForm;
})(typeof window !== 'undefined' ? window : globalThis);
