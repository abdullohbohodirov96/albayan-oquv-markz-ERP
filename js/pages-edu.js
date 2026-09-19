/* Albyana ERP — Guruhlar, Kurslar, Jadval, Davomat */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  var Q = A.Q;
  A.Pages = A.Pages || {};

  /* Kerakli oy darslarini yuklash (yuklanmagan bo'lsa false qaytaradi) */
  function needLessons(ym, App) {
    var gs = Q.activeGroups(App.user);
    var missing = gs.filter(function (g) { return !D.lessonsCached(g.id, ym); });
    if (!missing.length) return true;
    (async function () {
      for (var i = 0; i < missing.length; i++) { await D.loadLessons(missing[i].id, ym); }
      App.render();
    })();
    return false;
  }
  A.needLessons = needLessons;

  function loadingBox(text) {
    return h('div', { class: 'card' }, h('div', { class: 'card-body' },
      h('p', { class: 'muted', style: 'margin:0' }, text || 'Yuklanmoqda…')));
  }

  /* ================= GURUHLAR ================= */
  A.Pages.groups = function (view, route, App) {
    App.guard('group.view');
    var list = A.scopeGroups(App.user, D.all('groups'));
    var status = route.status || 'all';
    if (status !== 'all') list = list.filter(function (g) { return g.status === status; });
    list = A.sortBy(list, 'name');

    view.appendChild(UI.pageHead('Guruhlar', list.length + ' ta guruh', [
      App.can('group.edit') ? h('button', { class: 'btn primary', onclick: function () { groupForm(null, App); } },
        [UI.icon('plus'), 'Guruh ochish']) : null,
      App.can('group.edit') ? h('button', { class: 'btn', onclick: function () { App.go('courses'); } }, 'Kurslar va xonalar') : null
    ]));

    view.appendChild(h('div', { class: 'filters' }, [
      h('div', { class: 'seg' }, [
        { id: 'all', label: 'Barchasi' }, { id: 'faol', label: 'Faol' },
        { id: 'rejalashtirilgan', label: 'Rejalashtirilgan' }, { id: 'yakunlangan', label: 'Yakunlangan' }
      ].map(function (s) {
        return h('button', {
          type: 'button', 'aria-pressed': status === s.id ? 'true' : 'false',
          onclick: function () { App.go('groups', { status: s.id }); }
        }, s.label);
      }))
    ]));

    if (!list.length) {
      view.appendChild(UI.card(null, UI.empty({
        title: 'Guruh yo’q',
        text: 'Avval kurs qo’shing, keyin guruh oching — dars kunlari, vaqti va oylik narxini belgilaysiz.',
        action: App.can('group.edit') ? { label: 'Guruh ochish', onClick: function () { groupForm(null, App); } } : null
      })));
      return;
    }

    var grid = h('div', { class: 'grid cols-3' });
    list.forEach(function (g) {
      var members = Q.membersOf(g.id);
      var fill = g.limit ? Math.min(100, Math.round(members.length / g.limit * 100)) : 0;
      var debt = 0;
      if (App.can('finance.debts')) {
        var paid = A.paidByInvoice(A.Fin.allPayments());
        A.Fin.allInvoices().filter(function (i) { return i.groupId === g.id; }).forEach(function (i) {
          debt += A.invoiceRemaining(i, paid);
        });
      }
      grid.appendChild(h('button', {
        class: 'card', type: 'button',
        style: 'text-align:left;cursor:pointer;padding:0;border-width:1px;font:inherit;color:inherit',
        onclick: function () { App.go('group', { id: g.id }); }
      }, h('div', { class: 'card-body', style: 'display:flex;flex-direction:column;gap:9px' }, [
        h('div', { class: 'rowflex', style: 'justify-content:space-between' }, [
          h('h3', { style: 'font-size:15px' }, [
            g.code ? h('span', { class: 'pill info', style: 'margin-inline-end:6px' }, g.code) : null,
            g.name
          ]),
          g.status === 'faol' ? UI.pill('Faol', 'ok') : (g.status === 'rejalashtirilgan' ? UI.pill('Rejalashtirilgan', 'info') : UI.pill('Yakunlangan', 'mute'))
        ]),
        h('div', { class: 'small muted' }, Q.courseName(g.courseId) + ' · ' + Q.staffName(g.teacherId)),
        h('div', { class: 'small' }, (g.days || []).map(function (d) { return A.WEEKDAYS_SHORT[d - 1]; }).join(', ') +
          ' · ' + g.startTime + '–' + g.endTime + ' · ' + Q.roomName(g.roomId)),
        h('div', { class: 'bar' + (fill > 90 ? ' warn' : '') }, h('i', { style: 'width:' + fill + '%' })),
        h('div', { class: 'rowflex small', style: 'justify-content:space-between' }, [
          h('span', {}, members.length + (g.limit ? ' / ' + g.limit : '') + ' o’quvchi'),
          h('span', { class: 'mono' }, A.som(A.feeForMonth(g, A.thisMonth())) + ' so’m/oy')
        ]),
        debt > 0 ? UI.pill('Qarzdorlik ' + A.som(debt), 'warn') : null
      ])));
    });
    view.appendChild(grid);
  };

  /* ================= GURUH KARTASI ================= */
  A.Pages.group = function (view, route, App) {
    App.guard('group.view');
    var g = D.one('groups', route.id);
    if (!g) { view.appendChild(UI.empty({ title: 'Guruh topilmadi' })); return; }
    if (!A.canSeeGroup(App.user, g)) {
      view.appendChild(UI.empty({ title: 'Ruxsat yo’q', text: 'Bu guruh sizga biriktirilmagan.' }));
      return;
    }
    var tab = route.tab || 'oquvchilar';
    var ym = route.ym || A.thisMonth();

    view.appendChild(h('button', { class: 'btn ghost sm', style: 'margin-bottom:8px', onclick: function () { App.go('groups'); } },
      [UI.icon('back'), 'Guruhlar']));
    view.appendChild(UI.pageHead(A.groupLabel(g),
      Q.courseName(g.courseId) + ' · ' + Q.staffName(g.teacherId) + ' · ' + Q.roomName(g.roomId) + ' · ' +
      (g.days || []).map(function (d) { return A.WEEKDAYS_SHORT[d - 1]; }).join(', ') + ' ' + g.startTime + '–' + g.endTime,
      [
        App.can('attendance.mark') ? h('button', {
          class: 'btn primary', onclick: function () { App.go('attendance', { groupId: g.id }); }
        }, [UI.icon('check'), 'Davomat olish']) : null,
        App.can('student.edit') ? h('button', {
          class: 'btn', onclick: function () { addStudentToGroup(g, App); }
        }, [UI.icon('plus'), 'O’quvchi qo’shish']) : null,
        App.can('group.edit') ? h('button', { class: 'btn', onclick: function () { groupForm(g, App); } },
          [UI.icon('edit'), 'Tahrirlash']) : null
      ]));

    var members = Q.membersOf(g.id);
    var tiles = h('div', { class: 'tiles' });
    tiles.appendChild(UI.tile({ label: 'O’quvchilar', value: members.length, hint: g.limit ? 'limit ' + g.limit : '' }));
    tiles.appendChild(UI.tile({ label: 'Oylik narx', value: A.som(A.feeForMonth(g, ym)), hint: 'so’m' }));
    if (App.can('finance.debts')) {
      var paidMap = A.paidByInvoice(A.Fin.allPayments());
      var gDebt = 0, gCharged = 0;
      A.Fin.allInvoices().filter(function (i) { return i.groupId === g.id; }).forEach(function (i) {
        gDebt += A.invoiceRemaining(i, paidMap); gCharged += i.final;
      });
      tiles.appendChild(UI.tile({ label: 'Hisoblangan (jami)', value: A.som(gCharged), hint: 'so’m' }));
      tiles.appendChild(UI.tile({ label: 'Qarzdorlik', value: A.som(gDebt), hint: 'so’m', cls: gDebt > 0 ? 'alert' : '' }));
    }
    view.appendChild(tiles);

    view.appendChild(UI.tabs([
      { id: 'oquvchilar', label: 'O’quvchilar' },
      { id: 'jadval', label: 'Darslar' },
      { id: 'davomat', label: 'Davomat' }
    ], tab, function (id) { App.go('group', { id: g.id, tab: id }); }));

    if (tab === 'oquvchilar') {
      view.appendChild(UI.card(null, members.length ? UI.table([
        { label: 'O’quvchi', render: function (m) { return h('b', {}, Q.studentName(m.studentId)); } },
        {
          label: 'Telefon', render: function (m) {
            var s = D.one('students', m.studentId);
            return h('span', { class: 'mono small' }, (s && (s.phone || s.parentPhone)) || '—');
          }
        },
        { label: 'Kirgan', render: function (m) { return A.dateLabel(m.joinedAt); } },
        {
          label: 'Chegirma', render: function (m) {
            if (!m.discount || !m.discount.value) return h('span', { class: 'muted' }, '—');
            return UI.pill(m.discount.type === 'percent' ? m.discount.value + '%' : A.som(m.discount.value), 'info');
          }
        },
        App.can('finance.debts') ? {
          label: 'Hisob', right: true, render: function (m) {
            return A.balancePill(Q.balance(m.studentId), Q.overdue(m.studentId));
          }
        } : { label: '', render: function () { return ''; } }
      ], members, { onRow: function (m) { App.go('student', { id: m.studentId }); } }) : UI.empty({
        title: 'Guruh bo’sh',
        text: 'O’quvchi qo’shing — u shu guruhning oylik hisoblariga kiradi.',
        action: App.can('student.edit') ? { label: 'O’quvchi qo’shish', onClick: function () { addStudentToGroup(g, App); } } : null
      }), null, null, true));
    }

    if (tab === 'jadval' || tab === 'davomat') {
      if (!D.lessonsCached(g.id, ym)) {
        (async function () { await D.loadLessons(g.id, ym); App.render(); })();
        view.appendChild(loadingBox());
        return;
      }
      var doc = D.lessonsCached(g.id, ym);
      var lessons = A.monthLessons(g, ym, doc);
      var nav = h('div', { class: 'filters' }, [
        h('div', { class: 'rowflex', style: 'gap:8px;flex-wrap:nowrap;width:100%;justify-content:space-between' }, [
          h('button', { class: 'btn sm', 'aria-label': 'Oldingi oy', onclick: function () { App.go('group', { id: g.id, tab: tab, ym: A.addMonths(ym, -1) }); } }, '‹'),
          h('b', { style: 'align-self:center;text-align:center;flex:1' }, A.monthLabel(ym)),
          h('button', { class: 'btn sm', 'aria-label': 'Keyingi oy', onclick: function () { App.go('group', { id: g.id, tab: tab, ym: A.addMonths(ym, 1) }); } }, '›')
        ])
      ]);
      view.appendChild(nav);

      if (tab === 'jadval') {
        view.appendChild(UI.card(null, lessons.length ? UI.table([
          { label: 'Sana', render: function (l) { return A.dateLabel(l.date) + ' (' + A.WEEKDAYS_SHORT[A.weekdayOf(l.date) - 1] + ')'; } },
          { label: 'Vaqt', render: function (l) { return h('span', { class: 'mono' }, l.start + '–' + l.end); } },
          { label: 'Xona', render: function (l) { return Q.roomName(l.roomId); } },
          {
            label: 'Holat', render: function (l) {
              if (l.status === 'bekor') return UI.pill('Bekor qilingan', 'mute');
              if (l.attendance && Object.keys(l.attendance).length) return UI.pill('Davomat olingan', 'ok');
              return l.date < A.today() ? UI.pill('Davomat olinmagan', 'warn') : UI.pill('Rejada', 'info');
            }
          },
          {
            label: '', right: true, render: function (l) {
              return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
                App.can('attendance.mark') && l.status !== 'bekor' ? h('button', {
                  class: 'btn sm primary', onclick: function () { App.go('attendance', { groupId: g.id, date: l.date }); }
                }, 'Davomat') : null,
                App.can('schedule.edit') ? h('button', { class: 'btn sm', onclick: function () { lessonModal(g, l, App); } }, 'O’zgartirish') : null
              ]);
            }
          }
        ], lessons) : h('p', { class: 'muted' }, 'Bu oyda dars yo’q.'), null, null, true));
      } else {
        var rows = members.map(function (m) {
          var st = { keldi: 0, kelmadi: 0, kechikdi: 0, sababli: 0, belgilanmagan: 0 };
          lessons.forEach(function (l) {
            if (l.status === 'bekor') return;
            var a = l.attendance && l.attendance[m.id];
            if (!a || !a.status) { if (l.date <= A.today()) st.belgilanmagan++; return; }
            st[a.status]++;
          });
          return { m: m, st: st };
        });
        view.appendChild(UI.card(A.monthLabel(ym) + ' davomat hisoboti', rows.length ? UI.table([
          { label: 'O’quvchi', render: function (r) { return h('b', {}, Q.studentName(r.m.studentId)); } },
          { label: 'Keldi', right: true, render: function (r) { return h('span', { class: 'mono' }, r.st.keldi); } },
          { label: 'Kelmadi', right: true, render: function (r) { return h('span', { class: 'mono' }, r.st.kelmadi); } },
          { label: 'Kechikdi', right: true, render: function (r) { return h('span', { class: 'mono' }, r.st.kechikdi); } },
          { label: 'Sababli', right: true, render: function (r) { return h('span', { class: 'mono' }, r.st.sababli); } },
          { label: 'Belgilanmagan', right: true, render: function (r) { return h('span', { class: 'mono muted' }, r.st.belgilanmagan); } },
          {
            label: 'Qatnashuv', right: true, render: function (r) {
              var tot = r.st.keldi + r.st.kechikdi + r.st.kelmadi + r.st.sababli;
              var pct = tot ? Math.round((r.st.keldi + r.st.kechikdi) / tot * 100) : 0;
              return UI.pill(pct + '%', pct >= 80 ? 'ok' : (pct >= 60 ? 'warn' : 'bad'));
            }
          }
        ], rows) : h('p', { class: 'muted' }, 'O’quvchi yo’q.'), [
          h('button', {
            class: 'btn sm', onclick: function () {
              UI.exportCsv('davomat-' + ym + '.csv', [['O’quvchi', 'Keldi', 'Kelmadi', 'Kechikdi', 'Sababli', 'Belgilanmagan']].concat(
                rows.map(function (r) {
                  return [Q.studentName(r.m.studentId), r.st.keldi, r.st.kelmadi, r.st.kechikdi, r.st.sababli, r.st.belgilanmagan];
                })));
            }
          }, 'Excel')
        ], true));
      }
    }
  };

  /* ---------- Guruh shakli ---------- */
  function groupForm(group, App) {
    App.guard('group.edit');
    var isNew = !group;
    var g = group || { days: [], status: 'rejalashtirilgan', startTime: '09:00', endTime: '10:30', startDate: A.today(), limit: 12 };

    var courses = D.all('courses').filter(function (c) { return c.active !== false; });
    if (!courses.length) {
      UI.modal({
        title: 'Avval kurs qo’shing',
        body: h('p', {}, 'Guruh ochish uchun kamida bitta kurs bo’lishi kerak.'),
        actions: [{ label: 'Kurslar bo’limi', cls: 'primary', onClick: function (c) { c(); App.go('courses'); } }]
      });
      return;
    }

    var f = UI.form([
      { name: 'name', label: 'Guruh nomi', required: true, value: g.name, placeholder: 'Arab tili A1 (ertalab)' },
      {
        name: 'code', label: 'Guruh kodi', required: true,
        value: g.code || A.nextGroupCode((courses[0] || {}).name, D.all('groups')),
        help: 'O’quvchi botda shu kodni yozadi. Masalan: B020',
        validate: function (v) {
          var dup = D.all('groups').filter(function (x) {
            return x.id !== g.id && String(x.code || '').toUpperCase() === String(v).toUpperCase();
          });
          return dup.length ? 'Bu kod boshqa guruhda ishlatilgan.' : null;
        }
      },
      {
        name: 'courseId', label: 'Kurs', type: 'select', required: true, value: g.courseId,
        options: courses.map(function (c) { return { value: c.id, label: c.name }; }),
        onchange: function (e) {
          var c = D.one('courses', e.target.value);
          if (!c) return;
          if (!f.get('fee').input.value) f.get('fee').input.value = c.monthlyFee;
          if (isNew) f.get('code').input.value = A.nextGroupCode(c.name, D.all('groups'));
          autoEnd(true);
        }
      },
      {
        name: 'teacherId', label: 'O’qituvchi', type: 'select', value: g.teacherId,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(
          D.all('staff').filter(function (s) { return s.status === 'faol'; }).map(function (s) { return { value: s.id, label: s.name }; }))
      },
      {
        name: 'roomId', label: 'Xona', type: 'select', value: g.roomId,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(
          D.all('rooms').map(function (r) { return { value: r.id, label: r.name + ' (' + r.capacity + ' joy)' }; }))
      },
      {
        name: 'startTime', label: 'Boshlanish vaqti', type: 'time', required: true, value: g.startTime,
        onchange: function () { autoEnd(true); }
      },
      {
        name: 'endTime', label: 'Tugash vaqti', type: 'time', required: true, value: g.endTime,
        help: 'Kurs davomiyligi bo’yicha o’zi to’ldiriladi',
        onchange: function () { showDuration(); }
      },
      { name: 'startDate', label: 'Boshlanish sanasi', type: 'date', required: true, value: g.startDate },
      { name: 'limit', label: 'O’quvchilar limiti', type: 'number', value: g.limit },
      { name: 'fee', label: 'Oylik narx (so’m)', type: 'number', required: true, value: g.fee },
      {
        name: 'status', label: 'Holat', type: 'select', value: g.status,
        options: [{ value: 'rejalashtirilgan', label: 'Rejalashtirilgan' }, { value: 'faol', label: 'Faol' }, { value: 'yakunlangan', label: 'Yakunlangan' }]
      }
    ]);

    /* Dars davomiyligi kursda yozilgan — boshlanish vaqti tanlansa,
       tugash vaqti o'zi hisoblanadi. */
    function lessonMinutes() {
      var c = D.one('courses', f.get('courseId').input.value);
      var n = Number(c && c.lessonMinutes);
      return n > 0 ? n : 90;
    }
    function addMinutes(hhmm, mins) {
      var p = String(hhmm || '').split(':');
      if (p.length < 2) return '';
      var total = (Number(p[0]) * 60 + Number(p[1]) + mins) % (24 * 60);
      if (total < 0) total += 24 * 60;
      return A.pad(Math.floor(total / 60)) + ':' + A.pad(total % 60);
    }
    function diffMinutes(a, b) {
      var x = String(a || '').split(':'), y = String(b || '').split(':');
      if (x.length < 2 || y.length < 2) return 0;
      var d = (Number(y[0]) * 60 + Number(y[1])) - (Number(x[0]) * 60 + Number(x[1]));
      if (d <= 0) d += 24 * 60;
      return d;
    }
    function durText(mins) {
      var hrs = Math.floor(mins / 60), m = mins % 60;
      return (hrs ? hrs + ' soat' : '') + (hrs && m ? ' ' : '') + (m ? m + ' daqiqa' : '');
    }
    function showDuration() {
      var help = f.get('endTime').wrap.querySelector('.help');
      if (!help) return;
      var st = f.get('startTime').input.value, en = f.get('endTime').input.value;
      if (!st || !en) { help.textContent = 'Kurs davomiyligi bo’yicha o’zi to’ldiriladi'; return; }
      var d = diffMinutes(st, en);
      help.textContent = 'Davomiyligi: ' + durText(d) +
        (d === lessonMinutes() ? ' (kursdagidek)' : ' — kursda ' + durText(lessonMinutes()));
    }
    function autoEnd(force) {
      var st = f.get('startTime').input.value;
      if (!st) return;
      var end = addMinutes(st, lessonMinutes());
      if (force || !f.get('endTime').input.value) {
        var inp = f.get('endTime').input;
        inp.value = end;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      showDuration();
    }
    showDuration();

    // Dars kunlari
    var dayWrap = h('div', { class: 'field full' }, [
      h('label', {}, ['Dars kunlari', h('span', { class: 'req' }, ' *')]),
      h('div', { class: 'daypick' }, A.WEEKDAYS.map(function (w, i) {
        var lab = h('label', {}, [
          h('input', { type: 'checkbox', value: String(i + 1), checked: (g.days || []).indexOf(i + 1) >= 0 }),
          h('span', {}, A.WEEKDAYS_SHORT[i])
        ]);
        return lab;
      }))
    ]);
    f.node.appendChild(dayWrap);
    function pickedDays() {
      return Array.prototype.slice.call(dayWrap.querySelectorAll('input:checked')).map(function (i) { return Number(i.value); });
    }

    // Narx o'zgarishi
    var feeNote = h('div', { class: 'field full' });
    if (!isNew) {
      var feeFrom = UI.field({
        label: 'Yangi narx qaysi oydan kuchga kiradi', type: 'month',
        value: A.addMonths(A.thisMonth(), 1),
        help: 'Oldingi oylarning hisoblari o’zgarmaydi.'
      });
      feeNote.appendChild(feeFrom.wrap);
      f.node.appendChild(feeNote);
    }

    var warn = h('div');
    UI.modal({
      title: isNew ? 'Yangi guruh' : 'Guruhni tahrirlash',
      wide: true,
      body: [f.node, warn],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            UI.clear(warn);
            if (!f.validate()) return;
            var days = pickedDays();
            if (!days.length) {
              warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, 'Kamida bitta dars kunini tanlang.')));
              return;
            }
            var v = f.values();
            if (A.timeToMin(v.endTime) <= A.timeToMin(v.startTime)) {
              warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, 'Tugash vaqti boshlanish vaqtidan keyin bo’lishi kerak.')));
              return;
            }
            var candidate = {
              id: g.id, days: days, startTime: v.startTime, endTime: v.endTime,
              teacherId: v.teacherId, roomId: v.roomId
            };
            var conflicts = A.scheduleConflicts(candidate, D.all('groups'));
            if (conflicts.length) {
              var msgs = conflicts.slice(0, 4).map(function (cf) {
                return (cf.type === 'teacher' ? 'O’qituvchi band: ' : 'Xona band: ') +
                  Q.groupName(cf.groupId) + ' (' + A.WEEKDAYS[cf.day - 1] + ')';
              });
              warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, [
                h('b', {}, 'Jadval to’qnashuvi. '), msgs.join('; '), ' — vaqtni yoki xonani o’zgartiring.'
              ])));
              return;
            }
            UI.busy(btn, async function () {
              var rec = Object.assign({}, isNew ? {} : g, v, { days: days, limit: v.limit || 0, fee: v.fee });
              // o'qituvchi almashsa — tarixga yozamiz (eski davr ish haqi o'zgarmaydi)
              if (!isNew && g.teacherId !== v.teacherId) {
                rec.teacherHistory = A.setTeacher(g, v.teacherId, A.today());
              } else if (isNew && v.teacherId) {
                rec.teacherHistory = [{ teacherId: v.teacherId, from: v.startDate, to: null }];
              }
              if (isNew) {
                rec.id = A.uid('grp');
                rec.feeHistory = [{ fee: v.fee, from: A.ymOf(v.startDate) }];
              } else {
                rec.feeHistory = (g.feeHistory || []).slice();
                var last = rec.feeHistory[rec.feeHistory.length - 1];
                if (!last || last.fee !== v.fee) {
                  var from = feeNote.querySelector('input') ? feeNote.querySelector('input').value : A.thisMonth();
                  rec.feeHistory = rec.feeHistory.filter(function (x) { return x.from !== from; });
                  rec.feeHistory.push({ fee: v.fee, from: from || A.thisMonth() });
                  rec.feeHistory.sort(function (a, b) { return String(a.from).localeCompare(String(b.from)); });
                }
              }
              await D.save('groups', rec);
              await A.Ops.audit(App.user, isNew ? 'Guruh ochildi' : 'Guruh tahrirlandi', rec.name,
                (isNew ? '' : 'narx: ' + A.som(v.fee)));
              c(); UI.toast('Saqlandi.', 'ok');
              App.go('group', { id: rec.id });
            });
          }
        }
      ]
    });
  }
  A.groupForm = groupForm;

  /* ---------- Guruhga o'quvchi qo'shish ---------- */
  function addStudentToGroup(group, App) {
    App.guard('student.edit');
    var inGroup = {};
    Q.membersOf(group.id).forEach(function (m) { inGroup[m.studentId] = 1; });
    var candidates = D.all('students').filter(function (s) { return s.status !== 'arxiv' && !inGroup[s.id]; });
    candidates = A.sortBy(candidates, function (s) { return s.lastName + ' ' + s.firstName; });

    var search = UI.field({ label: 'Qidirish', placeholder: 'Ism yoki telefon' });
    var listBox = h('div', { class: 'list', style: 'max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:10px' });
    function paint() {
      UI.clear(listBox);
      var q = search.input.value.trim().toLowerCase();
      var filtered = candidates.filter(function (s) {
        if (!q) return true;
        return (s.lastName + ' ' + s.firstName + ' ' + s.phone + ' ' + (s.parentPhone || '')).toLowerCase().indexOf(q) >= 0;
      }).slice(0, 40);
      if (!filtered.length) {
        listBox.appendChild(h('div', { class: 'empty' }, h('p', {}, 'O’quvchi topilmadi.')));
        return;
      }
      filtered.forEach(function (s) {
        listBox.appendChild(h('div', {
          class: 'list-item', onclick: function () { m.close(); A.membershipForm(s, { groupId: group.id }, App); }
        }, [
          UI.avatar(s.lastName + ' ' + s.firstName),
          h('div', { class: 'main-col' }, [h('b', {}, s.lastName + ' ' + s.firstName), h('span', {}, s.phone || s.parentPhone || '')])
        ]));
      });
    }
    search.input.addEventListener('input', paint);
    paint();
    var m = UI.modal({
      title: group.name + ' guruhiga o’quvchi qo’shish',
      body: [search.wrap, listBox],
      actions: [{
        label: 'Yangi o’quvchi yaratish', cls: 'primary',
        onClick: function (c) { c(); A.studentForm({ _groupId: group.id }, App); }
      }]
    });
  }

  /* ---------- A'zolik shakli ---------- */
  A.membershipForm = function (student, membership, App) {
    App.guard('student.edit');
    var isNew = !membership || !membership.id;
    var mem = membership || {};
    var groups = D.all('groups').filter(function (g) { return g.status !== 'yakunlangan'; });
    var f = UI.form([
      {
        name: 'groupId', label: 'Guruh', type: 'select', required: true, value: mem.groupId,
        options: groups.map(function (g) {
          return { value: g.id, label: g.name + ' · ' + A.som(A.feeForMonth(g, A.thisMonth())) + ' so’m/oy' };
        })
      },
      { name: 'joinedAt', label: 'Guruhga kirgan sana', type: 'date', required: true, value: mem.joinedAt || A.today() },
      {
        name: 'discountType', label: 'Chegirma turi', type: 'select',
        value: (mem.discount && mem.discount.type) || '',
        options: [{ value: '', label: 'Chegirmasiz' }, { value: 'sum', label: 'Summa (so’m)' }, { value: 'percent', label: 'Foiz (%)' }]
      },
      { name: 'discountValue', label: 'Chegirma miqdori', type: 'number', value: (mem.discount && mem.discount.value) || '' },
      { name: 'discountReason', label: 'Chegirma sababi', value: (mem.discount && mem.discount.reason) || '' },
      { name: 'discountFrom', label: 'Chegirma boshlanishi', type: 'month', value: (mem.discount && mem.discount.from) || A.thisMonth() },
      { name: 'discountTo', label: 'Chegirma tugashi (ixtiyoriy)', type: 'month', value: (mem.discount && mem.discount.to) || '' }
    ]);

    var firstMonthBox = h('div', { class: 'field full' });
    var fmMode, fmAmount, fmNote;
    function refreshFirstMonth() {
      UI.clear(firstMonthBox);
      if (!isNew) return;
      var joined = f.get('joinedAt').input.value;
      var gid = f.get('groupId').input.value;
      var g = D.one('groups', gid);
      if (!joined || !g) return;
      var ym = A.ymOf(joined);
      if (ym !== A.thisMonth()) return;
      var day = Number(joined.split('-')[2]);
      if (day <= 1) return;
      var fee = A.feeForMonth(g, ym);
      var fs = h('fieldset', {}, [
        h('legend', {}, 'Birinchi oy to’lovi'),
        h('p', { class: 'small muted', style: 'margin:0 0 8px' },
          'O’quvchi oy o’rtasida qo’shilyapti (' + A.dateLabel(joined) + '). Qaysi summani hisoblaymiz?')
      ]);
      fmMode = UI.field({
        label: 'Hisoblash', type: 'select', options: [
          { value: 'full', label: 'To’liq oylik narx — ' + A.som(fee) + ' so’m' },
          { value: 'custom', label: 'Kelishilgan summa' }
        ]
      });
      fmAmount = UI.field({ label: 'Kelishilgan summa (so’m)', type: 'number', value: fee });
      fmNote = UI.field({ label: 'Izoh', value: 'Oy o’rtasida qo’shildi' });
      fmAmount.wrap.hidden = true; fmNote.wrap.hidden = true;
      fmMode.input.addEventListener('change', function () {
        var custom = fmMode.input.value === 'custom';
        fmAmount.wrap.hidden = !custom;
        fmNote.wrap.hidden = !custom;
      });
      fs.appendChild(h('div', { class: 'form-grid' }, [fmMode.wrap, fmAmount.wrap, fmNote.wrap]));
      firstMonthBox.appendChild(fs);
    }
    f.get('joinedAt').input.addEventListener('change', refreshFirstMonth);
    f.get('groupId').input.addEventListener('change', refreshFirstMonth);
    refreshFirstMonth();
    f.node.appendChild(firstMonthBox);

    var warn = h('div');
    UI.modal({
      title: isNew ? Q.studentName(student.id) + ' — guruhga yozish' : 'A’zolikni tahrirlash',
      wide: true,
      body: [f.node, warn],
      actions: [
        !isNew && mem.status === 'faol' ? {
          label: 'Guruhdan chiqarish', cls: 'danger', onClick: function (c, btn) {
            UI.busy(btn, async function () {
              mem.status = 'chiqgan'; mem.leftAt = A.today();
              await D.save('memberships', mem);
              await A.Ops.audit(App.user, 'Guruhdan chiqarildi', Q.studentName(mem.studentId), Q.groupName(mem.groupId));
              c(); UI.toast('Chiqarildi.', 'ok'); App.render();
            });
          }
        } : null,
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            UI.clear(warn);
            if (!f.validate()) return;
            var v = f.values();
            var g = D.one('groups', v.groupId);
            var count = Q.membersOf(v.groupId).filter(function (m) { return m.id !== mem.id; }).length;
            if (g && g.limit && count >= g.limit) {
              warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' },
                h('div', {}, 'Guruh limiti to’lgan (' + g.limit + '). Limitni oshiring yoki boshqa guruh tanlang.')));
              return;
            }
            UI.busy(btn, async function () {
              var rec = Object.assign({}, mem, {
                studentId: student.id, groupId: v.groupId, joinedAt: v.joinedAt,
                status: mem.status || 'faol', leftAt: mem.leftAt || null
              });
              rec.discount = v.discountType ? {
                type: v.discountType === 'percent' ? 'percent' : 'sum',
                value: v.discountValue, reason: v.discountReason,
                from: v.discountFrom, to: v.discountTo
              } : null;
              if (isNew) rec.id = A.uid('mem');
              await D.save('memberships', rec);
              await A.Ops.audit(App.user, isNew ? 'Guruhga yozildi' : 'A’zolik tahrirlandi',
                Q.studentName(student.id), Q.groupName(v.groupId));

              if (isNew && App.can('invoice.create')) {
                var ym = A.ymOf(v.joinedAt);
                var opts = null;
                if (fmMode && fmMode.input.value === 'custom') {
                  opts = { amount: A.parseSom(fmAmount.input.value), note: fmNote.input.value };
                }
                if (ym >= A.thisMonth() && g && g.status === 'faol') {
                  await A.Ops.createSingleInvoice(rec, ym, opts, App.user);
                }
              }
              c(); UI.toast('Saqlandi.', 'ok');
              App.go('student', { id: student.id, tab: 'guruhlar' });
            });
          }
        }
      ]
    });
  };

  /* ================= KURSLAR VA XONALAR ================= */
  A.Pages.courses = function (view, route, App) {
    App.guard('group.edit');
    view.appendChild(h('button', { class: 'btn ghost sm', style: 'margin-bottom:8px', onclick: function () { App.go('groups'); } },
      [UI.icon('back'), 'Guruhlar']));
    view.appendChild(UI.pageHead('Kurslar va xonalar', 'Guruh ochishdan oldin shu yerni to’ldiring'));

    var cols = h('div', { class: 'grid cols-2' });
    var courses = A.sortBy(D.all('courses'), 'name');
    cols.appendChild(UI.card('Kurslar', courses.length ? UI.table([
      { label: 'Nomi', render: function (c) { return h('b', {}, c.name); } },
      { label: 'Tavsif', render: function (c) { return h('span', { class: 'small muted' }, c.description || '—'); } },
      { label: 'Oylik narx', right: true, render: function (c) { return h('span', { class: 'mono' }, A.som(c.monthlyFee)); } },
      { label: 'Dars (daq.)', right: true, render: function (c) { return c.lessonMinutes || 90; } }
    ], courses, { onRow: function (c) { courseForm(c, App); } }) : UI.empty({
      title: 'Kurs yo’q', text: 'Birinchi kursni qo’shing.',
      action: { label: 'Kurs qo’shish', onClick: function () { courseForm(null, App); } }
    }), [h('button', { class: 'btn sm primary', onclick: function () { courseForm(null, App); } }, 'Qo’shish')], true));

    var rooms = A.sortBy(D.all('rooms'), 'name');
    cols.appendChild(UI.card('Xonalar', rooms.length ? UI.table([
      { label: 'Nomi', render: function (r) { return h('b', {}, r.name); } },
      { label: 'Sig’imi', right: true, render: function (r) { return r.capacity; } },
      {
        label: 'Band guruhlar', right: true, render: function (r) {
          return D.all('groups').filter(function (g) { return g.roomId === r.id && g.status !== 'yakunlangan'; }).length;
        }
      }
    ], rooms, { onRow: function (r) { roomForm(r, App); } }) : UI.empty({
      title: 'Xona yo’q', text: 'Dars o’tiladigan xonalarni qo’shing.',
      action: { label: 'Xona qo’shish', onClick: function () { roomForm(null, App); } }
    }), [h('button', { class: 'btn sm primary', onclick: function () { roomForm(null, App); } }, 'Qo’shish')], true));

    view.appendChild(cols);
  };

  function courseForm(course, App) {
    var isNew = !course;
    var c = course || { monthlyFee: 400000, lessonMinutes: 90, active: true };
    var f = UI.form([
      { name: 'name', label: 'Kurs nomi', required: true, value: c.name },
      { name: 'monthlyFee', label: 'Standart oylik narx (so’m)', type: 'number', required: true, value: c.monthlyFee },
      { name: 'lessonMinutes', label: 'Dars davomiyligi (daqiqa)', type: 'number', value: c.lessonMinutes },
      { name: 'description', label: 'Tavsif', type: 'textarea', value: c.description, full: true }
    ]);
    UI.modal({
      title: isNew ? 'Yangi kurs' : 'Kursni tahrirlash',
      body: f.node,
      actions: [
        !isNew ? {
          label: 'O’chirish', cls: 'danger', onClick: async function (cl) {
            var used = D.all('groups').filter(function (g) { return g.courseId === c.id; }).length;
            if (used) { UI.toast('Bu kursda ' + used + ' ta guruh bor — o’chirib bo’lmaydi.', 'bad'); return; }
            if (await UI.confirm('Kursni o’chirish', 'Bu kurs butunlay o’chiriladi.', 'O’chirish', true)) {
              await D.remove('courses', c.id); cl(); UI.toast('O’chirildi.', 'ok'); App.render();
            }
          }
        } : null,
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (cl, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              var rec = Object.assign({}, c, f.values(), { active: true });
              if (isNew) rec.id = A.uid('crs');
              await D.save('courses', rec);
              await A.Ops.audit(App.user, isNew ? 'Kurs qo’shildi' : 'Kurs tahrirlandi', rec.name, '');
              cl(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  function roomForm(room, App) {
    var isNew = !room;
    var r = room || { capacity: 12 };
    var f = UI.form([
      { name: 'name', label: 'Xona nomi', required: true, value: r.name },
      { name: 'capacity', label: 'Sig’imi (necha kishi)', type: 'number', required: true, value: r.capacity }
    ]);
    UI.modal({
      title: isNew ? 'Yangi xona' : 'Xonani tahrirlash',
      body: f.node,
      actions: [
        !isNew ? {
          label: 'O’chirish', cls: 'danger', onClick: async function (cl) {
            var used = D.all('groups').filter(function (g) { return g.roomId === r.id && g.status !== 'yakunlangan'; }).length;
            if (used) { UI.toast('Bu xonada ' + used + ' ta guruh dars qiladi.', 'bad'); return; }
            if (await UI.confirm('Xonani o’chirish', 'Xona o’chiriladi.', 'O’chirish', true)) {
              await D.remove('rooms', r.id); cl(); UI.toast('O’chirildi.', 'ok'); App.render();
            }
          }
        } : null,
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (cl, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              var rec = Object.assign({}, r, f.values());
              if (isNew) rec.id = A.uid('room');
              await D.save('rooms', rec);
              cl(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  /* ================= JADVAL ================= */
  A.Pages.schedule = function (view, route, App) {
    App.guard('schedule.view');
    var base = route.date || A.today();
    var wd = A.weekdayOf(base);
    var monday = A.addDays(base, -(wd - 1));
    var ym1 = A.ymOf(monday), ym2 = A.ymOf(A.addDays(monday, 6));

    view.appendChild(UI.pageHead('Dars jadvali',
      A.dateLabel(monday) + ' — ' + A.dateLabel(A.addDays(monday, 6)), [
      h('button', { class: 'btn', onclick: function () { App.go('schedule', { date: A.today() }); } }, 'Bugun'),
      App.can('group.edit') ? h('button', { class: 'btn primary', onclick: function () { groupForm(null, App); } },
        [UI.icon('plus'), 'Guruh ochish']) : null
    ]));

    if (!needLessons(ym1, App) || (ym2 !== ym1 && !needLessons(ym2, App))) {
      view.appendChild(loadingBox('Jadval yuklanmoqda…'));
      return;
    }

    var teacherId = route.teacherId || '';
    var groupId = route.groupId || '';
    var roomId = route.roomId || '';
    var ft = UI.field({
      label: 'O’qituvchi', type: 'select', value: teacherId,
      options: [{ value: '', label: 'Barchasi' }].concat(D.all('staff').filter(function (s) { return s.status === 'faol'; })
        .map(function (s) { return { value: s.id, label: s.name }; }))
    });
    var fg = UI.field({
      label: 'Guruh', type: 'select', value: groupId,
      options: [{ value: '', label: 'Barchasi' }].concat(Q.activeGroups(App.user).map(function (g) { return { value: g.id, label: g.name }; }))
    });
    var fr = UI.field({
      label: 'Xona', type: 'select', value: roomId,
      options: [{ value: '', label: 'Barchasi' }].concat(D.all('rooms').map(function (r) { return { value: r.id, label: r.name }; }))
    });
    function apply() {
      App.go('schedule', { date: base, teacherId: ft.input.value, groupId: fg.input.value, roomId: fr.input.value });
    }
    [ft, fg, fr].forEach(function (x) { x.input.addEventListener('change', apply); });

    view.appendChild(h('div', { class: 'filters' }, [
      h('div', { class: 'rowflex', style: 'gap:8px;flex-wrap:nowrap;width:100%' }, [
        h('button', {
          class: 'btn sm', style: 'flex:1',
          onclick: function () { App.go('schedule', { date: A.addDays(monday, -7), teacherId: teacherId, groupId: groupId, roomId: roomId }); }
        }, '‹ Oldingi hafta'),
        h('button', {
          class: 'btn sm', style: 'flex:1',
          onclick: function () { App.go('schedule', { date: A.addDays(monday, 7), teacherId: teacherId, groupId: groupId, roomId: roomId }); }
        }, 'Keyingi hafta ›')
      ]),
      ft.wrap, fg.wrap, fr.wrap
    ]));

    function lessonsFor(dateIso) {
      return Q.lessonsOn(dateIso, App.user).filter(function (l) {
        if (teacherId && l.teacherId !== teacherId) return false;
        if (groupId && l.groupId !== groupId) return false;
        if (roomId && l.roomId !== roomId) return false;
        return true;
      });
    }

    // Telefon uchun kun tanlash tasmasi
    var strip = h('div', { class: 'day-strip' });
    for (var s = 0; s < 7; s++) {
      (function (idx) {
        var iso = A.addDays(monday, idx);
        var n = lessonsFor(iso).length;
        strip.appendChild(h('button', {
          type: 'button', 'aria-pressed': iso === base ? 'true' : 'false',
          onclick: function () { App.go('schedule', { date: iso, teacherId: teacherId, groupId: groupId, roomId: roomId }); }
        }, [
          h('span', {}, A.WEEKDAYS_SHORT[idx]),
          h('b', {}, iso.split('-')[2]),
          h('span', { class: 'cnt' }, n ? n + ' dars' : '—')
        ]));
      })(s);
    }
    view.appendChild(strip);

    // Haftalik ko'rinish
    var week = h('div', { class: 'week' });
    for (var i = 0; i < 7; i++) {
      var iso = A.addDays(monday, i);
      var col = h('div', { class: 'week-col' + (iso === A.today() ? ' today-col' : '') });
      col.appendChild(h('h4', {}, [A.WEEKDAYS_SHORT[i], h('em', {}, A.dateLabel(iso).split(' ').slice(0, 2).join(' '))]));
      var ls = lessonsFor(iso);
      if (!ls.length) col.appendChild(h('div', { class: 'small muted' }, 'Dars yo’q'));
      ls.forEach(function (l) {
        var g = D.one('groups', l.groupId);
        var cls = 'lesson' + (l.status === 'bekor' ? ' cancelled' : (l.attendance && Object.keys(l.attendance).length ? ' done' : ''));
        col.appendChild(h('button', {
          class: cls, type: 'button', style: 'width:100%;text-align:left;border:0;border-left:3px solid;font:inherit',
          onclick: (function (ll) { return function () { lessonModal(D.one('groups', ll.groupId), ll, App); }; })(l)
        }, [
          h('b', {}, g ? g.name : '—'),
          h('span', {}, l.start + '–' + l.end),
          h('span', { style: 'display:block' }, Q.roomName(l.roomId))
        ]));
      });
      week.appendChild(col);
    }
    view.appendChild(h('div', { class: 'week-wrap' },
      UI.card(null, h('div', { class: 'scroll-x' }, week), null, null, false)));

    // Telefon uchun kunlik ro'yxat
    var dayList = h('div', { class: 'list' });
    var todayLessons = lessonsFor(base);
    if (!todayLessons.length) dayList.appendChild(h('div', { class: 'empty' }, h('p', {}, 'Bu kuni dars yo’q.')));
    todayLessons.forEach(function (l) {
      var g = D.one('groups', l.groupId);
      dayList.appendChild(h('div', {
        class: 'list-item', onclick: function () { lessonModal(g, l, App); }
      }, [
        h('div', { class: 'avatar mono', style: 'width:52px;font-size:12px' }, l.start),
        h('div', { class: 'main-col' }, [h('b', {}, g ? g.name : '—'),
        h('span', {}, Q.staffName(l.teacherId) + ' · ' + Q.roomName(l.roomId))]),
        l.status === 'bekor' ? UI.pill('Bekor', 'mute') : null
      ]));
    });
    view.appendChild(h('div', { style: 'margin-top:14px' },
      UI.card(A.dateLabel(base) + ' kuni', dayList, null, true)));
  };

  /* ---------- Dars modali ---------- */
  function lessonModal(group, lesson, App) {
    if (!group) return;
    var ym = A.ymOf(lesson.date);
    var body = [
      h('dl', { class: 'kv' }, [
        h('dt', {}, 'Guruh'), h('dd', {}, group.name),
        h('dt', {}, 'Sana'), h('dd', {}, A.dateLabel(lesson.date) + ' (' + A.WEEKDAYS[A.weekdayOf(lesson.date) - 1] + ')'),
        h('dt', {}, 'Vaqt'), h('dd', {}, lesson.start + '–' + lesson.end),
        h('dt', {}, 'O’qituvchi'), h('dd', {}, Q.staffName(lesson.teacherId)),
        h('dt', {}, 'Xona'), h('dd', {}, Q.roomName(lesson.roomId)),
        h('dt', {}, 'Holat'), h('dd', {}, lesson.status === 'bekor' ? 'Bekor qilingan' :
          (lesson.attendance && Object.keys(lesson.attendance).length ? 'Davomat olingan' : 'Rejada'))
      ])
    ];
    if (lesson.note) body.push(h('p', { class: 'small muted' }, 'Izoh: ' + lesson.note));

    var actions = [];
    if (App.can('attendance.mark') && lesson.status !== 'bekor') {
      actions.push({
        label: 'Davomat olish', cls: 'primary',
        onClick: function (c) { c(); App.go('attendance', { groupId: group.id, date: lesson.date }); }
      });
    }
    if (App.can('schedule.edit')) {
      actions.push({
        label: lesson.status === 'bekor' ? 'Bekorni qaytarish' : 'Darsni bekor qilish',
        cls: lesson.status === 'bekor' ? '' : 'danger',
        onClick: function (c, btn) {
          UI.busy(btn, async function () {
            await D.mutateLessons(group.id, ym, function (doc) {
              var rec = doc.items[lesson.date] || {};
              rec.status = lesson.status === 'bekor' ? 'rejalashtirilgan' : 'bekor';
              doc.items[lesson.date] = rec;
            });
            await A.Ops.audit(App.user, lesson.status === 'bekor' ? 'Dars qaytarildi' : 'Dars bekor qilindi',
              group.name, A.dateLabel(lesson.date));
            c(); UI.toast('Saqlandi.', 'ok'); App.render();
          });
        }
      });
      actions.push({ label: 'Ko’chirish', onClick: function (c) { c(); moveLesson(group, lesson, App); } });
    }
    actions.push({ label: 'Yopish' });
    UI.modal({ title: 'Dars', body: body, actions: actions });
  }
  A.lessonModal = lessonModal;

  function moveLesson(group, lesson, App) {
    var f = UI.form([
      { name: 'date', label: 'Yangi sana', type: 'date', required: true, value: lesson.date },
      { name: 'start', label: 'Boshlanish', type: 'time', required: true, value: lesson.start },
      { name: 'end', label: 'Tugash', type: 'time', required: true, value: lesson.end },
      {
        name: 'roomId', label: 'Xona', type: 'select', value: lesson.roomId,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(D.all('rooms').map(function (r) { return { value: r.id, label: r.name }; }))
      },
      { name: 'note', label: 'Izoh', value: lesson.note || '', full: true }
    ]);
    var warn = h('div');
    UI.modal({
      title: 'Darsni ko’chirish',
      body: [h('p', { class: 'small muted', style: 'margin:0' },
        'Faqat shu bitta dars ko’chadi. Guruhning haftalik jadvali o’zgarmaydi.'), f.node, warn],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Ko’chirish', cls: 'primary', onClick: function (c, btn) {
            UI.clear(warn);
            if (!f.validate()) return;
            var v = f.values();
            if (A.timeToMin(v.end) <= A.timeToMin(v.start)) {
              warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, 'Vaqt noto’g’ri.')));
              return;
            }
            var occupied = [];
            Q.lessonsOn(v.date, App.user).forEach(function (l) {
              if (l.groupId === group.id && l.date === lesson.date) return;
              if (l.status === 'bekor') return;
              occupied.push({ date: l.date, start: l.start, end: l.end, teacherId: l.teacherId, roomId: l.roomId, groupId: l.groupId });
            });
            var cf = A.lessonConflicts({
              date: v.date, start: v.start, end: v.end,
              teacherId: lesson.teacherId, roomId: v.roomId, groupId: group.id
            }, occupied);
            if (cf.length) {
              warn.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, [
                h('b', {}, 'Bu vaqt band: '),
                cf.map(function (x) { return (x.type === 'teacher' ? 'o’qituvchi' : 'xona') + ' — ' + Q.groupName(x.groupId); }).join('; ')
              ])));
              return;
            }
            UI.busy(btn, async function () {
              var oldYm = A.ymOf(lesson.date), newYm = A.ymOf(v.date);
              await D.loadLessons(group.id, newYm);
              await D.mutateLessons(group.id, oldYm, function (doc) {
                var rec = doc.items[lesson.date] || {};
                rec.status = 'kochirildi';
                rec.movedTo = v.date;
                doc.items[lesson.date] = rec;
              });
              await D.mutateLessons(group.id, newYm, function (doc) {
                var rec = doc.items[v.date] || {};
                rec.added = true;
                rec.start = v.start; rec.end = v.end; rec.roomId = v.roomId;
                rec.note = v.note; rec.status = 'rejalashtirilgan';
                rec.movedFrom = lesson.date;
                doc.items[v.date] = rec;
              });
              await A.Ops.audit(App.user, 'Dars ko’chirildi', group.name,
                A.dateLabel(lesson.date) + ' → ' + A.dateLabel(v.date));
              c(); UI.toast('Dars ko’chirildi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  /* ================= DAVOMAT ================= */
  function date0(route) { return route.date || null; }

  /** Bugungi darslar tasmasi: belgilangan / belgilanmagan holati bilan */
  function todayStrip(App, currentGroupId, currentDate) {
    var today = A.today();
    var ym = A.thisMonth();
    var box = h('div', { class: 'today-strip' });

    var lessons = Q.lessonsOn(today, App.user).filter(function (l) { return l.status !== 'bekor'; });
    var loaded = Q.activeGroups(App.user).every(function (g) { return !!D.lessonsCached(g.id, ym); });
    if (!loaded && !todayStrip._loading) {
      todayStrip._loading = true;
      (async function () {
        try { await Q.ensureLessonMonth(ym, App.user); } catch (e) { }
        todayStrip._loading = false;
        App.render();
      })();
    }

    box.appendChild(h('div', { class: 'ts-head' }, [
      h('b', {}, 'Bugungi darslar'),
      h('span', { class: 'small muted' }, A.dateLabel(today))
    ]));

    if (!lessons.length) {
      box.appendChild(h('div', { class: 'small muted', style: 'padding:6px 0' },
        loaded ? 'Bugun dars yo’q. Pastdan guruh va sanani tanlang.' : 'Yuklanmoqda…'));
      return box;
    }

    var row = h('div', { class: 'ts-row' });
    A.sortBy(lessons, 'start').forEach(function (l) {
      var g = D.one('groups', l.groupId);
      var marked = l.attendance && Object.keys(l.attendance).length > 0;
      var active = l.groupId === currentGroupId && currentDate === today;
      row.appendChild(h('button', {
        class: 'ts-card' + (marked ? ' done' : '') + (active ? ' active' : ''),
        type: 'button',
        onclick: function () { App.go('attendance', { groupId: l.groupId, date: today }); }
      }, [
        h('span', { class: 'ts-time' }, l.start),
        h('span', { class: 'ts-name' }, g ? A.groupLabel(g) : ''),
        marked ? UI.pill('Belgilangan', 'ok') : UI.pill('Belgilanmagan', 'warn')
      ]));
    });
    box.appendChild(row);
    return box;
  }

  A.Pages.attendance = function (view, route, App) {
    App.guard('attendance.view');
    var groups = Q.activeGroups(App.user).filter(function (g) { return g.status === 'faol'; });
    if (!groups.length) {
      view.appendChild(UI.pageHead('Davomat'));
      view.appendChild(UI.card(null, UI.empty({ title: 'Faol guruh yo’q', text: 'Avval guruh oching va o’quvchi yozing.' })));
      return;
    }
    var groupId = route.groupId || groups[0].id;
    var g = D.one('groups', groupId) || groups[0];
    if (!A.canSeeGroup(App.user, g)) { view.appendChild(UI.empty({ title: 'Ruxsat yo’q' })); return; }
    var ym = route.date ? A.ymOf(route.date) : A.thisMonth();

    view.appendChild(UI.pageHead('Davomat', 'Guruh va dars sanasini tanlang'));

    // Eng tepada — bugungi darslar. Belgilanganini darrov ko'rish uchun.
    view.appendChild(todayStrip(App, g.id, date0(route)));

    if (!D.lessonsCached(g.id, ym)) {
      (async function () { await D.loadLessons(g.id, ym); App.render(); })();
      view.appendChild(loadingBox());
      return;
    }
    var lessons = A.monthLessons(g, ym, D.lessonsCached(g.id, ym)).filter(function (l) { return l.status !== 'bekor'; });
    var date = route.date;
    if (!date || !lessons.some(function (l) { return l.date === date; })) {
      var past = lessons.filter(function (l) { return l.date <= A.today(); });
      date = past.length ? past[past.length - 1].date : (lessons[0] ? lessons[0].date : null);
    }

    var fg = UI.field({
      label: 'Guruh', type: 'select', value: g.id,
      options: groups.map(function (x) { return { value: x.id, label: x.name }; })
    });
    fg.input.addEventListener('change', function () { App.go('attendance', { groupId: fg.input.value }); });
    var fd = UI.field({
      label: 'Dars sanasi', type: 'select', value: date || '',
      options: lessons.length ? lessons.map(function (l) {
        var marked = l.attendance && Object.keys(l.attendance).length;
        return { value: l.date, label: A.dateLabel(l.date) + ' ' + l.start + (marked ? ' ✓' : '') };
      }) : [{ value: '', label: 'Dars yo’q' }]
    });
    fd.input.addEventListener('change', function () { App.go('attendance', { groupId: g.id, date: fd.input.value }); });
    view.appendChild(h('div', { class: 'filters' }, [
      fg.wrap, fd.wrap,
      h('button', { class: 'btn sm', onclick: function () { App.go('attendance', { groupId: g.id, date: A.monthStart(A.addMonths(ym, -1)) }); } }, '‹ Oldingi oy'),
      h('button', { class: 'btn sm', onclick: function () { App.go('group', { id: g.id, tab: 'davomat' }); } }, 'Oylik hisobot')
    ]));

    if (!date) {
      view.appendChild(UI.card(null, UI.empty({ title: 'Bu oyda dars yo’q', text: 'Boshqa oyni tanlang yoki guruh jadvalini tekshiring.' })));
      return;
    }

    var members = Q.membersOf(g.id).filter(function (m) {
      if (m.joinedAt && m.joinedAt > date) return false;
      if (m.leftAt && m.leftAt < date) return false;
      return true;
    });
    var doc = D.lessonsCached(g.id, ym);
    var rec = (doc.items && doc.items[date]) || {};
    var state = {};
    members.forEach(function (m) {
      state[m.id] = (rec.attendance && rec.attendance[m.id] && rec.attendance[m.id].status) || null;
    });

    var rowsBox = h('div');
    function paint() {
      UI.clear(rowsBox);
      members.forEach(function (m) {
        var opts = h('div', { class: 'att-opts' }, Object.keys(A.ATT).map(function (k) {
          var conf = A.ATT[k];
          return h('button', {
            type: 'button', class: conf.cls, 'aria-pressed': state[m.id] === k ? 'true' : 'false',
            disabled: !App.can('attendance.mark'),
            onclick: function () { state[m.id] = state[m.id] === k ? null : k; paint(); }
          }, conf.label);
        }));
        rowsBox.appendChild(h('div', { class: 'att-row' }, [
          UI.avatar(Q.studentName(m.studentId)),
          h('div', { class: 'nm' }, Q.studentName(m.studentId)),
          opts
        ]));
      });
    }
    paint();

    var unmarkedCount = function () {
      return members.filter(function (m) { return !state[m.id]; }).length;
    };
    var footer = h('div', { class: 'rowflex', style: 'padding:14px 16px;border-top:1px solid var(--line);justify-content:space-between' }, [
      h('div', { class: 'small muted' }, rec.markedAt ? ('Oxirgi o’zgartirish: ' + rec.markedAt + ' · ' + (rec.markedBy || '')) :
        'Belgilanmagan o’quvchilar avtomatik "Kelmadi" hisoblanmaydi.'),
      App.can('attendance.mark') ? h('div', { class: 'rowflex' }, [
        h('button', {
          class: 'btn', onclick: function () {
            members.forEach(function (m) { if (!state[m.id]) state[m.id] = 'keldi'; });
            paint();
          }
        }, 'Hammani "Keldi" deb belgilash'),
        h('button', {
          class: 'btn primary', onclick: function (e) {
            var btn = e.currentTarget;
            UI.busy(btn, async function () {
              await D.mutateLessons(g.id, ym, function (d) {
                var r = d.items[date] || {};
                r.attendance = r.attendance || {};
                members.forEach(function (m) {
                  if (state[m.id]) {
                    r.attendance[m.id] = { status: state[m.id], at: A.nowStamp(), by: App.user.name };
                  } else {
                    delete r.attendance[m.id];
                  }
                });
                r.status = 'otkazildi';
                r.markedBy = App.user.name;
                r.markedAt = A.nowStamp();
                d.items[date] = r;
              });
              await A.Ops.audit(App.user, 'Davomat saqlandi', g.name, A.dateLabel(date) +
                ' · belgilangan: ' + (members.length - unmarkedCount()) + '/' + members.length);
              if (A.Bot) {
                try {
                  await A.Bot.notifyAttendance(g.id, date, members.map(function (m) {
                    return { studentId: m.studentId, status: state[m.id] };
                  }), App.user.name);
                } catch (e) { console.error('bot', e); }
              }
              UI.toast('Davomat saqlandi.', 'ok');
              App.back('dashboard');   // saqlagandan keyin oldingi sahifaga qaytadi
            });
          }
        }, 'Saqlash')
      ]) : null
    ]);

    view.appendChild(UI.card(g.name + ' · ' + A.dateLabel(date),
      members.length ? [rowsBox, footer] : UI.empty({ title: 'Guruhda o’quvchi yo’q', text: 'Avval o’quvchi qo’shing.' }),
      null, true));
  };
})(typeof window !== 'undefined' ? window : globalThis);
