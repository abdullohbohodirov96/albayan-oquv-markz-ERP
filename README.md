# AlBayan Cairo — o'quv markazi ERP tizimi

AlBayan Cairo arab tili o'quv markazini to'liq yuritish uchun veb-tizim: murojaatlardan
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
3. **Environment** bo'limida quyidagilarni kiriting (to'liq ro'yxat quyida).
4. Deploy tugagach havola beriladi — shu manzilga kiring.
   Birinchi kirish: login `admin`, parol `1234` (yoki siz kiritgan parol).
   Kirgandan keyin **Sozlamalar → Foydalanuvchilar** da parolni almashtiring.

### Muhit o'zgaruvchilari (Render → Environment)

Nusxa olib qo'yish uchun tayyor ro'yxat. `render.yaml` dagilar avtomatik
qo'yiladi — qo'lda faqat "siz kiritasiz" deb belgilanganlari kerak.

| Nomi | Qiymati | Kim qo'yadi |
|---|---|---|
| `NODE_ENV` | `production` | avtomatik |
| `APP_NAME` | `AlBayan Cairo` | avtomatik |
| `DATA_DIR` | `/var/data` | avtomatik |
| `BACKUP_DIR` | `/var/data/backups` | avtomatik |
| `BACKUP_KEEP` | `30` | avtomatik |
| `PG_POOL_MAX` | `4` | avtomatik |
| `PG_IDLE_MS` | `15000` | avtomatik |
| `PG_CONNECT_MS` | `15000` | avtomatik |
| `SESSION_MAX_AGE_DAYS` | `7` | avtomatik |
| `SEED_DIRECTOR_LOGIN` | `admin` | avtomatik |
| `DATABASE_URL` | **Internal Database URL** (pastga qarang) | **siz kiritasiz** |
| `SEED_DIRECTOR_PASSWORD` | bo'sh qoldiring → birinchi parol `1234` | **siz kiritasiz** |
| `TELEGRAM_BOT_TOKEN` | @BotFather bergan token | **siz kiritasiz** |
| `TELEGRAM_BOT_USERNAME` | bot nomi, masalan `albayan_bot` | **siz kiritasiz** |

`DATABASE_URL` ni umuman qo'ymasangiz ham ishlaydi — u holda ma'lumot
`/var/data` diskidagi faylda saqlanadi.

Vaqt mintaqasi hamma joyda **Asia/Tashkent (UTC+5)**: serverda ham, brauzerda ham.
Xodimning kompyuteri boshqa mintaqada bo'lsa ham sana bir xil bo'ladi — davomat,
to'lov va hisoblar Toshkent kuni bo'yicha yoziladi.

Zaxira nusxalar `/var/data/backups` papkasida, har kuni avtomatik olinadi
(oxirgi 30 tasi saqlanadi). Sozlamalar → Ma'lumotlar bo'limida qo'lda zaxira
olish va zaxiradan tiklash tugmalari bor.

**Muhim:** ma'lumotlar `/var/data` diskida saqlanadi. Bepul tarifda disk yo'q —
xizmat uxlab qolganda ma'lumot yo'qolishi mumkin. Haqiqiy ish uchun disk bor
tarifni (yoki `DATABASE_URL` orqali PostgreSQL ni) tanlang.

## 3. Ma'lumotlar bazasi

Tizim uchta rejimda ishlaydi — kodni o'zgartirish shart emas, faqat `DATABASE_URL`:

| Rejim | Qachon | Chegara |
|---|---|---|
| Fayl (standart) | `DATABASE_URL` bo'sh | Diskdagi joy (Render'da 1 GB) |
| PostgreSQL | `DATABASE_URL` berilgan | Xizmat tarifiga qarab |

### Ichki (Internal) va tashqi (External) manzil — qaysi biri qayerda

Render Postgres yaratsangiz, sizga **ikkita** manzil beradi. Ular bir xil bazaga
olib boradi, lekin turli yo'ldan:

