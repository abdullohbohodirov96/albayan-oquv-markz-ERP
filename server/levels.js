/* Arab tili darajalari va daraja aniqlash testi.

   Darajalar: A1 → A2 → B1 → B2 → C1 → C2 (CEFR tartibida).

   XAVFSIZLIK QOIDASI: to'g'ri javob HECH QACHON brauzerga yuborilmaydi.
   Savollar `/api/test/start` orqali javobsiz beriladi, baholash faqat
   serverda bo'ladi. Natijani mijoz o'zi "tanlab" yozolmaydi — daraja
   server hisoblaydi va `placements/` ga server yozadi.                    */
'use strict';
const crypto = require('crypto');

const LEVELS = [
  { code: 'A1', name: 'Boshlang’ich', ar: 'مبتدئ', about: 'Harflar, salomlashish, oddiy so’zlar.' },
  { code: 'A2', name: 'Asosiy', ar: 'أساسي', about: 'Kundalik gaplar, oddiy o’tgan zamon.' },
  { code: 'B1', name: 'O’rta', ar: 'متوسط', about: 'Suhbat, matn o’qish, fe’l shakllari.' },
  { code: 'B2', name: 'O’rtadan yuqori', ar: 'فوق المتوسط', about: 'Erkin suhbat, matn tahlili.' },
  { code: 'C1', name: 'Yuqori', ar: 'متقدم', about: 'Ilmiy matn, nozik ma’no farqlari.' },
  { code: 'C2', name: 'Mukammal', ar: 'إتقان', about: 'Adabiy matn, balog’at va sarf-nahv.' }
];
const ORDER = LEVELS.map(l => l.code);
const PER_LEVEL = 5;            // har darajadan nechta savol
const PASS = 3;                 // daraja o'tgan hisoblanishi uchun kerakli to'g'ri javob
const COL = 'testq/';           // savollar
const SESS = 'testsess/';       // boshlangan testlar
const RESULT = 'placements/';   // natijalar
const TTL_MS = Number(process.env.TEST_TTL_MS || 60 * 60 * 1000);   // 1 soat

/* Savol turlari — test bir xil bo'lib qolmasligi uchun:
     alifbo    — harflar va imlo
     lugat     — so'z boyligi
     tarjima   — tarjima
     toldirish — bo'shliqni to'ldirish
     grammatika— sarf va nahv
     suhbat    — kundalik muloqot iboralari
     oqish     — qisqa matnni tushunish
     balogat   — badiiy san'atlar (yuqori darajalarda)                     */
const KINDS = {
  alifbo: 'Alifbo va imlo',
  lugat: 'So’z boyligi',
  tarjima: 'Tarjima',
  toldirish: 'Bo’shliqni to’ldirish',
  grammatika: 'Grammatika',
  suhbat: 'Muloqot',
  oqish: 'Matnni tushunish',
  balogat: 'Balog’at'
};

/* ---------------- Savollar bazasi (boshlang'ich to'plam) ----------------
   Oson (A1) dan qiyin (C2) gacha, har darajada turli xil savol turlari.
   `a` — to'g'ri javob indeksi (0 dan). Bu ro'yxat faqat serverda qoladi.  */
