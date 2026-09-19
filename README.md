# Albyana — o'quv markazi ERP tizimi

Albyana o'quv markazini to'liq yuritish uchun veb-tizim: murojaatlardan tortib
o'quvchi, guruh, dars jadvali, davomat, to'lov, qarzdorlik, xarajat, ish haqi va
hisobotlargacha. Interfeys to'liq o'zbek tilida (lotin), valyuta — so'm,
vaqt mintaqasi — Asia/Tashkent.

Tizim kompyuterda ham, telefonda ham **barcha modullari bilan** ishlaydi:
telefondan o'quvchi qo'shish, guruhga yozish, davomat olish, to'lov qabul qilish
va hisobot yuklab olish mumkin.

---

## 1. Tez ishga tushirish

Tizim — oddiy statik veb-ilova. Hech qanday build yoki server talab qilmaydi.

```bash
git clone https://github.com/abdullohbohodirov96/albayan-oquv-markz-ERP.git
cd albayan-oquv-markz-ERP

# Istalgan statik server bilan oching:
npx serve .
# yoki
python3 -m http.server 8080
```

Brauzerda `http://localhost:8080` ni oching.

> `index.html` ni to'g'ridan-to'g'ri ikki marta bosib ochish ham ishlaydi,
> lekin ba'zi brauzerlar `file://` rejimida cheklovlar qo'yadi — server
> orqali ochish tavsiya etiladi.

### Birinchi kirish

| Login | Parol | Rol |
|---|---|---|
| `admin` | `1234` | Direktor |
| `manager` | `1234` | Administrator |
| `ustoz` | `1234` | O'qituvchi |
| `hisob` | `1234` | Buxgalter |

**Muhim:** bu parollar faqat sinov uchun. Haqiqiy ishni boshlashdan oldin
**Sozlamalar → Foydalanuvchilar** bo'limida har bir xodimga alohida login va
kuchli parol qo'ying, keraksiz sinov hisoblarini o'chiring. Tizim standart parol
o'zgartirilmagan bo'lsa, bosh sahifada ogohlantirish ko'rsatadi.

### Demo ma'lumotlar

Birinchi ochilishda tizimga namuna o'quvchi, guruh, to'lov va xarajatlar
yuklanadi — shunda ishlashini darhol ko'rasiz. Ular `demo` belgisi bilan
alohida saqlanadi. Haqiqiy ish oldidan:
**Sozlamalar → Ma'lumotlar → "Demo ma'lumotlarni o'chirish"**.

---

## 2. Ma'lumotlar qayerda saqlanadi

Tizim ikki rejimda ishlaydi:

1. **Bulut rejimi** — Claude Artifact sifatida joylashtirilganda, ma'lumotlar
   markazning umumiy bazasida saqlanadi: sahifa yangilansa ham, boshqa
   qurilmadan kirilsa ham ma'lumot joyida turadi.
