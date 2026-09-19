/* Albyana ERP — Bosh sahifa, Murojaatlar, O'quvchilar */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  A.Pages = A.Pages || {};

  /* ================= Umumiy so'rovlar ================= */
  var Q = {
    student: function (id) { return D.one('students', id); },
    studentName: function (id) {
      var s = D.one('students', id);
      return s ? (s.lastName + ' ' + s.firstName) : '—';
    },
    groupName: function (id) { var g = D.one('groups', id); return g ? g.name : '—'; },
    groupLabel: function (id) { return A.groupLabel(D.one('groups', id)); },
    groupByCode: function (code) {
      var c = String(code || '').trim().toUpperCase();
      return D.all('groups').filter(function (g) { return String(g.code || '').toUpperCase() === c; })[0] || null;
    },
    courseName: function (id) { var c = D.one('courses', id); return c ? c.name : '—'; },
    staffName: function (id) { var s = D.one('staff', id); return s ? s.name : '—'; },
    roomName: function (id) { var r = D.one('rooms', id); return r ? r.name : '—'; },
    membershipsOf: function (studentId) {
      return D.all('memberships').filter(function (m) { return m.studentId === studentId; });
    },
    membersOf: function (groupId) {
      return D.all('memberships').filter(function (m) { return m.groupId === groupId && m.status === 'faol'; });
    },
    balance: function (studentId) {
      return A.balanceOf(studentId, A.Fin.allInvoices(), A.Fin.allPayments());
    },
    overdue: function (studentId) {
      return A.overdueOf(studentId, A.Fin.allInvoices(), A.Fin.allPayments(), A.today());
    },
    openInvoices: function (studentId) {
      var paid = A.paidByInvoice(A.Fin.allPayments());
      return A.Fin.allInvoices()
        .filter(function (i) { return i.studentId === studentId; })
        .map(function (i) { return Object.assign({}, i, { remaining: A.invoiceRemaining(i, paid) }); })
        .filter(function (i) { return i.remaining > 0; })
        .sort(function (a, b) { return String(a.month).localeCompare(String(b.month)); });
    },
    activeGroups: function (user) {
      return A.scopeGroups(user, D.all('groups').filter(function (g) { return g.status !== 'yakunlangan'; }));
    },
    /** Berilgan kundagi barcha darslar */
    lessonsOn: function (dateIso, user) {
      var ym = A.ymOf(dateIso);
      var out = [];
      Q.activeGroups(user).forEach(function (g) {
        var doc = D.lessonsCached(g.id, ym);
        A.monthLessons(g, ym, doc).forEach(function (l) {
          if (l.date === dateIso) out.push(l);
        });
      });
      return A.sortBy(out, 'start');
    },
    async ensureLessonMonth(ym, user) {
      var gs = Q.activeGroups(user);
      for (var i = 0; i < gs.length; i++) { await D.loadLessons(gs[i].id, ym); }
    },
    debtors: function () {
      var invoices = A.Fin.allInvoices(), payments = A.Fin.allPayments();
      var paid = A.paidByInvoice(payments);
      var byStudent = {};
      invoices.forEach(function (inv) {
        var rem = A.invoiceRemaining(inv, paid);
        if (rem <= 0) return;
        var s = byStudent[inv.studentId] || (byStudent[inv.studentId] = { studentId: inv.studentId, debt: 0, overdue: 0, months: [] });
        s.debt += rem;
        if (inv.dueDate && inv.dueDate < A.today()) s.overdue += rem;
        s.months.push(inv.month);
      });
      return Object.keys(byStudent).map(function (k) { return byStudent[k]; })
        .filter(function (x) {
          var st = D.one('students', x.studentId);
          return st && st.status !== 'arxiv';
        });
    }
  };
  A.Q = Q;

  function statusPill(status) {
    if (status === 'faol') return UI.pill('Faol', 'ok');
    if (status === 'toxtatgan') return UI.pill('To’xtatgan', 'warn');
    if (status === 'arxiv') return UI.pill('Arxiv', 'mute');
    return UI.pill(status || '—', 'mute');
  }
  A.statusPill = statusPill;

  function balancePill(b, overdue) {
    if (b.debt > 0) return UI.pill((overdue > 0 ? 'Muddati o’tgan ' : 'Qarz ') + A.som(b.debt), overdue > 0 ? 'bad' : 'warn');
    if (b.advance > 0) return UI.pill('Avans ' + A.som(b.advance), 'info');
    return UI.pill('Qarzsiz', 'ok');
  }
  A.balancePill = balancePill;

  /* ================= BOSH SAHIFA ================= */
  A.Pages.dashboard = function (view, route, App) {
    var user = App.user;
    var ym = A.thisMonth(), today = A.today();
    view.appendChild(UI.pageHead(
      'Salom, ' + user.name.split(' ')[0] + '!',
      A.dateLabel(today) + ' · ' + (A.ROLES[user.role] || '')
    ));

    // Demo eslatmasi
    if (D.all('students').some(function (s) { return s.demo; }) && App.can('settings.edit')) {
      view.appendChild(h('div', { class: 'banner info' }, [
        h('div', {}, [h('b', {}, 'Namuna ma’lumotlar. '),
        'Tizim ishlashini ko’rsatish uchun demo o’quvchi, guruh va to’lovlar kiritilgan. Haqiqiy ish boshlashdan oldin ularni o’chiring.']),
        h('button', {
          class: 'btn sm', onclick: function () { App.go('settings', { tab: 'data' }); }
        }, 'Sozlamalarga o’tish')
      ]));
    }
    var defUser = D.all('users').some(function (u) { return u.isDefault; });
    if (defUser && user.role === 'direktor') {
      view.appendChild(h('div', { class: 'banner warn' }, [
        h('div', {}, [h('b', {}, 'Xavfsizlik. '), 'Standart parollar (1234) hali o’zgartirilmagan. Sozlamalar → Foydalanuvchilar bo’limida yangi parol qo’ying.']),
        h('button', { class: 'btn sm', onclick: function () { App.go('settings', { tab: 'users' }); } }, 'Ochish')
      ]));
    }

    var invoices = A.Fin.allInvoices(), payments = A.Fin.allPayments();
    var monthPays = A.activePayments(A.Fin.monthItems('payments', ym));
    var monthIncome = monthPays.reduce(function (s, p) { return s + (p.type === 'refund' ? -1 : 1) * p.amount; }, 0);
    var todayIncome = monthPays.filter(function (p) { return p.date === today; })
      .reduce(function (s, p) { return s + (p.type === 'refund' ? -1 : 1) * p.amount; }, 0);
    var monthExp = A.Fin.monthItems('expenses', ym).filter(function (e) { return !e.voided; })
      .reduce(function (s, e) { return s + e.amount; }, 0);
    var debtors = Q.debtors();
    var overdueTotal = debtors.reduce(function (s, d) { return s + d.overdue; }, 0);
    var activeStudents = D.all('students').filter(function (s) { return s.status === 'faol'; }).length;
    var activeGroups = D.all('groups').filter(function (g) { return g.status === 'faol'; }).length;
    var lessonsToday = Q.lessonsOn(today, user);

    var tiles = h('div', { class: 'tiles' });
    if (user.role === 'direktor' || user.role === 'buxgalter') {
      if (user.role === 'direktor') {
        tiles.appendChild(UI.tile({
          label: 'Faol o’quvchilar', value: activeStudents, hint: D.all('students').length + ' ta jami',
          onClick: function () { App.go('students', { status: 'faol' }); }
        }));
        tiles.appendChild(UI.tile({
          label: 'Faol guruhlar', value: activeGroups, hint: 'Bugun ' + lessonsToday.length + ' dars',
          onClick: function () { App.go('groups', { status: 'faol' }); }
        }));
      }
      tiles.appendChild(UI.tile({
        label: 'Bugungi tushum', value: A.som(todayIncome), hint: 'so’m', cls: 'money',
        onClick: function () { App.go('finance', { tab: 'payments', date: today }); }
      }));
      tiles.appendChild(UI.tile({
        label: A.monthLabel(ym) + ' tushumi', value: A.som(monthIncome), hint: 'so’m', cls: 'money',
        onClick: function () { App.go('finance', { tab: 'payments' }); }
      }));
      tiles.appendChild(UI.tile({
        label: 'Muddati o’tgan qarz', value: A.som(overdueTotal), hint: debtors.filter(function (d) { return d.overdue > 0; }).length + ' ta o’quvchi',
        cls: overdueTotal > 0 ? 'alert' : '',
        onClick: function () { App.go('finance', { tab: 'debts' }); }
      }));
      tiles.appendChild(UI.tile({
        label: 'Shu oydagi xarajat', value: A.som(monthExp), hint: 'so’m',
        onClick: function () { App.go('finance', { tab: 'expenses' }); }
      }));
    } else if (user.role === 'admin') {
      tiles.appendChild(UI.tile({
        label: 'Bugungi darslar', value: lessonsToday.length, hint: 'Jadvalni ochish',
        onClick: function () { App.go('schedule'); }
      }));
      var needCall = D.all('leads').filter(function (l) {
        return l.stage !== 'oquvchi' && l.stage !== 'rad' && (!l.nextContact || l.nextContact <= today);
      });
      tiles.appendChild(UI.tile({
        label: 'Bog’lanish kerak', value: needCall.length, hint: 'murojaat',
        cls: needCall.length ? 'alert' : '',
        onClick: function () { App.go('leads', { due: true }); }
      }));
      tiles.appendChild(UI.tile({
        label: 'To’lov kutilayotganlar', value: debtors.length, hint: A.som(debtors.reduce(function (s, d) { return s + d.debt; }, 0)) + ' so’m',
        cls: debtors.some(function (d) { return d.overdue > 0; }) ? 'alert' : '',
        onClick: function () { App.go('finance', { tab: 'debts' }); }
      }));
      tiles.appendChild(UI.tile({
        label: 'Faol o’quvchilar', value: activeStudents,
        onClick: function () { App.go('students', { status: 'faol' }); }
      }));
    } else {
      var myGroups = A.scopeGroups(user, D.all('groups'));
      tiles.appendChild(UI.tile({ label: 'Guruhlarim', value: myGroups.length, onClick: function () { App.go('groups'); } }));
      tiles.appendChild(UI.tile({ label: 'Bugungi darslarim', value: lessonsToday.length, onClick: function () { App.go('schedule'); } }));
      var myStudents = {};
      myGroups.forEach(function (g) { Q.membersOf(g.id).forEach(function (m) { myStudents[m.studentId] = 1; }); });
      tiles.appendChild(UI.tile({ label: 'O’quvchilarim', value: Object.keys(myStudents).length, onClick: function () { App.go('students'); } }));
    }
    view.appendChild(tiles);

    if (App.can('payment.create') || App.can('student.edit')) {
      view.appendChild(h('div', { class: 'rowflex', style: 'margin-bottom:16px' }, [
        App.can('student.edit') ? h('button', {
          class: 'btn primary', onclick: function () { A.studentForm(null, App); }
        }, [UI.icon('plus'), 'O’quvchi qo’shish']) : null,
        App.can('payment.create') ? h('button', {
          class: 'btn', onclick: function () { A.paymentForm(null, App); }
        }, [UI.icon('money'), 'To’lov qabul qilish']) : null,
        App.can('attendance.mark') ? h('button', {
          class: 'btn', onclick: function () { App.go('attendance'); }
        }, [UI.icon('check'), 'Davomat olish']) : null
      ]));
    }

    var cols = h('div', { class: 'grid cols-2' });

    // Bugungi darslar
    var lessonRows = lessonsToday.map(function (l) {
      var g = D.one('groups', l.groupId);
      var marked = l.attendance && Object.keys(l.attendance).length;
      return h('div', {
        class: 'list-item', onclick: function () { App.go('attendance', { groupId: l.groupId, date: l.date }); }
      }, [
        h('div', { class: 'avatar mono', style: 'width:52px;font-size:12px' }, l.start),
        h('div', { class: 'main-col' }, [
          h('b', {}, g ? g.name : '—'),
          h('span', {}, Q.staffName(l.teacherId) + ' · ' + Q.roomName(l.roomId) + ' · ' + l.start + '–' + l.end)
        ]),
        l.status === 'bekor' ? UI.pill('Bekor', 'mute') : (marked ? UI.pill('Davomat olingan', 'ok') : UI.pill('Davomat kutilmoqda', 'warn'))
      ]);
    });
    cols.appendChild(UI.card('Bugungi darslar',
      lessonsToday.length ? h('div', { class: 'list' }, lessonRows)
        : UI.empty({ title: 'Bugun dars yo’q', text: 'Jadvalga qarang yoki yangi guruh oching.' }),
      [h('button', { class: 'btn sm ghost', onclick: function () { App.go('schedule'); } }, 'Jadval')], true));

    // E'tibor talab qiladigan ishlar
    var tasks = [];
    var unmarked = [];
    Q.activeGroups(user).forEach(function (g) {
      var doc = D.lessonsCached(g.id, ym);
      A.monthLessons(g, ym, doc).forEach(function (l) {
        if (l.date >= today) return;
        if (l.status === 'bekor') return;
        if (l.attendance && Object.keys(l.attendance).length) return;
        unmarked.push(l);
      });
    });
    if (unmarked.length) {
      tasks.push({
        label: unmarked.length + ' ta darsda davomat olinmagan',
        cls: 'warn',
        go: function () { App.go('attendance', { groupId: unmarked[0].groupId, date: unmarked[0].date }); }
      });
    }
    if (App.can('finance.debts') && overdueTotal > 0) {
      tasks.push({
        label: 'Muddati o’tgan qarz: ' + A.somFull(overdueTotal),
        cls: 'bad', go: function () { App.go('finance', { tab: 'debts' }); }
      });
    }
    if (App.can('invoice.create')) {
      var monthInv = A.Fin.monthItems('invoices', ym).length;
      var expected = D.all('memberships').filter(function (m) { return m.status === 'faol' && A.membershipActiveIn(m, ym); }).length;
      if (expected > monthInv) {
        tasks.push({
          label: A.monthLabel(ym) + ' uchun ' + (expected - monthInv) + ' ta hisob yaratilmagan',
          cls: 'warn', go: function () { App.go('finance', { tab: 'invoices' }); }
        });
      }
    }
    var noTeacher = D.all('groups').filter(function (g) { return g.status === 'faol' && !g.teacherId; });
    if (noTeacher.length && App.can('group.edit')) {
      tasks.push({ label: noTeacher.length + ' ta guruhga o’qituvchi biriktirilmagan', cls: 'warn', go: function () { App.go('groups'); } });
    }
    var leadsDue = D.all('leads').filter(function (l) {
      return l.stage !== 'oquvchi' && l.stage !== 'rad' && l.nextContact && l.nextContact <= today;
    });
    if (leadsDue.length && App.can('nav.leads')) {
      tasks.push({ label: leadsDue.length + ' ta murojaatga bugun bog’lanish kerak', cls: 'info', go: function () { App.go('leads', { due: true }); } });
    }

    cols.appendChild(UI.card('E’tibor talab qiladi',
      tasks.length ? h('div', { class: 'list' }, tasks.map(function (t) {
        return h('div', { class: 'list-item', onclick: t.go }, [
          UI.pill('!', t.cls),
          h('div', { class: 'main-col' }, h('b', {}, t.label))
        ]);
      })) : UI.empty({ title: 'Hammasi joyida', text: 'Hozircha kechiktirilgan ish yo’q.' }),
      null, true));

    view.appendChild(cols);
  };

  /* ================= MUROJAATLAR ================= */
  A.Pages.leads = function (view, route, App) {
    App.guard('nav.leads');
    var today = A.today();
    var funnels = A.sortBy(D.all('funnels'), 'order');
    if (!funnels.length) funnels = A.DEFAULT_FUNNELS;
    var funnelId = route.funnelId || (funnels[0] && funnels[0].id);
    var funnel = funnels.filter(function (f) { return f.id === funnelId; })[0] || funnels[0];
    var stages = A.funnelStages(funnel);
    var stageFilter = route.stage || 'all';

    var allLeads = D.all('leads');
    function inFunnel(l) {
      return (l.funnelId || 'fnl_asosiy') === funnel.id;
    }
    var leads = allLeads.filter(inFunnel);
    if (route.due) leads = leads.filter(function (l) {
      return !isClosed(funnel, l.stage) && l.nextContact && l.nextContact <= today;
    });
    if (stageFilter !== 'all') leads = leads.filter(function (l) { return l.stage === stageFilter; });
    leads = A.sortBy(leads, 'createdAt', 'desc');

    view.appendChild(UI.pageHead('Murojaatlar', 'Yangi mijozlarni bog’lanishdan o’quvchiga aylanguncha kuzating', [
      App.can('lead.edit') ? h('button', { class: 'btn primary', onclick: function () { leadForm(null, App, funnel.id); } },
        [UI.icon('plus'), 'Murojaat qo’shish']) : null,
      App.can('lead.import') ? h('button', { class: 'btn', onclick: function () { A.importModal('leads', App, funnel.id); } },
        [UI.icon('upload'), 'Excel’dan import']) : null,
      h('button', {
        class: 'btn', onclick: function () {
          UI.exportCsv('murojaatlar-' + funnel.name + '.csv',
            [['Ism', 'Telefon', 'Kurs', 'Manba', 'Voronka', 'Holat', 'Keyingi aloqa', 'Izoh']].concat(
              leads.map(function (l) {
                return [l.name, l.phone, Q.courseName(l.courseId), l.source, funnel.name,
                A.stageOf(funnel, l.stage).label, l.nextContact || '', l.note || ''];
              })));
        }
      }, [UI.icon('down'), 'Excel'])
    ]));

    // Voronkalar
    view.appendChild(UI.tabs(funnels.map(function (f) {
      var n = allLeads.filter(function (l) { return (l.funnelId || 'fnl_asosiy') === f.id; }).length;
      return { id: f.id, label: f.name + ' (' + n + ')' };
    }), funnel.id, function (id) { App.go('leads', { funnelId: id }); }));

    var counts = {};
    stages.forEach(function (s) {
      counts[s.id] = allLeads.filter(function (l) { return inFunnel(l) && l.stage === s.id; }).length;
    });
    var segs = h('div', { class: 'filters' }, [
      h('div', { class: 'seg' }, [{ id: 'all', label: 'Barchasi (' + allLeads.filter(inFunnel).length + ')' }]
        .concat(stages.map(function (s) { return { id: s.id, label: s.label + ' (' + counts[s.id] + ')' }; }))
        .map(function (s) {
          return h('button', {
            type: 'button', 'aria-pressed': stageFilter === s.id ? 'true' : 'false',
            onclick: function () { App.go('leads', { funnelId: funnel.id, stage: s.id }); }
          }, s.label);
        })),
      route.due ? h('button', { class: 'btn sm', onclick: function () { App.go('leads', { funnelId: funnel.id }); } }, 'Filtrni olib tashlash') : null
    ]);
    view.appendChild(segs);

    if (!leads.length) {
      view.appendChild(UI.card(null, UI.empty({
        title: 'Murojaat yo’q',
        text: 'Telefon qilgan yoki yozgan har bir mijozni shu yerga qo’shing — keyin uni bir bosishda o’quvchiga aylantirasiz.',
        action: App.can('lead.edit') ? { label: 'Murojaat qo’shish', onClick: function () { leadForm(null, App, funnel.id); } } : null
      })));
      return;
    }

    view.appendChild(UI.card(null, UI.table([
      { label: 'Ism', render: function (l) { return h('b', {}, l.name); } },
      { label: 'Telefon', render: function (l) { return h('span', { class: 'mono' }, l.phone); } },
      { label: 'Kurs', render: function (l) { return Q.courseName(l.courseId); } },
      { label: 'Manba', key: 'source' },
      { label: 'Mas’ul', render: function (l) { return Q.staffName(l.ownerStaffId); } },
      {
        label: 'Keyingi aloqa', render: function (l) {
          if (!l.nextContact) return h('span', { class: 'muted' }, '—');
          var late = l.nextContact <= today && !isClosed(funnel, l.stage);
          return h('span', { class: late ? 'pill bad' : 'mono' }, A.dateLabel(l.nextContact));
        }
      },
      { label: 'Holat', render: function (l) { return stagePill(l.stage, funnel); } },
      {
        label: '', right: true, render: function (l) {
          if (!App.can('lead.edit')) return '';
          return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
            A.stageOf(funnel, l.stage).type !== 'won' ? h('button', {
              class: 'btn sm primary', onclick: function (e) { e.stopPropagation(); convertLead(l, App); }
            }, 'O’quvchiga') : null,
            h('button', { class: 'btn sm', onclick: function (e) { e.stopPropagation(); leadForm(l, App); } }, 'Ochish')
          ]);
        }
      }
    ], leads, { onRow: function (l) { if (App.can('lead.edit')) leadForm(l, App); } }), null, null, true));
  };

  function isClosed(funnel, stageId) {
    var t = A.stageOf(funnel, stageId).type;
    return t === 'won' || t === 'lost';
  }

  function stageLabel(id, funnel) {
    if (funnel) return A.stageOf(funnel, id).label;
    var s = A.LEAD_STAGES.filter(function (x) { return x.id === id; })[0];
    return s ? s.label : id;
  }
  function stagePill(id, funnel) {
    var st = funnel ? A.stageOf(funnel, id) : { id: id };
    var cls = st.type === 'won' ? 'ok' : (st.type === 'lost' ? 'mute'
      : ({ yangi: 'info', boglanildi: 'warn', sinov: 'warn', qiziqdi: 'warn', oquvchi: 'ok', rad: 'mute' }[id] || 'info'));
    return UI.pill(stageLabel(id, funnel), cls);
  }

  function leadForm(lead, App, defFunnelId) {
    App.guard('lead.edit');
    var isNew = !lead;
    var funnels = A.sortBy(D.all('funnels'), 'order');
    if (!funnels.length) funnels = A.DEFAULT_FUNNELS;
    lead = lead || {
      stage: 'yangi', createdAt: A.nowStamp(), nextContact: A.today(),
      funnelId: defFunnelId || funnels[0].id
    };
    var curFunnel = funnels.filter(function (x) { return x.id === (lead.funnelId || funnels[0].id); })[0] || funnels[0];
    var f = UI.form([
      {
        name: 'funnelId', label: 'Sotuv voronkasi', type: 'select', value: lead.funnelId || curFunnel.id,
        options: funnels.map(function (x) { return { value: x.id, label: x.name }; }),
        onchange: function (e) {
          var fn = funnels.filter(function (x) { return x.id === e.target.value; })[0];
          var sel = f.get('stage').input;
          UI.clear(sel);
          A.funnelStages(fn).forEach(function (s) {
            sel.appendChild(h('option', { value: s.id }, s.label));
          });
        }
      },
      { name: 'name', label: 'Ism', required: true, value: lead.name },
      {
        name: 'phone', label: 'Telefon', required: true, value: lead.phone, placeholder: '+998 90 123 45 67',
        validate: function (v) { return A.phoneDigits(v).length < 7 ? 'Telefon raqamni to’liq kiriting.' : null; }
      },
      {
        name: 'courseId', label: 'Qiziqqan kurs', type: 'select', value: lead.courseId,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(D.all('courses').map(function (c) { return { value: c.id, label: c.name }; }))
      },
      {
        name: 'source', label: 'Qayerdan kelgan', type: 'select', value: lead.source,
        options: ['Instagram', 'Telegram', 'Tanish orqali', 'Banner', 'Yo’l-yo’lakay', 'Boshqa'].map(function (s) { return { value: s, label: s }; })
      },
      {
        name: 'ownerStaffId', label: 'Mas’ul administrator', type: 'select', value: lead.ownerStaffId,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(D.all('staff').filter(function (s) { return s.status === 'faol'; })
          .map(function (s) { return { value: s.id, label: s.name }; }))
      },
      { name: 'nextContact', label: 'Keyingi bog’lanish sanasi', type: 'date', value: lead.nextContact },
      {
        name: 'stage', label: 'Holat', type: 'select', value: lead.stage,
        options: A.funnelStages(curFunnel).map(function (s) { return { value: s.id, label: s.label }; })
      },
      { name: 'note', label: 'Izoh', type: 'textarea', value: lead.note, full: true }
    ]);

    var dupBox = h('div');
    function checkDup() {
      UI.clear(dupBox);
      var d = A.phoneDigits(f.get('phone').input.value);
      if (d.length < 7) return;
      var sameStudents = D.all('students').filter(function (s) {
        return A.phoneDigits(s.phone) === d || A.phoneDigits(s.parentPhone) === d;
      });
      var sameLeads = D.all('leads').filter(function (l) { return l.id !== lead.id && A.phoneDigits(l.phone) === d; });
      if (sameStudents.length || sameLeads.length) {
        dupBox.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, [
          h('b', {}, 'Bu raqam allaqachon bor: '),
          sameStudents.map(function (s) { return s.lastName + ' ' + s.firstName; }).concat(
            sameLeads.map(function (l) { return l.name + ' (murojaat)'; })).join(', '),
          '. Bir oiladagi bolalar uchun bir xil raqam bo’lishi mumkin — davom etaverishingiz mumkin.'
        ])));
      }
    }
    f.get('phone').input.addEventListener('blur', checkDup);
    checkDup();

    var m = UI.modal({
      title: isNew ? 'Yangi murojaat' : 'Murojaat: ' + lead.name,
      body: [f.node, dupBox],
      actions: [
        !isNew && App.can('lead.edit') ? {
          label: 'O’chirish', cls: 'danger', onClick: async function (c) {
            if (await UI.confirm('Murojaatni o’chirish', 'Bu yozuv butunlay o’chiriladi.', 'O’chirish', true)) {
              await D.remove('leads', lead.id);
              await A.Ops.audit(App.user, 'Murojaat o’chirildi', lead.name, '');
              c(); UI.toast('O’chirildi.', 'ok'); App.render();
            }
          }
        } : null,
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              var v = f.values();
              var rec = Object.assign({}, lead, v, { phone: A.normPhone(v.phone) });
              if (isNew) { rec.id = A.uid('led'); rec.createdAt = A.nowStamp(); }
              await D.save('leads', rec);
              var fn = funnels.filter(function (x) { return x.id === rec.funnelId; })[0];
              await A.Ops.audit(App.user, isNew ? 'Murojaat qo’shildi' : 'Murojaat o’zgartirildi',
                rec.name, stageLabel(rec.stage, fn));
              c(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
    void m;
  }

  async function convertLead(lead, App) {
    // murojaatni o'quvchiga aylantirish
    App.guard('student.edit');
    A.studentForm({
      firstName: (lead.name || '').split(' ')[1] || lead.name,
      lastName: (lead.name || '').split(' ')[0] || '',
      phone: lead.phone,
      parentName: '', parentPhone: lead.phone,
      note: 'Murojaatdan: ' + (lead.source || '') + (lead.note ? ' · ' + lead.note : ''),
      _fromLead: lead,
      _courseId: lead.courseId
    }, App);
  }

  /* ================= O'QUVCHILAR ================= */
  A.Pages.students = function (view, route, App) {
    App.guard('student.view');
    var user = App.user;
    var all = D.all('students');
    if (user.role === 'oqituvchi') {
      var mine = {};
      A.scopeGroups(user, D.all('groups')).forEach(function (g) {
        Q.membersOf(g.id).forEach(function (m) { mine[m.studentId] = 1; });
      });
      all = all.filter(function (s) { return mine[s.id]; });
    }
    var q = (route.q || '').trim().toLowerCase();
    var status = route.status || 'all';
    var groupId = route.groupId || '';
    var list = all.filter(function (s) {
      if (status !== 'all' && s.status !== status) return false;
      if (groupId && !Q.membershipsOf(s.id).some(function (m) { return m.groupId === groupId && m.status === 'faol'; })) return false;
      if (q) {
        var hay = (s.lastName + ' ' + s.firstName + ' ' + s.phone + ' ' + (s.parentName || '') + ' ' + (s.parentPhone || '')).toLowerCase();
        if (hay.indexOf(q) < 0 && A.phoneDigits(s.phone).indexOf(A.phoneDigits(q)) < 0) return false;
      }
      return true;
    });
    list = A.sortBy(list, function (s) { return s.lastName + ' ' + s.firstName; });

    view.appendChild(UI.pageHead('O’quvchilar', list.length + ' ta ko’rsatilmoqda', [
      App.can('student.edit') ? h('button', { class: 'btn primary', onclick: function () { A.studentForm(null, App); } },
        [UI.icon('plus'), 'O’quvchi qo’shish']) : null,
      App.can('student.import') ? h('button', { class: 'btn', onclick: function () { A.importModal('students', App); } },
        [UI.icon('upload'), 'Excel’dan import']) : null,
      h('button', {
        class: 'btn', onclick: function () {
          UI.exportCsv('oquvchilar.csv', [['Familiya', 'Ism', 'Telefon', 'Ota-ona', 'Ota-ona telefoni', 'Guruhlar', 'Holat', 'Qarz', 'Avans']].concat(
            list.map(function (s) {
              var b = Q.balance(s.id);
              return [s.lastName, s.firstName, s.phone, s.parentName || '', s.parentPhone || '',
              Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; }).map(function (m) { return Q.groupName(m.groupId); }).join(', '),
              s.status, b.debt, b.advance];
            })));
        }
      }, [UI.icon('down'), 'Excel'])
    ]));

    var fq = UI.field({ label: 'Qidiruv', value: route.q || '', placeholder: 'Ism yoki telefon' });
    var fst = UI.field({
      label: 'Holat', type: 'select', value: status,
      options: [{ value: 'all', label: 'Barchasi' }, { value: 'faol', label: 'Faol' },
      { value: 'toxtatgan', label: 'Vaqtincha to’xtatgan' }, { value: 'arxiv', label: 'Arxivlangan' }]
    });
    var fg = UI.field({
      label: 'Guruh', type: 'select', value: groupId,
      options: [{ value: '', label: 'Barchasi' }].concat(A.scopeGroups(user, D.all('groups')).map(function (g) { return { value: g.id, label: g.name }; }))
    });
    function apply() {
      App.go('students', { q: fq.input.value, status: fst.input.value, groupId: fg.input.value, live: true });
    }
    var typeTimer = null;
    fq.input.addEventListener('input', function () {
      clearTimeout(typeTimer);
      typeTimer = setTimeout(apply, 220);      // har harfda ro'yxat filtrlanadi
    });
    fst.input.addEventListener('change', apply);
    fg.input.addEventListener('change', apply);
    view.appendChild(h('div', { class: 'filters' }, [fq.wrap, fst.wrap, fg.wrap,
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn sm', onclick: function () { App.go('students', {}); } }, 'Tozalash')]));

    // yozayotganda maydon fokusda qolsin
    if (route.live) {
      setTimeout(function () {
        try {
          fq.input.focus();
          var v = fq.input.value;
          fq.input.setSelectionRange(v.length, v.length);
        } catch (e) { }
      }, 0);
    }
    // takliflar ro'yxati
    UI.suggest(fq.input, function (q) {
      if (!q) return [];
      return (App.searchAll ? App.searchAll(q) : []).filter(function (r) {
        return r.group === 'O’quvchilar' || r.group === 'Guruhlar';
      });
    }, { limit: 12 });

    if (!list.length) {
      view.appendChild(UI.card(null, UI.empty({
        title: 'O’quvchi topilmadi',
        text: q || groupId || status !== 'all' ? 'Filtrni o’zgartirib ko’ring.' : 'Birinchi o’quvchini qo’shing — keyin uni guruhga yozasiz va to’lov qabul qilasiz.',
        action: App.can('student.edit') ? { label: 'O’quvchi qo’shish', onClick: function () { A.studentForm(null, App); } } : null
      })));
      return;
    }

    var showMoney = App.can('finance.debts') || App.can('payment.create');
    var cols = [
      {
        label: 'O’quvchi', render: function (s) {
          return h('div', { class: 'rowflex', style: 'gap:9px;flex-wrap:nowrap' }, [
            UI.avatar(s.lastName + ' ' + s.firstName),
            h('div', {}, [h('b', {}, s.lastName + ' ' + s.firstName),
            h('div', { class: 'small muted mono' }, s.phone || '—')])
          ]);
        }
      },
      {
        label: 'Guruhlar', render: function (s) {
          var gs = Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; });
          if (!gs.length) return h('span', { class: 'muted' }, 'Guruhsiz');
          return h('div', { class: 'rowflex', style: 'gap:4px' }, gs.map(function (m) { return UI.pill(Q.groupName(m.groupId), 'mute'); }));
        }
      },
      { label: 'Ota-ona', render: function (s) { return h('div', {}, [h('div', {}, s.parentName || '—'), h('div', { class: 'small muted mono' }, s.parentPhone || '')]); } },
      { label: 'Holat', render: function (s) { return statusPill(s.status); } }
    ];
    if (showMoney) {
      cols.push({
        label: 'Hisob', right: true, render: function (s) {
          return balancePill(Q.balance(s.id), Q.overdue(s.id));
        }
      });
    }
    view.appendChild(UI.card(null, UI.table(cols, list, {
      onRow: function (s) { App.go('student', { id: s.id }); }
    }), null, null, true));
  };

  /* ================= O'QUVCHI KARTASI ================= */
  /** O'quvchining keyingi darsi: bugundan boshlab 30 kun ichida */
  function nextLessonOf(studentId) {
    var mems = Q.membershipsOf(studentId).filter(function (m) { return m.status === 'faol'; });
    var today = A.today();
    var best = null;
    mems.forEach(function (m) {
      var g = D.one('groups', m.groupId);
      if (!g) return;
      var months = [A.thisMonth(), A.addMonths(A.thisMonth(), 1)];
      months.forEach(function (ym) {
        var doc = D.lessonsCached(g.id, ym);
        A.monthLessons(g, ym, doc).forEach(function (l) {
          if (l.canceled) return;
          if (l.date < today) return;
          if (!best || l.date < best.date || (l.date === best.date && l.start < best.start)) {
            best = { date: l.date, start: l.start, end: l.end, group: g };
          }
        });
      });
    });
    return best;
  }

  /** O'quvchi kartasining tepasidagi tezkor bo'lim */
  function quickCard(s, bal, over, App) {
    var mems = Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; });
    var next = nextLessonOf(s.id);
    var phone = s.phone || s.parentPhone || '';

    var money = bal.debt > 0
      ? h('div', { class: 'q-money bad' }, [
          h('span', {}, over > 0 ? 'Muddati o’tgan qarz' : 'Qarz'),
          h('b', {}, A.som(bal.debt) + ' so’m')
        ])
      : (bal.advance > 0
        ? h('div', { class: 'q-money ok' }, [h('span', {}, 'Avans'), h('b', {}, A.som(bal.advance) + ' so’m')])
        : h('div', { class: 'q-money ok' }, [h('span', {}, 'Qarz'), h('b', {}, 'Yo’q')]));

    var lines = h('div', { class: 'q-lines' }, [
      h('div', {}, [
        h('span', { class: 'muted small' }, 'Faol guruhlar: '),
        mems.length
          ? h('b', {}, mems.map(function (m) { return Q.groupLabel(m.groupId); }).join(', '))
          : h('span', { class: 'muted' }, 'yo’q')
      ]),
      h('div', {}, [
        h('span', { class: 'muted small' }, 'Keyingi dars: '),
        next
          ? h('b', {}, A.dateLabel(next.date) + ' · ' + next.start + '–' + next.end + ' · ' + A.groupLabel(next.group))
          : h('span', { class: 'muted' }, 'rejada yo’q')
      ]),
      h('div', {}, [
        h('span', { class: 'muted small' }, 'Telefon: '),
        phone ? h('a', { href: 'tel:' + phone.replace(/\s/g, ''), class: 'mono' }, phone)
          : h('span', { class: 'muted' }, 'kiritilmagan')
      ])
    ]);

    var canApply = bal.advance > 0 && Q.openInvoices(s.id).length > 0;
    var actions = h('div', { class: 'q-actions' }, [
      App.can('payment.create') ? h('button', {
        class: 'btn primary', onclick: function () { A.paymentForm(s.id, App); }
      }, [UI.icon('money'), 'To’lov']) : null,
      (canApply && App.can('payment.create')) ? h('button', {
        class: 'btn', onclick: function () { A.advanceModal(s.id, App); }
      }, 'Avansdan qoplash') : null,
      App.can('student.edit') ? h('button', {
        class: 'btn', onclick: function () { A.membershipForm(s, null, App); }
      }, [UI.icon('plus'), 'Guruhga yozish']) : null,
      phone ? h('a', {
        class: 'btn', href: 'tel:' + phone.replace(/\s/g, '')
      }, [UI.icon('phone'), 'Qo’ng’iroq qilish']) : null
    ]);

    return h('section', { class: 'card quick-card' }, [
      h('div', { class: 'q-top' }, [money, lines]),
      actions
    ]);
  }

  A.Pages.student = function (view, route, App) {
    App.guard('student.view');
    var s = D.one('students', route.id);
    if (!s) { view.appendChild(UI.empty({ title: 'O’quvchi topilmadi' })); return; }
    var tab = route.tab || 'umumiy';
    var bal = Q.balance(s.id);
    var over = Q.overdue(s.id);

    view.appendChild(h('button', { class: 'btn ghost sm', style: 'margin-bottom:8px', onclick: function () { App.go('students'); } },
      [UI.icon('back'), 'O’quvchilar']));

    view.appendChild(UI.pageHead(s.lastName + ' ' + s.firstName,
      (s.phone || '') + (s.parentName ? ' · Ota-ona: ' + s.parentName + ' ' + (s.parentPhone || '') : ''),
      [
        // Asosiy amallar pastdagi tezkor kartada — bu yerda faqat tahrirlash
        App.can('student.edit') ? h('button', { class: 'btn', onclick: function () { A.studentForm(s, App); } },
          [UI.icon('edit'), 'Tahrirlash']) : null
      ]));

    /* --- Tezkor karta: eng kerakli ma'lumot va uchta amal --- */
    view.appendChild(quickCard(s, bal, over, App));

    var tiles = h('div', { class: 'tiles' });
    tiles.appendChild(UI.tile({ label: 'Holat', value: s.status === 'faol' ? 'Faol' : (s.status === 'toxtatgan' ? 'To’xtatgan' : 'Arxiv') }));
    tiles.appendChild(UI.tile({ label: 'Faol guruhlar', value: Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; }).length }));
    if (App.can('finance.debts') || App.can('payment.create')) {
      tiles.appendChild(UI.tile({ label: 'Hisoblangan', value: A.som(bal.charged), hint: 'so’m' }));
      tiles.appendChild(UI.tile({ label: 'To’langan', value: A.som(bal.received), hint: 'so’m', cls: 'money' }));
      tiles.appendChild(UI.tile({
        label: bal.advance > 0 ? 'Avans' : 'Qarz', value: A.som(bal.advance > 0 ? bal.advance : bal.debt),
        hint: over > 0 ? 'Muddati o’tgan: ' + A.som(over) : 'so’m', cls: bal.debt > 0 && over > 0 ? 'alert' : ''
      }));
    }
    view.appendChild(tiles);

    var tabItems = [
      { id: 'umumiy', label: 'Umumiy' },
      { id: 'guruhlar', label: 'Guruhlar' },
      { id: 'davomat', label: 'Davomat' }
    ];
    if (App.can('finance.debts') || App.can('payment.create')) {
      tabItems.push({ id: 'hisoblar', label: 'Hisoblangan to’lovlar' });
      tabItems.push({ id: 'tolovlar', label: 'To’lovlar tarixi' });
    }
    view.appendChild(UI.tabs(tabItems, tab, function (id) { App.go('student', { id: s.id, tab: id }); }));

    if (tab === 'umumiy') {
      var dl = h('dl', { class: 'kv' });
      [['Familiya, ism', s.lastName + ' ' + s.firstName],
      ['Telefon', s.phone || '—'],
      ['Ota-ona / vasiy', s.parentName || '—'],
      ['Ota-ona telefoni', s.parentPhone || '—'],
      ['Tug’ilgan sana', s.birthDate ? A.dateLabel(s.birthDate) : '—'],
      ['Qo’shilgan', s.createdAt || '—'],
      ['Izoh', s.note || '—']].forEach(function (r) {
        dl.appendChild(h('dt', {}, r[0]));
        dl.appendChild(h('dd', {}, r[1]));
      });
      var actions = h('div', { class: 'rowflex', style: 'margin-top:14px' }, [
        App.can('student.edit') && s.status !== 'arxiv' ? h('button', {
          class: 'btn', onclick: async function () {
            var next = s.status === 'faol' ? 'toxtatgan' : 'faol';
            if (await UI.confirm(next === 'faol' ? 'Qayta faollashtirish' : 'Vaqtincha to’xtatish',
              next === 'faol' ? 'O’quvchi yana faol bo’ladi.' : 'O’quvchi vaqtincha to’xtatiladi. Hisoblari saqlanadi.')) {
              s.status = next; await D.save('students', s);
              await A.Ops.audit(App.user, 'O’quvchi holati o’zgardi', Q.studentName(s.id), next);
              UI.toast('Saqlandi.', 'ok'); App.render();
            }
          }
        }, s.status === 'faol' ? 'Vaqtincha to’xtatish' : 'Qayta faollashtirish') : null,
        App.can('student.edit') ? h('button', {
          class: 'btn danger', onclick: async function () {
            if (s.status === 'arxiv') {
              s.status = 'faol'; await D.save('students', s); UI.toast('Arxivdan qaytarildi.', 'ok'); App.render(); return;
            }
            if (await UI.confirm('Arxivlash', 'O’quvchi arxivga o’tadi. Davomat va hisob-kitoblar saqlanib qoladi.', 'Arxivlash', true)) {
              s.status = 'arxiv';
              await D.save('students', s);
              var mems = Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; });
              for (var i = 0; i < mems.length; i++) {
                mems[i].status = 'chiqgan'; mems[i].leftAt = A.today();
                await D.save('memberships', mems[i]);
              }
              await A.Ops.audit(App.user, 'O’quvchi arxivlandi', Q.studentName(s.id), '');
              UI.toast('Arxivlandi.', 'ok'); App.render();
            }
          }
        }, s.status === 'arxiv' ? 'Arxivdan qaytarish' : 'Arxivlash') : null
      ]);
      view.appendChild(UI.card('Umumiy ma’lumot', [dl, actions]));
    }

    if (tab === 'guruhlar') {
      var mems = Q.membershipsOf(s.id);
      view.appendChild(UI.card('Guruhlar',
        mems.length ? UI.table([
          { label: 'Guruh', render: function (m) { return h('b', {}, Q.groupName(m.groupId)); } },
          { label: 'Kurs', render: function (m) { var g = D.one('groups', m.groupId); return g ? Q.courseName(g.courseId) : '—'; } },
          { label: 'Kirgan', render: function (m) { return A.dateLabel(m.joinedAt); } },
          { label: 'Chiqqan', render: function (m) { return m.leftAt ? A.dateLabel(m.leftAt) : '—'; } },
          {
            label: 'Chegirma', render: function (m) {
              if (!m.discount || !m.discount.value) return h('span', { class: 'muted' }, '—');
              return UI.pill(m.discount.type === 'percent' ? m.discount.value + '%' : A.som(m.discount.value) + ' so’m', 'info');
            }
          },
          { label: 'Holat', render: function (m) { return m.status === 'faol' ? UI.pill('Faol', 'ok') : UI.pill('Chiqqan', 'mute'); } },
          {
            label: '', right: true, render: function (m) {
              if (!App.can('student.edit')) return '';
              return h('button', { class: 'btn sm', onclick: function () { A.membershipForm(s, m, App); } }, 'Ochish');
            }
          }
        ], mems) : UI.empty({
          title: 'Guruhga yozilmagan',
          text: 'O’quvchini guruhga yozing — shundan keyin unga oylik hisob yaratiladi.',
          action: App.can('student.edit') ? { label: 'Guruhga yozish', onClick: function () { A.membershipForm(s, null, App); } } : null
        }), null, null, true));
    }

    if (tab === 'davomat') {
      var rows = [];
      Q.membershipsOf(s.id).forEach(function (m) {
        var g = D.one('groups', m.groupId);
        if (!g) return;
        var months = {};
        Object.keys(D.docs).forEach(function (p) {
          if (p.indexOf('lessons/' + g.id + '__') === 0) months[p.split('__')[1]] = 1;
        });
        months[A.thisMonth()] = 1;
        Object.keys(months).forEach(function (ym) {
          var doc = D.lessonsCached(g.id, ym);
          A.monthLessons(g, ym, doc).forEach(function (l) {
            if (!l.attendance || !l.attendance[m.id]) return;
            rows.push({ date: l.date, group: g.name, status: l.attendance[m.id].status });
          });
        });
      });
      rows = A.sortBy(rows, 'date', 'desc');
      var st = A.attendanceStats(rows);
      view.appendChild(UI.card('Davomat', [
        h('div', { class: 'rowflex', style: 'margin-bottom:12px' }, [
          UI.pill('Keldi: ' + st.keldi, 'ok'), UI.pill('Kelmadi: ' + st.kelmadi, 'bad'),
          UI.pill('Kechikdi: ' + st.kechikdi, 'warn'), UI.pill('Sababli: ' + st.sababli, 'info')
        ]),
        rows.length ? UI.table([
          { label: 'Sana', render: function (r) { return A.dateLabel(r.date); } },
          { label: 'Guruh', key: 'group' },
          { label: 'Belgi', render: function (r) { var a = A.ATT[r.status]; return UI.pill(a ? a.label : r.status, a ? a.cls : 'mute'); } }
        ], rows.slice(0, 60)) : h('p', { class: 'muted' }, 'Hali davomat yozuvi yo’q.')
      ]));
    }

    if (tab === 'hisoblar') {
      var paidMap = A.paidByInvoice(A.Fin.allPayments());
      var invs = A.sortBy(A.Fin.allInvoices().filter(function (i) { return i.studentId === s.id; }), 'month', 'desc');
      view.appendChild(UI.card('Hisoblangan o’quv to’lovlari',
        invs.length ? UI.table([
          { label: 'Oy', render: function (i) { return A.monthLabel(i.month); } },
          { label: 'Guruh', render: function (i) { return Q.groupName(i.groupId); } },
          { label: 'Asos', right: true, render: function (i) { return h('span', { class: 'mono' }, A.som(i.base)); } },
          { label: 'Chegirma', right: true, render: function (i) { return h('span', { class: 'mono' }, i.discount ? '−' + A.som(i.discount) : '—'); } },
          { label: 'Hisob', right: true, render: function (i) { return h('span', { class: 'mono strong' }, A.som(i.final)); } },
          { label: 'To’langan', right: true, render: function (i) { return h('span', { class: 'mono' }, A.som(paidMap[i.id] || 0)); } },
          {
            label: 'Qolgan', right: true, render: function (i) {
              var r = A.invoiceRemaining(i, paidMap);
              return r > 0 ? UI.pill(A.som(r), i.dueDate < A.today() ? 'bad' : 'warn') : UI.pill('To’langan', 'ok');
            }
          },
          { label: 'Muddat', render: function (i) { return A.dateLabel(i.dueDate); } }
        ], invs) : h('p', { class: 'muted' }, 'Hisob yaratilmagan.'), null, null, true));
    }

    if (tab === 'tolovlar') {
      var pays = A.sortBy(A.Fin.allPayments().filter(function (p) { return p.studentId === s.id; }), 'date', 'desc');
      view.appendChild(UI.card('To’lovlar tarixi',
        pays.length ? UI.table([
          { label: 'Sana', render: function (p) { return A.dateLabel(p.date); } },
          { label: 'Chek', render: function (p) { return h('span', { class: 'mono small' }, p.receiptNo); } },
          {
            label: 'Turi', render: function (p) {
              if (p.type === 'refund') return UI.pill('Qaytarish', 'bad');
              if (p.type === 'advance') return UI.pill('Avansdan qoplash', 'info');
              return UI.pill('To’lov', 'ok');
            }
          },
          {
            label: 'Usul', render: function (p) {
              return ({ naqd: 'Naqd', karta: 'Karta', bank: 'Bank o’tkazmasi', avans: 'Avansdan' })[p.method] || p.method;
            }
          },
          {
            label: 'Summa', right: true, render: function (p) {
              if (p.type === 'advance') {
                var used = p.applied || (p.allocations || []).reduce(function (t, a) { return t + a.amount; }, 0);
                return h('span', { class: 'mono', title: 'Yangi pul emas — avansdan hisobga o’tkazildi' }, A.som(used) + '*');
              }
              return h('span', { class: 'mono strong', style: p.voided ? 'text-decoration:line-through;opacity:.6' : '' },
                (p.type === 'refund' ? '−' : '') + A.som(p.amount));
            }
          },
          { label: 'Holat', render: function (p) { return p.voided ? UI.pill('Bekor qilingan', 'mute') : UI.pill('Amalda', 'ok'); } },
          {
            label: '', right: true, render: function (p) {
              return h('button', { class: 'btn sm', onclick: function () { A.receiptModal(p, App); } }, 'Chek');
            }
          }
        ], pays) : h('p', { class: 'muted' }, 'To’lov yo’q.'), null, null, true));

      /* --- Avans tarixi: qancha kelgan, qancha ishlatilgan, qancha qolgan --- */
      var advUsed = pays.filter(function (p) { return p.type === 'advance' && !p.voided; });
      var usedSum = advUsed.reduce(function (t, p) {
        return t + (p.applied || (p.allocations || []).reduce(function (x, a) { return x + a.amount; }, 0));
      }, 0);
      if (bal.advance > 0 || usedSum > 0) {
        view.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Avans', [
          h('div', { class: 'rowflex', style: 'margin-bottom:10px' }, [
            UI.pill('Hozirgi avans: ' + A.som(bal.advance) + ' so’m', bal.advance > 0 ? 'info' : 'mute'),
            UI.pill('Qoplashga ishlatilgan: ' + A.som(usedSum) + ' so’m', 'mute')
          ]),
          advUsed.length ? UI.table([
            { label: 'Sana', render: function (p) { return A.dateLabel(p.date); } },
            {
              label: 'Qaysi hisoblarga', render: function (p) {
                return (p.allocations || []).map(function (a) {
                  var inv = A.Fin.invoicesById()[a.invoiceId];
                  return (inv ? A.monthLabel(inv.month) : '') + ' — ' + A.som(a.amount);
                }).join('; ');
              }
            },
            {
              label: 'Summa', right: true, render: function (p) {
                return h('span', { class: 'mono' }, A.som(p.applied ||
                  (p.allocations || []).reduce(function (x, a) { return x + a.amount; }, 0)));
              }
            },
            { label: 'Kim', render: function (p) { return h('span', { class: 'small muted' }, p.createdBy || '—'); } }
          ], advUsed) : h('p', { class: 'small muted', style: 'margin:0' },
            'Avans hali qoplashga ishlatilmagan.'),
          (bal.advance > 0 && App.can('payment.create') && Q.openInvoices(s.id).length) ? h('div', { style: 'margin-top:12px' },
            h('button', {
              class: 'btn primary', onclick: function () { A.advanceModal(s.id, App); }
            }, 'Avansdan qoplash')) : null,
          h('p', { class: 'small muted', style: 'margin:10px 0 0' },
            'Avansdan qoplash yangi tushum emas — pul allaqachon qabul qilingan, ' +
            'shuning uchun hisobotlarda daromad sifatida ikki marta ko’rinmaydi.')
        ])));
      }
    }
  };

  /* ---------- O'quvchi shakli ---------- */
  A.studentForm = function (student, App) {
    App.guard('student.edit');
    var isNew = !student || !student.id;
    var fromLead = student && student._fromLead;
    var draft = student || {};
    var f = UI.form([
      { name: 'lastName', label: 'Familiya', required: true, value: draft.lastName },
      { name: 'firstName', label: 'Ism', required: true, value: draft.firstName },
      {
        name: 'phone', label: 'Telefon', required: true, value: draft.phone, placeholder: '+998 90 123 45 67',
        validate: function (v) { return A.phoneDigits(v).length < 7 ? 'Raqam to’liq emas.' : null; }
      },
      { name: 'parentName', label: 'Ota-ona / vasiy ismi (ixtiyoriy)', value: draft.parentName },
      {
        name: 'parentPhone', label: 'Ota-ona telefoni (ixtiyoriy)', value: draft.parentPhone, placeholder: '+998 90 123 45 67',
        validate: function (v) { return v && A.phoneDigits(v).length < 7 ? 'Raqam to’liq emas.' : null; }
      },
      { name: 'birthDate', label: 'Tug’ilgan sana (ixtiyoriy)', type: 'date', value: draft.birthDate },
      {
        name: 'status', label: 'Holat', type: 'select', value: draft.status || 'faol',
        options: [{ value: 'faol', label: 'Faol' }, { value: 'toxtatgan', label: 'Vaqtincha to’xtatgan' }, { value: 'arxiv', label: 'Arxivlangan' }]
      },
      { name: 'note', label: 'Izoh', type: 'textarea', value: draft.note, full: true }
    ]);

    var groupPick = null;
    if (isNew) {
      var opts = [{ value: '', label: '— keyinroq yozaman —' }].concat(
        D.all('groups').filter(function (g) { return g.status !== 'yakunlangan'; }).map(function (g) {
          return { value: g.id, label: g.name + ' · ' + A.som(g.fee) + ' so’m/oy' };
        }));
      groupPick = UI.field({ label: 'Darhol guruhga yozish', type: 'select', options: opts, full: true });
      if (draft._groupId) groupPick.input.value = draft._groupId;
      if (draft._courseId) {
        var cand = D.all('groups').filter(function (g) { return g.courseId === draft._courseId && g.status !== 'yakunlangan'; })[0];
        if (cand) groupPick.input.value = cand.id;
      }
      f.node.appendChild(groupPick.wrap);
    }

    var dup = h('div');
    function checkDup() {
      UI.clear(dup);
      var d = A.phoneDigits(f.get('phone').input.value) || A.phoneDigits(f.get('parentPhone').input.value);
      if (d.length < 7) return;
      var same = D.all('students').filter(function (x) {
        return x.id !== (student && student.id) && (A.phoneDigits(x.parentPhone) === d || A.phoneDigits(x.phone) === d);
      });
      if (same.length) {
        dup.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, [
          h('b', {}, 'Bu raqamli o’quvchi bor: '),
          same.map(function (x) { return x.lastName + ' ' + x.firstName; }).join(', '),
          '. Aka-uka/opa-singil bo’lsa, davom etavering.'
        ])));
      }
    }
    f.get('parentPhone').input.addEventListener('blur', checkDup);
    f.get('phone').input.addEventListener('blur', checkDup);

    UI.modal({
      title: isNew ? 'Yangi o’quvchi' : 'O’quvchini tahrirlash',
      body: [f.node, dup],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              var v = f.values();
              var rec = Object.assign({}, isNew ? {} : student, v, {
                phone: A.normPhone(v.phone), parentPhone: A.normPhone(v.parentPhone)
              });
              delete rec._fromLead; delete rec._courseId; delete rec._groupId;
              if (isNew) { rec.id = A.uid('stu'); rec.createdAt = A.nowStamp(); }
              await D.save('students', rec);
              await A.Ops.audit(App.user, isNew ? 'O’quvchi qo’shildi' : 'O’quvchi tahrirlandi', rec.lastName + ' ' + rec.firstName, '');
              if (fromLead) {
                fromLead.stage = 'oquvchi';
                fromLead.studentId = rec.id;
                await D.save('leads', fromLead);
              }
              var gid = groupPick && groupPick.input.value;
              c();
              UI.toast('Saqlandi.', 'ok');
              if (gid) {
                A.membershipForm(rec, { groupId: gid }, App);
              } else {
                App.go('student', { id: rec.id });
              }
            });
          }
        }
      ]
    });
  };

  global.A.stageLabel = stageLabel;
  global.A.leadForm = leadForm;
})(typeof window !== 'undefined' ? window : globalThis);