const SEED = [
  /* ================= A1 — boshlang'ich ================= */
  { level: 'A1', kind: 'alifbo', q: 'Arab alifbosida BIRINCHI harf qaysi?', o: ['ب', 'ت', 'أ', 'ث'], a: 2 },
  { level: 'A1', kind: 'alifbo', q: '«ب» harfining nuqtasi qayerda turadi?', o: ['Tepasida', 'Pastida', 'Ichida', 'Nuqtasi yo’q'], a: 1 },
  { level: 'A1', kind: 'lugat', q: '«كِتَاب» so‘zining ma’nosi nima?', o: ['Qalam', 'Kitob', 'Eshik', 'Stol'], a: 1 },
  { level: 'A1', kind: 'lugat', q: '«بَيْت» so‘zining ma’nosi nima?', o: ['Uy', 'Non', 'Suv', 'Yo’l'], a: 0 },
  { level: 'A1', kind: 'lugat', q: '«ثَلَاثَة» qaysi sonni bildiradi?', o: ['2', '3', '4', '5'], a: 1 },
  { level: 'A1', kind: 'suhbat', q: '«Assalomu alaykum» arabchada qanday yoziladi?', o: ['السَّلَامُ عَلَيْكُم', 'مَعَ السَّلَامَة', 'تُصْبِحُ عَلَى خَيْر', 'إِلَى اللِّقَاء'], a: 0 },
  { level: 'A1', kind: 'suhbat', q: '«شُكْرًا» nima ma’noni bildiradi?', o: ['Kechirasiz', 'Rahmat', 'Xayr', 'Marhamat'], a: 1 },
  { level: 'A1', kind: 'tarjima', q: '«أَنَا طَالِب» jumlasi nimani bildiradi?', o: ['Men talabaman', 'U talaba', 'Biz talabamiz', 'Sen talabasan'], a: 0 },
  { level: 'A1', kind: 'toldirish', q: 'Bo‘shliqni to‘ldiring: «هٰذَا ...» (erkak kishi haqida)', o: ['بِنْت', 'وَلَد', 'أُخْت', 'مُعَلِّمَة'], a: 1 },
  { level: 'A1', kind: 'grammatika', q: '«الْـ» (alif-lom) so‘zga qanday ma’no qo‘shadi?', o: ['Aniqlik', 'Ko‘plik', 'Inkor', 'Savol'], a: 0 },

  /* ================= A2 — asosiy ================= */
  { level: 'A2', kind: 'toldirish', q: 'Bo‘shliqni to‘ldiring: «ذَهَبْتُ ... الْمَدْرَسَةِ»', o: ['فِي', 'إِلَى', 'عَنْ', 'مَعَ'], a: 1 },
  { level: 'A2', kind: 'toldirish', q: 'Bo‘shliqni to‘ldiring: «فِي الصَّبَاحِ أَشْرَبُ ...»', o: ['الْبَابَ', 'الْقَلَمَ', 'الشَّايَ', 'الْجِدَارَ'], a: 2 },
  { level: 'A2', kind: 'grammatika', q: '«كَتَبَ» fe’lining o‘tgan zamon, birinchi shaxs birlik shakli qaysi?', o: ['كَتَبْتُ', 'يَكْتُبُ', 'اُكْتُبْ', 'كَاتِب'], a: 0 },
  { level: 'A2', kind: 'grammatika', q: '«هٰذِهِ» olmoshi nimaga ishlatiladi?', o: ['Uzoqdagi muzakkarga', 'Yaqindagi muannasga', 'Ko‘plikka', 'Ikkilikka'], a: 1 },
  { level: 'A2', kind: 'grammatika', q: '«الْبَيْتُ كَبِيرٌ» — bu qanday jumla?', o: ['Jumla fe’liya', 'Jumla ismiya', 'Savol jumla', 'Buyruq jumla'], a: 1 },
  { level: 'A2', kind: 'lugat', q: '«أُحِبُّ» so‘zining ma’nosi nima?', o: ['Men bilaman', 'Men yaxshi ko‘raman', 'Men boraman', 'Men yozaman'], a: 1 },
  { level: 'A2', kind: 'lugat', q: '«مَدْرَسَة» so‘zining ko‘pligi qaysi?', o: ['مَدَارِس', 'مَدْرَسَات', 'مَدْرَسُون', 'مَدْرَسَيْن'], a: 0 },
  { level: 'A2', kind: 'tarjima', q: '«أَيْنَ تَسْكُنُ؟» nima degani?', o: ['Nima qilyapsan?', 'Qayerda yashaysan?', 'Qachon kelasan?', 'Nega keldingiz?'], a: 1 },
  { level: 'A2', kind: 'suhbat', q: '«كَمْ عُمْرُكَ؟» savolining ma’nosi nima?', o: ['Isming nima?', 'Yoshing nechada?', 'Qayerdansan?', 'Qanday yashaysan?'], a: 1 },
  { level: 'A2', kind: 'grammatika', q: '«لَا» yuklamasi fe’li muzori bilan kelganda nima qiladi?', o: ['Inkor qiladi', 'Buyuradi', 'Savol beradi', 'Kuchaytiradi'], a: 0 },

  /* ================= B1 — o'rta ================= */
  { level: 'B1', kind: 'grammatika', q: '«الْمُدَرِّسُ» so‘zi qaysi vaznda?', o: ['فَاعِل', 'مَفْعُول', 'مُفَعِّل', 'فَعِيل'], a: 2 },
  { level: 'B1', kind: 'grammatika', q: '«لَنْ» yuklamasidan keyin fe’l qaysi holatda bo‘ladi?', o: ['مَرْفُوع', 'مَنْصُوب', 'مَجْزُوم', 'مَجْرُور'], a: 1 },
  { level: 'B1', kind: 'grammatika', q: '«إِنَّ» qaysi so‘zni nasb qiladi?', o: ['Xabarni', 'Ismni', 'Fe’lni', 'Harfni'], a: 1 },
  { level: 'B1', kind: 'grammatika', q: '«كَانَ» fe’li jumlaga qanday ta’sir qiladi?', o: ['Ismni nasb, xabarni raf qiladi', 'Ismni raf, xabarni nasb qiladi', 'Ikkalasini jarr qiladi', 'Hech qanday ta’sir qilmaydi'], a: 1 },
  { level: 'B1', kind: 'grammatika', q: '«اِسْتَفْعَلَ» bobi ko‘pincha qanday ma’no beradi?', o: ['Talab qilish', 'Qaytarish', 'Sheriklik', 'Kuchaytirish'], a: 0 },
  { level: 'B1', kind: 'grammatika', q: '«الْجَمْعُ الْمُؤَنَّثُ السَّالِمُ» qaysi qo‘shimcha bilan yasaladi?', o: ['ـُون', 'ـَات', 'ـَيْن', 'ـِين'], a: 1 },
  { level: 'B1', kind: 'toldirish', q: 'Bo‘shliqni to‘ldiring: «لَمْ ... إِلَى السُّوقِ أَمْسِ»', o: ['أَذْهَبُ', 'أَذْهَبْ', 'ذَهَبْتُ', 'أَذْهَبَ'], a: 1 },
  { level: 'B1', kind: 'lugat', q: '«سَرِيع» so‘zining zidi qaysi?', o: ['قَوِيّ', 'بَطِيء', 'جَمِيل', 'كَبِير'], a: 1 },
  { level: 'B1', kind: 'oqish', q: '«يَعْمَلُ أَحْمَدُ فِي الْمُسْتَشْفَى، وَهُوَ طَبِيبٌ مَاهِرٌ.» — Ahmad kim?', o: ['O‘qituvchi', 'Shifokor', 'Muhandis', 'Talaba'], a: 1 },
  { level: 'B1', kind: 'tarjima', q: '«مِنَ الضَّرُورِيِّ أَنْ نَدْرُسَ» nima degani?', o: ['O‘qishimiz zarur', 'O‘qishni xohlaymiz', 'O‘qimaymiz', 'O‘qigan edik'], a: 0 },

  /* ================= B2 — o'rtadan yuqori ================= */
  { level: 'B2', kind: 'grammatika', q: '«الْمَفْعُولُ لِأَجْلِهِ» nimani bildiradi?', o: ['Harakat sababini', 'Harakat vaqtini', 'Harakat o‘rnini', 'Harakat holatini'], a: 0 },
  { level: 'B2', kind: 'grammatika', q: '«جَاءَ الطُّلَّابُ إِلَّا زَيْدًا» — «زَيْدًا» qanday nomlanadi?', o: ['مُسْتَثْنَى', 'تَمْيِيز', 'حَال', 'نَعْت'], a: 0 },
  { level: 'B2', kind: 'grammatika', q: '«الْحَالُ» gapda odatda qaysi holatda keladi?', o: ['مَرْفُوع', 'مَنْصُوب', 'مَجْرُور', 'مَجْزُوم'], a: 1 },
  { level: 'B2', kind: 'grammatika', q: '«الْمَبْنِيُّ لِلْمَجْهُولِ» nima?', o: ['Majhul nisbatli fe’l', 'Buyruq fe’l', 'Ma’lum nisbatli fe’l', 'Ot'], a: 0 },
  { level: 'B2', kind: 'grammatika', q: '«أَفْعَلُ التَّفْضِيلِ» qanday ma’no beradi?', o: ['Qiyoslash, ortiqlik', 'Kichraytirish', 'Egalik', 'Inkor'], a: 0 },
  { level: 'B2', kind: 'grammatika', q: '«الْبَدَل» nima?', o: ['Oldingi so‘z o‘rnini bosuvchi izoh', 'Sifatlovchi', 'Bog‘lovchi', 'Inkor yuklamasi'], a: 0 },
  { level: 'B2', kind: 'toldirish', q: 'Bo‘shliqni to‘ldiring: «لَوْلَا مُسَاعَدَتُكَ ... نَجَحْتُ»', o: ['لَا', 'مَا', 'لَنْ', 'لَمْ'], a: 1 },
  { level: 'B2', kind: 'lugat', q: '«اِزْدَهَرَ» so‘zining ma’nosi nima?', o: ['Gullab-yashnadi', 'Yo‘qoldi', 'Kamaydi', 'To‘xtadi'], a: 0 },
  { level: 'B2', kind: 'oqish', q: '«رَغْمَ الْمَطَرِ الْغَزِيرِ، وَصَلَ الطُّلَّابُ فِي الْمَوْعِدِ.» — Talabalar nima qilishdi?', o: ['Kech qolishdi', 'Vaqtida yetib kelishdi', 'Kelishmadi', 'Uyga qaytishdi'], a: 1 },
  { level: 'B2', kind: 'tarjima', q: '«لَا يَزَالُ يَعْمَلُ» nima degani?', o: ['Hali ham ishlamoqda', 'Endi ishlamaydi', 'Ishlay boshladi', 'Ishlamagan edi'], a: 0 },

  /* ================= C1 — yuqori ================= */
  { level: 'C1', kind: 'balogat', q: '«الْبَلَاغَة» ilmining bo‘limlari qaysilar?', o: ['الْمَعَانِي، الْبَيَان، الْبَدِيع', 'النَّحْو، الصَّرْف، الْإِمْلَاء', 'الْفِقْه، الْأُصُول', 'الْعَرُوض، الْقَافِيَة'], a: 0 },
  { level: 'C1', kind: 'balogat', q: '«الِاسْتِعَارَة» nima?', o: ['Yashirin o‘xshatish', 'Aniq o‘xshatish', 'So‘zma-so‘z ma’no', 'Takror'], a: 0 },
  { level: 'C1', kind: 'balogat', q: '«الْمَجَازُ الْمُرْسَل» nimaga asoslanadi?', o: ['O‘xshatishdan boshqa aloqaga', 'O‘xshatishga', 'Takrorga', 'Qofiyaga'], a: 0 },
  { level: 'C1', kind: 'balogat', q: '«الْكِنَايَة» nima?', o: ['Ma’noni ishora bilan bildirish', 'To‘g‘ridan-to‘g‘ri aytish', 'So‘z takrori', 'Savol berish'], a: 0 },
  { level: 'C1', kind: 'grammatika', q: '«الْإِعْلَال» qaysi harflar bilan bog‘liq?', o: ['حُرُوف الْعِلَّة (ا، و، ي)', 'حُرُوف الْجَرّ', 'حُرُوف النَّصْب', 'حُرُوف الْعَطْف'], a: 0 },
  { level: 'C1', kind: 'grammatika', q: '«التَّمْيِيز» va «الْحَال» orasidagi asosiy farq nimada?', o: ['التَّمْيِيز noaniqlikni izohlaydi, الْحَال holatni bildiradi', 'Ikkalasi bir xil', 'الْحَال doim ma’rifa', 'التَّمْيِيز doim fe’l'], a: 0 },
  { level: 'C1', kind: 'grammatika', q: '«الْمَمْنُوعُ مِنَ الصَّرْفِ» so‘z qanday xususiyatga ega?', o: ['Tanvin qabul qilmaydi', 'Doim tanvinli', 'Doim majhul', 'Doim ko‘plik'], a: 0 },
  { level: 'C1', kind: 'grammatika', q: '«أُسْلُوبُ الشَّرْطِ» da «إِنْ» dan keyingi fe’l qaysi holatda bo‘ladi?', o: ['مَجْزُوم', 'مَنْصُوب', 'مَرْفُوع', 'مَجْرُور'], a: 0 },
  { level: 'C1', kind: 'lugat', q: '«الْغَيْث» so‘zining ma’nosi nima?', o: ['Yomg‘ir', 'Shamol', 'Qorong‘ilik', 'Qumlik'], a: 0 },
  { level: 'C1', kind: 'oqish', q: '«إِنَّ الْعِلْمَ نُورٌ يُضِيءُ دَرْبَ صَاحِبِهِ.» — «نُورٌ» bu yerda qanday ishlatilgan?', o: ['Majoziy (badiiy) ma’noda', 'To‘g‘ri, lug‘aviy ma’noda', 'Savol sifatida', 'Inkor sifatida'], a: 0 },

  /* ================= C2 — mukammal ================= */
  { level: 'C2', kind: 'balogat', q: '«الْمُقَابَلَة» va «الطِّبَاق» orasidagi farq nima?', o: ['الطِّبَاق bitta zid juft, الْمُقَابَلَة bir nechta juft', 'Ikkalasi bir xil', 'الطِّبَاق faqat she’rda', 'الْمُقَابَلَة faqat nasrda'], a: 0 },
  { level: 'C2', kind: 'balogat', q: '«الِالْتِفَات» uslubi nima?', o: ['Shaxsdan shaxsga kutilmaganda o‘tish', 'Takrorlash', 'Qisqartirish', 'Savol berish'], a: 0 },
  { level: 'C2', kind: 'balogat', q: '«وَاشْتَعَلَ الرَّأْسُ شَيْبًا» — «اشْتَعَلَ» bu yerda qanday ma’noda?', o: ['Majoziy: sochning oqarib yoyilishi', 'To‘g‘ri ma’noda: yondi', 'Savol ma’nosida', 'Inkor ma’nosida'], a: 0 },
  { level: 'C2', kind: 'grammatika', q: '«الْإِدْغَام» qoidasi nimani anglatadi?', o: ['Ikki harfni bir harfga qo‘shish', 'Harfni cho‘zish', 'Harfni tushirish', 'Harfni almashtirish'], a: 0 },
  { level: 'C2', kind: 'grammatika', q: '«نَائِبُ الْفَاعِلِ» qaysi holatda bo‘ladi?', o: ['مَرْفُوع', 'مَنْصُوب', 'مَجْرُور', 'مَجْزُوم'], a: 0 },
  { level: 'C2', kind: 'grammatika', q: '«الْمَصْدَرُ الْمِيمِيّ» qanday tanib olinadi?', o: ['Qo‘shimcha «مـ» bilan boshlanadi', 'Doim «ة» bilan tugaydi', 'Doim ko‘plik', 'Doim majhul'], a: 0 },
  { level: 'C2', kind: 'grammatika', q: '«التَّضْمِين» (nahvda) nima?', o: ['Fe’lga boshqa fe’l ma’nosini yuklash', 'So‘zni tushirish', 'Harfni takrorlash', 'Jumlani bo‘lish'], a: 0 },
  { level: 'C2', kind: 'balogat', q: '«بَحْرُ الطَّوِيل» qaysi ilmga tegishli?', o: ['الْعَرُوض', 'النَّحْو', 'الصَّرْف', 'الْفِقْه'], a: 0 },
  { level: 'C2', kind: 'balogat', q: '«الْقَافِيَة» nima?', o: ['She’r oxiridagi takrorlanuvchi tovushlar', 'She’r boshidagi so‘z', 'Misra o‘rtasi', 'She’r mavzusi'], a: 0 },
  { level: 'C2', kind: 'lugat', q: 'Arab lug‘atlarida so‘z odatda nima bo‘yicha izlanadi?', o: ['So‘zning asl o‘zagi (juzur)', 'Birinchi harfi bo‘yicha', 'Uzunligi bo‘yicha', 'Ma’nosi bo‘yicha'], a: 0 }
];