2. **Mahalliy rejim** — oddiy hostingda ochilganda ma'lumotlar shu brauzerda
   saqlanadi (yuqorida "Faqat shu brauzerda" yozuvi ko'rinadi).

Ko'p foydalanuvchi bir bazaga ulanishi uchun serverli versiya kerak —
"Keyingi bosqich" bo'limiga qarang.

### Zaxira va tiklash

- **Sozlamalar → Ma'lumotlar → "Zaxira nusxa olish"** — barcha ma'lumot bitta
  JSON faylga tushadi.
- Zaxirani oyiga kamida bir marta oling va markaz kompyuteridan tashqarida
  (masalan, bulut diskda) saqlang.
- Tiklash: zaxira faylini `Sozlamalar → Ma'lumotlar` orqali qayta yuklash
  kerak bo'lganda tizim administratoriga bering. Zaxira fayl haqiqiy o'quvchi
  ma'lumotlarini o'z ichiga oladi — uni **hech qachon repozitoriyaga qo'shmang**.

---

## 3. Rollar va huquqlar

| Modul | Direktor | Administrator | O'qituvchi | Buxgalter |
|---|:--:|:--:|:--:|:--:|
| Bosh sahifa | ✓ | ✓ | ✓ | ✓ |
| Murojaatlar (CRM) | ✓ | ✓ | — | — |
| O'quvchilar | ✓ | ✓ | faqat o'z guruhi | ko'rish |
| Guruhlar / kurslar | ✓ | ✓ | faqat o'ziniki | ko'rish |
| Jadval | ✓ | ✓ | ko'rish | ko'rish |
| Davomat | ✓ | ✓ | o'z darslari | ko'rish |
| To'lov qabul qilish | ✓ | ✓ | — | ✓ |
| Qarzdorlik | ✓ | ✓ | — | ✓ |
| Xarajatlar | ✓ | — | — | ✓ |
| Ish haqi | ✓ | — | — | hisoblash |
| Ish haqini tasdiqlash | ✓ | — | — | — |
| Moliyaviy hisobotlar | ✓ | — | — | ✓ |
| Sozlamalar, foydalanuvchilar | ✓ | — | — | — |

Administrator markazning umumiy foydasi va ish haqi ma'lumotlarini ko'rmaydi.
O'qituvchi boshqa o'qituvchining guruhiga ham, moliyaga ham kira olmaydi.

---

## 4. Asosiy qoidalar (moliyaviy mantiq)

- **Oylik hisob** har bir faol a'zolik uchun oyiga **bitta** yaratiladi.
  Hisob ID si `inv_<a'zolik>_<oy>` ko'rinishida qat'iy — tugmani necha marta
  bossangiz ham takroriy hisob paydo bo'lmaydi.
- **Chegirma** summa yoki foizda beriladi, sababi va amal qilish davri
  saqlanadi, hisobni hech qachon manfiyga tushirmaydi.
- **To'lov** eng eski qarzdan boshlab taqsimlanadi; tizim taqsimotni taklif
  qiladi, administrator ko'radi va tasdiqlaydi. Ortiqcha pul **avans** bo'lib
  qoladi va keyingi oy hisobiga taklif qilinadi.
- **Takroriy bosish** yangi to'lov yaratmaydi: shakl ochilganda to'lovga
  yagona raqam beriladi va takroriy so'rov shu raqam bo'yicha rad etiladi.
- **Yashirin o'chirish yo'q.** To'lovni "bekor qilish" (xato yozuv) va
  "pul qaytarish" — alohida amallar; ikkalasi ham sabab, foydalanuvchi va sana
  bilan saqlanadi, yozuvning o'zi ro'yxatda qoladi.
- **Narx o'zgarishi** kelajakdagi oylarga tegishli: narx tarixi saqlanadi,
  yaratilgan eski hisoblar o'zgarmaydi.
- **Jadval to'qnashuvi**: bir xona yoki bir o'qituvchiga bir vaqtda ikki dars
  qo'yilmaydi. Bitta darsni ko'chirish boshqa haftalar jadvaliga tegmaydi.
- **Davomat**: belgilanmagan o'quvchi avtomatik "Kelmadi" hisoblanmaydi.
- **Ish haqi**: belgilangan oylik yoki o'qituvchi guruhlariga **haqiqatda
  tushgan puldan** foiz. Qaytarilgan pullar hisobdan chiqariladi. Tasdiqlangan
  davr keyingi o'zgarishlardan qayta hisoblanmaydi. To'langan ish haqi
  moliyaviy hisobotda **bir marta** xarajat bo'lib aks etadi.
- **"Sof pul oqimi"** = haqiqiy tushum − pul qaytarishlar − to'langan xarajatlar.
  Bu buxgalteriya foydasi emas.
- To'lov cheki — markazning **ichki** to'lov tasdig'i, fiskal chek emas.

---

## 5. Testlar

```bash
node tests/run-tests.js      # moliyaviy hisoblar va huquqlar (70 ta tekshiruv)
node tests/smoke.js          # brauzerda asosiy jarayonlar (Playwright kerak)
```

`tests/run-tests.js` quyidagilarni tekshiradi: oylik hisob takrorlanmasligi,
chegirma chegaralari, qisman to'lov, avans, taqsimlash tartibi, bekor qilish,
pul qaytarish, narx o'zgarishi, jadval to'qnashuvi, rollar matritsasi,
ish haqi (foiz/belgilangan, yopilgan davr, xarajatda bir marta), sof pul oqimi,
davomat va pul formatlash.

`tests/smoke.js` 1320px, 390px va 360px ekranlarda kirish, barcha sahifalar,
to'lov qabul qilish va o'quvchi qo'shish jarayonlarini o'tkazadi hamda
sahifaning chetga chiqishini o'lchaydi.

---

## 6. Loyiha tuzilishi

```
index.html          # to'liq hujjat (build.js hosil qiladi) — hosting uchun
artifact.html       # Claude Artifact uchun variant (skeletonsiz)
build.js            # artifact.html → index.html
css/app.css         # butun dizayn tizimi (yorug'/qorong'i mavzu)
js/core.js          # sana, pul, saqlash qatlami, yozuv navbati
js/model.js         # soha mantiqi: narx, chegirma, balans, jadval, huquqlar
js/ops.js           # amallar: hisob, to'lov, xarajat, ish haqi, tarix
js/ui.js            # umumiy komponentlar (modal, jadval, shakl, eksport)
js/pages-core.js    # bosh sahifa, murojaatlar, o'quvchilar
js/pages-edu.js     # guruhlar, kurslar, jadval, davomat
js/pages-fin.js     # moliya, xodimlar, hisobotlar, sozlamalar
js/seed.js          # dastlabki sozlash va demo ma'lumotlar
js/app.js           # kirish, rollar, menyu, yo'naltirish
tests/              # avtomatik testlar
```

CSS yoki markupni o'zgartirgandan keyin:

```bash
node build.js
```

---

## 7. Xavfsizlik

- `.env`, zaxira fayllari va haqiqiy o'quvchi ma'lumotlari `.gitignore` orqali
  repozitoriyadan chiqarilgan. Ularni **hech qachon commit qilmang**.
- Parollar ochiq saqlanmaydi: har bir foydalanuvchi uchun tasodifiy "tuz"
  va SHA-256 hash saqlanadi.
- O'zgarishlar tarixiga parol va maxfiy ma'lumot yozilmaydi.
- **Joriy versiyaning cheklovi:** huquqlar ilovaning o'zida tekshiriladi
  (alohida serverda emas). Bu bitta markaz ichida ishonchli xodimlar uchun
  yetarli, lekin tashqi shaxslarga havola bermang. Server tomonda tekshiruv
  kerak bo'lsa — keyingi bosqichga qarang.

---

## 8. Keyingi bosqich (serverli versiya)

Ko'p filial, tashqi foydalanuvchilar yoki qat'iy server tomon tekshiruvi kerak
bo'lganda tizim quyidagi stekka ko'chiriladi:

- Next.js + TypeScript
- PostgreSQL + Prisma (migratsiyalar bilan)
- Server tomonda rol tekshiruvi va tranzaksiyalar
- Tailwind CSS + shadcn/ui

Maxfiy kalitlar uchun `.env.example` faylidan nusxa oling:

```bash
cp .env.example .env
```

Telegram, SMS, onlayn to'lov va fiskal integratsiyalar birinchi versiyaga
kirmagan — tizimda ular bor deb ko'rsatuvchi soxta tugmalar ham yo'q.

---

## 9. Brauzer mosligi

Chromium asosidagi brauzerlarda (Chrome, Edge) 360px, 390px va 1320px
o'lchamlarda avtomatik sinovdan o'tkazilgan. iPhone Safari va Android Chrome
**haqiqiy qurilmada sinalmagan** — ishlatishni boshlashdan oldin telefoningizda
bir marta tekshirib chiqing va nosozlik topilsa xabar bering.
