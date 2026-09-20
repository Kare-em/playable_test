/*
 * Локализация игры.
 *
 * Ключ — сама русская фраза (подход gettext). Так не приходится выдумывать
 * идентификаторы полутора сотням строк, диффы остаются читаемыми, а
 * пропущенный перевод честно показывает русский оригинал, а не пустоту или
 * «missing.key» в интерфейсе игрока.
 *
 * Язык берётся у площадки, иначе у браузера. Всё, что не русский, ведём на
 * английский: по оценке рынка около 40% трафика Яндекс Игр русского не
 * понимает, и английский покрывает эту долю целиком.
 *
 * Данные (названия товаров, отделов, апгрейдов) остаются на русском и
 * переводятся в момент отрисовки, а не при загрузке: язык становится
 * известен только после ответа SDK, то есть позже, чем строятся массивы.
 */
(function () {
  var EN = {
    /* --- товары --- */
    'Молоко': 'Milk', 'Сыр': 'Cheese', 'Йогурт': 'Yogurt', 'Масло': 'Butter',
    'Творог': 'Curd', 'Сметана': 'Sour cream', 'Кефир': 'Kefir', 'Мороженое': 'Ice cream',
    'Хлеб': 'Bread', 'Крупа': 'Grains', 'Печенье': 'Cookie', 'Консервы': 'Canned food',
    'Макароны': 'Pasta', 'Чай': 'Tea', 'Кофе': 'Coffee', 'Сахар': 'Sugar',
    'Яблоко': 'Apple', 'Морковь': 'Carrot', 'Помидор': 'Tomato', 'Виноград': 'Grapes',
    'Банан': 'Banana', 'Огурец': 'Cucumber', 'Картофель': 'Potato', 'Лимон': 'Lemon',
    'Колбаса': 'Sausage', 'Курица': 'Chicken', 'Стейк': 'Steak', 'Сосиски': 'Wieners',
    'Фарш': 'Ground meat', 'Рыба': 'Fish',
    'Мыло': 'Soap', 'Порошок': 'Detergent', 'Спрей': 'Spray', 'Губка': 'Sponge',
    'Бумага': 'Paper', 'Перчатки': 'Gloves',

    /* --- отделы --- */
    'Молочка': 'Dairy', 'Бакалея': 'Grocery', 'Овощи': 'Produce',
    'Мясо': 'Meat', 'Химия': 'Household',

    /* --- апгрейды --- */
    'Прилавок': 'Shelf', 'Холодильник': 'Fridge', 'Тележка': 'Cart', 'Касса': 'Register',
    'Овощной прилавок': 'Produce aisle', 'Мясной прилавок': 'Meat counter',
    'Отдел химии': 'Household aisle', 'Реклама': 'Flyers', 'Вывеска': 'Signboard',
    'Больше места на прилавке — меньше тупиков': 'More shelf space means fewer dead ends',
    'Место, чтобы отложить неудобный товар': 'Somewhere to park an awkward item',
    'Видно больше вариантов на завозе': 'See more of the delivery at once',
    'Заряд бустерам': 'Boosters recharge',
    ' заряд бустерам': ' booster charge',
    'Первый новый отдел: дешёвый товар, короткий срок':
      'First new aisle: cheap goods, short shelf life',
    'Дорогой товар, но портится быстрее всех': 'Pricey goods that spoil the fastest',
    'Дорогой товар, который почти не портится': 'Pricey goods that barely spoil at all',
    'Листовки приводят больше людей': 'Flyers bring in more shoppers',
    'Покупатели ждут дольше': 'Shoppers wait longer',
    ' к терпению покупателей': ' to shopper patience',
    ' покупатель в очереди': ' shopper in the queue',
    ' слот хранения': ' storage slot',
    ' ячейка завоза': ' delivery slot',
    ' слот в бакалее': ' grocery slot',
    'открыт отдел овощей': 'produce aisle unlocked',
    'открыт отдел мяса': 'meat aisle unlocked',
    'открыт отдел бытовой химии': 'household aisle unlocked',

    /* --- игровой экран --- */
    'ВЫРУЧКА СМЕНЫ': 'SHIFT REVENUE',
    'ПОСТАВКА': 'DELIVERY',
    'ХОЛОДИЛЬНИК': 'FRIDGE',
    'ПРОДУКТЫ · ТОРГОВЫЙ ЗАЛ': 'GROCERIES · SHOP FLOOR',
    'КАЖДЫЙ ТОВАР В СВОЙ ОТДЕЛ': 'EVERY ITEM IN ITS OWN AISLE',
    'КАЖДЫЙ ТОВАР В СВОЙ ОТДЕЛ · ТРИ ОДИНАКОВЫХ = ПРОДАЖА':
      'EVERY ITEM IN ITS AISLE · THREE ALIKE = A SALE',
    'Все отделы открыты: покупатели ждут корзину целиком':
      'All aisles open: shoppers now wait for the whole basket',
    'Обслужено': 'Served',
    'Обслужено  ': 'Served  ',
    'комбо': 'combo',
    'Смена ': 'Shift ',
    'смен подряд: ': 'streak: ',
    'осталось ': 'left: ',
    'Акция дня: ': 'Deal of the day: ',
    'ждём покупателя': 'waiting for a shopper',
    'ждёт ещё ': 'waits ',
    'ждёт': 'waiting',
    'доволен': 'happy',
    'нервничает': 'impatient',
    'вот-вот уйдёт': 'about to leave',
    'заказ!': 'order!',
    '  заказ!': '  order!',
    'не своя зона': 'wrong aisle',
    'Бустеры': 'Boosters',
    'вернуть ': 'undo ',
    'КОМБО ×': 'COMBO ×',
    'ЗАКАЗ ГОТОВ!': 'ORDER READY!',

    /* --- подсказки и сообщения --- */
    'Сначала возьмите товар с завоза': 'Pick an item from the delivery first',
    'Выберите товар для холодильника': 'Choose an item for the fridge',
    'Холодильник полон': 'The fridge is full',
    'Товар отложен в холодильник': 'Item parked in the fridge',
    'Товар возвращён': 'Move undone',
    'Нечего возвращать': 'Nothing to undo',
    'Завоз перемешан': 'Delivery reshuffled',
    'Покупатель ушёл не дождавшись': 'A shopper left without waiting',
    'Некуда выложить товар — зоны забиты': 'Nowhere to put it: every aisle is full',
    'В зоне «{zone}» нет места': 'The {zone} aisle is full',
    '{item} — в зону «{zone}»': '{item} goes to {zone}',
    'Просрочка: списано на ': 'Expired: written off for ',
    'Прогресс восстановлен из облака': 'Progress restored from the cloud',
    'Ролик не досмотрен — награда не начислена': 'Video not finished — no reward given',
    'Реклама сейчас недоступна': 'Ads are unavailable right now',

    /* --- итоги смены --- */
    'Смена закрыта!': 'Shift complete!',
    'Смена сорвана': 'Shift failed',
    'Выручка': 'Revenue',
    'Ушли не дождавшись': 'Left without waiting',
    'Списано просрочки': 'Written off',
    'Лучшее комбо': 'Best combo',
    'Смен подряд': 'Streak',
    'Слишком много ушедших покупателей': 'Too many shoppers walked out',
    'Прилавок забит — смена сорвана': 'The shelf is jammed — shift failed',
    'Завоз кончился, план не выполнен': 'Delivery ran out and the plan fell short',
    'план не выполнен': 'the plan fell short',
    'В магазин': 'To the shop',
    'В магазин  ·  ': 'To the shop  ·  ',
    'выручка ушла в кассу': 'revenue went to the till',
    'Переиграть': 'Replay',
    'Переиграть с бустерами': 'Replay with boosters',
    'Удвоить выручку': 'Double the revenue',
    'за просмотр рекламы': 'for watching an ad',
    '+2 к каждому за просмотр рекламы': '+2 of each for watching an ad',

    /* --- магазин --- */
    'Ваш магазин': 'Your shop',
    'Открыть смену ': 'Open shift ',
    'Максимум': 'Maxed out',
    'Закрыть': 'Close',
    'рекорд ': 'best ',
    'сбросить прогресс': 'reset progress',

    /* --- журнал плейтеста --- */
    'Журнал плейтеста': 'Playtest log',
    'журнал плейтеста': 'playtest log',
    'Скопируйте текст ниже и пришлите — в нём вся сессия.':
      'Copy the text below and send it — the whole session is in there.',
    'Скопировать': 'Copy',
    'Скопировано': 'Copied',
    'Выделите текст и скопируйте вручную': 'Select the text and copy it manually',
    'Очистить': 'Clear',
    'Стереть журнал плейтеста?': 'Erase the playtest log?',
    'Журнал очищен': 'Log cleared',
    'Сборка': 'Build',
    'без отметки': 'unmarked',
    'Время в игре': 'Time played',
    'Смен сыграно': 'Shifts played',
    'Ушло покупателей': 'Shoppers lost',
    'Просрочка': 'Expired',
    'Переигровок / апгрейдов': 'Replays / upgrades',
    'Тапов по чужой зоне': 'Taps on the wrong aisle',
    'Тапов по забитой зоне': 'Taps on a full aisle',
    'Чаще пользуйтесь бустерами смены': 'Use the shift boosters more often',
    'Срыв: ': 'Failed: ',
    ' (побед ': ' (wins ',
    ' мин': ' min',
    ' шт · ': ' pcs · ',
    ' шт на ': ' pcs for ',
    ', отложить ': ', park ',
    ', перемешать ': ', reshuffle ',
    ', сейчас ': ', now ',
    ', сорвано ': ', failed ',
    ' ₽': ' ₽'
  };

  var lang = 'ru';

  /** Всё, что не русский, ведём на английский. */
  function normalize(code) {
    return String(code || '').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en';
  }

  function detect() {
    var code = null;
    try { code = window.YGames && window.YGames.isPlatform() && window.YGames.lang(); } catch (e) {}
    if (!code) {
      try { code = navigator.language || (navigator.languages || [])[0]; } catch (e) {}
    }
    lang = normalize(code || 'ru');
    return lang;
  }

  /** T('фраза') или T('ждёт {n}', { n: 5 }) — подстановка по именам. */
  window.T = function (s, p) {
    var out = (lang === 'en' && EN[s] !== undefined) ? EN[s] : s;
    if (p) {
      out = out.replace(/\{(\w+)\}/g, function (m, k) {
        return p[k] !== undefined && p[k] !== null ? p[k] : m;
      });
    }
    return out;
  };

  window.I18N = {
    detect: detect,
    get: function () { return lang; },
    set: function (code) { lang = normalize(code); return lang; },
    has: function (s) { return EN[s] !== undefined; },
    keys: function () { return Object.keys(EN); }
  };

  detect();     // язык браузера известен сразу; площадка уточнит его после init
})();