/* ---------------- Yordamchilar ---------------- */
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function nowStamp(opts) {
  return (opts && typeof opts.stamp === 'function')
    ? opts.stamp()
    : new Date().toISOString().slice(0, 16).replace('T', ' ');
}
function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
/** Takrorlanadigan tasodif — bir sessiya ichida barqaror */
function seeded(seed) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  return function () { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}
function clean(t, max) { return String(t == null ? '' : t).slice(0, max || 400); }

/** Savollar bazasini birinchi ishga tushishda to'ldiradi (bor bo'lsa tegmaydi) */
async function ensureBank(store, opts) {
  const rows = await store.list(COL);
  if (rows.length) return 0;
  let n = 0;
  for (let i = 0; i < SEED.length; i++) {
    const s = SEED[i];
    const id = 'q' + String(i + 1).padStart(3, '0');
    await store.set(COL + id, {
      id, level: s.level, kind: s.kind || 'lugat', text: s.q, options: s.o, answer: s.a,
      active: true, order: i, createdAt: nowStamp(opts)
    });
    n++;
  }
  return n;
}

async function bank(store) {
  return (await store.list(COL))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data)
    .filter(q => q && q.active !== false && Array.isArray(q.options) && q.options.length >= 2);
}

/**
 * Yangi test boshlash. Javoblar QAYTARILMAYDI.
 * @returns {{id, questions:[{id, level, text, options}]}}
 */
