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

    history: [],

    go: function (name, params) {
      var prev = App.route;
      if (prev && prev.name && prev.name !== name) {
        App.history.push(prev);
        if (App.history.length > 20) App.history.shift();
      }
      App.route = Object.assign({ name: name }, params || {});
      App.render();
      try { document.getElementById('view').scrollIntoView({ block: 'start' }); } catch (e) { }
      window.scrollTo(0, 0);
    },

    /** Oldingi sahifaga qaytish (saqlagandan keyin shu yerda qolib ketmasin) */
    back: function (fallback) {
      var prev = App.history.pop();
      if (!prev) {
        App.route = { name: fallback || 'dashboard' };
      } else {
        App.route = prev;
      }
      App.render();
      window.scrollTo(0, 0);
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

  /* ---------- Menyu ---------- */
  var NAV = [
    { id: 'dashboard', label: 'Bosh sahifa', icon: 'home', perm: 'nav.dashboard' },
    { id: 'leads', label: 'Murojaatlar', icon: 'phone', perm: 'nav.leads' },
    { id: 'students', label: 'O’quvchilar', icon: 'users', perm: 'nav.students' },
    { id: 'groups', label: 'Guruhlar', icon: 'layers', perm: 'nav.groups' },
    { id: 'schedule', label: 'Jadval', icon: 'calendar', perm: 'nav.schedule' },
    { id: 'attendance', label: 'Davomat', icon: 'check', perm: 'nav.attendance' },
    { id: 'finance', label: 'Moliya', icon: 'wallet', perm: 'nav.finance' },
    { id: 'staff', label: 'Xodimlar', icon: 'badge', perm: 'nav.staff' },
    { id: 'reports', label: 'Hisobotlar', icon: 'chart', perm: 'nav.reports' },
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
    var quick = allowedNav().slice(0, 4);
    quick.forEach(function (n) {
      tabbar.appendChild(h('button', {
        type: 'button', 'aria-current': App.route.name === n.id ? 'page' : null,
        onclick: function () { App.go(n.id); }
      }, [UI.icon(n.icon), h('span', {}, n.label)]));
    });
    tabbar.appendChild(h('button', {
      type: 'button', onclick: openMenuSheet
    }, [UI.icon('layers'), h('span', {}, 'Menyu')]));
  }

  function openMenuSheet() {
    var list = h('div', { class: 'list' }, allowedNav().map(function (n) {
      return h('button', {
        class: 'list-item', type: 'button', style: 'width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line)',
        onclick: function () { m.close(); App.go(n.id); }
      }, [UI.icon(n.icon), h('div', { class: 'main-col' }, h('b', {}, n.label))]);
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
          h('h1', {}, (D.settings && D.settings.centerName) || 'Albyana'),
          h('div', { class: 'sub' }, 'O’quv markazi boshqaruv tizimi')
        ])
      ]),
      msg ? h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, msg)) : null,
      hint,
      fLogin.wrap, fPass.wrap, err, btn,
      h('div', { class: 'small muted', style: 'text-align:center' },
        D.mode === 'local'
          ? 'Diqqat: baza ulanmadi, ma’lumotlar faqat shu brauzerda saqlanadi.'
          : 'Ma’lumotlar markaz bazasida saqlanadi.')
    ]);
    wrap.appendChild(formEl);

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
    document.getElementById('center-name').textContent = (D.settings && D.settings.centerName) || 'Albyana';
    var mp = document.getElementById('mode-pill');
    if (D.mode === 'local') { mp.hidden = false; mp.textContent = 'Faqat shu brauzerda'; }
    var first = allowedNav()[0];
    App.go(first ? first.id : 'dashboard');
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
        if (hit(full) || hit(s.firstName) || hit(s.lastName) || hit(s.parentName) ||
          phoneHit(s.phone) || phoneHit(s.parentPhone)) {
          var groups = A.Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; })
            .map(function (m) { return A.groupLabel(D.one('groups', m.groupId)); }).join(', ');
          out.push({
            group: 'O’quvchilar', title: full,
            sub: (s.phone || s.parentPhone || '') + (groups ? ' · ' + groups : ''),
            icon: UI.avatar(full),
            badge: s.status !== 'faol' ? UI.pill(s.status === 'arxiv' ? 'Arxiv' : 'To’xtatgan', 'mute') : null,
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

  /* ---------- Ishga tushirish ---------- */
  async function boot() {
    LOGO = document.querySelector('#boot img').getAttribute('src');
    wireTheme();
    A.I18N.init();
    A.I18N.observe();
    renderLangPick();
    A.I18N.apply(document.body);
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
        renderLogin(null);
        return;
      }

      if (!D.settings || D.all('users').length === 0) {
        // birinchi ishga tushirish — hammasi kerak
        await D.initRest();
        await A.Fin.loadIndex();
        await A.Fin.loadAll();
        await A.Seed.bootstrap();
      } else {
        // kirish darhol ko'rsatiladi, qolgani fonda yuklanadi
        restPromise = (async function () {
          await D.initRest();
          await A.Fin.loadIndex();
          await A.Fin.loadAll();
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
