/* Albyana ERP — ilova: kirish, menyu, yo'naltirish */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;

  var App = {
    user: null,
    route: { name: 'dashboard' },
    _renderTimer: null,

    /* ---------- Huquq ---------- */
    can: function (perm) { return A.can(App.user, perm); },
    guard: function (perm) {
      if (!App.can(perm)) {
        var e = new Error('Sizda bu amal uchun ruxsat yo’q.');
        e.code = 'forbidden';
        throw e;
      }
      return true;
    },

    _hashLock: false,

    go: function (name, params) {
      App.route = Object.assign({ name: name }, params || {});
      App.pushHash(App.route);
      App.render();
      window.scrollTo(0, 0);
    },

    /** Joriy sahifani manzil satriga yozish — Orqaga tugmasi va yangilash ishlaydi */
    pushHash: function (r) {
      var h = routeToHash(r);
      if (('#' + location.hash.replace(/^#/, '')) === h) return;
      App._hashLock = true;
      try { location.hash = h; } catch (e) { }
      setTimeout(function () { App._hashLock = false; }, 0);
    },

    /** Oldingi sahifaga qaytish (saqlagandan keyin shu yerda qolib ketmasin) */
    back: function (fallback) {
      if (history.length > 1) { history.back(); return; }
      App.go(fallback || 'dashboard');
    },

    render: function () {
      if (!App.user) return;
      var view = document.getElementById('view');
      UI.clear(view);
      renderNav();
      var page = A.Pages[App.route.name];
      if (!page) { view.appendChild(UI.empty({ title: 'Sahifa topilmadi' })); return; }
      try {
        page(view, App.route, App);
      } catch (e) {
        console.error(e);
        view.appendChild(h('div', { class: 'banner warn' }, [
          h('div', {}, [h('b', {}, 'Sahifani ochib bo’lmadi. '), e.message || String(e)])
        ]));
      }
    },
    softRender: function () {
      clearTimeout(App._renderTimer);
      App._renderTimer = setTimeout(function () { App.render(); }, 120);
    }
  };

  /* ---------- Manzil satri (hash) bilan ishlash ---------- */
  function routeToHash(r) {
    if (!r || !r.name) return '#dashboard';
    var parts = Object.keys(r).filter(function (k) {
      return k !== 'name' && r[k] != null && r[k] !== '' && r[k] !== false;
    });
    return '#' + r.name + (parts.length
      ? '?' + parts.map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(r[k]); }).join('&')
      : '');
  }
  function hashToRoute() {
    var h = String(location.hash || '').replace(/^#/, '');
    if (!h) return null;
    var i = h.indexOf('?');
    var name = i < 0 ? h : h.slice(0, i);
    if (!name || !A.Pages[name]) return null;
    var r = { name: name };
    if (i >= 0) {
      h.slice(i + 1).split('&').filter(Boolean).forEach(function (kv) {
        var j = kv.indexOf('=');
        var k = decodeURIComponent(j < 0 ? kv : kv.slice(0, j));
        var v = j < 0 ? '' : decodeURIComponent(kv.slice(j + 1));
        r[k] = (v === 'true') ? true : v;
      });
    }
    return r;
  }
  function onHashChange() {
    if (App._hashLock) return;
    // Kirmagan foydalanuvchi: ochiq sahifalar orasida yurish (orqaga/oldinga ham ishlaydi)
    if (!App.user) {
      var where = String(location.hash || '').replace('#', '').split('?')[0];
      if (where === 'kabinet') { renderKabinet(); return; }
      if (where === 'test' || where === 'daraja') { renderTest(); return; }
      if (where === 'ustoz') { renderTeacherFromHash(); return; }
      if (where === 'kirish' || where === 'login') { renderLogin(null); return; }
      if (!where) { renderLanding(); return; }
      return;
    }
    var r = hashToRoute();
    if (!r) return;
    App.route = r;
    App.render();
    window.scrollTo(0, 0);
  }

  /* ---------- Menyu ---------- */
  var NAV = [
    { id: 'dashboard', label: 'Bosh sahifa', icon: 'home', perm: 'nav.dashboard' },
    { id: 'leads', label: 'Murojaatlar', icon: 'phone', perm: 'nav.leads' },
    { id: 'students', label: 'O’quvchilar', icon: 'users', perm: 'nav.students' },
    { id: 'groups', label: 'Guruhlar', icon: 'layers', perm: 'nav.groups' },
    { id: 'schedule', label: 'Jadval', icon: 'calendar', perm: 'nav.schedule' },
    { id: 'attendance', label: 'Davomat', icon: 'check', perm: 'nav.attendance' },
    { id: 'curriculum', label: 'O’quv dasturi', icon: 'layers', perm: 'nav.curriculum' },
    { id: 'learning', label: 'Dars jarayoni', icon: 'task', perm: 'lesson.log' },
    { id: 'finance', label: 'Moliya', icon: 'wallet', perm: 'nav.finance' },
    { id: 'staff', label: 'Xodimlar', icon: 'badge', perm: 'nav.staff' },
    { id: 'reports', label: 'Hisobotlar', icon: 'chart', perm: 'nav.reports' },
    { id: 'progress', label: 'O’quv natijalari', icon: 'chart', perm: 'reports.learning' },
    { id: 'chat', label: 'Suhbat', icon: 'chat', perm: 'nav.chat' },
    { id: 'tasks', label: 'Vazifalar', icon: 'task', perm: 'nav.tasks' },
    { id: 'bot', label: 'Telegram bot', icon: 'bot', perm: 'nav.bot' },
    { id: 'settings', label: 'Sozlamalar', icon: 'gear', perm: 'settings.edit' }
  ];

  function allowedNav() {
    return NAV.filter(function (n) { return App.can(n.perm); });
  }

  function renderNav() {
    var nav = UI.clear(document.getElementById('nav'));
    allowedNav().forEach(function (n) {
      var active = App.route.name === n.id ||
        (n.id === 'students' && App.route.name === 'student') ||
        (n.id === 'groups' && App.route.name === 'group');
      var b = h('button', {
        type: 'button', 'aria-current': active ? 'page' : null,
        onclick: function () { App.go(n.id); }
      }, [UI.icon(n.icon), n.label]);
      nav.appendChild(b);
    });

    var tabbar = UI.clear(document.getElementById('tabbar'));
    quickItems().forEach(function (n) {
      tabbar.appendChild(h('button', {
        type: 'button',
        'aria-current': (!n.action && App.route.name === n.id) ? 'page' : null,
        onclick: n.action || function () { App.go(n.id); }
      }, [UI.icon(n.icon), h('span', {}, n.label)]));
    });
    tabbar.appendChild(h('button', {
      type: 'button', onclick: openMenuSheet
    }, [UI.icon('layers'), h('span', {}, 'Menyu')]));
  }

  /**
   * Telefon pastki menyusi — rolga mos, ko'pi bilan 5 ta element
   * (beshinchisi doim "Menyu").
   */
  function quickItems() {
    var role = App.user.role;
    var want = {
      admin: ['dashboard', 'students', 'PAY', 'attendance'],
      oqituvchi: ['schedule', 'groups', 'attendance'],
      direktor: ['dashboard', 'students', 'finance', 'reports'],
      buxgalter: ['dashboard', 'finance', 'PAY', 'reports']
    }[role] || ['dashboard', 'students', 'attendance', 'finance'];

    var out = [];
    want.forEach(function (id) {
      if (id === 'PAY') {
        if (App.can('payment.create')) {
          out.push({
            id: 'PAY', label: 'To’lov', icon: 'money',
            action: function () { A.paymentForm(null, App); }
          });
        }
        return;
      }
      var n = NAV.filter(function (x) { return x.id === id; })[0];
      if (n && App.can(n.perm)) {
        out.push({ id: n.id, label: n.id === 'schedule' && role === 'oqituvchi' ? 'Darslarim' : n.label, icon: n.icon });
      }
    });
    // bo'sh joy qolsa — ruxsat bor boshqa bo'limlar bilan to'ldiramiz
    allowedNav().forEach(function (n) {
      if (out.length >= 4) return;
      if (out.some(function (x) { return x.id === n.id; })) return;
      out.push({ id: n.id, label: n.label, icon: n.icon });
    });
    return out.slice(0, 4);
  }

  function openMenuSheet() {
    var list = h('div', { class: 'menu-sheet' }, allowedNav().map(function (n) {
      var here = App.route.name === n.id;
      return h('button', {
        class: 'menu-item', type: 'button',
        'aria-current': here ? 'page' : null,
        onclick: function () { m.close(); App.go(n.id); }
      }, [
        UI.icon(n.icon),
        h('b', {}, n.label)
      ]);
    }));
    var m = UI.modal({
      title: 'Menyu', body: list,
      actions: [{ label: 'Chiqish', cls: 'danger', onClick: function (c) { c(); logout(); } }]
    });
  }

  /* ---------- Kirish ---------- */
  async function hashPass(login, pass, salt) {
    return await A.sha256(login.toLowerCase() + '::' + pass + '::' + salt);
  }

  /* Markaz nomi: avval serverdagi nom, bo'lmasa brauzerdagi nusxa, oxirida standart.
     Eski nusxa qolib ketmasin uchun server nomi kelganda yangilanadi. */
  function centerNameNow() {
    return (D.settings && D.settings.centerName) || 'AlBayan Cairo';
  }
  async function refreshCenterName() {
    try {
      var r = await fetch('/api/public', { credentials: 'same-origin' });
      if (!r.ok) return;
      var j = await r.json();
      if (!j || !j.centerName) return;
      if (D.settings && D.settings.centerName !== j.centerName) {
        D.settings.centerName = j.centerName;           // eski nusxani tuzatamiz
      }
      var el = document.getElementById('login-center');
      if (el) el.textContent = j.centerName;
    } catch (e) { /* internet yo'q — shu holicha qoladi */ }
  }

  function renderLogin(msg) {
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'screen';
    UI.clear(wrap);

    var fLogin = UI.field({ label: 'Login', id: 'login-user', required: true, autocomplete: 'username' });
    var fPass = UI.field({ label: 'Parol', id: 'login-pass', type: 'password', required: true, autocomplete: 'current-password' });
    var err = h('div', { class: 'err-msg', hidden: true });
    var hint = D.all('users').some(function (u) { return u.login === 'admin' && u.isDefault; })
      ? h('div', { class: 'banner info', style: 'margin:0' }, h('div', {}, [
        h('b', {}, 'Birinchi kirish: '), 'login ', h('b', {}, 'admin'), ', parol ', h('b', {}, '1234'), '. Sozlamalar bo’limida parolni albatta o’zgartiring.'
      ]))
      : null;

    var btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Kirish');
    var formEl = h('form', { class: 'login', onsubmit: onSubmit }, [
      h('div', { class: 'brandline' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [
          h('h1', { id: 'login-center' }, centerNameNow()),
          h('div', { class: 'sub' }, 'O’quv markazi boshqaruv tizimi')
        ])
      ]),
      msg ? h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, msg)) : null,
      hint,
      fLogin.wrap, fPass.wrap, err, btn,
      h('div', { class: 'small muted', style: 'text-align:center' },
        D.mode === 'local'
          ? 'Diqqat: baza ulanmadi, ma’lumotlar faqat shu brauzerda saqlanadi.'
          : 'Ma’lumotlar markaz bazasida saqlanadi.'),
      D.mode === 'server' ? h('div', { class: 'login-alt' }, [
        h('span', { class: 'small muted' }, 'O’quvchimisiz?'),
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { location.hash = 'kabinet'; renderKabinet(); }
        }, 'Shaxsiy kod bilan kirish')
      ]) : null
    ]);
    wrap.appendChild(formEl);
    refreshCenterName();

    function onSubmit(e) {
      e.preventDefault();
      err.hidden = true;
      var login = fLogin.input.value.trim().toLowerCase();
      var pass = fPass.input.value;
      if (!login || !pass) { err.hidden = false; err.textContent = 'Login va parolni kiriting.'; return; }
      UI.busy(btn, async function () {
        if (D.mode === 'server') {
          try {
            var su = await D.serverLogin(login, pass);
            await startSession(su);
          } catch (ex) {
            err.hidden = false;
            err.textContent = ex.message || 'Kirishda xatolik.';
          }
          return;
        }
        var user = D.all('users').filter(function (u) { return String(u.login).toLowerCase() === login; })[0];
        if (!user || user.active === false) {
          err.hidden = false; err.textContent = 'Login yoki parol xato.'; return;
        }
        var hashed = await hashPass(user.login, pass, user.salt);
        if (hashed !== user.hash) { err.hidden = false; err.textContent = 'Login yoki parol xato.'; return; }
        await startSession(user);
      });
    }
  }


  /* ---------- O'quvchi kabineti (kirishsiz, shaxsiy kod bilan) ----------
     O'quvchi 4 xonali kodini kiritadi va o'z ma'lumotini ko'radi:
     guruhi, jadvali, keyingi to'lovi va davomati. Xodimlar tizimiga aloqasi yo'q. */
  function renderKabinet(prefill) {
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'screen';
    UI.clear(wrap);

    var err = h('div', { class: 'err-msg', hidden: true });
    var result = h('div', { class: 'kab-result' });
    var info = h('p', { class: 'small muted', style: 'margin:0' }, 'Tekshirilmoqda…');

    var box = h('div', { class: 'login kabinet' }, [
      h('div', { class: 'brandline' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [
          h('h1', { id: 'kab-center' }, centerNameNow()),
          h('div', { class: 'sub', id: 'kab-sub' }, 'Shaxsiy kabinet')
        ])
      ]),
      info, err, result,
      h('div', { class: 'login-alt' }, [
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { location.hash = ''; renderLanding(); }
        }, 'Bosh sahifa'),
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { location.hash = ''; renderLogin(null); }
        }, 'Xodimlar kirishi')
      ])
    ]);
    wrap.appendChild(box);
    refreshCenterName();
    start();

    /* Kirish tartibi:
       1) manzilda bir martalik havola (?t=...) bo'lsa — uni sessiyaga almashtiramiz;
       2) sessiya bo'lsa — ma'lumot darhol chiqadi (kod qayta so'ralmaydi);
       3) bo'lmasa — 4 xonali kod so'raladi. */
    async function start() {
      var token = tokenFromHash();
      if (token) {
        try {
          await D.api('POST', 'api/kabinet/session', { token: token });
          cleanHash();
        } catch (ex) {
          info.hidden = true;
          err.hidden = false;
          err.textContent = ex.message || 'Havola yaroqsiz.';
          showForm();
          return;
        }
      }
      try {
        var d = await D.api('GET', 'api/kabinet/me');
        D.kabCsrf = d.csrf || '';
        info.hidden = true;
        showInfo(d);
      } catch (ex) {
        info.hidden = true;
        showForm();
      }
    }

    function tokenFromHash() {
      var m = /[?&]t=([A-Za-z0-9_.-]+)/.exec(String(location.hash || ''));
      return m ? m[1] : '';
    }
    function cleanHash() {
      try { history.replaceState(null, '', location.pathname + '#kabinet'); } catch (e) { }
    }

    /* 4 xonali shaxsiy kod bilan kirish.
       Kod yozilgandan keyin 30 kunlik sessiya beriladi — shu qurilmada
       qayta yozish shart emas. Umumiy kompyuterda “Chiqish” tugmasi bor. */
    function showForm() {
      UI.clear(result);
      var input = h('input', {
        id: 'kab-code', class: 'kab-code', type: 'text', inputmode: 'numeric',
        autocomplete: 'off', maxlength: '4', placeholder: '····',
        'aria-label': 'Shaxsiy kod'
      });
      var btn = h('button', { class: 'btn primary', type: 'submit' }, 'Kirish');
      var form = h('form', {
        class: 'kab-form',
        onsubmit: function (e) { e.preventDefault(); go(); }
      }, [
        h('label', { class: 'small', for: 'kab-code' }, 'Shaxsiy kodingiz (4 ta raqam)'),
        h('div', { class: 'kab-row' }, [input, btn])
      ]);

      input.addEventListener('input', function () {
        input.value = input.value.replace(/\D/g, '').slice(0, 4);
        err.hidden = true;
        if (input.value.length === 4) go();
      });

      async function go() {
        var code = String(input.value || '').replace(/\D/g, '');
        if (code.length !== 4) {
          err.hidden = false; err.textContent = 'Kod 4 ta raqamdan iborat.';
          return;
        }
        btn.disabled = true; btn.textContent = 'Tekshirilmoqda…'; err.hidden = true;
        try {
          var d = await D.api('POST', 'api/kabinet', { code: code });
          D.kabCsrf = d.csrf || '';
          showInfo(d);
        } catch (ex) {
          btn.disabled = false; btn.textContent = 'Kirish';
          input.value = ''; input.focus();
          err.hidden = false;
          err.textContent = ex.message || 'Kod topilmadi.';
        }
      }

      result.appendChild(h('div', { class: 'kab-howto' }, [
        form,
        h('p', { class: 'small muted' },
          'Kodni bilmasangiz markaz administratoridan so’rang. ' +
          'Telegram botdagi “Kabinet (veb)” tugmasi ham shu sahifani ochadi.')
      ]));
      try { input.focus(); } catch (e) { }
    }

    /* Kabinet ikki xil bo'ladi: o'quvchi va ota-ona.
       Ota-onaga farzandlari ro'yxati chiqadi. */
    function showInfo(d) {
      if (d && d.kind === 'parent') return showParent(d);
      UI.clear(result);
      var sub0 = document.getElementById('kab-sub');
      if (sub0) sub0.textContent = 'O’quvchi kabineti';
      var st = d.student, fin = d.finance, att = d.attendance;

      var money = fin.debt > 0
        ? h('div', { class: 'kab-money bad' }, [
          h('span', {}, 'Qarz'), h('b', {}, A.somFull(fin.debt))
        ])
        : (fin.advance > 0
          ? h('div', { class: 'kab-money ok' }, [h('span', {}, 'Avans'), h('b', {}, A.somFull(fin.advance))])
          : h('div', { class: 'kab-money ok' }, [h('span', {}, 'To’lov'), h('b', {}, 'Qarz yo’q')]));

      var next = fin.next ? h('div', { class: 'kab-line' }, [
        h('span', {}, fin.next.upcoming ? 'Keyingi hisob' : 'Keyingi to’lov'),
        h('b', {}, (fin.next.upcoming ? '' : A.som(fin.next.amount) + ' so’m · ') +
          A.dateLabel(fin.next.dueDate) + ' gacha')
      ]) : null;

      result.appendChild(h('div', { class: 'kab-card' }, [
        h('div', { class: 'kab-head' }, [
          UI.avatar(st.name),
          h('div', { class: 'main-col' }, [
            h('b', {}, st.name),
            h('span', { class: 'small muted' }, 'Kod: ' + st.code)
          ])
        ]),

        h('h3', {}, 'Guruhlarim'),
        d.groups.length
          ? h('div', { class: 'kab-groups' }, d.groups.map(function (g) {
            return h('div', { class: 'kab-group' }, [
              h('b', {}, (g.code ? g.code + ' · ' : '') + g.name),
              g.teacher ? h('div', { class: 'small' }, 'O’qituvchi: ' + g.teacher) : null,
              h('div', { class: 'small muted' },
                [g.daysText, (g.startTime && g.endTime) ? g.startTime + '–' + g.endTime : '', g.room]
                  .filter(Boolean).join('  ·  '))
            ]);
          }))
          : h('p', { class: 'muted small' }, 'Hozircha guruhga yozilmagansiz.'),

        h('h3', {}, 'To’lov'),
        money,
        next,
        fin.overdue > 0 ? h('div', { class: 'kab-line warn' }, [
          h('span', {}, 'Muddati o’tgan'), h('b', {}, A.somFull(fin.overdue))
        ]) : null,

        h('h3', {}, 'Davomat'),
        att.total ? h('div', {}, [
          h('div', { class: 'kab-stats' }, [
            h('div', {}, [h('b', {}, String(att.attended)), h('span', {}, 'Keldi')]),
            h('div', {}, [h('b', {}, String(att.missed)), h('span', {}, 'Kelmadi')]),
            h('div', {}, [h('b', {}, String(att.late)), h('span', {}, 'Kechikdi')]),
            h('div', {}, [h('b', {}, String(att.excused)), h('span', {}, 'Sababli')])
          ]),
          h('div', { class: 'small muted' }, 'Jami dars: ' + att.total +
            (att.percent != null ? '  ·  ' + att.percent + '%' : '')),
          att.last.length ? h('div', { class: 'kab-last' }, att.last.slice(0, 5).map(function (r) {
            return h('div', { class: 'kab-line' }, [
              h('span', {}, A.dateLabel(r.date)), h('b', {}, r.label)
            ]);
          })) : null
        ]) : h('p', { class: 'muted small' }, 'Hozircha davomat yozuvi yo’q.'),

        h('div', { class: 'small muted', style: 'margin-top:10px' },
          'Savol bo’lsa markazga murojaat qiling' + (d.center.phone ? ': ' + d.center.phone : '.')),

        /* O'quv bo'limi: vazifa, test, savol-javob */
        learnSection(st.id, true),

        /* Umumiy (birovning) kompyuterida kabinetni yopish uchun. */
        h('div', { class: 'kab-out' }, [
          h('button', {
            class: 'btn sm', type: 'button',
            onclick: async function () {
              try { await D.api('POST', 'api/kabinet/logout', {}); } catch (e) { }
              err.hidden = true;
              showForm();
            }
          }, 'Chiqish')
        ])
      ]));
      A.I18N.apply(result);
    }

    /* ---- Ota-ona kabineti: farzandlar ro'yxati ---- */
    function showParent(d) {
      UI.clear(result);
      var sub = document.getElementById('kab-sub');
      if (sub) sub.textContent = 'Ota-ona kabineti';
      var kids = d.children || [];
      result.appendChild(h('div', { class: 'kab-card' }, [
        h('div', { class: 'kab-head' }, [
          UI.avatar(d.parent.name),
          h('div', { class: 'main-col' }, [
            h('b', {}, d.parent.name),
            h('span', { class: 'small muted' },
              'Ota-ona kabineti' + (d.parent.relation ? ' · ' + d.parent.relation : ''))
          ])
        ]),
        kids.length ? null : h('p', { class: 'muted small' },
          'Sizga hali farzand biriktirilmagan. Markazga murojaat qiling.'),
        h('div', { class: 'kab-sec' }, kids.map(function (k) {
          var fin = k.finance || {}, att = k.attendance || {};
          return h('div', { class: 'kab-kid' }, [
            h('b', {}, k.student.name),
            h('span', { class: 'small muted' },
              (k.groups || []).map(function (g) { return g.name; }).join(', ') || 'Guruhga yozilmagan'),
            h('div', { class: 'kab-line' }, [
              h('span', {}, 'To’lov'),
              h('b', {}, fin.debt > 0 ? A.somFull(fin.debt) + ' qarz' : 'Qarz yo’q')
            ]),
            h('div', { class: 'kab-line' }, [
              h('span', {}, 'Davomat'),
              h('b', {}, att.total
                ? (att.percent != null ? att.percent + '%' : att.attended + '/' + att.total)
                : 'Yozuv yo’q')
            ]),
            k.quizzes && k.quizzes.count ? h('div', { class: 'kab-line' }, [
              h('span', {}, 'Testlar'),
              h('b', {}, k.quizzes.count + ' ta · o’rtacha ' + (k.quizzes.avgPercent || 0) + '%')
            ]) : null,
            k.level ? h('div', { class: 'kab-line' }, [
              h('span', {}, 'Daraja'), h('b', {}, k.level)
            ]) : null,
            learnSection(k.student.id, false)
          ]);
        })),
        h('div', { class: 'small muted', style: 'margin-top:10px' },
          'Savol bo’lsa markazga murojaat qiling' + (d.center.phone ? ': ' + d.center.phone : '.')),
        h('div', { class: 'kab-out' }, [
          h('button', {
            class: 'btn sm', type: 'button',
            onclick: async function () {
              try { await D.api('POST', 'api/kabinet/logout', {}); } catch (e) { }
              err.hidden = true;
              showForm();
            }
          }, 'Chiqish')
        ])
      ]));
    }

    /* ---- O'quv bo'limi (ikkala kabinetda ham) ---- */
    function learnSection(studentId, canAct) {
      var wrapEl = h('div', { class: 'kab-sec' },
        h('p', { class: 'small muted' }, 'O’quv ma’lumoti yuklanmoqda…'));
      (async function () {
        var d;
        try {
          d = await D.api('GET', 'api/kabinet/learning?studentId=' + encodeURIComponent(studentId));
        } catch (ex) { UI.clear(wrapEl); return; }
        UI.clear(wrapEl);
        var act = canAct && d.canSubmit;

        /* Uy vazifalari */
        if ((d.homework || []).length) {
          wrapEl.appendChild(h('h3', {}, 'Uy vazifasi'));
          d.homework.slice(0, 5).forEach(function (w) {
            wrapEl.appendChild(h('div', { class: 'kab-item' }, [
              h('b', {}, w.title || 'Vazifa'),
              w.text ? h('span', {}, w.text) : null,
              h('span', { class: 'small muted' },
                A.dateLabel(w.date) + (w.dueDate ? ' · muddat: ' + A.dateLabel(w.dueDate) : '') +
                (w.group ? ' · ' + w.group : ''))
            ]));
          });
        }

        /* Testlar */
        if ((d.quizzes || []).length) {
          wrapEl.appendChild(h('h3', {}, 'Testlar'));
          d.quizzes.slice(0, 8).forEach(function (q) {
            wrapEl.appendChild(h('div', { class: 'kab-item' }, [
              h('b', {}, q.title),
              h('span', { class: 'small muted' },
                q.done ? ('Natija: ' + q.score + '/' + q.total + ' (' + q.percent + '%)')
                  : (q.count + ' savol' + (q.due ? ' · muddat: ' + A.dateLabel(q.due) : ''))),
              (act && !q.done) ? h('button', {
                class: 'btn sm primary', type: 'button',
                onclick: function () { runQuiz(q, studentId); }
              }, 'Testni ishlash') : null
            ]));
          });
        }

        /* Qo'shimcha darslar */
        if ((d.makeups || []).length) {
          wrapEl.appendChild(h('h3', {}, 'Qo’shimcha dars'));
          d.makeups.forEach(function (m) {
            wrapEl.appendChild(h('div', { class: 'kab-item' }, [
              h('b', {}, A.dateLabel(m.date) + (m.time ? ' ' + m.time : '')),
              h('span', { class: 'small muted' },
                'Qoldirilgan dars: ' + A.dateLabel(m.missedDate) + ' · ' + m.status +
                (m.room ? ' · ' + m.room : ''))
            ]));
          });
        }

        /* Savol-javob */
        wrapEl.appendChild(h('h3', {}, 'Savol-javob'));
        if (act) {
          var gid = ((d.progress && d.progress.groups) || [])[0];
          wrapEl.appendChild(h('button', {
            class: 'btn sm', type: 'button',
            onclick: function () { askForm(studentId); }
          }, 'Ustozga savol berish'));
        }
        if ((d.questions || []).length) {
          d.questions.slice(0, 8).forEach(function (q) {
            wrapEl.appendChild(h('div', { class: 'kab-item' }, [
              h('b', {}, q.text),
              h('span', { class: 'small muted' }, q.at + (q.mine ? ' · siz so’radingiz' : '')),
              (q.answers || []).length
                ? h('span', {}, 'Javob: ' + q.answers[q.answers.length - 1].text)
                : h('span', { class: 'small muted' }, 'Javob kutilmoqda')
            ]));
          });
        } else {
          wrapEl.appendChild(h('p', { class: 'small muted' }, 'Savol yo’q.'));
        }
      })();
      return wrapEl;
    }

    /* Kabinetda test ishlash */
    function runQuiz(q, studentId) {
      (async function () {
        var t;
        try { t = await D.kabPost('api/kabinet/quiz/start', { quizId: q.id }); }
        catch (ex) { UI.toast(ex.message || 'Testni ochib bo’lmadi.', 'bad'); return; }
        var pos = 0, chosen = {};
        var qbody = h('div', { class: 'test-body' });
        var m = UI.modal({ title: t.quiz.title || 'Test', body: qbody, actions: [{ label: 'Yopish' }] });

        function draw() {
          UI.clear(qbody);
          var qq = t.questions[pos];
          if (!qq) return send();
          qbody.appendChild(h('div', {}, [
            h('div', { class: 'test-bar' },
              h('span', { style: 'width:' + Math.round(pos / t.questions.length * 100) + '%' })),
            h('div', { class: 'test-meta' }, [
              h('span', { class: 'test-kind' }, ''),
              h('span', { class: 'test-count small muted', dir: 'ltr' },
                (pos + 1) + ' / ' + t.questions.length)
            ]),
            h('p', { class: 'test-q', dir: 'auto' }, qq.text),
            h('div', { class: 'test-opts' }, qq.options.map(function (o, i) {
              return h('button', {
                class: 'test-opt', type: 'button', dir: 'auto',
                onclick: function () { chosen[qq.id] = i; pos++; draw(); }
              }, o);
            }))
          ]));
        }
        async function send() {
          UI.clear(qbody);
          qbody.appendChild(h('p', { class: 'small muted' }, 'Hisoblanmoqda…'));
          try {
            var r = await D.kabPost('api/kabinet/quiz/submit', {
              sessionId: t.id,
              answers: Object.keys(chosen).map(function (id) { return { id: id, choice: chosen[id] }; })
            });
            UI.clear(qbody);
            qbody.appendChild(h('div', { class: 'test-res' }, [
              h('div', { class: 'test-level' }, [
                h('span', { class: 'small muted' }, 'Natijangiz'),
                h('b', {}, r.result.percent + '%'),
                h('span', {}, r.result.score + ' / ' + r.result.total)
              ]),
              h('p', { class: 'small muted' },
                r.result.passed ? 'Test topshirildi.' : 'O’tish foiziga yetmadi.')
            ]));
            setTimeout(function () { m.close(true); start(); }, 2500);
          } catch (ex) {
            UI.clear(qbody);
            qbody.appendChild(h('p', { class: 'err-msg' }, ex.message || 'Xato.'));
          }
        }
        draw();
      })();
    }

    /* Ustozga savol */
    function askForm(studentId) {
      (async function () {
        var d;
        try { d = await D.api('GET', 'api/kabinet/learning?studentId=' + encodeURIComponent(studentId)); }
        catch (ex) { return; }
        var groups = (d.questions || []).map(function (q) { return q.groupId; });
        var gid = groups[0] || (d.progress && d.progress.groups && d.progress.groups[0] &&
          d.progress.groups[0].id) || '';
        var ta = h('textarea', { rows: 4, placeholder: 'Savolingizni yozing' });
        UI.modal({
          title: 'Ustozga savol',
          body: h('div', { class: 'f' }, [ta]),
          actions: [{ label: 'Bekor qilish' }, {
            label: 'Yuborish', cls: 'primary', onClick: function (close, btn) {
              var text = String(ta.value || '').trim();
              if (!text) { UI.toast('Savolni yozing.', 'bad'); return; }
              UI.busy(btn, async function () {
                try {
                  await D.kabPost('api/kabinet/question', { groupId: gid, text: text });
                  close(true); UI.toast('Savol yuborildi.', 'ok'); start();
                } catch (ex) { UI.toast(ex.message || 'Yuborilmadi.', 'bad'); }
              });
            }
          }]
        });
      })();
    }
  }
  A.renderKabinet = renderKabinet;


  /* ================= DARAJA ANIQLASH TESTI (A1 → C2) =================
     Kirishsiz ishlaydi. Savollar serverdan JAVOBSIZ keladi, natijani ham
     server hisoblaydi — shuning uchun brauzerda "to'g'ri javob" yo'q va
     darajani o'zboshimchalik bilan yozib bo'lmaydi. */
  /* Test sahifasining o'z matnlari — uch tilda (savollar serverdan keladi) */
  var TEST_T = {
    uz: {
      title: 'Daraja aniqlash testi', sub: 'A1 · A2 · B1 · B2 · C1 · C2',
      pick: 'Test tilini tanlang', start: 'Testni boshlash',
      loading: 'Savollar yuklanmoqda…', back: 'Orqaga', skip: 'Bilmayman',
      home: 'Bosh sahifa', done: 'Savollar tugadi. Natijani ko’rish uchun tugmani bosing.',
      hint: 'Ism va telefonni yozsangiz, markaz siz uchun mos guruhni taklif qiladi. Yozmasangiz ham natija ko’rinadi.',
      name: 'Ismingiz (ixtiyoriy)', phone: 'Telefon (ixtiyoriy)',
      see: 'Natijani ko’rish', calc: 'Hisoblanmoqda…',
      your: 'Sizning darajangiz', total: 'Umumiy natija',
      note: 'Bu natija taxminiy. Aniq daraja ustoz bilan qisqa suhbatdan keyin belgilanadi.',
      apply: 'Ariza qoldirish', again: 'Qayta topshirish',
      errStart: 'Testni boshlab bo’lmadi.', errSend: 'Natijani olishda xato.',
      changeLang: 'Tilni almashtirish'
    },
    ru: {
      title: 'Тест на определение уровня', sub: 'A1 · A2 · B1 · B2 · C1 · C2',
      pick: 'Выберите язык теста', start: 'Начать тест',
      loading: 'Загрузка вопросов…', back: 'Назад', skip: 'Не знаю',
      home: 'На главную', done: 'Вопросы закончились. Нажмите кнопку, чтобы увидеть результат.',
      hint: 'Если укажете имя и телефон, центр предложит подходящую группу. Без них результат тоже виден.',
      name: 'Ваше имя (необязательно)', phone: 'Телефон (необязательно)',
      see: 'Посмотреть результат', calc: 'Подсчёт…',
      your: 'Ваш уровень', total: 'Общий результат',
      note: 'Результат приблизительный. Точный уровень определяется после короткой беседы с преподавателем.',
      apply: 'Оставить заявку', again: 'Пройти заново',
      errStart: 'Не удалось начать тест.', errSend: 'Ошибка при получении результата.',
      changeLang: 'Сменить язык'
    },
    ar: {
      title: 'اختبار تحديد المستوى', sub: 'A1 · A2 · B1 · B2 · C1 · C2',
      pick: 'اختر لغة الاختبار', start: 'ابدأ الاختبار',
      loading: 'جارٍ تحميل الأسئلة…', back: 'السابق', skip: 'لا أعرف',
      home: 'الصفحة الرئيسية', done: 'انتهت الأسئلة. اضغط الزر لعرض النتيجة.',
      hint: 'إذا كتبت اسمك ورقمك اقترح عليك المركز المجموعة المناسبة. وتظهر النتيجة من دونهما أيضاً.',
      name: 'الاسم (اختياري)', phone: 'الهاتف (اختياري)',
      see: 'عرض النتيجة', calc: 'جارٍ الحساب…',
      your: 'مستواك', total: 'النتيجة الإجمالية',
      note: 'هذه النتيجة تقريبية. يُحدَّد المستوى بدقّة بعد حديث قصير مع الأستاذ.',
      apply: 'أرسل طلباً', again: 'أعد الاختبار',
      errStart: 'تعذّر بدء الاختبار.', errSend: 'خطأ في جلب النتيجة.',
      changeLang: 'تغيير اللغة'
    }
  };
  var TEST_LANGS = [
    { id: 'uz', label: 'O’zbekcha' },
    { id: 'ru', label: 'Русский' },
    { id: 'ar', label: 'العربية' }
  ];

  /* ================= DARAJA ANIQLASH TESTI (A1 → C2) =================
     Kirishsiz ishlaydi. Savollar serverdan JAVOBSIZ keladi, natijani ham
     server hisoblaydi — shuning uchun brauzerda "to'g'ri javob" yo'q va
     darajani o'zboshimchalik bilan yozib bo'lmaydi.
     Uch til: o'zbek, rus, arab (arabchada sahifa o'ngdan chapga). */
  function renderTest() {
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'screen';
    UI.clear(wrap);

    /* Boshlang'ich til: saytdagi til mos kelsa — o'sha, aks holda o'zbekcha */
    var cur = (A.I18N && A.I18N.lang) || 'uz';
    var LANG = TEST_T[cur] ? cur : 'uz';
    var T = function () { return TEST_T[LANG]; };
    var rtl = function () { return LANG === 'ar'; };

    var err = h('div', { class: 'err-msg', hidden: true });
    var body = h('div', { class: 'test-body' });
    var head = h('div', {}, []);

    var homeBtn = h('button', {
      class: 'btn sm', type: 'button',
      onclick: function () { location.hash = ''; renderLanding(); }
    }, T().home);
    var box = h('div', { class: 'login test-box' }, [head, err, body,
      h('div', { class: 'login-alt' }, [homeBtn])
    ]);
    wrap.appendChild(box);

    var SES = null, QS = [], LVLS = [], pos = 0, picked = {};

    paintHead();
    pickLang();

    function paintHead() {
      UI.clear(head);
      box.setAttribute('dir', rtl() ? 'rtl' : 'ltr');
      homeBtn.textContent = T().home;
      head.appendChild(h('div', { class: 'brandline' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [
          h('h1', {}, T().title),
          h('div', { class: 'sub' }, T().sub)
        ])
      ]));
    }

    /* 1-qadam: til tanlash */
    function pickLang() {
      UI.clear(body);
      err.hidden = true;
      body.appendChild(h('div', { class: 'test-lang' }, [
        h('p', { class: 'small muted' }, T().pick),
        h('div', { class: 'test-lang-row' }, TEST_LANGS.map(function (l) {
          return h('button', {
            class: 'btn' + (l.id === LANG ? ' primary' : ''), type: 'button',
            lang: l.id, dir: l.id === 'ar' ? 'rtl' : 'ltr',
            onclick: function () { LANG = l.id; paintHead(); pickLang(); }
          }, l.label);
        })),
        h('button', {
          class: 'btn primary lg', type: 'button',
          onclick: function () { start(); }
        }, T().start)
      ]));
    }

    async function start() {
      UI.clear(body);
      body.appendChild(h('p', { class: 'small muted' }, T().loading));
      try {
        var d = await D.api('POST', 'api/test/start', { lang: LANG });
        SES = d.id; QS = d.questions || []; LVLS = d.levels || [];
        LANG = TEST_T[d.lang] ? d.lang : LANG;
        paintHead();
        pos = 0; picked = {};
        if (!QS.length) throw new Error(T().errStart);
        step();
      } catch (ex) {
        UI.clear(body);
        err.hidden = false;
        err.textContent = ex.message || T().errStart;
        body.appendChild(h('button', {
          class: 'btn', type: 'button', onclick: function () { pickLang(); }
        }, T().changeLang));
      }
    }

    /* Bitta savol — bosgan zahoti keyingisiga o'tadi */
    function step() {
      var q = QS[pos];
      UI.clear(body);
      if (!q) return finish();

      var bar = h('div', { class: 'test-bar' },
        h('span', { style: 'width:' + Math.round(pos / QS.length * 100) + '%' }));

      var opts = h('div', { class: 'test-opts' }, q.options.map(function (o, i) {
        return h('button', {
          class: 'test-opt', type: 'button', dir: 'auto',
          onclick: function () { picked[q.id] = i; pos++; step(); }
        }, o);
      }));

      body.appendChild(h('div', {}, [
        bar,
        h('div', { class: 'test-meta' }, [
          h('span', { class: 'test-kind' }, q.kindLabel || q.kind || ''),
          h('span', { class: 'test-count small muted', dir: 'ltr' }, (pos + 1) + ' / ' + QS.length)
        ]),
        /* Savol matni tanlangan tilda; arabchada o'ngdan chapga */
        h('p', { class: 'test-q', dir: rtl() ? 'rtl' : 'ltr' }, q.text),
        opts,
        h('div', { class: 'test-nav' }, [
          pos > 0 ? h('button', {
            class: 'btn sm', type: 'button',
            onclick: function () { pos--; step(); }
          }, T().back) : null,
          h('button', {
            class: 'btn sm ghost', type: 'button',
            onclick: function () { delete picked[q.id]; pos++; step(); }
          }, T().skip)
        ])
      ]));
    }

    /* Oxirida: ism/telefon (ixtiyoriy) va yuborish */
    function finish() {
      UI.clear(body);
      var nameI = h('input', { id: 'test-name', type: 'text', placeholder: T().name, maxlength: '80' });
      var phoneI = h('input', { id: 'test-phone', type: 'tel', placeholder: T().phone, maxlength: '30' });
      var btn = h('button', { class: 'btn primary', type: 'submit' }, T().see);

      body.appendChild(h('form', {
        class: 'test-end',
        onsubmit: function (e) { e.preventDefault(); send(); }
      }, [
        h('p', {}, T().done),
        h('p', { class: 'small muted' }, T().hint),
        nameI, phoneI, btn
      ]));

      async function send() {
        btn.disabled = true; btn.textContent = T().calc; err.hidden = true;
        var ans = Object.keys(picked).map(function (id) { return { id: id, choice: picked[id] }; });
        try {
          var r = await D.api('POST', 'api/test/submit', {
            sessionId: SES, answers: ans,
            name: nameI.value, phone: phoneI.value
          });
          show(r);
        } catch (ex) {
          btn.disabled = false; btn.textContent = T().see;
          err.hidden = false;
          err.textContent = ex.message || T().errSend;
        }
      }
    }

    function show(r) {
      UI.clear(body);
      var info = r.info || {};
      var list = (r.levels && r.levels.length) ? r.levels : LVLS;
      var rows = list.map(function (l) {
        var p = (r.perLevel || {})[l.code] || { ok: 0, total: 0 };
        var okAll = p.total && p.ok >= 3;
        return h('div', { class: 'test-row' + (okAll ? ' ok' : '') }, [
          h('b', {}, l.code),
          h('span', { class: 'small' }, l.name),
          h('span', { class: 'small muted' }, p.ok + '/' + p.total)
        ]);
      });

      body.appendChild(h('div', { class: 'test-res' }, [
        h('div', { class: 'test-level' }, [
          h('span', { class: 'small muted' }, T().your),
          h('b', {}, r.level),
          h('span', {}, info.name || '')
        ]),
        info.about ? h('p', { class: 'small' }, info.about) : null,
        h('div', { class: 'test-score small muted' },
          T().total + ': ' + r.score + ' / ' + r.total),
        h('div', { class: 'test-rows' }, rows),
        h('p', { class: 'small muted' }, T().note),
        h('div', { class: 'test-nav' }, [
          h('button', {
            class: 'btn primary', type: 'button',
            onclick: function () { location.hash = ''; renderLanding(); setTimeout(function () { scrollTo('ariza'); }, 60); }
          }, T().apply),
          h('button', {
            class: 'btn sm', type: 'button',
            onclick: function () { pickLang(); }
          }, T().again)
        ])
      ]));
    }
  }
  A.renderTest = renderTest;


  /* ================= SAYT (kirishsiz sahifa) =================
     Markaz haqida ma'lumot, kurslar va pastda ariza formasi.
     Forma to'ldirilsa — murojaat "Murojaatlar" bo'limiga tushadi va
     administratorlarga (ichki suhbat + Telegram bot) xabar boradi. */
  var PUBLIC = null;

  async function publicInfo() {
    if (PUBLIC) return PUBLIC;
    try {
      var r = await fetch('api/public', { credentials: 'same-origin' });
      PUBLIC = r.ok ? await r.json() : {};
    } catch (e) { PUBLIC = {}; }
    A._pub = PUBLIC;
    return PUBLIC;
  }


  /** Fon bezagi: oq fon ustida mayda gulli sakura shoxlari va sekin
      tushayotgan gulbarglar. Faqat ko'rinish uchun — bosishga xalaqit bermaydi,
      harakat kamaytirilgan rejimda (prefers-reduced-motion) to'xtab turadi. */
  function siteBackdrop() {
    var NS = 'http://www.w3.org/2000/svg';
    function svg(tag, attrs) {
      var el = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      return el;
    }
    /** Takrorlanadigan "tasodif": har safar bir xil chiqadi, shuning uchun
        sinovlar ham barqaror bo'ladi. */
    function rnd(seed) {
      var x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    }
    var LEAF = ['lf', 'lf2', 'lf3'];

    /** Mayda sakura guli: besh kichkina gulbarg va sarg'ish markaz. */
    function bloom(g, x, y, ang, r, seed) {
      var turn = ang + rnd(seed) * 72;
      var cx = x + Math.cos(ang * Math.PI / 180) * r * 1.1;
      var cy = y + Math.sin(ang * Math.PI / 180) * r * 1.1;
      var cls = LEAF[Math.floor(rnd(seed + 5) * 3)];
      for (var k = 0; k < 5; k++) {
        var a = (turn + k * 72) * Math.PI / 180;
        var px = cx + Math.cos(a) * r * 0.62;
        var py = cy + Math.sin(a) * r * 0.62;
        g.appendChild(svg('ellipse', {
          cx: px.toFixed(1), cy: py.toFixed(1),
          rx: (r * 0.5).toFixed(1), ry: (r * 0.38).toFixed(1),
          transform: 'rotate(' + (a * 180 / Math.PI).toFixed(1) + ' ' + px.toFixed(1) + ' ' + py.toFixed(1) + ')',
          class: cls
        }));
      }
      g.appendChild(svg('circle', {
        cx: cx.toFixed(1), cy: cy.toFixed(1), r: (r * 0.22).toFixed(1), class: 'core'
      }));
    }
    /** Ochilmagan kurtak — shoxni jonlantiradi. */
    function bud(g, x, y, ang, r, seed) {
      var cx = x + Math.cos(ang * Math.PI / 180) * r * 1.4;
      var cy = y + Math.sin(ang * Math.PI / 180) * r * 1.4;
      g.appendChild(svg('circle', {
        cx: cx.toFixed(1), cy: cy.toFixed(1), r: (r * 0.5).toFixed(1),
        class: LEAF[Math.floor(rnd(seed) * 3)]
      }));
    }

    /** Bir shox: egilgan poya, ikkita yon shox va ular bo'ylab mayda barglar. */
    function branch(cls, seed) {
      var g = svg('svg', { viewBox: '0 0 400 260', class: 'branch ' + cls, 'aria-hidden': 'true' });
      function curve(P0, P1, P2, w) {
        g.appendChild(svg('path', {
          d: 'M' + P0[0] + ' ' + P0[1] + ' Q' + P1[0] + ' ' + P1[1] + ' ' + P2[0] + ' ' + P2[1],
          fill: 'none', stroke: 'currentColor', 'stroke-width': w, 'stroke-linecap': 'round'
        }));
        return function (t) {
          var u = 1 - t;
          return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0],
          u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]];
        };
      }
      function angleOf(f, t) {
        var a = f(Math.max(0, t - 0.02)), b = f(Math.min(1, t + 0.02));
        return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      }
      // asosiy poya va ikkita yon shox
      var main = curve([4, 244], [150, 232], [388, 34], 5.5);
      var arm1 = curve(main(0.34), [190, 96], [252, 42], 3.2);
      var arm2 = curve(main(0.6), [286, 188], [366, 176], 2.8);
      var arms = [
        { f: main, n: 26, from: 0.08, step: 0.035, len: 7.5 },
        { f: arm1, n: 13, from: 0.1, step: 0.07, len: 6.5 },
        { f: arm2, n: 12, from: 0.1, step: 0.075, len: 6 }
      ];
      arms.forEach(function (arm, ai) {
        for (var i = 0; i < arm.n; i++) {
          var t = arm.from + i * arm.step;
          var p = arm.f(t), ang = angleOf(arm.f, t);
          var s = ai * 29 + i * 5 + seed;
          // har nuqtada ikki tomonga bittadan mayda barg
          [-1, 1].forEach(function (side, si) {
            var sd = s + si * 3;
            var r = arm.len * (0.66 + rnd(sd) * 0.5);
            var a = ang + side * (40 + rnd(sd + 1) * 36);
            if (rnd(sd + 2) < 0.24) bud(g, p[0], p[1], a, r, sd);
            else bloom(g, p[0], p[1], a, r, sd);
          });
        }
      });
      return g;
    }

    /* --- Tushayotgan gulbarglar --- */
    var petals = h('div', { class: 'petals' });
    for (var i = 0; i < 14; i++) {
      var size = 7 + rnd(i + 1) * 6;                 // 7–13 px
      var dur = 13 + rnd(i + 20) * 12;               // 13–25 s
      var sp = h('span', { class: 'petal' }, h('i'));
      sp.style.left = (rnd(i + 40) * 96).toFixed(1) + '%';
      sp.style.width = size.toFixed(1) + 'px';
      sp.style.height = (size * 0.82).toFixed(1) + 'px';
      sp.style.animationDuration = dur.toFixed(1) + 's';
      sp.style.animationDelay = '-' + (rnd(i + 60) * dur).toFixed(1) + 's';
      sp.firstChild.style.animationDuration = (3.5 + rnd(i + 80) * 4).toFixed(1) + 's';
      petals.appendChild(sp);
    }

    return h('div', { class: 'site-bg', 'aria-hidden': 'true' }, [
      h('div', { class: 'tree tl' }, branch('sway-a', 1)),
      h('div', { class: 'tree tr' }, branch('sway-b', 7)),
      h('div', { class: 'tree bl' }, branch('sway-c', 13)),
      h('div', { class: 'tree br' }, branch('sway-b', 21)),
      petals
    ]);
  }

  function renderLanding() {
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'site';
    UI.clear(wrap);

    var name = centerNameNow();

    /* --- Tepa panel --- */
    var top = h('header', { class: 'site-top' }, [
      h('div', { class: 'site-brand' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [
          h('b', { id: 'site-name' }, name),
          h('span', {}, 'Arab tili o’quv markazi')
        ])
      ]),
      h('nav', { class: 'site-nav' }, [
        h('button', { class: 'btn sm ghost', type: 'button', onclick: function () { scrollTo('ustozlar'); } }, 'Ustozlar'),
        h('button', { class: 'btn sm ghost', type: 'button', onclick: function () { scrollTo('kurslar'); } }, 'Kurslar'),
        h('button', { class: 'btn sm ghost', type: 'button', onclick: function () { scrollTo('ariza'); } }, 'Ariza'),
        h('button', {
          class: 'btn sm ghost', type: 'button',
          onclick: function () { location.hash = 'test'; renderTest(); }
        }, 'Daraja testi'),
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { location.hash = 'kabinet'; renderKabinet(); }
        }, 'O’quvchi kabineti'),
        h('button', {
          class: 'btn sm primary', type: 'button',
          onclick: function () { location.hash = 'kirish'; renderLogin(null); }
        }, [UI.icon('key'), 'Kirish'])
      ])
    ]);

    /* --- Hero --- */
    var hero = h('section', { class: 'site-hero' }, [
      h('div', { class: 'hero-text' }, [
        h('span', { class: 'hero-eyebrow' }, 'Toshkentda arab tili'),
        h('h1', {}, name),
        h('p', { class: 'hero-lead', id: 'site-about' },
          'Qur’on tili — boshlang’ichdan suhbatgacha. Kichik guruhlar, tajribali ' +
          'ustozlar va har bir o’quvchi uchun aniq natija rejasi.'),
        h('div', { class: 'hero-cta' }, [
          h('button', { class: 'btn primary lg', type: 'button', onclick: function () { scrollTo('ariza'); } },
            'Darsga yozilish'),
          h('button', {
            class: 'btn lg', type: 'button',
            onclick: function () { location.hash = 'test'; renderTest(); }
          }, 'Darajangizni aniqlang'),
          h('a', { class: 'btn lg', id: 'site-call', href: '#ariza' },
            [UI.icon('phone'), h('span', { id: 'site-call-text' }, 'Bog’lanish')])
        ]),
        h('div', { class: 'hero-stats' }, [
          stat('6', 'daraja: A1–C2'),
          stat('8–12', 'kishilik guruh'),
          stat('6', 'kun ish rejimi')
        ])
      ]),
      h('div', { class: 'hero-art' }, [
        h('div', { class: 'hero-logo' }, [
          h('span', { class: 'hero-ar', 'aria-hidden': 'true' }, 'البيان'),
          h('img', { src: LOGO, alt: '' })
        ]),
        h('div', { class: 'hero-badge' }, [h('b', {}, 'AlBayan'), h('span', {}, 'Cairo')])
      ])
    ]);

    function stat(v, l) {
      return h('div', { class: 'hero-stat' }, [h('b', {}, v), h('span', {}, l)]);
    }

    /* --- Nima beramiz --- */
    var feats = h('section', { class: 'site-sec' }, [
      h('h2', {}, 'Nega AlBayan Cairo?'),
      h('div', { class: 'feat-grid' }, [
        feat('users', 'Kichik guruhlar', 'Har bir o’quvchiga vaqt yetadi — 8–12 kishilik guruhlar.'),
        feat('badge', 'Tajribali ustozlar', 'Arab tilini Misrda o’rgangan va yillar davomida dars bergan ustozlar.'),
        feat('check', 'Davomat va natija', 'Har dars davomat olinadi, ota-ona va o’quvchi kabinetdan ko’rib turadi.'),
        feat('wallet', 'Shaffof to’lov', 'Oylik hisob, qarz va to’lov tarixi — hammasi kabinetda ko’rinadi.'),
        feat('calendar', 'Qulay jadval', 'Ertalabki va kechki guruhlar; ishlaydiganlar uchun ham vaqt bor.'),
        feat('bot', 'Telegram bot', 'Davomat, to’lov va e’lonlar bot orqali darhol yetib boradi.')
      ])
    ]);
    function feat(icon, t, d) {
      return h('div', { class: 'feat' }, [
        h('div', { class: 'feat-ico' }, UI.icon(icon)),
        h('b', {}, t), h('p', {}, d)
      ]);
    }

    /* --- Ustozlar --- */
    var teachBox = h('div', { class: 'tch-grid' }, h('div', { class: 'muted small' }, 'Yuklanmoqda…'));
    var teachers = h('section', { class: 'site-sec', id: 'ustozlar' }, [
      h('h2', {}, 'Ustozlar'),
      h('p', { class: 'muted' },
        'Darslarni Misrda tahsil olgan, ona tili arab tili bo’lgan ustozlar olib boradi. ' +
        'Erkaklar va ayollar guruhlari uchun alohida ustozlar bor.'),
      teachBox
    ]);

    /* --- Dars vaqtlari --- */
    var slotBox = h('div', { class: 'slot-grid' });
    var timetable = h('section', { class: 'site-sec', id: 'vaqt' }, [
      h('h2', {}, 'Dars vaqtlari'),
      h('p', { class: 'muted', id: 'slot-lead' }, 'Har bir dars 1 soat 30 daqiqa.'),
      slotBox
    ]);

    /* --- Kurslar --- */
    var courseBox = h('div', { class: 'course-grid' }, h('div', { class: 'muted small' }, 'Yuklanmoqda…'));
    var courses = h('section', { class: 'site-sec', id: 'kurslar' }, [
      h('h2', {}, 'Kurslar'),
      courseBox
    ]);

    /* --- Ariza formasi --- */
    var fName = UI.field({ label: 'Ismingiz', id: 'lead-name', required: true, placeholder: 'Ism familiya' });
    var fPhone = UI.field({
      label: 'Telefon', id: 'lead-phone', required: true,
      placeholder: '+998 90 123 45 67', inputmode: 'tel'
    });
    var fCourse = UI.field({ label: 'Qaysi kurs', id: 'lead-course', type: 'select', options: [{ value: '', label: 'Tanlanmagan' }] });
    var fNote = UI.field({ label: 'Izoh (ixtiyoriy)', id: 'lead-note', type: 'textarea', placeholder: 'Qaysi vaqt qulay?' });
    var err = h('div', { class: 'err-msg', hidden: true });
    var okBox = h('div', { class: 'lead-ok', hidden: true });
    var btn = h('button', { class: 'btn primary block lg', type: 'submit' }, 'Yuborish');

    var form = h('form', {
      class: 'lead-form', onsubmit: function (e) { e.preventDefault(); sendLead(); }
    }, [fName.wrap, fPhone.wrap, fCourse.wrap, fNote.wrap, err, btn,
    h('p', { class: 'small muted', style: 'margin:0;text-align:center' },
      'Arizangizni olib, bir ish kuni ichida qo’ng’iroq qilamiz.')]);

    var contact = h('div', { class: 'site-contact' }, [
      h('h3', {}, 'Bog’lanish'),
      h('div', { class: 'contact-row', id: 'site-phone-row', hidden: true }, [
        UI.icon('phone'), h('a', { id: 'site-phone-link', href: '#' }, '')
      ]),
      h('div', { class: 'contact-row', id: 'site-addr-row', hidden: true }, [
        UI.icon('home'), h('span', { id: 'site-addr' }, '')
      ]),
      h('div', { class: 'contact-row', id: 'site-time-row', hidden: true }, [
        UI.icon('calendar'), h('span', { id: 'site-time' }, '')
      ]),
      h('div', { class: 'contact-row', id: 'site-tg-row', hidden: true }, [
        UI.icon('bot'), h('a', { id: 'site-tg', href: '#', target: '_blank', rel: 'noopener' }, '')
      ])
    ]);

    var apply = h('section', { class: 'site-sec', id: 'ariza' }, [
      h('h2', {}, 'Darsga yozilish'),
      h('p', { class: 'muted' }, 'Formani to’ldiring — administratorimiz bog’lanadi.'),
      h('div', { class: 'apply-grid' }, [h('div', { class: 'apply-card' }, [form, okBox]), contact])
    ]);

    var foot = h('footer', { class: 'site-foot' }, [
      h('div', { class: 'foot-brand' }, [
        h('img', { class: 'logo-sm', src: LOGO, alt: '' }),
        h('span', {}, '© ' + new Date().getFullYear() + ' ' + name)
      ]),
      h('div', { class: 'rowflex' }, [
        h('button', {
          class: 'btn sm ghost', type: 'button',
          onclick: function () { location.hash = 'kabinet'; renderKabinet(); }
        }, 'O’quvchi kabineti'),
        h('button', {
          class: 'btn sm ghost', type: 'button',
          onclick: function () { location.hash = 'kirish'; renderLogin(null); }
        }, 'Xodimlar kirishi')
      ])
    ]);

    wrap.appendChild(siteBackdrop());
    wrap.appendChild(h('div', { class: 'site-wrap' }, [top, hero, feats, teachers, timetable, courses, apply, foot]));
    A.I18N.apply(wrap);
    fillPublic();

    function scrollTo(id) {
      var el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function fillPublic() {
      var d = await publicInfo();
      if (d.centerName) {
        var el = document.getElementById('site-name');
        if (el) el.textContent = d.centerName;
      }
      if (d.about) {
        var ab = document.getElementById('site-about');
        if (ab) ab.textContent = d.about;
      }
      if (d.phone) {
        show('site-phone-row');
        var tel = 'tel:' + String(d.phone).replace(/[^+0-9]/g, '');
        var pl = document.getElementById('site-phone-link');
        pl.textContent = d.phone; pl.href = tel;
        var call = document.getElementById('site-call');
        if (call) {
          call.href = tel;
          var ct = document.getElementById('site-call-text');
          if (ct) ct.textContent = d.phone;
        }
      }
      if (d.address) { show('site-addr-row'); document.getElementById('site-addr').textContent = d.address; }
      if (d.workStart && d.workEnd) {
        show('site-time-row');
        document.getElementById('site-time').textContent =
          'Dushanba–Shanba · ' + d.workStart + '–' + d.workEnd;
      }
      if (d.telegram) {
        show('site-tg-row');
        var tg = document.getElementById('site-tg');
        var u = String(d.telegram).replace(/^@/, '');
        tg.textContent = '@' + u; tg.href = 'https://t.me/' + u;
      }
      paintTeachers(d.teachers || []);
      paintSlots(d.workStart || '08:00', d.workEnd || '22:00', d.lessonMinutes || 90);
      UI.clear(courseBox);
      var list = d.courses || [];
      if (!list.length) {
        courseBox.appendChild(h('p', { class: 'muted' },
          'Kurslar ro’yxati tez orada. Ariza qoldiring — o’zimiz bog’lanamiz.'));
      } else {
        list.forEach(function (c) {
          courseBox.appendChild(h('div', { class: 'course' }, [
            h('b', {}, c.name),
            c.note ? h('p', {}, c.note) : null,
            c.fee ? h('div', { class: 'course-fee' }, [h('b', {}, A.som(c.fee)), h('span', {}, 'so’m / oy')]) : null,
            h('button', {
              class: 'btn sm', type: 'button',
              onclick: function () { fCourse.input.value = c.id; scrollTo('ariza'); fName.input.focus(); }
            }, 'Yozilish')
          ]));
        });
        UI.clear(fCourse.input);
        [{ value: '', label: 'Tanlanmagan' }].concat(list.map(function (c) {
          return { value: c.id, label: c.name };
        })).forEach(function (o) {
          fCourse.input.appendChild(h('option', { value: o.value }, o.label));
        });
      }
      A.I18N.apply(wrap);
    }
    function paintTeachers(list) {
      UI.clear(teachBox);
      if (!list.length) {
        teachBox.appendChild(h('p', { class: 'muted' }, 'Ustozlar ro’yxati tez orada.'));
        return;
      }
      list.forEach(function (t) {
        teachBox.appendChild(h('button', {
          class: 'tch-card', type: 'button',
          onclick: function () { openTeacher(t, list); }
        }, [
          A.teacherAvatar(t, 96),
          h('b', {}, t.name),
          h('span', { class: 'tch-tag' }, t.tag || 'Ustoz'),
          h('span', { class: 'tch-aud' }, A.audienceLabel(t.audience)),
          t.levels ? h('span', { class: 'small muted' }, t.levels) : null
        ]));
      });
    }

    function openTeacher(t, list) {
      location.hash = 'ustoz?id=' + encodeURIComponent(t.id);
      renderTeacher(t, list);
    }

    function paintSlots(start, end, minutes) {
      UI.clear(slotBox);
      var lead = document.getElementById('slot-lead');
      if (lead) {
        lead.textContent = 'Darslar ' + start + '–' + end + ' oralig’ida. Har bir dars ' +
          Math.floor(minutes / 60) + ' soat ' + (minutes % 60) + ' daqiqa.';
      }
      A.lessonSlots(start, end, minutes).forEach(function (sl) {
        slotBox.appendChild(h('div', { class: 'slot' }, [
          h('b', {}, sl.from + '–' + sl.to),
          h('span', { class: 'small muted' }, sl.part)
        ]));
      });
    }

    function show(id) { var el = document.getElementById(id); if (el) el.hidden = false; }

    function sendLead() {
      err.hidden = true;
      var name2 = fName.input.value.trim();
      var phone = fPhone.input.value.trim();
      if (name2.length < 2) { err.hidden = false; err.textContent = 'Ismingizni yozing.'; return; }
      if (A.phoneDigits(phone).length < 9) { err.hidden = false; err.textContent = 'Telefon raqamni to’liq yozing.'; return; }
      UI.busy(btn, async function () {
        try {
          var r = await D.api('POST', 'api/lead', {
            name: name2, phone: phone,
            courseId: fCourse.input.value, note: fNote.input.value.trim()
          });
          form.hidden = true;
          okBox.hidden = false;
          UI.clear(okBox);
          okBox.appendChild(h('div', { class: 'lead-ok-in' }, [
            h('div', { class: 'ok-ico' }, UI.icon('check')),
            h('b', {}, r && r.duplicate ? 'Arizangiz allaqachon qabul qilingan' : 'Arizangiz qabul qilindi!'),
            h('p', {}, 'Administratorimiz tez orada shu raqamga qo’ng’iroq qiladi.'),
            h('button', {
              class: 'btn sm', type: 'button', onclick: function () {
                form.hidden = false; okBox.hidden = true;
                fName.input.value = ''; fPhone.input.value = ''; fNote.input.value = '';
              }
            }, 'Yana ariza qoldirish')
          ]));
        } catch (ex) {
          err.hidden = false;
          err.textContent = ex.message || 'Yuborilmadi. Birozdan keyin urinib ko’ring.';
        }
      });
    }
  }
  A.renderLanding = renderLanding;

  /* ---------- Ustozlar: umumiy yordamchilar ---------- */

  /** Rasm bo'lsa rasm, bo'lmasa ism harflaridan chiroyli avatar */
  A.teacherAvatar = function (t, size) {
    var box = h('span', { class: 'tch-ava', style: 'width:' + size + 'px;height:' + size + 'px' });
    var ini = String(t.name || '?').replace(/ustoz/i, '').trim()
      .split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
    box.appendChild(h('span', { class: 'tch-ini' }, ini || '?'));
    var img = h('img', { alt: t.name || '', loading: 'lazy', src: '/api/photo?id=' + encodeURIComponent(t.id) });
    img.addEventListener('error', function () { img.remove(); });   // rasm yo'q — harflar qoladi
    box.appendChild(img);
    return box;
  };

  A.audienceLabel = function (a) {
    return {
      erkaklar: 'Erkaklar guruhlari',
      ayollar: 'Ayollar guruhlari',
      ikkalasi: 'Erkak va ayol guruhlari'
    }[a] || '';
  };

  /** Ish vaqtini dars oralig'lariga bo'lish: 08:00–22:00, 90 daqiqadan */
  A.lessonSlots = function (start, end, minutes) {
    function toMin(v) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ''));
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    }
    function toStr(x) {
      var hh = Math.floor(x / 60), mm = x % 60;
      return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    }
    var a = toMin(start), b = toMin(end), len = Number(minutes) || 90;
    if (a == null || b == null || b <= a || len < 15) return [];
    var out = [];
    for (var t = a; t + len <= b && out.length < 12; t += len) {
      out.push({
        from: toStr(t), to: toStr(t + len),
        part: t < 12 * 60 ? 'ertalabki' : (t < 17 * 60 ? 'kunduzgi' : 'kechki')
      });
    }
    return out;
  };

  /* ---------- Ustoz profili (ochiq sahifa) ---------- */
  function renderTeacher(t, list) {
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'site';
    UI.clear(wrap);
    wrap.appendChild(siteBackdrop());

    var box = h('div', { class: 'site-wrap' });
    wrap.appendChild(box);
    window.scrollTo(0, 0);

    box.appendChild(h('header', { class: 'site-top' }, [
      h('button', {
        class: 'btn sm ghost', type: 'button',
        onclick: function () { location.hash = ''; renderLanding(); }
      }, [UI.icon('back'), 'Orqaga']),
      h('div', { class: 'site-brand', style: 'margin-inline-start:auto' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [h('b', {}, centerNameNow()), h('span', {}, 'Arab tili o’quv markazi')])
      ])
    ]));

    if (!t) {
      box.appendChild(UI.empty({
        title: 'Ustoz topilmadi',
        text: 'Bu profil o’chirilgan bo’lishi mumkin.',
        action: { label: 'Bosh sahifa', onClick: function () { location.hash = ''; renderLanding(); } }
      }));
      return;
    }

    var slots = A.lessonSlots(A._pub && A._pub.workStart || '08:00',
      A._pub && A._pub.workEnd || '22:00', (A._pub && A._pub.lessonMinutes) || 90);

    box.appendChild(h('section', { class: 'tch-page' }, [
      h('div', { class: 'tch-hero' }, [
        A.teacherAvatar(t, 168),
        h('div', {}, [
          h('span', { class: 'hero-eyebrow' }, t.tag || 'Ustoz'),
          h('h1', {}, t.name),
          h('p', { class: 'hero-lead' }, t.bio ||
            'Arab tilini ona tili darajasida biladi va AlBayan Cairo’da dars beradi.'),
          h('div', { class: 'tch-facts' }, [
            t.country ? fact('home', 'Davlat', t.country) : null,
            t.levels ? fact('chart', 'Darajalar', t.levels) : null,
            t.years ? fact('history', 'Tajriba', t.years + ' yil') : null,
            t.audience ? fact('users', 'Guruhlar', A.audienceLabel(t.audience)) : null
          ].filter(Boolean)),
          h('button', {
            class: 'btn primary lg', type: 'button',
            onclick: function () {
              location.hash = '';
              renderLanding();
              setTimeout(function () {
                var el = document.getElementById('ariza');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                var note = document.getElementById('lead-note');
                if (note && !note.value) note.value = t.name + ' guruhiga yozilmoqchiman.';
              }, 60);
            }
          }, 'Shu ustozga yozilish')
        ])
      ]),
      slots.length ? h('div', { class: 'tch-times' }, [
        h('h3', {}, 'Dars vaqtlari'),
        h('div', { class: 'slot-grid' }, slots.map(function (sl) {
          return h('div', { class: 'slot' }, [
            h('b', {}, sl.from + '–' + sl.to),
            h('span', { class: 'small muted' }, sl.part)
          ]);
        }))
      ]) : null,
      (list && list.length > 1) ? h('div', { class: 'tch-more' }, [
        h('h3', {}, 'Boshqa ustozlar'),
        h('div', { class: 'tch-grid' }, list.filter(function (x) { return x.id !== t.id; }).map(function (x) {
          return h('button', {
            class: 'tch-card', type: 'button',
            onclick: function () { location.hash = 'ustoz?id=' + encodeURIComponent(x.id); renderTeacher(x, list); }
          }, [
            A.teacherAvatar(x, 84), h('b', {}, x.name),
            h('span', { class: 'tch-tag' }, x.tag || 'Ustoz')
          ]);
        }))
      ]) : null
    ].filter(Boolean)));

    function fact(icon, label, value) {
      return h('div', { class: 'tch-fact' }, [
        UI.icon(icon), h('div', {}, [h('span', {}, label), h('b', {}, value)])
      ]);
    }
  }

  /** Manzildagi #ustoz?id=... bo'yicha profilni ochish */
  async function renderTeacherFromHash() {
    var m = /[?&]id=([^&]+)/.exec(String(location.hash || ''));
    var id = m ? decodeURIComponent(m[1]) : '';
    var d = await publicInfo();
    var list = (d && d.teachers) || [];
    var t = list.filter(function (x) { return x.id === id; })[0] || null;
    renderTeacher(t, list);
  }
  A.renderTeacherFromHash = renderTeacherFromHash;

  /* ---------- Til tanlash ---------- */
  function renderLangPick() {
    var box = document.getElementById('lang-pick');
    if (!box) return;
    UI.clear(box);
    A.I18N.langs.forEach(function (l) {
      box.appendChild(h('button', {
        type: 'button', 'aria-pressed': A.I18N.lang === l.id ? 'true' : 'false',
        title: l.label, 'aria-label': l.label,
        onclick: function () {
          A.I18N.set(l.id);
          renderLangPick();
          if (App.user) App.render(); else renderLogin(null);
        }
      }, l.short));
    });
  }

  var restPromise = null;

  function busyIndicator(n) {
    var pill = document.getElementById('mode-pill');
    if (!pill) return;
    if (n > 0) { pill.hidden = false; pill.textContent = 'Saqlanmoqda…'; pill.className = 'pill warn'; }
    else if (D.mode === 'local') { pill.hidden = false; pill.textContent = 'Faqat shu brauzerda'; pill.className = 'pill mute'; }
    else { pill.hidden = true; }
  }

  async function startSession(user) {
    App.user = user;
    try { sessionStorage.setItem('albyana_session', user.id); } catch (e) { }
    if (restPromise) {
      var boot = document.getElementById('boot');
      boot.hidden = false;
      document.getElementById('auth').hidden = true;
      try { await restPromise; } catch (e) { console.error(e); }
      restPromise = null;
    }
    document.getElementById('auth').hidden = true;
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = false;
    document.getElementById('me-name').textContent = user.name;
    document.getElementById('me-role').textContent = A.ROLES[user.role] || user.role;
    document.getElementById('me-avatar').textContent =
      (user.name || '?').trim().split(/\s+/).map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase();
    document.getElementById('center-name').textContent = (D.settings && D.settings.centerName) || 'AlBayan Cairo';
    var mp = document.getElementById('mode-pill');
    if (D.mode === 'local') { mp.hidden = false; mp.textContent = 'Faqat shu brauzerda'; }
    // sahifa yangilanganda oxirgi ochilgan bo'limga qaytamiz
    var saved = hashToRoute();
    if (saved && App.can((NAV.filter(function (n) { return n.id === saved.name; })[0] || { perm: 'nav.dashboard' }).perm)) {
      App.route = saved;
      App.render();
    } else {
      var first = allowedNav()[0];
      App.go(first ? first.id : 'dashboard');
    }
  }

  function logout() {
    try { sessionStorage.removeItem('albyana_session'); } catch (e) { }
    if (D.mode === 'server') { D.serverLogout(); }
    App.user = null;
    document.getElementById('app').hidden = true;
    renderLogin(null);
  }

  /* ---------- Tezkor qidiruv ---------- */
  function searchAll(q) {
    if (!q) return [];
    var needle = q.toLowerCase();
    var digits = A.phoneDigits(q);
    var out = [];

    function hit(hay) {
      return String(hay || '').toLowerCase().indexOf(needle) >= 0;
    }
    function phoneHit(p) {
      return digits.length >= 3 && A.phoneDigits(p).indexOf(digits) >= 0;
    }

    if (App.can('student.view')) {
      var students = D.all('students');
      if (App.user.role === 'oqituvchi') {
        var mine = {};
        A.scopeGroups(App.user, D.all('groups')).forEach(function (g) {
          A.Q.membersOf(g.id).forEach(function (m) { mine[m.studentId] = 1; });
        });
        students = students.filter(function (s) { return mine[s.id]; });
      }
      students.forEach(function (s) {
        var full = s.lastName + ' ' + s.firstName;
        var codeHit = /^\d{4}$/.test(q.trim()) && String(s.code || '') === q.trim();
        if (codeHit || hit(full) || hit(s.firstName) || hit(s.lastName) || hit(s.parentName) ||
          phoneHit(s.phone) || phoneHit(s.parentPhone)) {
          var groups = A.Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; })
            .map(function (m) { return A.groupLabel(D.one('groups', m.groupId)); }).join(', ');
          out.push({
            group: 'O’quvchilar', title: full,
            sub: (s.phone || s.parentPhone || '') + (groups ? ' · ' + groups : ''),
            icon: UI.avatar(full),
            badge: s.status !== 'faol'
              ? UI.pill(s.status === 'arxiv' ? 'Arxiv' : 'To’xtatgan', 'mute')
              : (s.code ? h('span', { class: 'code-chip' }, String(s.code)) : null),
            onPick: function () { App.go('student', { id: s.id }); }
          });
        }
      });
    }

    if (App.can('group.view')) {
      A.scopeGroups(App.user, D.all('groups')).forEach(function (g) {
        if (hit(g.name) || hit(g.code) || hit(A.Q.courseName(g.courseId)) || hit(A.Q.staffName(g.teacherId))) {
          out.push({
            group: 'Guruhlar', title: A.groupLabel(g),
            sub: A.Q.courseName(g.courseId) + ' · ' + A.Q.staffName(g.teacherId) +
              ' · ' + A.Q.membersOf(g.id).length + ' o’quvchi',
            onPick: function () { App.go('group', { id: g.id }); }
          });
        }
      });
    }

    if (App.can('nav.leads')) {
      D.all('leads').forEach(function (l) {
        if (hit(l.name) || phoneHit(l.phone)) {
          out.push({
            group: 'Murojaatlar', title: l.name, sub: (l.phone || '') + ' · ' + A.stageLabel(l.stage),
            onPick: function () { App.go('leads', { q: l.name }); A.leadForm(l, App); }
          });
        }
      });
    }

    if (App.can('staff.view') || App.can('nav.staff')) {
      D.all('staff').forEach(function (s) {
        if (hit(s.name) || phoneHit(s.phone)) {
          out.push({
            group: 'Xodimlar', title: s.name, sub: (s.position || '') + ' · ' + (s.phone || ''),
            onPick: function () { App.go('staff'); }
          });
        }
      });
    }

    // eng mos keladiganlar yuqorida: nom boshidan mos kelganlar oldin
    out.sort(function (a, b) {
      var ai = a.title.toLowerCase().indexOf(needle), bi = b.title.toLowerCase().indexOf(needle);
      if (ai < 0) ai = 99; if (bi < 0) bi = 99;
      return ai - bi;
    });
    return out;
  }
  App.searchAll = searchAll;

  function wireSearch() {
    var input = document.getElementById('global-search');
    UI.suggest(input, searchAll, {
      limit: 20,
      emptyText: 'Hech narsa topilmadi'
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var q = input.value.trim();
        if (q && App.can('student.view')) App.go('students', { q: q });
      }
    });
  }

  /* ---------- Mavzu ---------- */
  function wireTheme() {
    var btn = document.getElementById('theme-toggle');
    var saved = null;
    try { saved = localStorage.getItem('albyana_theme'); } catch (e) { }
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var isDark = cur === 'dark' || (!cur && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('albyana_theme', next); } catch (e) { }
    });
  }

  var LOGO = '';

  /** #kabinet?kod=4077 ko'rinishidagi havoladan kodni olish */
  function kabinetCodeFromHash() {
    var m = String(location.hash || '').match(/[?&](kod|code)=(\d{4})/);
    return m ? m[2] : '';
  }

  /* ---------- Ishga tushirish ---------- */
  async function boot() {
    LOGO = document.querySelector('#boot img').getAttribute('src');
    wireTheme();
    A.I18N.init();
    A.I18N.observe();
    renderLangPick();
    A.I18N.apply(document.body);
    window.addEventListener('hashchange', onHashChange);
    if (A.PWA) { try { A.PWA.start(); } catch (e) { console.warn(e); } }
    window.addEventListener('beforeunload', function (e) {
      if (UI.hasUnsaved && UI.hasUnsaved()) { e.preventDefault(); e.returnValue = ''; }
    });
    try {
      await D.initAuth();

      if (D.mode === 'server') {
        wireSearch();
        document.getElementById('logout').addEventListener('click', logout);
        D.onBusy = busyIndicator;
        if (D.currentServerUser) {
          try {
            await D.loadBootstrap();
            await startSession(D.currentServerUser);
            return;
          } catch (e) { console.error(e); }
        }
        var where = String(location.hash || '').replace('#', '').split('?')[0];
        if (where === 'kabinet') { renderKabinet(kabinetCodeFromHash()); return; }
        if (where === 'test' || where === 'daraja') { renderTest(); return; }
        if (where === 'ustoz') { renderTeacherFromHash(); return; }
        if (where === 'kirish' || where === 'login') { renderLogin(null); return; }
        renderLanding();                 // saytning ochiq sahifasi
        return;
      }

      if (!D.settings || D.all('users').length === 0) {
        // birinchi ishga tushirish — hammasi kerak
        await D.initRest();
        await A.Fin.migrate();
        await A.Seed.bootstrap();
      } else {
        // kirish darhol ko'rsatiladi, qolgani fonda yuklanadi
        restPromise = (async function () {
          await D.initRest();
          await A.Fin.migrate();
        })();
      }
      wireSearch();
      document.getElementById('logout').addEventListener('click', logout);
      D.onBusy = busyIndicator;
      D.onChange(function () { /* mahalliy keshni yangilash — sahifa o'zi qayta chiziladi */ });

      var sid = null;
      try { sid = sessionStorage.getItem('albyana_session'); } catch (e) { }
      var u = sid ? D.one('users', sid) : null;
      if (u && u.active !== false) startSession(u);
      else renderLogin(null);
    } catch (e) {
      console.error(e);
      var boot = document.getElementById('boot');
      UI.clear(boot);
      boot.appendChild(h('div', { class: 'login' }, [
        h('h1', {}, 'Tizimni ochib bo’lmadi'),
        h('p', { class: 'sub' }, e.message || String(e)),
        h('button', { class: 'btn primary', onclick: function () { location.reload(); } }, 'Qayta urinish')
      ]));
    }
  }

  global.A.App = App;
  global.A.NAV = NAV;
  global.A.hashPass = hashPass;
  global.A.logout = logout;
  global.A.getLogo = function () { return LOGO; };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
