/* Albyana ERP — Formalar: markaz o'zi tuzadigan ariza shakllari.

   Ro'yxat → konstruktor (maydonlar, fon, havola) → kelgan arizalar.
   Har bir ariza avtomatik MUROJAAT (lead) ochadi — javoblar lead
   kartasida ham ko'rinadi.                                        */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;

  var TYPE_LABEL = {
    text: 'Qisqa matn', textarea: 'Uzun matn', phone: 'Telefon',
    select: 'Ro’yxatdan tanlash', radio: 'Bitta variant', checkbox: 'Bir nechta variant',
    number: 'Raqam', date: 'Sana', referral: 'Tavsiya kodi (do‘sti bergan)'
  };
  var TYPES = Object.keys(TYPE_LABEL);
  var TEMPLATES = null;
  var CONTACTS_DEF = null;

  function formUrl(f) {
    return location.origin + '/f/' + f.slug;
  }
  function subsOf(formId) {
    return A.sortBy(D.all('formsub').filter(function (s) { return s.formId === formId; }), 'at', 'desc');
  }
  function statOf(formId) {
    return D.one('formstat', formId) || { views: 0, starts: 0, submits: 0, fields: {}, days: {} };
  }
  function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }
  function imgUrl(f, kind) {
    return '/api/form-bg?id=' + encodeURIComponent(f.id) + '&kind=' + kind + '&v=' + (f[kind === 'bg' ? 'bgAt' : kind + 'At'] || 0);
  }

  /* ================= STATISTIKA ================= */
  function statCard(f) {
    var st = statOf(f.id);
    var fields = f.fields || [];
    var days = Object.keys(st.days || {}).sort().slice(-14);
    var maxV = Math.max.apply(null, [1].concat(days.map(function (d) { return st.days[d].v || 0; })));
    function tile(label, val, sub) {
      return h('div', { class: 'tile', style: 'cursor:default' }, [h('div', { class: 'lbl' }, label), h('div', { class: 'val' }, String(val)), sub ? h('div', { class: 'hint' }, sub) : null]);
    }
    var funnel = h('div', { class: 'funnel' }, [
      tile('Ko’rildi', st.views, 'havolani ochganlar'),
      tile('Boshladi', st.starts, st.views ? pct(st.starts, st.views) + '% ko’rganlardan' : ''),
      tile('Yubordi', st.submits, st.views ? pct(st.submits, st.views) + '% ko’rganlardan' : ''),
      tile('Tugatdi', (st.starts ? pct(st.submits, st.starts) : 0) + '%', 'boshlaganlardan')
    ]);
    var steps = h('div', { class: 'steps' }, fields.map(function (q) {
      var n = (st.fields || {})[q.id] || 0;
      var p = st.views ? pct(n, st.views) : 0;
      return h('div', { class: 'step' }, [
        h('div', { class: 'step-l' }, [h('span', {}, q.label), h('b', {}, n + ' · ' + p + '%')]),
        h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.min(100, p) + '%' }))
      ]);
    }));
    var chart = days.length ? h('div', { class: 'days' }, days.map(function (d) {
      var r = st.days[d];
      return h('div', { class: 'day', title: d + ': ko’rildi ' + r.v + ', boshladi ' + r.s + ', yubordi ' + r.c }, [
        h('div', { class: 'day-b' }, [
          h('i', { class: 'v', style: 'height:' + Math.round((r.v || 0) * 100 / maxV) + '%' }),
          h('i', { class: 'c', style: 'height:' + Math.round((r.c || 0) * 100 / maxV) + '%' })
        ]),
        h('span', { class: 'small muted' }, d.slice(8))
      ]);
    })) : h('p', { class: 'muted' }, 'Hali hech kim ochmagan. Havolani ulashing — statistika shu yerda yig’iladi.');
    return UI.card(f.title + ' — statistika', [
      funnel,
      h('div', { class: 'grid2', style: 'margin-top:12px' }, [
        h('div', {}, [h('label', { class: 'small muted' }, 'Savollar bo’yicha: qancha odam shu savolgacha yetdi'), steps]),
        h('div', {}, [h('label', { class: 'small muted' }, 'Oxirgi 14 kun (ko’k — ko’rildi, yashil — yubordi)'), chart])
      ])
    ], null, true);
  }
  async function loadTemplates() {
    if (TEMPLATES) return TEMPLATES;
    try { var r = await D.api('GET', 'api/forms/templates'); TEMPLATES = r.templates || []; CONTACTS_DEF = r.contacts || []; }
    catch (e) { TEMPLATES = []; CONTACTS_DEF = []; }
    return TEMPLATES;
  }

  /* ================= RO'YXAT ================= */
  A.Pages.forms = function (view, route, App) {
    App.guard('nav.leads');
    var forms = A.sortBy(D.all('forms'), 'updatedAt', 'desc');

    view.appendChild(UI.pageHead('Formalar', 'Ariza shakllari — havolani ulashing, arizalar Murojaatlarga tushadi', [
      App.can('lead.edit') ? h('button', {
        class: 'btn primary', onclick: function () { formBuilder(null, App); }
      }, [UI.icon('plus'), 'Yangi forma']) : null
    ]));

    if (!forms.length) {
      view.appendChild(UI.card(null, UI.empty({
        title: 'Hali forma yo’q',
        text: 'Birinchi formani tuzing: nom, savollar, fon — va havolani Instagram yoki Telegramga qo’ying.',
        action: App.can('lead.edit') ? { label: 'Yangi forma', onClick: function () { formBuilder(null, App); } } : null
      })));
      return;
    }

    var grid = h('div', { class: 'cards' });
    forms.forEach(function (f) {
      var n = subsOf(f.id).length;
      var st = statOf(f.id);
      var tpl = (TEMPLATES || []).filter(function (t) { return t.id === f.bg; })[0];
      grid.appendChild(h('div', { class: 'card form-card' }, [
        h('div', {
          class: 'form-bg',
          style: f.banner
            ? 'background:#0f2a5a url(' + imgUrl(f, 'banner') + ') center/cover'
            : f.bg === 'rasm'
              ? 'background:#0f2a5a url(' + imgUrl(f, 'bg') + ') center/cover'
              : 'background:' + (tpl ? tpl.css : 'linear-gradient(135deg,#0f2a5a,#3b82f6)')
        }, [f.logo ? h('img', { class: 'form-logo', src: imgUrl(f, 'logo'), alt: '' }) : null, h('b', {}, f.title)]),
        h('div', { class: 'form-meta' }, [
          h('div', { class: 'rowflex', style: 'justify-content:space-between' }, [
            UI.pill(n + ' ta ariza', n ? 'ok' : 'mute'),
            f.active === false ? UI.pill('O’chirilgan', 'bad') : UI.pill('Faol', 'ok')
          ]),
          h('div', { class: 'small muted form-stat', title: 'Ko’rildi · boshladi · yubordi' }, [
            'Ko’rildi ' + st.views + ' · boshladi ' + st.starts + ' · yubordi ' + st.submits +
            (st.views ? ' (' + pct(st.submits, st.views) + '%)' : '')
          ]),
          h('div', { class: 'small muted mono', style: 'margin:6px 0;word-break:break-all' }, '/f/' + f.slug),
          h('div', { class: 'rowflex', style: 'gap:6px;flex-wrap:wrap' }, [
            h('button', { class: 'btn sm', onclick: function () { UI.copy(formUrl(f)); UI.toast('Havola nusxalandi', 'ok'); } }, 'Havola'),
            h('a', { class: 'btn sm', href: '/f/' + f.slug, target: '_blank', rel: 'noopener' }, 'Ochish'),
            h('button', { class: 'btn sm', onclick: function () { App.go('forms', { id: f.id, tab: 'arizalar' }); } }, 'Arizalar'),
            App.can('lead.edit') ? h('button', { class: 'btn sm primary', onclick: function () { formBuilder(f, App); } }, 'Tahrirlash') : null
          ].filter(Boolean))
        ])
      ]));
    });
    view.appendChild(grid);

    /* Tanlangan forma arizalari */
    if (route.id) {
      var sel = D.one('forms', route.id);
      if (sel) { view.appendChild(statCard(sel)); view.appendChild(subsCard(sel, App)); }
    }
  };

  function subsCard(f, App) {
    var rows = subsOf(f.id);
    var cols = [
      { label: 'Vaqt', render: function (s) { return h('span', { class: 'mono small' }, s.at); } },
      { label: 'Ism', render: function (s) { return h('b', {}, s.name || '—'); } },
      { label: 'Telefon', render: function (s) { return s.phone ? UI.phoneLink(s.phone) : '—'; } }
    ];
    var nameQ = (f.fields || []).filter(function (q) { return q.type === 'text' && /ism|name|имя|اسم/i.test(q.label); })[0];
    (f.fields || []).forEach(function (q) {
      if (q.type === 'phone' || q === nameQ) return;   // Ism va Telefon alohida ustunda
      cols.push({
        label: q.label, render: function (s) {
          var v = s.answers && s.answers[q.id];
          return Array.isArray(v) ? v.join(', ') : (v || '—');
        }
      });
    });
    cols.push({
      label: '', right: true, render: function (s) {
        return s.leadId && D.one('leads', s.leadId)
          ? h('button', { class: 'btn sm', onclick: function () { App.go('leads'); } }, 'Murojaatda')
          : h('span', { class: 'small muted' }, '');
      }
    });
    return UI.card(f.title + ' — arizalar (' + rows.length + ')',
      rows.length ? UI.table(cols, rows.slice(0, 200)) : h('p', { class: 'muted' }, 'Hali ariza kelmagan.'),
      [h('button', {
        class: 'btn sm', onclick: function () {
          UI.exportRows('forma-' + f.slug, [['Vaqt', 'Ism', 'Telefon'].concat((f.fields || []).map(function (q) { return q.label; }))].concat(
            rows.map(function (s) {
              return [s.at, s.name || '', s.phone || ''].concat((f.fields || []).map(function (q) {
                var v = s.answers && s.answers[q.id];
                return Array.isArray(v) ? v.join(', ') : (v || '');
              }));
            })));
        }
      }, 'Excel')], true);
  }

  /* ================= KONSTRUKTOR ================= */
  function formBuilder(form, App) {
    App.guard('lead.edit');
    var isNew = !form;
    var f = form ? JSON.parse(JSON.stringify(form)) : {
      title: '', intro: '', thanks: '', button: 'Yuborish', bg: 'kok', active: true, contact: true, info: '',
      fields: [
        { id: 'ism', type: 'text', label: 'Ismingiz', required: true },
        { id: 'tel', type: 'phone', label: 'Telefon raqamingiz', required: true, cc: '+998' }
      ]
    };
    var fInfo = UI.field({ label: 'Qo’shimcha ma’lumot (kontaktlar bo’limida chiqadi)', type: 'textarea', rows: 2, value: f.info || '',
      placeholder: 'Masalan: darslar dushanba–shanba, 1-dars bepul.' });
    var fContact = UI.field({ label: 'Kontaktlar va ma’lumot bo’limi', type: 'select', value: f.contact === false ? 'off' : 'on',
      options: [{ value: 'on', label: 'Ko’rsatilsin' }, { value: 'off', label: 'Ko’rsatilmasin' }] });

    /* --- Kontaktlarni tanlab/tahrirlash ---
       Har bir kontakt satrini ko'rsatish/yashirish, matnini o'zgartirish,
       o'chirish va yangi qo'shish mumkin. Bo'sh qoldirilsa — Sozlamalardan. */
    var contactsBox = h('div', { class: 'qlist' });
    var contactList = Array.isArray(f.contacts) ? JSON.parse(JSON.stringify(f.contacts)) : null;
    function paintContacts() {
      UI.clear(contactsBox);
      if (!contactList) {
        contactList = (CONTACTS_DEF ? JSON.parse(JSON.stringify(CONTACTS_DEF)) : []);
      }
      contactList.forEach(function (c, i) {
        var chk = h('input', { type: 'checkbox', checked: c.on !== false, onchange: function (e) { c.on = e.target.checked; } });
        var fi = UI.field({ label: 'Belgi', value: c.icon || '' });
        fi.input.addEventListener('input', function () { c.icon = fi.input.value; });
        var fl = UI.field({ label: 'Nomi', value: c.label || '' });
        fl.input.addEventListener('input', function () { c.label = fl.input.value; });
        var fv = UI.field({ label: 'Matn (ko’rinadigan)', value: c.value || '' });
        fv.input.addEventListener('input', function () { c.value = fv.input.value; });
        var fh = UI.field({ label: 'Havola (ixtiyoriy: tel:… yoki https://…)', value: c.link || '' });
        fh.input.addEventListener('input', function () { c.link = fh.input.value; });
        fi.wrap.style.maxWidth = '92px';
        contactsBox.appendChild(h('div', { class: 'qrow' }, [
          h('div', { class: 'qhead' }, [
            h('label', { class: 'chk' }, [chk, h('span', {}, 'Ko’rsatilsin')]),
            h('button', { type: 'button', class: 'btn sm danger', onclick: function () { contactList.splice(i, 1); paintContacts(); } }, 'O’chirish')
          ]),
          h('div', { class: 'rowflex', style: 'gap:8px;flex-wrap:wrap' }, [fi.wrap, fl.wrap]),
          fv.wrap, fh.wrap
        ]));
      });
      contactsBox.appendChild(h('div', { class: 'rowflex', style: 'gap:8px;flex-wrap:wrap' }, [
        h('button', { type: 'button', class: 'btn', onclick: function () {
          if (contactList.length >= 15) { UI.toast('Ko’pi bilan 15 ta.', 'bad'); return; }
          contactList.push({ on: true, icon: '•', label: '', value: '', link: '' }); paintContacts();
        } }, [UI.icon('plus'), 'Kontakt qo’shish']),
        h('button', { type: 'button', class: 'btn sm', onclick: function () {
          contactList = (CONTACTS_DEF ? JSON.parse(JSON.stringify(CONTACTS_DEF)) : []); paintContacts();
        } }, 'Sozlamalardan qayta olish')
      ]));
    }
    loadTemplates().then(paintContacts);
    var fTitle = UI.field({ label: 'Forma nomi', value: f.title, required: true, placeholder: 'Arab tili kursiga yozilish' });
    var fSlug = UI.field({ label: 'Havola (lotin harf, chiziqcha)', value: f.slug || '', placeholder: 'arab-tili', help: 'Bo’sh qoldirsangiz nomdan o’zi tuziladi' });
    var fIntro = UI.field({ label: 'Kirish matni', type: 'textarea', value: f.intro || '', rows: 2 });
    var fThanks = UI.field({ label: 'Yuborilgandan keyingi matn', value: f.thanks || '', placeholder: 'Rahmat! Tez orada bog’lanamiz.' });
    var fButton = UI.field({ label: 'Tugma matni', value: f.button || 'Yuborish' });
    var courses = D.all('courses').filter(function (c) { return c.active !== false; });
    var fCourse = UI.field({
      label: 'Qaysi kursga (murojaatda ko’rinadi)', type: 'select', value: f.courseId || '',
      options: [{ value: '', label: '—' }].concat(courses.map(function (c) { return { value: c.id, label: c.name }; }))
    });
    var fActive = UI.field({ label: 'Holat', type: 'select', value: f.active === false ? 'off' : 'on',
      options: [{ value: 'on', label: 'Faol — havola ishlaydi' }, { value: 'off', label: 'O’chirilgan — havola ochilmaydi' }] });

    /* --- Fon --- */
    var bgBox = h('div', { class: 'bg-pick' });
    var bgFile = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', style: 'display:none' });
    var pendingBg = null;
    function paintBg() {
      UI.clear(bgBox);
      (TEMPLATES || []).forEach(function (t) {
        bgBox.appendChild(h('button', {
          type: 'button', class: 'bg-sw' + (f.bg === t.id ? ' on' : ''),
          style: 'background:' + t.css, title: t.name,
          onclick: function () { f.bg = t.id; pendingBg = null; paintBg(); }
        }, h('span', { style: 'color:' + t.ink }, t.name)));
      });
      bgBox.appendChild(h('button', {
        type: 'button', class: 'bg-sw' + (f.bg === 'rasm' ? ' on' : ''),
        style: pendingBg ? 'background:url(' + pendingBg + ') center/cover' :
          (f.id && f.bg === 'rasm' ? 'background:url(/api/form-bg?id=' + encodeURIComponent(f.id) + '&t=' + Date.now() + ') center/cover' : 'background:#e5e7eb'),
        onclick: function () { bgFile.click(); }
      }, h('span', { style: 'color:#111;background:rgba(255,255,255,.85);padding:2px 6px;border-radius:6px' }, 'Rasm yuklash')));
    }
    bgFile.onchange = function () {
      var file = bgFile.files[0]; if (!file) return;
      if (file.size > 700 * 1024) { UI.toast('Rasm 700 KB dan kichik bo’lsin.', 'bad'); return; }
      var fr = new FileReader();
      fr.onload = function () { pendingBg = String(fr.result); f.bg = 'rasm'; paintBg(); };
      fr.readAsDataURL(file);
    };
    loadTemplates().then(paintBg);

    /* --- Logotip va banner --- */
    var pending = { logo: null, banner: null };
    var removed = { logo: false, banner: false };
    function imgPicker(kind, label, help, maxKb) {
      var box = h('div', { class: 'img-pick' });
      var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', style: 'display:none' });
      function paint() {
        UI.clear(box);
        var has = pending[kind] || (f.id && f[kind] && !removed[kind]);
        var src = pending[kind] || (has ? imgUrl(f, kind) : '');
        box.appendChild(h('div', { class: 'img-prev' + (kind === 'logo' ? ' logo' : ''), style: src ? 'background-image:url(' + src + ')' : '' },
          src ? null : h('span', { class: 'small muted' }, 'Yo’q')));
        box.appendChild(h('div', { class: 'rowflex', style: 'gap:6px;flex-wrap:wrap' }, [
          h('button', { type: 'button', class: 'btn sm', onclick: function () { file.click(); } }, has ? 'Almashtirish' : 'Yuklash'),
          has ? h('button', { type: 'button', class: 'btn sm danger', onclick: function () { pending[kind] = null; removed[kind] = true; paint(); } }, 'Olib tashlash') : null
        ]));
        box.appendChild(file);
      }
      file.onchange = function () {
        var fl = file.files[0]; if (!fl) return;
        if (fl.size > maxKb * 1024) { UI.toast(label + ' ' + maxKb + ' KB dan kichik bo’lsin.', 'bad'); return; }
        var fr = new FileReader();
        fr.onload = function () { pending[kind] = String(fr.result); removed[kind] = false; paint(); };
        fr.readAsDataURL(fl);
      };
      paint();
      return h('div', { class: 'field' }, [h('label', {}, label), box, h('div', { class: 'help' }, help)]);
    }
    var logoPick = imgPicker('logo', 'Logotip', 'Sarlavha tepasida, o’rtada. PNG (shaffof fon) yaxshi. 300 KB gacha.', 300);
    var bannerPick = imgPicker('banner', 'Banner', 'Kartaning eng yuqorisida, to’liq kenglikda. 1200×500 atrofida. 700 KB gacha.', 700);

    /* --- Maydonlar --- */
    var fieldsBox = h('div', { class: 'qlist' });
    function paintFields() {
      UI.clear(fieldsBox);
      f.fields.forEach(function (q, i) {
        var phones = f.fields.filter(function (x) { return x.type === 'phone'; }).length;
        var onlyPhone = q.type === 'phone' && phones === 1;
        var fl = UI.field({ label: 'Savol', value: q.label });
        fl.input.addEventListener('input', function () { q.label = fl.input.value; });
        var ft = UI.field({ label: 'Turi', type: 'select', value: q.type,
          options: TYPES.map(function (t) { return { value: t, label: TYPE_LABEL[t] }; }) });
        var fo = UI.field({ label: 'Variantlar (har biri yangi qatorda)', type: 'textarea', rows: 3,
          value: (q.options || []).join('\n') });
        var fc = UI.field({ label: 'Davlat kodi (odam faqat raqamni yozadi)', value: q.cc || '+998', placeholder: '+998' });
        fc.input.addEventListener('input', function () { q.cc = fc.input.value.trim(); });
        function syncType() {
          fo.wrap.hidden = ['select', 'radio', 'checkbox'].indexOf(q.type) < 0;
          fc.wrap.hidden = q.type !== 'phone';
          if (q.type === 'phone') { q.required = true; reqIn.checked = true; reqIn.disabled = true; if (!q.cc) q.cc = '+998'; }
          else reqIn.disabled = false;
        }
        fo.input.addEventListener('input', function () {
          q.options = fo.input.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        });
        ft.input.addEventListener('change', function () {
          if (onlyPhone && ft.input.value !== 'phone') {
            ft.input.value = 'phone'; UI.toast('Telefon maydoni har doim bo’lishi kerak — murojaat shu raqamga ochiladi.', 'bad'); return;
          }
          q.type = ft.input.value;
          syncType();
          if (!fo.wrap.hidden && !(q.options || []).length) { q.options = ['Ha', 'Yo’q']; fo.input.value = q.options.join('\n'); }
        });
        var reqIn = h('input', { type: 'checkbox', checked: !!q.required, onchange: function (e) { q.required = e.target.checked; } });
        var req = h('label', { class: 'chk' }, [reqIn, h('span', {}, 'Majburiy'), q.type === 'phone' ? h('span', { class: 'small muted' }, ' (telefon har doim majburiy)') : null]);
        syncType();
        fieldsBox.appendChild(h('div', { class: 'qrow' }, [
          h('div', { class: 'qhead' }, [
            h('b', {}, (i + 1) + '-savol'),
            h('div', { class: 'rowflex', style: 'gap:4px' }, [
              h('button', { type: 'button', class: 'btn sm ico-only', 'aria-label': 'Yuqoriga', disabled: i === 0,
                onclick: function () { f.fields.splice(i - 1, 0, f.fields.splice(i, 1)[0]); paintFields(); } }, '↑'),
              h('button', { type: 'button', class: 'btn sm ico-only', 'aria-label': 'Pastga', disabled: i === f.fields.length - 1,
                onclick: function () { f.fields.splice(i + 1, 0, f.fields.splice(i, 1)[0]); paintFields(); } }, '↓'),
              onlyPhone ? null : h('button', { type: 'button', class: 'btn sm danger', onclick: function () { f.fields.splice(i, 1); paintFields(); } }, 'O’chirish')
            ])
          ]),
          h('div', { class: 'grid2' }, [fl.wrap, ft.wrap]),
          fo.wrap, fc.wrap, req
        ]));
      });
      fieldsBox.appendChild(h('button', {
        type: 'button', class: 'btn', onclick: function () {
          if (f.fields.length >= 30) { UI.toast('Ko’pi bilan 30 ta savol.', 'bad'); return; }
          f.fields.push({ id: 'q' + Date.now().toString(36).slice(-5), type: 'text', label: '', required: false });
          paintFields();
          var last = fieldsBox.querySelectorAll('.qrow input')[0];
          var all = fieldsBox.querySelectorAll('.qrow');
          var inp = all[all.length - 1] && all[all.length - 1].querySelector('input');
          if (inp) inp.focus();
        }
      }, [UI.icon('plus'), 'Savol qo’shish']));
    }
    paintFields();

    function draftData() {
      return {
        id: f.id, title: fTitle.input.value.trim(), slug: fSlug.input.value.trim(), intro: fIntro.input.value,
        thanks: fThanks.input.value, button: fButton.input.value, bg: f.bg,
        courseId: fCourse.input.value, active: fActive.input.value === 'on', fields: f.fields,
        contact: fContact.input.value === 'on', info: fInfo.input.value, contacts: contactList,
        logo: !!(f.logo && !removed.logo), banner: !!(f.banner && !removed.banner)
      };
    }

    var linkBox = f.slug ? h('div', { class: 'banner info', style: 'margin:0 0 10px' }, h('div', {}, [
      h('b', {}, 'Havola: '), h('code', { class: 'mono' }, formUrl(f)), ' ',
      h('button', { type: 'button', class: 'btn sm', onclick: function () { UI.copy(formUrl(f)); UI.toast('Nusxalandi', 'ok'); } }, 'Nusxalash')
    ])) : null;

    var err = h('div', { class: 'err-msg', hidden: true });
    UI.modal({
      title: isNew ? 'Yangi forma' : 'Formani tahrirlash',
      wide: true,
      body: [
        linkBox,
        h('div', { class: 'grid2' }, [fTitle.wrap, fSlug.wrap]),
        fIntro.wrap,
        h('div', { class: 'grid2' }, [fThanks.wrap, fButton.wrap]),
        h('div', { class: 'grid2' }, [fCourse.wrap, fActive.wrap]),
        h('div', { class: 'field full' }, [h('label', {}, 'Fon'), bgBox, bgFile]),
        h('div', { class: 'grid2' }, [logoPick, bannerPick]),
        h('div', { class: 'grid2' }, [fContact.wrap, fInfo.wrap]),
        h('div', { class: 'field full' }, [h('label', {}, 'Kontaktlar (tanlab tahrirlang — bo’sh qoldirsangiz Sozlamalardan olinadi)'), contactsBox]),
        h('div', { class: 'field full' }, [h('label', {}, 'Savollar'), fieldsBox]),
        err
      ].filter(Boolean),
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Namunani ko’rish', onClick: function (close, btn) {
            UI.busy(btn, async function () {
              try {
                var res = await fetch('api/forms/preview', {
                  method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(Object.assign(draftData(), {
                    inline: { bg: pendingBg || '', logo: pending.logo || '', banner: pending.banner || '' }
                  }))
                });
                if (!res.ok) throw new Error('Namuna ochilmadi (' + res.status + ')');
                var html = await res.text();
                var fr = h('iframe', { class: 'preview-frame', sandbox: 'allow-scripts', title: 'Namuna' });
                fr.srcdoc = html;
                UI.modal({ title: 'Namuna — telefonda shunday ko’rinadi', wide: true, body: [fr], actions: [{ label: 'Yopish' }] });
              } catch (e) { UI.toast(e.message || 'Namuna ochilmadi.', 'bad'); }
            });
          }
        },
        !isNew ? {
          label: 'O’chirish', cls: 'danger', onClick: function (close) {
            UI.confirm('Formani o’chirish', 'Havola ishlamay qoladi. Kelgan arizalar va murojaatlar qoladi.', 'O’chirish', true)
              .then(async function (yes) {
                if (!yes) return;
                await D.api('POST', 'api/forms/delete', { id: f.id });
                await D.loadBootstrap();
                close(); App.render();
              });
          }
        } : null,
        {
          label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
            var title = fTitle.input.value.trim();
            if (!title) { err.hidden = false; err.textContent = 'Forma nomini yozing.'; return; }
            if (!f.fields.length) { err.hidden = false; err.textContent = 'Kamida bitta savol qo’shing.'; return; }
            if (f.fields.some(function (q) { return !String(q.label || '').trim(); })) {
              err.hidden = false; err.textContent = 'Har bir savolning matnini yozing.'; return;
            }
            UI.busy(btn, async function () {
              try {
                var r = await D.api('POST', 'api/forms/save', draftData());
                if (pendingBg) await D.api('POST', 'api/forms/bg', { id: r.form.id, kind: 'bg', data: pendingBg });
                var kinds = ['logo', 'banner'];
                for (var k = 0; k < kinds.length; k++) {
                  if (pending[kinds[k]]) await D.api('POST', 'api/forms/bg', { id: r.form.id, kind: kinds[k], data: pending[kinds[k]] });
                  else if (removed[kinds[k]] && f[kinds[k]]) await D.api('POST', 'api/forms/img-del', { id: r.form.id, kind: kinds[k] });
                }
                await D.loadBootstrap();
                close();
                UI.toast('Saqlandi. Havola: /f/' + r.form.slug, 'ok');
                App.go('forms', { id: r.form.id });
              } catch (e) { err.hidden = false; err.textContent = e.message || 'Saqlanmadi.'; }
            });
          }
        }
      ].filter(Boolean)
    });
  }
  A.formBuilder = formBuilder;

  /** Murojaat kartasida forma javoblari */
  A.formAnswersBlock = function (lead) {
    if (!lead || !lead.formAnswers) return null;
    var f = D.one('forms', lead.formId);
    var rows = [];
    var fields = (f && f.fields) || Object.keys(lead.formAnswers).map(function (k) { return { id: k, label: k }; });
    fields.forEach(function (q) {
      var v = lead.formAnswers[q.id];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      rows.push([q.label, Array.isArray(v) ? v.join(', ') : v]);
    });
    if (!rows.length) return null;
    return h('div', { class: 'form-ans' }, [
      h('div', { class: 'small muted', style: 'margin-bottom:4px' }, 'Forma: ' + (lead.formTitle || '')),
      h('dl', { class: 'kv' }, rows.map(function (r) { return [h('dt', {}, r[0]), h('dd', {}, r[1])]; }).flat())
    ]);
  };
})(typeof window !== 'undefined' ? window : globalThis);
