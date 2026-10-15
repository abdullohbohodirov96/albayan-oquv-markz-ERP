/* Albyana ERP — CRM qo'shimchalari:
     • Murojaatlar doskasi (kanban, sudrab o'tkazish)
     • Qo'ng'iroqlar (IP-telefoniya: kiruvchi/chiquvchi, javobsiz → vazifa)
     • Saqlab qolish hisoboti (ketib qolish xavfi, oylik saqlab qolish, ketish sabablari)
     • Tavsiya bonusi ("Do‘stingni olib kel")
     • Sozlamalar: Telefoniya va Tavsiya bonusi                              */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h, Q = A.Q;

  var LEAVE_REASONS = [
    ['narx', 'Narx qimmat'], ['vaqt', 'Vaqt to’g’ri kelmadi'], ['kochdi', 'Ko’chib ketdi'],
    ['boshqa_markaz', 'Boshqa markazga o’tdi'], ['tugatdi', 'Kursni tugatdi'], ['ustoz', 'O’qituvchi yoqmadi'],
    ['natija', 'Natija ko’rmadi'], ['oila', 'Oilaviy sabab'], ['boshqa', 'Boshqa']
  ];
  A.LEAVE_REASONS = LEAVE_REASONS;
  function reasonLabel(id) { var r = LEAVE_REASONS.filter(function (x) { return x[0] === id; })[0]; return r ? r[1] : (id || '—'); }

  /* ======================= KANBAN ======================= */
  function viewPref() { try { return localStorage.getItem('alb_leads_view') || 'table'; } catch (e) { return 'table'; } }
  function setViewPref(v) { try { localStorage.setItem('alb_leads_view', v); } catch (e) { } }
  A.leadsViewPref = viewPref;
  A.setLeadsViewPref = setViewPref;

  async function moveLead(l, stageId, App) {
    if (l.stage === stageId) return;
    var fn = D.one('funnels', l.funnelId) || A.DEFAULT_FUNNELS.filter(function (x) { return x.id === (l.funnelId || 'fnl_asosiy'); })[0];
    var from = A.stageOf(fn, l.stage).label, to = A.stageOf(fn, stageId).label;
    l.stage = stageId;
    await D.save('leads', l, { action: 'Murojaat holati o’zgardi', entity: l.name, details: from + ' → ' + to });
    await A.Ops.audit(App.user, 'Murojaat holati o’zgardi', l.name, from + ' → ' + to);
  }

  /** Doska: har ustun — voronka bosqichi; karta sudrab o'tkaziladi.
      Telefonda (sudrash qiyin) — kartadagi ◀ ▶ tugmalari.           */
  A.leadsKanban = function (leads, funnel, App) {
    var stages = A.funnelStages(funnel).slice();
    /* Voronka bosqichlari o'zgartirilgan bo'lsa, eski holatdagi murojaat
       doskadan g'oyib bo'lmasin — "Boshqa holat" ustunida turadi.      */
    var known = {}; stages.forEach(function (s) { known[s.id] = 1; });
    var orphans = leads.filter(function (l) { return !known[l.stage]; });
    if (orphans.length) {
      var seen = {};
      orphans.forEach(function (l) { if (!seen[l.stage]) { seen[l.stage] = 1; stages.push({ id: l.stage, label: 'Boshqa: ' + l.stage, type: 'other' }); } });
    }
    var today = A.today();
    var board = h('div', { class: 'kanban' });
    var canEdit = App.can('lead.edit');
    var dragging = null;

    stages.forEach(function (st, si) {
      var items = A.sortBy(leads.filter(function (l) { return l.stage === st.id; }), 'createdAt', 'desc');
      var cls = st.type === 'won' ? ' won' : (st.type === 'lost' ? ' lost' : '');
      var list = h('div', { class: 'kb-list' });
      items.forEach(function (l) {
        var late = l.nextContact && l.nextContact <= today && st.type !== 'won' && st.type !== 'lost';
        var card = h('div', {
          class: 'kb-card' + (late ? ' late' : ''), draggable: canEdit ? 'true' : null, 'data-id': l.id,
          onclick: function () { if (canEdit && A.leadForm) A.leadForm(l, App); }
        }, [
          h('div', { class: 'kb-name' }, l.name || '—'),
          h('div', { class: 'kb-phone mono small' }, l.phone || ''),
          h('div', { class: 'kb-meta small muted' }, [
            l.courseId ? Q.courseName(l.courseId) : null,
            l.source ? (l.courseId ? ' · ' : '') + l.source : null
          ].filter(Boolean).join('')),
          l.nextContact ? h('div', { class: 'small ' + (late ? 'kb-late' : 'muted') }, (late ? '⚠ ' : '') + 'Aloqa: ' + A.dateLabel(l.nextContact)) : null,
          canEdit ? h('div', { class: 'kb-move rowflex' }, [
            si > 0 ? h('button', { type: 'button', class: 'btn sm ico-only', 'aria-label': 'Oldingi bosqich',
              onclick: function (e) { e.stopPropagation(); moveLead(l, stages[si - 1].id, App).then(function () { App.render(); }); } }, '◀') : h('span'),
            si < stages.length - 1 ? h('button', { type: 'button', class: 'btn sm ico-only', 'aria-label': 'Keyingi bosqich',
              onclick: function (e) { e.stopPropagation(); moveLead(l, stages[si + 1].id, App).then(function () { App.render(); }); } }, '▶') : h('span')
          ]) : null
        ]);
        if (canEdit) {
          card.addEventListener('dragstart', function (e) {
            dragging = l; card.classList.add('dragging');
            try { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) { }
          });
          card.addEventListener('dragend', function () { dragging = null; card.classList.remove('dragging'); });
        }
        list.appendChild(card);
      });
      var col = h('div', { class: 'kb-col' + cls, 'data-stage': st.id }, [
        h('div', { class: 'kb-head' }, [h('b', {}, st.label), UI.pill(String(items.length), 'mute')]),
        list
      ]);
      if (canEdit) {
        col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); try { e.dataTransfer.dropEffect = 'move'; } catch (x) { } });
        col.addEventListener('dragleave', function () { col.classList.remove('over'); });
        col.addEventListener('drop', function (e) {
          e.preventDefault(); col.classList.remove('over');
          var id = (dragging && dragging.id) || (function () { try { return e.dataTransfer.getData('text/plain'); } catch (x) { return ''; } })();
          var l = dragging || D.one('leads', id);
          if (!l) return;
          moveLead(l, st.id, App).then(function () { UI.toast(l.name + ' → ' + st.label, 'ok'); App.render(); });
        });
      }
      board.appendChild(col);
    });
    return h('div', { class: 'kanban-wrap' }, board);
  };

  /* ======================= QO'NG'IROQLAR ======================= */
  function callStatusPill(c) {
    if (c.status === 'answered') return UI.pill('Javob berildi', 'ok');
    if (c.status === 'missed') return UI.pill('Javobsiz', 'bad');
    if (c.status === 'busy') return UI.pill('Band', 'warn');
    return UI.pill('Jarayonda', 'info');
  }
  function fmtDur(s) { s = Number(s) || 0; return s ? Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) : '—'; }

  /** ERP orqali qo'ng'iroq yoqilganmi (telefoniya + shu xodimda ext) */
  A.erpCallEnabled = function () {
    var t = (D.settings && D.settings.tel) || {};
    var me = A.App && A.App.user;
    return !!(t.enabled && me && t.exts && t.exts[me.id]);
  };
  /** Raqamni bosish → darhol PBX ga buyruq: xodim telefoni jiringlaydi, keyin mijozga ulanadi */
  A.erpCall = async function (phone, btn) {
    if (!phone) return;
    var run = async function () {
      try {
        UI.toast('Ulanmoqda… ' + phone, 'info');
        await D.api('POST', 'api/tel/call', { phone: phone });
        UI.toast('Qo’ng’iroq buyurildi — telefoningiz jiringlaydi.', 'ok');
      } catch (x) { UI.toast(x.message || 'Qo’ng’iroq qilinmadi.', 'bad'); }
    };
    if (btn && UI.busy) return UI.busy(btn, run);
    return run();
  };
  /** Alohida tugma (ro'yxatlarda) — yoqilmagan bo'lsa null */
  A.erpCallBtn = function (phone, opts) {
    if (!A.erpCallEnabled() || !phone) return null;
    opts = opts || {};
    return h('button', {
      type: 'button', class: 'btn' + (opts.small ? ' sm' : '') + ' erp-call', title: 'ERP orqali qo’ng’iroq',
      onclick: function (e) { e.stopPropagation(); A.erpCall(phone, e.currentTarget); }
    }, [UI.icon('phone'), opts.small ? null : h('span', {}, 'Qo’ng’iroq')].filter(Boolean));
  };

  /* ======================= JONLI QO'NG'IROQ OYNASI ======================= */
  /* Server (SSE) qo'ng'iroq voqeasini yuboradi → shu yerda oyna chiqadi:
     kim qo'ng'iroq qilyapti, ma'lumoti, "Ochish / Tahrirlash / Vazifa".    */
  var live = { es: null, pops: {}, box: null, timer: null };
  function popBox() {
    if (!live.box || !document.body.contains(live.box)) {
      live.box = h('div', { class: 'call-pops', 'aria-live': 'polite' });
      document.body.appendChild(live.box);
    }
    return live.box;
  }
  function callTitle(c) {
    return c.dir === 'in' ? (c.status === 'ringing' ? 'Kiruvchi qo’ng’iroq' : (c.status === 'answered' ? 'Qo’ng’iroq (javob berildi)' : 'Javobsiz qo’ng’iroq')) : 'Chiquvchi qo’ng’iroq';
  }
  function studentInfo(s, App) {
    var bal = A.balanceOf(s.id, A.Fin.everyInvoice(), A.Fin.everyPayment());
    var over = A.overdueOf(s.id, A.Fin.everyInvoice(), A.Fin.everyPayment(), A.today());
    var mems = Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; });
    var risk = riskOf(s, A.today());
    var rows = [
      ['Holat', s.status === 'faol' ? 'Faol' : (s.status === 'toxtatgan' ? 'To’xtatgan' : 'Arxiv')],
      ['Guruh', mems.length ? mems.map(function (m) { var g = D.one('groups', m.groupId); return Q.groupName(m.groupId) + (g && g.teacherId ? ' · ' + Q.staffName(g.teacherId) : ''); }).join('; ') : '—'],
      ['Qarz', over > 0 ? h('b', { style: 'color:var(--bad)' }, A.som(over) + ' so’m (muddati o’tgan)') : (bal.debt > 0 ? A.som(bal.debt) + ' so’m' : (bal.advance > 0 ? 'Avans ' + A.som(bal.advance) : 'Qarz yo’q'))],
      ['Oxirgi kelgan', risk.lastSeen ? A.dateLabel(risk.lastSeen) : '—'],
      s.parentName ? ['Ota-ona', s.parentName + (s.parentPhone ? ' · ' + s.parentPhone : '')] : null,
      s.note ? ['Izoh', s.note] : null
    ].filter(Boolean);
    return rows;
  }
  function leadInfo(l) {
    var fn = D.one('funnels', l.funnelId) || A.DEFAULT_FUNNELS.filter(function (x) { return x.id === (l.funnelId || 'fnl_asosiy'); })[0];
    return [
      ['Holat', A.stageOf(fn, l.stage).label],
      l.courseId ? ['Kurs', Q.courseName(l.courseId)] : null,
      ['Manba', l.source || '—'],
      l.ownerStaffId ? ['Mas’ul', Q.staffName(l.ownerStaffId)] : null,
      l.nextContact ? ['Keyingi aloqa', A.dateLabel(l.nextContact)] : null,
      l.note ? ['Izoh', l.note] : null
    ].filter(Boolean);
  }
  A.callPop = function (c, App) {
    App = App || A.App;
    var box = popBox();
    var old = live.pops[c.id];
    if (old && old.node) old.node.remove();
    var s = c.studentId ? D.one('students', c.studentId) : null;
    var l = !s && c.leadId ? D.one('leads', c.leadId) : null;
    var who = s ? Q.studentName(s.id) : (l ? l.name : 'Notanish raqam');
    var kind = s ? UI.pill('O’quvchi', 'ok') : (l ? UI.pill(c.newLead ? 'Yangi murojaat' : 'Murojaat', 'info') : UI.pill('Notanish', 'mute'));
    var rows = s ? studentInfo(s, App) : (l ? leadInfo(l) : [['Ma’lumot', 'Bu raqam bazada yo’q.']]);
    var dl = h('dl', { class: 'kv' }, rows.map(function (r) { return [h('dt', {}, r[0]), h('dd', {}, r[1])]; }).flat());
    var stPill = c.status === 'ringing' ? UI.pill('Jiringlayapti', 'warn') : callStatusPill(c);
    var node = h('div', { class: 'call-pop' + (c.status === 'ringing' ? ' ringing' : ''), 'data-call': c.id, role: 'status' }, [
      h('div', { class: 'cp-head' }, [
        h('span', { class: 'cp-ico' }, '📞'),
        h('div', { class: 'cp-title' }, [h('b', {}, callTitle(c)), h('div', { class: 'small muted' }, (c.ext ? 'Ichki raqam ' + c.ext + ' · ' : '') + c.at)]),
        stPill,
        h('button', { type: 'button', class: 'x-btn', 'aria-label': 'Yopish', onclick: function () { closePop(c.id); } }, '×')
      ]),
      h('div', { class: 'cp-who' }, [h('b', {}, who), ' ', kind]),
      h('div', { class: 'cp-phone mono' }, c.phone),
      dl,
      h('div', { class: 'cp-actions rowflex' }, [
        s ? h('button', { class: 'btn sm primary', onclick: function () { App.go('student', { id: s.id }); closePop(c.id); } }, 'Kartani ochish') : null,
        s && App.can('student.edit') ? h('button', { class: 'btn sm', onclick: function () { A.studentForm(s, App); } }, 'Tahrirlash') : null,
        l && App.can('lead.edit') ? h('button', { class: 'btn sm primary', onclick: function () { A.leadForm(l, App); } }, 'Ochish / tahrirlash') : null,
        !s && !l && App.can('lead.edit') ? h('button', { class: 'btn sm primary', onclick: function () {
          A.leadForm({ name: '', phone: c.phone, stage: 'yangi', source: 'Qo‘ng‘iroq', createdAt: A.nowStamp(), nextContact: A.today(), funnelId: (A.sortBy(D.all('funnels'), 'order')[0] || A.DEFAULT_FUNNELS[0]).id }, App);
        } }, 'Murojaat qo’shish') : null,
        App.can('nav.tasks') ? h('button', { class: 'btn sm', onclick: function (e) {
          UI.busy(e.currentTarget, async function () {
            var me = App.user;
            var rec = { id: A.uid('tsk'), title: 'Qo’ng’iroq: ' + who + ' ' + c.phone, status: 'yangi', due: A.today(), assigneeId: me.id, createdById: me.id,
              createdAt: A.nowStamp(), studentId: s ? s.id : '', leadId: l ? l.id : '', callId: c.id };
            await D.save('tasks', rec, { action: 'Vazifa qo’shildi', entity: rec.title, details: 'qo’ng’iroq' });
            UI.toast('Vazifa qo’shildi.', 'ok');
          });
        } }, 'Vazifa') : null,
        c.status === 'missed' ? A.erpCallBtn(c.phone, { small: true }) : null,
        c.record ? h('a', { class: 'btn sm', href: c.record, target: '_blank', rel: 'noopener' }, '▶ Yozuv') : null
      ].filter(Boolean))
    ]);
    box.prepend(node);
    live.pops[c.id] = { node: node, call: c, at: Date.now() };
    /* Ko'pi bilan 3 ta oyna; tugagan qo'ng'iroq 40 soniyadan keyin o'zi yopiladi */
    var keys = Object.keys(live.pops);
    while (keys.length > 3) closePop(keys.shift());
    if (live.pops[c.id] && c.status !== 'ringing') {
      live.pops[c.id].timer = setTimeout(function () { closePop(c.id); }, 40000);
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && c.dir === 'in' && c.status === 'ringing') {
      try { new Notification(who + ' qo’ng’iroq qilyapti', { body: c.phone, tag: 'alb-call-' + c.id }); } catch (e) { /* bildirishnoma shart emas */ }
    }
    return node;
  };
  function closePop(id) {
    var p = live.pops[id]; if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    if (p.node) p.node.remove();
    delete live.pops[id];
  }
  A.closeCallPop = closePop;

  /** Jonli oqim: kirgandan keyin ulanadi, chiqqanda uziladi */
  A.telLive = {
    start: function (App) {
      App = App || A.App;
      this.stop();
      var t = (D.settings && D.settings.tel) || {};
      if (!t.enabled || !App || !App.user || !App.can('nav.leads') || typeof EventSource === 'undefined') return false;
      var es = new EventSource('api/tel/stream');
      live.es = es;
      es.addEventListener('call', async function (ev) {
        var c; try { c = JSON.parse(ev.data); } catch (e) { return; }
        if (!c || c.dir !== 'in') return;
        /* Server murojaat/vazifa ochgan bo'lishi mumkin — yangilab olamiz */
        try { await D.loadBootstrap(); } catch (e) { /* oynani baribir ko'rsatamiz */ }
        A.callPop(c, App);
        if (App.route && App.route.name === 'leads') App.render();
      });
      return true;
    },
    stop: function () { if (live.es) { try { live.es.close(); } catch (e) { } live.es = null; } },
    connected: function () { return !!live.es && live.es.readyState !== 2; }
  };

  A.callsCard = function (App, opts) {
    opts = opts || {};
    var today = A.today();
    var calls = A.sortBy(D.all('calls'), 'at', 'desc');
    var filter = opts.filter || 'all';
    if (filter === 'missed') calls = calls.filter(function (c) { return c.status === 'missed' && c.dir === 'in'; });
    if (filter === 'today') calls = calls.filter(function (c) { return String(c.at || '').slice(0, 10) === today; });
    var missedToday = D.all('calls').filter(function (c) { return c.status === 'missed' && c.dir === 'in' && String(c.at || '').slice(0, 10) === today; }).length;
    var seg = h('div', { class: 'seg', style: 'margin-bottom:10px' }, [
      { id: 'all', label: 'Barchasi (' + D.all('calls').length + ')' },
      { id: 'today', label: 'Bugun' },
      { id: 'missed', label: 'Javobsiz' + (missedToday ? ' (' + missedToday + ' bugun)' : '') }
    ].map(function (s) {
      return h('button', { type: 'button', 'aria-pressed': filter === s.id ? 'true' : 'false',
        onclick: function () { if (opts.onFilter) opts.onFilter(s.id); } }, s.label);
    }));
    var tel = (D.settings && D.settings.tel) || {};
    var intro = !tel.enabled ? h('div', { class: 'banner info', style: 'margin:0 0 10px' }, h('div', {}, [
      h('b', {}, 'Telefoniya ulanmagan. '),
      'Sozlamalar → Telefoniya bo’limida PBX (Sipuni / OnlinePBX) webhook’ini ulang — har qo’ng’iroq shu yerga tushadi, notanish raqam murojaat bo’lib ochiladi, javobsiz qo’ng’iroq vazifa bo’ladi.',
      App.can('settings.edit') ? h('button', { class: 'btn sm', style: 'margin-left:8px', onclick: function () { App.go('settings', { tab: 'tel' }); } }, 'Sozlash') : null
    ])) : null;
    var table = calls.length ? UI.table([
      { label: 'Vaqt', render: function (c) { return h('span', { class: 'mono small' }, c.at); } },
      { label: 'Yo’nalish', render: function (c) { return c.dir === 'in' ? '📥 Kiruvchi' : '📤 Chiquvchi'; } },
      { label: 'Raqam', render: function (c) { return UI.phoneLink(c.phone); } },
      { label: 'Kim', render: function (c) {
        if (c.studentId && D.one('students', c.studentId)) return h('button', { class: 'btn sm', onclick: function () { App.go('student', { id: c.studentId }); } }, [UI.icon('users'), Q.studentName(c.studentId)]);
        if (c.leadId && D.one('leads', c.leadId)) return h('button', { class: 'btn sm', onclick: function () { A.leadForm && A.leadForm(D.one('leads', c.leadId), App); } }, [UI.icon('phone'), (c.newLead ? 'Yangi murojaat' : 'Murojaat')]);
        return h('span', { class: 'muted' }, c.name || 'Notanish');
      } },
      { label: 'Holat', render: callStatusPill },
      { label: 'Davomiyligi', render: function (c) { return h('span', { class: 'mono' }, fmtDur(c.duration)); } },
      { label: 'Ichki', render: function (c) { return c.ext || '—'; } },
      { label: '', right: true, render: function (c) {
        return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
          c.record ? h('a', { class: 'btn sm', href: c.record, target: '_blank', rel: 'noopener' }, '▶ Yozuv') : null,
          c.taskId && D.one('tasks', c.taskId) ? UI.pill(D.one('tasks', c.taskId).status === 'bajarildi' ? 'Vazifa bajarildi' : 'Vazifa ochiq', D.one('tasks', c.taskId).status === 'bajarildi' ? 'ok' : 'warn') : null,
          A.erpCallBtn(c.phone, { small: true }),
          UI.contactBtns(c.phone, { small: true })
        ].filter(Boolean));
      } }
    ], calls.slice(0, 300), { page: 50 }) : UI.empty({ title: 'Hali qo’ng’iroq yo’q', text: tel.enabled ? 'PBX dan birinchi qo’ng’iroq kelishi bilan shu yerda ko’rinadi.' : 'Telefoniyani ulang.' });
    return UI.card('Qo’ng’iroqlar', [intro, seg, table].filter(Boolean), null, true);
  };

  /* ======================= SAQLAB QOLISH (CHURN) ======================= */
  /** Har faol o'quvchi uchun xavf belgilari */
  function riskOf(s, today) {
    var mems = Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; });
    var reasons = [];
    var lastSeen = '';
    var recent = [];      // oxirgi 30 kun: {date, status}
    var streak = 0;       // ketma-ket kelmadi (oxirgidan boshlab)
    var since30 = A.addDays(today, -30);
    mems.forEach(function (m) {
      var g = D.one('groups', m.groupId); if (!g || g.status !== 'faol') return;
      var yms = [A.thisMonth(), A.ymOf(since30)];
      if (yms[0] === yms[1]) yms = [yms[0]];
      yms.forEach(function (ym) {
        A.monthLessons(g, ym, D.lessonsCached(g.id, ym)).forEach(function (l) {
          if (l.status === 'bekor' || l.date > today) return;
          if (m.joinedAt && l.date < m.joinedAt) return;
          var a = l.attendance && l.attendance[m.id];
          var st = a && a.status;
          if (st === 'keldi' || st === 'kechikdi') { if (l.date > lastSeen) lastSeen = l.date; }
          if (l.date >= since30) recent.push({ date: l.date, status: st || '' });
        });
      });
    });
    recent.sort(function (a, b) { return b.date.localeCompare(a.date); });
    for (var i = 0; i < recent.length; i++) { if (recent[i].status === 'kelmadi') streak++; else if (recent[i].status) break; }
    var marked = recent.filter(function (r) { return r.status; });
    var came = marked.filter(function (r) { return r.status === 'keldi' || r.status === 'kechikdi'; }).length;
    var pct = marked.length ? Math.round(came * 100 / marked.length) : null;
    if (streak >= 3) reasons.push({ id: 'streak', label: streak + ' dars ketma-ket kelmadi', w: 3 });
    if (pct != null && marked.length >= 4 && pct < 50) reasons.push({ id: 'low', label: '30 kunda davomat ' + pct + '%', w: 2 });
    if (mems.length && lastSeen && lastSeen < A.addDays(today, -14) && recent.length) reasons.push({ id: 'absent14', label: '14+ kun kelmayapti (oxirgi: ' + A.dateLabel(lastSeen) + ')', w: 2 });
    var invsAll = A.Fin.everyInvoice(), paysAll = A.Fin.everyPayment();
    var overdueAmt = A.overdueOf(s.id, invsAll, paysAll, today);
    var overdueDays = 0;
    if (overdueAmt > 0) {
      var paidMap = A.paidByInvoice(paysAll);
      invsAll.forEach(function (i) {
        if (i.studentId !== s.id || A.invoiceRemaining(i, paidMap) <= 0) return;
        var due = A.invoiceDue(i); if (!due || due >= today) return;
        var dd = Math.round((new Date(today) - new Date(due)) / 86400000);
        if (dd > overdueDays) overdueDays = dd;
      });
      reasons.push({ id: 'debt', label: 'Muddati o’tgan qarz ' + A.som(overdueAmt) + (overdueDays ? ' (' + overdueDays + ' kun)' : ''), w: overdueDays > 20 ? 3 : 1 });
    }
    if (s.status === 'toxtatgan') reasons.push({ id: 'paused', label: 'Vaqtincha to’xtatgan', w: 2 });
    if (!mems.length && s.status === 'faol') reasons.push({ id: 'nogroup', label: 'Faol guruhi yo’q', w: 1 });
    var score = reasons.reduce(function (t, r) { return t + r.w; }, 0);
    return { student: s, reasons: reasons, score: score, lastSeen: lastSeen, pct: pct, streak: streak, debt: overdueAmt || 0 };
  }

  function monthlyRetention(months) {
    var out = [];
    var students = D.all('students');
    var mems = D.all('memberships');
    function activeOn(iso) {
      var ids = {};
      mems.forEach(function (m) {
        if (!m.joinedAt || m.joinedAt > iso) return;
        if (m.leftAt && m.leftAt < iso) return;
        if (m.status !== 'faol' && !m.leftAt) return;
        ids[m.studentId] = 1;
      });
      return Object.keys(ids).length;
    }
    for (var i = months - 1; i >= 0; i--) {
      var ym = A.addMonths(A.thisMonth(), -i);
      var start = A.monthStart(ym), end = A.monthEnd(ym);
      var atStart = activeOn(start);
      var joined = {}, left = {};
      mems.forEach(function (m) {
        if (m.joinedAt && m.joinedAt >= start && m.joinedAt <= end) joined[m.studentId] = 1;
        if (m.leftAt && m.leftAt >= start && m.leftAt <= end) left[m.studentId] = 1;
      });
      /* Ketgan deb — shu oyda chiqib, oy oxirida hech qaysi guruhda qolmagan */
      var leftIds = Object.keys(left).filter(function (sid) {
        return !mems.some(function (m) { return m.studentId === sid && m.status === 'faol' && (!m.leftAt || m.leftAt > end) && m.joinedAt <= end; });
      });
      var atEnd = activeOn(end);
      out.push({ ym: ym, start: atStart, joined: Object.keys(joined).length, left: leftIds.length, end: atEnd,
        retention: atStart ? Math.round((atStart - leftIds.length) * 100 / atStart) : null,
        leftIds: leftIds });
    }
    void students;
    return out;
  }

  A.Pages.retention = function (view, route, App) {
    App.guard('nav.reports');
    var today = A.today();
    var tab = route.tab || 'xavf';
    view.appendChild(UI.pageHead('Saqlab qolish', 'Kim ketib qolish arafasida — bugun gaplashing, ertaga kech bo’ladi'));

    var active = D.all('students').filter(function (s) { return s.status === 'faol' || s.status === 'toxtatgan'; });
    var risks = active.map(function (s) { return riskOf(s, today); }).filter(function (r) { return r.score > 0; });
    risks.sort(function (a, b) { return b.score - a.score; });
    var months = monthlyRetention(6);
    var thisM = months[months.length - 1];
    var refs = D.all('referrals');

    var tiles = h('div', { class: 'tiles' }, [
      UI.tile({ label: 'Faol o’quvchilar', value: active.filter(function (s) { return s.status === 'faol'; }).length }),
      UI.tile({ label: 'Xavf ostida', value: risks.length, cls: risks.length ? 'alert' : '', hint: 'belgilar bo’yicha' }),
      UI.tile({ label: 'Shu oy ketdi', value: thisM.left, hint: 'guruhdan chiqqanlar' }),
      UI.tile({ label: 'Shu oy keldi', value: thisM.joined, hint: 'guruhga yozilganlar' }),
      UI.tile({ label: 'Saqlab qolish', value: thisM.retention == null ? '—' : thisM.retention + '%', hint: 'shu oy' }),
      UI.tile({ label: 'Tavsiya bilan keldi', value: refs.length, hint: refs.filter(function (r) { return r.status === 'tayyor'; }).length + ' ta bonus kutmoqda' })
    ]);
    view.appendChild(tiles);
    view.appendChild(UI.tabs([
      { id: 'xavf', label: 'Xavf ostida (' + risks.length + ')' },
      { id: 'oylik', label: 'Oylik saqlab qolish' },
      { id: 'sabab', label: 'Ketish sabablari' },
      { id: 'tavsiya', label: 'Tavsiya bonusi' }
    ], tab, function (id) { App.go('retention', { tab: id }); }));

    if (tab === 'xavf') view.appendChild(riskCard(risks, App));
    if (tab === 'oylik') view.appendChild(monthlyCard(months));
    if (tab === 'sabab') view.appendChild(reasonsCard(App));
    if (tab === 'tavsiya') view.appendChild(A.referralCard(App));
  };

  function riskCard(risks, App) {
    if (!risks.length) return UI.card(null, UI.empty({ title: 'Xavf belgisi yo’q', text: 'Hamma faol o’quvchi kelyapti va to’layapti. Davomat belgilanmasa, bu ro’yxat ko’r bo’lib qoladi — davomatni har dars oling.' }));
    var me = App.user;
    return UI.card('Ketib qolish xavfi — ' + risks.length + ' ta o’quvchi', [
      h('p', { class: 'small muted' }, 'Belgilar: 3+ dars ketma-ket kelmadi · 30 kunda davomat 50% dan past · 14+ kun kelmayapti · muddati o’tgan qarz · to’xtatgan. Qancha ko’p belgi — shuncha yuqorida.'),
      UI.table([
        { label: 'O’quvchi', render: function (r) {
          return h('div', {}, [
            h('a', { href: '#', onclick: function (e) { e.preventDefault(); App.go('student', { id: r.student.id }); } }, h('b', {}, Q.studentName(r.student.id))),
            h('div', { class: 'small muted' }, Q.membershipsOf(r.student.id).filter(function (m) { return m.status === 'faol'; }).map(function (m) { return Q.groupName(m.groupId); }).join(', ') || 'guruhsiz')
          ]);
        } },
        { label: 'Belgilar', render: function (r) {
          return h('div', { class: 'rowflex', style: 'gap:4px;flex-wrap:wrap' }, r.reasons.map(function (x) { return UI.pill(x.label, x.w >= 3 ? 'bad' : (x.w === 2 ? 'warn' : 'mute')); }));
        } },
        { label: 'Oxirgi kelgan', render: function (r) { return r.lastSeen ? A.dateLabel(r.lastSeen) : h('span', { class: 'muted' }, '—'); } },
        { label: 'Telefon', render: function (r) { return UI.phoneLink(r.student.parentPhone || r.student.phone); } },
        { label: '', right: true, render: function (r) {
          var ph = r.student.parentPhone || r.student.phone;
          return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px;flex-wrap:nowrap' }, [
            A.erpCallBtn(ph, { small: true }),
            UI.contactBtns(ph, { small: true }),
            App.can('nav.tasks') ? h('button', { class: 'btn sm', title: 'O’zimga vazifa', onclick: function (e) {
              UI.busy(e.currentTarget, async function () {
                var rec = { id: A.uid('tsk'), title: 'Bog’lanish: ' + Q.studentName(r.student.id), status: 'yangi', due: A.today(),
                  description: r.reasons.map(function (x) { return x.label; }).join(' · '), assigneeId: me.id, createdById: me.id,
                  createdAt: A.nowStamp(), studentId: r.student.id };
                await D.save('tasks', rec, { action: 'Vazifa qo’shildi', entity: rec.title, details: 'saqlab qolish' });
                await A.Ops.audit(me, 'Vazifa qo’shildi', rec.title, 'saqlab qolish');
                UI.toast('Vazifa qo’shildi.', 'ok');
              });
            } }, [UI.icon('task'), 'Vazifa']) : null
          ].filter(Boolean));
        } }
      ], risks, { page: 100 })
    ], null, true);
  }

  function monthlyCard(months) {
    var max = Math.max.apply(null, [1].concat(months.map(function (m) { return m.start; })));
    return UI.card('Oxirgi 6 oy — kim keldi, kim ketdi', [
      h('div', { class: 'ret-chart' }, months.map(function (m) {
        return h('div', { class: 'ret-col', title: A.monthLabel(m.ym) + ': boshida ' + m.start + ', keldi ' + m.joined + ', ketdi ' + m.left }, [
          h('div', { class: 'ret-bars' }, [
            h('i', { class: 'j', style: 'height:' + Math.round(m.joined * 100 / max) + '%', title: 'keldi ' + m.joined }),
            h('i', { class: 'l', style: 'height:' + Math.round(m.left * 100 / max) + '%', title: 'ketdi ' + m.left })
          ]),
          h('span', { class: 'small muted' }, A.monthLabel(m.ym).slice(0, 3))
        ]);
      })),
      UI.table([
        { label: 'Oy', render: function (m) { return h('b', {}, A.monthLabel(m.ym)); } },
        { label: 'Oy boshida', render: function (m) { return String(m.start); } },
        { label: 'Keldi', render: function (m) { return h('span', { style: 'color:var(--ok,#16a34a)' }, '+' + m.joined); } },
        { label: 'Ketdi', render: function (m) { return h('span', { style: 'color:var(--bad,#dc2626)' }, '−' + m.left); } },
        { label: 'Oy oxirida', render: function (m) { return String(m.end); } },
        { label: 'Saqlab qolish', render: function (m) { return m.retention == null ? '—' : UI.pill(m.retention + '%', m.retention >= 90 ? 'ok' : (m.retention >= 75 ? 'warn' : 'bad')); } }
      ], months),
      h('p', { class: 'small muted' }, 'Saqlab qolish = (oy boshidagilar − shu oy ketganlar) / oy boshidagilar. 90% dan yuqori — yaxshi, 75% dan past — sabablarni ko’ring.')
    ], null, true);
  }

  function reasonsCard(App) {
    var left = D.all('students').filter(function (s) { return s.status === 'arxiv'; });
    var byReason = {};
    left.forEach(function (s) { var k = s.leftReason || 'nomalum'; byReason[k] = (byReason[k] || 0) + 1; });
    var rows = Object.keys(byReason).map(function (k) { return { id: k, n: byReason[k] }; }).sort(function (a, b) { return b.n - a.n; });
    var total = left.length || 1;
    return UI.card('Ketish sabablari (arxivlanganlar bo’yicha)', [
      rows.length ? h('div', { class: 'steps' }, rows.map(function (r) {
        var p = Math.round(r.n * 100 / total);
        return h('div', { class: 'step' }, [
          h('div', { class: 'step-l' }, [h('span', {}, r.id === 'nomalum' ? 'Sabab yozilmagan' : reasonLabel(r.id)), h('b', {}, r.n + ' · ' + p + '%')]),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + p + '%' }))
        ]);
      })) : h('p', { class: 'muted' }, 'Hali arxivlangan o’quvchi yo’q.'),
      h('p', { class: 'small muted' }, 'Arxivlashda sabab so’raladi — "Narx qimmat" ko’p chiqsa, narx/chegirma siyosatini, "O’qituvchi yoqmadi" ko’p chiqsa, guruhni ko’rib chiqing.'),
      left.length ? UI.table([
        { label: 'O’quvchi', render: function (s) { return h('a', { href: '#', onclick: function (e) { e.preventDefault(); App.go('student', { id: s.id }); } }, Q.studentName(s.id)); } },
        { label: 'Ketgan', render: function (s) { return s.leftAt ? A.dateLabel(s.leftAt) : '—'; } },
        { label: 'Sabab', render: function (s) { return s.leftReason ? reasonLabel(s.leftReason) : h('span', { class: 'muted' }, '—'); } },
        { label: 'Izoh', render: function (s) { return s.leftNote || ''; } }
      ], A.sortBy(left, 'leftAt', 'desc').slice(0, 100)) : null
    ].filter(Boolean), null, true);
  }

  /** Arxivlashda sabab so'rash — qaytaradi {reason, note} yoki null */
  A.askLeaveReason = function (name) {
    return new Promise(function (resolve) {
      var fR = UI.field({ label: 'Nega ketyapti?', type: 'select', value: 'boshqa', options: LEAVE_REASONS.map(function (r) { return { value: r[0], label: r[1] }; }) });
      var fN = UI.field({ label: 'Izoh (ixtiyoriy)', type: 'textarea', rows: 2 });
      var done = false;
      UI.modal({
        title: 'Arxivlash: ' + name,
        body: [h('p', { class: 'small muted' }, 'Davomat va hisob-kitoblar saqlanib qoladi. Sabab "Saqlab qolish" hisobotiga tushadi.'), fR.wrap, fN.wrap],
        actions: [
          { label: 'Bekor qilish' },
          { label: 'Arxivlash', cls: 'danger', onClick: function (c) { done = true; c(); resolve({ reason: fR.input.value, note: fN.input.value.trim().slice(0, 300) }); } }
        ],
        onClose: function () { if (!done) resolve(null); }
      });
    });
  };

  /* ======================= TAVSIYA BONUSI ======================= */
  A.referralCard = function (App) {
    var conf = (D.settings && D.settings.referral) || {};
    var refs = A.sortBy(D.all('referrals'), 'createdAt', 'desc');
    var byRef = {};
    refs.forEach(function (r) { byRef[r.referrerId] = (byRef[r.referrerId] || 0) + 1; });
    var top = Object.keys(byRef).map(function (id) { return { id: id, n: byRef[id] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
    function stPill(r) {
      return r.status === 'berildi' ? UI.pill('Berildi', 'ok') : (r.status === 'tayyor' ? UI.pill('Tayyor — qo’llang', 'warn') : UI.pill('Kutilmoqda', 'mute'));
    }
    var intro = conf.enabled ? null : h('div', { class: 'banner info', style: 'margin:0 0 10px' }, h('div', {}, [
      h('b', {}, 'Tavsiya bonusi yoqilmagan. '), 'Sozlamalar → Tavsiya bonusi: summani yozing va yoqing — har o’quvchi kabinetida o’z kodi chiqadi.',
      App.can('settings.edit') ? h('button', { class: 'btn sm', style: 'margin-left:8px', onclick: function () { App.go('settings', { tab: 'tel' }); } }, 'Sozlash') : null
    ]));
    return UI.card('Tavsiya bonusi — "Do‘stingni olib kel"', [
      intro,
      h('p', { class: 'small muted' }, 'Yangi o’quvchi tavsiya kodi bilan keladi → "Kutilmoqda". Birinchi to’lovini qilgach → "Tayyor". Siz bonusni tavsiya qilgan o’quvchining ochiq hisobiga chegirma qilib qo’llaysiz — pul o’z-o’zidan hech qayerga yozilmaydi.'),
      top.length ? h('div', { class: 'rowflex', style: 'gap:6px;flex-wrap:wrap;margin-bottom:10px' }, top.map(function (t) {
        return UI.pill(Q.studentName(t.id) + ' · ' + t.n, 'info');
      })) : null,
      refs.length ? UI.table([
        { label: 'Tavsiya qildi', render: function (r) { return h('a', { href: '#', onclick: function (e) { e.preventDefault(); App.go('student', { id: r.referrerId }); } }, h('b', {}, Q.studentName(r.referrerId))); } },
        { label: 'Yangi o’quvchi', render: function (r) { return h('a', { href: '#', onclick: function (e) { e.preventDefault(); App.go('student', { id: r.referredId }); } }, Q.studentName(r.referredId)); } },
        { label: 'Sana', render: function (r) { return h('span', { class: 'mono small' }, r.createdAt); } },
        { label: 'Bonus', render: function (r) { return A.som(r.amount || 0); } },
        { label: 'Holat', render: stPill },
        { label: '', right: true, render: function (r) {
          if (r.status !== 'tayyor' || !App.can('invoice.create')) return r.status === 'berildi' && r.invoiceId ? h('span', { class: 'small muted' }, 'Hisob: ' + r.invoiceId.slice(-12)) : '';
          return h('button', { class: 'btn sm primary', onclick: function () { applyModal(r, App); } }, 'Hisobga qo’llash');
        } }
      ], refs.slice(0, 200), { page: 50 }) : h('p', { class: 'muted' }, 'Hali tavsiya bilan kelgan o’quvchi yo’q.')
    ].filter(Boolean), null, true);
  };
  function applyModal(r, App) {
    var invs = A.Fin.everyInvoice().filter(function (i) { return i.studentId === r.referrerId; });
    var paid = A.paidByInvoice(A.Fin.everyPayment());
    var open = invs.filter(function (i) { return A.invoiceRemaining(i, paid) > 0; });
    open = A.sortBy(open, 'month', 'desc');
    if (!open.length) { UI.toast('Tavsiya qilgan o’quvchida ochiq hisob yo’q — keyingi oy hisobi chiqqach qo’llang.', 'bad'); return; }
    var fI = UI.field({ label: 'Qaysi hisobga', type: 'select', value: open[0].id,
      options: open.map(function (i) { return { value: i.id, label: A.monthLabel(i.month) + ' — qoldiq ' + A.som(A.invoiceRemaining(i, paid)) }; }) });
    UI.modal({
      title: 'Bonusni qo’llash: ' + Q.studentName(r.referrerId),
      body: [h('p', {}, 'Bonus ' + A.som(r.amount || 0) + ' so’m — tanlangan hisobdan ayiriladi (chegirma).'), fI.wrap],
      actions: [{ label: 'Bekor qilish' }, { label: 'Qo’llash', cls: 'primary', onClick: function (c, btn) {
        UI.busy(btn, async function () {
          try {
            var res = await D.api('POST', 'api/referral/apply', { id: r.id, invoiceId: fI.input.value });
            await D.loadBootstrap();
            c(); UI.toast('Bonus qo’llandi: ' + A.som(res.applied) + ' so’m', 'ok'); App.render();
          } catch (e) { UI.toast(e.message, 'bad'); }
        });
      } }]
    });
  }

  /** O'quvchi kartasida: kod, kim tavsiya qilgan, kimlarni olib kelgan */
  A.referralBlock = function (s) {
    var refs = D.all('referrals');
    var brought = refs.filter(function (r) { return r.referrerId === s.id; });
    var by = s.referredBy ? D.one('students', s.referredBy) : null;
    return h('div', { class: 'ref-block' }, [
      h('div', { class: 'rowflex', style: 'gap:8px;align-items:center;flex-wrap:wrap' }, [
        h('span', { class: 'small muted' }, 'Tavsiya kodi:'),
        h('code', { class: 'mono', style: 'font-size:16px;letter-spacing:.1em' }, s.refCode || '—'),
        s.refCode ? h('button', { class: 'btn sm', type: 'button', onclick: function () { UI.copy(s.refCode); UI.toast('Nusxalandi', 'ok'); } }, 'Nusxalash') : null
      ]),
      by ? h('div', { class: 'small', style: 'margin-top:4px' }, ['Kim tavsiya qildi: ', h('b', {}, Q.studentName(by.id))]) : null,
      brought.length ? h('div', { class: 'small', style: 'margin-top:4px' }, 'Olib kelgan: ' + brought.map(function (r) { return Q.studentName(r.referredId) + ' (' + (r.status === 'berildi' ? 'bonus berildi' : r.status) + ')'; }).join(', ')) : null
    ]);
  };

  /* ======================= SOZLAMALAR: Telefoniya + Tavsiya ======================= */
  A.telSettingsCard = function (App) {
    var box = h('div');
    var conf = null, token = '', has = {};
    async function load() {
      try { var r = await D.api('GET', 'api/tel/config'); conf = r.conf; token = r.webhookToken; has = r.has || {}; }
      catch (e) { conf = { enabled: false, provider: 'umumiy', exts: {} }; }
      paint();
    }
    function paint() {
      UI.clear(box);
      var fOn = UI.field({ label: 'Holat', type: 'select', value: conf.enabled ? 'on' : 'off', options: [{ value: 'on', label: 'Yoqilgan' }, { value: 'off', label: 'O’chirilgan' }] });
      var fP = UI.field({ label: 'Provayder', type: 'select', value: conf.provider, options: [{ value: 'sipuni', label: 'Sipuni' }, { value: 'onlinepbx', label: 'OnlinePBX' }, { value: 'umumiy', label: 'Boshqa (umumiy webhook)' }] });
      var fUser = UI.field({ label: 'Sipuni: API foydalanuvchi (user)', value: '', placeholder: has.apiUser ? '•••••• (saqlangan)' : '' });
      var fSecret = UI.field({ label: 'Sipuni: API kaliti (secret)', type: 'password', value: '', placeholder: has.apiSecret ? '•••••• (saqlangan)' : '' });
      var fDomain = UI.field({ label: 'OnlinePBX: domen', value: has.domain || '', placeholder: 'markaz.onpbx.ru' });
      var fKey = UI.field({ label: 'OnlinePBX / umumiy: kalit', type: 'password', value: '', placeholder: has.apiKey ? '•••••• (saqlangan)' : 'key_id:key' });
      var fBase = UI.field({ label: 'Umumiy: qo’ng’iroq API manzili (POST {from,to})', value: '', placeholder: has.apiBase ? '•••••• (saqlangan)' : 'https://…' });
      var fMissed = UI.field({ label: 'Javobsiz kiruvchi qo’ng’iroq', type: 'select', value: conf.missedTask === false ? 'off' : 'on', options: [{ value: 'on', label: 'Vazifa ochilsin ("Qayta qo’ng’iroq qiling")' }, { value: 'off', label: 'Faqat ro’yxatda tursin' }] });
      var fLead = UI.field({ label: 'Notanish raqamdan qo’ng’iroq', type: 'select', value: conf.autoLead === false ? 'off' : 'on', options: [{ value: 'on', label: 'Murojaat ochilsin' }, { value: 'off', label: 'Murojaat ochilmasin' }] });
      function syncP() {
        var p = fP.input.value;
        fUser.wrap.hidden = fSecret.wrap.hidden = p !== 'sipuni';
        fDomain.wrap.hidden = p !== 'onlinepbx';
        fKey.wrap.hidden = p === 'sipuni';
        fBase.wrap.hidden = p !== 'umumiy';
      }
      fP.input.addEventListener('change', syncP); syncP();
      var hook = location.origin + '/api/tel/webhook/' + (token || '…');
      var exts = h('div', { class: 'ext-list' });
      var extInputs = {};
      D.all('users').filter(function (u) { return u.active !== false; }).forEach(function (u) {
        var f = UI.field({ label: u.name + ' (' + u.login + ')', value: (conf.exts || {})[u.id] || '', placeholder: '101' });
        extInputs[u.id] = f.input;
        exts.appendChild(f.wrap);
      });
      box.appendChild(h('div', {}, [
        h('p', { class: 'small muted' }, 'PBX (Sipuni, OnlinePBX yoki boshqa) har qo’ng’iroq haqida quyidagi manzilga xabar yuboradi. Kiruvchi notanish raqam → murojaat, javobsiz → vazifa, hammasi Murojaatlar → Qo’ng’iroqlar bo’limida. "ERP’dan" tugmasi bosilganda xodimning ichki raqami jiringlaydi va mijozga ulanadi.'),
        h('div', { class: 'grid2' }, [fOn.wrap, fP.wrap]),
        h('div', { class: 'field full' }, [h('label', {}, 'Webhook manzili (PBX sozlamasiga qo’ying)'),
          h('div', { class: 'rowflex', style: 'gap:6px;align-items:center;flex-wrap:wrap' }, [
            h('code', { class: 'mono small', style: 'word-break:break-all' }, hook),
            token ? h('button', { class: 'btn sm', type: 'button', onclick: function () { UI.copy(hook); UI.toast('Nusxalandi', 'ok'); } }, 'Nusxalash') : null,
            token ? h('button', { class: 'btn sm', type: 'button', onclick: async function () {
              if (await UI.confirm('Tokenni yangilash', 'Eski manzil ishlamay qoladi — PBX da yangisini yozish kerak.', 'Yangilash', true)) {
                await D.api('POST', 'api/tel/config', Object.assign(values(), { rotate: true })); await load();
              }
            } }, 'Tokenni yangilash') : null
          ]),
          h('div', { class: 'help' }, 'Sipuni: Sozlamalar → Integratsiya → Webhook. OnlinePBX: Интеграции → HTTP-уведомления (call_start, call_end).')]),
        h('div', { class: 'grid2' }, [fUser.wrap, fSecret.wrap, fDomain.wrap, fKey.wrap, fBase.wrap]),
        h('div', { class: 'grid2' }, [fMissed.wrap, fLead.wrap]),
        h('div', { class: 'field full' }, [h('label', {}, 'Xodimlarning ichki raqamlari (ext) — "ERP’dan qo’ng’iroq" va javobsiz qo’ng’iroq vazifasi shu bo’yicha'), exts]),
        h('div', { class: 'rowflex', style: 'gap:8px;flex-wrap:wrap' }, [
          h('button', { class: 'btn primary', type: 'button', onclick: function (e) {
            UI.busy(e.currentTarget, async function () {
              try { await D.api('POST', 'api/tel/config', values()); await D.loadBootstrap(); await load(); A.telLive.start(App); UI.toast('Saqlandi.', 'ok'); }
              catch (x) { UI.toast(x.message, 'bad'); }
            });
          } }, 'Saqlash'),
          h('button', { class: 'btn', type: 'button', onclick: function (e) {
            UI.busy(e.currentTarget, async function () {
              try { var r = await D.api('POST', 'api/tel/test', {}); await D.loadBootstrap();
                UI.toast(r.ok ? 'Sinov qo’ng’irog’i yozildi: Murojaatlar → Qo’ng’iroqlar' : 'Xato', r.ok ? 'ok' : 'bad'); }
              catch (x) { UI.toast(x.message, 'bad'); }
            });
          } }, 'Sinov qo’ng’irog’i'),
          h('button', { class: 'btn', type: 'button', onclick: function () { App.go('leads', { view: 'calls' }); } }, 'Qo’ng’iroqlar ro’yxati'),
          typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? h('button', { class: 'btn', type: 'button', onclick: function (e) {
            Notification.requestPermission().then(function (p) { UI.toast(p === 'granted' ? 'Brauzer bildirishnomasi yoqildi.' : 'Ruxsat berilmadi.', p === 'granted' ? 'ok' : 'bad'); if (p === 'granted') e.target.remove(); });
          } }, 'Brauzer bildirishnomasini yoqish') : null
        ].filter(Boolean))
      ]));
      function values() {
        var ex = {};
        Object.keys(extInputs).forEach(function (id) { var v = extInputs[id].value.trim(); if (v) ex[id] = v; });
        return { enabled: fOn.input.value === 'on', provider: fP.input.value, exts: ex,
          missedTask: fMissed.input.value === 'on', autoLead: fLead.input.value === 'on',
          apiUser: fUser.input.value, apiSecret: fSecret.input.value, domain: fDomain.input.value, apiKey: fKey.input.value, apiBase: fBase.input.value };
      }
    }
    load();
    return UI.card('Telefoniya (IP / SIP)', box);
  };

  A.referralSettingsCard = function (App) {
    var r = (D.settings && D.settings.referral) || {};
    var fOn = UI.field({ label: 'Holat', type: 'select', value: r.enabled ? 'on' : 'off', options: [{ value: 'on', label: 'Yoqilgan — kabinetda kod chiqadi' }, { value: 'off', label: 'O’chirilgan' }] });
    var fAmt = UI.field({ label: 'Bonus summasi (so’m)', type: 'number', value: r.amount || 100000, min: 0, step: 10000 });
    var fTxt = UI.field({ label: 'O’quvchiga ko’rinadigan matn', type: 'textarea', rows: 2, value: r.text || '', placeholder: 'Do‘stingizni olib keling — 100 000 so‘m chegirma olasiz.' });
    return UI.card('Tavsiya bonusi — "Do‘stingni olib kel"', [
      h('p', { class: 'small muted' }, 'Har o’quvchida o’z kodi bor (kabinetda ko’rinadi). Do’sti shu kod bilan yozilsa va birinchi to’lovini qilsa — bonus "tayyor" bo’ladi; siz uni Saqlab qolish → Tavsiya bonusi bo’limida hisobga chegirma qilib qo’llaysiz.'),
      h('div', { class: 'grid2' }, [fOn.wrap, fAmt.wrap]), fTxt.wrap,
      h('button', { class: 'btn primary', type: 'button', onclick: function (e) {
        UI.busy(e.currentTarget, async function () {
          var s = Object.assign({}, D.settings, { referral: { enabled: fOn.input.value === 'on', amount: Math.max(0, Math.round(Number(fAmt.input.value) || 0)), text: fTxt.input.value.trim().slice(0, 300) } });
          await D.saveSettings(s);
          await A.Ops.audit(App.user, 'Tavsiya bonusi sozlandi', s.referral.enabled ? 'yoqilgan' : 'o’chirilgan', A.som(s.referral.amount));
          UI.toast('Saqlandi.', 'ok');
        });
      } }, 'Saqlash')
    ]);
  };
})(typeof window !== 'undefined' ? window : globalThis);
