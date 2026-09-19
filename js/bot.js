/* Albyana ERP — Telegram bot bilan bog'liq qism (ilova tomoni).
   Bot serveri (server/bot.js) shu yozuvlarni o'qib, Telegramga yuboradi. */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  var Q;
  A.Pages = A.Pages || {};

  function settings() {
    var s = (D.settings && D.settings.bot) || {};
    return {
      username: s.username || '',
      notifyAttendance: s.notifyAttendance !== false,
      notifyPayment: s.notifyPayment !== false,
      notifyDebt: s.notifyDebt !== false,
      welcome: s.welcome || 'Assalomu alaykum! Albyana o’quv markazi botiga xush kelibsiz.',
      autoApprove: s.autoApprove === true
    };
  }

  var Bot = {
    settings: settings,
    serverConnected: function () { return D.mode === 'server'; },

    /** Xabarni navbatga qo'yish — bot serveri uni yuboradi */
    async enqueue(studentId, text, kind) {
      var st = D.one('students', studentId);
      if (!st || !st.telegram || !st.telegram.id) return false;
      await D.save('botout', {
        id: A.uid('out'),
        studentId: studentId,
        chatId: st.telegram.id,
        text: text,
        kind: kind || 'xabar',
        status: 'pending',
        createdAt: A.nowStamp()
      });
      return true;
    },

    /** Davomat belgilanganda xabar */
    async notifyAttendance(groupId, date, records, actorName) {
      var conf = settings();
      if (!conf.notifyAttendance) return;
      var g = D.one('groups', groupId);
      var labels = { keldi: 'darsda qatnashdi', kelmadi: 'darsga kelmadi', kechikdi: 'darsga kechikdi', sababli: 'sababli kelmadi' };
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (!r.status) continue;
        var st = D.one('students', r.studentId);
        if (!st || !st.telegram || !st.telegram.id) continue;
        await Bot.enqueue(r.studentId,
          'Davomat: ' + A.dateLabel(date) + '\n' +
          (g ? g.name + ' (' + (g.code || '') + ')' : '') + '\n' +
          st.firstName + ' ' + labels[r.status] + '.',
          'davomat');
      }
      void actorName;
    },

    /** To'lov qabul qilinganda xabar */
    async notifyPayment(payment) {
      var conf = settings();
      if (!conf.notifyPayment) return;
      var st = D.one('students', payment.studentId);
      if (!st || !st.telegram || !st.telegram.id) return;
      var bal = A.balanceOf(payment.studentId, A.Fin.allInvoices(), A.Fin.allPayments());
      await Bot.enqueue(payment.studentId,
        'To’lov qabul qilindi\n' +
        'Summa: ' + A.som(payment.amount) + ' so’m\n' +
        'Sana: ' + A.dateLabel(payment.date) + '\n' +
        'Chek: ' + payment.receiptNo + '\n' +
        (bal.debt > 0 ? 'Qolgan qarz: ' + A.som(bal.debt) + ' so’m' : 'Qarzingiz yo’q. Rahmat!'),
        'tolov');
    },

    pending: function () {
      return A.sortBy(D.all('botreq').filter(function (r) { return r.status === 'kutilmoqda'; }), 'createdAt', 'desc');
    },
    linkedStudents: function () {
      return D.all('students').filter(function (s) { return s.telegram && s.telegram.id; });
    },

    async approve(req, studentId, App) {
      var st = D.one('students', studentId);
      if (!st) throw new Error('O’quvchi topilmadi.');
      var rec = A.clone(st);
      rec.telegram = { id: req.chatId, username: req.username || '', name: req.name || '', linkedAt: A.nowStamp() };
      await D.save('students', rec);
      var r = A.clone(req);
      r.status = 'tasdiqlangan';
      r.studentId = studentId;
      r.handledAt = A.nowStamp();
      await D.save('botreq', r);
      await Bot.enqueue(studentId,
        'Hisobingiz tasdiqlandi. Endi bu yerda davomat, to’lov va e’lonlarni olasiz.', 'ulash');
      await A.Ops.audit(App.user, 'Bot: o’quvchi ulandi', rec.lastName + ' ' + rec.firstName, req.name || '');
    },
    async reject(req, App) {
      var r = A.clone(req);
      r.status = 'rad';
      r.handledAt = A.nowStamp();
      await D.save('botreq', r);
      await A.Ops.audit(App.user, 'Bot: ulash so’rovi rad etildi', req.name || '', '');
    }
  };
  A.Bot = Bot;

  /* ================= BOT SAHIFASI ================= */
  A.Pages.bot = function (view, route, App) {
    App.guard('nav.bot');
    Q = A.Q;
    var tab = route.tab || 'holat';
    var conf = settings();
    var pending = Bot.pending();
    var linked = Bot.linkedStudents();
    var queue = D.all('botout').filter(function (m) { return m.status === 'pending'; });

    view.appendChild(UI.pageHead('Telegram bot',
      'O’quvchilar bot orqali davomat, to’lov va e’lonlarni oladi'));

    if (!Bot.serverConnected()) {
      view.appendChild(h('div', { class: 'banner warn' }, h('div', {}, [
        h('b', {}, 'Bot serveri ulanmagan. '),
        'Bu yerda tayyorlangan xabarlar navbatda saqlanadi va bot serveri ishga tushgach yuboriladi. ',
        'Serverni ishga tushirish yo’riqnomasi loyiha papkasidagi README faylida.'
      ])));
    }

    var tabs = [{ id: 'holat', label: 'Holat' }];
    if (App.can('bot.broadcast')) tabs.push({ id: 'xabar', label: 'Xabar yuborish' });
    tabs.push({ id: 'oquvchilar', label: 'Ulangan o’quvchilar' });
    if (App.can('bot.manage')) tabs.push({ id: 'sozlama', label: 'Sozlamalar' });
    view.appendChild(UI.tabs(tabs, tab, function (id) { App.go('bot', { tab: id }); }));

    if (tab === 'holat') {
      view.appendChild(h('div', { class: 'tiles' }, [
        UI.tile({ label: 'Ulangan o’quvchilar', value: linked.length, hint: D.all('students').length + ' tadan' }),
        UI.tile({ label: 'Ulash so’rovlari', value: pending.length, cls: pending.length ? 'alert' : '' }),
        UI.tile({ label: 'Navbatdagi xabarlar', value: queue.length }),
        UI.tile({ label: 'Bot manzili', value: conf.username ? '@' + conf.username.replace('@', '') : '—' })
      ]));

      view.appendChild(UI.card('Ulash so’rovlari',
        pending.length ? UI.table([
          { label: 'Vaqt', render: function (r) { return h('span', { class: 'mono small' }, r.createdAt); } },
          { label: 'Yozgan ism', render: function (r) { return h('b', {}, r.name || '—'); } },
          { label: 'Guruh kodi', render: function (r) { return UI.pill(r.groupCode || '—', 'info'); } },
          { label: 'Telegram', render: function (r) { return h('span', { class: 'mono small' }, r.username ? '@' + r.username : r.chatId); } },
          {
            label: 'Taklif', render: function (r) {
              var s = r.matchStudentId ? D.one('students', r.matchStudentId) : null;
              return s ? (s.lastName + ' ' + s.firstName) : h('span', { class: 'muted' }, 'Topilmadi');
            }
          },
          {
            label: '', right: true, render: function (r) {
              return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
                h('button', {
                  class: 'btn sm primary', onclick: function () { approveModal(r, App); }
                }, 'Ulash'),
                h('button', {
                  class: 'btn sm danger', onclick: function (e) {
                    UI.busy(e.currentTarget, async function () {
                      await Bot.reject(r, App);
                      UI.toast('Rad etildi.', 'ok'); App.render();
                    });
                  }
                }, 'Rad etish')
              ]);
            }
          }
        ], pending) : UI.empty({
          title: 'So’rov yo’q',
          text: 'O’quvchi botga /start bosib, ism-familiyasi va guruh kodini yozganda shu yerda paydo bo’ladi.'
        }), null, null, true));

      view.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('O’quvchi botga qanday ulanadi', [
        h('ol', { style: 'margin:0;padding-left:18px;line-height:1.9' }, [
          h('li', {}, 'O’quvchi botni ochadi va ' + h('b', {}, '').textContent + '/start bosadi.'),
          h('li', {}, 'Bot ism-familiyasini so’raydi.'),
          h('li', {}, 'Keyin guruh kodini so’raydi — masalan ' + (D.all('groups')[0] ? (D.all('groups')[0].code || 'A001') : 'A001') + '.'),
          h('li', {}, 'Kod to’g’ri bo’lsa, bot shu guruhdagi o’quvchilar ichidan ismni qidiradi.'),
          h('li', {}, 'Topilsa — darhol ulanadi. Topilmasa — shu yerga so’rov tushadi, siz qo’lda ulaysiz.')
        ])
      ])));
    }

    if (tab === 'xabar') {
      App.guard('bot.broadcast');
      var groups = A.scopeGroups(App.user, D.all('groups').filter(function (g) { return g.status !== 'yakunlangan'; }));
      var target = UI.field({
        label: 'Kimga', type: 'select', options: [
          { value: 'all', label: 'Barcha ulangan o’quvchilar (' + linked.length + ')' },
          { value: 'debt', label: 'Faqat qarzdorlar' }
        ].concat(groups.map(function (g) {
          return { value: 'g:' + g.id, label: A.groupLabel(g) };
        }))
      });
      var text = UI.field({ label: 'Xabar matni', type: 'textarea', rows: 5, full: true, required: true });
      var countBox = h('div', { class: 'small muted' });

      function recipients() {
        var v = target.input.value;
        if (v === 'all') return linked;
        if (v === 'debt') {
          var debtors = {};
          A.Q.debtors().forEach(function (d) { debtors[d.studentId] = 1; });
          return linked.filter(function (s) { return debtors[s.id]; });
        }
        var gid = v.slice(2);
        var ids = {};
        A.Q.membersOf(gid).forEach(function (m) { ids[m.studentId] = 1; });
        return linked.filter(function (s) { return ids[s.id]; });
      }
      function refreshCount() {
        countBox.textContent = recipients().length + ' ta o’quvchiga yuboriladi.';
      }
      target.input.addEventListener('change', refreshCount);
      refreshCount();

      view.appendChild(UI.card('Xabar yuborish', [
        h('div', { class: 'form-grid' }, [target.wrap, text.wrap]),
        countBox,
        h('div', { style: 'margin-top:14px' }, h('button', {
          class: 'btn primary', onclick: function (e) {
            var msg = text.input.value.trim();
            if (!msg) { UI.toast('Xabar matnini yozing.', 'bad'); return; }
            var list = recipients();
            if (!list.length) { UI.toast('Qabul qiluvchi yo’q.', 'bad'); return; }
            UI.busy(e.currentTarget, async function () {
              for (var i = 0; i < list.length; i++) {
                await Bot.enqueue(list[i].id, msg, 'elon');
              }
              await A.Ops.audit(App.user, 'Botda xabar yuborildi', list.length + ' ta o’quvchi', msg.slice(0, 40));
              text.input.value = '';
              UI.toast(list.length + ' ta xabar navbatga qo’yildi.', 'ok');
              App.render();
            });
          }
        }, [UI.icon('chat'), 'Yuborish']))
      ]));

      var sent = A.sortBy(D.all('botout'), 'createdAt', 'desc').slice(0, 40);
      view.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Oxirgi xabarlar',
        sent.length ? UI.table([
          { label: 'Vaqt', render: function (m) { return h('span', { class: 'mono small' }, m.createdAt); } },
          { label: 'O’quvchi', render: function (m) { return A.Q.studentName(m.studentId); } },
          { label: 'Turi', render: function (m) { return UI.pill(m.kind, 'mute'); } },
          { label: 'Matn', render: function (m) { return h('span', { class: 'small' }, String(m.text).slice(0, 60)); } },
          {
            label: 'Holat', render: function (m) {
              return m.status === 'sent' ? UI.pill('Yuborildi', 'ok') : UI.pill('Navbatda', 'warn');
            }
          }
        ], sent) : h('p', { class: 'muted' }, 'Hali xabar yo’q.'), null, null, true)));
    }

    if (tab === 'oquvchilar') {
      view.appendChild(UI.card(null, linked.length ? UI.table([
        { label: 'O’quvchi', render: function (s) { return h('b', {}, s.lastName + ' ' + s.firstName); } },
        {
          label: 'Guruhlar', render: function (s) {
            return A.Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; })
              .map(function (m) { return A.groupLabel(D.one('groups', m.groupId)); }).join(', ') || '—';
          }
        },
        { label: 'Telegram', render: function (s) { return h('span', { class: 'mono small' }, s.telegram.username ? '@' + s.telegram.username : s.telegram.id); } },
        { label: 'Ulangan', render: function (s) { return h('span', { class: 'small muted' }, s.telegram.linkedAt || '—'); } },
        {
          label: '', right: true, render: function (s) {
            if (!App.can('bot.manage')) return '';
            return h('button', {
              class: 'btn sm danger', onclick: async function () {
                if (!await UI.confirm('Ulanishni uzish', 'O’quvchi endi botdan xabar olmaydi.', 'Uzish', true)) return;
                var rec = A.clone(s); delete rec.telegram;
                await D.save('students', rec);
                UI.toast('Uzildi.', 'ok'); App.render();
              }
            }, 'Uzish');
          }
        }
      ], linked, { onRow: function (s) { App.go('student', { id: s.id }); } })
        : UI.empty({ title: 'Ulangan o’quvchi yo’q', text: 'O’quvchilar botga /start bosishi kerak.' }), null, null, true));
    }

    if (tab === 'sozlama') {
      App.guard('bot.manage');
      var f = UI.form([
        {
          name: 'username', label: 'Bot manzili (@siz)', value: conf.username,
          placeholder: 'albyana_bot', help: 'BotFather bergan bot nomi'
        },
        { name: 'welcome', label: 'Salomlashuv matni', type: 'textarea', value: conf.welcome, full: true },
        {
          name: 'notifyAttendance', label: 'Davomat belgilanganda xabar', type: 'select',
          value: conf.notifyAttendance ? 'yes' : 'no',
          options: [{ value: 'yes', label: 'Yuborilsin' }, { value: 'no', label: 'Yuborilmasin' }]
        },
        {
          name: 'notifyPayment', label: 'To’lov qabul qilinganda xabar', type: 'select',
          value: conf.notifyPayment ? 'yes' : 'no',
          options: [{ value: 'yes', label: 'Yuborilsin' }, { value: 'no', label: 'Yuborilmasin' }]
        },
        {
          name: 'autoApprove', label: 'Ism va guruh mos kelsa avtomatik ulash', type: 'select',
          value: conf.autoApprove ? 'yes' : 'no',
          options: [{ value: 'yes', label: 'Ha' }, { value: 'no', label: 'Yo’q — men tasdiqlayman' }]
        }
      ]);
      view.appendChild(UI.card('Bot sozlamalari', [
        h('div', { class: 'banner info' }, h('div', {}, [
          h('b', {}, 'Bot kaliti (token) bu yerda saqlanmaydi. '),
          'U faqat serverdagi .env faylida turadi — shunda hech kim uni ilova orqali ko’ra olmaydi.'
        ])),
        f.node,
        h('div', { style: 'margin-top:14px' }, h('button', {
          class: 'btn primary', onclick: function (e) {
            UI.busy(e.currentTarget, async function () {
              var v = f.values();
              await D.saveSettings(Object.assign({}, D.settings, {
                bot: {
                  username: v.username.replace('@', ''),
                  welcome: v.welcome,
                  notifyAttendance: v.notifyAttendance === 'yes',
                  notifyPayment: v.notifyPayment === 'yes',
                  notifyDebt: conf.notifyDebt,
                  autoApprove: v.autoApprove === 'yes'
                }
              }));
              await A.Ops.audit(App.user, 'Bot sozlamalari o’zgartirildi', v.username, '');
              UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }, 'Saqlash'))
      ]));
    }
  };

  function approveModal(req, App) {
    var candidates = [];
    var g = req.groupCode ? A.Q.groupByCode(req.groupCode) : null;
    if (g) {
      A.Q.membersOf(g.id).forEach(function (m) {
        var s = D.one('students', m.studentId);
        if (s && !(s.telegram && s.telegram.id)) candidates.push(s);
      });
    }
    if (!candidates.length) {
      candidates = D.all('students').filter(function (s) {
        return s.status !== 'arxiv' && !(s.telegram && s.telegram.id);
      });
    }
    candidates = A.sortBy(candidates, function (s) { return s.lastName + ' ' + s.firstName; });

    var pick = UI.field({
      label: 'Qaysi o’quvchi', type: 'select', required: true,
      value: req.matchStudentId || '',
      options: candidates.map(function (s) {
        return { value: s.id, label: s.lastName + ' ' + s.firstName + ' · ' + (s.parentPhone || s.phone || '') };
      })
    });
    UI.modal({
      title: 'Botga ulash',
      body: [
        h('dl', { class: 'kv' }, [
          h('dt', {}, 'Yozgan ism'), h('dd', {}, req.name || '—'),
          h('dt', {}, 'Guruh kodi'), h('dd', {}, req.groupCode || '—'),
          h('dt', {}, 'Telegram'), h('dd', {}, req.username ? '@' + req.username : String(req.chatId))
        ]),
        pick.wrap
      ],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Ulash', cls: 'primary', onClick: function (c, btn) {
            if (!pick.input.value) { UI.toast('O’quvchini tanlang.', 'bad'); return; }
            UI.busy(btn, async function () {
              await Bot.approve(req, pick.input.value, App);
              c(); UI.toast('Ulandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
