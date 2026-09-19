/* Albyana ERP — Suhbat (ichki chat) va Vazifalar */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  A.Pages = A.Pages || {};

  var GENERAL = 'chat_umumiy';
  var MAX_MSG = 200;

  function threadId(a, b) {
    return 'chat_' + [a, b].sort().join('__');
  }
  function userName(id) {
    var u = D.one('users', id);
    return u ? u.name : '—';
  }
  function otherMember(chat, meId) {
    return (chat.members || []).filter(function (m) { return m !== meId; })[0];
  }
  function chatTitle(chat, meId) {
    if (chat.type === 'group') return chat.title || 'Umumiy suhbat';
    return userName(otherMember(chat, meId));
  }
  function unreadCount(chat, meId) {
    var readAt = (chat.readAt || {})[meId] || '';
    return (chat.messages || []).filter(function (m) {
      return m.from !== meId && String(m.at) > String(readAt);
    }).length;
  }
  A.chatUnreadTotal = function (meId) {
    return D.all('chats').reduce(function (s, c) { return s + unreadCount(c, meId); }, 0);
  };

  /* ================= SUHBAT ================= */
  var chatUnsub = null;
  A.Pages.chat = function (view, route, App) {
    App.guard('nav.chat');
    var me = App.user;
    var users = A.sortBy(D.all('users').filter(function (u) { return u.active !== false; }), 'name');

    // Umumiy suhbat mavjudligini ta'minlash
    var general = D.one('chats', GENERAL);
    if (!general) {
      general = { id: GENERAL, type: 'group', title: 'Umumiy suhbat', members: [], messages: [], readAt: {}, updatedAt: A.nowStamp() };
      D.save('chats', general);
    }

    if (chatUnsub) { try { chatUnsub(); } catch (e) { } chatUnsub = null; }
    chatUnsub = D.subscribe('chats', function () {
      if (App.route.name === 'chat') App.softRender();
    });

    var myChats = D.all('chats').filter(function (c) {
      return c.type === 'group' || (c.members || []).indexOf(me.id) >= 0;
    });
    myChats = A.sortBy(myChats, 'updatedAt', 'desc');

    var activeId = route.chatId || (myChats[0] ? myChats[0].id : GENERAL);
    var active = D.one('chats', activeId) || general;

    view.appendChild(UI.pageHead('Suhbat', 'Xodimlar o’rtasidagi ichki yozishmalar', [
      h('button', {
        class: 'btn primary', onclick: function () { newChat(users, me, App); }
      }, [UI.icon('plus'), 'Yangi suhbat'])
    ]));

    var list = h('div', { class: 'chat-list' });
    // umumiy
    [general].concat(myChats.filter(function (c) { return c.id !== GENERAL; })).forEach(function (c) {
      var n = unreadCount(c, me.id);
      var last = (c.messages || [])[(c.messages || []).length - 1];
      list.appendChild(h('div', {
        class: 'list-item' + (c.id === active.id ? ' active' : ''),
        style: c.id === active.id ? 'background:var(--brand-soft)' : '',
        onclick: function () { App.go('chat', { chatId: c.id }); }
      }, [
        UI.avatar(chatTitle(c, me.id)),
        h('div', { class: 'main-col' }, [
          h('b', {}, chatTitle(c, me.id)),
          h('span', {}, last ? ((last.from === me.id ? 'Siz: ' : '') + String(last.text).slice(0, 34)) : 'Xabar yo’q')
        ]),
        n ? h('span', { class: 'chat-unread' }, n) : null
      ]));
    });

    var msgs = h('div', { class: 'chat-msgs' });
    (active.messages || []).forEach(function (m) {
      msgs.appendChild(h('div', { class: 'msg' + (m.from === me.id ? ' me' : '') }, [
        h('div', {}, m.text),
        h('div', { class: 'meta' }, (m.from === me.id ? 'Siz' : userName(m.from)) + ' · ' + m.at)
      ]));
    });
    if (!(active.messages || []).length) {
      msgs.appendChild(h('div', { class: 'empty' }, [
        h('h3', {}, 'Xabar yo’q'),
        h('p', {}, 'Birinchi xabarni yozing.')
      ]));
    }

    var input = h('input', {
      type: 'text', id: 'chat-input', placeholder: 'Xabar yozing…',
      autocomplete: 'off', 'aria-label': 'Xabar'
    });
    var form = h('form', {
      class: 'chat-form',
      onsubmit: function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        if (!App.can('chat.use')) { UI.toast('Sizda xabar yozish ruxsati yo’q.', 'bad'); return; }
        input.value = '';
        send(active, me, text, App);
      }
    }, [input, h('button', { class: 'btn primary', type: 'submit' }, 'Yuborish')]);

    var pane = h('div', { class: 'chat-main' }, [
      h('div', { class: 'card-head' }, [h('h2', {}, chatTitle(active, me.id))]),
      msgs,
      App.can('chat.use') ? form : h('div', { class: 'chat-form' }, h('span', { class: 'muted small' }, 'Sizda xabar yozish ruxsati yo’q.'))
    ]);

    view.appendChild(h('section', { class: 'card' }, h('div', { class: 'chat' }, [list, pane])));
    setTimeout(function () { msgs.scrollTop = msgs.scrollHeight; }, 30);

    // o'qilgan deb belgilash
    if (unreadCount(active, me.id) > 0) {
      var upd = A.clone(active);
      upd.readAt = upd.readAt || {};
      upd.readAt[me.id] = A.nowStamp();
      D.save('chats', upd);
    }
  };

  async function send(chat, me, text, App) {
    var doc = A.clone(D.one('chats', chat.id) || chat);
    doc.messages = (doc.messages || []).concat([{
      id: A.uid('msg'), from: me.id, text: text, at: A.nowStamp()
    }]);
    if (doc.messages.length > MAX_MSG) doc.messages = doc.messages.slice(-MAX_MSG);
    doc.updatedAt = A.nowStamp();
    doc.readAt = doc.readAt || {};
    doc.readAt[me.id] = doc.updatedAt;
    await D.save('chats', doc);
    App.render();
  }

  function newChat(users, me, App) {
    var others = users.filter(function (u) { return u.id !== me.id; });
    if (!others.length) {
      UI.toast('Boshqa foydalanuvchi yo’q.', 'bad');
      return;
    }
    var list = h('div', { class: 'list', style: 'border:1px solid var(--line);border-radius:10px' },
      others.map(function (u) {
        return h('div', {
          class: 'list-item', onclick: async function () {
            m.close();
            var id = threadId(me.id, u.id);
            if (!D.one('chats', id)) {
              await D.save('chats', {
                id: id, type: 'direct', members: [me.id, u.id],
                messages: [], readAt: {}, updatedAt: A.nowStamp()
              });
            }
            App.go('chat', { chatId: id });
          }
        }, [
          UI.avatar(u.name),
          h('div', { class: 'main-col' }, [h('b', {}, u.name), h('span', {}, A.ROLES[u.role] || u.role)])
        ]);
      }));
    var m = UI.modal({ title: 'Yangi suhbat', body: list });
  }

  /* ================= VAZIFALAR ================= */
  var TASK_STATUS = [
    { id: 'yangi', label: 'Yangi', cls: 'info' },
    { id: 'bajarilmoqda', label: 'Bajarilmoqda', cls: 'warn' },
    { id: 'bajarildi', label: 'Bajarildi', cls: 'ok' }
  ];
  function statusOf(id) {
    return TASK_STATUS.filter(function (s) { return s.id === id; })[0] || TASK_STATUS[0];
  }

  A.Pages.tasks = function (view, route, App) {
    App.guard('nav.tasks');
    var me = App.user;
    var scope = route.scope || 'mine';
    var all = D.all('tasks');
    var list = all.filter(function (t) {
      if (scope === 'mine') return t.assigneeId === me.id;
      if (scope === 'given') return t.createdById === me.id;
      return true;
    });
    if (route.status) list = list.filter(function (t) { return t.status === route.status; });
    list = A.sortBy(list, function (t) { return (t.status === 'bajarildi' ? '9' : '0') + (t.due || '9999'); });

    view.appendChild(UI.pageHead('Vazifalar', 'Xodimlarga topshiriq berish va bajarilishini kuzatish', [
      App.can('task.assign') ? h('button', {
        class: 'btn primary', onclick: function () { taskForm(null, App); }
      }, [UI.icon('plus'), 'Vazifa berish']) : null
    ]));

    var counts = {
      mine: all.filter(function (t) { return t.assigneeId === me.id && t.status !== 'bajarildi'; }).length,
      given: all.filter(function (t) { return t.createdById === me.id && t.status !== 'bajarildi'; }).length
    };
    view.appendChild(h('div', { class: 'filters' }, [
      h('div', { class: 'seg' }, [
        { id: 'mine', label: 'Menga berilgan (' + counts.mine + ')' },
        { id: 'given', label: 'Men berganlarim (' + counts.given + ')' },
        { id: 'all', label: 'Barchasi' }
      ].map(function (s) {
        return h('button', {
          type: 'button', 'aria-pressed': scope === s.id ? 'true' : 'false',
          onclick: function () { App.go('tasks', { scope: s.id }); }
        }, s.label);
      }))
    ]));

    if (!list.length) {
      view.appendChild(UI.card(null, UI.empty({
        title: 'Vazifa yo’q',
        text: scope === 'mine' ? 'Sizga hozircha vazifa berilmagan.' : 'Xodimga topshiriq bering — muddati va holati kuzatiladi.',
        action: App.can('task.assign') ? { label: 'Vazifa berish', onClick: function () { taskForm(null, App); } } : null
      })));
      return;
    }

    view.appendChild(UI.card(null, UI.table([
      {
        label: 'Vazifa', render: function (t) {
          return h('div', {}, [
            h('b', {}, t.title),
            t.description ? h('div', { class: 'small muted' }, t.description) : null
          ]);
        }
      },
      { label: 'Kim uchun', render: function (t) { return userName(t.assigneeId); } },
      { label: 'Kim berdi', render: function (t) { return userName(t.createdById); } },
      {
        label: 'Muddati', render: function (t) {
          if (!t.due) return h('span', { class: 'muted' }, '—');
          var late = t.due < A.today() && t.status !== 'bajarildi';
          return late ? UI.pill(A.dateLabel(t.due), 'bad') : h('span', { class: 'mono' }, A.dateLabel(t.due));
        }
      },
      { label: 'Holat', render: function (t) { var s = statusOf(t.status); return UI.pill(s.label, s.cls); } },
      {
        label: '', right: true, render: function (t) {
          var canEdit = t.assigneeId === me.id || t.createdById === me.id || App.can('task.assign');
          if (!canEdit) return '';
          return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
            t.status !== 'bajarildi' ? h('button', {
              class: 'btn sm primary', onclick: function (e) {
                e.stopPropagation();
                UI.busy(e.currentTarget, async function () {
                  var rec = A.clone(t);
                  rec.status = rec.status === 'yangi' ? 'bajarilmoqda' : 'bajarildi';
                  rec.updatedAt = A.nowStamp();
                  if (rec.status === 'bajarildi') rec.doneAt = A.nowStamp();
                  await D.save('tasks', rec);
                  await A.Ops.audit(App.user, 'Vazifa holati o’zgardi', rec.title, rec.status);
                  App.render();
                });
              }
            }, t.status === 'yangi' ? 'Boshlash' : 'Bajarildi') : null,
            h('button', { class: 'btn sm', onclick: function (e) { e.stopPropagation(); taskForm(t, App); } }, 'Ochish')
          ]);
        }
      }
    ], list, { onRow: function (t) { taskForm(t, App); } }), null, null, true));
  };

  function taskForm(task, App) {
    var isNew = !task;
    if (isNew) App.guard('task.assign');
    var t = task || { status: 'yangi', due: A.addDays(A.today(), 1) };
    var users = A.sortBy(D.all('users').filter(function (u) { return u.active !== false; }), 'name');
    var f = UI.form([
      { name: 'title', label: 'Vazifa', required: true, value: t.title, full: true },
      { name: 'description', label: 'Tavsif', type: 'textarea', value: t.description, full: true },
      {
        name: 'assigneeId', label: 'Kim uchun', type: 'select', required: true, value: t.assigneeId,
        options: users.map(function (u) { return { value: u.id, label: u.name + ' · ' + (A.ROLES[u.role] || u.role) }; })
      },
      { name: 'due', label: 'Muddati', type: 'date', value: t.due },
      {
        name: 'status', label: 'Holat', type: 'select', value: t.status,
        options: TASK_STATUS.map(function (s) { return { value: s.id, label: s.label }; })
      }
    ]);
    UI.modal({
      title: isNew ? 'Yangi vazifa' : 'Vazifa',
      body: f.node,
      actions: [
        (!isNew && (t.createdById === App.user.id || App.can('task.assign'))) ? {
          label: 'O’chirish', cls: 'danger', onClick: async function (c) {
            if (await UI.confirm('Vazifani o’chirish', 'Vazifa butunlay o’chiriladi.', 'O’chirish', true)) {
              await D.remove('tasks', t.id);
              c(); UI.toast('O’chirildi.', 'ok'); App.render();
            }
          }
        } : null,
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              var rec = Object.assign({}, t, f.values());
              if (isNew) {
                rec.id = A.uid('tsk');
                rec.createdById = App.user.id;
                rec.createdAt = A.nowStamp();
              }
              rec.updatedAt = A.nowStamp();
              await D.save('tasks', rec);
              await A.Ops.audit(App.user, isNew ? 'Vazifa berildi' : 'Vazifa o’zgartirildi',
                rec.title, userName(rec.assigneeId));
              c(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }

  A.taskForm = taskForm;
  A.TASK_STATUS = TASK_STATUS;
})(typeof window !== 'undefined' ? window : globalThis);
