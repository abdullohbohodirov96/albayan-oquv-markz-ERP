/* Albyana ERP — 4 til: o'zbek (asos), rus, ingliz, arab (RTL)
   Tarjima DOM darajasida amalga oshadi: interfeys o'zbek tilida yoziladi,
   tanlangan tilga qarab matnlar almashtiriladi. */
(function (global) {
  'use strict';

  var LANGS = [
    { id: 'uz', label: 'O’zbekcha', short: 'UZ', dir: 'ltr' },
    { id: 'ru', label: 'Русский', short: 'RU', dir: 'ltr' },
    { id: 'en', label: 'English', short: 'EN', dir: 'ltr' },
    { id: 'ar', label: 'العربية', short: 'AR', dir: 'rtl' }
  ];

  /* uz -> [ru, en, ar] */
  var T = {
    /* --- Ochiq sayt --- */
    'Sayt uchun qisqa matn': ['Короткий текст для сайта', 'Short text for the website', 'نص قصير للموقع'],
    'Ochiq saytda markaz nomi tagida chiqadi.': [
      'Появится на сайте под названием центра.',
      'Shown on the public website under the centre name.',
      'يظهر في الموقع تحت اسم المركز.'],
    'Xabar keladigan Telegram chat raqami': [
      'Telegram-чат для уведомлений', 'Telegram chat for notifications', 'محادثة تيليجرام للإشعارات'],
    'Arab tili o’quv markazi': ['Центр арабского языка', 'Arabic language centre', 'مركز تعليم اللغة العربية'],
    'Kurslar': ['Курсы', 'Courses', 'الدورات'],
    'Ariza': ['Заявка', 'Apply', 'طلب'],
    'Kirish': ['Вход', 'Log in', 'تسجيل الدخول'],
    'Darsga yozilish': ['Записаться на урок', 'Enrol for a lesson', 'التسجيل في الدرس'],
    'Bog’lanish': ['Связаться', 'Contact', 'تواصل معنا'],
    'Yuborish': ['Отправить', 'Send', 'إرسال'],
    'Ismingiz': ['Ваше имя', 'Your name', 'اسمك'],
    'Qaysi kurs': ['Какой курс', 'Which course', 'أي دورة'],
    'Izoh (ixtiyoriy)': ['Комментарий (необязательно)', 'Comment (optional)', 'ملاحظة (اختياري)'],
    'Nega AlBayan Cairo?': ['Почему AlBayan Cairo?', 'Why AlBayan Cairo?', 'لماذا البيان القاهرة؟'],
    'Tanlanmagan': ['Не выбрано', 'Not selected', 'غير محدد'],
    'Yozilish': ['Записаться', 'Enrol', 'سجّل'],

    /* --- O'quvchi kabineti (shaxsiy kod) --- */
    'O’quvchi kabineti': ['Кабинет ученика', 'Student cabinet', 'صفحة الطالب'],
    'O’quvchimisiz?': ['Вы ученик?', 'Are you a student?', 'هل أنت طالب؟'],
    'Shaxsiy kod bilan kirish': ['Войти по личному коду', 'Enter with personal code', 'الدخول بالرمز الشخصي'],
    'Xodimlar kirishi': ['Вход для сотрудников', 'Staff login', 'دخول الموظفين'],
    'Shaxsiy kodingiz': ['Ваш личный код', 'Your personal code', 'رمزك الشخصي'],
    'Shaxsiy kod': ['Личный код', 'Personal code', 'الرمز الشخصي'],
    'Kod': ['Код', 'Code', 'الرمز'],
    'Ko’rish': ['Посмотреть', 'View', 'عرض'],
    'Guruhlarim': ['Мои группы', 'My groups', 'مجموعاتي'],
    'Kod 4 ta raqamdan iborat.': ['Код состоит из 4 цифр.', 'The code has 4 digits.', 'الرمز يتكون من ٤ أرقام.'],
    'Markaz bergan 4 xonali kodingizni kiriting — ma’lumotlaringiz shu yerda chiqadi.': [
      'Введите 4-значный код, выданный центром — здесь появятся ваши данные.',
      'Enter the 4-digit code given by the centre — your information will appear here.',
      'أدخل الرمز المكوّن من ٤ أرقام الذي منحه المركز — ستظهر بياناتك هنا.'],
    'Hozircha guruhga yozilmagansiz.': ['Вы пока не записаны в группу.', 'You are not enrolled in a group yet.', 'لم يتم تسجيلك في مجموعة بعد.'],
    'Hozircha davomat yozuvi yo’q.': ['Записей о посещаемости пока нет.', 'No attendance records yet.', 'لا توجد سجلات حضور بعد.'],
    'Keyingi to’lov': ['Следующий платёж', 'Next payment', 'الدفعة القادمة'],
    'Keyingi hisob': ['Следующий счёт', 'Next invoice', 'الفاتورة القادمة'],
    'Muddati o’tgan': ['Просрочено', 'Overdue', 'متأخر'],
    'Jami dars': ['Всего занятий', 'Lessons total', 'إجمالي الدروس'],
    'Qarz yo’q': ['Долга нет', 'No debt', 'لا يوجد دين'],
    'Yangi kod berish': ['Выдать новый код', 'Issue a new code', 'إصدار رمز جديد'],
    'Nusxalash': ['Копировать', 'Copy', 'نسخ'],
    'Kabinet havolasi: ': ['Ссылка на кабинет: ', 'Cabinet link: ', 'رابط الصفحة: '],
    'Kodni yangilash': ['Обновить код', 'Update the code', 'تحديث الرمز'],
    'Ism, telefon yoki kod': ['Имя, телефон или код', 'Name, phone or code', 'الاسم أو الهاتف أو الرمز'],
    /* --- Menyu va rollar --- */
    'Bosh sahifa': ['Главная', 'Dashboard', 'الرئيسية'],
    'Murojaatlar': ['Обращения', 'Leads', 'الطلبات'],
    'O’quvchilar': ['Ученики', 'Students', 'الطلاب'],
    'Guruhlar': ['Группы', 'Groups', 'المجموعات'],
    'Jadval': ['Расписание', 'Schedule', 'الجدول'],
    'Davomat': ['Посещаемость', 'Attendance', 'الحضور'],
    'Moliya': ['Финансы', 'Finance', 'المالية'],
    'Xodimlar': ['Сотрудники', 'Staff', 'الموظفون'],
    'Hisobotlar': ['Отчёты', 'Reports', 'التقارير'],
    'Sozlamalar': ['Настройки', 'Settings', 'الإعدادات'],
    'Suhbat': ['Чат', 'Chat', 'المحادثة'],
    'Vazifalar': ['Задачи', 'Tasks', 'المهام'],
    'Telegram bot': ['Telegram-бот', 'Telegram bot', 'بوت تيليجرام'],
    'Menyu': ['Меню', 'Menu', 'القائمة'],
    'Direktor': ['Директор', 'Director', 'المدير'],
    'Administrator': ['Администратор', 'Administrator', 'الإداري'],
    'O’qituvchi': ['Преподаватель', 'Teacher', 'المعلم'],
    'Buxgalter': ['Бухгалтер', 'Accountant', 'المحاسب'],
    'O’quv markazi': ['Учебный центр', 'Learning centre', 'المركز التعليمي'],
    'O’QUV MARKAZI': ['УЧЕБНЫЙ ЦЕНТР', 'LEARNING CENTRE', 'المركز التعليمي'],

    /* --- Umumiy tugmalar --- */
    'Saqlash': ['Сохранить', 'Save', 'حفظ'],
    'Saqlandi.': ['Сохранено.', 'Saved.', 'تم الحفظ.'],
    'Saqlanmoqda…': ['Сохранение…', 'Saving…', 'جارٍ الحفظ…'],
    'Bekor qilish': ['Отмена', 'Cancel', 'إلغاء'],
    'Bekor': ['Отменить', 'Cancel', 'إلغاء'],
    'O’chirish': ['Удалить', 'Delete', 'حذف'],
    'O’chirildi.': ['Удалено.', 'Deleted.', 'تم الحذف.'],
    'Tahrirlash': ['Редактировать', 'Edit', 'تعديل'],
    'Ochish': ['Открыть', 'Open', 'فتح'],
    'Yopish': ['Закрыть', 'Close', 'إغلاق'],
    'Qo’shish': ['Добавить', 'Add', 'إضافة'],
    'Tasdiqlash': ['Подтвердить', 'Confirm', 'تأكيد'],
    'Tasdiqlandi.': ['Подтверждено.', 'Confirmed.', 'تم التأكيد.'],
    'Chop etish': ['Печать', 'Print', 'طباعة'],
    'Tozalash': ['Сбросить', 'Clear', 'مسح'],
    'Bugun': ['Сегодня', 'Today', 'اليوم'],
    'Joriy oy': ['Текущий месяц', 'This month', 'الشهر الحالي'],
    'Qidirish': ['Поиск', 'Search', 'بحث'],
    'Qidiruv': ['Поиск', 'Search', 'بحث'],
    'Barchasi': ['Все', 'All', 'الكل'],
    'Kirish': ['Войти', 'Sign in', 'دخول'],
    'Chiqish': ['Выйти', 'Sign out', 'خروج'],
    'Qayta urinish': ['Повторить', 'Try again', 'إعادة المحاولة'],
    'Tafsilot': ['Подробно', 'Details', 'التفاصيل'],
    'Izoh': ['Комментарий', 'Note', 'ملاحظة'],
    'Holat': ['Статус', 'Status', 'الحالة'],
    'Sana': ['Дата', 'Date', 'التاريخ'],
    'Vaqt': ['Время', 'Time', 'الوقت'],
    'Summa': ['Сумма', 'Amount', 'المبلغ'],
    'Telefon': ['Телефон', 'Phone', 'الهاتف'],
    'Ism': ['Имя', 'First name', 'الاسم'],
    'Familiya': ['Фамилия', 'Last name', 'اللقب'],
    'Ism familiya': ['Имя и фамилия', 'Full name', 'الاسم الكامل'],
    'Nomi': ['Название', 'Name', 'الاسم'],
    'Tavsif': ['Описание', 'Description', 'الوصف'],
    'Kurs': ['Курс', 'Course', 'الدورة'],
    'Guruh': ['Группа', 'Group', 'المجموعة'],
    'Xona': ['Кабинет', 'Room', 'القاعة'],
    'Kategoriya': ['Категория', 'Category', 'الفئة'],
    'Manba': ['Источник', 'Source', 'المصدر'],
    'Mas’ul': ['Ответственный', 'Owner', 'المسؤول'],
    'Lavozim': ['Должность', 'Position', 'المنصب'],
    'Rol': ['Роль', 'Role', 'الدور'],
    'Login': ['Логин', 'Login', 'اسم المستخدم'],
    'Parol': ['Пароль', 'Password', 'كلمة المرور'],
    'Yuklanmoqda…': ['Загрузка…', 'Loading…', 'جارٍ التحميل…'],
    'Tizim yuklanmoqda…': ['Система загружается…', 'Loading…', 'جارٍ تحميل النظام…'],
    'Jadval yuklanmoqda…': ['Загрузка расписания…', 'Loading schedule…', 'جارٍ تحميل الجدول…'],
    'Xatolik yuz berdi.': ['Произошла ошибка.', 'Something went wrong.', 'حدث خطأ.'],
    'Sahifa topilmadi': ['Страница не найдена', 'Page not found', 'الصفحة غير موجودة'],
    'Ruxsat yo’q': ['Нет доступа', 'No access', 'لا توجد صلاحية'],
    'Sizda bu amal uchun ruxsat yo’q.': ['У вас нет прав на это действие.', 'You do not have permission for this action.', 'ليست لديك صلاحية لهذا الإجراء.'],
    'Nusxalash': ['Копировать', 'Copy', 'نسخ'],
    'Nusxalandi.': ['Скопировано.', 'Copied.', 'تم النسخ.'],
    'Yuborish': ['Отправить', 'Send', 'إرسال'],
    'Yuborildi.': ['Отправлено.', 'Sent.', 'تم الإرسال.'],
    'Hammasi joyida': ['Всё в порядке', 'All clear', 'كل شيء على ما يرام'],

    /* --- Holatlar --- */
    'Faol': ['Активный', 'Active', 'نشط'],
    'Arxiv': ['Архив', 'Archived', 'الأرشيف'],
    'Arxivlangan': ['Архивирован', 'Archived', 'مؤرشف'],
    'Arxivlash': ['В архив', 'Archive', 'أرشفة'],
    'Arxivdan qaytarish': ['Вернуть из архива', 'Restore', 'استرجاع'],
    'Vaqtincha to’xtatgan': ['Временно приостановлен', 'Paused', 'موقوف مؤقتاً'],
    'To’xtatgan': ['Приостановлен', 'Paused', 'موقوف'],
    'Vaqtincha to’xtatish': ['Приостановить', 'Pause', 'إيقاف مؤقت'],
    'Qayta faollashtirish': ['Активировать снова', 'Reactivate', 'إعادة التفعيل'],
    'Rejalashtirilgan': ['Запланирована', 'Planned', 'مخطط'],
    'Rejada': ['По плану', 'Planned', 'مجدول'],
    'Yakunlangan': ['Завершена', 'Finished', 'منتهية'],
    'Qarzsiz': ['Без долга', 'No debt', 'لا يوجد دين'],
    'To’langan': ['Оплачено', 'Paid', 'مدفوع'],
    'Kutilmoqda': ['Ожидается', 'Pending', 'قيد الانتظار'],
    'Muddati o’tgan': ['Просрочено', 'Overdue', 'متأخر'],
    'Bekor qilingan': ['Отменено', 'Cancelled', 'ملغى'],
    'Amalda': ['Действует', 'Active', 'ساري'],
    'Qoralama': ['Черновик', 'Draft', 'مسودة'],
    'Tasdiqlangan': ['Подтверждено', 'Approved', 'معتمد'],
    'Hisoblanmagan': ['Не рассчитано', 'Not calculated', 'غير محسوب'],
    'O’chirilgan': ['Отключён', 'Disabled', 'معطل'],

    /* --- Davomat --- */
    'Keldi': ['Присутствовал', 'Present', 'حاضر'],
    'Kelmadi': ['Отсутствовал', 'Absent', 'غائب'],
    'Kechikdi': ['Опоздал', 'Late', 'متأخر'],
    'Sababli': ['По уважительной', 'Excused', 'بعذر'],
    'Davomat olish': ['Отметить посещаемость', 'Take attendance', 'تسجيل الحضور'],
    'Davomat saqlandi.': ['Посещаемость сохранена.', 'Attendance saved.', 'تم حفظ الحضور.'],
    'Davomat olingan': ['Отмечено', 'Marked', 'تم التسجيل'],
    'Davomat olinmagan': ['Не отмечено', 'Not marked', 'لم يُسجل'],
    'Davomat kutilmoqda': ['Ожидает отметки', 'Awaiting marking', 'بانتظار التسجيل'],
    'Belgilanmagan': ['Не отмечен', 'Unmarked', 'غير محدد'],
    'Hammani "Keldi" deb belgilash': ['Отметить всех «Присутствовал»', 'Mark everyone present', 'تعليم الجميع حاضرين'],
    'Qatnashuv': ['Посещаемость', 'Attendance rate', 'نسبة الحضور'],
    'Dars sanasi': ['Дата урока', 'Lesson date', 'تاريخ الدرس'],
    'Dars': ['Урок', 'Lesson', 'الدرس'],
    'Darslar': ['Уроки', 'Lessons', 'الدروس'],
    'Bugungi darslar': ['Уроки на сегодня', 'Today’s lessons', 'دروس اليوم'],
    'Dars yo’q': ['Уроков нет', 'No lessons', 'لا توجد دروس'],
    'Dars jadvali': ['Расписание занятий', 'Class schedule', 'جدول الحصص'],
    'Darsni bekor qilish': ['Отменить урок', 'Cancel lesson', 'إلغاء الدرس'],
    'Darsni ko’chirish': ['Перенести урок', 'Move lesson', 'نقل الدرس'],
    'Ko’chirish': ['Перенести', 'Move', 'نقل'],

    /* --- To'lov --- */
    'To’lov': ['Платёж', 'Payment', 'الدفعة'],
    'To’lovlar': ['Платежи', 'Payments', 'المدفوعات'],
    'To’lov qabul qilish': ['Принять платёж', 'Take payment', 'استلام دفعة'],
    'To’lov qabul qilindi.': ['Платёж принят.', 'Payment recorded.', 'تم استلام الدفعة.'],
    'To’lovni tuzatish': ['Исправить платёж', 'Correct payment', 'تصحيح الدفعة'],
    'To’lovni bekor qilish': ['Отменить платёж', 'Void payment', 'إلغاء الدفعة'],
    'To’lov bekor qilindi.': ['Платёж отменён.', 'Payment voided.', 'تم إلغاء الدفعة.'],
    'To’lov usuli': ['Способ оплаты', 'Payment method', 'طريقة الدفع'],
    'To’lovlar tarixi': ['История платежей', 'Payment history', 'سجل المدفوعات'],
    'To’lov cheki': ['Чек об оплате', 'Payment receipt', 'إيصال الدفع'],
    'Pul qaytarish': ['Возврат средств', 'Refund', 'استرداد'],
    'Pul qaytarildi.': ['Средства возвращены.', 'Refunded.', 'تم الاسترداد.'],
    'Qaytarish': ['Возврат', 'Refund', 'استرداد'],
    'Qaytarilgan': ['Возвращено', 'Refunded', 'مُسترد'],
    'Naqd': ['Наличные', 'Cash', 'نقداً'],
    'Karta': ['Карта', 'Card', 'بطاقة'],
    'Bank o’tkazmasi': ['Банковский перевод', 'Bank transfer', 'تحويل بنكي'],
    'Usul': ['Способ', 'Method', 'الطريقة'],
    'Chek': ['Чек', 'Receipt', 'الإيصال'],
    'Qarz': ['Долг', 'Debt', 'الدين'],
    'Qarzdorlik': ['Задолженность', 'Debt', 'المديونية'],
    'Qarzdorlar': ['Должники', 'Debtors', 'المدينون'],
    'Qarzdor o’quvchilar': ['Ученики с долгом', 'Students in debt', 'الطلاب المدينون'],
    'Avans': ['Аванс', 'Credit', 'رصيد مقدم'],
    'Asos': ['База', 'Base', 'الأساس'],
    'Chegirma': ['Скидка', 'Discount', 'الخصم'],
    'Chegirmasiz': ['Без скидки', 'No discount', 'بدون خصم'],
    'Chegirma turi': ['Тип скидки', 'Discount type', 'نوع الخصم'],
    'Chegirma sababi': ['Причина скидки', 'Discount reason', 'سبب الخصم'],
    'Chegirma miqdori': ['Размер скидки', 'Discount amount', 'قيمة الخصم'],
    'Hisob': ['Счёт', 'Invoice', 'الفاتورة'],
    'Hisoblangan': ['Начислено', 'Charged', 'المستحق'],
    'Hisoblangan to’lovlar': ['Начисления', 'Charges', 'المستحقات'],
    'Hisoblangan o’quv to’lovi': ['Начисленная оплата за обучение', 'Tuition charged', 'الرسوم المستحقة'],
    'Yig’ilgan': ['Собрано', 'Collected', 'المحصّل'],
    'Qolgan': ['Остаток', 'Remaining', 'المتبقي'],
    'Qoldiq': ['Остаток', 'Remaining', 'المتبقي'],
    'Muddat': ['Срок', 'Due', 'الاستحقاق'],
    'Xarajat': ['Расход', 'Expense', 'المصروف'],
    'Xarajatlar': ['Расходы', 'Expenses', 'المصروفات'],
    'Xarajat qo’shish': ['Добавить расход', 'Add expense', 'إضافة مصروف'],
    'Jami xarajat': ['Всего расходов', 'Total expenses', 'إجمالي المصروفات'],
    'Ish haqi': ['Зарплата', 'Payroll', 'الرواتب'],
    'Hisoblangan ish haqi': ['Начисленная зарплата', 'Payroll accrued', 'الرواتب المستحقة'],
    'Ish haqini to’lash': ['Выплатить зарплату', 'Pay salary', 'صرف الراتب'],
    'Belgilangan oylik': ['Фиксированный оклад', 'Fixed salary', 'راتب ثابت'],
    'Tushumdan foiz': ['Процент от выручки', 'Percent of revenue', 'نسبة من الإيراد'],
    'Haqiqiy tushum': ['Фактическая выручка', 'Actual revenue', 'الإيراد الفعلي'],
    'Bugungi tushum': ['Выручка за сегодня', 'Revenue today', 'إيراد اليوم'],
    'Sof pul oqimi': ['Чистый денежный поток', 'Net cash flow', 'صافي التدفق النقدي'],
    'Qabul qilingan': ['Принято', 'Received', 'المستلم'],
    'Qabul qilish': ['Принять', 'Accept', 'قبول'],
    'Avtomatik taqsimlash': ['Распределить автоматически', 'Distribute automatically', 'توزيع تلقائي'],
    'Qaysi hisoblarga yozilsin': ['На какие счета зачесть', 'Apply to which invoices', 'على أي فواتير تُحتسب'],

    /* --- O'quvchi / guruh --- */
    'O’quvchi': ['Ученик', 'Student', 'الطالب'],
    'O’quvchi qo’shish': ['Добавить ученика', 'Add student', 'إضافة طالب'],
    'Yangi o’quvchi': ['Новый ученик', 'New student', 'طالب جديد'],
    'O’quvchini tahrirlash': ['Редактировать ученика', 'Edit student', 'تعديل الطالب'],
    'Faol o’quvchilar': ['Активные ученики', 'Active students', 'الطلاب النشطون'],
    'Faol guruhlar': ['Активные группы', 'Active groups', 'المجموعات النشطة'],
    'Guruh ochish': ['Создать группу', 'Create group', 'إنشاء مجموعة'],
    'Yangi guruh': ['Новая группа', 'New group', 'مجموعة جديدة'],
    'Guruhni tahrirlash': ['Редактировать группу', 'Edit group', 'تعديل المجموعة'],
    'Guruhga yozish': ['Записать в группу', 'Enrol in group', 'تسجيل في مجموعة'],
    'Guruhdan chiqarish': ['Исключить из группы', 'Remove from group', 'إخراج من المجموعة'],
    'Guruh kodi': ['Код группы', 'Group code', 'رمز المجموعة'],
    'Guruh nomi': ['Название группы', 'Group name', 'اسم المجموعة'],
    'Guruhlar bandligi': ['Заполненность групп', 'Group capacity', 'إشغال المجموعات'],
    'Dars kunlari': ['Дни занятий', 'Class days', 'أيام الدروس'],
    'Boshlanish vaqti': ['Время начала', 'Start time', 'وقت البدء'],
    'Tugash vaqti': ['Время окончания', 'End time', 'وقت الانتهاء'],
    'Boshlanish sanasi': ['Дата начала', 'Start date', 'تاريخ البدء'],
    'Boshlanish': ['Начало', 'From', 'من'],
    'Tugash': ['Окончание', 'To', 'إلى'],
    'O’quvchilar limiti': ['Лимит учеников', 'Student limit', 'الحد الأقصى للطلاب'],
    'Oylik narx (so’m)': ['Цена за месяц (сум)', 'Monthly fee (UZS)', 'الرسوم الشهرية (سوم)'],
    'Oylik narx': ['Цена за месяц', 'Monthly fee', 'الرسوم الشهرية'],
    'Ota-ona': ['Родитель', 'Parent', 'ولي الأمر'],
    'Ota-ona telefoni': ['Телефон родителя', 'Parent phone', 'هاتف ولي الأمر'],
    'Ota-ona / vasiy ismi': ['Имя родителя / опекуна', 'Parent / guardian name', 'اسم ولي الأمر'],
    'O’quvchi telefoni': ['Телефон ученика', 'Student phone', 'هاتف الطالب'],
    'Tug’ilgan sana (ixtiyoriy)': ['Дата рождения (необязательно)', 'Date of birth (optional)', 'تاريخ الميلاد (اختياري)'],
    'Tug’ilgan sana': ['Дата рождения', 'Date of birth', 'تاريخ الميلاد'],
    'Umumiy': ['Общее', 'Overview', 'عام'],
    'Umumiy ma’lumot': ['Общая информация', 'Overview', 'معلومات عامة'],
    'Guruhsiz': ['Без группы', 'No group', 'بدون مجموعة'],
    'Kirgan': ['Записан', 'Joined', 'تاريخ الالتحاق'],
    'Chiqqan': ['Выбыл', 'Left', 'تاريخ المغادرة'],
    'Guruhga kirgan sana': ['Дата записи в группу', 'Date joined group', 'تاريخ الالتحاق بالمجموعة'],
    'Kurslar va xonalar': ['Курсы и кабинеты', 'Courses and rooms', 'الدورات والقاعات'],
    'Kurslar': ['Курсы', 'Courses', 'الدورات'],
    'Xonalar': ['Кабинеты', 'Rooms', 'القاعات'],
    'Yangi kurs': ['Новый курс', 'New course', 'دورة جديدة'],
    'Yangi xona': ['Новый кабинет', 'New room', 'قاعة جديدة'],
    'Kurs nomi': ['Название курса', 'Course name', 'اسم الدورة'],
    'Xona nomi': ['Название кабинета', 'Room name', 'اسم القاعة'],
    'Sig’imi': ['Вместимость', 'Capacity', 'السعة'],
    'Dars davomiyligi (daqiqa)': ['Длительность урока (мин.)', 'Lesson length (min)', 'مدة الدرس (دقيقة)'],

    /* --- Murojaatlar --- */
    'Murojaat qo’shish': ['Добавить обращение', 'Add lead', 'إضافة طلب'],
    'Yangi murojaat': ['Новое обращение', 'New lead', 'طلب جديد'],
    'Yangi': ['Новое', 'New', 'جديد'],
    'Bog’lanildi': ['Связались', 'Contacted', 'تم التواصل'],
    'Sinov darsiga yozildi': ['Записан на пробный урок', 'Booked trial lesson', 'حجز درساً تجريبياً'],
    'O’quvchi bo’ldi': ['Стал учеником', 'Enrolled', 'أصبح طالباً'],
    'Rad etdi': ['Отказался', 'Declined', 'رفض'],
    'O’quvchiga': ['В ученики', 'To student', 'إلى طالب'],
    'Qiziqqan kurs': ['Интересующий курс', 'Course of interest', 'الدورة المطلوبة'],
    'Qayerdan kelgan': ['Откуда узнал', 'How they found us', 'مصدر المعرفة'],
    'Keyingi bog’lanish sanasi': ['Дата следующего контакта', 'Next contact date', 'تاريخ التواصل القادم'],
    'Keyingi aloqa': ['Следующий контакт', 'Next contact', 'التواصل القادم'],
    'Mas’ul administrator': ['Ответственный администратор', 'Responsible administrator', 'الإداري المسؤول'],
    'Bog’lanish kerak': ['Нужно связаться', 'To contact', 'بحاجة للتواصل'],
    'Import qilish': ['Импорт', 'Import', 'استيراد'],
    'Excel’dan import': ['Импорт из Excel', 'Import from Excel', 'استيراد من Excel'],

    /* --- Hisobot --- */
    'Shu hafta': ['Эта неделя', 'This week', 'هذا الأسبوع'],
    'Shu oy': ['Этот месяц', 'This month', 'هذا الشهر'],
    'Oraliq': ['Период', 'Range', 'فترة'],
    'Jami': ['Всего', 'Total', 'الإجمالي'],
    'Jami qarzdorlik': ['Всего задолженность', 'Total debt', 'إجمالي الديون'],
    'Aylanish darajasi': ['Конверсия', 'Conversion rate', 'نسبة التحويل'],
    'Jami murojaat': ['Всего обращений', 'Total leads', 'إجمالي الطلبات'],
    'O’quvchiga aylandi': ['Стали учениками', 'Converted', 'تحولوا إلى طلاب'],
    'Bandlik': ['Заполненность', 'Occupancy', 'الإشغال'],
    'Kiritgan': ['Внёс', 'Added by', 'أدخله'],
    'Kiritgan xodim': ['Внёс сотрудник', 'Entered by', 'أدخله الموظف'],
    'Qabul qildi': ['Принял', 'Received by', 'استلمه'],

    /* --- Sozlamalar --- */
    'Markaz': ['Центр', 'Centre', 'المركز'],
    'Markaz nomi': ['Название центра', 'Centre name', 'اسم المركز'],
    'Markaz ma’lumotlari': ['Данные центра', 'Centre details', 'بيانات المركز'],
    'Manzil': ['Адрес', 'Address', 'العنوان'],
    'Ish boshlanishi': ['Начало работы', 'Opens at', 'بداية الدوام'],
    'Ish tugashi': ['Конец работы', 'Closes at', 'نهاية الدوام'],
    'Foydalanuvchilar': ['Пользователи', 'Users', 'المستخدمون'],
    'Foydalanuvchi qo’shish': ['Добавить пользователя', 'Add user', 'إضافة مستخدم'],
    'Yangi foydalanuvchi': ['Новый пользователь', 'New user', 'مستخدم جديد'],
    'Xarajat kategoriyalari': ['Категории расходов', 'Expense categories', 'فئات المصروفات'],
    'Yangi kategoriya': ['Новая категория', 'New category', 'فئة جديدة'],
    'Ma’lumotlar': ['Данные', 'Data', 'البيانات'],
    'O’zgarishlar tarixi': ['История изменений', 'Change history', 'سجل التغييرات'],
    'Muhim harakatlar tarixi': ['История важных действий', 'Audit log', 'سجل الإجراءات المهمة'],
    'Zaxira nusxa': ['Резервная копия', 'Backup', 'نسخة احتياطية'],

    /* --- to'liq iboralar (aralash matn chiqmasligi uchun) --- */
    'Sanani tanlang': ['Выберите дату', 'Choose a date', 'اختر التاريخ'],
    'Vaqtni tanlang': ['Выберите время', 'Choose a time', 'اختر الوقت'],
    'Oyni tanlang': ['Выберите месяц', 'Choose a month', 'اختر الشهر'],
    'Voronka nima?': ['Что такое воронка?', 'What is a funnel?', 'ما هي قِمع المبيعات؟'],
    'Dars (daq.)': ['Урок (мин.)', 'Lesson (min)', 'الدرس (دقيقة)'],
    'Faol a’zoliklar': ['Активные участия', 'Active memberships', 'العضويات النشطة'],
    'Xarajat yo’q.': ['Расходов нет.', 'No expenses.', 'لا توجد مصروفات.'],
    'Hisoblash': ['Расчёт', 'Calculation', 'الاحتساب'],
    '"Sof pul oqimi"': ['«Чистый денежный поток»', '“Net cash flow”', '«صافي التدفق النقدي»'],
    'Faol guruhlar:': ['Активные группы:', 'Active groups:', 'المجموعات النشطة:'],
    'Telefon:': ['Телефон:', 'Phone:', 'الهاتف:'],
    'Vazifa yo’q': ['Задач нет', 'No tasks', 'لا توجد مهام'],
    'Hisoblangan (jami)': ['Начислено (всего)', 'Charged (total)', 'المحتسب (الإجمالي)'],
    'Karta + bank': ['Карта + банк', 'Card + bank', 'بطاقة + بنك'],
    'To’langan xarajatlar': ['Оплаченные расходы', 'Paid expenses', 'المصروفات المدفوعة'],
    'Ish haqi hisoblanmagan.': ['Зарплата не начислена.', 'Payroll not calculated.', 'لم تُحتسب الرواتب.'],
    'Umumiy suhbat': ['Общий чат', 'General chat', 'المحادثة العامة'],
    'Yangi suhbat': ['Новый чат', 'New chat', 'محادثة جديدة'],
    'Familiya, ism': ['Фамилия, имя', 'Surname, first name', 'اللقب والاسم'],
    'Ota-ona / vasiy': ['Родитель / опекун', 'Parent / guardian', 'ولي الأمر'],
    'Ota-ona / vasiy ismi (ixtiyoriy)': ['Имя родителя / опекуна (необязательно)', 'Parent / guardian name (optional)', 'اسم ولي الأمر (اختياري)'],
    'Ota-ona telefoni (ixtiyoriy)': ['Телефон родителя (необязательно)', 'Parent phone (optional)', 'هاتف ولي الأمر (اختياري)'],
    'Hisoblangan o’quv to’lovlari': ['Начисленная плата за обучение', 'Charged tuition fees', 'الرسوم الدراسية المحتسبة'],
    'Qarzi yo’q': ['Долга нет', 'No debt', 'لا يوجد دين'],
    'Chegirma boshlanishi': ['Начало скидки', 'Discount starts', 'بداية الخصم'],
    'Chegirma tugashi (ixtiyoriy)': ['Окончание скидки (необязательно)', 'Discount ends (optional)', 'نهاية الخصم (اختياري)'],
    'To’lov muddati (oyning kuni)': ['Срок оплаты (день месяца)', 'Payment due (day of month)', 'موعد السداد (يوم الشهر)'],
    'Qo’shimcha: sana, to’lov usuli, izoh va taqsimot':
      ['Дополнительно: дата, способ оплаты, примечание и распределение',
        'More: date, payment method, note and allocation',
        'إضافي: التاريخ وطريقة الدفع والملاحظة والتوزيع'],
    'Parollar va maxfiy ma’lumotlar tarixga yozilmaydi.':
      ['Пароли и конфиденциальные данные в историю не записываются.',
        'Passwords and secrets are never written to the log.',
        'لا تُسجَّل كلمات المرور والبيانات السرية في السجل.'],
    'Tasdiqlangan davr qayta hisoblanmaydi.':
      ['Утверждённый период не пересчитывается.', 'An approved period is not recalculated.', 'لا تُعاد المحاسبة للفترة المعتمدة.'],
    'Xodimga topshiriq bering — muddati va holati kuzatiladi.':
      ['Поставьте сотруднику задачу — срок и статус отслеживаются.',
        'Give a staff member a task — the due date and status are tracked.',
        'كلّف موظفًا بمهمة — يُتابَع موعدها وحالتها.'],
    'Har bir faol a’zolik uchun oyiga bitta hisob yaratiladi. Tugmani qayta bossangiz ham takroriy hisob paydo bo’lmaydi.':
      ['Для каждого активного участия создаётся один счёт в месяц. Повторное нажатие кнопки не создаст дубликат.',
        'One invoice per month is created for each active membership. Pressing the button again creates no duplicate.',
        'تُنشأ فاتورة واحدة شهريًا لكل عضوية نشطة. الضغط مرة أخرى لا يُنشئ نسخة مكررة.'],
    'Belgilangan oylik — to’g’ridan-to’g’ri summa. Foiz — o’qituvchining guruhlariga shu oyda haqiqatda tushgan puldan foiz.':
      ['Фиксированная зарплата — прямая сумма. Процент — от денег, реально поступивших в этом месяце по группам преподавателя.',
        'Fixed salary is a direct amount. Percentage is taken from the money actually received this month for the teacher’s groups.',
        'الراتب الثابت مبلغ مباشر. النسبة تُحسب من المال المستلم فعليًا هذا الشهر لمجموعات المعلم.'],
    'O’qituvchi roli uchun majburiy — u faqat shu xodimning guruhlarini ko’radi.':
      ['Обязательно для роли преподавателя — он видит только группы этого сотрудника.',
        'Required for the teacher role — they only see that staff member’s groups.',
        'إلزامي لدور المعلم — لا يرى سوى مجموعات هذا الموظف.'],
    'O’quvchi botga /start bosib, ism-familiyasi va guruh kodini yozganda shu yerda paydo bo’ladi.':
      ['Появится здесь, когда ученик нажмёт /start в боте и введёт имя и код группы.',
        'It appears here when a student presses /start in the bot and enters their name and group code.',
        'يظهر هنا عندما يضغط الطالب /start في البوت ويكتب اسمه ورمز مجموعته.'],
    'O’quvchilar botga /start bosishi kerak.':
      ['Ученики должны нажать /start в боте.', 'Students need to press /start in the bot.', 'على الطلاب الضغط على /start في البوت.'],
    'O’quvchi botda shu kodni yozadi. Masalan: B020':
      ['Ученик вводит этот код в боте. Например: B020', 'The student types this code in the bot. For example: B020', 'يكتب الطالب هذا الرمز في البوت. مثال: B020'],
    'xlsx, xls, csv, tsv — ustunlar tartibi muhim emas, tizim o’zi taniydi.':
      ['xlsx, xls, csv, tsv — порядок столбцов не важен, система распознаёт сама.',
        'xlsx, xls, csv, tsv — the column order does not matter, the system recognises them.',
        'xlsx و xls و csv و tsv — ترتيب الأعمدة غير مهم، النظام يتعرّف عليها.'],
    'Tizimda demo o’quvchi, guruh, to’lov va xarajatlar bor. Haqiqiy ish boshlashdan oldin ularni o’chiring — haqiqiy ma’lumotlaringizga tegmaydi.':
      ['В системе есть демо-ученики, группы, платежи и расходы. Удалите их перед началом реальной работы — ваших настоящих данных это не коснётся.',
        'The system holds demo students, groups, payments and expenses. Delete them before starting real work — your real data is untouched.',
        'يحتوي النظام على طلاب ومجموعات ومدفوعات ومصروفات تجريبية. احذفها قبل العمل الحقيقي — لن تُمسّ بياناتك الحقيقية.'],
    'Avtomatik yaratish faqat server rejimida ishlaydi. Hozir hisoblarni "Moliya → Hisoblangan to’lovlar" bo’limidan qo’lda yarating.':
      ['Автоматическое создание работает только в серверном режиме. Пока создавайте счета вручную в разделе «Финансы → Начисления».',
        'Automatic creation works only in server mode. For now create invoices manually in Finance → Invoices.',
        'الإنشاء التلقائي يعمل في وضع الخادم فقط. أنشئ الفواتير يدويًا الآن من المالية ← الفواتير.'],
    'iPhone’da: Safari → "Ulashish" → "Bosh ekranga qo’shish". Android’da: Chrome menyusi → "Ilovani o’rnatish". Internet uzilsa, ochilgan ma’lumotlarni ko’rish mumkin, lekin to’lov va boshqa yozuvlar saqlanmaydi — tizim buni ochiq aytadi.':
      ['На iPhone: Safari → «Поделиться» → «На экран Домой». На Android: меню Chrome → «Установить приложение». При потере интернета открытые данные видны, но платежи и другие записи не сохраняются — система об этом прямо сообщает.',
        'On iPhone: Safari → Share → Add to Home Screen. On Android: Chrome menu → Install app. With no internet you can view loaded data, but payments and other records are not saved — the system says so plainly.',
        'على iPhone: Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية. على Android: قائمة Chrome ← تثبيت التطبيق. عند انقطاع الإنترنت يمكن عرض البيانات المحمّلة، لكن المدفوعات والسجلات الأخرى لا تُحفظ — والنظام يوضّح ذلك.'],
    'Har bir mijoz oqimi uchun alohida yo’l: masalan "Asosiy" (o’zi kelganlar),':
      ['Отдельный путь для каждого потока клиентов: например «Основной» (пришли сами),',
        'A separate path for each customer flow: for example “Main” (walk-ins),',
        'مسار منفصل لكل تدفق عملاء: مثل «الأساسي» (من يأتون بأنفسهم)،'],
    '"Target reklama" va "Instagram". Har birining bosqichlari boshqacha bo’lishi mumkin.':
      ['«Таргетированная реклама» и «Instagram». Этапы у каждого могут отличаться.',
        '“Targeted ads” and “Instagram”. Each can have different stages.',
        '«الإعلانات المستهدفة» و«Instagram». قد تختلف مراحل كل منها.'],
    /* --- Zaxira, tiklash, o'rnatish va bot (yangi) --- */
    'Barcha ma’lumot bitta faylga yig’iladi. Fayl serverda ham saqlanadi, kompyuteringizga ham yuklab olsangiz bo’ladi.':
      ['Все данные собираются в один файл. Файл хранится и на сервере, и его можно скачать на компьютер.',
        'All data is collected into one file. It is kept on the server and can also be downloaded to your computer.',
        'تُجمع كل البيانات في ملف واحد. يُحفظ الملف على الخادم ويمكن تنزيله إلى حاسوبك.'],
    'Holat yuklanmoqda…': ['Загрузка состояния…', 'Loading status…', 'جارٍ تحميل الحالة…'],
    'Hozir zaxira olish': ['Сделать копию сейчас', 'Back up now', 'أنشئ نسخة الآن'],
    'Zaxiradan tiklash': ['Восстановить из копии', 'Restore from backup', 'الاستعادة من نسخة احتياطية'],
    'Server rejimida zaxira har kuni avtomatik olinadi va oxirgi 30 tasi saqlanadi. Xato bo’lsa direktorga suhbat orqali xabar boradi.':
      ['В серверном режиме копия создаётся ежедневно, хранятся последние 30. При ошибке директор получает сообщение в чате.',
        'In server mode a backup is made every day and the last 30 are kept. If it fails, the director gets a chat message.',
        'في وضع الخادم تُنشأ نسخة يوميًا ويُحتفظ بآخر 30 نسخة. وعند الفشل تصل رسالة إلى المدير في المحادثة.'],
    'Oxirgi zaxira olinmadi. ': ['Последняя копия не создана. ', 'The last backup failed. ', 'لم تُنشأ النسخة الأخيرة. '],
    'Hali zaxira olinmagan.': ['Копия ещё не создавалась.', 'No backup yet.', 'لم تُنشأ نسخة بعد.'],
    'Bu rejimda ma’lumot shu brauzerda saqlanadi — zaxirani qo’lda oling va xavfsiz joyda saqlang.':
      ['В этом режиме данные хранятся в браузере — сделайте копию вручную и держите её в надёжном месте.',
        'In this mode data stays in this browser — make a backup yourself and keep it somewhere safe.',
        'في هذا الوضع تُحفظ البيانات في المتصفح — أنشئ نسخة يدويًا واحفظها في مكان آمن.'],
    'Tiklash hozirgi ma’lumotlarni zaxiradagi holat bilan almashtiradi. Avval fayl tekshiriladi va o’zgarish ko’rsatiladi.':
      ['Восстановление заменит текущие данные состоянием из копии. Сначала файл проверяется и показываются изменения.',
        'Restoring replaces the current data with the state in the backup. The file is checked first and the changes are shown.',
        'الاستعادة تستبدل البيانات الحالية بما في النسخة. يُفحص الملف أولًا وتُعرض التغييرات.'],
    'Serverdagi zaxira': ['Копия на сервере', 'Backup on the server', 'نسخة على الخادم'],
    'Serverdagi zaxiralardan tanlang…': ['Выберите копию на сервере…', 'Choose a backup on the server…', 'اختر نسخة على الخادم…'],
    'Yoki kompyuteringizdagi fayl': ['Или файл с вашего компьютера', 'Or a file from your computer', 'أو ملف من حاسوبك'],
    'Tiklangandan keyin nima bo’ladi:': ['Что будет после восстановления:', 'What happens after restoring:', 'ماذا يحدث بعد الاستعادة:'],
    'Tiklashdan oldin joriy holat avtomatik zaxiraga olinadi. Davom etish uchun katta harflarda TIKLASH deb yozing:':
      ['Перед восстановлением текущее состояние сохраняется автоматически. Чтобы продолжить, напишите заглавными буквами TIKLASH:',
        'The current state is backed up automatically first. To continue, type TIKLASH in capital letters:',
        'تُحفظ الحالة الحالية تلقائيًا قبل الاستعادة. للمتابعة اكتب TIKLASH بأحرف كبيرة:'],
    'Bu fayl bilan tiklash mumkin emas.': ['С этим файлом восстановление невозможно.', 'This file cannot be used to restore.', 'لا يمكن الاستعادة بهذا الملف.'],
    'Hozir': ['Сейчас', 'Now', 'الآن'],
    'Keyin': ['После', 'After', 'بعد'],
    'O’zgarish': ['Изменение', 'Change', 'التغيير'],
    'Bo’lim': ['Раздел', 'Section', 'القسم'],
    'Telefonga o’rnatish': ['Установить на телефон', 'Install on your phone', 'التثبيت على الهاتف'],
    'Ilovani o’rnatish': ['Установить приложение', 'Install the app', 'تثبيت التطبيق'],
    'Internet yo’q. Ma’lumot ko’rish mumkin, lekin saqlash ishlamaydi.':
      ['Нет интернета. Данные можно смотреть, но сохранение не работает.',
        'No internet. You can view data, but saving will not work.',
        'لا يوجد إنترنت. يمكنك عرض البيانات، لكن الحفظ لا يعمل.'],
    'Internet qaytdi.': ['Интернет вернулся.', 'You are back online.', 'عاد الاتصال بالإنترنت.'],
    'Yangi versiya tayyor.': ['Готова новая версия.', 'A new version is ready.', 'يتوفر إصدار جديد.'],
    'Yangilash': ['Обновить', 'Update', 'تحديث'],
    'Keyinroq': ['Позже', 'Later', 'لاحقًا'],
    'Qaysi xabarlar yuborilsin': ['Какие сообщения отправлять', 'Which messages to send', 'ما الرسائل التي تُرسل'],
    'Davomat belgilanganda': ['При отметке посещаемости', 'When attendance is marked', 'عند تسجيل الحضور'],
    'To’lov qabul qilinganda': ['При приёме оплаты', 'When a payment is received', 'عند استلام الدفعة'],
    'To’lov muddati o’tganda (eslatma)': ['При просрочке оплаты (напоминание)', 'When a payment is overdue (reminder)', 'عند تأخر الدفع (تذكير)'],
    'E’lon va umumiy xabarlar': ['Объявления и общие сообщения', 'Announcements and general messages', 'الإعلانات والرسائل العامة'],
    'Hisob ulanganda': ['При подключении аккаунта', 'When an account is linked', 'عند ربط الحساب'],
    'Yuborilsin': ['Отправлять', 'Send', 'يُرسل'],
    'Yuborilmasin': ['Не отправлять', 'Do not send', 'لا يُرسل'],
    'Siz "Sozlamalar" bo’limida o’quvchiga bir martalik kod berasiz (masalan 7KQ3M2).':
      ['В разделе «Настройки» вы выдаёте ученику одноразовый код (например 7KQ3M2).',
        'In Settings you give the student a one-time code (for example 7KQ3M2).',
        'في قسم «الإعدادات» تُعطي الطالب رمزًا لمرة واحدة (مثل 7KQ3M2).'],
    'O’quvchi botni ochadi va /start bosadi.': ['Ученик открывает бота и нажимает /start.', 'The student opens the bot and presses /start.', 'يفتح الطالب البوت ويضغط /start.'],
    'Bot kodni so’raydi. O’quvchi kodni yozadi — hisob darhol ulanadi.':
      ['Бот просит код. Ученик вводит его — аккаунт сразу подключается.',
        'The bot asks for the code. The student types it and the account is linked at once.',
        'يطلب البوت الرمز. يكتبه الطالب فيُربط الحساب فورًا.'],
    'Kodi bo’lmasa, "ismim" deb yozadi: ism va guruh kodini so’raydi, so’rov shu yerga tushadi.':
      ['Если кода нет, он пишет «ismim»: бот спросит имя и код группы, заявка придёт сюда.',
        'With no code they write "ismim": the bot asks for their name and group code, and the request appears here.',
        'إن لم يكن لديه رمز يكتب «ismim»: يسأله البوت عن الاسم ورمز المجموعة، فتصل الطلبات هنا.'],
    'Ism bo’yicha avtomatik ulash yo’q — har bir so’rovni siz tasdiqlaysiz.':
      ['Автоподключения по имени нет — каждую заявку подтверждаете вы.',
        'There is no automatic linking by name — you approve every request.',
        'لا يوجد ربط تلقائي بالاسم — أنت تؤكد كل طلب.'],
    ' ta ko’rsatilmoqda': [' показано', ' shown', ' معروض'],
    'To’lov muddati': ['Срок оплаты', 'Payment due date', 'موعد السداد'],
    'Shu kundan keyin to’lanmagan hisob "muddati o’tgan" bo’ladi.':
      ['После этой даты неоплаченный счёт считается просроченным.',
        'After this date an unpaid invoice counts as overdue.',
        'بعد هذا التاريخ تُعدّ الفاتورة غير المدفوعة متأخرة.'],
    'Shu oy uchun hisob yaratiladi. Kerak bo’lsa to’lov muddatini o’zgartiring.':
      ['За этот месяц будет создан счёт. При необходимости измените срок оплаты.',
        'An invoice will be created for this month. Change the due date if needed.',
        'ستُنشأ فاتورة لهذا الشهر. غيّر موعد السداد عند الحاجة.'],
    'Qo’ng’iroq qilish': ['Позвонить', 'Call', 'اتصال'],
    'Oylik hisoblarni avtomatik yaratish': ['Автоматическое создание месячных счетов', 'Create monthly invoices automatically', 'إنشاء الفواتير الشهرية تلقائيًا'],
    'Avtomatik yaratish': ['Автоматическое создание', 'Automatic creation', 'الإنشاء التلقائي'],
    'Yoqilgan': ['Включено', 'On', 'مُفعَّل'],
    'O’chirilgan': ['Выключено', 'Off', 'مُعطَّل'],
    'Oyning qaysi kunida': ['В какой день месяца', 'On which day of the month', 'في أي يوم من الشهر'],
    'Masalan 1 — har oyning 1-kuni hisoblar o’zi yaratiladi.':
      ['Например 1 — счета создаются 1-го числа каждого месяца.',
        'For example 1 — invoices are created on the 1st of each month.',
        'مثال 1 — تُنشأ الفواتير في اليوم الأول من كل شهر.'],
    'Hozir tekshirish': ['Проверить сейчас', 'Check now', 'تحقق الآن'],
    'Yoqilsa, har oy boshida barcha faol o’quvchilarga hisob o’zi yaratiladi. Ikki marta yaratilmaydi — allaqachon bor hisob o’tkazib yuboriladi.':
      ['Если включено, в начале каждого месяца счета создаются для всех активных учеников. Дважды не создаются — существующие пропускаются.',
        'When on, invoices are created for every active student at the start of each month. Nothing is created twice — existing invoices are skipped.',
        'عند التفعيل تُنشأ الفواتير لكل طالب نشط في بداية الشهر. لا تتكرر — تُتجاوز الفواتير الموجودة.'],
    'Ilovani telefon yoki kompyuterga alohida dastur sifatida o’rnatish mumkin. Bosh ekranda belgi paydo bo’ladi, ochilishi tezroq bo’ladi.':
      ['Приложение можно установить на телефон или компьютер как отдельную программу. На главном экране появится значок, открываться будет быстрее.',
        'The app can be installed on your phone or computer as a separate program. An icon appears on the home screen and it opens faster.',
        'يمكن تثبيت التطبيق على الهاتف أو الحاسوب كبرنامج مستقل. تظهر أيقونة على الشاشة الرئيسية ويفتح أسرع.'],
    'Avansdan qoplash': ['Погасить из аванса', 'Apply from advance', 'السداد من الرصيد المقدَّم'],
    'Avans': ['Аванс', 'Advance', 'رصيد مقدَّم'],
    'Qoplash': ['Погасить', 'Apply', 'سداد'],
    'Qaysi hisoblarga yozilsin': ['На какие счета записать', 'Which invoices to apply to', 'على أي فواتير تُسجَّل'],
    'Bugungi darslar': ['Сегодняшние занятия', 'Today’s lessons', 'دروس اليوم'],
    'Belgilangan': ['Отмечено', 'Marked', 'تم التسجيل'],
    'Belgilanmagan': ['Не отмечено', 'Not marked', 'لم يُسجَّل'],
    'Bugun dars yo’q. Pastdan guruh va sanani tanlang.':
      ['Сегодня занятий нет. Выберите группу и дату ниже.',
        'No lessons today. Choose a group and date below.',
        'لا دروس اليوم. اختر المجموعة والتاريخ أدناه.'],
    'Faol guruhlar: ': ['Активные группы: ', 'Active groups: ', 'المجموعات النشطة: '],
    'Keyingi dars: ': ['Следующее занятие: ', 'Next lesson: ', 'الدرس القادم: '],
    'Telefon: ': ['Телефон: ', 'Phone: ', 'الهاتف: '],
    'rejada yo’q': ['не запланировано', 'not scheduled', 'غير مجدول'],
    'kiritilmagan': ['не указан', 'not entered', 'غير مُدخَل'],
    'Soat': ['Часы', 'Hour', 'الساعة'],
    'Daqiqa': ['Минуты', 'Minute', 'الدقيقة'],
    'Tanlash': ['Выбрать', 'Select', 'اختيار'],
    'Shu oy': ['Этот месяц', 'This month', 'هذا الشهر'],
    'Kurs davomiyligi bo’yicha o’zi to’ldiriladi':
      ['Заполняется автоматически по длительности курса',
        'Filled in automatically from the course duration',
        'يُملأ تلقائيًا حسب مدة الدرس في الكورس'],
    'Ulash kodlari': ['Коды подключения', 'Link codes', 'رموز الربط'],
    'Ulash kodi': ['Код подключения', 'Link code', 'رمز الربط'],
    'O’quvchiga kod berish': ['Выдать код ученику', 'Give a student a code', 'إعطاء رمز للطالب'],
    'Kod yaratish': ['Создать код', 'Create code', 'إنشاء رمز'],
    'Qayta yuborish': ['Отправить снова', 'Send again', 'إعادة الإرسال'],
    'Yuborilmadi': ['Не отправлено', 'Not sent', 'لم تُرسل'],
    'Qayta urinilmoqda': ['Повторная попытка', 'Retrying', 'تُعاد المحاولة'],
    'O’chirilgan turi': ['Этот тип отключён', 'This type is off', 'هذا النوع مُعطَّل'],
    'Muddatdan necha kun o’tsa eslatilsin': ['Через сколько дней после срока напоминать', 'Days after the due date before reminding', 'كم يومًا بعد الاستحقاق قبل التذكير'],
    'Eslatma necha kunda bir marta': ['Как часто напоминать (дней)', 'How often to remind (days)', 'كل كم يوم يُرسل التذكير'],
    'Ulash kodi necha soat amal qiladi': ['Сколько часов действует код', 'How many hours the code is valid', 'كم ساعة يبقى الرمز صالحًا'],
    'Masalan 3 — muddat o’tgandan 3 kun keyin': ['Например 3 — через 3 дня после срока', 'For example 3 — three days after the due date', 'مثال 3 — بعد ثلاثة أيام من الاستحقاق'],
    'Bir o’quvchiga shu kunlar ichida bir martadan ko’p yozilmaydi':
      ['Одному ученику за это время пишем не чаще одного раза',
        'A student is not written to more than once within this period',
        'لا تُرسل أكثر من رسالة واحدة للطالب خلال هذه المدة'],
    'O’quvchini botga ulash uchun unga bir martalik kod bering. Kod ishlatilgach yoki muddati o’tgach yaroqsiz bo’ladi. Ism bo’yicha avtomatik ulash yo’q — bir xil ismlar chalkashmasligi uchun.':
      ['Чтобы подключить ученика к боту, выдайте ему одноразовый код. После использования или истечения срока код недействителен. Автоподключение по имени отключено — одинаковые имена можно перепутать.',
        'To link a student to the bot, give them a one-time code. Once used or expired it no longer works. There is no automatic linking by name — identical names could be confused.',
        'لربط الطالب بالبوت، أعطه رمزًا لمرة واحدة. يصبح الرمز غير صالح بعد استخدامه أو انتهاء مدته. لا يوجد ربط تلقائي بالاسم — لتفادي الخلط بين الأسماء المتشابهة.'],
    'Kodni o’quvchiga bering. U botda /start bosib shu kodni yozadi.':
      ['Передайте код ученику. В боте он нажимает /start и вводит этот код.',
        'Give the code to the student. In the bot they press /start and type this code.',
        'أعطِ الرمز للطالب. في البوت يضغط /start ثم يكتب هذا الرمز.'],
    'Zaxira nusxa olish': ['Создать резервную копию', 'Create backup', 'إنشاء نسخة احتياطية'],
    'Til': ['Язык', 'Language', 'اللغة'],
    'Mavzu': ['Тема', 'Theme', 'المظهر'],
    'Yorug’': ['Светлая', 'Light', 'فاتح'],
    'Qorong’i': ['Тёмная', 'Dark', 'داكن'],
    'Tizim bo’yicha': ['Как в системе', 'System', 'حسب النظام'],
    'Ko’rinish': ['Оформление', 'Appearance', 'المظهر'],
    'Ruxsatlar': ['Права доступа', 'Permissions', 'الصلاحيات'],
    'Ruxsatlarni sozlash': ['Настроить права', 'Configure permissions', 'ضبط الصلاحيات'],
    'Ko’rish': ['Просмотр', 'View', 'عرض'],
    'Kim': ['Кто', 'Who', 'من'],
    'Nima qildi': ['Что сделал', 'Action', 'الإجراء'],
    'Obyekt': ['Объект', 'Object', 'العنصر'],
    'Vazifa': ['Задача', 'Task', 'المهمة'],
    'Yangi vazifa': ['Новая задача', 'New task', 'مهمة جديدة'],
    'Vazifa berish': ['Поставить задачу', 'Assign task', 'إسناد مهمة'],
    'Bajarildi': ['Выполнено', 'Done', 'منجزة'],
    'Bajarilmoqda': ['В работе', 'In progress', 'قيد التنفيذ'],
    'Kim uchun': ['Кому', 'Assignee', 'المُسند إليه'],
    'Muddati': ['Срок', 'Due date', 'الموعد النهائي'],
    'Xabar yozing…': ['Напишите сообщение…', 'Write a message…', 'اكتب رسالة…'],
    'Suhbatni tanlang': ['Выберите чат', 'Pick a conversation', 'اختر محادثة'],
    'Xodim': ['Сотрудник', 'Employee', 'الموظف'],
    'Xodim qo’shish': ['Добавить сотрудника', 'Add employee', 'إضافة موظف'],
    'Yangi xodim': ['Новый сотрудник', 'New employee', 'موظف جديد'],
    'Ish boshlagan sana': ['Дата приёма на работу', 'Start date', 'تاريخ المباشرة'],
    'Guruhlari': ['Группы', 'Groups', 'المجموعات'],
    'Ish haqi turi': ['Тип оплаты труда', 'Salary type', 'نوع الراتب'],
    'Oylik summa (so’m)': ['Оклад (сум)', 'Monthly salary (UZS)', 'الراتب الشهري (سوم)'],
    'Foiz (%)': ['Процент (%)', 'Percent (%)', 'النسبة (%)'],

    /* --- Xabarlar / bo'sh holatlar --- */
    'Murojaat yo’q': ['Обращений нет', 'No leads', 'لا توجد طلبات'],
    'O’quvchi topilmadi': ['Ученик не найден', 'No student found', 'لم يُعثر على طالب'],
    'Guruh yo’q': ['Групп нет', 'No groups', 'لا توجد مجموعات'],
    'Guruh bo’sh': ['Группа пуста', 'Group is empty', 'المجموعة فارغة'],
    'Guruh topilmadi': ['Группа не найдена', 'Group not found', 'المجموعة غير موجودة'],
    'Xodim yo’q': ['Сотрудников нет', 'No staff', 'لا يوجد موظفون'],
    'Kurs yo’q': ['Курсов нет', 'No courses', 'لا توجد دورات'],
    'Xona yo’q': ['Кабинетов нет', 'No rooms', 'لا توجد قاعات'],
    'Xarajat yo’q': ['Расходов нет', 'No expenses', 'لا توجد مصروفات'],
    'Qarzdorlik yo’q': ['Задолженности нет', 'No debt', 'لا توجد ديون'],
    'To’lov yo’q.': ['Платежей нет.', 'No payments.', 'لا توجد مدفوعات.'],
    'Hisob yaratilmagan': ['Начисления не созданы', 'No invoices created', 'لم تُنشأ فواتير'],
    'Hisob yaratilmagan.': ['Начисления не созданы.', 'No invoices created.', 'لم تُنشأ فواتير.'],
    'Faol guruh yo’q': ['Активных групп нет', 'No active groups', 'لا توجد مجموعات نشطة'],
    'Bugun dars yo’q': ['Сегодня уроков нет', 'No lessons today', 'لا توجد دروس اليوم'],
    'E’tibor talab qiladi': ['Требует внимания', 'Needs attention', 'يتطلب انتباهاً'],
    'Guruhga yozilmagan': ['Не записан в группу', 'Not enrolled', 'غير مسجل في مجموعة'],
    'Xavfsizlik.': ['Безопасность.', 'Security.', 'الأمان.'],
    'Namuna ma’lumotlar.': ['Демоданные.', 'Sample data.', 'بيانات تجريبية.'],
    'Oylik hisoblar.': ['Ежемесячные начисления.', 'Monthly invoices.', 'الفواتير الشهرية.'],
    'Qanday hisoblanadi.': ['Как рассчитывается.', 'How it is calculated.', 'طريقة الحساب.'],
    'Parollar haqida.': ['О паролях.', 'About passwords.', 'حول كلمات المرور.'],
    'Jadval to’qnashuvi.': ['Конфликт расписания.', 'Schedule conflict.', 'تعارض في الجدول.'],
    'Bu vaqt band: ': ['Это время занято: ', 'This slot is taken: ', 'هذا الوقت محجوز: '],
    'Sahifani ochib bo’lmadi. ': ['Не удалось открыть страницу. ', 'Could not open the page. ', 'تعذّر فتح الصفحة. '],
    'Tizimni ochib bo’lmadi': ['Не удалось открыть систему', 'Could not start the system', 'تعذّر تشغيل النظام'],
    'Login yoki parol xato.': ['Неверный логин или пароль.', 'Wrong login or password.', 'اسم المستخدم أو كلمة المرور غير صحيحة.'],
    'Login va parolni kiriting.': ['Введите логин и пароль.', 'Enter login and password.', 'أدخل اسم المستخدم وكلمة المرور.'],
    'Bu maydon to’ldirilishi kerak.': ['Это поле обязательно.', 'This field is required.', 'هذا الحقل مطلوب.'],
    'Raqam to’liq emas.': ['Номер неполный.', 'Phone number is incomplete.', 'رقم الهاتف غير مكتمل.'],
    'Telefon raqamni to’liq kiriting.': ['Введите полный номер телефона.', 'Enter the full phone number.', 'أدخل رقم الهاتف كاملاً.'],
    'Summani kiriting.': ['Введите сумму.', 'Enter the amount.', 'أدخل المبلغ.'],
    'O’quvchini tanlang.': ['Выберите ученика.', 'Select a student.', 'اختر طالباً.'],
    'Sanani kiriting.': ['Укажите дату.', 'Enter the date.', 'أدخل التاريخ.'],
    'Sababi': ['Причина', 'Reason', 'السبب'],
    'Sababni yozing.': ['Укажите причину.', 'Enter a reason.', 'اكتب السبب.'],
    'Summa noto’g’ri.': ['Сумма неверна.', 'Amount is invalid.', 'المبلغ غير صحيح.'],
    'Vaqt noto’g’ri.': ['Время указано неверно.', 'Time is invalid.', 'الوقت غير صحيح.'],
    'Kamida bitta dars kunini tanlang.': ['Выберите хотя бы один день занятий.', 'Pick at least one class day.', 'اختر يوم درس واحداً على الأقل.'],
    'Bu login band.': ['Этот логин занят.', 'This login is taken.', 'اسم المستخدم محجوز.'],
    'Parol kiriting.': ['Введите пароль.', 'Enter a password.', 'أدخل كلمة المرور.'],
    'Bunday kategoriya bor.': ['Такая категория уже есть.', 'That category already exists.', 'هذه الفئة موجودة.'],

    /* --- Hafta kunlari --- */
    'Dushanba': ['Понедельник', 'Monday', 'الاثنين'],
    'Seshanba': ['Вторник', 'Tuesday', 'الثلاثاء'],
    'Chorshanba': ['Среда', 'Wednesday', 'الأربعاء'],
    'Payshanba': ['Четверг', 'Thursday', 'الخميس'],
    'Juma': ['Пятница', 'Friday', 'الجمعة'],
    'Shanba': ['Суббота', 'Saturday', 'السبت'],
    'Yakshanba': ['Воскресенье', 'Sunday', 'الأحد'],
    'Du': ['Пн', 'Mon', 'إثن'],
    'Se': ['Вт', 'Tue', 'ثلا'],
    'Ch': ['Ср', 'Wed', 'أرب'],
    'Pa': ['Чт', 'Thu', 'خمي'],
    'Ju': ['Пт', 'Fri', 'جمع'],
    'Sh': ['Сб', 'Sat', 'سبت'],
    'Ya': ['Вс', 'Sun', 'أحد'],

    /* --- Oylar --- */
    'Yanvar': ['Январь', 'January', 'يناير'],
    'Fevral': ['Февраль', 'February', 'فبراير'],
    'Mart': ['Март', 'March', 'مارس'],
    'Aprel': ['Апрель', 'April', 'أبريل'],
    'May': ['Май', 'May', 'مايو'],
    'Iyun': ['Июнь', 'June', 'يونيو'],
    'Iyul': ['Июль', 'July', 'يوليو'],
    'Avgust': ['Август', 'August', 'أغسطس'],
    'Sentabr': ['Сентябрь', 'September', 'سبتمبر'],
    'Oktabr': ['Октябрь', 'October', 'أكتوبر'],
    'Noyabr': ['Ноябрь', 'November', 'نوفمبر'],
    'Dekabr': ['Декабрь', 'December', 'ديسمبر'],

    /* --- Ruxsatlar oynasi --- */
    'Rol bo’yicha': ['По роли', 'By role', 'حسب الدور'],
    'Alohida': ['Отдельно', 'Custom', 'مخصص'],
    'Ruxsat bor': ['Есть доступ', 'Allowed', 'مسموح'],
    'Ruxsat yo’q': ['Нет доступа', 'Not allowed', 'غير مسموح'],
    'Bo’limni ko’rish': ['Просмотр раздела', 'View section', 'عرض القسم'],
    'Qo’shish va tahrirlash': ['Добавлять и редактировать', 'Add and edit', 'الإضافة والتعديل'],
    'Kartani ko’rish': ['Просмотр карточки', 'View card', 'عرض البطاقة'],
    'Ro’yxatni ko’rish': ['Просмотр списка', 'View list', 'عرض القائمة'],
    'Guruhni ko’rish': ['Просмотр группы', 'View group', 'عرض المجموعة'],
    'Ochish va tahrirlash': ['Создавать и редактировать', 'Create and edit', 'الإنشاء والتعديل'],
    'Jadvalni ko’rish': ['Просмотр расписания', 'View schedule', 'عرض الجدول'],
    'Dars ko’chirish va bekor qilish': ['Переносить и отменять уроки', 'Move and cancel lessons', 'نقل وإلغاء الدروس'],
    'Davomatni ko’rish': ['Просмотр посещаемости', 'View attendance', 'عرض الحضور'],
    'Oylik hisob yaratish': ['Создавать начисления', 'Create invoices', 'إنشاء الفواتير'],
    'Xarajat kiritish': ['Вносить расходы', 'Add expenses', 'إدخال المصروفات'],
    'Ish haqini hisoblash': ['Рассчитывать зарплату', 'Calculate payroll', 'حساب الرواتب'],
    'Ish haqini tasdiqlash': ['Утверждать зарплату', 'Approve payroll', 'اعتماد الرواتب'],
    'Umumiy hisobotlar': ['Общие отчёты', 'General reports', 'التقارير العامة'],
    'Moliyaviy hisobotlar': ['Финансовые отчёты', 'Financial reports', 'التقارير المالية'],
    'Suhbat bo’limi': ['Раздел чата', 'Chat section', 'قسم المحادثة'],
    'Xabar yozish': ['Писать сообщения', 'Send messages', 'كتابة الرسائل'],
    'Vazifalar bo’limi': ['Раздел задач', 'Tasks section', 'قسم المهام'],
    'Vazifalarni ko’rish': ['Просмотр задач', 'View tasks', 'عرض المهام'],
    'Vazifa berish': ['Ставить задачи', 'Assign tasks', 'إسناد المهام'],
    'O’quvchilarga xabar yuborish': ['Отправлять сообщения ученикам', 'Message students', 'إرسال رسائل للطلاب'],
    'Bot sozlamalari': ['Настройки бота', 'Bot settings', 'إعدادات البوت'],
    'Foydalanuvchilarni boshqarish': ['Управление пользователями', 'Manage users', 'إدارة المستخدمين'],
    'Jamoa': ['Команда', 'Team', 'الفريق'],
    'Tizim': ['Система', 'System', 'النظام'],
    'Guruhlar va kurslar': ['Группы и курсы', 'Groups and courses', 'المجموعات والدورات'],
    'Hammasiga ruxsat berish': ['Дать все права', 'Grant everything', 'منح كل الصلاحيات'],
    'Rol bo’yicha qaytarish': ['Вернуть по роли', 'Reset to role', 'إعادة حسب الدور'],
    'Ruxsatlarni sozlash': ['Настроить права', 'Configure permissions', 'ضبط الصلاحيات'],
    'Standart (1234)': ['Стандартный (1234)', 'Default (1234)', 'افتراضية (1234)'],
    'O’zgartirilgan': ['Изменён', 'Changed', 'تم تغييرها'],

    /* --- Amallar --- */
    'Tuzatish': ['Исправить', 'Correct', 'تصحيح'],
    'O’zgartirish': ['Изменить', 'Change', 'تغيير'],
    'Uzish': ['Отключить', 'Unlink', 'فصل'],
    'Ulash': ['Подключить', 'Link', 'ربط'],
    'Rad etish': ['Отклонить', 'Reject', 'رفض'],
    'Boshlash': ['Начать', 'Start', 'ابدأ'],
    'Import qilish': ['Импортировать', 'Import', 'استيراد'],
    'Nusxalang': ['Скопируйте', 'Copy', 'انسخ'],
    'Excel': ['Excel', 'Excel', 'Excel'],
    'AlBayan Cairo': ['AlBayan Cairo', 'AlBayan Cairo', 'البيان القاهرة'],
    'O’zbekcha': ['O’zbekcha', 'O’zbekcha', 'O’zbekcha'],
    'Русский': ['Русский', 'Русский', 'Русский'],
    'English': ['English', 'English', 'English'],
    '— tanlanmagan —': ['— не выбрано —', '— not selected —', '— غير محدد —'],
    '— yo’q —': ['— нет —', '— none —', '— لا شيء —'],
    '— bog’lanmagan —': ['— не привязан —', '— not linked —', '— غير مرتبط —'],
    '— keyinroq yozaman —': ['— запишу позже —', '— enrol later —', '— لاحقاً —'],
    'Topilmadi': ['Не найдено', 'Not found', 'لم يُعثر'],
    'Topilmadi.': ['Не найдено.', 'Not found.', 'لم يُعثر.'],

    /* --- Tarix yozuvlari --- */
    'To’lov qabul qilindi': ['Платёж принят', 'Payment received', 'تم استلام الدفعة'],
    'To’lov bekor qilindi': ['Платёж отменён', 'Payment voided', 'أُلغيت الدفعة'],
    'Pul qaytarildi': ['Средства возвращены', 'Refund issued', 'تم الاسترداد'],
    'Oylik hisoblar yaratildi': ['Созданы начисления', 'Invoices created', 'أُنشئت الفواتير'],
    'Hisob o’chirildi': ['Начисление удалено', 'Invoice deleted', 'حُذفت الفاتورة'],
    'Xarajat qo’shildi': ['Расход добавлен', 'Expense added', 'أُضيف مصروف'],
    'Xarajat tuzatildi': ['Расход исправлен', 'Expense corrected', 'صُحّح المصروف'],
    'Xarajat bekor qilindi': ['Расход отменён', 'Expense voided', 'أُلغي المصروف'],
    'Ish haqi hisoblandi': ['Зарплата рассчитана', 'Payroll calculated', 'حُسبت الرواتب'],
    'Ish haqi tasdiqlandi': ['Зарплата утверждена', 'Payroll approved', 'اعتُمدت الرواتب'],
    'Ish haqi to’landi': ['Зарплата выплачена', 'Payroll paid', 'صُرفت الرواتب'],
    'O’quvchi qo’shildi': ['Ученик добавлен', 'Student added', 'أُضيف طالب'],
    'O’quvchi tahrirlandi': ['Ученик изменён', 'Student edited', 'عُدّل الطالب'],
    'O’quvchi arxivlandi': ['Ученик архивирован', 'Student archived', 'أُرشف الطالب'],
    'O’quvchi holati o’zgardi': ['Статус ученика изменён', 'Student status changed', 'تغيّرت حالة الطالب'],
    'Guruhga yozildi': ['Записан в группу', 'Enrolled in group', 'سُجّل في مجموعة'],
    'Guruhdan chiqarildi': ['Исключён из группы', 'Removed from group', 'أُخرج من المجموعة'],
    'A’zolik tahrirlandi': ['Участие изменено', 'Membership edited', 'عُدّل الاشتراك'],
    'Guruh ochildi': ['Группа создана', 'Group created', 'أُنشئت مجموعة'],
    'Guruh tahrirlandi': ['Группа изменена', 'Group edited', 'عُدّلت المجموعة'],
    'Kurs qo’shildi': ['Курс добавлен', 'Course added', 'أُضيفت دورة'],
    'Kurs tahrirlandi': ['Курс изменён', 'Course edited', 'عُدّلت الدورة'],
    'Davomat saqlandi': ['Посещаемость сохранена', 'Attendance saved', 'حُفظ الحضور'],
    'Dars bekor qilindi': ['Урок отменён', 'Lesson cancelled', 'أُلغي الدرس'],
    'Dars qaytarildi': ['Урок восстановлен', 'Lesson restored', 'أُعيد الدرس'],
    'Dars ko’chirildi': ['Урок перенесён', 'Lesson moved', 'نُقل الدرس'],
    'Murojaat qo’shildi': ['Обращение добавлено', 'Lead added', 'أُضيف طلب'],
    'Murojaat o’zgartirildi': ['Обращение изменено', 'Lead edited', 'عُدّل الطلب'],
    'Murojaat o’chirildi': ['Обращение удалено', 'Lead deleted', 'حُذف الطلب'],
    'Xodim qo’shildi': ['Сотрудник добавлен', 'Employee added', 'أُضيف موظف'],
    'Xodim tahrirlandi': ['Сотрудник изменён', 'Employee edited', 'عُدّل الموظف'],
    'Foydalanuvchi qo’shildi': ['Пользователь добавлен', 'User added', 'أُضيف مستخدم'],
    'Foydalanuvchi o’zgartirildi': ['Пользователь изменён', 'User edited', 'عُدّل المستخدم'],
    'Foydalanuvchi o’chirildi': ['Пользователь удалён', 'User deleted', 'حُذف المستخدم'],
    'Sozlamalar o’zgartirildi': ['Настройки изменены', 'Settings changed', 'غُيّرت الإعدادات'],
    'Vazifa berildi': ['Задача поставлена', 'Task assigned', 'أُسندت مهمة'],
    'Vazifa o’zgartirildi': ['Задача изменена', 'Task edited', 'عُدّلت المهمة'],
    'Vazifa holati o’zgardi': ['Статус задачи изменён', 'Task status changed', 'تغيّرت حالة المهمة'],
    'Demo ma’lumotlar o’chirildi': ['Демоданные удалены', 'Sample data removed', 'حُذفت البيانات التجريبية'],
    'O’quvchilar import qilindi': ['Ученики импортированы', 'Students imported', 'استُوردت بيانات الطلاب'],
    'Murojaatlar import qilindi': ['Обращения импортированы', 'Leads imported', 'استُوردت الطلبات'],
    'Botda xabar yuborildi': ['Сообщение отправлено в боте', 'Message sent via bot', 'أُرسلت رسالة عبر البوت'],
    'Bot sozlamalari o’zgartirildi': ['Настройки бота изменены', 'Bot settings changed', 'غُيّرت إعدادات البوت'],

    /* --- Xarajat kategoriyalari --- */
    'Ijara': ['Аренда', 'Rent', 'الإيجار'],
    'Kommunal': ['Коммунальные', 'Utilities', 'الخدمات'],
    'Reklama': ['Реклама', 'Advertising', 'الإعلان'],
    'Jihozlar': ['Оборудование', 'Equipment', 'المعدات'],
    'Xo’jalik': ['Хозяйственные', 'Household', 'مستلزمات'],
    'Boshqa': ['Другое', 'Other', 'أخرى'],

    /* --- Murojaat manbalari --- */
    'Instagram': ['Instagram', 'Instagram', 'إنستجرام'],
    'Telegram': ['Telegram', 'Telegram', 'تيليجرام'],
    'Tanish orqali': ['По рекомендации', 'Referral', 'توصية'],
    'Banner': ['Баннер', 'Banner', 'لافتة'],
    'Yo’l-yo’lakay': ['Проходил мимо', 'Walk-in', 'مرور عابر'],
    'Import': ['Импорт', 'Import', 'استيراد'],

    /* --- Bot sahifasi --- */
    'Xabar yuborish': ['Отправить сообщение', 'Send message', 'إرسال رسالة'],
    'Ulangan o’quvchilar': ['Подключённые ученики', 'Linked students', 'الطلاب المرتبطون'],
    'Ulash so’rovlari': ['Запросы на подключение', 'Link requests', 'طلبات الربط'],
    'Navbatdagi xabarlar': ['Сообщения в очереди', 'Queued messages', 'رسائل في الانتظار'],
    'Bot manzili': ['Адрес бота', 'Bot address', 'عنوان البوت'],
    'Bot manzili (@siz)': ['Адрес бота (без @)', 'Bot username (no @)', 'اسم البوت (بدون @)'],
    'Salomlashuv matni': ['Приветствие', 'Welcome message', 'رسالة الترحيب'],
    'Botga ulash': ['Подключить к боту', 'Link to bot', 'الربط بالبوت'],
    'Yozgan ism': ['Указанное имя', 'Name given', 'الاسم المكتوب'],
    'Guruh kodi': ['Код группы', 'Group code', 'رمز المجموعة'],
    'Taklif': ['Предложение', 'Suggestion', 'اقتراح'],
    'Qaysi o’quvchi': ['Какой ученик', 'Which student', 'أي طالب'],
    'Oxirgi xabarlar': ['Последние сообщения', 'Recent messages', 'آخر الرسائل'],
    'Navbatda': ['В очереди', 'Queued', 'في الانتظار'],
    'Yuborildi': ['Отправлено', 'Sent', 'أُرسلت'],
    'Kimga': ['Кому', 'To', 'إلى'],
    'Xabar matni': ['Текст сообщения', 'Message text', 'نص الرسالة'],
    'Barcha ulangan o’quvchilar': ['Все подключённые ученики', 'All linked students', 'كل الطلاب المرتبطين'],
    'Faqat qarzdorlar': ['Только должники', 'Debtors only', 'المدينون فقط'],
    'Yuborilsin': ['Отправлять', 'Send', 'إرسال'],
    'Yuborilmasin': ['Не отправлять', 'Do not send', 'عدم الإرسال'],
    'Ha': ['Да', 'Yes', 'نعم'],
    'So’rov yo’q': ['Запросов нет', 'No requests', 'لا توجد طلبات'],
    'Ulangan o’quvchi yo’q': ['Подключённых учеников нет', 'No linked students', 'لا يوجد طلاب مرتبطون'],
    'Ulanishni uzish': ['Отключить', 'Unlink', 'فصل الارتباط'],
    'O’quvchi botga qanday ulanadi': ['Как ученик подключается к боту', 'How a student links to the bot', 'كيف يرتبط الطالب بالبوت'],

    /* --- Sahifa tavsiflari --- */
    'Markaz ma’lumotlari, foydalanuvchilar va tizim tarixi':
      ['Данные центра, пользователи и история', 'Centre details, users and history', 'بيانات المركز والمستخدمون والسجل'],
    'Yangi mijozlarni bog’lanishdan o’quvchiga aylanguncha kuzating':
      ['Ведите клиента от первого контакта до зачисления', 'Track a lead from first contact to enrolment', 'تابع العميل من أول اتصال حتى التسجيل'],
    'O’quvchilar bot orqali davomat, to’lov va e’lonlarni oladi':
      ['Ученики получают посещаемость, платежи и объявления через бота', 'Students get attendance, payments and announcements via the bot', 'يتلقى الطلاب الحضور والمدفوعات والإعلانات عبر البوت'],
    'Xodimlar o’rtasidagi ichki yozishmalar': ['Внутренняя переписка сотрудников', 'Internal staff messages', 'مراسلات داخلية بين الموظفين'],
    'Xodimlarga topshiriq berish va bajarilishini kuzatish':
      ['Ставьте задачи и следите за выполнением', 'Assign tasks and track progress', 'إسناد المهام ومتابعة التنفيذ'],
    'Guruh va dars sanasini tanlang': ['Выберите группу и дату урока', 'Pick a group and lesson date', 'اختر المجموعة وتاريخ الدرس'],
    'Guruh ochishdan oldin shu yerni to’ldiring': ['Заполните это перед созданием группы', 'Fill this in before creating a group', 'املأ هذا قبل إنشاء مجموعة'],
    'Bot serveri ulanmagan.': ['Сервер бота не подключён.', 'Bot server is not connected.', 'خادم البوت غير متصل.'],
    'Bu yerda tayyorlangan xabarlar navbatda saqlanadi va bot serveri ishga tushgach yuboriladi.':
      ['Подготовленные здесь сообщения хранятся в очереди и будут отправлены, когда сервер бота заработает.',
        'Messages prepared here are queued and sent once the bot server is running.',
        'الرسائل المُعدّة هنا تُحفظ في الانتظار وتُرسل عند تشغيل خادم البوت.'],
    'Serverni ishga tushirish yo’riqnomasi loyiha papkasidagi README faylida.':
      ['Инструкция по запуску сервера — в файле README проекта.',
        'Server setup instructions are in the project README.',
        'تعليمات تشغيل الخادم في ملف README.'],
    'Bot kaliti (token) bu yerda saqlanmaydi.': ['Токен бота здесь не хранится.', 'The bot token is not stored here.', 'رمز البوت غير محفوظ هنا.'],
    'Sinov': ['Проверка', 'Test', 'اختبار'],
    'Sinov matni': ['Проверочный текст', 'Test text', 'نص تجريبي'],

    /* --- Qolgan interfeys matnlari --- */
    'Turi': ['Тип', 'Type', 'النوع'],
    'Oy': ['Месяц', 'Month', 'الشهر'],
    'Oylar': ['Месяцы', 'Months', 'الأشهر'],
    'Belgi': ['Отметка', 'Mark', 'العلامة'],
    'Qo’shilgan': ['Добавлен', 'Added', 'تاريخ الإضافة'],
    'Xabar': ['Сообщение', 'Message', 'رسالة'],
    'Xabar yo’q': ['Сообщений нет', 'No messages', 'لا توجد رسائل'],
    'Hali xabar yo’q.': ['Сообщений пока нет.', 'No messages yet.', 'لا توجد رسائل بعد.'],
    'Birinchi xabarni yozing.': ['Напишите первое сообщение.', 'Write the first message.', 'اكتب أول رسالة.'],
    'Band guruhlar': ['Занятые группы', 'Groups using it', 'المجموعات المستخدمة'],
    'Ish boshlagan': ['Принят на работу', 'Started', 'تاريخ المباشرة'],
    'Qaysi xodim': ['Какой сотрудник', 'Which employee', 'أي موظف'],
    'Birinchi oy to’lovi': ['Оплата за первый месяц', 'First month fee', 'رسوم الشهر الأول'],
    'Kelishilgan summa': ['Согласованная сумма', 'Agreed amount', 'المبلغ المتفق عليه'],
    'Darhol guruhga yozish': ['Сразу записать в группу', 'Enrol in a group now', 'التسجيل في مجموعة الآن'],
    'Takroriy telefon raqamlar': ['Повторяющиеся номера', 'Duplicate phone numbers', 'أرقام مكررة'],
    'O’tkazib yuborish (tavsiya)': ['Пропустить (рекомендуется)', 'Skip (recommended)', 'تجاهل (موصى به)'],
    'Baribir qo’shish': ['Всё равно добавить', 'Add anyway', 'أضف على أي حال'],
    'Namuna (demo) ma’lumotlar': ['Демоданные', 'Sample data', 'بيانات تجريبية'],
    'Demo ma’lumotlarni o’chirish': ['Удалить демоданные', 'Delete sample data', 'حذف البيانات التجريبية'],
    'Demo ma’lumotlarni yuklash': ['Загрузить демоданные', 'Load sample data', 'تحميل بيانات تجريبية'],
    'Filtrni o’zgartirib ko’ring.': ['Измените фильтр.', 'Try changing the filter.', 'جرّب تغيير المرشّح.'],
    'Filtrni olib tashlash': ['Снять фильтр', 'Clear filter', 'إزالة المرشّح'],
    'Sizga hozircha vazifa berilmagan.': ['Вам пока не поставили задач.', 'No tasks assigned to you yet.', 'لم تُسند إليك مهام بعد.'],
    'Bu davrda davomat yozuvi yo’q.': ['За этот период нет отметок посещаемости.', 'No attendance records in this period.', 'لا توجد سجلات حضور في هذه الفترة.'],
    'Tezkor menyu': ['Быстрое меню', 'Quick menu', 'قائمة سريعة'],
    'Asosiy menyu': ['Главное меню', 'Main menu', 'القائمة الرئيسية'],
    'Yorug’ / qorong’i': ['Светлая / тёмная', 'Light / dark', 'فاتح / داكن'],
    "Yorug' / qorong'i": ['Светлая / тёмная', 'Light / dark', 'فاتح / داكن'],
    'O’quv markazi': ['Учебный центр', 'Learning centre', 'المركز التعليمي'],
    "O'quv markazi": ['Учебный центр', 'Learning centre', 'المركز التعليمي'],
    'Birinchi kirish:': ['Первый вход:', 'First sign-in:', 'أول دخول:'],
    ', parol': [', пароль', ', password', '، كلمة المرور'],
    'Menga berilgan': ['Мне поручено', 'Assigned to me', 'المُسندة إليّ'],
    'Men berganlarim': ['Я поручил', 'Assigned by me', 'التي أسندتها'],
    'Faqat shu brauzerda': ['Только в этом браузере', 'This browser only', 'في هذا المتصفح فقط'],
    'tushum − qaytarish − xarajat': ['выручка − возвраты − расходы', 'income − refunds − expenses', 'الإيراد − الاسترداد − المصروفات'],
    'hammasi hisoblangan': ['всё начислено', 'all invoiced', 'كل شيء محسوب'],
    'Diqqat: baza ulanmadi, ma’lumotlar faqat shu brauzerda saqlanadi.':
      ['Внимание: база не подключена, данные хранятся только в этом браузере.',
        'Note: no database connection — data is stored in this browser only.',
        'تنبيه: لا يوجد اتصال بقاعدة البيانات — تُحفظ البيانات في هذا المتصفح فقط.'],
    'Ma’lumotlar markaz bazasida saqlanadi.':
      ['Данные хранятся в базе центра.', 'Data is stored in the centre database.', 'تُحفظ البيانات في قاعدة بيانات المركز.'],
    'O’quv markazi boshqaruv tizimi':
      ['Система управления учебным центром', 'Learning centre management system', 'نظام إدارة المركز التعليمي'],
    'Standart parol (1234) faqat sinov uchun. Haqiqiy ishda har bir xodimga alohida login va kuchli parol bering.':
      ['Стандартный пароль (1234) — только для проверки. В работе дайте каждому сотруднику отдельный логин и надёжный пароль.',
        'The default password (1234) is for testing only. Give every employee their own login and a strong password.',
        'كلمة المرور الافتراضية (1234) للاختبار فقط. امنح كل موظف اسم دخول وكلمة مرور قوية.'],
    'Ochiq hisob yo’q. Bu pul avans sifatida saqlanadi va keyingi oy hisobiga o’tkaziladi.':
      ['Открытых начислений нет. Деньги сохранятся как аванс и пойдут на следующий месяц.',
        'No open invoices. The money is kept as credit and applied next month.',
        'لا توجد فواتير مفتوحة. يُحفظ المبلغ كرصيد ويُطبّق الشهر القادم.'],
    'Bot ism-familiyasini so’raydi.': ['Бот спросит имя и фамилию.', 'The bot asks for their full name.', 'يسأل البوت عن الاسم الكامل.'],
    'Kod to’g’ri bo’lsa, bot shu guruhdagi o’quvchilar ichidan ismni qidiradi.':
      ['Если код верный, бот ищет имя среди учеников этой группы.',
        'If the code is right, the bot looks for the name among that group’s students.',
        'إذا كان الرمز صحيحاً يبحث البوت عن الاسم بين طلاب تلك المجموعة.'],
    'Topilsa — darhol ulanadi. Topilmasa — shu yerga so’rov tushadi, siz qo’lda ulaysiz.':
      ['Если найдено — подключается сразу. Если нет — сюда придёт запрос, вы подключите вручную.',
        'If found, it links right away. If not, a request appears here and you link it manually.',
        'إذا وُجد يرتبط فوراً، وإلا يصل الطلب هنا لتربطه يدوياً.'],
    'BotFather bergan bot nomi': ['Имя бота от BotFather', 'Bot username from BotFather', 'اسم البوت من BotFather'],
    'Ism va guruh mos kelsa avtomatik ulash':
      ['Автоматически подключать при совпадении имени и группы',
        'Link automatically when name and group match',
        'الربط تلقائياً عند تطابق الاسم والمجموعة'],
    'Shu kundan keyin to’lanmagan hisob "muddati o’tgan" hisoblanadi.':
      ['После этого дня неоплаченное начисление считается просроченным.',
        'After this day an unpaid invoice counts as overdue.',
        'بعد هذا اليوم تُعتبر الفاتورة غير المدفوعة متأخرة.'],
    'Barcha ma’lumotni bitta faylga yuklab oling. Faylni xavfsiz joyda saqlang.':
      ['Выгрузите все данные в один файл. Храните файл в надёжном месте.',
        'Download all data as one file. Keep it somewhere safe.',
        'نزّل كل البيانات في ملف واحد واحفظه في مكان آمن.'],
    'U faqat serverdagi .env faylida turadi — shunda hech kim uni ilova orqali ko’ra olmaydi.':
      ['Он хранится только в файле .env на сервере — через приложение его никто не увидит.',
        'It lives only in the server’s .env file, so nobody can read it through the app.',
        'يوجد فقط في ملف .env على الخادم، فلا يمكن لأحد رؤيته عبر التطبيق.'],
    'Fayl saqlash bu yerda mavjud emas. Quyidagi matnni nusxalab, Excel’ga qo’ying (Ma’lumot → Matndan ustunlarga, ajratgich: nuqtali vergul).':
      ['Сохранение файла здесь недоступно. Скопируйте текст ниже и вставьте в Excel (Данные → Текст по столбцам, разделитель: точка с запятой).',
        'File saving is unavailable here. Copy the text below into Excel (Data → Text to Columns, delimiter: semicolon).',
        'حفظ الملف غير متاح هنا. انسخ النص أدناه إلى Excel (بيانات ← نص إلى أعمدة، الفاصل: فاصلة منقوطة).'],
    'Ma’lumotni nusxalang': ['Скопируйте данные', 'Copy the data', 'انسخ البيانات'],
    'Excel yoki CSV faylni tanlang': ['Выберите файл Excel или CSV', 'Choose an Excel or CSV file', 'اختر ملف Excel أو CSV'],
    'Ustunlarni moslash': ['Сопоставьте столбцы', 'Map the columns', 'مطابقة الأعمدة'],
    'Import yakunlandi': ['Импорт завершён', 'Import finished', 'انتهى الاستيراد'],
    'O’tkazib yuborildi (takroriy)': ['Пропущено (дубликаты)', 'Skipped (duplicates)', 'تم التجاهل (مكرر)'],
    'Qo’shildi': ['Добавлено', 'Added', 'أُضيف'],
    'Diqqat:': ['Внимание:', 'Note:', 'تنبيه:'],
    'Moslashtirishni to’ldiring.': ['Заполните сопоставление.', 'Complete the mapping.', 'أكمل المطابقة.'],
    'O’quvchilarni import qilish': ['Импорт учеников', 'Import students', 'استيراد الطلاب'],
    'Murojaatlarni import qilish': ['Импорт обращений', 'Import leads', 'استيراد الطلبات'],
    'Ism familiya (bitta ustunda)': ['Имя и фамилия (в одном столбце)', 'Full name (single column)', 'الاسم الكامل (عمود واحد)'],
    'Guruh (kod yoki nom)': ['Группа (код или название)', 'Group (code or name)', 'المجموعة (رمز أو اسم)'],
    'Keyingi bog’lanish': ['Следующий контакт', 'Next contact', 'التواصل القادم'],
    'Ko’rib chiqish': ['Просмотр', 'Preview', 'معاينة'],
    'Guruhga yozildi': ['Записано в группу', 'Enrolled', 'سُجّل في مجموعة'],
    '— shu davrda kassaga kirgan va kassadan chiqqan pul farqi. Bu buxgalteriya foydasi emas.':
      ['— разница между поступившими и потраченными деньгами за период. Это не бухгалтерская прибыль.',
        '— the difference between money in and money out for the period. This is not accounting profit.',
        '— الفرق بين الأموال الداخلة والخارجة في هذه الفترة. هذا ليس ربحاً محاسبياً.'],
    'Bu buxgalteriya foydasi emas.': ['Это не бухгалтерская прибыль.', 'This is not accounting profit.', 'هذا ليس ربحاً محاسبياً.'],

    /* --- Sotuv voronkalari --- */
    'Sotuv voronkalari': ['Воронки продаж', 'Sales funnels', 'مسارات المبيعات'],
    'Sotuv voronkasi': ['Воронка продаж', 'Sales funnel', 'مسار المبيعات'],
    'Voronka': ['Воронка', 'Funnel', 'المسار'],
    'Voronka nomi': ['Название воронки', 'Funnel name', 'اسم المسار'],
    'Voronka qo’shish': ['Добавить воронку', 'Add funnel', 'إضافة مسار'],
    'Yangi voronka': ['Новая воронка', 'New funnel', 'مسار جديد'],
    'Voronkani o’chirish': ['Удалить воронку', 'Delete funnel', 'حذف المسار'],
    'Voronka yo’q': ['Воронок нет', 'No funnels', 'لا توجد مسارات'],
    'Voronka yaratildi': ['Воронка создана', 'Funnel created', 'أُنشئ المسار'],
    'Voronka o’zgartirildi': ['Воронка изменена', 'Funnel edited', 'عُدّل المسار'],
    'Birinchi voronkani yarating.': ['Создайте первую воронку.', 'Create the first funnel.', 'أنشئ أول مسار.'],
    'Bosqichlar': ['Этапы', 'Stages', 'المراحل'],
    'Bosqich qo’shish': ['Добавить этап', 'Add stage', 'إضافة مرحلة'],
    'Yangi bosqich': ['Новый этап', 'New stage', 'مرحلة جديدة'],
    'Oddiy bosqich': ['Обычный этап', 'Normal stage', 'مرحلة عادية'],
    'Yakun: o’quvchi bo’ldi': ['Итог: стал учеником', 'Outcome: enrolled', 'النتيجة: أصبح طالباً'],
    'Yakun: rad etdi': ['Итог: отказался', 'Outcome: declined', 'النتيجة: رفض'],
    'Avtomatik manba belgisi': ['Метка источника по умолчанию', 'Default source tag', 'وسم المصدر الافتراضي'],
    'Qabul havolasi': ['Ссылка приёма', 'Intake link', 'رابط الاستقبال'],
    'Ko’rsatish': ['Показать', 'Show', 'إظهار'],
    'Yangi kalit yaratish': ['Создать новый ключ', 'Generate a new key', 'إنشاء مفتاح جديد'],
    'Yangi kalit yaratildi.': ['Новый ключ создан.', 'New key generated.', 'تم إنشاء مفتاح جديد.'],
    'Voronka nima? ': ['Что такое воронка? ', 'What is a funnel? ', 'ما هو المسار؟ '],
    'Instagram va reklama bilan ulash. ': ['Подключение Instagram и рекламы. ', 'Connecting Instagram and ads. ', 'ربط إنستجرام والإعلانات. '],
    'Yangi lid': ['Новый лид', 'New lead', 'عميل محتمل جديد'],
    'Qiziqdi': ['Заинтересован', 'Interested', 'مهتم'],
    'Yangi yozuv': ['Новое сообщение', 'New message', 'رسالة جديدة'],
    'Target reklama': ['Таргет-реклама', 'Paid ads', 'إعلانات مدفوعة'],
    'Asosiy': ['Основная', 'Main', 'الرئيسي'],
    'Target': ['Таргет', 'Ads', 'إعلانات'],
    'Webhook': ['Webhook', 'Webhook', 'Webhook'],
    'Hech narsa topilmadi': ['Ничего не найдено', 'Nothing found', 'لا توجد نتائج'],
    'Noma’lum': ['Неизвестно', 'Unknown', 'غير معروف']
  };

  /* Ichida o'zgaruvchi bo'lgan iboralar uchun bo'lak tarjimalari */
  var FRAG = {
    ' ta ko’rsatilmoqda': [' показано', ' shown', ' معروض'],
    ' ta o’quvchi': [' учеников', ' students', ' طالباً'],
    ' ta guruh': [' групп', ' groups', ' مجموعات'],
    ' ta xodim': [' сотрудников', ' staff', ' موظفين'],
    ' ta hisob': [' начислений', ' invoices', ' فواتير'],
    ' ta dars': [' уроков', ' lessons', ' دروس'],
    ' ta murojaat': [' обращений', ' leads', ' طلبات'],
    ' ta yangi hisob yaratildi.': [' новых начислений создано.', ' new invoices created.', ' فاتورة جديدة أُنشئت.'],
    'Yangi hisob yo’q — hammasi allaqachon yaratilgan.': ['Новых начислений нет — всё уже создано.', 'No new invoices — everything already exists.', 'لا فواتير جديدة — كلها موجودة.'],
    'Birinchi hisob (': ['Первый счёт (', 'First invoice (', 'الفاتورة الأولى ('],
    ' ta yangi hisob': [' новых начислений', ' new invoices', ' فواتير جديدة'],
    'Asosiy': ['Основной', 'Main', 'الأساسي'],
    'Yangi (': ['Новые (', 'New (', 'جديد ('],
    'Target reklama': ['Таргетированная реклама', 'Targeted ads', 'الإعلانات المستهدفة'],
    'Barchasi': ['Все', 'All', 'الكل'],
    'Bog’lanildi': ['Связались', 'Contacted', 'تم التواصل'],
    'O’quvchi bo’ldi': ['Стал учеником', 'Became a student', 'أصبح طالبًا'],
    'Rad etdi': ['Отказался', 'Declined', 'رفض'],
    'Menga berilgan': ['Назначено мне', 'Assigned to me', 'المسندة إليّ'],
    'Men berganlarim': ['Назначено мной', 'Assigned by me', 'التي أسندتُها'],
    'Direktor': ['Директор', 'Director', 'المدير'],
    'Administrator': ['Администратор', 'Administrator', 'الإداري'],
    'Buxgalter': ['Бухгалтер', 'Accountant', 'المحاسب'],
    'O’qituvchi': ['Преподаватель', 'Teacher', 'المعلم'],
    'Qolgan qarz: ': ['Остаток долга: ', 'Remaining debt: ', 'الدين المتبقي: '],
    'To’liq oylik narx — ': ['Полная месячная цена — ', 'Full monthly fee — ', 'السعر الشهري الكامل — '],
    'Barcha ulangan o’quvchilar': ['Все подключённые ученики', 'All linked students', 'كل الطلاب المرتبطين'],
    'Sinov darsiga yozildi': ['Записан на пробный урок', 'Booked a trial lesson', 'مسجَّل في درس تجريبي'],
    'O’quvchi oy o’rtasida qo’shilyapti (': ['Ученик добавляется в середине месяца (', 'The student is joining mid-month (', 'يُضاف الطالب في منتصف الشهر ('],
    '). Summani va to’lov muddatini tekshiring.': ['). Проверьте сумму и срок оплаты.', '). Check the amount and the due date.', '). تحقق من المبلغ وموعد السداد.'],
    'Sana: ': ['Дата: ', 'Date: ', 'التاريخ: '],
    'O’quvchi: ': ['Ученик: ', 'Student: ', 'الطالب: '],
    'Turi: ': ['Тип: ', 'Type: ', 'النوع: '],
    'Usul: ': ['Способ: ', 'Method: ', 'الطريقة: '],
    'Izoh: ': ['Примечание: ', 'Note: ', 'ملاحظة: '],
    'Avansga: ': ['В аванс: ', 'To advance: ', 'إلى الرصيد المقدَّم: '],
    'Tel: ': ['Тел: ', 'Tel: ', 'هاتف: '],
    ' o’quv markazi': [' учебный центр', ' learning centre', ' مركز تعليمي'],
    'Bu markazning ichki to’lov tasdig’i.': ['Это внутреннее подтверждение оплаты центра.', 'This is the centre’s internal payment confirmation.', 'هذا تأكيد دفع داخلي للمركز.'],
    'Fiskal chek emas.': ['Не фискальный чек.', 'Not a fiscal receipt.', 'ليس إيصالاً ضريبياً.'],
    'Chek raqami: ': ['Номер чека: ', 'Receipt number: ', 'رقم الإيصال: '],
    'Qabul qildi: ': ['Принял: ', 'Received by: ', 'استلمها: '],
    'JAMI: ': ['ИТОГО: ', 'TOTAL: ', 'الإجمالي: '],
    ' ta darsda davomat olinmagan': [' занятий без отметки посещаемости', ' lessons without attendance', ' دروس بلا تسجيل حضور'],
    ' ta guruhga o’qituvchi biriktirilmagan': [' групп без преподавателя', ' groups without a teacher', ' مجموعات بلا معلم'],
    ' ta murojaatga bugun bog’lanish kerak': [' обращений требуют звонка сегодня', ' leads to contact today', ' طلبات يجب الاتصال بها اليوم'],
    'Muddati o’tgan qarz: ': ['Просроченный долг: ', 'Overdue debt: ', 'دين متأخر: '],
    'Davomiyligi: ': ['Длительность: ', 'Duration: ', 'المدة: '],
    ' soat': [' ч', ' h', ' ساعة'],
    ' daqiqa': [' мин', ' min', ' دقيقة'],
    ' (kursdagidek)': [' (как в курсе)', ' (same as the course)', ' (كما في الكورس)'],
    ' — kursda ': [' — в курсе ', ' — course: ', ' — في الكورس '],
    'Qarz ': ['Долг ', 'Debt ', 'دين '],
    'Avans ': ['Аванс ', 'Credit ', 'رصيد '],
    'Avans: ': ['Аванс: ', 'Credit: ', 'الرصيد: '],
    'Qarz: ': ['Долг: ', 'Debt: ', 'الدين: '],
    'Muddati o’tgan ': ['Просрочено ', 'Overdue ', 'متأخر '],
    'Taqsimlandi: ': ['Распределено: ', 'Allocated: ', 'المُوزّع: '],
    'Avansga: ': ['В аванс: ', 'To credit: ', 'إلى الرصيد: '],
    ' so’m': [' сум', ' UZS', ' سوم'],
    ' so’m/oy': [' сум/мес', ' UZS/mo', ' سوم/شهر'],
    'Keldi: ': ['Присутствовал: ', 'Present: ', 'حاضر: '],
    'Kelmadi: ': ['Отсутствовал: ', 'Absent: ', 'غائب: '],
    'Kechikdi: ': ['Опоздал: ', 'Late: ', 'متأخر: '],
    'Sababli: ': ['По уважительной: ', 'Excused: ', 'بعذر: '],
    'Salom, ': ['Здравствуйте, ', 'Hello, ', 'مرحباً، '],
    ' kuni': ['', '', ''],
    'Oldingi hafta': ['Прошлая неделя', 'Previous week', 'الأسبوع السابق'],
    'Keyingi hafta': ['Следующая неделя', 'Next week', 'الأسبوع القادم'],
    'Oldingi oy': ['Прошлый месяц', 'Previous month', 'الشهر السابق'],
    'Keyingi oy': ['Следующий месяц', 'Next month', 'الشهر القادم'],
    'Oylik hisobot': ['Месячный отчёт', 'Monthly report', 'تقرير شهري'],
    ' davomat hisoboti': [' — отчёт по посещаемости', ' attendance report', ' تقرير الحضور'],
    ' guruhiga o’quvchi qo’shish': [' — добавить ученика в группу', ' — add student to group', ' — إضافة طالب إلى المجموعة'],
    ' — guruhga yozish': [' — записать в группу', ' — enrol in group', ' — تسجيل في مجموعة'],
    'Hisoblash / yangilash': ['Рассчитать / обновить', 'Calculate / refresh', 'احسب / حدّث'],
    ' hisoblarini yaratish': [' — создать начисления', ' — create invoices', ' — إنشاء الفواتير'],
    'Oylik hisoblarni yaratish': ['Создать ежемесячные начисления', 'Create monthly invoices', 'إنشاء الفواتير الشهرية'],
    'Hisobotni Excel’ga yuklash': ['Выгрузить отчёт в Excel', 'Export report to Excel', 'تصدير التقرير إلى Excel'],
    'Tizim ishlashini ko’rsatish uchun demo o’quvchi, guruh va to’lovlar kiritilgan. Haqiqiy ish boshlashdan oldin ularni o’chiring.':
      ['Для демонстрации добавлены демо-ученики, группы и платежи. Удалите их перед началом реальной работы.',
        'Demo students, groups and payments were added to show how the system works. Delete them before starting real work.',
        'أُضيف طلاب ومجموعات ومدفوعات تجريبية لعرض عمل النظام. احذفها قبل بدء العمل الحقيقي.'],
    'Standart parollar (1234) hali o’zgartirilmagan. Sozlamalar → Foydalanuvchilar bo’limida yangi parol qo’ying.':
      ['Стандартные пароли (1234) ещё не изменены. Задайте новый пароль в разделе Настройки → Пользователи.',
        'The default passwords (1234) have not been changed yet. Set a new password in Settings → Users.',
        'لم تُغيَّر كلمات المرور الافتراضية (1234) بعد. عيّن كلمة مرور جديدة في الإعدادات ← المستخدمون.'],
    '. Sozlamalar bo’limida parolni albatta o’zgartiring.':
      ['. Обязательно смените пароль в разделе «Настройки».',
        '. Be sure to change the password in Settings.',
        '. غيّر كلمة المرور في الإعدادات بكل تأكيد.'],
    'Sozlamalarga o’tish': ['Перейти в настройки', 'Go to settings', 'الانتقال إلى الإعدادات'],
    'Namuna ma’lumotlar. ': ['Демо-данные. ', 'Demo data. ', 'بيانات تجريبية. '],
    'Xavfsizlik. ': ['Безопасность. ', 'Security. ', 'الأمان. '],
    'Muddati o’tgan qarz': ['Просроченный долг', 'Overdue debt', 'دين متأخر'],
    'Shu oydagi xarajat': ['Расходы за этот месяц', 'This month’s expenses', 'مصروفات هذا الشهر'],
    'Bugungi darslar': ['Сегодняшние занятия', 'Today’s lessons', 'دروس اليوم'],
    'E’tibor talab qiladi': ['Требует внимания', 'Needs attention', 'يتطلب انتباهاً'],
    'Hammasi joyida': ['Всё в порядке', 'All good', 'كل شيء على ما يرام'],
    'Hozircha kechiktirilgan ish yo’q.': ['Просроченных дел пока нет.', 'Nothing overdue for now.', 'لا توجد أعمال متأخرة حالياً.'],
    'Bugun dars yo’q': ['Сегодня занятий нет', 'No lessons today', 'لا توجد دروس اليوم'],
    'Jadvalga qarang yoki yangi guruh oching.':
      ['Посмотрите расписание или создайте новую группу.',
        'Check the schedule or open a new group.',
        'راجع الجدول أو افتح مجموعة جديدة.'],
    'Ism yoki telefon bo’yicha qidirish': ['Поиск по имени или телефону', 'Search by name or phone', 'ابحث بالاسم أو الهاتف'],
    'Ism yoki telefon': ['Имя или телефон', 'Name or phone', 'الاسم أو الهاتف'],
    'O’quvchini qidirish': ['Поиск ученика', 'Find a student', 'ابحث عن طالب'],
    'so’m': ['сум', 'UZS', 'سوم'],
    ' · Ota-ona: ': [' · Родитель: ', ' · Parent: ', ' · ولي الأمر: '],
    'Muddati o’tgan: ': ['Просрочено: ', 'Overdue: ', 'متأخر: '],
    'Qarzdorlik ': ['Задолженность ', 'Debt ', 'الدين '],
    'Bugun ': ['Сегодня ', 'Today ', 'اليوم '],
    ' dars': [' уроков', ' lessons', ' دروس'],
    ' ta jami': [' всего', ' in total', ' الإجمالي'],
    ' tadan': [' из', ' of', ' من'],
    ' ta yozuv': [' записей', ' records', ' سجلات'],
    ' ta xabar navbatga qo’yildi.': [' сообщений поставлено в очередь.', ' messages queued.', ' رسالة في الانتظار.'],
    ' ta o’quvchiga yuboriladi.': [' ученикам будет отправлено.', ' students will receive it.', ' طالباً سيستلمها.'],
    'Jami: keldi ': ['Всего: присутствовал ', 'Total: present ', 'الإجمالي: حاضر '],
    'Oxirgi o’zgartirish: ': ['Последнее изменение: ', 'Last change: ', 'آخر تعديل: '],
    'Belgilanmagan o’quvchilar avtomatik "Kelmadi" hisoblanmaydi.':
      ['Неотмеченные ученики не считаются автоматически отсутствующими.',
        'Unmarked students are not counted absent automatically.',
        'الطلاب غير المحددين لا يُحتسبون غائبين تلقائياً.'],
    'Salom, ': ['Здравствуйте, ', 'Hello, ', 'مرحباً، '],
    ' ta ruxsat': [' прав', ' permissions', ' صلاحيات'],
    'Kelmadi: ': ['Отсутствовал: ', 'Absent: ', 'غائب: '],
    ' va yana ': [' и ещё ', ' and ', ' و'],
    ' o’quvchi': [' учеников', ' students', ' طالباً'],
    'limit ': ['лимит ', 'limit ', 'الحد '],
    ' tushumi': [' — выручка', ' revenue', ' الإيراد'],
    ' joy)': [' мест)', ' seats)', ' مقعد)'],
    '% tushumdan': ['% от выручки', '% of revenue', '% من الإيراد'],
    ' ta o’quvchiga yuboriladi': [' ученикам будет отправлено', ' students will receive it', ' طالباً سيستلمها'],
    'Keyin guruh kodini so’raydi': ['Затем спросит код группы', 'Then it asks for the group code', 'ثم يسأل عن رمز المجموعة']
  };

  /* Sana, hafta kunlari va valyuta — har bir til uchun */
  var LOCALE = {
    uz: {
      months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
      weekdays: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],
      wshort: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
      som: 'so’m'
    },
    ru: {
      months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
      monthsIn: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
      weekdays: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
      wshort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      som: 'сум'
    },
    en: {
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      wshort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      som: 'UZS'
    },
    ar: {
      months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
      weekdays: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
      wshort: ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد'],
      som: 'سوم'
    }
  };

  /* ---------- Arab raqamlari (٠١٢٣٤٥٦٧٨٩) ---------- */
  var AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  /**
   * Raqamlarni arabcha ko'rinishga o'tkazish.
   * Lotin harfi bor bo'laklar (B020, ALB-202609-0001, admin1) tegilmaydi —
   * ular kod va login, o'zgarsa ish buziladi.
   */
  function toArabicDigits(str) {
    var out = String(str == null ? '' : str)
      .replace(/[A-Za-z][A-Za-z0-9._@-]*|[A-Za-z0-9._@-]*[A-Za-z]|\d/g, function (m) {
        return (m.length === 1 && m >= '0' && m <= '9') ? AR_DIGITS[Number(m)] : m;
      });
    // O'ngdan chapga matnda "4 250 000" yoki "17:00–18:30" teskari ko'rinmasin:
    // butun sonni chapdan-o'ngga majburlaymiz va ichidagi bo'shliqni
    // uzilmas bo'shliqqa almashtiramiz.
    return out.replace(/[٠-٩][٠-٩\s.,:\/\u2013\u2014-]*[٠-٩]|[٠-٩]/g, function (m) {
      return '\u202D' + m.replace(/ /g, '\u00A0') + '\u202C';
    });
  }
  /** Teskarisi — kerak bo'lsa (masalan, qidiruvda) */
  function fromArabicDigits(str) {
    return String(str == null ? '' : str).replace(/[٠-٩]/g, function (c) {
      return String(AR_DIGITS.indexOf(c));
    });
  }

  var I18N = {
    langs: LANGS,
    lang: 'uz',
    map: null,
    fragList: null,
    misses: {},          // tarjimasiz qolgan matnlar (tekshirish uchun)
    debug: false,

    init: function () {
      var saved = null;
      try { saved = localStorage.getItem('albyana_lang'); } catch (e) { }
      this.set(saved || 'uz', true);
    },

    locale: function () { return LOCALE[this.lang] || LOCALE.uz; },

    /** Sana/oy/kun nomlarini tanlangan tilga o'tkazish */
    applyLocale: function () {
      var A = global.A;
      if (!A || !A.MONTHS) return;
      var loc = this.locale();
      function fill(arr, vals) { arr.length = 0; vals.forEach(function (v) { arr.push(v); }); }
      fill(A.MONTHS, loc.months);
      fill(A.WEEKDAYS, loc.weekdays);
      fill(A.WEEKDAYS_SHORT, loc.wshort);
      A.MONTHS_IN = loc.monthsIn || loc.months;
      A.CURRENCY = loc.som;
    },

    set: function (lang, silent) {
      if (!LANGS.some(function (l) { return l.id === lang; })) lang = 'uz';
      this.lang = lang;
      this.misses = {};
      try { localStorage.setItem('albyana_lang', lang); } catch (e) { }
      var conf = LANGS.filter(function (l) { return l.id === lang; })[0];
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', conf.dir);
      if (lang === 'uz') { this.map = null; this.fragList = null; this.subList = null; }
      else {
        var idx = { ru: 0, en: 1, ar: 2 }[lang];
        var m = {};
        Object.keys(T).forEach(function (k) { m[k] = T[k][idx]; });
        this.map = m;
        var fl = Object.keys(FRAG).map(function (k) { return [k, FRAG[k][idx]]; });
        fl.sort(function (a, b) { return b[0].length - a[0].length; });
        this.fragList = fl;
        // uzunroq iboralar ichidagi so'zlarni ham almashtirish uchun
        var sl = Object.keys(T).filter(function (k) { return k.length >= 4; })
          .map(function (k) { return [k, m[k]]; });
        sl.sort(function (a, b) { return b[0].length - a[0].length; });
        this.subList = sl;

        // tarjima natijasida chiqadigan so'zlar (tekshiruvda "tarjimasiz" deb sanalmasin)
        var known = {};
        function addWords(str) {
          (String(str).toLowerCase().match(/[a-zЀ-ӿ؀-ۿ’']+/g) || [])
            .forEach(function (w) { known[w] = 1; });
        }
        Object.keys(m).forEach(function (k) { addWords(m[k]); });
        Object.keys(FRAG).forEach(function (k) { addWords(FRAG[k][idx]); });
        var loc = LOCALE[lang] || LOCALE.uz;
        loc.months.concat(loc.monthsIn || [], loc.weekdays, loc.wshort, [loc.som]).forEach(addWords);
        this.knownWords = known;

        // o'zbekcha (asl) so'zlar — aralash matnni aniqlash uchun
        var uz = {};
        function addUz(str) {
          (String(str).toLowerCase().match(/[a-z’']+/g) || []).forEach(function (w) {
            if (w.length >= 3) uz[w] = 1;
          });
        }
        Object.keys(T).forEach(addUz);
        Object.keys(FRAG).forEach(addUz);
        this.uzWords = uz;
      }
      this.applyLocale();
      if (!silent) this.apply(document.body);
    },

    /** Bu matn ma'lumotmi (ism, telefon, pul, kod) yoki interfeys matnimi? */
    isData: function (s) {
      var t = String(s).trim();
      if (!t) return true;
      if (!/[A-Za-zЀ-ӿ]/.test(t)) return true;          // faqat raqam/belgi
      if (/^\+?\d[\d\s\-()]{5,}$/.test(t)) return true;           // telefon
      if (/^[A-Z]\d{3}$/.test(t)) return true;                    // guruh kodi
      if (/^ALB-\d/.test(t)) return true;                         // chek raqami
      if (/^[A-ZА-Я؀-ۿ]{1,3}$/.test(t)) return true;    // avatar harflari
      if (/^[a-z0-9_.@-]+$/.test(t)) return true;                 // login, fayl nomi
      if (/^\d{4}-\d{2}(-\d{2})?( \d{2}:\d{2})?$/.test(t)) return true; // sana
      // matn to'liq tarjima qilingan so'zlardan iborat bo'lsa (oy, kun nomlari)
      if (this.knownWords) {
        var words = t.toLowerCase().match(/[a-zЀ-ӿ؀-ۿ’']+/g) || [];
        if (words.length && words.every(function (w) { return this.knownWords[w]; }, this)) return true;
      }
      return false;
    },

    /**
     * Almashtirish natijasida so'z buzildimi?
     * (lotin harfi arab/kirill harfiga yopishib qolgan bo'lsa — buzuq)
     */
    _broken: function (out) {
      return /[A-Za-z][\u0600-\u06FF\u0400-\u04FF]|[\u0600-\u06FF\u0400-\u04FF][A-Za-z]/.test(String(out));
    },

    /**
     * Bitta matnni tarjima qilish.
     * Muhim qoida: ARALASH matn chiqmasligi kerak — agar bo'laklarni
     * almashtirgandan keyin ham o'zbekcha so'z qolsa, matn o'zgartirilmaydi
     * va "tarjimasiz" ro'yxatiga yoziladi.
     */
    text: function (s) {
      if (this.lang === 'uz' || !s) return s;
      var trimmed = s.trim();
      if (!trimmed) return s;
      var hit = this.map[trimmed];
      if (hit != null) return s.replace(trimmed, hit);

      // Faqat maxsus tayyorlangan bo'laklar (FRAG) almashtiriladi.
      // Lug'atdagi to'liq iboralarni boshqa matn ichiga qo'yib yubormaymiz —
      // aks holda "Sanani tanlang" → "التاريخni tanlang" kabi buzuq so'z chiqadi.
      var out = s, changed = false;
      for (var i = 0; i < this.fragList.length; i++) {
        var f = this.fragList[i];
        if (out.indexOf(f[0]) >= 0) { out = out.split(f[0]).join(f[1]); changed = true; }
      }
      // "5 ta" kabi sanoq so'zi — faqat raqamdan keyin turgani olib tashlanadi
      var counted = out.replace(/(\d)\s+ta\b/g, '$1');
      if (counted !== out) { out = counted; changed = true; }

      if (changed && this._broken(out)) {
        this.misses[trimmed] = (this.misses[trimmed] || 0) + 1;
        return s;
      }
      if (!changed && !this.isData(trimmed)) {
        this.misses[trimmed] = (this.misses[trimmed] || 0) + 1;
      }
      return changed ? out : s;
    },

    /** Daraxtdagi barcha matnlarni tarjima qilish */
    apply: function (root) {
      if (!root) return;
      var self = this;
      if (root.nodeType === 3) { self._node(root); return; }
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (n) { self._node(n); });
      var attrs = ['placeholder', 'title', 'aria-label'];
      var els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label]') : [];
      Array.prototype.forEach.call(els, function (el) {
        attrs.forEach(function (a) { self._attr(el, a); });
      });
      if (root.matches && root.matches('[placeholder],[title],[aria-label]')) {
        attrs.forEach(function (a) { self._attr(root, a); });
      }
    },

    /**
     * Matn tugunini tarjima qilish.
     * ASL o'zbekcha matn eslab qolinadi — shuning uchun tilni qayta
     * almashtirganda tarjima ustiga tarjima tushmaydi va o'zbekchaga
     * qaytganda hamma joy o'zbekcha bo'ladi.
     */
    _node: function (n) {
      if (!n.nodeValue) return;
      if (n.parentNode && (n.parentNode.tagName === 'SCRIPT' || n.parentNode.tagName === 'STYLE')) return;
      var src = (n.__albOut != null && n.nodeValue === n.__albOut && n.__albSrc != null)
        ? n.__albSrc : n.nodeValue;
      if (this.lang === 'uz') {
        if (src !== n.nodeValue) n.nodeValue = src;
        n.__albSrc = null; n.__albOut = null;
        return;
      }
      if (!src.trim()) return;
      var t = this.text(src);
      if (this.lang === 'ar') t = toArabicDigits(t);
      if (t !== n.nodeValue) n.nodeValue = t;
      n.__albSrc = src; n.__albOut = t;
    },

    /** Atributlar uchun ham xuddi shunday (placeholder, title, aria-label) */
    _attr: function (el, a) {
      var cur = el.getAttribute(a);
      if (cur == null) return;
      el.__albAttr = el.__albAttr || {};
      var mem = el.__albAttr[a];
      var src = (mem && mem.out === cur) ? mem.src : cur;
      if (this.lang === 'uz') {
        if (src !== cur) el.setAttribute(a, src);
        delete el.__albAttr[a];
        return;
      }
      if (!String(src).trim()) return;
      var t = this.text(src);
      if (t !== cur) el.setAttribute(a, t);
      el.__albAttr[a] = { src: src, out: t };
    },

    /** Yangi qo'shilgan tugunlarni avtomatik tarjima qilish */
    observe: function () {
      var self = this;
      if (!global.MutationObserver) return;
      var obs = new MutationObserver(function (muts) {
        if (self.lang === 'uz') return;
        muts.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes, function (n) {
            if (n.nodeType === 1 || n.nodeType === 3) self.apply(n);
          });
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  };

  global.A = global.A || {};
  global.A.I18N = I18N;
  global.A.arDigits = toArabicDigits;
  global.A.latinDigits = fromArabicDigits;
  global.A.t = function (s) { return I18N.text(s); };
})(typeof window !== 'undefined' ? window : globalThis);
