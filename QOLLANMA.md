# Albyana — foydalanish yo'riqnomasi

Bu yo'riqnoma administrator uchun yozilgan. Dasturlashni bilish shart emas.

---

## Birinchi kun: tizimni o'zingizga moslash

1. **Kirish.** Serverli versiyada login va parolni `.env` faylida o'zingiz
   belgilaysiz. Sinov (serversiz) versiyada: login `admin`, parol `1234`.
2. **Sozlamalar → Markaz**: markaz nomi, telefon, manzil, ish vaqti va
   to'lov muddati (oyning nechanchi kunigacha to'lansin) ni kiriting.
3. **Sozlamalar → Foydalanuvchilar**: har bir xodimga alohida login va parol
   bering. Sinov hisoblarini (`manager`, `ustoz`, `hisob`) o'chiring yoki
   parolini almashtiring.
4. **Sozlamalar → Ma'lumotlar → Demo ma'lumotlarni o'chirish.**
5. **Guruhlar → Kurslar va xonalar**: o'z kurslaringiz va xonalaringizni
   kiriting.
6. **Xodimlar**: o'qituvchilarni qo'shing. Ish haqi turini tanlang —
   belgilangan oylik yoki tushumdan foiz.
7. **Guruhlar → Guruh ochish**: kurs, o'qituvchi, xona, dars kunlari, vaqti va
   oylik narxni belgilang.

---

## Har kungi ish

### O'quvchi qo'shish
**O'quvchilar → O'quvchi qo'shish.** Familiya, ism va ota-ona telefoni
majburiy. Shaklning pastida "Darhol guruhga yozish" ni tanlasangiz, saqlagandan
keyin guruhga yozish oynasi ochiladi.

Bir xil telefon raqam boshqa o'quvchida bo'lsa tizim ogohlantiradi, lekin
taqiqlamaydi — bir oiladagi bolalar uchun bir raqam bo'lishi normal.

### Guruhga yozish
O'quvchi kartasida **"Guruhga yozish"**. Guruh, kirgan sana va (kerak bo'lsa)
chegirma kiritiladi.

Agar o'quvchi oy o'rtasida qo'shilsa, tizim so'raydi: to'liq oylik narxmi yoki
kelishilgan summa? Ikkinchisini tanlasangiz summa va izohni yozasiz.

### Dars jadvali
**Jadval** bo'limida hafta ko'rinadi (telefonda — kunlik ro'yxat va yuqoridagi
sana tasmasi). Darsni bosib:
- **Davomat olish**
- **Ko'chirish** — faqat shu bitta dars boshqa kunga ko'chadi, haftalik jadval
  o'zgarmaydi
- **Bekor qilish**

Bir xona yoki bir o'qituvchiga bir vaqtda ikki dars qo'yib bo'lmaydi — tizim
ruxsat bermaydi va kim bandligini aytadi.

### Davomat olish
**Davomat** → guruh va dars sanasini tanlang. Har bir o'quvchi uchun:
Keldi / Kelmadi / Kechikdi / Sababli.

"Hammani Keldi deb belgilash" tugmasini bosib, keyin istisnolarni o'zgartirish
eng tez yo'l. **Saqlash** ni bosishni unutmang.

Belgilanmagan o'quvchi avtomatik "Kelmadi" bo'lmaydi — u shunchaki
belgilanmagan bo'lib qoladi va bosh sahifada eslatma chiqadi.

### To'lov qabul qilish
Istalgan joydan **"To'lov qabul qilish"** tugmasi:
1. O'quvchini qidiring va tanlang.
2. Summani kiriting.
3. Tizim qaysi hisoblarga yozilishini o'zi taklif qiladi (eng eski qarzdan
   boshlab). Kerak bo'lsa qo'lda o'zgartiring.
4. Ortiqcha pul avans bo'lib qoladi — keyingi oy hisobiga o'tadi.
5. **Qabul qilish** → chek chiqadi, uni chop etish mumkin.

Tugmani ikki marta bossangiz ham ikkita to'lov yozilmaydi.

### Oylik hisoblar
**Moliya → Hisoblangan to'lovlar → "... hisoblarini yaratish."**
Har oy boshida bir marta bosing. Ikkinchi marta bossangiz takroriy hisob
paydo bo'lmaydi — faqat yangi qo'shilganlarga yaratiladi.

### Qarzdorlik
**Moliya → Qarzdorlik**: kim, qancha, qaysi oylardan qarzdor. Muddati o'tgan
qarz qizil rangda va alohida ustunda. Har bir qatordan darhol to'lov qabul
qilish mumkin.

### Xarajat va ish haqi
- **Moliya → Xarajatlar**: ijara, kommunal, reklama va boshqalar.
- **Moliya → Ish haqi**: "Hisoblash / yangilash" → direktor tasdiqlaydi →
  "To'lash". To'langan ish haqi xarajatlarda avtomatik bir marta ko'rinadi.