| | Internal Database URL | External Database URL |
|---|---|---|
| Ko'rinishi | `postgresql://…@dpg-xxxxxxxx-a/albayan` (nuqtasiz, qisqa) | `postgresql://…@dpg-xxxxxxxx-a.frankfurt-postgres.render.com/albayan` |
| Qayerdan ishlaydi | faqat Render ichidan | butun internetdan |
| Tezligi | tezroq (bir xil markazda) | sekinroq |
| Trafik puli | bepul | hisoblanadi |
| SSL | kerak emas | shart (o'zi yoqiladi) |
| Qayerda ishlatiladi | **Render'dagi ilova — `DATABASE_URL` shu bo'lsin** | kompyuterdan tekshirish, ko'chirish, pgAdmin/DBeaver, sinov |

Qoida oddiy: **serverda ichki, kompyuterda tashqi.**

```bash
# Kompyuterdan ulanishni tekshirish (TASHQI manzil bilan):
DATABASE_URL="postgresql://…@dpg-xxxxxxxx-a.frankfurt-postgres.render.com/albayan" npm run check:db
```

Tekshiruv nima qiladi: manzilni tahlil qiladi, ulanadi, o'z yo'lida bitta yozuv
yozib-o'qib-o'chiradi va bazada nechta yozuv borligini aytadi. Parol hech qayerda
ko'rsatilmaydi va sizning ma'lumotingizga tegilmaydi.

SSL o'zi to'g'ri tanlanadi (ichki manzil va `localhost` uchun o'chiq, qolganiga
yoqiq). Kerak bo'lsa majburan belgilash mumkin: `PGSSLMODE=require` yoki
`PGSSLMODE=disable`.

### Neon (bepul PostgreSQL) ga ulash

1. [neon.tech](https://neon.tech) da ro'yxatdan o'ting → **New project** → nomi `albyana`,
   region sifatida **Europe (Frankfurt)** ni tanlang (O'zbekistonga eng yaqini).
2. **Connection string** bo'limida **Pooled connection** ni tanlang va nusxalang.
   U `...-pooler...` so'zi va oxirida `?sslmode=require` bilan bo'ladi.
3. Render → xizmat → **Environment** → `DATABASE_URL` ga shu manzilni qo'ying → **Save**.
4. Xizmat qayta ishga tushadi. Jadval o'zi yaratiladi, birinchi direktor hisobi ham.

Mavjud ma'lumotni ko'chirish: eski (fayl) rejimda **Sozlamalar → Ma'lumotlar →
Hozir zaxira olish** ni bosing, keyin `DATABASE_URL` ni qo'ying va yangi bazada
**Zaxiradan tiklash** orqali o'sha faylni yuklang.

### Hajm haqida

Bitta yozuv o'rtacha **~340 bayt** (o'lchangan). Ya'ni Neon'ning bepul **0.5 GB**
chegarasiga qariyb **1,5 million yozuv** sig'adi. 300 o'quvchili markaz yiliga
taxminan 15–20 ming yozuv to'playdi (hisoblar, to'lovlar, davomat, tarix) —
bu 0.5 GB da o'nlab yillarga yetadi. Sozlamalar → Ma'lumotlar bo'limida
bazaning joriy hajmi ko'rinib turadi.

Neon'ning bepul tarifida **hisoblash soati** ham cheklangan (oyiga 100 CU-soat).
Bunga ta'sir qiladigan ikki narsa sozlangan:

- ulanish bo'sh turganda yopiladi (`PG_IDLE_MS`);
- bot navbatchisi bo'sh navbat uchun bazani doimiy so'ramaydi: yangi xabar yoki
  administrator tasdig'i bo'lganda uyg'onadi, aks holda `BOT_IDLE_MS` (standart
  10 daqiqa) da bir marta tekshiradi. Bitta tekshiruv — 3 ta o'qish
  (`npm run test:bot-idle` shuni sanaydi), ya'ni bo'sh turganda soatiga ~18 ta.
  Ilgari har 5 soniyada tekshirilardi — soatiga ~1440 ta so'rov.

**Baribir o'lchanmagan:** bu sonlar mahalliy bazada sanaldi. Haqiqiy Neon'da
qancha CU-soat ketishi o'lchanmagan — "bepul tarif aniq yetadi" deb ayta olmaymiz.
Xavfsiz yo'l: Render'ning doimiy diski (tarifda bor, 1 GB) yoki Neon'ning pullik
tarifi. Neon'ni tanlasangiz, birinchi oy davomida uning "Usage" sahifasini kuzating.

Render'ning o'z Postgres'ini ishlatsangiz ham xuddi shunday: `Internal Database URL`
ni `DATABASE_URL` ga qo'ying, boshqa hech narsa o'zgartirmaysiz.

---

## 4. Albayan Telegram bot

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

1. **Telegram bot → Sozlamalar → Ulash kodlari** da o'quvchiga bir martalik
   6 belgili kod berasiz (masalan `7KQ3M2`).
2. O'quvchi botni ochadi va `/start` bosadi.
3. Bot kodni so'raydi. O'quvchi kodni yozadi — hisob darhol ulanadi.
   Kod bir marta ishlaydi va muddati o'tgach yaroqsiz bo'ladi.