async function start(store, opts) {
  const all = await bank(store);
  const rnd = seeded(crypto.randomBytes(8).toString('hex'));
  const picked = [];
  for (const lvl of ORDER) {
    /* Har darajada savol TURLARI xilma-xil bo'lsin: avval har turdan
       bittadan olamiz, keyin yetmasa qolganlaridan to'ldiramiz.        */
    const pool = shuffle(all.filter(q => q.level === lvl), rnd);
    const byKind = {};
    pool.forEach(q => { (byKind[q.kind || 'lugat'] = byKind[q.kind || 'lugat'] || []).push(q); });
    const kinds = shuffle(Object.keys(byKind), rnd);
    const take = [];
    for (const k of kinds) { if (take.length < PER_LEVEL) take.push(byKind[k].shift()); }
    for (const q of pool) {
      if (take.length >= PER_LEVEL) break;
      if (take.indexOf(q) < 0) take.push(q);
    }
    take.filter(Boolean).forEach(q => picked.push(q));
  }
  if (!picked.length) return null;
  const id = 'ts' + crypto.randomBytes(8).toString('hex');
  /* Variantlar tartibi har sessiyada aralashtiriladi. Aks holda "doim
     birinchi variantni bosgan" odam ham ball to'plab qolardi.
     Aralashtirish xaritasi faqat serverda (sessiyada) saqlanadi.        */
  const mix = {};
  picked.forEach(q => {
    const idx = q.options.map((_, i) => i);
    mix[q.id] = shuffle(idx, rnd);       // mix[qid][ko'rsatilgan] = asl indeks
  });
  await store.set(SESS + id, {
    id,
    qids: picked.map(q => q.id),
    mix,
    startedAt: nowStamp(opts),
    expiresAt: Date.now() + TTL_MS,
    ip: sha(String((opts && opts.ip) || '')).slice(0, 16),   // faqat taqqoslash uchun, ochiq IP emas
    usedAt: null
  });
  return {
    id,
    total: picked.length,
    questions: picked.map(q => ({
      id: String(q.id),
      level: String(q.level),
      kind: String(q.kind || ''),
      kindLabel: KINDS[q.kind] || '',
      text: clean(q.text, 400),
      options: mix[q.id].map(i => clean(q.options[i], 200))
    }))
  };
}

