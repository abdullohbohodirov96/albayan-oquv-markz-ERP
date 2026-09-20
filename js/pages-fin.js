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
    /* Qisqa izoh: qarz qancha va pul qayerga yoziladi */
    var hint = h('div', { class: 'pay-hint' });
    function refreshHint() {
      UI.clear(hint);
      var sid = pick.input.value;
      if (!sid) return;
      var bal = Q.balance(sid);
      var amount = A.parseSom(fAmount.input.value);
      var open = Q.openInvoices(sid);
      var line = [];
      if (bal.debt > 0) line.push(UI.pill('Qarz: ' + A.som(bal.debt) + ' so’m', 'warn'));
      else line.push(UI.pill('Qarzi yo’q', 'ok'));
      if (bal.advance > 0) line.push(UI.pill('Avans: ' + A.som(bal.advance) + ' so’m', 'info'));
      line.forEach(function (x) { hint.appendChild(x); });

      if (amount > 0) {
        var auto = A.allocate(amount, open);
        var used = auto.allocations.reduce(function (t, a) { return t + a.amount; }, 0);
        var rest = amount - used;
        var txt = used > 0
          ? 'Avtomatik: ' + auto.allocations.map(function (a) {
            var inv = open.filter(function (i) { return i.id === a.invoiceId; })[0];
            return (inv ? A.monthLabel(inv.month) : '') + ' — ' + A.som(a.amount);
          }).join('; ')
          : 'Ochiq hisob yo’q';
        if (rest > 0) txt += (used > 0 ? '; ' : '') + 'qolgan ' + A.som(rest) + ' so’m avansga';
        hint.appendChild(h('div', { class: 'small muted', style: 'flex-basis:100%;margin-top:4px' }, txt));
      }
    }

    pick.input.addEventListener('change', function () { refresh(); refreshHint(); });
    fAmount.input.addEventListener('input', function () { refresh(); refreshHint(); });
    if (studentId) pick.input.value = studentId;
    refresh();
    refreshHint();

    var warn = h('div');

    /* Birinchi ekran soddalashtirildi: o'quvchi + summa.
       Sana, usul, izoh va taqsimot "Qo'shimcha" ichida — kerak bo'lsa ochiladi. */
    var chosen = studentId ? D.one('students', studentId) : null;
    var picker = h('div', { class: 'form-grid' }, [search.wrap, pick.wrap]);
    var chosenLine = null;
    if (chosen) {
      picker.hidden = true;
      var chosenBal = Q.balance(chosen.id);
      chosenLine = h('div', { class: 'pay-who' }, [
        UI.avatar(chosen.lastName + ' ' + chosen.firstName),
        h('div', { class: 'main-col' }, [
          h('b', {}, chosen.lastName + ' ' + chosen.firstName),
          h('div', { class: 'small muted' }, [
            chosen.phone || chosen.parentPhone || '',
            (chosen.phone || chosen.parentPhone) && chosenBal.debt > 0 ? ' · ' : '',
            chosenBal.debt > 0 ? h('span', { style: 'color:var(--bad);font-weight:700' },
              'Qarz: ' + A.som(chosenBal.debt) + ' so’m') : null
          ])
        ]),
        h('button', {
          class: 'btn sm ghost', type: 'button', onclick: function (e) {
            picker.hidden = false;
            e.currentTarget.parentNode.hidden = true;
          }
        }, 'Boshqa o’quvchi')
      ]);
    }

    var extra = h('details', { class: 'more' }, [
      h('summary', {}, 'Qo’shimcha: sana, to’lov usuli, izoh va taqsimot'),
      h('div', { class: 'form-grid', style: 'margin-top:10px' }, [fDate.wrap, fMethod.wrap, fNote.wrap]),
      allocBox
    ]);

    UI.modal({
      title: chosen ? ('To’lov: ' + chosen.lastName + ' ' + chosen.firstName) : 'To’lov qabul qilish',
      wide: true,
      body: [
        chosenLine, picker,
        h('div', { class: 'form-grid' }, [fAmount.wrap]),
        hint, extra, warn
      ],
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
              if (A.Bot) { try { await A.Bot.notifyPayment(rec); } catch (e) { console.error('bot', e); } }
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

  /* ================= AVTOMATIK OYLIK HISOBLAR ================= */
  function autoInvoiceCard(App) {
    var box = h('div', {});
    var s = D.settings || {};
    var conf = s.autoInvoice || { enabled: false, day: 1 };

    function refresh() {
      UI.clear(box);
      var cb = h('input', { type: 'checkbox', id: 'auto-inv-on' });
      cb.checked = conf.enabled === true;
      var dayF = UI.field({
        label: 'Oyning qaysi kunida', type: 'number', value: conf.day || 1,
        help: 'Masalan 1 — har oyning 1-kuni hisoblar o’zi yaratiladi.'
      });
      var state = h('div', { class: 'small muted', style: 'margin-top:10px' },
        D.mode === 'server' ? 'Holat yuklanmoqda…'
          : 'Avtomatik yaratish faqat server rejimida ishlaydi. Hozir hisoblarni "Moliya → Hisoblangan to’lovlar" bo’limidan qo’lda yarating.');

      box.appendChild(UI.card('Oylik hisoblarni avtomatik yaratish', [
        h('p', { style: 'margin:0 0 12px' },
          'Yoqilsa, har oy boshida barcha faol o’quvchilarga hisob o’zi yaratiladi. ' +
          'Ikki marta yaratilmaydi — allaqachon bor hisob o’tkazib yuboriladi.'),
        h('label', { class: 'list-item', style: 'cursor:pointer;border:1px solid var(--line);border-radius:10px' }, [
          cb,
          h('div', { class: 'main-col' }, [
            h('b', {}, 'Avtomatik yaratish'),
            h('span', {}, conf.enabled ? 'Yoqilgan' : 'O’chirilgan')
          ])
        ]),
        h('div', { class: 'form-grid', style: 'margin-top:12px' }, [dayF.wrap]),
        state,
        h('div', { class: 'rowflex', style: 'margin-top:14px' }, [
          h('button', {
            class: 'btn primary', onclick: function (e) {
              UI.busy(e.currentTarget, async function () {
                conf = { enabled: cb.checked, day: Math.min(28, Math.max(1, Number(dayF.input.value) || 1)) };
                await D.saveSettings(Object.assign({}, D.settings, { autoInvoice: conf }));
                await A.Ops.audit(App.user, 'Avtomatik hisoblar sozlandi',
                  conf.enabled ? 'yoqildi' : 'o’chirildi', 'kun: ' + conf.day);
                UI.toast('Saqlandi.', 'ok');
                refresh();
              });
            }
          }, 'Saqlash'),
          D.mode === 'server' ? h('button', {
            class: 'btn', onclick: function (e) {
              UI.busy(e.currentTarget, async function () {
                try {
                  var r = await D.api('POST', 'api/invoices/auto/run');
                  if (r.off) UI.toast('Avval avtomatik yaratishni yoqing.', 'bad');
                  else if (r.waiting) UI.toast('Belgilangan kun hali kelmadi (' + r.day + '-kun).', 'info');
                  else if (r.done) UI.toast('Bu oy uchun allaqachon yaratilgan.', 'info');
                  else UI.toast((r.created || 0) + ' ta hisob yaratildi.', 'ok');
                  await D.loadBootstrap();
                  refresh();
                } catch (err) { UI.toast(err.message, 'bad'); }
              });
            }
          }, 'Hozir tekshirish') : null
        ])
      ]));

      if (D.mode === 'server') {
        D.api('GET', 'api/invoices/auto').then(function (r) {
          var el = box.querySelector('.small.muted');
          if (!el) return;
          el.textContent = '';
          var st = r.state || {};
          if (st.lastError) {
            el.appendChild(h('div', { class: 'banner bad' }, h('div', {}, [
              h('b', {}, 'Oxirgi urinishda xato. '), st.lastError,
              h('div', { class: 'small' }, 'Vaqti: ' + (st.lastErrorAt || '—'))
            ])));
          }
          el.appendChild(h('div', {}, st.lastRunAt
            ? 'Oxirgi yaratilgan: ' + A.monthLabel(st.lastMonth || A.thisMonth()) + ' · ' +
              (st.created || 0) + ' ta yangi, ' + (st.skipped || 0) + ' ta allaqachon bor edi · ' + st.lastRunAt
            : 'Hali avtomatik yaratilmagan.'));
          if ((st.errors || []).length) {
            el.appendChild(h('div', { class: 'small', style: 'color:var(--bad);margin-top:4px' },
              'Xatolar: ' + st.errors.slice(0, 3).join('; ')));
          }
        }).catch(function () { });
      }
    }

    refresh();
    return box;
  }

  /* ================= AVANSDAN QOPLASH ================= */
  A.advanceModal = function (studentId, App) {
    App.guard('payment.create');
    var s = D.one('students', studentId);
    if (!s) return;
    var bal = Q.balance(studentId);
    if (bal.advance <= 0) { UI.toast('Bu o’quvchida avans yo’q.', 'info'); return; }

    var open = Q.openInvoices(studentId);
    if (!open.length) {
      UI.toast('Ochiq hisob yo’q — qoplash shart emas.', 'info');
      return;
    }

    // avtomatik taqsimot: eng eski hisobdan boshlab
    var auto = A.allocate(bal.advance, open);
    var autoMap = {};
    auto.allocations.forEach(function (a) { autoMap[a.invoiceId] = a.amount; });

    var inputs = {};
    var rows = h('div', { class: 'list', style: 'border:1px solid var(--line);border-radius:10px' });
    open.forEach(function (inv) {
      var f = UI.field({ type: 'number', value: autoMap[inv.id] || 0 });
      f.input.style.maxWidth = '150px';
      f.input.addEventListener('input', summary);
      inputs[inv.id] = { input: f.input, inv: inv };
      rows.appendChild(h('div', { class: 'att-row' }, [
        h('div', { class: 'nm' }, [
          h('div', {}, A.monthLabel(inv.month) + ' · ' + Q.groupName(inv.groupId)),
          h('div', { class: 'small muted' }, 'Qoldiq: ' + A.som(inv.remaining) + ' so’m · muddat ' + A.dateLabel(inv.dueDate))
        ]),
        f.wrap
      ]));
    });

    var sumBox = h('div', { class: 'rowflex', style: 'margin-top:8px' });
    function summary() {
      UI.clear(sumBox);
      var used = 0;
      Object.keys(inputs).forEach(function (id) { used += A.parseSom(inputs[id].input.value); });
      sumBox.appendChild(UI.pill('Qoplanadi: ' + A.som(used) + ' so’m', used > 0 ? 'ok' : 'mute'));
      sumBox.appendChild(UI.pill('Avansdan qoladi: ' + A.som(Math.max(0, bal.advance - used)) + ' so’m', 'info'));
      if (used > bal.advance) sumBox.appendChild(UI.pill('Avansdan ortiq!', 'bad'));
    }
    summary();

    var warn = h('div');
    UI.modal({
      title: 'Avansdan qoplash',
      wide: true,
      body: [
        h('div', { class: 'banner info' }, h('div', {}, [
          h('b', {}, s.lastName + ' ' + s.firstName + ' avansi: ' + A.som(bal.advance) + ' so’m. '),
          'Bu pul allaqachon qabul qilingan — qoplash yangi daromad sifatida hisoblanmaydi, ',
          'faqat qarzga yoziladi.'
        ])),
        h('b', { style: 'display:block;margin:6px 0' }, 'Qaysi hisoblarga yozilsin'),
        rows, sumBox, warn
      ],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Qoplash', cls: 'primary', onClick: function (c, btn) {
            UI.clear(warn);
            var allocations = [], used = 0;
            Object.keys(inputs).forEach(function (id) {
              var v = A.parseSom(inputs[id].input.value);
              if (v > 0) { allocations.push({ invoiceId: id, amount: v }); used += v; }
            });
            if (!allocations.length) { warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, 'Qoplanadigan summani kiriting.'))); return; }
            if (used > bal.advance) { warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, 'Avansdan ortiq qoplab bo’lmaydi.'))); return; }
            UI.busy(btn, async function () {
              try {
                var rec = await A.Ops.applyAdvance({ studentId: studentId, allocations: allocations }, App.user);
                if (A.Bot) { try { await A.Bot.notifyAdvance(rec); } catch (e) { } }
                c();
                UI.toast('Avansdan ' + A.som(rec.applied || used) + ' so’m qoplandi.', 'ok');
                App.render();
              } catch (e) {
                warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, e.message)));
              }
            });
          }
        }
      ]
    });
  };

  /* ================= CHEK ================= */
  A.receiptModal = function (pay, App) {
    var s = D.one('students', pay.studentId);
    var set = D.settings || {};
    var lines = [];
    lines.push((set.centerName || 'AlBayan Cairo') + ' o’quv markazi');
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

    // Har bir satrni alohida tarjima qilamiz: aks holda butun chek bitta
    // matn bo'lib qoladi va tarjima qilinmaydi.
    if (A.t) lines = lines.map(function (l) { return A.t(l); });

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
    ], pays, { onRow: function (p) { App.go('student', { id: p.studentId, tab: 'tolovlar' }); }, page: 100 })
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
    ], debtors, { onRow: function (d) { App.go('student', { id: d.studentId, tab: 'hisoblar' }); }, page: 100 })
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
    ], invs, { onRow: function (i) { App.go('student', { id: i.studentId, tab: 'hisoblar' }); }, page: 100 })
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
    ], items, { page: 100 }) : UI.empty({
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
    var items = A.Fin.monthItems('payroll', ym);
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
      return { staff: s, item: A.Fin.payrollItem(ym, s.id) };
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

    view.appendChild(siteTeachersCard(App));
  };

  /* ---------- Saytdagi ustozlar ----------
     Bu ochiq sahifadagi profillar: ism, rasm va qisqa ma'lumot.
     Ish haqi va telefon bu yerda YO'Q — ular saytga chiqmaydi. */
  function siteTeachersCard(App) {
    var list = D.all('teachers').slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name));
    });
    var grid = h('div', { class: 'tch-admin' }, list.map(function (t) {
      return h('button', {
        class: 'tch-admin-item', type: 'button',
        onclick: function () { if (App.can('staff.edit')) teacherForm(t, App); }
      }, [
        teacherAvatar(t, 54),
        h('div', {}, [
          h('b', {}, t.name || '—'),
          h('div', { class: 'small muted' }, [
            t.tag || 'Ustoz',
            t.audience ? ' · ' + audienceLabel(t.audience) : '',
            t.active === false ? ' · yashirilgan' : ''
          ].join(''))
        ])
      ]);
    }));
    return UI.card('Saytdagi ustozlar',
      list.length ? grid : UI.empty({ title: 'Ustoz profili yo’q', text: 'Saytda ko’rinadigan ustozlarni qo’shing.' }),
      App.can('staff.edit')
        ? h('button', { class: 'btn', onclick: function () { teacherForm(null, App); } }, [UI.icon('plus'), 'Ustoz qo’shish'])
        : null);
  }

  function audienceLabel(a) {
    return { erkaklar: 'Erkaklar guruhlari', ayollar: 'Ayollar guruhlari', ikkalasi: 'Erkak va ayol guruhlari' }[a] || '';
  }

  /** Rasm bo'lsa — rasm, bo'lmasa ism harflaridan avatar */
  function teacherAvatar(t, size) {
    var box = h('span', { class: 'tch-ava', style: 'width:' + size + 'px;height:' + size + 'px' });
    var initials = String(t.name || '?').replace(/ustoz/i, '').trim()
      .split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
    box.appendChild(h('span', { class: 'tch-ini' }, initials || '?'));
    var img = h('img', {
      alt: t.name || '', loading: 'lazy',
      src: '/api/photo?id=' + encodeURIComponent(t.id) + '&v=' + (t.photoAt || '')
    });
    img.addEventListener('error', function () { img.remove(); });
    box.appendChild(img);
    return box;
  }

  /** Rasmni brauzerning o'zida kichraytirish — bazaga katta fayl tushmasin */
  function shrinkImage(file, maxSide) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Rasmni o’qib bo’lmadi.')); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { reject(new Error('Bu fayl rasm emas.')); };
        im.onload = function () {
          var k = Math.min(1, maxSide / Math.max(im.width, im.height));
          var w = Math.round(im.width * k), hgt = Math.round(im.height * k);
          var c = document.createElement('canvas');
          c.width = w; c.height = hgt;
          c.getContext('2d').drawImage(im, 0, 0, w, hgt);
          var q = 0.86, out = c.toDataURL('image/jpeg', q);
          while (out.length > 600000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
          resolve(out);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function teacherForm(t, App) {
    App.guard('staff.edit');
    var isNew = !t;
    var s = t || { active: true, tag: 'Misrlik ustoz', country: 'Misr', audience: 'erkaklar', order: (D.all('teachers').length + 1) };
    var newPhoto = null;

    var f = UI.form([
      { name: 'name', label: 'Ism (saytda ko’rinadi)', required: true, value: s.name, placeholder: 'Ustoz Ahmad' },
      { name: 'tag', label: 'Qisqa yozuv', value: s.tag, placeholder: 'Misrlik ustoz' },
      { name: 'country', label: 'Davlat', value: s.country, placeholder: 'Misr' },
      {
        name: 'audience', label: 'Kimga dars beradi', type: 'select', value: s.audience,
        options: [
          { value: 'erkaklar', label: 'Erkaklar guruhlari' },
          { value: 'ayollar', label: 'Ayollar guruhlari' },
          { value: 'ikkalasi', label: 'Erkak va ayol guruhlari' }
        ]
      },
      { name: 'levels', label: 'Darajalar', value: s.levels, placeholder: 'A1–B2' },
      { name: 'years', label: 'Tajriba (yil)', type: 'number', value: s.years },
      { name: 'bio', label: 'Qisqa ma’lumot', type: 'textarea', value: s.bio, placeholder: 'Al-Azhar bitiruvchisi, 8 yillik tajriba…' },
      { name: 'order', label: 'Tartib raqami', type: 'number', value: s.order },
      {
        name: 'active', label: 'Saytda ko’rinsin', type: 'select',
        value: s.active === false ? 'no' : 'yes',
        options: [{ value: 'yes', label: 'Ha' }, { value: 'no', label: 'Yo’q' }]
      }
    ]);

    /* rasm tanlash */
    var ava = teacherAvatar(s, 96);
    var file = h('input', { type: 'file', accept: 'image/*', id: 'tch-file', style: 'display:none' });
    var hint = h('span', { class: 'small muted' }, 'JPG yoki PNG. Rasm o’zi kichraytiriladi.');
    file.addEventListener('change', function () {
      var fl = file.files && file.files[0];
      if (!fl) return;
      shrinkImage(fl, 640).then(function (d) {
        newPhoto = d;
        UI.clear(ava);
        ava.appendChild(h('img', { src: d, alt: '' }));
        hint.textContent = 'Yangi rasm tanlandi — saqlashni bosing.';
      }).catch(function (e) { UI.toast(e.message || 'Rasm yuklanmadi', 'bad'); });
    });
    f.node.insertBefore(h('div', { class: 'tch-photo-row' }, [
      ava,
      h('div', {}, [
        h('button', { class: 'btn', type: 'button', onclick: function () { file.click(); } },
          [UI.icon('upload'), s.photoAt ? 'Rasmni almashtirish' : 'Rasm yuklash']),
        file, h('div', {}, hint)
      ])
    ]), f.node.firstChild);

    UI.modal({
      title: isNew ? 'Yangi ustoz' : 'Ustoz profili',
      wide: true,
      body: f.node,
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              var v = f.values();
              var rec = Object.assign({}, s, v, {
                active: v.active !== 'no',
                years: Number(v.years) || 0,
                order: Number(v.order) || 0
              });
              if (isNew) rec.id = A.uid('tch');
              if (newPhoto) rec.photoAt = String(Date.now());
              await D.save('teachers', rec);
              if (newPhoto) await D.save('photos', { id: rec.id, data: newPhoto });
              await A.Ops.audit(App.user, isNew ? 'Ustoz qo’shildi' : 'Ustoz tahrirlandi', rec.name, rec.tag || '');
              c(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  /** Lavozimdan mos rolni tanlash */
  function roleForPosition(pos) {
    return {
      'O’qituvchi': 'oqituvchi', 'Administrator': 'admin',
      'Direktor': 'direktor', 'Buxgalter': 'buxgalter'
    }[pos] || 'oqituvchi';
  }
  /** Ismdan login taklif qilish: "Ali Valiyev" → "ali.valiyev" */
  function loginFromName(name) {
    var base = String(name || '').toLowerCase()
      .replace(/[’'`]/g, '')
      .replace(/[^a-z0-9\s.]/g, '')
      .trim().replace(/\s+/g, '.');
    return base.slice(0, 20) || 'xodim';
  }
  function freeLogin(base, exceptId) {
    var taken = {};
    D.all('users').forEach(function (u) {
      if (u.id !== exceptId) taken[String(u.login || '').toLowerCase()] = 1;
    });
    if (!taken[base]) return base;
    for (var i = 2; i < 100; i++) { if (!taken[base + i]) return base + i; }
    return base + Date.now().toString(36).slice(-3);
  }

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
    /* --- Tizimga kirish: xodim qo'shilayotganda darhol login/parol --- */
    var canAccount = App.can('users.manage');
    var linked = s.id ? D.all('users').filter(function (u) { return u.staffId === s.id; })[0] : null;
    var accBox = h('div', { class: 'acc-box' });
    var acc = null;                     // login/parol maydonlari

    function paintAccount() {
      UI.clear(accBox);
      if (!canAccount) return;
      var on = accOn.checked;
      accBox.hidden = !on;
      if (!on) return;
      acc = UI.form([
        {
          name: 'login', label: 'Login', required: true,
          value: (linked && linked.login) || freeLogin(loginFromName(f.get('name').input.value), linked && linked.id),
          validate: function (v) {
            if (!/^[a-z0-9_.]+$/i.test(v)) return 'Faqat harf, raqam, nuqta va _ belgisi.';
            var dup = D.all('users').filter(function (x) {
              return x.id !== (linked && linked.id) && String(x.login).toLowerCase() === v.toLowerCase();
            });
            return dup.length ? 'Bu login band.' : null;
          }
        },
        {
          name: 'password', label: linked ? 'Yangi parol (bo’sh qoldirsangiz o’zgarmaydi)' : 'Parol',
          type: 'password', required: !linked, value: '',
          validate: function (v) {
            if (!v && linked) return null;
            return String(v || '').length < 4 ? 'Parol kamida 4 belgidan iborat bo’lsin.' : null;
          }
        },
        {
          name: 'role', label: 'Rol', type: 'select',
          value: (linked && linked.role) || roleForPosition(f.get('position').input.value),
          options: Object.keys(A.ROLES).map(function (r) { return { value: r, label: A.ROLES[r] }; }),
          help: 'O’qituvchi roli: faqat o’ziga biriktirilgan guruhlarni ko’radi va davomat oladi.'
        }
      ]);
      accBox.appendChild(acc.node);
    }

    var accOn = h('input', {
      type: 'checkbox', id: 'staff-acc',
      checked: (linked || isNew) ? true : null
    });
    accOn.addEventListener('change', paintAccount);
    var accRow = canAccount ? h('div', { class: 'acc-row' }, [
      h('label', { for: 'staff-acc' }, [accOn, h('b', {}, 'Tizimga kirish huquqi')]),
      h('span', { class: 'small muted' },
        linked ? 'Hisob mavjud: ' + linked.login : 'Login va parol shu yerda yaratiladi')
    ]) : null;
    f.node.appendChild(h('div', {}, [accRow, accBox].filter(Boolean)));
    if (canAccount) paintAccount();
    // lavozim o'zgarsa — rolni ham moslaymiz (agar hisob yangi bo'lsa)
    f.get('position').input.addEventListener('change', function () {
      if (!canAccount || linked || !accOn.checked || !acc) return;
      acc.get('role').input.value = roleForPosition(f.get('position').input.value);
    });

    UI.modal({
      title: isNew ? 'Yangi xodim' : 'Xodimni tahrirlash',
      wide: true,
      body: f.node,
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            if (canAccount && accOn.checked && acc && !acc.validate()) return;
            UI.busy(btn, async function () {
              var rec = Object.assign({}, s, f.values(), { phone: A.normPhone(f.values().phone) });
              if (isNew) rec.id = A.uid('stf');
              await D.save('staff', rec);
              await A.Ops.audit(App.user, isNew ? 'Xodim qo’shildi' : 'Xodim tahrirlandi', rec.name, rec.position);

              var made = '';
              if (canAccount && accOn.checked && acc) {
                var v = acc.values();
                var urec = Object.assign({}, linked || {}, {
                  id: (linked && linked.id) || A.uid('usr'),
                  login: String(v.login).toLowerCase().trim(),
                  name: rec.name,
                  role: v.role,
                  staffId: rec.id,
                  active: rec.status === 'faol'
                });
                try {
                  await D.saveUser(urec, v.password || '');
                  await A.Ops.audit(App.user, linked ? 'Hisob yangilandi' : 'Hisob yaratildi',
                    rec.name, urec.login + ' · ' + (A.ROLES[urec.role] || urec.role));
                  made = urec.login;
                } catch (e) {
                  UI.toast('Xodim saqlandi, lekin hisob yaratilmadi: ' + (e.message || e), 'bad');
                }
              } else if (canAccount && !accOn.checked && linked && linked.active !== false) {
                // kirish huquqi olib tashlandi
                var off = A.clone(linked);
                off.active = false;
                await D.saveUser(off, '');
                await A.Ops.audit(App.user, 'Hisob o’chirildi', rec.name, off.login);
              }

              c();
              UI.toast('Saqlandi.', 'ok');
              App.render();
              if (made && !linked) {
                UI.modal({
                  title: 'Hisob tayyor',
                  body: [
                    h('p', { style: 'margin:0' }, rec.name + ' endi tizimga kira oladi.'),
                    h('dl', { class: 'kv' }, [
                      h('dt', {}, 'Login'), h('dd', {}, h('b', {}, made)),
                      h('dt', {}, 'Parol'), h('dd', {}, 'siz kiritgan parol')
                    ]),
                    h('p', { class: 'small muted', style: 'margin:0' },
                      'Login va parolni xodimga yetkazing. Birinchi kirishdan keyin ' +
                      'parolni almashtirishni tavsiya qilamiz.')
                  ],
                  actions: [
                    { label: 'Loginni nusxalash', onClick: function () { UI.copy(made); } },
                    { label: 'Yopish', cls: 'primary' }
                  ]
                });
              }
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
    var exps = D.all('expenses').filter(function (e) { return inRange(e.date); });
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
      var payrollRows = D.all('payroll')
        .filter(function (it) { return it.month >= A.ymOf(from) && it.month <= A.ymOf(to); })
        .map(function (it) {
          return { name: Q.staffName(it.staffId), ym: it.month, accrued: it.accrued, paid: it.paid };
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
      { id: 'funnels', label: 'Sotuv voronkalari' },
      { id: 'users', label: 'Foydalanuvchilar' },
      { id: 'cats', label: 'Xarajat kategoriyalari' },
      { id: 'data', label: 'Ma’lumotlar' },
      { id: 'log', label: 'O’zgarishlar tarixi' }
    ], tab, function (id) { App.go('settings', { tab: id }); }));

    if (tab === 'funnels') renderFunnels(view, App);

    if (tab === 'general') {
      var s = D.settings || A.Seed.DEFAULT_SETTINGS;
      var f = UI.form([
        { name: 'centerName', label: 'Markaz nomi', required: true, value: s.centerName },
      {
        name: 'about', label: 'Sayt uchun qisqa matn', type: 'textarea', value: s.about,
        help: 'Ochiq saytda markaz nomi tagida chiqadi.'
      },
        { name: 'phone', label: 'Telefon', value: s.phone },
        { name: 'address', label: 'Manzil', value: s.address, full: true },
        { name: 'workStart', label: 'Ish boshlanishi', type: 'time', value: s.workStart },
        { name: 'workEnd', label: 'Ish tugashi', type: 'time', value: s.workEnd },
        {
          name: 'dueDay', label: 'To’lov muddati (oyning kuni)', type: 'number', value: s.dueDay,
          help: 'Shu kundan keyin to’lanmagan hisob "muddati o’tgan" hisoblanadi.'
        }
      ]);
      var langBtns = h('div', { class: 'rowflex' }, A.I18N.langs.map(function (l) {
        return h('button', {
          class: 'btn' + (A.I18N.lang === l.id ? ' primary' : ''),
          onclick: function () { A.I18N.set(l.id); App.render(); }
        }, l.label);
      }));
      var themeBtns = h('div', { class: 'rowflex' }, [
        { id: 'light', label: 'Yorug’' }, { id: 'dark', label: 'Qorong’i' }, { id: '', label: 'Tizim bo’yicha' }
      ].map(function (t) {
        var cur = document.documentElement.getAttribute('data-theme') || '';
        return h('button', {
          class: 'btn' + (cur === t.id ? ' primary' : ''),
          onclick: function () {
            if (t.id) document.documentElement.setAttribute('data-theme', t.id);
            else document.documentElement.removeAttribute('data-theme');
            try { localStorage.setItem('albyana_theme', t.id); } catch (e) { }
            App.render();
          }
        }, t.label);
      }));
      view.appendChild(UI.card('Ko’rinish', [
        h('div', { class: 'field' }, [h('label', {}, 'Til'), langBtns]),
        h('div', { class: 'field', style: 'margin-top:12px' }, [h('label', {}, 'Mavzu'), themeBtns])
      ]));
      view.appendChild(h('div', { style: 'height:14px' }));
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

      if (App.can('invoice.create')) {
        view.appendChild(h('div', { id: 'auto-inv', style: 'margin-top:14px' }, autoInvoiceCard(App)));
      }
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

      view.appendChild(h('div', { id: 'backup-card', style: 'margin-top:14px' }, backupCard(App)));
      view.appendChild(h('div', { id: 'install-card', style: 'margin-top:14px' }, installCard()));
    }

    if (tab === 'log') {
      var entries = A.sortBy(D.all('audit'), 'at', 'desc').slice(0, 200);
      view.appendChild(UI.card('Muhim harakatlar tarixi', entries.length ? UI.table([
        { label: 'Vaqt', render: function (e) { return h('span', { class: 'mono small' }, e.at); } },
        { label: 'Kim', render: function (e) { return h('div', {}, [h('b', {}, e.by), h('div', { class: 'small muted' }, A.ROLES[e.role] || '')]); } },
        { label: 'Nima qildi', render: function (e) { return e.action; } },
        { label: 'Obyekt', render: function (e) { return e.entity || '—'; } },
        { label: 'Tafsilot', render: function (e) { return h('span', { class: 'small muted' }, e.details || '—'); } }
      ], entries, { page: 50 }) : h('p', { class: 'muted' }, 'Hozircha yozuv yo’q.'), null, null, true));
      view.appendChild(h('p', { class: 'small muted', style: 'margin-top:10px' },
        'Parollar va maxfiy ma’lumotlar tarixga yozilmaydi.'));
    }
  };

  /* ================= ZAXIRA NUSXA VA TIKLASH ================= */

  /** Brauzerdagi barcha ma'lumotdan zaxira tuzish (server yo'q rejim uchun ham) */
  function localDump() {
    var docs = {};
    A.COLLECTIONS.forEach(function (c) {
      var items = D.col[c] || {};
      Object.keys(items).forEach(function (id) { docs[c + '/' + id] = items[id]; });
    });
    Object.keys(D.docs || {}).forEach(function (p) { docs[p] = D.docs[p]; });
    if (D.settings) docs['meta/settings'] = D.settings;
    return {
      format: 3, app: 'albyana-erp',
      createdAt: new Date().toISOString(),
      reason: 'qo’lda (brauzerdan)',
      count: Object.keys(docs).length,
      docs: docs
    };
  }

  function dumpDocs(dump) {
    if (dump && dump.docs && !dump.collections) return dump.docs;
    // eski format
    var docs = {};
    Object.keys((dump && dump.collections) || {}).forEach(function (c) {
      var items = dump.collections[c] || {};
      Object.keys(items).forEach(function (id) { docs[c + '/' + id] = items[id]; });
    });
    Object.keys((dump && dump.docs) || {}).forEach(function (p) { docs[p] = dump.docs[p]; });
    if (dump && dump.settings) docs['meta/settings'] = dump.settings;
    return docs;
  }

  /** Faylni tekshirish — serverga yubormasdan oldin ham, serversiz rejimda ham */
  function validateDump(dump) {
    var errors = [], warnings = [];
    if (!dump || typeof dump !== 'object') return { ok: false, errors: ['Fayl JSON emas.'], warnings: [], byCollection: {}, count: 0, docs: {} };
    if (dump.app && dump.app !== 'albyana-erp') errors.push('Bu fayl AlBayan Cairo zaxirasi emas.');
    var docs = dumpDocs(dump);
    var byCollection = {};
    Object.keys(docs).forEach(function (p) {
      if (p.split('/').length % 2 !== 0) { errors.push('Noto’g’ri yo’l: ' + p.slice(0, 40)); return; }
      if (!docs[p] || typeof docs[p] !== 'object') { errors.push('Buzuq yozuv: ' + p.slice(0, 40)); return; }
      var c = p.split('/')[0];
      byCollection[c] = (byCollection[c] || 0) + 1;
    });
    if (!Object.keys(docs).length) errors.push('Ichida ma’lumot yo’q.');
    if (!byCollection.users) errors.push('Zaxirada foydalanuvchilar yo’q — tiklashdan keyin hech kim kira olmaydi.');
    if (!docs['meta/settings']) warnings.push('Sozlamalar yo’q — standart sozlamalar qo’llanadi.');
    return { ok: errors.length === 0, errors: errors, warnings: warnings, byCollection: byCollection, count: Object.keys(docs).length, docs: docs };
  }

  function previewRows(check) {
    var now = {};
    A.COLLECTIONS.forEach(function (c) { now[c] = Object.keys(D.col[c] || {}).length; });
    var cols = Object.keys(now).concat(Object.keys(check.byCollection));
    var seen = {}, rows = [];
    cols.forEach(function (c) {
      if (seen[c]) return; seen[c] = 1;
      var a = now[c] || 0, b = check.byCollection[c] || 0;
      if (!a && !b) return;
      rows.push({ name: c, hozir: a, keyin: b, farq: b - a });
    });
    return rows;
  }

  var COL_LABEL = {
    users: 'Hisoblar', staff: 'Xodimlar', courses: 'Kurslar', rooms: 'Xonalar',
    students: 'O’quvchilar', groups: 'Guruhlar', memberships: 'Guruhga yozilganlar',
    leads: 'Murojaatlar', funnels: 'Voronkalar', tasks: 'Vazifalar', chats: 'Suhbatlar',
    invoices: 'Hisob-fakturalar', payments: 'To’lovlar', expenses: 'Xarajatlar',
    payroll: 'Oylik', audit: 'Harakatlar tarixi', attendance: 'Davomat', meta: 'Sozlamalar',
    botreq: 'Bot so’rovlari', botout: 'Bot xabarlari', botin: 'Botga kelganlar'
  };

  function backupCard(App) {
    var box = h('div', {});

    function refresh() {
      box.textContent = '';
      box.appendChild(UI.card('Zaxira nusxa', [
        h('p', { style: 'margin:0 0 12px' },
          'Barcha ma’lumot bitta faylga yig’iladi. Fayl serverda ham saqlanadi, kompyuteringizga ham yuklab olsangiz bo’ladi.'),
        h('div', { id: 'db-state', class: 'small muted', style: 'margin-bottom:6px' }, ''),
        h('div', { id: 'backup-state', class: 'small muted', style: 'margin-bottom:12px' }, 'Holat yuklanmoqda…'),
        h('div', { class: 'rowflex' }, [
          h('button', {
            class: 'btn primary', onclick: function (e) {
              UI.busy(e.currentTarget, async function () {
                if (D.mode === 'server') {
                  try {
                    var r = await D.api('POST', 'api/backup/run');
                    UI.toast('Serverda zaxira olindi: ' + r.file.name, 'ok');
                  } catch (err) { UI.toast(err.message, 'bad'); }
                }
                await UI.saveText('albayan-zaxira-' + A.today() + '.json',
                  JSON.stringify(localDump()));
                refresh();
              });
            }
          }, [UI.icon('down'), 'Hozir zaxira olish']),
          h('button', {
            class: 'btn', onclick: function () { restoreDialog(App, refresh); }
          }, 'Zaxiradan tiklash')
        ]),
        h('p', { class: 'small muted', style: 'margin:12px 0 0' },
          'Server rejimida zaxira har kuni avtomatik olinadi va ' +
          'oxirgi 30 tasi saqlanadi. Xato bo’lsa direktorga suhbat orqali xabar boradi.')
      ]));

      if (D.mode === 'server') {
        D.api('GET', 'api/backup/db').then(function (r) {
          var el = box.querySelector('#db-state');
          if (!el) return;
          var st = r.stats || {};
          var kind = { postgres: 'PostgreSQL (bulutli baza)', sqlite: 'SQLite fayli', json: 'JSON fayli' }[r.kind] || r.kind;
          var mb = st.bytes ? (st.bytes / 1048576) : 0;
          el.textContent = 'Baza: ' + kind + ' · ' + (st.rows || 0) + ' ta yozuv · ' +
            (st.size || (mb.toFixed(1) + ' MB'));
          if (r.kind === 'postgres' && mb > 400) {
            el.appendChild(h('div', { class: 'small', style: 'color:var(--bad);margin-top:4px' },
              'Diqqat: bepul tarif chegarasi (0.5 GB) yaqinlashdi.'));
          }
        }).catch(function () { });
        D.api('GET', 'api/backup/state').then(function (r) {
          var el = box.querySelector('#backup-state');
          if (!el) return;
          el.textContent = '';
          var st = r.state || {};
          if (st.lastError) {
            el.appendChild(h('div', { class: 'banner bad' }, h('div', {}, [
              h('b', {}, 'Oxirgi zaxira olinmadi. '), st.lastError,
              h('div', { class: 'small' }, 'Vaqti: ' + (st.lastErrorAt || '—'))
            ])));
          }
          el.appendChild(h('div', {}, st.lastOkAt
            ? 'Oxirgi muvaffaqiyatli zaxira: ' + String(st.lastOkAt).replace('T', ' ').slice(0, 16) +
            ' · ' + (st.lastCount || 0) + ' yozuv · ' + Math.round((st.lastBytes || 0) / 1024) + ' KB'
            : 'Hali zaxira olinmagan.'));
          if ((r.files || []).length) {
            el.appendChild(h('div', { style: 'margin-top:6px' },
              'Serverdagi zaxiralar: ' + r.files.length + ' ta (eng yangisi: ' + r.files[0].name + ')'));
          }
        }).catch(function (e) {
          var el = box.querySelector('#backup-state');
          if (el) el.textContent = 'Holatni o’qib bo’lmadi: ' + e.message;
        });
      } else {
        var el = box.querySelector('#backup-state');
        if (el) el.textContent = 'Bu rejimda ma’lumot shu brauzerda saqlanadi — zaxirani qo’lda oling va xavfsiz joyda saqlang.';
      }
    }

    refresh();
    return box;
  }

  function restoreDialog(App, done) {
    var fileInput = h('input', { type: 'file', accept: '.json,application/json' });
    var serverPick = h('select', { class: 'inp' }, [h('option', { value: '' }, 'Serverdagi zaxiralardan tanlang…')]);
    var result = h('div', { style: 'margin-top:12px' });
    var chosen = null;           // {dump, name}
    var confirmInput = h('input', { class: 'inp', placeholder: 'TIKLASH' });
    var applyBtn = null;

    if (D.mode === 'server') {
      D.api('GET', 'api/backup/state').then(function (r) {
        (r.files || []).forEach(function (f) {
          serverPick.appendChild(h('option', { value: f.name },
            f.name + ' — ' + Math.round(f.bytes / 1024) + ' KB'));
        });
      }).catch(function () { });
      serverPick.onchange = function () {
        if (!serverPick.value) return;
        D.api('GET', 'api/backup/file?name=' + encodeURIComponent(serverPick.value))
          .then(function (dump) { chosen = { dump: dump, name: serverPick.value, fromServer: true }; show(); })
          .catch(function (e) { UI.toast(e.message, 'bad'); });
      };
    }

    fileInput.onchange = function () {
      var f = fileInput.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { chosen = { dump: JSON.parse(String(fr.result)), name: f.name }; }
        catch (e) { chosen = null; UI.toast('Fayl JSON emas.', 'bad'); }
        show();
      };
      fr.readAsText(f);
    };

    function show() {
      result.textContent = '';
      if (!chosen) return;
      var check = validateDump(chosen.dump);
      if (applyBtn) applyBtn.disabled = !check.ok;

      result.appendChild(h('div', { class: 'small muted', style: 'margin-bottom:8px' },
        'Fayl: ' + chosen.name + (chosen.dump.createdAt
          ? ' · yaratilgan: ' + String(chosen.dump.createdAt).replace('T', ' ').slice(0, 16) : '')));

      check.errors.forEach(function (msg) {
        result.appendChild(h('div', { class: 'banner bad' }, h('div', {}, msg)));
      });
      check.warnings.forEach(function (msg) {
        result.appendChild(h('div', { class: 'banner info' }, h('div', {}, msg)));
      });
      if (!check.ok) {
        result.appendChild(h('p', { class: 'small' }, 'Bu fayl bilan tiklash mumkin emas.'));
        return;
      }

      var rows = previewRows(check);
      result.appendChild(h('p', { style: 'margin:8px 0' }, 'Tiklangandan keyin nima bo’ladi:'));
      result.appendChild(UI.table([
        { label: 'Bo’lim', render: function (r) { return COL_LABEL[r.name] || r.name; } },
        { label: 'Hozir', right: true, render: function (r) { return r.hozir; } },
        { label: 'Keyin', right: true, render: function (r) { return r.keyin; } },
        {
          label: 'O’zgarish', right: true, render: function (r) {
            if (r.farq === 0) return h('span', { class: 'muted' }, '—');
            return h('b', { style: 'color:' + (r.farq < 0 ? 'var(--bad)' : 'var(--ok)') },
              (r.farq > 0 ? '+' : '') + r.farq);
          }
        }
      ], rows));
      var lost = rows.filter(function (r) { return r.farq < 0; });
      if (lost.length) {
        result.appendChild(h('div', { class: 'banner bad' }, h('div', {}, [
          h('b', {}, 'Diqqat: '),
          'zaxiradan keyin yaratilgan yozuvlar o’chadi (' +
          lost.map(function (r) { return (COL_LABEL[r.name] || r.name) + ': ' + (-r.farq); }).join(', ') + ').'
        ])));
      }
      result.appendChild(h('p', { class: 'small', style: 'margin:10px 0 4px' },
        'Tiklashdan oldin joriy holat avtomatik zaxiraga olinadi. Davom etish uchun katta harflarda TIKLASH deb yozing:'));
      result.appendChild(confirmInput);
    }

    var m = UI.modal({
      title: 'Zaxiradan tiklash',
      wide: true,
      body: [
        h('div', { class: 'banner info' }, h('div', {},
          'Tiklash hozirgi ma’lumotlarni zaxiradagi holat bilan almashtiradi. Avval fayl tekshiriladi va o’zgarish ko’rsatiladi.')),
        D.mode === 'server' ? h('label', { class: 'fld' }, [h('span', {}, 'Serverdagi zaxira'), serverPick]) : null,
        h('label', { class: 'fld' }, [h('span', {}, 'Yoki kompyuteringizdagi fayl'), fileInput]),
        result
      ],
      actions: [{
        label: 'Tiklash', cls: 'danger',
        onClick: function (close, btn) {
          if (!chosen) { UI.toast('Avval zaxira faylini tanlang.', 'bad'); return; }
          var check = validateDump(chosen.dump);
          if (!check.ok) { UI.toast('Fayl yaroqsiz.', 'bad'); return; }
          if (confirmInput.value.trim() !== 'TIKLASH') {
            UI.toast('Tasdiqlash uchun TIKLASH deb yozing.', 'bad'); return;
          }
          UI.busy(btn, async function () {
            try {
              if (D.mode === 'server') {
                var body = chosen.fromServer
                  ? { name: chosen.name, confirm: 'TIKLASH' }
                  : { dump: chosen.dump, confirm: 'TIKLASH' };
                var r = await D.api('POST', 'api/backup/restore', body);
                UI.toast('Tiklandi: ' + r.restored + ' yozuv. Oldingi holat "' + r.safety + '" fayliga saqlandi.', 'ok');
                await D.loadBootstrap();
              } else {
                await UI.saveText('albayan-tiklashdan-oldin-' + A.today() + '.json', JSON.stringify(localDump()));
                await localRestore(check.docs);
                UI.toast('Tiklandi: ' + Object.keys(check.docs).length + ' yozuv.', 'ok');
              }
              close();
              if (done) done();
              App.render();
            } catch (e) {
              UI.toast(e.message || 'Tiklash bajarilmadi.', 'bad');
            }
          });
        }
      }]
    });
    applyBtn = m && m.box ? m.box.querySelector('.m-foot button.danger') : null;
    if (applyBtn) applyBtn.disabled = true;
  }

  /** Serversiz rejimda tiklash */
  async function localRestore(docs) {
    // avval ortiqchalarini o'chiramiz
    for (var ci = 0; ci < A.COLLECTIONS.length; ci++) {
      var c = A.COLLECTIONS[ci];
      var ids = Object.keys(D.col[c] || {});
      for (var i = 0; i < ids.length; i++) {
        if (!docs[c + '/' + ids[i]]) await D.remove(c, ids[i]);
      }
    }
    var paths = Object.keys(docs);
    for (var k = 0; k < paths.length; k++) {
      var p = paths[k], parts = p.split('/'), name = parts[0];
      if (p === 'meta/settings') { await D.saveSettings(docs[p]); continue; }
      if (A.COLLECTIONS.indexOf(name) >= 0 && parts.length === 2) {
        await D.save(name, docs[p]);
      } else {
        await D._setDoc(p, docs[p]);
      }
    }
  }

  A.Backup = {
    localDump: localDump, dumpDocs: dumpDocs, validateDump: validateDump,
    previewRows: previewRows, localRestore: localRestore
  };

  /* ================= TELEFONGA O'RNATISH ================= */
  function installCard() {
    var P = A.PWA;
    var already = P && P.installed && P.installed();
    var canWork = P && location.protocol.indexOf('http') === 0;
    return UI.card('Telefonga o’rnatish', [
      h('p', { style: 'margin:0 0 12px' }, already
        ? 'Ilova shu qurilmaga o’rnatilgan — brauzersiz, alohida dastur kabi ochiladi.'
        : 'Ilovani telefon yoki kompyuterga alohida dastur sifatida o’rnatish mumkin. ' +
        'Bosh ekranda belgi paydo bo’ladi, ochilishi tezroq bo’ladi.'),
      already ? null : h('div', { class: 'rowflex' }, [
        h('button', {
          class: 'btn primary', onclick: function (e) {
            UI.busy(e.currentTarget, async function () {
              if (!canWork) {
                UI.toast('O’rnatish uchun ilovani server manzilidan (https) oching.', 'bad');
                return;
              }
              var okd = await P.install();
              if (okd) UI.toast('O’rnatildi.', 'ok');
            });
          }
        }, 'Ilovani o’rnatish')
      ]),
      h('p', { class: 'small muted', style: 'margin:12px 0 0' },
        'iPhone’da: Safari → "Ulashish" → "Bosh ekranga qo’shish". ' +
        'Android’da: Chrome menyusi → "Ilovani o’rnatish". ' +
        'Internet uzilsa, ochilgan ma’lumotlarni ko’rish mumkin, lekin to’lov va boshqa yozuvlar ' +
        'saqlanmaydi — tizim buni ochiq aytadi.')
    ]);
  }

  /* ================= SOTUV VORONKALARI ================= */
  function intakeUrl(funnel) {
    var base = location.origin + location.pathname.replace(/[^/]*$/, '');
    return base + 'api/intake/' + (funnel.intakeKey || '');
  }

  function renderFunnels(view, App) {
    var funnels = A.sortBy(D.all('funnels'), 'order');
    var leads = D.all('leads');

    view.appendChild(h('div', { class: 'banner info' }, h('div', {}, [
      h('b', {}, 'Voronka nima? '),
      'Har bir mijoz oqimi uchun alohida yo’l: masalan "Asosiy" (o’zi kelganlar), ',
      '"Target reklama" va "Instagram". Har birining bosqichlari boshqacha bo’lishi mumkin.'
    ])));

    view.appendChild(UI.card(null, funnels.length ? UI.table([
      { label: 'Voronka', render: function (f) { return h('b', {}, f.name); } },
      {
        label: 'Bosqichlar', render: function (f) {
          return h('div', { class: 'rowflex', style: 'gap:4px' },
            A.funnelStages(f).map(function (s) { return UI.pill(s.label, 'mute'); }));
        }
      },
      {
        label: 'Murojaatlar', right: true, render: function (f) {
          return leads.filter(function (l) { return (l.funnelId || 'fnl_asosiy') === f.id; }).length;
        }
      },
      {
        label: 'Qabul havolasi', render: function (f) {
          return h('button', {
            class: 'btn sm', onclick: function () { intakeModal(f, App); }
          }, 'Ko’rsatish');
        }
      },
      {
        label: '', right: true, render: function (f) {
          return h('button', { class: 'btn sm', onclick: function () { funnelForm(f, App); } }, 'Tahrirlash');
        }
      }
    ], funnels) : UI.empty({ title: 'Voronka yo’q', text: 'Birinchi voronkani yarating.' }),
      [h('button', { class: 'btn sm primary', onclick: function () { funnelForm(null, App); } }, 'Voronka qo’shish')],
      true));
  }

  function funnelForm(funnel, App) {
    var isNew = !funnel;
    var f0 = funnel || { name: '', order: D.all('funnels').length + 1, stages: A.clone(A.LEAD_STAGES) };
    var stages = A.clone(A.funnelStages(f0));

    var nameF = UI.field({ label: 'Voronka nomi', required: true, value: f0.name, placeholder: 'Target reklama' });
    var srcF = UI.field({
      label: 'Avtomatik manba belgisi', value: f0.autoSource || '',
      help: 'Shu voronkaga tushgan murojaatlarga avtomatik yoziladi (masalan: Instagram).'
    });
    var box = h('div', { class: 'perm-grid' });

    function paint() {
      UI.clear(box);
      stages.forEach(function (s, i) {
        var lab = h('input', { type: 'text', value: s.label, style: 'flex:1;min-width:140px;padding:8px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface)' });
        lab.addEventListener('input', function () { s.label = lab.value; });
        var typeSel = h('select', { style: 'padding:8px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface)' }, [
          h('option', { value: '' }, 'Oddiy bosqich'),
          h('option', { value: 'won' }, 'Yakun: o’quvchi bo’ldi'),
          h('option', { value: 'lost' }, 'Yakun: rad etdi')
        ]);
        typeSel.value = s.type || '';
        typeSel.addEventListener('change', function () {
          s.type = typeSel.value || undefined;
        });
        box.appendChild(h('div', { class: 'perm-row' }, [
          h('span', { class: 'muted mono', style: 'min-width:22px' }, String(i + 1)),
          lab, typeSel,
          h('button', {
            class: 'btn sm', type: 'button', disabled: i === 0,
            onclick: function () { var t = stages[i - 1]; stages[i - 1] = stages[i]; stages[i] = t; paint(); }
          }, '↑'),
          h('button', {
            class: 'btn sm danger', type: 'button', disabled: stages.length <= 2,
            onclick: function () { stages.splice(i, 1); paint(); }
          }, '×')
        ]));
      });
    }
    paint();

    UI.modal({
      title: isNew ? 'Yangi voronka' : 'Voronka: ' + f0.name,
      wide: true,
      body: [
        h('div', { class: 'form-grid' }, [nameF.wrap, srcF.wrap]),
        h('h3', { style: 'font-size:14px;margin:12px 0 6px' }, 'Bosqichlar'),
        box,
        h('button', {
          class: 'btn sm', type: 'button', style: 'margin-top:8px',
          onclick: function () {
            stages.splice(Math.max(0, stages.length - 2), 0,
              { id: 'st_' + Math.random().toString(36).slice(2, 7), label: 'Yangi bosqich' });
            paint();
          }
        }, 'Bosqich qo’shish')
      ],
      actions: [
        (!isNew && !f0.isDefault) ? {
          label: 'O’chirish', cls: 'danger', onClick: async function (c) {
            var used = D.all('leads').filter(function (l) { return l.funnelId === f0.id; }).length;
            if (used) { UI.toast('Bu voronkada ' + used + ' ta murojaat bor.', 'bad'); return; }
            if (await UI.confirm('Voronkani o’chirish', 'Voronka o’chiriladi.', 'O’chirish', true)) {
              await D.remove('funnels', f0.id);
              c(); UI.toast('O’chirildi.', 'ok'); App.render();
            }
          }
        } : null,
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            var nm = nameF.input.value.trim();
            if (!nm) { UI.toast('Voronka nomini yozing.', 'bad'); return; }
            UI.busy(btn, async function () {
              var rec = Object.assign({}, f0, {
                name: nm, autoSource: srcF.input.value.trim(),
                stages: stages.map(function (s, i) {
                  return { id: s.id || ('st' + i), label: s.label || ('Bosqich ' + (i + 1)), type: s.type };
                })
              });
              if (isNew) {
                rec.id = A.uid('fnl');
                rec.intakeKey = A.Seed.randKey();
              }
              if (!rec.intakeKey) rec.intakeKey = A.Seed.randKey();
              await D.save('funnels', rec);
              await A.Ops.audit(App.user, isNew ? 'Voronka yaratildi' : 'Voronka o’zgartirildi', rec.name, '');
              c(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  function intakeModal(funnel, App) {
    var url = intakeUrl(funnel);
    var ta = h('textarea', { readonly: true, style: 'width:100%;min-height:60px;font-family:var(--mono);font-size:12px' });
    ta.value = url;
    var example = h('pre', {
      class: 'receipt', style: 'white-space:pre-wrap;font-size:11.5px'
    }, 'POST ' + url + '\nContent-Type: application/json\n\n{\n  "name": "Zilola Karimova",\n  "phone": "+998901234567",\n  "text": "Instagram izohi: narxi qancha? 90 123 45 67",\n  "source": "Instagram"\n}');

    UI.modal({
      title: funnel.name + ' — murojaat qabul qilish',
      wide: true,
      body: [
        h('p', { style: 'margin:0' },
          'Shu havolaga yuborilgan har bir so’rov avtomatik ravishda "' + funnel.name +
          '" voronkasiga yangi murojaat bo’lib tushadi.'),
        ta,
        h('div', { class: 'banner info', style: 'margin:0' }, h('div', {}, [
          h('b', {}, 'Instagram va reklama bilan ulash. '),
          'Meta Lead Ads, Zapier, Make yoki n8n’da "Webhook" amalini tanlang va shu havolani qo’ying. ',
          'Izoh yoki xabar matnini ', h('b', {}, '"text"'), ' maydoniga yuboring — ichida telefon raqam bo’lsa, ',
          'tizim uni o’zi ajratib oladi va murojaat yaratadi.'
        ])),
        example,
        h('p', { class: 'small muted', style: 'margin:0' },
          'Havola faqat serverli versiyada ishlaydi. Kalitni hech kimga bermang — u orqali murojaat yozish mumkin.')
      ],
      actions: [
        {
          label: 'Yangi kalit yaratish', onClick: function (c, btn) {
            UI.busy(btn, async function () {
              var rec = A.clone(funnel);
              rec.intakeKey = A.Seed.randKey();
              await D.save('funnels', rec);
              c(); UI.toast('Yangi kalit yaratildi.', 'ok'); App.render();
            });
          }
        },
        {
          label: 'Nusxalash', cls: 'primary', onClick: function (c) {
            ta.select();
            try { document.execCommand('copy'); UI.toast('Nusxalandi.', 'ok'); } catch (e) { }
            c();
          }
        }
      ]
    });
  }

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

    /* --- Ruxsatlar --- */
    var perms = A.clone(u.perms || {});
    var permBox = h('div', { class: 'perm-grid' });
    function effective(pid) {
      if (Object.prototype.hasOwnProperty.call(perms, pid)) return perms[pid];
      return A.roleHas(f.get('role').input.value, pid);
    }
    function paintPerms() {
      UI.clear(permBox);
      A.PERM_GROUPS.forEach(function (grp) {
        permBox.appendChild(h('div', { class: 'perm-row', style: 'background:var(--brand-soft);font-weight:700' },
          h('div', { class: 'pname' }, grp.label)));
        grp.perms.forEach(function (p) {
          var on = effective(p.id);
          var custom = Object.prototype.hasOwnProperty.call(perms, p.id);
          var cb = h('input', { type: 'checkbox', checked: on ? true : null });
          cb.addEventListener('change', function () {
            perms[p.id] = cb.checked;
            paintPerms();
          });
          permBox.appendChild(h('div', { class: 'perm-row' }, [
            h('div', { class: 'pname' }, p.label),
            custom ? UI.pill('Alohida', 'info') : UI.pill('Rol bo’yicha', 'mute'),
            h('div', { class: 'popts' }, h('label', {}, [cb, h('span', {}, on ? 'Ruxsat bor' : 'Ruxsat yo’q')]))
          ]));
        });
      });
    }
    paintPerms();
    f.get('role').input.addEventListener('change', paintPerms);

    var permSection = h('details', { style: 'margin-top:4px' }, [
      h('summary', { style: 'cursor:pointer;font-weight:700;padding:10px 0' }, 'Ruxsatlarni sozlash'),
      h('div', { class: 'rowflex', style: 'margin-bottom:8px' }, [
        h('button', {
          class: 'btn sm', type: 'button', onclick: function () {
            A.allPermIds().forEach(function (pid) { perms[pid] = true; });
            paintPerms();
          }
        }, 'Hammasiga ruxsat berish'),
        h('button', {
          class: 'btn sm', type: 'button', onclick: function () { perms = {}; paintPerms(); }
        }, 'Rol bo’yicha qaytarish')
      ]),
      permBox
    ]);
    UI.modal({
      title: isNew ? 'Yangi foydalanuvchi' : 'Foydalanuvchi: ' + u.name,
      wide: true,
      body: [f.node, permSection],
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
                staffId: v.staffId || null, active: v.active === 'yes',
                perms: Object.keys(perms).length ? perms : null
              });
              if (isNew) { rec.id = A.uid('usr'); rec.createdAt = A.nowStamp(); }
              if (D.mode === 'server') {
                await D.saveUser(rec, v.password || '');
              } else {
                if (v.password) {
                  rec.salt = A.Seed.salt();
                  rec.hash = await A.Seed.mkHash(rec.login, v.password, rec.salt);
                  rec.isDefault = false;
                }
                await D.save('users', rec);
              }
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
