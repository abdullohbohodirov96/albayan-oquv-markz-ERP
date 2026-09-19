# Albyana — o'quv markazi ERP tizimi

Albyana arab tili o'quv markazini to'liq yuritish uchun veb-tizim: murojaatlardan
tortib o'quvchi, guruh, dars jadvali, davomat, to'lov, qarzdorlik, xarajat,
ish haqi va hisobotlargacha. Ustiga — xodimlar o'rtasidagi ichki suhbat,
vazifalar va **Albayan Telegram boti**.

Interfeys to'rt tilda: **o'zbek, rus, ingliz, arab** (arabcha o'ngdan chapga).
Yorug' va qorong'i ko'rinish. Valyuta — so'm, vaqt mintaqasi — Asia/Tashkent.

Kompyuterda ham, telefonda ham **barcha modullari bilan** ishlaydi: telefondan
o'quvchi qo'shish, guruhga yozish, jadvalni o'zgartirish, davomat olish,
to'lov qabul qilish va hisobot yuklab olish mumkin.

---

## 1. Ikki xil ishga tushirish

### A. Serverli versiya (tavsiya etiladi — bot shu yerda ishlaydi)

```bash
git clone https://github.com/abdullohbohodirov96/albayan-oquv-markz-ERP.git
cd albayan-oquv-markz-ERP
npm install
cp .env.example .env         # va ichini to'ldiring
node build.js
npm start
```

Brauzerda `http://localhost:3000`.

`.env` da kamida shu ikkitasi bo'lishi kerak:

```
SEED_DIRECTOR_LOGIN=admin
SEED_DIRECTOR_PASSWORD=<kuchli parol>
```

Server birinchi ishga tushganda shu ma'lumot bilan direktor hisobini yaratadi.
Birinchi kirishdan keyin bu qatorlarni bo'shatib qo'ying.

Nima beradi:

- **Huquqlar serverda tekshiriladi** — brauzerni "aldab" boshqa bo'limga kira olmaydi.
- Parollar hech qachon brauzerga yuborilmaydi (faqat tuz + SHA-256 hash serverda).
- Barcha xodimlar bitta bazaga ulanadi.
- **Telegram bot ishlaydi.**

### B. Serversiz (faqat ko'rish uchun)

`index.html` ni istalgan statik hostingga qo'ying yoki `npx serve .` bilan oching.
Ma'lumotlar shu brauzerda saqlanadi, bot ishlamaydi. Sinash uchun qulay.

---

## 2. Render.com ga joylashtirish

Repozitoriyada tayyor `render.yaml` bor.

1. [render.com](https://render.com) da **New → Blueprint** ni tanlang va repozitoriyani ulang.
2. Render `render.yaml` ni o'qiydi va xizmatni yaratadi.
3. **Environment** bo'limida quyidagilarni kiriting:
   - `SEED_DIRECTOR_PASSWORD` — direktor paroli
   - `TELEGRAM_BOT_TOKEN` — @BotFather bergan token
   - `TELEGRAM_BOT_USERNAME` — bot nomi (masalan `albyana_bot`)
4. Deploy tugagach havola beriladi — shu manzilga kiring.

**Muhim:** ma'lumotlar `/var/data` diskida saqlanadi. Bepul tarifda disk yo'q —
xizmat uxlab qolganda ma'lumot yo'qolishi mumkin. Haqiqiy ish uchun disk bor
tarifni (yoki `DATABASE_URL` orqali PostgreSQL ni) tanlang.

PostgreSQL ishlatmoqchi bo'lsangiz: Render'da Postgres yarating va uning
`Internal Database URL` ini `DATABASE_URL` ga qo'ying — boshqa hech narsa
o'zgartirmaysiz, tizim o'zi jadvalni yaratadi.

---

## 3. Albayan Telegram bot

### Ishga tushirish

1. Telegramda [@BotFather](https://t.me/BotFather) ga `/newbot` yozing, nom va
   username tanlang, tokenni oling.
2. Tokenni `.env` ga qo'ying:
   ```
   TELEGRAM_BOT_TOKEN=123456:AA...
   TELEGRAM_BOT_USERNAME=albyana_bot
   ```
3. Serverni qayta ishga tushiring. Konsolda `Telegram bot ishga tushdi: @...`
   yozuvi chiqadi.
4. Tizimda **Telegram bot → Sozlamalar** bo'limiga kirib, bot nomini yozing.

**Token hech qachon ilovada yoki bazada saqlanmaydi** — faqat serverning
`.env` faylida turadi.

### O'quvchi qanday ulanadi

1. O'quvchi botni ochadi va `/start` bosadi.
2. Bot ism-familiyasini so'raydi.
3. Keyin **guruh kodini** so'raydi — masalan `A001`. Har bir guruhning kodi
   tizimda ko'rsatilgan.
4. Kod to'g'ri bo'lsa, bot shu guruhdagi o'quvchilar ichidan ismni qidiradi.
   - Topilsa va sozlamada "avtomatik ulash" yoqilgan bo'lsa — darhol ulanadi.
   - Aks holda **Telegram bot → Holat** bo'limiga so'rov tushadi,
     administrator kimligini tanlab tasdiqlaydi.

### O'quvchi botda nima qila oladi

| Tugma | Nima ko'rsatadi |
|---|---|
| To'lovim | Hisoblangan, to'langan, qolgan qarz va to'lanmagan oylar ro'yxati |
| Davomatim | Oxirgi 10 ta dars va umumiy statistika |
| Jadvalim | O'z guruhlarining dars kunlari, vaqti va xonasi |
| Markazga yozish | Xabar yozadi — u tizimda administratorga ko'rinadi |

### Avtomatik xabarlar

- **Davomat belgilanganda** — o'quvchiga "darsda qatnashdi / kelmadi" xabari.
- **To'lov qabul qilinganda** — summa, chek raqami va qolgan qarz.
- **Administrator yuborgan e'lonlar** — barcha ulanganlarga, bitta guruhga yoki
  faqat qarzdorlarga.

Har bir turdagi xabarni **Telegram bot → Sozlamalar** da o'chirib qo'yish mumkin.

Bot serveri ishlamayotgan bo'lsa, xabarlar navbatda saqlanadi va server
ishga tushgach yuboriladi — hech biri yo'qolmaydi.

---

## 4. Rollar va ruxsatlar

Tayyor rollar: **Direktor, Administrator, O'qituvchi, Buxgalter.**

| Modul | Direktor | Administrator | O'qituvchi | Buxgalter |
|---|:--:|:--:|:--:|:--:|
| Murojaatlar (CRM) | ✓ | ✓ | — | — |
| O'quvchilar | ✓ | ✓ | faqat o'z guruhi | ko'rish |
| Guruhlar / kurslar | ✓ | ✓ | faqat o'ziniki | ko'rish |
| Jadval | ✓ | ✓ | ko'rish | ko'rish |
| Davomat | ✓ | ✓ | o'z darslari | ko'rish |
| To'lov qabul qilish | ✓ | ✓ | — | ✓ |
| Xarajatlar | ✓ | — | — | ✓ |
| Ish haqi | ✓ | — | — | hisoblash |
| Ish haqini tasdiqlash | ✓ | — | — | — |
| Moliyaviy hisobotlar | ✓ | — | — | ✓ |
| Suhbat va vazifalar | ✓ | ✓ | ✓ | ✓ |
| Telegram bot | ✓ | xabar yuborish | — | — |
| Sozlamalar, foydalanuvchilar | ✓ | — | — | — |

Bu — faqat **boshlang'ich** holat. Har bir foydalanuvchi uchun
**Sozlamalar → Foydalanuvchilar → Ruxsatlarni sozlash** bo'limida har bir
bo'limni alohida yoqish yoki o'chirish mumkin. "Hammasiga ruxsat berish"
tugmasi bitta bosishda to'liq huquq beradi.

Serverli versiyada har bir yozuv serverda ham tekshiriladi.

---

## 5. Excel'dan import

**O'quvchilar** va **Murojaatlar** bo'limlarida "Excel'dan import" tugmasi bor.

- `.xlsx`, `.xls`, `.csv`, `.tsv` fayllar o'qiladi.
- **Ustunlar tartibi muhim emas** — tizim sarlavhalarni o'zi taniydi
  (o'zbek, rus va ingliz nomlari: "Familiya", "Фамилия", "Last name", "F.I.O",
  "Telefon raqami", "Guruh kodi" va boshqalar).
- Sarlavha qatori bo'lmasa — ustunlar mazmuni bo'yicha taxmin qilinadi
  (telefon, sana, ism).
- Import oldidan moslashtirish va dastlabki 5 qator ko'rsatiladi.
- Takroriy telefon raqamlarini o'tkazib yuborish yoki baribir qo'shish mumkin.
- Faylda guruh kodi bo'lsa, o'quvchi o'sha guruhga avtomatik yoziladi.

---

## 6. Asosiy qoidalar (moliyaviy mantiq)

- **Oylik hisob** har bir faol a'zolik uchun oyiga **bitta** yaratiladi
  (`inv_<a'zolik>_<oy>`). Tugmani necha marta bossangiz ham takrorlanmaydi.
- **Chegirma** summa yoki foizda; sababi va amal qilish davri saqlanadi;
  hisobni hech qachon manfiyga tushirmaydi.
- **To'lov** eng eski qarzdan boshlab taqsimlanadi; administrator taqsimotni
  ko'radi va tasdiqlaydi. Ortiqcha pul **avans** bo'lib qoladi.
- **Takroriy bosish** yangi to'lov yaratmaydi.
- **Yashirin o'chirish yo'q**: "bekor qilish" va "pul qaytarish" alohida
  amallar, sabab va foydalanuvchi bilan saqlanadi.
- **Narx o'zgarishi** faqat kelajakdagi oylarga ta'sir qiladi.
- **Jadval to'qnashuvi**: bir xona yoki bir o'qituvchiga bir vaqtda ikki dars
  qo'yilmaydi. Bitta darsni ko'chirish haftalik jadvalni o'zgartirmaydi.
- **Davomat**: belgilanmagan o'quvchi avtomatik "Kelmadi" hisoblanmaydi.
- **Ish haqi**: belgilangan oylik yoki haqiqatda tushgan puldan foiz.
  Tasdiqlangan davr qayta hisoblanmaydi. To'langan ish haqi xarajatlarda
  **bir marta** aks etadi.
- **"Sof pul oqimi"** = tushum − qaytarishlar − to'langan xarajatlar.
  Bu buxgalteriya foydasi emas.
- To'lov cheki — markazning **ichki** tasdig'i, fiskal chek emas.

---

## 7. Testlar

```bash
npm test                 # 111 ta tekshiruv: moliya, huquqlar, jadval, import, bot
npm run test:browser     # brauzerda 1320 / 390 / 360 px da asosiy jarayonlar
npm run test:server      # serverli versiya: kirish, ruxsatlar, saqlanish
```

`npm test` tekshiradi: takrorlanmaydigan oylik hisob, chegirma chegaralari,
qisman to'lov, avans, taqsimlash tartibi, bekor qilish, pul qaytarish,
narx o'zgarishi, jadval to'qnashuvi, rollar va shaxsiy ruxsatlar, guruh kodi,
ish haqi (foiz/belgilangan, yopilgan davr, xarajatda bir marta),
sof pul oqimi, davomat, Excel import (turli tildagi va tartibdagi ustunlar),
bot ismni moslashtirishi.

---

## 8. Loyiha tuzilishi

```
index.html          # to'liq hujjat (build.js hosil qiladi)
artifact.html       # Claude Artifact uchun variant
build.js            # artifact.html → index.html
css/app.css         # dizayn tizimi (yorug'/qorong'i, RTL)
js/i18n.js          # 4 til
js/core.js          # sana, pul, saqlash qatlami (server / bulut / brauzer)
js/model.js         # narx, chegirma, balans, jadval, huquqlar, guruh kodi
js/ops.js           # hisob, to'lov, xarajat, ish haqi, tarix
js/ui.js            # umumiy komponentlar
js/pages-core.js    # bosh sahifa, murojaatlar, o'quvchilar
js/pages-edu.js     # guruhlar, kurslar, jadval, davomat
js/pages-fin.js     # moliya, xodimlar, hisobotlar, sozlamalar
js/pages-team.js    # suhbat va vazifalar
js/bot.js           # bot bilan ishlash (ilova tomoni)
js/import.js        # Excel / CSV import
js/seed.js          # dastlabki sozlash va demo ma'lumotlar
js/app.js           # kirish, rollar, menyu
server/index.js     # HTTP server, API, sessiyalar
server/store.js     # ombor: PostgreSQL / SQLite / JSON fayl
server/shared.js    # ilova mantiqini serverda qayta ishlatish
server/bot.js       # Albayan Telegram bot
tests/              # avtomatik testlar
```

Frontend fayllarni o'zgartirgandan keyin `node build.js`.

---

## 9. Zaxira va tiklash

- **Sozlamalar → Ma'lumotlar → Zaxira nusxa olish** — hamma narsa bitta JSON faylda.
- Serverli versiyada baza fayli `DATA_DIR` ichida (`albyana.json` yoki
  `albyana.db`). Uni ham nusxalab qo'ying.
- PostgreSQL ishlatsangiz: `pg_dump` bilan.
- Oyiga kamida bir marta zaxira oling va markaz kompyuteridan tashqarida saqlang.
- Zaxira faylida **haqiqiy o'quvchi ma'lumotlari** bor — uni repozitoriyaga
  qo'shmang (`.gitignore` bunga to'sqinlik qiladi).

---

## 10. Xavfsizlik

- `.env`, `data/` va zaxira fayllari `.gitignore` orqali chiqarib tashlangan.
- Parollar tasodifiy "tuz" bilan SHA-256 hash ko'rinishida saqlanadi va
  API javoblarida hech qachon qaytarilmaydi.
- Sessiya `HttpOnly` cookie'da; ishlab chiqarishda `Secure` bayrog'i bilan.
- O'zgarishlar tarixiga parol va maxfiy ma'lumot yozilmaydi.
- Telegram bot tokeni faqat serverda.

---

## 11. Nimalar hali yo'q

- SMS xabarnomalar, onlayn to'lov, fiskal chek
- O'quvchi va ota-ona uchun alohida veb-kabinet (bot buning o'rnini bosadi)
- Bir nechta filial

Tizimda bular bor deb ko'rsatuvchi ishlamaydigan tugmalar yo'q.

## 12. Brauzer mosligi

Chromium asosidagi brauzerlarda 360, 390 va 1320 px o'lchamlarda avtomatik
sinovdan o'tkazilgan. iPhone Safari va Android Chrome **haqiqiy qurilmada
sinalmagan** — ishlatishni boshlashdan oldin telefoningizda bir marta tekshiring.
