/* Albyana ERP — Excel / CSV dan import (ustunlar tartibiga qaramaydi) */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI || {}, D = A.Data, h = UI.h;

  /* ---------- Ustun nomlarini tanish ---------- */
  var SYN = {
    fullName: ['fio', 'f i o', 'ism familiya', 'familiya ism', 'toliq ism', 'ismi sharifi', 'фио', 'ф и о', 'имя фамилия', 'полное имя', 'full name', 'fullname', 'name', 'الاسم الكامل'],
    lastName: ['familiya', 'familya', 'familiyasi', 'фамилия', 'last name', 'lastname', 'surname', 'اللقب'],
    firstName: ['ism', 'ismi', 'imya', 'имя', 'first name', 'firstname', 'الاسم'],
    phone: ['telefon', 'tel', 'telefon raqami', 'raqam', 'nomer', 'telefoni', 'телефон', 'тел', 'номер', 'phone', 'mobile', 'tel.', 'الهاتف', 'رقم الهاتف'],
    parentPhone: ['ota ona telefoni', 'ota onasi telefoni', 'otaona telefon', 'vasiy telefoni', 'ota ona tel', 'родитель телефон', 'телефон родителя', 'parent phone', 'هاتف ولي الأمر'],
    parentName: ['ota ona', 'ota onasi', 'vasiy', 'ota ona ismi', 'родитель', 'фио родителя', 'parent', 'guardian', 'ولي الأمر'],
    birthDate: ['tugilgan sana', 'tugilgan', 'tugilgan kuni', 'дата рождения', 'др', 'birth', 'birthday', 'date of birth', 'تاريخ الميلاد'],
    group: ['guruh', 'guruhi', 'guruh kodi', 'guruh nomi', 'группа', 'группы', 'group', 'group code', 'المجموعة'],
    course: ['kurs', 'kursi', 'yonalish', 'курс', 'направление', 'course', 'الدورة'],
    source: ['manba', 'qayerdan', 'источник', 'откуда', 'source', 'المصدر'],
    note: ['izoh', 'izohi', 'qoshimcha', 'комментарий', 'примечание', 'note', 'comment', 'ملاحظة'],
    status: ['holat', 'holati', 'статус', 'status', 'الحالة'],
    nextContact: ['keyingi aloqa', 'bogla', 'bоglanish', 'следующий контакт', 'next contact']
  };

  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[‘’'`]/g, '')
      .replace(/[^a-z0-9Ѐ-ӿ؀-ۿ]+/g, ' ')
      .trim();
  }
  function guessField(header) {
    var n = norm(header);
    if (!n) return '';
    var best = '', bestScore = 0;
    Object.keys(SYN).forEach(function (field) {
      SYN[field].forEach(function (syn) {
        var sn = norm(syn);
        if (!sn) return;
        var score = 0;
        if (n === sn) score = 1000 + sn.length;               // to'liq mos
        else if (n.indexOf(sn) >= 0) score = 200 + sn.length;  // sarlavha ichida bor
        else if (sn.indexOf(n) >= 0) score = 50 + n.length;    // qisqartma
        if (score > bestScore) { bestScore = score; best = field; }
      });
    });
    return best;
  }
  function looksLikePhone(v) {
    var d = String(v == null ? '' : v).replace(/\D/g, '');
    return d.length >= 7 && d.length <= 15;
  }
  function looksLikeDate(v) {
    return /^\d{4}-\d{2}-\d{2}/.test(String(v)) || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(String(v));
  }

  /* ---------- Fayl o'qish ---------- */
  function parseCsvText(text) {
    var delim = (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length) ? ';' : ',';
    if (text.split('\n')[0].indexOf('\t') >= 0) delim = '\t';
    var rows = [], row = [], cell = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var name = (file.name || '').toLowerCase();
      var isText = /\.(csv|txt|tsv)$/.test(name);
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Faylni o’qib bo’lmadi.')); };
      fr.onload = function () {
        try {
          if (isText || !global.XLSX) {
            var text = isText ? fr.result : new TextDecoder('utf-8').decode(fr.result);
            resolve(parseCsvText(String(text).replace(/^﻿/, '')));
          } else {
            var wb = global.XLSX.read(new Uint8Array(fr.result), { type: 'array', cellDates: true });
            var sheet = wb.Sheets[wb.SheetNames[0]];
            var rows = global.XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false, defval: '' });
            resolve(rows);
          }
        } catch (e) { reject(new Error('Fayl formatini o’qib bo’lmadi: ' + e.message)); }
      };
      if (isText) fr.readAsText(file, 'utf-8'); else fr.readAsArrayBuffer(file);
    });
  }

  /* ---------- Sarlavha qatorini topish ---------- */
  function analyse(rows) {
    rows = (rows || []).filter(function (r) {
      return (r || []).some(function (c) { return String(c == null ? '' : c).trim() !== ''; });
    });
    if (!rows.length) return { rows: [], header: null, headerRow: -1, map: {} };

    var headerRow = -1, map = {};
    for (var i = 0; i < Math.min(rows.length, 8); i++) {
      var m = {}, hits = 0;
      rows[i].forEach(function (cell, idx) {
        var f = guessField(cell);
        if (f && m[f] == null) { m[f] = idx; hits++; }
      });
      if (hits >= 2) { headerRow = i; map = m; break; }
    }

    if (headerRow < 0) {
      // sarlavha yo'q — ustunlarni mazmuni bo'yicha aniqlash
      var sample = rows.slice(0, Math.min(rows.length, 12));
      var colCount = Math.max.apply(null, sample.map(function (r) { return r.length; }));
      var phoneCols = [], dateCols = [], textCols = [];
      for (var c = 0; c < colCount; c++) {
        var vals = sample.map(function (r) { return r[c]; }).filter(function (v) { return String(v || '').trim(); });
        if (!vals.length) continue;
        var ph = vals.filter(looksLikePhone).length / vals.length;
        var dt = vals.filter(looksLikeDate).length / vals.length;
        if (ph > 0.6) phoneCols.push(c);
        else if (dt > 0.6) dateCols.push(c);
        else textCols.push(c);
      }
      if (textCols.length >= 2) { map.lastName = textCols[0]; map.firstName = textCols[1]; }
      else if (textCols.length === 1) map.fullName = textCols[0];
      if (phoneCols[0] != null) map.phone = phoneCols[0];
      if (phoneCols[1] != null) map.parentPhone = phoneCols[1];
      if (dateCols[0] != null) map.birthDate = dateCols[0];
      if (textCols.length >= 3) map.group = textCols[2];
      return { rows: rows, header: null, headerRow: -1, map: map, colCount: colCount };
    }
    return {
      rows: rows.slice(headerRow + 1), header: rows[headerRow], headerRow: headerRow, map: map,
      colCount: rows[headerRow].length
    };
  }

  function cellDate(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m) {
      var y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + A.pad(Number(m[2])) + '-' + A.pad(Number(m[1]));
    }
    var d = new Date(s);
    if (!isNaN(d.getTime())) return A.toISODate(d);
    return '';
  }

  /* ---------- Import oynasi ---------- */
  var TARGETS = {
    students: [
      { id: 'lastName', label: 'Familiya' },
      { id: 'firstName', label: 'Ism' },
      { id: 'fullName', label: 'Ism familiya (bitta ustunda)' },
      { id: 'phone', label: 'O’quvchi telefoni' },
      { id: 'parentName', label: 'Ota-ona ismi' },
      { id: 'parentPhone', label: 'Ota-ona telefoni' },
      { id: 'birthDate', label: 'Tug’ilgan sana' },
      { id: 'group', label: 'Guruh (kod yoki nom)' },
      { id: 'note', label: 'Izoh' }
    ],
    leads: [
      { id: 'fullName', label: 'Ism familiya' },
      { id: 'phone', label: 'Telefon' },
      { id: 'course', label: 'Qiziqqan kurs' },
      { id: 'source', label: 'Qayerdan kelgan' },
      { id: 'note', label: 'Izoh' },
      { id: 'nextContact', label: 'Keyingi bog’lanish' }
    ]
  };

  A.importModal = function (kind, App, funnelId) {
    App.guard(kind === 'leads' ? 'lead.import' : 'student.import');
    var state = { rows: [], map: {}, header: null, colCount: 0, fileName: '' };

    var drop = h('div', { class: 'drop' }, [
      h('p', { style: 'margin:0 0 10px;font-weight:600' }, 'Excel yoki CSV faylni tanlang'),
      h('p', { class: 'small muted', style: 'margin:0 0 12px' },
        'xlsx, xls, csv, tsv — ustunlar tartibi muhim emas, tizim o’zi taniydi.')
    ]);
    var fileInput = h('input', {
      type: 'file', id: 'imp-file', accept: '.xlsx,.xls,.csv,.tsv,.txt,.ods',
      style: 'display:block;margin:0 auto'
    });
    drop.appendChild(fileInput);

    var mapBox = h('div');
    var preview = h('div');
    var info = h('div');

    fileInput.addEventListener('change', async function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      UI.clear(info);
      info.appendChild(h('p', { class: 'muted small', style: 'margin:0' }, 'O’qilmoqda…'));
      try {
        var rows = await readFile(file);
        var res = analyse(rows);
        state.rows = res.rows;
        state.map = res.map;
        state.header = res.header;
        state.colCount = res.colCount || 0;
        state.fileName = file.name;
        UI.clear(info);
        info.appendChild(h('div', { class: 'banner info', style: 'margin:0' }, h('div', {}, [
          h('b', {}, file.name + ': '), state.rows.length + ' ta qator topildi. ',
          res.header ? 'Sarlavha qatori tanildi.' : 'Sarlavha topilmadi — ustunlar mazmuni bo’yicha taxmin qilindi, tekshirib chiqing.'
        ])));
        paintMap();
      } catch (e) {
        UI.clear(info);
        info.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, e.message)));
      }
    });

    function colOptions() {
      var opts = [{ value: '', label: '— yo’q —' }];
      var n = state.colCount || (state.rows[0] ? state.rows[0].length : 0);
      for (var i = 0; i < n; i++) {
        var name = state.header ? (state.header[i] || ('Ustun ' + (i + 1))) : ('Ustun ' + (i + 1));
        var sample = (state.rows[0] || [])[i];
        opts.push({ value: String(i), label: name + (sample ? '  (' + String(sample).slice(0, 18) + ')' : '') });
      }
      return opts;
    }

    function paintMap() {
      UI.clear(mapBox);
      if (!state.rows.length) return;
      mapBox.appendChild(h('h3', { style: 'font-size:14px;margin:14px 0 8px' }, 'Ustunlarni moslash'));
      TARGETS[kind].forEach(function (t) {
        var f = UI.field({
          label: t.label, type: 'select', options: colOptions(),
          value: state.map[t.id] != null ? String(state.map[t.id]) : ''
        });
        f.input.addEventListener('change', function () {
          if (f.input.value === '') delete state.map[t.id];
          else state.map[t.id] = Number(f.input.value);
          paintPreview();
        });
        mapBox.appendChild(h('div', { class: 'map-row' }, [f.wrap]));
      });
      paintPreview();
    }

    function buildRecords() {
      var out = [];
      state.rows.forEach(function (r) {
        function g(field) {
          var idx = state.map[field];
          if (idx == null) return '';
          return String(r[idx] == null ? '' : r[idx]).trim();
        }
        var rec = {};
        if (kind === 'students') {
          var ln = g('lastName'), fn = g('firstName');
          if (!ln && !fn) {
            var full = g('fullName');
            if (full) {
              var parts = full.split(/\s+/);
              ln = parts[0] || '';
              fn = parts.slice(1).join(' ') || '';
            }
          }
          rec.lastName = ln;
          rec.firstName = fn;
          rec.phone = A.normPhone(g('phone'));
          rec.parentName = g('parentName');
          rec.parentPhone = A.normPhone(g('parentPhone')) || rec.phone;
          rec.birthDate = cellDate(g('birthDate'));
          rec.group = g('group');
          rec.note = g('note');
          if (!rec.lastName && !rec.firstName && !rec.phone) return;
        } else {
          var nm = g('fullName');
          rec.name = nm;
          rec.phone = A.normPhone(g('phone'));
          rec.course = g('course');
          rec.source = g('source') || 'Import';
          rec.note = g('note');
          rec.nextContact = cellDate(g('nextContact'));
          if (!rec.name && !rec.phone) return;
        }
        out.push(rec);
      });
      return out;
    }

    function paintPreview() {
      UI.clear(preview);
      var recs = buildRecords();
      if (!recs.length) {
        preview.appendChild(h('p', { class: 'muted small' }, 'Moslashtirishni to’ldiring.'));
        return;
      }
      preview.appendChild(h('h3', { style: 'font-size:14px;margin:14px 0 8px' },
        'Ko’rib chiqish (' + recs.length + ' ta yozuv, dastlabki 5 tasi)'));
      var cols = kind === 'students'
        ? [{ label: 'Familiya', key: 'lastName' }, { label: 'Ism', key: 'firstName' },
        { label: 'Telefon', key: 'phone' }, { label: 'Ota-ona', key: 'parentName' },
        { label: 'Guruh', key: 'group' }]
        : [{ label: 'Ism', key: 'name' }, { label: 'Telefon', key: 'phone' },
        { label: 'Kurs', key: 'course' }, { label: 'Manba', key: 'source' }];
      preview.appendChild(UI.table(cols, recs.slice(0, 5)));
    }

    var skipDup = UI.field({
      type: 'select', label: 'Takroriy telefon raqamlar',
      options: [
        { value: 'skip', label: 'O’tkazib yuborish (tavsiya)' },
        { value: 'add', label: 'Baribir qo’shish' }
      ]
    });

    UI.modal({
      title: kind === 'students' ? 'O’quvchilarni import qilish' : 'Murojaatlarni import qilish',
      wide: true,
      body: [drop, info, mapBox, preview, skipDup.wrap],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Import qilish', cls: 'primary', onClick: function (c, btn) {
            var recs = buildRecords();
            if (!recs.length) { UI.toast('Import qilinadigan yozuv topilmadi.', 'bad'); return; }
            UI.busy(btn, async function () {
              var res = await doImport(kind, recs, skipDup.input.value === 'skip', App, funnelId);
              c();
              showResult(res, App);
            });
          }
        }
      ]
    });
  };

  async function doImport(kind, recs, skipDup, App, funnelId) {
    var added = 0, skipped = 0, enrolled = 0, problems = [];
    var existingPhones = {};
    if (kind === 'students') {
      D.all('students').forEach(function (s) {
        [s.phone, s.parentPhone].forEach(function (p) {
          var d = A.phoneDigits(p); if (d) existingPhones[d] = s.id;
        });
      });
    } else {
      D.all('leads').forEach(function (l) {
        var d = A.phoneDigits(l.phone); if (d) existingPhones[d] = l.id;
      });
    }

    // guruhlarni kod va nom bo'yicha topish
    var groupIndex = {};
    D.all('groups').forEach(function (g) {
      if (g.code) groupIndex[norm(g.code)] = g.id;
      groupIndex[norm(g.name)] = g.id;
    });
    var courseIndex = {};
    D.all('courses').forEach(function (cs) { courseIndex[norm(cs.name)] = cs.id; });

    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      var digits = A.phoneDigits(r.phone || r.parentPhone);
      if (skipDup && digits && existingPhones[digits]) { skipped++; continue; }

      try {
        if (kind === 'students') {
          var st = {
            id: A.uid('stu'),
            lastName: r.lastName || '', firstName: r.firstName || '',
            phone: r.phone || '', parentName: r.parentName || '',
            parentPhone: r.parentPhone || r.phone || '',
            birthDate: r.birthDate || '', status: 'faol',
            note: r.note || '', createdAt: A.nowStamp(), imported: true
          };
          if (!st.lastName && !st.firstName) st.lastName = 'Noma’lum';
          await D.save('students', st);
          added++;
          if (digits) existingPhones[digits] = st.id;

          var gid = r.group ? groupIndex[norm(r.group)] : null;
          if (gid) {
            await D.save('memberships', {
              id: A.uid('mem'), studentId: st.id, groupId: gid,
              joinedAt: A.today(), leftAt: null, status: 'faol', discount: null, imported: true
            });
            enrolled++;
          } else if (r.group) {
            problems.push(r.lastName + ' ' + r.firstName + ' — "' + r.group + '" guruhi topilmadi');
          }
        } else {
          await D.save('leads', {
            id: A.uid('led'), name: r.name || 'Noma’lum', phone: r.phone || '',
            courseId: r.course ? (courseIndex[norm(r.course)] || '') : '',
            source: r.source || 'Import', ownerStaffId: '', stage: 'yangi',
            note: r.note || '', nextContact: r.nextContact || A.today(),
            createdAt: A.nowStamp(), imported: true
          });
          added++;
          if (digits) existingPhones[digits] = 'new';
        }
      } catch (e) {
        problems.push('Qator ' + (i + 1) + ': ' + e.message);
      }
    }
    await A.Ops.audit(App.user, kind === 'students' ? 'O’quvchilar import qilindi' : 'Murojaatlar import qilindi',
      added + ' ta', skipped ? skipped + ' ta o’tkazib yuborildi' : '');
    return { added: added, skipped: skipped, enrolled: enrolled, problems: problems };
  }

  function showResult(res, App) {
    UI.modal({
      title: 'Import yakunlandi',
      body: [
        h('dl', { class: 'kv' }, [
          h('dt', {}, 'Qo’shildi'), h('dd', {}, res.added + ' ta'),
          h('dt', {}, 'O’tkazib yuborildi (takroriy)'), h('dd', {}, res.skipped + ' ta'),
          res.enrolled ? h('dt', {}, 'Guruhga yozildi') : null,
          res.enrolled ? h('dd', {}, res.enrolled + ' ta') : null
        ]),
        res.problems.length ? h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, [
          h('b', {}, 'Diqqat: '),
          h('ul', { style: 'margin:6px 0 0;padding-left:18px' },
            res.problems.slice(0, 10).map(function (p) { return h('li', {}, p); })),
          res.problems.length > 10 ? h('div', { class: 'small' }, '… va yana ' + (res.problems.length - 10) + ' ta') : null
        ])) : null
      ],
      actions: [{ label: 'Yopish', cls: 'primary', onClick: function (c) { c(); App.render(); } }]
    });
  }

  A.importHelpers = { analyse: analyse, guessField: guessField, parseCsvText: parseCsvText, cellDate: cellDate, norm: norm };
})(typeof window !== 'undefined' ? window : globalThis);
