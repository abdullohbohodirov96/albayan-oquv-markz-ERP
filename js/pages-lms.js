/* Albyana ERP — o'quv qismi:
   O'quv dasturi, dars jarayoni (jurnal, test, savol-javob, fikr),
   o'quv hisobotlari, bayram va tanaffuslar, ota-ona hisoblari.

   Bu yerdagi sahifalar serverdagi yo'llar bilan ishlaydi: dastur va
   natijalar bazaga faqat server orqali yoziladi (js dan to'g'ridan-to'g'ri
   yozib bo'lmaydi — server buni rad etadi).                              */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  A.Pages = A.Pages || {};

  var LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  function box(text) {
    return h('div', { class: 'card' }, h('div', { class: 'card-body' },
      h('p', { class: 'muted', style: 'margin:0' }, text || 'Yuklanmoqda…')));
  }
  function err(e) { UI.toast((e && e.message) || 'Xato yuz berdi.', 'bad'); }

  /** Sahifa ma'lumotini bir marta yuklab, keyin qayta chizish */
  function loader(view, App, key, fetcher, painter) {
    App._lms = App._lms || {};
    var cache = App._lms[key];
    if (cache && cache.ok) { painter(cache.data); return; }
    view.appendChild(box());
    fetcher().then(function (d) {
      App._lms[key] = { ok: true, data: d };
      App.render();
    }).catch(function (e) {
      App._lms[key] = { ok: true, data: null, error: e.message };
      App.render();
    });
  }
  function drop(App, key) { if (App._lms) delete App._lms[key]; }
  A.lmsDrop = drop;

  /* ================= O'QUV DASTURI ================= */
  A.Pages.curriculum = function (view, route, App) {
    App.guard('curriculum.view');
    var canEdit = App.can('curriculum.edit');

    view.appendChild(UI.pageHead('O’quv dasturi', 'Daraja → modul → dars → material va vazifa', [
      canEdit ? h('button', {
        class: 'btn primary', onclick: function () { moduleForm(null, App); }
      }, [UI.icon('plus'), 'Modul qo’shish']) : null
    ]));

    loader(view, App, 'curriculum', function () {
      return D.api('GET', 'api/curriculum');
    }, function (d) {
      if (!d) { view.appendChild(box('Dasturni yuklab bo’lmadi.')); return; }
      var lvl = route.level || 'A1';
      view.appendChild(UI.tabs(d.tree.map(function (l) {
        return { id: l.level, label: l.level + ' · ' + l.name };
      }), lvl, function (id) { App.go('curriculum', { level: id }); }));

      var cur = d.tree.filter(function (l) { return l.level === lvl; })[0];
      if (!cur || !cur.modules.length) {
        view.appendChild(UI.empty({
          title: 'Bu darajada modul yo’q',
          text: canEdit ? 'Yangi modul qo’shing.' : 'Administrator modul qo’shishi kerak.'
        }));
        return;
      }
      cur.modules.forEach(function (m) {
        var rows = m.topics.map(function (t) {
          return h('div', { class: 'cur-topic' }, [
            h('button', {
              class: 'cur-title', type: 'button',
              onclick: function () { topicView(t.id, App); }
            }, [h('b', {}, t.title || '(nomsiz dars)'),
            h('span', { class: 'small muted' },
              t.materials + ' material · ' + t.homework + ' vazifa')]),
            canEdit ? h('button', {
              class: 'btn sm', type: 'button',
              onclick: function () { topicForm(m.id, t.id, App); }
            }, UI.icon('edit')) : null
          ]);
        });
        view.appendChild(UI.card(m.name, [
          m.about ? h('p', { class: 'small muted' }, m.about) : null,
          rows.length ? h('div', { class: 'cur-list' }, rows)
            : h('p', { class: 'muted small' }, 'Darslar qo’shilmagan.'),
          canEdit ? h('div', { class: 'row-actions' }, [
            h('button', {
              class: 'btn sm', onclick: function () { topicForm(m.id, null, App); }
            }, [UI.icon('plus'), 'Dars qo’shish']),
            h('button', {
              class: 'btn sm', onclick: function () { moduleForm(m, App); }
            }, [UI.icon('edit'), 'Modulni tahrirlash']),
            h('button', {
              class: 'btn sm danger', onclick: function () { delAsk('module', m.id, m.name, App); }
            }, [UI.icon('trash'), 'O’chirish'])
          ]) : null
        ]));
      });
    });
  };

  function moduleForm(mod, App) {
    var f = UI.form([
      { name: 'name', label: 'Modul nomi', value: mod ? mod.name : '', required: true },
      {
        name: 'level', label: 'Daraja', type: 'select', value: mod ? mod.level : 'A1',
        options: LEVELS.map(function (l) { return { value: l, label: l }; })
      },
      { name: 'hours', label: 'Soat (taxminiy)', type: 'number', value: mod ? mod.hours : '' },
      { name: 'about', label: 'Izoh', type: 'textarea', value: mod ? mod.about : '' }
    ]);
    UI.modal({
      title: mod ? 'Modulni tahrirlash' : 'Yangi modul',
      body: f.node,
      actions: [{ label: 'Bekor qilish' }, {
        label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
          if (!f.validate()) return;
          var v = f.values();
          UI.busy(btn, async function () {
            try {
              var id = mod ? mod.id : 'mod_' + Date.now().toString(36);
              await D.api('PUT', 'api/doc?path=' + encodeURIComponent('modules/' + id), {
                data: {
                  id: id, name: v.name, level: v.level,
                  hours: Number(v.hours) || 0, about: v.about,
                  order: mod ? mod.order : undefined, active: true
                }
              });
              drop(App, 'curriculum');
              close(true); UI.toast('Modul saqlandi.', 'ok'); App.render();
            } catch (e) { err(e); }
          });
        }
      }]
    });
  }

  function topicForm(moduleId, topicId, App) {
    (async function () {
      var t = null;
      if (topicId) {
        try { t = (await D.api('GET', 'api/curriculum/topic?id=' + encodeURIComponent(topicId))).topic; }
        catch (e) { err(e); return; }
      }
      var f = UI.form([
        { name: 'title', label: 'Dars mavzusi', value: t ? t.title : '', required: true },
        { name: 'goal', label: 'Maqsad (nimani o’rganadi)', type: 'textarea', value: t ? t.goal : '' },
        { name: 'about', label: 'Izoh', type: 'textarea', value: t ? t.about : '' }
      ]);
      UI.modal({
        title: t ? 'Darsni tahrirlash' : 'Yangi dars',
        body: f.node,
        actions: [{ label: 'Bekor qilish' }, {
          label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
            if (!f.validate()) return;
            var v = f.values();
            UI.busy(btn, async function () {
              try {
                var id = topicId || 'top_' + Date.now().toString(36);
                await D.api('PUT', 'api/doc?path=' + encodeURIComponent('topics/' + id), {
                  data: {
                    id: id, moduleId: moduleId, title: v.title,
                    goal: v.goal, about: v.about, active: true
                  }
                });
                drop(App, 'curriculum');
                close(true); UI.toast('Dars saqlandi.', 'ok'); App.render();
              } catch (e) { err(e); }
            });
          }
        }]
      });
    })();
  }

  function delAsk(kind, id, name, App) {
    UI.confirm(kind === 'module' ? 'Modulni o’chirish' : 'Darsni o’chirish',
      '«' + (name || id) + '» va uning ichidagi barcha yozuvlar o’chadi. Davom etamizmi?',
      'Ha, o’chirilsin', true).then(function (yes) {
        if (!yes) return;
        D.api('POST', 'api/curriculum/delete', { kind: kind, id: id }).then(function () {
          drop(App, 'curriculum');
          UI.toast('O’chirildi.', 'ok'); App.render();
        }).catch(err);
      });
  }

  /** Dars oynasi: material va vazifalar */
  function topicView(topicId, App) {
    (async function () {
      var d;
      try { d = await D.api('GET', 'api/curriculum/topic?id=' + encodeURIComponent(topicId)); }
      catch (e) { err(e); return; }
      var canEdit = App.can('curriculum.edit');
      var body = h('div', {});

      function paint() {
        UI.clear(body);
        body.appendChild(h('p', { class: 'small muted', style: 'margin:0 0 8px' },
          (d.module ? d.module.level + ' · ' + d.module.name : '')));
        if (d.topic.goal) body.appendChild(h('p', {}, d.topic.goal));

        body.appendChild(h('h3', { class: 'sec-h' }, 'Materiallar'));
        body.appendChild(d.materials.length
          ? h('div', { class: 'cur-list' }, d.materials.map(function (m) {
            return h('div', { class: 'cur-topic' }, [
              h('div', { class: 'cur-title' }, [
                h('b', {}, m.title || 'Material'),
                m.fileId ? h('a', {
                  class: 'small', href: 'api/file?id=' + encodeURIComponent(m.fileId), target: '_blank'
                }, 'Faylni ochish')
                  : (m.url ? h('a', { class: 'small', href: m.url, target: '_blank', rel: 'noopener' }, m.url) : null)
              ])
            ]);
          }))
          : h('p', { class: 'muted small' }, 'Material qo’shilmagan.'));

        body.appendChild(h('h3', { class: 'sec-h' }, 'Uy vazifalari'));
        body.appendChild(d.homework.length
          ? h('div', { class: 'cur-list' }, d.homework.map(function (w) {
            return h('div', { class: 'cur-topic' }, [
              h('div', { class: 'cur-title' }, [
                h('b', {}, w.title || 'Vazifa'),
                w.about ? h('span', { class: 'small muted' }, w.about) : null
              ])
            ]);
          }))
          : h('p', { class: 'muted small' }, 'Vazifa qo’shilmagan.'));
      }
      paint();

      UI.modal({
        title: d.topic.title || 'Dars',
        body: body,
        actions: [
          canEdit ? {
            label: 'Material qo’shish', onClick: function (close) {
              close(); itemForm('materials', topicId, App);
            }
          } : null,
          canEdit ? {
            label: 'Vazifa qo’shish', onClick: function (close) {
              close(); itemForm('homework', topicId, App);
            }
          } : null,
          { label: 'Yopish', cls: 'primary' }
        ].filter(Boolean)
      });
    })();
  }

  /** Material yoki vazifa qo'shish (fayl bilan) */
  function itemForm(col, topicId, App) {
    var isMat = col === 'materials';
    var fileBox = h('div', { class: 'small muted' }, 'Fayl tanlanmagan');
    var fileId = '';
    var picker = h('input', { type: 'file', style: 'display:none' });
    picker.addEventListener('change', function () {
      var file = picker.files && picker.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { UI.toast('Fayl 10 MB dan katta.', 'bad'); return; }
      fileBox.textContent = 'Yuklanmoqda…';
      var fr = new FileReader();
      fr.onload = function () {
        var b64 = String(fr.result).split(',')[1] || '';
        D.api('POST', 'api/file', {
          name: file.name, type: file.type, data: b64,
          purpose: isMat ? 'material' : 'vazifa'
        }).then(function (r) {
          fileId = r.file.id;
          fileBox.textContent = r.file.name + ' (' + Math.round(r.file.bytes / 1024) + ' KB)';
        }).catch(function (e) { fileBox.textContent = 'Yuklanmadi'; err(e); });
      };
      fr.readAsDataURL(file);
    });

    var f = UI.form([
      { name: 'title', label: isMat ? 'Material nomi' : 'Vazifa nomi', required: true },
      { name: 'about', label: 'Izoh', type: 'textarea' },
      isMat ? { name: 'url', label: 'Havola (ixtiyoriy)' } : null,
      {
        node: h('div', { class: 'f' }, [
          h('label', {}, 'Fayl (ixtiyoriy)'),
          h('div', { class: 'row-actions' }, [
            h('button', {
              class: 'btn sm', type: 'button', onclick: function () { picker.click(); }
            }, [UI.icon('upload'), 'Fayl tanlash']),
            fileBox
          ]),
          picker
        ])
      }
    ].filter(Boolean));

    UI.modal({
      title: isMat ? 'Yangi material' : 'Yangi vazifa',
      body: f.node,
      actions: [{ label: 'Bekor qilish' }, {
        label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
          if (!f.validate()) return;
          var v = f.values();
          UI.busy(btn, async function () {
            try {
              var id = (isMat ? 'mat_' : 'hw_') + Date.now().toString(36);
              await D.api('PUT', 'api/doc?path=' + encodeURIComponent(col + '/' + id), {
                data: {
                  id: id, topicId: topicId, title: v.title, about: v.about,
                  url: v.url || '', fileId: fileId, active: true
                }
              });
              drop(App, 'curriculum');
              close(true); UI.toast('Saqlandi.', 'ok'); App.render();
            } catch (e) { err(e); }
          });
        }
      }]
    });
  }

  /* ================= DARS JARAYONI ================= */
  A.Pages.learning = function (view, route, App) {
    App.guard('group.view');
    var groups = A.scopeGroups(App.user, D.all('groups'))
      .filter(function (g) { return g.status !== 'yopilgan'; });
    groups = A.sortBy(groups, 'name');
    var gid = route.group || (groups[0] && groups[0].id) || '';
    var tab = route.tab || 'log';

    view.appendChild(UI.pageHead('Dars jarayoni', 'Dars yozuvi, testlar, savollar va fikrlar', [
      h('select', {
        class: 'sel', onchange: function (e) { App.go('learning', { group: e.target.value, tab: tab }); }
      }, groups.map(function (g) {
        return h('option', { value: g.id, selected: g.id === gid ? 'selected' : null },
          (g.code ? g.code + ' · ' : '') + g.name);
      }))
    ]));

    if (!gid) { view.appendChild(UI.empty({ title: 'Guruh yo’q' })); return; }

    view.appendChild(UI.tabs([
      { id: 'log', label: 'Dars yozuvi' },
      { id: 'quiz', label: 'Testlar' },
      { id: 'qa', label: 'Savol-javob' },
      { id: 'fb', label: 'Fikrlar' },
      { id: 'mk', label: 'Qo’shimcha dars' }
    ], tab, function (id) { App.go('learning', { group: gid, tab: id }); }));

    if (tab === 'log') return tabLog(view, gid, App);
    if (tab === 'quiz') return tabQuiz(view, gid, App);
    if (tab === 'qa') return tabQa(view, gid, App);
    if (tab === 'fb') return tabFeedback(view, gid, App);
    if (tab === 'mk') return tabMakeup(view, gid, App);
  };

  function tabLog(view, gid, App) {
    view.appendChild(UI.pageHead('', '', [
      App.can('lesson.log') ? h('button', {
        class: 'btn primary', onclick: function () { logForm(gid, null, App); }
      }, [UI.icon('plus'), 'Dars yozuvi']) : null
    ]));
    loader(view, App, 'log:' + gid, function () {
      return D.api('GET', 'api/lesson/log?groupId=' + encodeURIComponent(gid));
    }, function (d) {
      if (!d) { view.appendChild(box('Yuklab bo’lmadi.')); return; }
      if (!d.logs.length) { view.appendChild(UI.empty({ title: 'Dars yozuvi yo’q' })); return; }
      view.appendChild(UI.card(null, d.logs.map(function (l) {
        return h('div', { class: 'cur-topic' }, [
          h('div', { class: 'cur-title' }, [
            h('b', {}, A.dateLabel(l.date) + (l.title ? ' — ' + l.title : '')),
            l.homeworkText ? h('span', { class: 'small' }, 'Vazifa: ' + l.homeworkText) : null,
            l.note ? h('span', { class: 'small muted' }, l.note) : null
          ]),
          App.can('lesson.log') ? h('button', {
            class: 'btn sm', onclick: function () { logForm(gid, l, App); }
          }, UI.icon('edit')) : null
        ]);
      })));
    });
  }

  function logForm(gid, log, App) {
    (async function () {
      var next = null;
      try { next = (await D.api('GET', 'api/curriculum/next?groupId=' + encodeURIComponent(gid))).next; }
      catch (e) { /* dastur bo'lmasa ham dars yozuvi yoziladi */ }

      var f = UI.form([
        { name: 'date', label: 'Sana', type: 'date', value: log ? log.date : A.today(), required: true },
        {
          name: 'title', label: 'Mavzu',
          value: log ? log.title : (next ? next.title : ''), required: true
        },
        { name: 'note', label: 'Darsda nima bo’ldi', type: 'textarea', rows: 3, value: log ? log.note : '' },
        { name: 'homeworkText', label: 'Uy vazifasi', type: 'textarea', rows: 2, value: log ? log.homeworkText : '' },
        { name: 'dueDate', label: 'Vazifa muddati', type: 'date', value: log ? log.dueDate : '' }
      ]);
      UI.modal({
        title: log ? 'Dars yozuvini tahrirlash' : 'Dars yozuvi',
        body: [
          next && !log ? h('p', { class: 'small muted' },
            'Dastur bo’yicha keyingi dars: ' + next.title) : null,
          f.node
        ].filter(Boolean),
        actions: [{ label: 'Bekor qilish' }, {
          label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
            if (!f.validate()) return;
            var v = f.values();
            UI.busy(btn, async function () {
              try {
                await D.api('POST', 'api/lesson/log', {
                  groupId: gid, date: v.date, title: v.title, note: v.note,
                  homeworkText: v.homeworkText, dueDate: v.dueDate,
                  topicId: log ? log.topicId : (next ? next.topicId : '')
                });
                drop(App, 'log:' + gid);
                close(true); UI.toast('Dars yozuvi saqlandi.', 'ok'); App.render();
              } catch (e) { err(e); }
            });
          }
        }]
      });
    })();
  }

  function tabQuiz(view, gid, App) {
    view.appendChild(UI.pageHead('', '', [
      App.can('quiz.manage') ? h('button', {
        class: 'btn primary', onclick: function () { quizForm(gid, App); }
      }, [UI.icon('plus'), 'Test tuzish']) : null
    ]));
    var list = D.all('quizzes').filter(function (q) { return q.groupId === gid; });
    var res = D.all('quizres').filter(function (r) { return r.groupId === gid; });
    if (!list.length) { view.appendChild(UI.empty({ title: 'Test yo’q' })); return; }
    view.appendChild(UI.card(null, list.map(function (q) {
      var mine = res.filter(function (r) { return r.quizId === q.id; });
      var avg = mine.length ? Math.round(mine.reduce(function (s, r) { return s + r.percent; }, 0) / mine.length) : null;
      return h('div', { class: 'cur-topic' }, [
        h('div', { class: 'cur-title' }, [
          h('b', {}, q.title),
          h('span', { class: 'small muted' },
            q.count + ' savol · ' + mine.length + ' ta topshirgan' +
            (avg != null ? ' · o’rtacha ' + avg + '%' : ''))
        ]),
        App.can('quiz.manage') ? h('button', {
          class: 'btn sm danger', onclick: function () { quizDel(q, App); }
        }, UI.icon('trash')) : null
      ]);
    })));
  }

  function quizDel(q, App) {
    UI.confirm('Testni o’chirish', '«' + q.title + '» o’chadi. Natijalar qoladi. Davom etamizmi?',
      'Ha, o’chirilsin', true).then(function (yes) {
        if (!yes) return;
        D.api('POST', 'api/quiz/delete', { id: q.id })
          .then(function () { UI.toast('O’chirildi.', 'ok'); D.loadBootstrap().then(function () { App.render(); }); })
          .catch(err);
      });
  }

  /** Oddiy test tuzgich: savol matni + variantlar, to'g'risi belgilanadi */
  function quizForm(gid, App) {
    var qs = [];
    var list = h('div', { class: 'qz-list' });

    function addQ() {
      var item = { text: '', options: ['', '', '', ''], answer: 0 };
      qs.push(item);
      paint();
    }
    function paint() {
      UI.clear(list);
      qs.forEach(function (q, i) {
        var opts = q.options.map(function (o, j) {
          var inp = h('input', { type: 'text', value: o, placeholder: (j + 1) + '-variant' });
          inp.addEventListener('input', function () { q.options[j] = inp.value; });
          var radio = h('input', {
            type: 'radio', name: 'ans' + i, checked: q.answer === j ? 'checked' : null,
            'aria-label': 'To’g’ri javob'
          });
          radio.addEventListener('change', function () { q.answer = j; });
          return h('div', { class: 'qz-opt' }, [radio, inp]);
        });
        var t = h('input', { type: 'text', value: q.text, placeholder: 'Savol matni' });
        t.addEventListener('input', function () { q.text = t.value; });
        list.appendChild(h('div', { class: 'qz-q' }, [
          h('div', { class: 'qz-head' }, [
            h('b', {}, (i + 1) + '-savol'),
            h('button', {
              class: 'btn sm danger', type: 'button',
              onclick: function () { qs.splice(i, 1); paint(); }
            }, UI.icon('trash'))
          ]),
          t,
          h('div', { class: 'qz-opts' }, opts)
        ]));
      });
    }
    addQ();

    var f = UI.form([
      { name: 'title', label: 'Test nomi', required: true },
      { name: 'about', label: 'Izoh', type: 'textarea' },
      { name: 'pass', label: 'O’tish foizi', type: 'number', value: 60 }
    ]);

    UI.modal({
      title: 'Yangi test',
      body: [f.node, list, h('button', {
        class: 'btn sm', type: 'button', onclick: addQ
      }, [UI.icon('plus'), 'Savol qo’shish'])],
      actions: [{ label: 'Bekor qilish' }, {
        label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
          if (!f.validate()) return;
          var v = f.values();
          var clean = qs.filter(function (q) {
            return String(q.text || '').trim() && q.options.filter(function (o) { return String(o).trim(); }).length >= 2;
          }).map(function (q) {
            var keep = [], ans = 0;
            q.options.forEach(function (o, j) {
              if (String(o).trim()) { if (j === q.answer) ans = keep.length; keep.push(String(o).trim()); }
            });
            return { text: q.text, options: keep, answer: ans };
          });
          if (!clean.length) { UI.toast('Kamida bitta to’liq savol kerak.', 'bad'); return; }
          UI.busy(btn, async function () {
            try {
              await D.api('POST', 'api/quiz', {
                title: v.title, about: v.about, groupId: gid,
                pass: Number(v.pass) || 60, questions: clean
              });
              close(true); UI.toast('Test saqlandi.', 'ok');
              D.loadBootstrap().then(function () { App.render(); });
            } catch (e) { err(e); }
          });
        }
      }]
    });
  }

  function tabQa(view, gid, App) {
    loader(view, App, 'qa:' + gid, function () {
      return D.api('GET', 'api/questions?groupId=' + encodeURIComponent(gid));
    }, function (d) {
      if (!d) { view.appendChild(box('Yuklab bo’lmadi.')); return; }
      if (!d.questions.length) { view.appendChild(UI.empty({ title: 'Savol yo’q' })); return; }
      view.appendChild(UI.card(null, d.questions.map(function (q) {
        var st = D.one('students', q.studentId);
        return h('div', { class: 'qa-item' }, [
          h('div', { class: 'qa-top' }, [
            h('b', {}, st ? (st.lastName + ' ' + st.firstName) : 'O’quvchi'),
            h('span', { class: 'small muted' }, q.at)
          ]),
          h('p', { class: 'qa-text' }, q.text),
          (q.answers || []).length ? h('div', { class: 'qa-answers' }, q.answers.map(function (a) {
            return h('div', { class: 'qa-answer' }, [
              h('b', { class: 'small' }, a.byName || 'Ustoz'),
              h('span', {}, a.text)
            ]);
          })) : null,
          App.can('qa.answer') ? h('button', {
            class: 'btn sm', onclick: function () { answerForm(q, gid, App); }
          }, 'Javob yozish') : null
        ]);
      })));
    });
  }

  function answerForm(q, gid, App) {
    var f = UI.form([{ name: 'text', label: 'Javob', type: 'textarea', rows: 4, required: true }]);
    UI.modal({
      title: 'Savolga javob',
      body: [h('p', { class: 'small muted' }, q.text), f.node],
      actions: [{ label: 'Bekor qilish' }, {
        label: 'Yuborish', cls: 'primary', onClick: function (close, btn) {
          if (!f.validate()) return;
          UI.busy(btn, async function () {
            try {
              await D.api('POST', 'api/question/answer', { id: q.id, text: f.values().text });
              drop(App, 'qa:' + gid);
              close(true); UI.toast('Javob yuborildi.', 'ok'); App.render();
            } catch (e) { err(e); }
          });
        }
      }]
    });
  }

  function tabFeedback(view, gid, App) {
    if (!App.can('feedback.view')) { view.appendChild(UI.empty({ title: 'Ruxsat yo’q' })); return; }
    loader(view, App, 'fb:' + gid, function () {
      return D.api('GET', 'api/feedback?groupId=' + encodeURIComponent(gid));
    }, function (d) {
      if (!d) { view.appendChild(box('Yuklab bo’lmadi.')); return; }
      view.appendChild(UI.card('Umumiy baho', [
        h('div', { class: 'fb-sum' }, [
          h('b', {}, d.count ? String(d.avg) : '—'),
          h('span', { class: 'small muted' }, d.count + ' ta fikr')
        ]),
        h('div', { class: 'fb-bars' }, [5, 4, 3, 2, 1].map(function (s) {
          var n = (d.byStar || {})[s] || 0;
          var w = d.count ? Math.round(n / d.count * 100) : 0;
          return h('div', { class: 'fb-bar' }, [
            h('span', { class: 'small' }, s + '★'),
            h('div', { class: 'fb-track' }, h('span', { style: 'width:' + w + '%' })),
            h('span', { class: 'small muted' }, String(n))
          ]);
        }))
      ]));
      if (d.last && d.last.length) {
        view.appendChild(UI.card('Oxirgi fikrlar', d.last.map(function (f) {
          var st = f.studentId ? D.one('students', f.studentId) : null;
          return h('div', { class: 'qa-item' }, [
            h('div', { class: 'qa-top' }, [
              h('b', {}, f.anon ? 'Anonim' : (st ? st.lastName + ' ' + st.firstName : 'O’quvchi')),
              h('span', { class: 'small muted' }, f.rating + '★ · ' + f.at)
            ]),
            f.text ? h('p', { class: 'qa-text' }, f.text) : null
          ]);
        })));
      }
    });
  }

  function tabMakeup(view, gid, App) {
    var list = D.all('makeups').filter(function (m) { return m.groupId === gid; });
    view.appendChild(UI.pageHead('', '', [
      App.can('makeup.manage') ? h('button', {
        class: 'btn primary', onclick: function () { makeupForm(gid, App); }
      }, [UI.icon('plus'), 'Qo’shimcha dars']) : null
    ]));
    if (!list.length) { view.appendChild(UI.empty({ title: 'Qo’shimcha dars yo’q' })); return; }
    view.appendChild(UI.card(null, A.sortBy(list, 'date').map(function (m) {
      var st = D.one('students', m.studentId);
      return h('div', { class: 'cur-topic' }, [
        h('div', { class: 'cur-title' }, [
          h('b', {}, st ? (st.lastName + ' ' + st.firstName) : m.studentId),
          h('span', { class: 'small muted' },
            'Qoldirgan: ' + A.dateLabel(m.missedDate) + ' → ' + A.dateLabel(m.date) +
            (m.time ? ' ' + m.time : '') + ' · ' + m.status)
        ]),
        App.can('makeup.manage') && m.status !== 'bajarildi' ? h('div', { class: 'row-actions' }, [
          h('button', {
            class: 'btn sm', onclick: function () { setStatus(m, 'bajarildi', App); }
          }, 'Bajarildi'),
          h('button', {
            class: 'btn sm danger', onclick: function () { setStatus(m, 'bekor', App); }
          }, 'Bekor')
        ]) : null
      ]);
    })));
  }

  function setStatus(m, status, App) {
    D.api('POST', 'api/makeup/status', { id: m.id, status: status })
      .then(function () { UI.toast('Yangilandi.', 'ok'); D.loadBootstrap().then(function () { App.render(); }); })
      .catch(err);
  }

  function makeupForm(gid, App) {
    var members = D.all('memberships').filter(function (m) { return m.groupId === gid && m.status !== 'chiqdi'; });
    var opts = members.map(function (m) {
      var st = D.one('students', m.studentId);
      return { value: m.studentId, label: st ? (st.lastName + ' ' + st.firstName) : m.studentId };
    });
    if (!opts.length) { UI.toast('Guruhda o’quvchi yo’q.', 'bad'); return; }
    var f = UI.form([
      { name: 'studentId', label: 'O’quvchi', type: 'select', options: opts },
      { name: 'missedDate', label: 'Qoldirgan dars sanasi', type: 'date', required: true },
      { name: 'date', label: 'Qo’shimcha dars sanasi', type: 'date', required: true },
      { name: 'time', label: 'Vaqti', type: 'time' },
      { name: 'room', label: 'Xona' },
      { name: 'note', label: 'Izoh', type: 'textarea' }
    ]);
    UI.modal({
      title: 'Qo’shimcha dars',
      body: [h('p', { class: 'small muted' },
        'Faqat davomatda «kelmadi» yoki «sababli» deb belgilangan dars uchun beriladi.'), f.node],
      actions: [{ label: 'Bekor qilish' }, {
        label: 'Belgilash', cls: 'primary', onClick: function (close, btn) {
          if (!f.validate()) return;
          var v = f.values();
          UI.busy(btn, async function () {
            try {
              await D.api('POST', 'api/makeup', Object.assign({ groupId: gid }, v));
              close(true); UI.toast('Belgilandi.', 'ok');
              D.loadBootstrap().then(function () { App.render(); });
            } catch (e) { err(e); }
          });
        }
      }]
    });
  }

  /* ================= O'QUV HISOBOTLARI ================= */
  A.Pages.progress = function (view, route, App) {
    App.guard('reports.learning');
    view.appendChild(UI.pageHead('O’quv natijalari', 'Davomat, testlar va uy vazifasi'));
    loader(view, App, 'overview', function () {
      return D.api('GET', 'api/report/overview');
    }, function (d) {
      if (!d) { view.appendChild(box('Yuklab bo’lmadi.')); return; }
      view.appendChild(h('div', { class: 'tiles' }, [
        UI.tile({ label: 'Davomat', value: (d.attendance.percent != null ? d.attendance.percent + '%' : '—') }),
        UI.tile({ label: 'Belgilangan dars', value: String(d.attendance.total) }),
        UI.tile({ label: 'Test o’rtachasi', value: (d.quizzes.avgPercent != null ? d.quizzes.avgPercent + '%' : '—') }),
        UI.tile({ label: 'Testdan o’tish', value: (d.quizzes.passRate != null ? d.quizzes.passRate + '%' : '—') })
      ]));
      view.appendChild(UI.table([
        { key: 'name', label: 'Guruh' },
        { key: 'students', label: 'O’quvchi' },
        { key: 'att', label: 'Davomat' },
        { key: 'quiz', label: 'Test' },
        { key: 'lessons', label: 'Dars yozuvi' },
        { key: 'fb', label: 'Fikr' }
      ], d.groups.map(function (g) {
        return {
          id: g.id,
          name: (g.code ? g.code + ' · ' : '') + g.name,
          students: g.students,
          att: g.avgAttend != null ? g.avgAttend + '%' : '—',
          quiz: g.avgQuiz != null ? g.avgQuiz + '%' : '—',
          lessons: g.lessonsLogged,
          fb: g.feedback && g.feedback.count ? g.feedback.avg + '★' : '—'
        };
      }), { onRow: function (r) { App.go('progressGroup', { group: r.id }); } }));
    });
  };

  A.Pages.progressGroup = function (view, route, App) {
    App.guard('reports.learning');
    var gid = route.group || '';
    loader(view, App, 'pg:' + gid, function () {
      return D.api('GET', 'api/report/group?id=' + encodeURIComponent(gid));
    }, function (d) {
      if (!d) { view.appendChild(box('Yuklab bo’lmadi.')); return; }
      view.appendChild(UI.pageHead(d.group.name, 'O’quv natijalari', [
        h('button', { class: 'btn', onclick: function () { App.go('progress'); } }, [UI.icon('back'), 'Orqaga'])
      ]));
      view.appendChild(UI.table([
        { key: 'name', label: 'O’quvchi' },
        { key: 'lessons', label: 'Dars' },
        { key: 'att', label: 'Davomat' },
        { key: 'missed', label: 'Kelmadi' },
        { key: 'quiz', label: 'Test o’rtachasi' }
      ], d.students.map(function (s) {
        return {
          name: s.name, lessons: s.lessons,
          att: s.attendPercent != null ? s.attendPercent + '%' : '—',
          missed: s.missed,
          quiz: s.quizAvg != null ? s.quizAvg + '%' : '—'
        };
      })));
    });
  };

  /* ================= BAYRAM VA TANAFFUS ================= */
  A.Pages.holidays = function (view, route, App) {
    App.guard('holiday.manage');
    var list = A.sortBy(D.all('holidays'), 'from');
    view.appendChild(UI.pageHead('Bayram va tanaffus', 'Dars bo’lmaydigan kunlar', [
      h('button', { class: 'btn primary', onclick: function () { holidayForm(null, App); } },
        [UI.icon('plus'), 'Qo’shish'])
    ]));
    if (!list.length) { view.appendChild(UI.empty({ title: 'Yozuv yo’q' })); return; }
    view.appendChild(UI.card(null, list.map(function (x) {
      var g = x.groupId ? D.one('groups', x.groupId) : null;
      return h('div', { class: 'cur-topic' }, [
        h('div', { class: 'cur-title' }, [
          h('b', {}, x.name),
          h('span', { class: 'small muted' },
            A.dateLabel(x.from) + (x.to && x.to !== x.from ? ' → ' + A.dateLabel(x.to) : '') +
            ' · ' + (x.scope === 'guruh' ? ('guruh: ' + (g ? g.name : x.groupId)) : 'butun markaz'))
        ]),
        h('button', {
          class: 'btn sm danger', onclick: function () {
            UI.confirm('O’chirish', '«' + x.name + '» o’chirilsinmi?', 'Ha', true).then(function (yes) {
              if (!yes) return;
              D.api('POST', 'api/holiday/delete', { id: x.id })
                .then(function () { UI.toast('O’chirildi.', 'ok'); D.loadBootstrap().then(function () { App.render(); }); })
                .catch(err);
            });
          }
        }, UI.icon('trash'))
      ]);
    })));
  };

  function holidayForm(x, App) {
    var groups = A.sortBy(D.all('groups'), 'name');
    var f = UI.form([
      { name: 'name', label: 'Nomi', value: x ? x.name : '', required: true },
      { name: 'from', label: 'Boshlanish', type: 'date', value: x ? x.from : '', required: true },
      { name: 'to', label: 'Tugash (bir kun bo’lsa bo’sh qoldiring)', type: 'date', value: x ? x.to : '' },
      {
        name: 'scope', label: 'Kimga', type: 'select', value: x ? x.scope : 'markaz',
        options: [{ value: 'markaz', label: 'Butun markaz' }, { value: 'guruh', label: 'Bitta guruh' }]
      },
      {
        name: 'groupId', label: 'Guruh (faqat guruh tanlansa)', type: 'select', value: x ? x.groupId : '',
        options: [{ value: '', label: '—' }].concat(groups.map(function (g) {
          return { value: g.id, label: g.name };
        }))
      }
    ]);
    UI.modal({
      title: 'Dam olish kuni',
      body: f.node,
      actions: [{ label: 'Bekor qilish' }, {
        label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
          if (!f.validate()) return;
          var v = f.values();
          UI.busy(btn, async function () {
            try {
              await D.api('POST', 'api/holiday', v);
              close(true); UI.toast('Saqlandi.', 'ok');
              D.loadBootstrap().then(function () { App.render(); });
            } catch (e) { err(e); }
          });
        }
      }]
    });
  }

  /* ================= OTA-ONA HISOBLARI ================= */
  A.Pages.parents = function (view, route, App) {
    App.guard('parent.manage');
    var list = A.sortBy(D.all('parents'), 'name');
    view.appendChild(UI.pageHead('Ota-onalar', list.length + ' ta hisob', [
      h('button', { class: 'btn primary', onclick: function () { parentForm(null, App); } },
        [UI.icon('plus'), 'Ota-ona qo’shish'])
    ]));
    view.appendChild(h('div', { class: 'banner' },
      h('div', {}, [h('b', {}, 'Kabinet kodi. '),
      'Ota-ona kabinetga O’Z kodi bilan kiradi va faqat farzandlarining ma’lumotini ko’radi.'])));
    if (!list.length) { view.appendChild(UI.empty({ title: 'Hisob yo’q' })); return; }
    view.appendChild(UI.card(null, list.map(function (p) {
      var kids = (p.studentIds || []).map(function (id) {
        var s = D.one('students', id);
        return s ? (s.lastName + ' ' + s.firstName) : id;
      });
      return h('div', { class: 'cur-topic' }, [
        h('div', { class: 'cur-title' }, [
          h('b', {}, p.name + (p.relation ? ' (' + p.relation + ')' : '')),
          h('span', { class: 'small muted' },
            (p.phone ? p.phone + ' · ' : '') + 'kod: ' + p.code + ' · ' + (kids.join(', ') || 'farzand biriktirilmagan'))
        ]),
        h('div', { class: 'row-actions' }, [
          h('button', { class: 'btn sm', onclick: function () { parentForm(p, App); } }, UI.icon('edit')),
          h('button', {
            class: 'btn sm', onclick: function () {
              UI.confirm('Yangi kod', 'Eski kod ishlamay qoladi va ochiq kabinet yopiladi. Davom etamizmi?',
                'Ha', true).then(function (yes) {
                  if (!yes) return;
                  D.api('POST', 'api/parent/code', { id: p.id }).then(function (r) {
                    UI.toast('Yangi kod: ' + r.code, 'ok');
                    D.loadBootstrap().then(function () { App.render(); });
                  }).catch(err);
                });
            }
          }, 'Yangi kod')
        ])
      ]);
    })));
  };

  function parentForm(p, App) {
    var students = A.sortBy(D.all('students').filter(function (s) { return s.status !== 'o’chirilgan'; }), 'lastName');
    var picked = {};
    (p && p.studentIds || []).forEach(function (id) { picked[id] = 1; });
    var listBox = h('div', { class: 'par-kids' }, students.slice(0, 300).map(function (s) {
      var cb = h('input', { type: 'checkbox', checked: picked[s.id] ? 'checked' : null });
      cb.addEventListener('change', function () {
        if (cb.checked) picked[s.id] = 1; else delete picked[s.id];
      });
      return h('label', { class: 'par-kid' }, [cb, h('span', {}, s.lastName + ' ' + s.firstName)]);
    }));

    var f = UI.form([
      { name: 'name', label: 'Ism familiya', value: p ? p.name : '', required: true },
      { name: 'phone', label: 'Telefon', value: p ? p.phone : '' },
      {
        name: 'relation', label: 'Kim', type: 'select', value: p ? p.relation : 'ota',
        options: [{ value: 'ota', label: 'Ota' }, { value: 'ona', label: 'Ona' }, { value: 'vasiy', label: 'Vasiy' }]
      },
      { node: h('div', { class: 'f' }, [h('label', {}, 'Farzandlari'), listBox]) }
    ]);

    UI.modal({
      title: p ? 'Ota-onani tahrirlash' : 'Yangi ota-ona',
      body: f.node,
      actions: [{ label: 'Bekor qilish' }, {
        label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
          if (!f.validate()) return;
          var v = f.values();
          UI.busy(btn, async function () {
            try {
              var r = await D.api('POST', 'api/parent', Object.assign({
                id: p ? p.id : '', studentIds: Object.keys(picked)
              }, v));
              close(true);
              UI.toast('Saqlandi. Kabinet kodi: ' + r.parent.code, 'ok');
              D.loadBootstrap().then(function () { App.render(); });
            } catch (e) { err(e); }
          });
        }
      }]
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