/** Daraja hisoblash: pastdan yuqoriga, birinchi yiqilgan darajada to'xtaydi. */
function decide(perLevel) {
  let reached = '';
  for (const lvl of ORDER) {
    const r = perLevel[lvl] || { ok: 0, total: 0 };
    if (r.total && r.ok >= PASS) reached = lvl; else break;
  }
  return reached || 'A0';
}

/**
 * Javoblarni baholash. Sessiya bir marta ishlatiladi.
 * @returns {{ok:true, level, perLevel, score, total, resultId}} yoki {ok:false, reason}
 */
async function submit(store, opts) {
  const id = String((opts && opts.sessionId) || '');
  if (!/^ts[a-f0-9]{16}$/.test(id)) return { ok: false, reason: 'format' };
  const ses = await store.get(SESS + id);
  if (!ses) return { ok: false, reason: 'topilmadi' };
  if (ses.usedAt) return { ok: false, reason: 'ishlatilgan' };
  if (Number(ses.expiresAt) && Date.now() > Number(ses.expiresAt)) return { ok: false, reason: 'muddati' };

  const answers = {};
  (Array.isArray(opts.answers) ? opts.answers : []).forEach(a => {
    if (a && a.id != null) answers[String(a.id)] = Number(a.choice);
  });

  const perLevel = {};
  ORDER.forEach(l => { perLevel[l] = { ok: 0, total: 0 }; });
  let score = 0;
  for (const qid of ses.qids) {
    const q = await store.get(COL + qid);
    if (!q) continue;
    const lvl = perLevel[q.level] || (perLevel[q.level] = { ok: 0, total: 0 });
    lvl.total++;
    /* Ko'rsatilgan tartibdan asl indeksga qaytaramiz */
    const map = (ses.mix && ses.mix[qid]) || null;
    const shown = answers[qid];
    const real = (map && Number.isInteger(shown) && shown >= 0 && shown < map.length)
      ? Number(map[shown]) : shown;
    if (real === Number(q.answer)) { lvl.ok++; score++; }
  }
  const level = decide(perLevel);

  ses.usedAt = nowStamp(opts);
  await store.set(SESS + id, ses);

  const rid = 'pl' + crypto.randomBytes(6).toString('hex');
  const res = {
    id: rid,
    level,
    perLevel,
    score,
    total: ses.qids.length,
    name: clean(opts.name, 80),
    phone: clean(opts.phone, 30),
    studentId: clean(opts.studentId, 40),
    at: nowStamp(opts),
    sessionId: id
  };
  await store.set(RESULT + rid, res);
  return { ok: true, level, perLevel, score, total: res.total, resultId: rid, name: res.name, phone: res.phone };
}

/** Eskirgan sessiyalarni tozalash */
async function cleanup(store) {
  const rows = await store.list(SESS);
  let n = 0;
  for (const r of rows) {
    const d = r.data;
    if (!d) continue;
    if (Number(d.expiresAt) && Date.now() - Number(d.expiresAt) > 7 * 864e5 && store.del) {
      await store.del(r.path); n++;
    }
  }
  return n;
}

function levelInfo(code) {
  return LEVELS.filter(l => l.code === code)[0] ||
    { code: 'A0', name: 'Hali boshlanmagan', ar: '—', about: 'Alifbodan boshlash tavsiya etiladi.' };
}

module.exports = {
  LEVELS, KINDS, ORDER, PER_LEVEL, PASS, COL, SESS, RESULT,
  ensureBank, bank, start, submit, decide, cleanup, levelInfo
};