4. Kodi bo'lmasa, `ismim` deb yozadi: bot ism va guruh kodini so'raydi,
   so'rov **Telegram bot → Holat** bo'limiga tushadi — siz tasdiqlaysiz.

**Ism bo'yicha avtomatik ulash yo'q** — bir xil ismli ikki o'quvchi
chalkashmasligi uchun.

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
- **To'lov muddati o'tganda eslatma** — necha kundan keyin va qancha vaqtda
  bir marta yuborilishi sozlamalarda.

Bir xil xabar ikki marta ketmaydi. Yuborilmasa, tizim uch marta qayta urinadi,
keyin "Yuborilmadi" deb belgilaydi — ro'yxatdan qo'lda qayta yuborish mumkin.

Har bir turdagi xabarni **Telegram bot → Sozlamalar** da o'chirib qo'yish mumkin.

Bot serveri ishlamayotgan bo'lsa, xabarlar navbatda saqlanadi va server
ishga tushgach yuboriladi — hech biri yo'qolmaydi.

---

## 5. Rollar va ruxsatlar

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

## 6. Sotuv voronkalari va Instagram lidlari

Murojaatlar bir nechta **voronkaga** bo'linadi — har birining o'z bosqichlari bor.
Tayyor holda uchtasi keladi: **Asosiy**, **Target reklama**, **Instagram**.
Yangi voronka qo'shish va bosqichlarini o'zgartirish:
**Sozlamalar → Sotuv voronkalari**.

Har bir voronkaning **qabul havolasi** (webhook) bor:

```
POST https://<sizning-manzil>/api/intake/<kalit>
Content-Type: application/json

{
  "name": "Zilola Karimova",
  "phone": "+998901234567",
  "text": "Instagram izohi: narxi qancha? 90 123 45 67",
  "source": "Instagram"
}
```

- `phone` bo'lmasa, tizim `text` ichidan telefon raqamni **o'zi ajratib oladi** —
  shuning uchun Instagram izohi yoki DM matnini to'g'ridan-to'g'ri yuborsangiz kifoya.
- Bir xil raqam shu voronkada allaqachon bo'lsa, takroriy murojaat yaratilmaydi.
- Havolani Meta Lead Ads, Zapier, Make yoki n8n'dagi "Webhook" amaliga qo'yasiz.
- Kalitni **Sozlamalar → Sotuv voronkalari → Qabul havolasi** dan olasiz,
  kerak bo'lsa bir bosishda yangilaysiz.

Bu nuqta faqat serverli versiyada ishlaydi va daqiqasiga 60 ta so'rov bilan cheklangan.

---

## 7. Tezkor qidiruv

Yuqoridagi qidiruv maydoniga yozishni boshlashingiz bilan takliflar chiqadi:
o'quvchi ismi, familiyasi, telefoni, ota-onasining ismi yoki raqami, guruh nomi
va kodi, murojaat, xodim — hammasi bir joyda. Bir harf yozsangiz ham filtrlanadi,
davom ettirsangiz ro'yxat torayadi. Strelkalar va Enter bilan tanlash mumkin.

---

## 8. Excel'dan import

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

## 9. Asosiy qoidalar (moliyaviy mantiq)

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

## 10. Testlar

```bash
npm test                 # 121 ta: moliya, huquqlar, jadval, import, bot kodlari
npm run test:browser     # brauzerda asosiy jarayonlar
npm run test:perf        # 2000 o'quvchi bilan tezlik (sekin bo'lsa yiqiladi)
npm run test:bot         # bot mantiqi — soxta qabul qiluvchi bilan
npm run test:backup      # zaxira va tiklash, vaqtinchalik bazada
npm run test:menu        # telefondagi menyu: ikonka/qator o'lchami, 4 til, screenshot
npm run test:perm        # tegishlilik: davomat, ish haqi tasdig'i, suhbat, vazifa
npm run test:bot-idle    # bot bo'sh turganda baza so'rovlari sanaladi
node tests/mobile-test.js       # 360 / 390 / 430 px
node tests/export-test.js       # Excel va CSV fayli haqiqatan yuklanadimi
node tests/ui-backup-test.js    # zaxira oynasi
node tests/lang-switch-test.js  # 4 til: aralash matn chiqmasligi
node tests/time-test.js         # Toshkent vaqti va "bugun" (turli mintaqalarda)
node tests/i18n-audit.js        # tarjima qamrovi

# Server ishlab turganda (alohida baza bilan):
node tests/security-test.js  <port> <parol>    # maxfiy fayllar, huquqlar, pul
node tests/perm-test.js      <port> <parol>    # yozuv kimga tegishli va holat o'zgarishi
node tests/advance-test.js   <port> <parol>    # avansdan qoplash
node tests/autoinvoice-test.js <port> <parol>  # avtomatik oylik hisoblar
node tests/pwa-test.js       <port> <parol>    # o'rnatish, kesh, internetsiz holat

# PostgreSQL (Neon yoki Render) bilan — TASHQI manzil kerak:
DATABASE_URL="postgresql://..." npm run check:db     # ulanish tekshiruvi
DATABASE_URL="postgresql://..." node tests/db-test.js
```