### Hisobotlar
**Hisobotlar** bo'limida davr tanlanadi (bugun / shu hafta / shu oy / oraliq).
Barcha asosiy ro'yxatlarni Excel'ga yuklab olish mumkin — har sahifadagi
"Excel" tugmasi.

---

## Xatolik bo'lsa

- **To'lov noto'g'ri kiritildi** → "Tuzatish" → *Bekor qilish* (sabab bilan).
  Yozuv ro'yxatda qoladi, lekin hisobga olinmaydi.
- **Mijozga pul qaytardingiz** → "Tuzatish" → *Pul qaytarish*. Bu alohida
  yozuv bo'ladi va hisobotlarda alohida ko'rinadi.
- **Internet sekin bo'lsa** yuqorida "Saqlanmoqda…" yozuvi turadi. Xato
  chiqsa, oyna yopilmaydi — kiritgan ma'lumotingiz joyida qoladi, qayta
  urinsangiz bo'ladi.

---

---

## Tilni va ko'rinishni almashtirish

Yuqori o'ng burchakda **UZ / RU / EN / AR** tugmalari. Arabchani tanlasangiz
interfeys o'ngdan chapga o'giriladi. Yonidagi tugma yorug' va qorong'i
ko'rinishni almashtiradi. Tanlovingiz shu brauzerda eslab qolinadi.

Sozlamalar → Markaz bo'limida ham bir joydan tanlash mumkin.

---

## Excel'dan ro'yxat yuklash

**O'quvchilar → Excel'dan import** (yoki Murojaatlarda shu tugma).

1. Faylni tanlang — `.xlsx`, `.xls`, `.csv` bo'lishi mumkin.
2. Tizim ustunlarni o'zi taniydi. **Ustunlar tartibi muhim emas**,
   sarlavhalar o'zbek, rus yoki ingliz tilida bo'lishi mumkin.
3. Moslashtirishni ko'rib chiqing — noto'g'ri tanilgan bo'lsa qo'lda o'zgartiring.
4. Dastlabki 5 qator ko'rsatiladi. To'g'ri bo'lsa "Import qilish" ni bosing.
5. Oxirida nechta qo'shilgani va nechta o'tkazib yuborilgani yoziladi.

Faylda guruh kodi ustuni bo'lsa (masalan `A001`), o'quvchi o'sha guruhga
avtomatik yoziladi.

---

## Ruxsatlarni sozlash

**Sozlamalar → Foydalanuvchilar → (foydalanuvchini oching) → Ruxsatlarni sozlash.**

Har bir bo'lim uchun alohida ruxsat berish yoki olib qo'yish mumkin.
"Rol bo'yicha" deb turgan ruxsat — rolning odatdagi huquqi.
"Alohida" deb belgilangani — siz qo'lda o'zgartirgan.

- **Hammasiga ruxsat berish** — bitta bosishda to'liq huquq (ishonchli xodim uchun).
- **Rol bo'yicha qaytarish** — o'zgartirishlarni bekor qiladi.

---

## Xodimlar bilan ishlash

**Suhbat** — xodimlar o'rtasida yozishmalar. "Umumiy suhbat" hammaga ko'rinadi,
"Yangi suhbat" orqali bitta xodim bilan alohida yozishish mumkin.
O'qilmagan xabarlar soni ro'yxatda qizil belgi bilan ko'rsatiladi.

**Vazifalar** — xodimga topshiriq berish. Muddati o'tgan vazifa qizil rangda.
Xodim o'zi "Boshlash" va "Bajarildi" tugmalari bilan holatni o'zgartiradi.

---

## Telegram bot

Bot faqat serverli versiyada ishlaydi (README ga qarang).

**O'quvchini ulash:** o'quvchi botga `/start` bosadi, ism-familiyasi va
guruh kodini yozadi. So'rov **Telegram bot → Holat** bo'limiga tushadi —
siz kimligini tanlab "Ulash" ni bosasiz.

**Guruh kodi** har bir guruhda ko'rsatilgan (masalan `A001`). Uni guruh
tahrirlash oynasida o'zgartirish mumkin.

**Xabar yuborish:** Telegram bot → Xabar yuborish. Barcha ulanganlarga,
bitta guruhga yoki faqat qarzdorlarga yuborish mumkin.

Davomat belgilanganda va to'lov qabul qilinganda o'quvchiga avtomatik xabar
boradi — buni sozlamalarda o'chirib qo'yish mumkin.

---

## Nimalar hali yo'q

- SMS xabarnomalar
- Onlayn to'lov va fiskal chek
- Ota-ona uchun alohida kabinet (hozircha bot orqali)
- Bir nechta filial

Tizimda bular bor deb ko'rsatuvchi ishlamaydigan tugmalar yo'q.
