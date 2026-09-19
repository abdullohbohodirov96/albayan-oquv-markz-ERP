/* Albyana ERP — dastlabki sozlash va namuna (demo) ma'lumotlari */
(function (global) {
  'use strict';
  var A = global.A, D = A.Data;

  async function mkHash(login, pass, salt) {
    return await A.sha256(String(login).toLowerCase() + '::' + pass + '::' + salt);
  }
  function salt() { return Math.random().toString(36).slice(2, 10); }

  var DEFAULT_SETTINGS = {
    centerName: 'Albyana',
    address: '',
    phone: '',
    workStart: '08:00',
    workEnd: '20:00',
    dueDay: 5,
    expenseCategories: ['Ijara', 'Kommunal', 'Reklama', 'Jihozlar', 'Xo’jalik', 'Ish haqi', 'Boshqa'],
    bot: {
      username: '',
      welcome: 'Assalomu alaykum! Albyana o’quv markazi botiga xush kelibsiz.',
      notifyAttendance: true,
      notifyPayment: true,
      notifyDebt: true,
      autoApprove: false
    },
    createdAt: A.nowStamp()
  };

  async function bootstrap() {
    if (!D.settings) await D.saveSettings(A.clone(DEFAULT_SETTINGS));
    if (D.all('users').length === 0) {
      var s = salt();
      await D.save('users', {
        id: 'usr_admin', login: 'admin', name: 'Direktor',
        role: 'direktor', staffId: null, salt: s, hash: await mkHash('admin', '1234', s),
        active: true, isDefault: true, createdAt: A.nowStamp()
      });
    }
    if (D.all('students').length === 0 && D.all('groups').length === 0) {
      await demo();
    }
  }

  /* ---------------- Demo ---------------- */
  async function demo() {
    var today = A.today();
    var ym = A.thisMonth();
    var monthStart = A.monthStart(ym);

    // Xonalar
    var rooms = [
      { id: 'room_1', name: '1-xona', capacity: 14, demo: true },
      { id: 'room_2', name: '2-xona', capacity: 12, demo: true },
      { id: 'room_3', name: 'Kompyuter xonasi', capacity: 10, demo: true }
    ];
    for (var i = 0; i < rooms.length; i++) await D.save('rooms', rooms[i]);

    // Kurslar — markaz faqat arab tili bo'yicha ishlaydi
    var courses = [
      { id: 'crs_ar1', name: 'Arab tili — boshlang’ich', description: 'Alifbo, o’qish va asosiy so’zlashuv', monthlyFee: 450000, lessonMinutes: 90, active: true, demo: true },
      { id: 'crs_ar2', name: 'Arab tili — o’rta', description: 'Matn o’qish, grammatika va suhbat', monthlyFee: 500000, lessonMinutes: 90, active: true, demo: true },
      { id: 'crs_quron', name: 'Qur’on o’qish (tajvid)', description: 'To’g’ri talaffuz va tajvid qoidalari', monthlyFee: 400000, lessonMinutes: 60, active: true, demo: true },
      { id: 'crs_nahv', name: 'Nahv va sarf', description: 'Arab grammatikasi — chuqurlashtirilgan', monthlyFee: 550000, lessonMinutes: 90, active: true, demo: true },
      { id: 'crs_suhbat', name: 'Muhadasa (suhbat)', description: 'Faqat og’zaki nutq amaliyoti', monthlyFee: 500000, lessonMinutes: 60, active: true, demo: true }
    ];
    for (i = 0; i < courses.length; i++) await D.save('courses', courses[i]);

    // Xodimlar
    var staff = [
      { id: 'stf_dir', name: 'Nodira Ergasheva', phone: '+998901112233', position: 'Direktor', startDate: '2024-09-01', status: 'faol', payType: 'fixed', salaryAmount: 6000000, percentRate: 0, demo: true },
      { id: 'stf_adm', name: 'Sevara Qodirova', phone: '+998901112244', position: 'Administrator', startDate: '2025-02-10', status: 'faol', payType: 'fixed', salaryAmount: 3500000, percentRate: 0, demo: true },
      { id: 'stf_t1', name: 'Jasur Aliyev', phone: '+998901112255', position: 'O’qituvchi', startDate: '2025-01-15', status: 'faol', payType: 'percent', salaryAmount: 0, percentRate: 40, demo: true },
      { id: 'stf_t2', name: 'Malika Yusupova', phone: '+998901112266', position: 'O’qituvchi', startDate: '2025-06-01', status: 'faol', payType: 'percent', salaryAmount: 0, percentRate: 35, demo: true },
      { id: 'stf_t3', name: 'Bekzod Rahimov', phone: '+998901112277', position: 'O’qituvchi', startDate: '2026-01-05', status: 'faol', payType: 'fixed', salaryAmount: 4200000, percentRate: 0, demo: true },
      { id: 'stf_bux', name: 'Dilshod Karimov', phone: '+998901112288', position: 'Buxgalter', startDate: '2025-03-01', status: 'faol', payType: 'fixed', salaryAmount: 3800000, percentRate: 0, demo: true }
    ];
    for (i = 0; i < staff.length; i++) await D.save('staff', staff[i]);

    // Foydalanuvchilar (har bir rol uchun sinov hisobi)
    var users = [
      { id: 'usr_man', login: 'manager', name: 'Sevara Qodirova', role: 'admin', staffId: 'stf_adm' },
      { id: 'usr_ustoz', login: 'ustoz', name: 'Jasur Aliyev', role: 'oqituvchi', staffId: 'stf_t1' },
      { id: 'usr_bux', login: 'hisob', name: 'Dilshod Karimov', role: 'buxgalter', staffId: 'stf_bux' }
    ];
    for (i = 0; i < users.length; i++) {
      var s = salt();
      users[i].salt = s;
      users[i].hash = await mkHash(users[i].login, '1234', s);
      users[i].active = true;
      users[i].demo = true;
      users[i].isDefault = true;
      users[i].createdAt = A.nowStamp();
      await D.save('users', users[i]);
    }

    // Guruhlar (har birining kodi bor — bot shu kod orqali o'quvchini ulaydi)
    var groups = [
      {
        id: 'grp_ing_a', code: 'A001', name: 'Arab tili A1 (ertalab)', courseId: 'crs_ar1', teacherId: 'stf_t1', roomId: 'room_1',
        days: [1, 3, 5], startTime: '09:00', endTime: '10:30', startDate: '2026-09-01',
        fee: 450000, feeHistory: [{ fee: 450000, from: '2026-09' }], limit: 14, status: 'faol', demo: true
      },
      {
        id: 'grp_ing_b', code: 'A002', name: 'Arab tili B1 (kechqurun)', courseId: 'crs_ar2', teacherId: 'stf_t2', roomId: 'room_2',
        days: [2, 4, 6], startTime: '17:00', endTime: '18:30', startDate: '2026-09-01',
        fee: 500000, feeHistory: [{ fee: 500000, from: '2026-09' }], limit: 12, status: 'faol', demo: true
      },
      {
        id: 'grp_mat', code: 'Q001', name: 'Qur’on o’qish — kunduzgi', courseId: 'crs_quron', teacherId: 'stf_t3', roomId: 'room_1',
        days: [2, 4], startTime: '14:00', endTime: '15:00', startDate: '2026-09-01',
        fee: 400000, feeHistory: [{ fee: 400000, from: '2026-09' }], limit: 16, status: 'faol', demo: true
      },
      {
        id: 'grp_it', code: 'N001', name: 'Nahv va sarf', courseId: 'crs_nahv', teacherId: 'stf_t1', roomId: 'room_3',
        days: [1, 4], startTime: '11:00', endTime: '12:30', startDate: '2026-09-01',
        fee: 550000, feeHistory: [{ fee: 550000, from: '2026-09' }], limit: 10, status: 'faol', demo: true
      },
      {
        id: 'grp_kor', code: 'M001', name: 'Muhadasa (suhbat) klubi', courseId: 'crs_suhbat', teacherId: 'stf_t2', roomId: 'room_2',
        days: [1, 3], startTime: '15:00', endTime: '16:00', startDate: A.addMonths(ym, 1) + '-01',
        fee: 500000, feeHistory: [{ fee: 500000, from: A.addMonths(ym, 1) }], limit: 12, status: 'rejalashtirilgan', demo: true
      }
    ];
    for (i = 0; i < groups.length; i++) await D.save('groups', groups[i]);

    // O'quvchilar
    var names = [
      ['Aziza', 'Rahmonova', 'Gulnora Rahmonova'], ['Bobur', 'Tursunov', 'Alisher Tursunov'],
      ['Diyora', 'Sattorova', 'Nigora Sattorova'], ['Eldor', 'Qosimov', 'Shuhrat Qosimov'],
      ['Farrux', 'Ismoilov', 'Zulfiya Ismoilova'], ['Gulnoza', 'Ahmedova', 'Rustam Ahmedov'],
      ['Humoyun', 'Nazarov', 'Dilbar Nazarova', true], ['Iroda', 'Nazarova', 'Dilbar Nazarova', true],
      ['Jasmina', 'Xolmatova', 'Oybek Xolmatov'], ['Komil', 'Saidov', 'Munira Saidova'],
      ['Laylo', 'Mirzayeva', 'Anvar Mirzayev'], ['Maqsud', 'Yo’ldoshev', 'Sanobar Yo’ldosheva'],
      ['Nilufar', 'Jo’rayeva', 'Botir Jo’rayev'], ['Otabek', 'Sharipov', 'Feruza Sharipova'],
      ['Parvina', 'Hakimova', 'Ulug’bek Hakimov'], ['Rustam', 'Toshev', 'Zebo Tosheva'],
      ['Sitora', 'Umarova', 'Kamol Umarov'], ['Temur', 'Bekmurodov', 'Sadoqat Bekmurodova']
    ];
    var studentIds = [];
    for (i = 0; i < names.length; i++) {
      var n = names[i];
      var id = 'stu_' + (i + 1);
      var famPhone = n[3] ? '+998971234567' : '+9989' + String(10000000 + i * 7919).slice(0, 8);
      await D.save('students', {
        id: id, firstName: n[0], lastName: n[1], phone: '+9989' + String(20000000 + i * 3571).slice(0, 8),
        parentName: n[2], parentPhone: famPhone, birthDate: '',
        status: i === 17 ? 'toxtatgan' : 'faol', note: '', createdAt: A.monthStart(ym) + ' 09:00', demo: true
      });
      studentIds.push(id);
    }

    // A'zoliklar
    var plan = [
      ['grp_ing_a', [0, 1, 2, 3, 4, 5]],
      ['grp_ing_b', [6, 7, 8, 9]],
      ['grp_mat', [10, 11, 12, 13, 1]],
      ['grp_it', [14, 15, 16, 0]],
    ];
    var mIdx = 1;
    for (i = 0; i < plan.length; i++) {
      var gid = plan[i][0];
      for (var j = 0; j < plan[i][1].length; j++) {
        var sid = studentIds[plan[i][1][j]];
        await D.save('memberships', {
          id: 'mem_' + (mIdx++), studentId: sid, groupId: gid,
          joinedAt: monthStart, leftAt: null, status: 'faol',
          discount: (sid === 'stu_7' || sid === 'stu_8') ? { type: 'percent', value: 10, reason: 'Oiladan ikki bola', from: ym, to: '' } : null,
          demo: true
        });
      }
    }
    // to'xtatgan o'quvchi
    await D.save('memberships', {
      id: 'mem_' + (mIdx++), studentId: studentIds[17], groupId: 'grp_mat',
      joinedAt: monthStart, leftAt: A.addDays(today, -3), status: 'chiqgan', discount: null, demo: true
    });

    // Murojaatlar
    var leads = [
      { id: 'led_1', name: 'Zilola Karimova', phone: '+998935551122', courseId: 'crs_ar1', source: 'Instagram', ownerStaffId: 'stf_adm', stage: 'yangi', note: 'Kechki guruh qiziqtiradi', nextContact: today, createdAt: A.addDays(today, -1) + ' 10:00', demo: true },
      { id: 'led_2', name: 'Sardor Ubaydullayev', phone: '+998935551133', courseId: 'crs_nahv', source: 'Tanish orqali', ownerStaffId: 'stf_adm', stage: 'boglanildi', note: 'Narxni o’yladi', nextContact: A.addDays(today, 1), createdAt: A.addDays(today, -3) + ' 15:20', demo: true },
      { id: 'led_3', name: 'Nargiza Toirova', phone: '+998935551144', courseId: 'crs_quron', source: 'Telegram', ownerStaffId: 'stf_adm', stage: 'sinov', note: 'Shanba sinov darsi', nextContact: A.addDays(today, 2), createdAt: A.addDays(today, -5) + ' 12:00', demo: true },
      { id: 'led_4', name: 'Oybek Ergashev', phone: '+998935551155', courseId: 'crs_suhbat', source: 'Banner', ownerStaffId: 'stf_adm', stage: 'rad', note: 'Uzoq', nextContact: '', createdAt: A.addDays(today, -7) + ' 09:30', demo: true }
    ];
    for (i = 0; i < leads.length; i++) await D.save('leads', leads[i]);

    // Shu oy uchun hisoblar
    await A.Ops.generateInvoices(ym, { name: 'Tizim (demo)' });

    // Bir nechta to'lov
    var invs = A.Fin.monthItems('invoices', ym);
    var paidCount = Math.min(11, invs.length);
    for (i = 0; i < paidCount; i++) {
      var inv = invs[i];
      var partial = (i % 4 === 3);
      var amt = partial ? Math.round(inv.final / 2 / 1000) * 1000 : inv.final;
      if (amt <= 0) continue;
      await A.Ops.createPayment({
        id: 'pay_demo_' + i,
        studentId: inv.studentId, amount: amt, date: A.addDays(A.monthStart(ym), (i % 9) + 1),
        method: i % 3 === 0 ? 'karta' : 'naqd',
        allocations: [{ invoiceId: inv.id, amount: amt }],
        note: partial ? 'Bo’lib to’lash' : ''
      }, { name: 'Tizim (demo)' });
    }

    // Xarajatlar
    var exps = [
      { category: 'Ijara', amount: 8000000, note: 'Sentabr ijarasi', day: 2, method: 'bank' },
      { category: 'Kommunal', amount: 1250000, note: 'Elektr va suv', day: 5, method: 'bank' },
      { category: 'Reklama', amount: 2000000, note: 'Instagram reklama', day: 7, method: 'karta' },
      { category: 'Xo’jalik', amount: 430000, note: 'Kantselyariya', day: 9, method: 'naqd' }
    ];
    for (i = 0; i < exps.length; i++) {
      await A.Ops.saveExpense({
        id: 'exp_demo_' + i, date: ym + '-' + A.pad(exps[i].day), category: exps[i].category,
        amount: exps[i].amount, method: exps[i].method, note: exps[i].note, demo: true
      }, { name: 'Tizim (demo)' });
    }

    // Bir necha dars uchun davomat
    var gA = D.one('groups', 'grp_ing_a');
    var lessons = A.monthLessons(gA, ym, null).filter(function (l) { return l.date < today; });
    var mems = D.all('memberships').filter(function (m) { return m.groupId === 'grp_ing_a'; });
    for (i = 0; i < Math.min(4, lessons.length); i++) {
      (function (les, idx) { void les; void idx; })(lessons[i], i);
      var date = lessons[i].date;
      await D.mutateLessons('grp_ing_a', ym, function (doc) {
        var rec = doc.items[date] || {};
        rec.status = 'otkazildi';
        rec.attendance = {};
        mems.forEach(function (m, k) {
          rec.attendance[m.id] = {
            status: (k + i) % 7 === 0 ? 'kelmadi' : ((k + i) % 5 === 0 ? 'kechikdi' : 'keldi'),
            at: A.nowStamp(), by: 'Jasur Aliyev'
          };
        });
        rec.markedBy = 'Jasur Aliyev';
        rec.markedAt = date + ' 10:35';
        doc.items[date] = rec;
      });
    }
  }

  async function clearDemo() {
    var cols = ['leads', 'memberships', 'students', 'groups', 'courses', 'rooms', 'staff', 'users'];
    for (var i = 0; i < cols.length; i++) {
      var list = D.all(cols[i]).filter(function (x) { return x.demo; });
      for (var j = 0; j < list.length; j++) {
        await D.remove(cols[i], list[j].id);
      }
    }
    // moliyaviy demo yozuvlari
    var kinds = ['invoices', 'payments', 'expenses', 'payroll'];
    for (i = 0; i < kinds.length; i++) {
      var months = A.Fin.index[kinds[i]] || [];
      for (var k = 0; k < months.length; k++) {
        await D.mutateMonth(kinds[i], months[k], function (doc) {
          Object.keys(doc.items || {}).forEach(function (id) {
            var it = doc.items[id];
            if (it.demo || /demo/.test(id) || (it.studentId && String(it.studentId).indexOf('stu_') === 0) ||
              (it.staffId && String(it.staffId).indexOf('stf_') === 0)) {
              delete doc.items[id];
            }
          });
        });
      }
    }
    // darslar
    var paths = Object.keys(D.docs).filter(function (p) { return p.indexOf('lessons/grp_') === 0; });
    for (i = 0; i < paths.length; i++) {
      delete D.docs[paths[i]];
      if (D.mode === 'cloud') { try { await D.db.doc(paths[i]).delete(); } catch (e) { } }
    }
  }

  global.A.Seed = { bootstrap: bootstrap, demo: demo, clearDemo: clearDemo, DEFAULT_SETTINGS: DEFAULT_SETTINGS, mkHash: mkHash, salt: salt };
})(typeof window !== 'undefined' ? window : globalThis);