`npm test` tekshiradi: takrorlanmaydigan oylik hisob, chegirma chegaralari,
qisman to'lov, avans, taqsimlash tartibi, bekor qilish, pul qaytarish,
narx o'zgarishi, jadval to'qnashuvi, rollar va shaxsiy ruxsatlar, guruh kodi,
ish haqi (foiz/belgilangan, yopilgan davr, xarajatda bir marta),
sof pul oqimi, davomat, Excel import (turli tildagi va tartibdagi ustunlar),
botning bir martalik ulash kodi.

Testlar **haqiqiy bazaga tegmaydi**: har biri vaqtinchalik papkada yoki alohida
bazada ishlaydi. Bot sinovi haqiqiy Telegramga ulanmaydi — xabarlar soxta
qabul qiluvchiga boradi.

---

## 11. Loyiha tuzilishi

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

## 12. Zaxira va tiklash

- **Sozlamalar → Ma'lumotlar → Zaxira nusxa olish** — hamma narsa bitta JSON faylda.
- Serverli versiyada baza fayli `DATA_DIR` ichida (`albyana.json` yoki
  `albyana.db`). Uni ham nusxalab qo'ying.
- PostgreSQL ishlatsangiz: `pg_dump` bilan.
- Oyiga kamida bir marta zaxira oling va markaz kompyuteridan tashqarida saqlang.
- Zaxira faylida **haqiqiy o'quvchi ma'lumotlari** bor — uni repozitoriyaga
  qo'shmang (`.gitignore` bunga to'sqinlik qiladi).

---

## 13. Xavfsizlik

- `.env`, `data/` va zaxira fayllari `.gitignore` orqali chiqarib tashlangan.
- Parollar tasodifiy "tuz" bilan SHA-256 hash ko'rinishida saqlanadi va
  API javoblarida hech qachon qaytarilmaydi.
- Sessiya `HttpOnly` cookie'da; ishlab chiqarishda `Secure` bayrog'i bilan.
- O'zgarishlar tarixiga parol va maxfiy ma'lumot yozilmaydi.
- Telegram bot tokeni faqat serverda.

**Ruxsat nomi yetarli emas — tegishlilik ham tekshiriladi (server tomonida):**

- O'qituvchi faqat o'ziga biriktirilgan guruh davomatini yozadi, o'zgartiradi
  va o'chiradi. Begona guruh uchun PUT/DELETE 403 qaytaradi.
- Ish haqi: `payroll.manage` — faqat hisoblash va qoralama. Tasdiqlash yoki
  tasdiqlangan/to'langan yozuvga tegish uchun `payroll.approve` shart.
  Qoralamaga qaytarish va o'chirish orqali aylanib o'tib bo'lmaydi.
- Shaxsiy suhbatni faqat ishtirokchilari ko'radi — bootstrap, collection va
  `doc?path=chats/ID` uchun bir xil qoida. A'zolar ro'yxatini o'zgartirib
  begona suhbatga qo'shilib bo'lmaydi, eski xabarlarni o'chirib/tahrirlab
  bo'lmaydi, xabar muallifi serverdagi sessiyadan olinadi.
- Vazifani ijrochi, yaratgan odam va `task.assign` huquqi borlar ko'radi;
  begona vazifani ID orqali o'qib yoki o'zgartirib bo'lmaydi.
- Rad etilgan so'rov bazani o'zgartirmaydi (sinovlar shuni tekshiradi).

---

## 14. Nimalar hali yo'q

- SMS xabarnomalar, onlayn to'lov, fiskal chek
- O'quvchi va ota-ona uchun alohida veb-kabinet (bot buning o'rnini bosadi)
- Bir nechta filial

Tizimda bular bor deb ko'rsatuvchi ishlamaydigan tugmalar yo'q.

## 15. Brauzer mosligi

Chromium asosidagi brauzerlarda 360, 390 va 1320 px o'lchamlarda avtomatik
sinovdan o'tkazilgan. iPhone Safari va Android Chrome **haqiqiy qurilmada
sinalmagan** — ishlatishni boshlashdan oldin telefoningizda bir marta tekshiring.
