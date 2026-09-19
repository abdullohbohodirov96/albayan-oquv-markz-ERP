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
    'Dekabr': ['Декабрь', 'December', 'ديسمبر']
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
    'Ism yoki telefon bo’yicha qidirish': ['Поиск по имени или телефону', 'Search by name or phone', 'ابحث بالاسم أو الهاتف'],
    'Ism yoki telefon': ['Имя или телефон', 'Name or phone', 'الاسم أو الهاتف'],
    'O’quvchini qidirish': ['Поиск ученика', 'Find a student', 'ابحث عن طالب']
  };

  var I18N = {
    langs: LANGS,
    lang: 'uz',
    map: null,
    fragList: null,

    init: function () {
      var saved = null;
      try { saved = localStorage.getItem('albyana_lang'); } catch (e) { }
      this.set(saved || 'uz', true);
    },

    set: function (lang, silent) {
      if (!LANGS.some(function (l) { return l.id === lang; })) lang = 'uz';
      this.lang = lang;
      try { localStorage.setItem('albyana_lang', lang); } catch (e) { }
      var conf = LANGS.filter(function (l) { return l.id === lang; })[0];
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', conf.dir);
      if (lang === 'uz') { this.map = null; this.fragList = null; }
      else {
        var idx = { ru: 0, en: 1, ar: 2 }[lang];
        var m = {};
        Object.keys(T).forEach(function (k) { m[k] = T[k][idx]; });
        this.map = m;
        var fl = Object.keys(FRAG).map(function (k) { return [k, FRAG[k][idx]]; });
        fl.sort(function (a, b) { return b[0].length - a[0].length; });
        this.fragList = fl;
      }
      if (!silent) this.apply(document.body);
    },

    /** Bitta matnni tarjima qilish */
    text: function (s) {
      if (this.lang === 'uz' || !s) return s;
      var trimmed = s.trim();
      if (!trimmed) return s;
      var hit = this.map[trimmed];
      if (hit != null) return s.replace(trimmed, hit);
      var out = s, changed = false;
      for (var i = 0; i < this.fragList.length; i++) {
        var f = this.fragList[i];
        if (out.indexOf(f[0]) >= 0) { out = out.split(f[0]).join(f[1]); changed = true; }
      }
      return changed ? out : s;
    },

    /** Daraxtdagi barcha matnlarni tarjima qilish */
    apply: function (root) {
      if (this.lang === 'uz' || !root) return;
      var self = this;
      if (root.nodeType === 3) { self._node(root); return; }
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (n) { self._node(n); });
      var attrs = ['placeholder', 'title', 'aria-label'];
      var els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label]') : [];
      Array.prototype.forEach.call(els, function (el) {
        attrs.forEach(function (a) {
          var v = el.getAttribute(a);
          if (!v) return;
          var t = self.text(v);
          if (t !== v) el.setAttribute(a, t);
        });
      });
      if (root.matches && root.matches('[placeholder],[title],[aria-label]')) {
        attrs.forEach(function (a) {
          var v = root.getAttribute(a);
          if (!v) return;
          var t = self.text(v);
          if (t !== v) root.setAttribute(a, t);
        });
      }
    },

    _node: function (n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return;
      if (n.parentNode && (n.parentNode.tagName === 'SCRIPT' || n.parentNode.tagName === 'STYLE')) return;
      if (n.__albTr === n.nodeValue) return;
      var t = this.text(n.nodeValue);
      if (t !== n.nodeValue) { n.nodeValue = t; n.__albTr = t; }
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
  global.A.t = function (s) { return I18N.text(s); };
})(typeof window !== 'undefined' ? window : globalThis);
