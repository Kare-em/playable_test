/*
 * «Магазин у дома» — прототип кор-лупа (PixiJS 8).
 *
 * Кор: общий прилавок — единственный ресурс смены. Любые три одинаковых товара
 * на прилавке продаются. Прилавок разбит на зоны: выложил товар в свою — платят
 * в полтора раза больше и растёт комбо, но места в «своей» зоне почти всегда не
 * хватает, и это главный выбор каждого хода. Сверху ждут покупатели с заказами
 * и терпением: заказ даёт +50% и двигает план смены, но держать товар под заказ
 * значит занимать слоты, которых мало.
 *
 * Метрика плейтеста — смен подряд, см. HUD и экран результата.
 */
(function () {
  'use strict';

  var W = 1280, H = 720;          // горизонтальная раскладка

  // Отметка сборки. В исходниках это 'dev', а при сборке ссылки сюда
  // подставляется время публикации: новая сборка — новая отметка, и прогресс
  // игрока обнуляется, чтобы плейтест всегда начинался с первой смены.
  var BUILD = 'dev';

  /* ---------------------------------------------------------------- контент */

  // Зоны прилавка. Вместимость зоны меньше, чем хочется, — в этом весь конфликт.
  var ZONES = [
    // четыре слота: тройку в своей зоне можно собрать, и ещё остаётся ход про запас
    { id: 'dairy',   name: 'Молочка', slots: 4, color: 0x1C6FD0, tint: 0xE8F0FA },
    { id: 'grocery', name: 'Бакалея', slots: 4, color: 0xC9720A, tint: 0xFBF0DE },
    { id: 'produce', name: 'Овощи',   slots: 4, color: 0x2A8F3B, tint: 0xE6F4E8 },
    // мясной отдел открывается покупкой в магазине
    { id: 'meat',    name: 'Мясо',    slots: 4, color: 0xB2382A, tint: 0xFBE4DF },
    { id: 'chem',    name: 'Химия',   slots: 4, color: 0x2E7F9E, tint: 0xE2F0F6 }
  ];

  // Зоны, которые сейчас работают: мясной прилавок появляется после покупки.
  // Магазин начинается с двух отделов, остальные докупаются — и каждый
  // следующий дороже предыдущего.
  // Пока магазин не достроен, покупатель разбирает полку по одной позиции.
  // Когда выкуплены все отделы, включается правило целой корзины: он ждёт,
  // пока весь набор не окажется на полках, и забирает разом. Финальная стадия
  // магазина — это уже головоломка про место.
  function wholeBasketMode() { return activeZones().length === ZONES.length; }

  function activeZones() {
    return ZONES.filter(function (z) {
      if (z.id === 'produce') return meta.up.produce > 0;
      if (z.id === 'meat') return meta.up.meat > 0;
      if (z.id === 'chem') return meta.up.chem > 0;
      return true;
    });
  }

  var PRODUCTS = [
    { id: 'milk',   name: 'Молоко',   glyph: '🥛', section: 'dairy',   price: 40, color: 0xC6E2FB, accent: 0x80C1FC },
    { id: 'cheese', name: 'Сыр',      glyph: '🧀', section: 'dairy',   price: 55, color: 0xFFE7AE, accent: 0xFFC21C },
    { id: 'yogurt', name: 'Йогурт',   glyph: '🍶', section: 'dairy',   price: 35, color: 0xD7E4F5, accent: 0xF19DC4 },
    { id: 'butter', name: 'Масло',    glyph: '🧈', section: 'dairy',   price: 60, color: 0xFDECBA, accent: 0xFFDC64 },
    { id: 'curd',   name: 'Творог',   glyph: '🥣', section: 'dairy',   price: 55, color: 0xF7F1E4, accent: 0x4FA8DC },
    { id: 'sourcream', name: 'Сметана', glyph: '🥛', section: 'dairy', price: 50, color: 0xF3F6F8, accent: 0x37A778 },
    { id: 'kefir',  name: 'Кефир',    glyph: '🥛', section: 'dairy',   price: 45, color: 0xF4F8FB, accent: 0x3FA96F },
    { id: 'icecream', name: 'Мороженое', glyph: '🍦', section: 'dairy', price: 65, color: 0xFBE3EC, accent: 0xE58AAC },
    { id: 'kefir',  name: 'Кефир',    glyph: '🥛', section: 'dairy',   price: 45, color: 0xF4F8FB, accent: 0x3FA96F },
    { id: 'icecream', name: 'Мороженое', glyph: '🍦', section: 'dairy', price: 65, color: 0xFBE3EC, accent: 0xE58AAC },
    { id: 'bread',  name: 'Хлеб',     glyph: '🍞', section: 'grocery', price: 30, color: 0xFDDCA4, accent: 0xFF9F32 },
    { id: 'grain',  name: 'Крупа',    glyph: '🍚', section: 'grocery', price: 45, color: 0xF2E4CA, accent: 0xE5C776 },
    { id: 'cookie', name: 'Печенье',  glyph: '🍪', section: 'grocery', price: 50, color: 0xF7D3A2, accent: 0xE58227 },
    { id: 'can',    name: 'Консервы', glyph: '🥫', section: 'grocery', price: 65, color: 0xF3C6B8, accent: 0xF16C4C },
    { id: 'pasta',  name: 'Макароны', glyph: '🍝', section: 'grocery', price: 40, color: 0xFFE9B8, accent: 0xE0A82E },
    { id: 'tea',    name: 'Чай',      glyph: '🍵', section: 'grocery', price: 70, color: 0xF2C0C6, accent: 0xC7455C },
    { id: 'coffee', name: 'Кофе',     glyph: '☕', section: 'grocery', price: 90, color: 0xD9BCA4, accent: 0x5C3A22 },
    { id: 'sugar',  name: 'Сахар',    glyph: '🧂', section: 'grocery', price: 35, color: 0xEFF3F7, accent: 0x2E7FBE },
    { id: 'coffee', name: 'Кофе',     glyph: '☕', section: 'grocery', price: 90, color: 0xD9BCA4, accent: 0x5C3A22 },
    { id: 'sugar',  name: 'Сахар',    glyph: '🧂', section: 'grocery', price: 35, color: 0xEFF3F7, accent: 0x2E7FBE },
    { id: 'apple',  name: 'Яблоко',   glyph: '🍎', section: 'produce', price: 35, color: 0xFBC2BF, accent: 0xFF675B },
    { id: 'carrot', name: 'Морковь',  glyph: '🥕', section: 'produce', price: 25, color: 0xFFD7AF, accent: 0xFF9B36 },
    { id: 'tomato', name: 'Помидор',  glyph: '🍅', section: 'produce', price: 40, color: 0xFFC2B5, accent: 0xFF4D3C },
    { id: 'grape',  name: 'Виноград', glyph: '🍇', section: 'produce', price: 70, color: 0xDCC9F3, accent: 0xAA78E2 },
    { id: 'banana', name: 'Банан',    glyph: '🍌', section: 'produce', price: 45, color: 0xFFF0A8, accent: 0xE8B81C },
    { id: 'cucumber', name: 'Огурец', glyph: '🥒', section: 'produce', price: 30, color: 0xDAF0C4, accent: 0x4E9B35 },
    { id: 'potato', name: 'Картофель', glyph: '🥔', section: 'produce', price: 25, color: 0xE8CB94, accent: 0xC29A5C },
    { id: 'lemon',  name: 'Лимон',    glyph: '🍋', section: 'produce', price: 40, color: 0xFFF6B0, accent: 0xF5D129 },
    { id: 'potato', name: 'Картофель', glyph: '🥔', section: 'produce', price: 25, color: 0xE8CB94, accent: 0xC29A5C },
    { id: 'lemon',  name: 'Лимон',    glyph: '🍋', section: 'produce', price: 40, color: 0xFFF6B0, accent: 0xF5D129 },
    { id: 'sausage',name: 'Колбаса',  glyph: '🌭', section: 'meat',    price: 80, color: 0xF3C7BE, accent: 0xC0503C },
    { id: 'chicken',name: 'Курица',   glyph: '🍗', section: 'meat',    price: 90, color: 0xF7DCB4, accent: 0xD9963C },
    { id: 'steak',  name: 'Стейк',    glyph: '🥩', section: 'meat',    price: 110, color: 0xF0BDB2, accent: 0xAE362A },
    { id: 'wieners',name: 'Сосиски',  glyph: '🌭', section: 'meat',    price: 70, color: 0xF3C8BC, accent: 0xD96A50 },
    { id: 'mince',  name: 'Фарш',     glyph: '🍖', section: 'meat',    price: 85, color: 0xF0C3B8, accent: 0xC04A35 },
    { id: 'fish',   name: 'Рыба',     glyph: '🐟', section: 'meat',    price: 95, color: 0xCFE6F2, accent: 0x6FA9C9 },
    { id: 'mince',  name: 'Фарш',     glyph: '🍖', section: 'meat',    price: 85, color: 0xF0C3B8, accent: 0xC04A35 },
    { id: 'fish',   name: 'Рыба',     glyph: '🐟', section: 'meat',    price: 95, color: 0xCFE6F2, accent: 0x6FA9C9 },
    { id: 'soap',   name: 'Мыло',     glyph: '🧼', section: 'chem',    price: 60, color: 0xFCEFC4, accent: 0xE0B23A },
    { id: 'powder', name: 'Порошок',  glyph: '🧴', section: 'chem',    price: 95, color: 0xCFE6F7, accent: 0x3E8FC6 },
    { id: 'spray',  name: 'Спрей',    glyph: '🧽', section: 'chem',    price: 85, color: 0xD3F0E1, accent: 0x36A57C },
    { id: 'sponge', name: 'Губка',    glyph: '🧴', section: 'chem',    price: 35, color: 0xFFE98F, accent: 0x3FAE86 },
    { id: 'paper',  name: 'Бумага',   glyph: '🧻', section: 'chem',    price: 45, color: 0xF6F1E8, accent: 0xB08F5E },
    { id: 'gloves', name: 'Перчатки', glyph: '🧤', section: 'chem',    price: 40, color: 0xFFE1A8, accent: 0xEA7BA8 },
    { id: 'paper',  name: 'Бумага',   glyph: '🧻', section: 'chem',    price: 45, color: 0xF6F1E8, accent: 0xB08F5E },
    { id: 'gloves', name: 'Перчатки', glyph: '🧤', section: 'chem',    price: 40, color: 0xFFE1A8, accent: 0xEA7BA8 }
  ];

  // План смены — обслуженные покупатели, а не просто проданные тройки.
  // crates = 3 × goal + запас: завоз соразмерен тому, что реально закажут,
  // иначе лишний товар оседает на полке и уходит в просрочку.
  // Завоз считается от спроса: три товара на каждый заказ плана, плюс полка
  // (часть завоза всегда лежит собранной наполовину) и небольшой запас на
  // просрочку. Раньше завоз был вдвое больше спроса, и лишнее просто портилось.
  var SPARE = 6;               // запас сверх плана и полки, в штуках
  var SHIFTS = [
    { types: 6,  crates: 30, goal: 6, patience: 12, visible: 5, lives: 4, sale: false },
    { types: 8,  crates: 36, goal: 9, patience: 13, visible: 6, lives: 3, sale: false },
    { types: 10, crates: 39, goal: 9, patience: 14, visible: 6, lives: 3, sale: true  }
    // дальше ассортимент растёт формулой в shiftConfig: +2 позиции за смену
  ];

  var QUEUE_SIZE = 3;
  var BELT_VISIBLE_MAX = 6;
  var FRIDGE_BASE = 3;
  var COMBO_MAX_MULT = 3;
  var COST_RATE = 0.4;         // себестоимость товара — доля от цены
  // Бытовая химия практически не портится — в этом её смысл как отдела.
  var LIFE = { dairy: 7, grocery: 12, produce: 6, meat: 5, chem: 30 };
  var DEMAND_PULL = 0.35;      // как часто нужный товар подтягивается из глубины завоза
  var DEMAND_DEPTH = 12;       // насколько глубоко за ним лезем
  var ORDER_MULT = 1.5;        // бонус за заказ покупателя
  var ZONE_MULT = 1.5;         // бонус за выкладку в свою зону

  /* ------------------------------------------------------------- палитра */

  var C = {
    wallTop: 0xFFF6E7, wallBot: 0xF2DDBD, floor: 0xB9793F,
    steel: 0xD9B276, steelDark: 0x7A5330, steelLight: 0xF7E3C2, shelf: 0xFFF3DE,
    ink: 0x4A3320, inkSoft: 0x8A6E4E,
    panel: 0xFFFBF1, gold: 0xF5B324,
    green: 0x57B84A, red: 0xE0563E,
    sign: 0xC9452F, signAlt: 0xFFF0C8,
    hudBg: 0x3A2717, hudInk: 0xFFF3DC, hudInkSoft: 0xC9A87E, hudTrack: 0x54381F,
    cardboard: 0xD1904F, cardboardLight: 0xEFC188, chill: 0xE6F3FA
  };

  /* -------------------------------------------------------------- утилиты */

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x751F85F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function productById(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }

  function money(v) { return Math.round(v) + ' ₽'; }

  function mix(a, b, t) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return ((ar + (br - ar) * t) << 16 | (ag + (bg - ag) * t) << 8 | (ab + (bb - ab) * t)) & 0xFFFFFF;
  }

  function sfx(name, param) { if (window.ShopAudio) window.ShopAudio.play(name, param); }

  /* ------------------------------------------------- мета: касса и апгрейды */

  var UPGRADES = [
    { id: 'counter', name: 'Прилавок', max: 2, prices: [2500, 6000],
      effect: function (l) { return '+' + l + ' слот в бакалее'; },
      hint: 'Больше места на прилавке — меньше тупиков' },
    { id: 'fridge',  name: 'Холодильник', max: 2, prices: [1500, 3500],
      effect: function (l) { return '+' + l + ' слот хранения'; },
      hint: 'Место, чтобы отложить неудобный товар' },
    { id: 'cart',    name: 'Тележка', max: 2, prices: [1200, 2800],
      effect: function (l) { return '+' + l + ' ячейка завоза'; },
      hint: 'Видно больше вариантов на завозе' },
    { id: 'cash',    name: 'Касса', max: 2, prices: [1800, 4000],
      effect: function (l) { return '+' + l + ' заряд бустерам'; },
      hint: 'Чаще пользуйтесь бустерами смены' },
    { id: 'produce', name: 'Овощной прилавок', max: 1, prices: [6500],
      effect: function () { return 'открыт отдел овощей'; },
      hint: 'Первый новый отдел: дешёвый товар, короткий срок' },
    { id: 'meat',    name: 'Мясной прилавок', max: 1, prices: [13000],
      effect: function () { return 'открыт отдел мяса'; },
      hint: 'Дорогой товар, но портится быстрее всех' },
    { id: 'chem',    name: 'Отдел химии', max: 1, prices: [24000],
      effect: function () { return 'открыт отдел бытовой химии'; },
      hint: 'Дорогой товар, который почти не портится' },
    { id: 'ads',     name: 'Реклама', max: 2, prices: [1600, 3600],
      effect: function (l) { return '+' + l + ' покупатель в очереди'; },
      hint: 'Листовки приводят больше людей' },
    { id: 'sign',    name: 'Вывеска', max: 3, prices: [2000, 4500, 9000],
      effect: function (l) { return '+' + (l * 5) + ' к терпению покупателей'; },
      hint: 'Покупатели ждут дольше' }
  ];

  var META_KEY = 'shopsort.meta';
  var metaResetFrom = null;          // сборка, чей прогресс обнулили при старте
  var meta = loadMeta();             // объявление выше: loadMeta пишет в metaResetFrom

  function defaultMeta() {
    return { build: BUILD, wallet: 0, shiftIdx: 0, streak: 0, total: 0,
             up: { counter: 0, fridge: 0, cart: 0, cash: 0,
                   produce: 0, meat: 0, chem: 0, ads: 0, sign: 0 } };
  }

  function loadMeta() {
    try {
      var raw = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return defaultMeta();
      if (raw.build !== BUILD) {                 // сборка сменилась — прогресс сносим
        metaResetFrom = raw.build || 'без отметки';
        return defaultMeta();
      }
      var d = defaultMeta();
      d.wallet = Number(raw.wallet) || 0;
      d.shiftIdx = Number(raw.shiftIdx) || 0;
      d.streak = Number(raw.streak) || 0;
      d.total = Number(raw.total) || 0;
      UPGRADES.forEach(function (u) {
        d.up[u.id] = Math.min(Number(raw.up && raw.up[u.id]) || 0, u.max);
      });
      return d;
    } catch (e) { return defaultMeta(); }
  }

  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
  }

  /* ------------------------------------------------------- журнал плейтеста */
  // Плейтест идёт на чужих телефонах, где консоли нет. Всё, ради чего мы вообще
  // смотрим на игрока (смены подряд, попадание в свою зону, тяга к «Вернуть»),
  // копится в localStorage и выгружается текстом с экрана магазина.

  var LOG_KEY = 'shopsort.log';
  var LOG_MAX = 400;                  // событий; старые вытесняются
  var logEvents = loadLog();
  var shiftStat = null;               // счётчики текущей смены

  function loadLog() {
    try {
      var raw = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }

  function saveLog() {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(logEvents)); }
    catch (e) {                       // кончилось место — режем историю пополам
      logEvents = logEvents.slice(-Math.floor(LOG_MAX / 2));
      try { localStorage.setItem(LOG_KEY, JSON.stringify(logEvents)); } catch (e2) {}
    }
  }

  function logEvent(type, data) {
    var ev = { at: Date.now(), type: type };
    if (data) for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) ev[k] = data[k];
    logEvents.push(ev);
    if (logEvents.length > LOG_MAX) logEvents.splice(0, logEvents.length - LOG_MAX);
    saveLog();
    return ev;
  }

  function clearLog() { logEvents = []; saveLog(); }

  function upgradeSnapshot() {
    var out = {};
    UPGRADES.forEach(function (u) { out[u.id] = meta.up[u.id]; });
    return out;
  }

  function filledSlots() {
    return state.tray.filter(function (c) { return c; }).length;
  }

  // Бустер пишем поштучно: важно не сколько, а в какой момент за него берутся.
  function logBooster(kind) {
    logEvent('booster', { kind: kind, shift: state.shiftIdx + 1,
      move: shiftStat ? shiftStat.moves : 0, filled: filledSlots(), tray: state.tray.length,
      combo: state.combo, served: state.served, goal: state.goal, lost: state.lost });
  }

  // Сводка под три вопроса протокола плейтеста, а не «вся статистика вообще».
  function logSummary() {
    var s = { shifts: 0, won: 0, lost: 0, streakMax: 0, streakNow: streak,
              moves: 0, home: 0, denyFull: 0, denyZone: 0, lostCustomers: 0,
              spoiled: 0, writeOff: 0,
              undo: 0, fridge: 0, shuffle: 0, retries: 0, upgrades: 0,
              minutes: 0, reasons: {} };
    var first = { m: 0, h: 0 }, late = { m: 0, h: 0 };
    logEvents.forEach(function (e) {
      if (e.type === 'shift_end') {
        s.shifts++;
        if (e.status === 'won') s.won++;
        else {
          s.lost++;
          var why = e.reason || 'план не выполнен';
          s.reasons[why] = (s.reasons[why] || 0) + 1;
        }
        s.streakMax = Math.max(s.streakMax, e.streak || 0);
        s.moves += e.moves || 0;
        s.home += e.home || 0;
        s.denyFull += e.denyFull || 0;
        s.denyZone += e.denyZone || 0;
        s.spoiled += e.spoiled || 0;
        s.writeOff += e.writeOff || 0;
        s.lostCustomers += e.lost || 0;
        s.minutes += (e.sec || 0) / 60;
        var bucket = e.shift === 1 ? first : (e.shift >= 3 ? late : null);
        if (bucket) { bucket.m += e.moves || 0; bucket.h += e.home || 0; }
      } else if (e.type === 'booster') {
        if (s[e.kind] != null) s[e.kind]++;
      } else if (e.type === 'retry') s.retries++;
      else if (e.type === 'upgrade') s.upgrades++;
    });
    s.homeRate = s.moves ? s.home / s.moves : null;
    s.homeRateFirst = first.m ? first.h / first.m : null;
    s.homeRateLate = late.m ? late.h / late.m : null;
    s.minutes = Math.round(s.minutes * 10) / 10;
    return s;
  }

  function logText() {
    return JSON.stringify({ v: 1, saved: new Date().toISOString(),
                            summary: logSummary(), events: logEvents });
  }

  /* ---------------------------------------------- экран журнала (обычный DOM) */
  // Здесь нужны выделение текста и системное «скопировать», поэтому панель
  // рисуется не в Pixi, а элементами страницы поверх канваса.

  var logPanelEl = null;

  function pct(v) { return v == null ? '—' : Math.round(v * 100) + '%'; }

  function logPanelRow(label, value) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;justify-content:space-between;' +
      'padding:6px 0;border-bottom:1px solid rgba(246,236,220,0.15)';
    var k = document.createElement('span');
    k.textContent = label;
    k.style.cssText = 'color:#C8B79B';
    var v = document.createElement('span');
    v.textContent = value;
    v.style.cssText = 'font-weight:700;text-align:right';
    row.appendChild(k); row.appendChild(v);
    return row;
  }

  function logPanelButton(text, onTap) {
    var b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'flex:1;padding:14px 8px;border:0;border-radius:12px;background:#E0A63A;' +
      'color:#2B2118;font:700 16px/1 -apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer';
    b.addEventListener('click', onTap);
    return b;
  }

  function showLogPanel() {
    if (logPanelEl) return;
    var s = logSummary();

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:20;box-sizing:border-box;padding:16px;' +
      'background:#2B2118;color:#F6ECDC;overflow:auto;display:flex;flex-direction:column;gap:12px;' +
      'font:15px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;' +
      'user-select:text;-webkit-user-select:text';

    var head = document.createElement('div');
    head.textContent = 'Журнал плейтеста';
    head.style.cssText = 'font-size:21px;font-weight:800';
    wrap.appendChild(head);

    var rows = document.createElement('div');
    [ ['Смен сыграно', s.shifts + ' (побед ' + s.won + ', сорвано ' + s.lost + ')'],
      ['Смен подряд', 'рекорд ' + s.streakMax + ', сейчас ' + s.streakNow],
      ['Тапов по чужой зоне', String(s.denyZone)],
      ['Просрочка', s.spoiled + ' шт на ' + s.writeOff + ' ₽'],
      ['Бустеры', 'вернуть ' + s.undo + ', отложить ' + s.fridge + ', перемешать ' + s.shuffle],
      ['Тапов по забитой зоне', String(s.denyFull)],
      ['Ушло покупателей', String(s.lostCustomers)],
      ['Переигровок / апгрейдов', s.retries + ' / ' + s.upgrades],
      ['Время в игре', s.minutes + ' мин'],
      ['Сборка', BUILD]
    ].forEach(function (r) { rows.appendChild(logPanelRow(r[0], r[1])); });
    Object.keys(s.reasons).forEach(function (why) {
      rows.appendChild(logPanelRow('Срыв: ' + why, String(s.reasons[why])));
    });
    wrap.appendChild(rows);

    var hint = document.createElement('div');
    hint.textContent = 'Скопируйте текст ниже и пришлите — в нём вся сессия.';
    hint.style.cssText = 'color:#C8B79B;font-size:13px';
    wrap.appendChild(hint);

    var area = document.createElement('textarea');
    area.readOnly = true;
    area.value = logText();
    area.style.cssText = 'flex:1;min-height:140px;width:100%;box-sizing:border-box;padding:10px;' +
      'border-radius:12px;border:1px solid rgba(246,236,220,0.25);background:#1F1811;color:#E8D9C3;' +
      'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;resize:none';
    wrap.appendChild(area);

    var note = document.createElement('div');
    note.style.cssText = 'min-height:18px;color:#8FBF6A;font-size:13px';
    wrap.appendChild(note);

    var legacyCopy = function () {
      try { area.focus(); area.select(); return document.execCommand('copy'); }
      catch (e) { return false; }
    };
    var copy = function () {
      area.focus(); area.select();
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(area.value).then(
          function () { note.textContent = 'Скопировано'; },
          function () { note.textContent = legacyCopy() ? 'Скопировано' : 'Выделите текст и скопируйте вручную'; });
        return;
      }
      note.textContent = legacyCopy() ? 'Скопировано' : 'Выделите текст и скопируйте вручную';
    };

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:10px';
    bar.appendChild(logPanelButton('Скопировать', copy));
    bar.appendChild(logPanelButton('Очистить', function () {
      if (!window.confirm('Стереть журнал плейтеста?')) return;
      clearLog();
      area.value = logText();
      note.textContent = 'Журнал очищен';
    }));
    bar.appendChild(logPanelButton('Закрыть', hideLogPanel));
    wrap.appendChild(bar);

    document.body.appendChild(wrap);
    logPanelEl = wrap;
  }

  function hideLogPanel() {
    if (!logPanelEl) return;
    if (logPanelEl.parentNode) logPanelEl.parentNode.removeChild(logPanelEl);
    logPanelEl = null;
  }

  function upgradeById(id) {
    for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) return UPGRADES[i];
    return null;
  }

  function upgradePrice(u) { return meta.up[u.id] >= u.max ? null : u.prices[meta.up[u.id]]; }

  function buyUpgrade(id) {
    var u = upgradeById(id);
    if (!u) return false;
    var price = upgradePrice(u);
    if (price == null || meta.wallet < price) { sfx('deny'); return false; }
    var wasWhole = wholeBasketMode();
    meta.wallet -= price;
    meta.up[u.id] += 1;
    saveMeta();
    if (!wasWhole && wholeBasketMode()) {
      toast('Все отделы открыты: покупатели ждут корзину целиком');
    }
    logEvent('upgrade', { id: u.id, level: meta.up[u.id], price: price, wallet: meta.wallet });
    sfx('booster');
    showShop();
    return true;
  }

  function queueSize() { return QUEUE_SIZE + meta.up.ads; }
  function fridgeSize() { return FRIDGE_BASE + meta.up.fridge; }
  function zoneSlots(zone) { return zone.slots + (zone.id === 'grocery' ? meta.up.counter : 0); }
  function traySize() {
    var n = 0;
    activeZones().forEach(function (z) { n += zoneSlots(z); });
    return n;
  }

  function zoneById(id) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].id === id) return ZONES[i];
    return null;
  }

  function zoneRange(zoneId) {
    var from = 0;
    var zs = activeZones();
    for (var i = 0; i < zs.length; i++) {
      var n = zoneSlots(zs[i]);
      if (zs[i].id === zoneId) return { from: from, to: from + n };
      from += n;
    }
    return { from: 0, to: 0 };
  }

  function zoneOfSlot(i) {
    var from = 0;
    var zs = activeZones();
    for (var z = 0; z < zs.length; z++) {
      var n = zoneSlots(zs[z]);
      if (i < from + n) return zs[z].id;
      from += n;
    }
    return zs[zs.length - 1].id;
  }

  function shiftConfig(idx) {
    var base;
    if (idx < SHIFTS.length) base = SHIFTS[idx];
    else {
      var goal = 11 + (idx - 2);
      base = {
        types: 10 + (idx - 2) * 2,           // ассортимент ширится с каждой сменой
        crates: 0, goal: goal,
        patience: Math.max(10, 13 - Math.floor((idx - 2) / 3)),
        visible: 6, lives: 3, sale: true
      };
    }
    var cfg = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) cfg[k] = base[k];

    // Завоз считается от плана и от размера полки: часть поставки всегда
    // заморожена на прилавке, а с новыми отделами полка больше.
    var need = cfg.goal * 3 + traySize() + SPARE;
    cfg.crates = need + ((3 - need % 3) % 3);
    return cfg;
  }

  /* ------------------------------------------------------------- состояние */

  var state = null;
  var streak = 0;
  var totalRevenue = 0;
  var bestCombo = 0;

  streak = meta.streak || 0;
  totalRevenue = meta.total || 0;

  // Товар ложится только в свою зону, поэтому набор смены берётся из секций
  // поровну: иначе одна зона забивается, а другая простаивает всю смену.
  function poolFor(types, rnd) {
    var zs = activeZones(), pool = [];
    var byZone = zs.map(function (z) {
      var list = PRODUCTS.filter(function (p) { return p.section === z.id; });
      if (rnd) {                                   // каждая смена — свой набор с полки
        for (var i = list.length - 1; i > 0; i--) {
          var j = Math.floor(rnd() * (i + 1)), t = list[i];
          list[i] = list[j]; list[j] = t;
        }
      }
      return list;
    });
    var total = 0;
    byZone.forEach(function (list) { total += list.length; });
    types = Math.min(types, total);                 // ассортимент ограничен открытыми отделами
    zs.forEach(function (z, i) {
      var n = Math.min(byZone[i].length, Math.floor(types / zs.length) + (i < types % zs.length ? 1 : 0));
      pool = pool.concat(byZone[i].slice(0, n));
    });
    return pool;
  }

  function buildBelt(cfg, rnd, pool) {
    var triples = cfg.crates / 3;
    var belt = [];
    for (var i = 0; i < triples; i++) {
      var p = pool[Math.floor(rnd() * pool.length)];
      belt.push(p.id, p.id, p.id);
    }
    for (var j = belt.length - 1; j > 0; j--) {
      var k = Math.floor(rnd() * (j + 1));
      var t = belt[j]; belt[j] = belt[k]; belt[k] = t;
    }
    return belt;
  }

  function startShift(shiftIdx, seed) {
    var cfg = shiftConfig(shiftIdx);
    var rnd = mulberry32(seed == null ? (shiftIdx + 1) * 7919 : seed);

    var pool = poolFor(cfg.types, rnd);
    var saleProduct = null;
    if (cfg.sale) saleProduct = pool[Math.floor(rnd() * pool.length)].id;

    state = {
      shiftIdx: shiftIdx,
      cfg: cfg,
      rnd: rnd,
      belt: buildBelt(cfg, rnd, pool),
      tray: new Array(traySize()).fill(null),
      fresh: new Array(traySize()).fill(0),   // сколько ходов товар ещё годен
      spoiled: 0,                             // сколько товара списали
      writeOff: 0,                            // на какую сумму себестоимости
      fridge: [],
      customers: [],
      selected: null,
      revenue: 0,
      served: 0,
      goal: cfg.goal,
      lost: 0,                    // ушедшие покупатели
      combo: 0,
      boosters: { undo: 1 + meta.up.cash, fridge: 1 + meta.up.cash, shuffle: 1 + meta.up.cash },
      lastPlacement: null,
      lastFace: 0,
      saleProduct: saleProduct,
      status: 'playing'
    };
    bestCombo = 0;
    shownRevenue = 0;
    hiddenSlots = {};
    for (var i = 0; i < queueSize(); i++) spawnCustomer();
    pullDemanded();
    shiftStat = { started: Date.now(), moves: 0, home: 0, denyFull: 0, denyZone: 0, spoiled: 0, writeOff: 0 };
    logEvent('shift_start', { shift: shiftIdx + 1, goal: cfg.goal, tray: state.tray.length,
      belt: state.belt.length, patience: cfg.patience + meta.up.sign * 5,
      up: upgradeSnapshot(), streak: streak });
    return state;
  }

  function comboMult() { return Math.min(1 + 0.5 * state.combo, COMBO_MAX_MULT); }

  function costOf(product) { return Math.round(product.price * COST_RATE); }
  function lifeOf(product) { return LIFE[product.section] || 8; }

  function priceOf(product) {
    return product.price * (state.saleProduct === product.id ? 2 : 1);
  }

  function trayIsFull() { return state.tray.indexOf(null) === -1; }

  // «Нужный» товар — тот, что закрывает тройку на прилавке или заказ из очереди.
  // Если в видимой части завоза такого нет, с вероятностью DEMAND_PULL достаём
  // его из глубины в последнюю ячейку окна: это выглядит как «подвезли», состав
  // завоза не меняется (значит, смена остаётся решаемой) — меняется порядок.
  function pullDemanded() {
    if (!state || state.status !== 'playing') return false;

    var fits = function (id) {
      var r = zoneRange(productById(id).section);
      for (var k = r.from; k < r.to; k++) if (state.tray[k] === null) return true;
      return false;
    };

    var counts = trayCounts(), need = {};
    Object.keys(counts).forEach(function (id) { if (counts[id] >= 2) need[id] = true; });
    state.customers.forEach(function (c) {
      c.order.forEach(function (l) { if (stillNeeded(c, l.id) > 0) need[l.id] = true; });
    });

    var n = Math.min(beltVisible(), state.belt.length);
    if (!n) return false;

    var stuck = !placeableNow();          // в окне вообще нечего выложить
    var wanted = function (id) { return stuck ? fits(id) : (need[id] && fits(id)); };
    for (var v = 0; v < n; v++) if (wanted(state.belt[v])) return false;   // и так под рукой
    var pull = wholeBasketMode() ? Math.max(DEMAND_PULL, 0.75) : DEMAND_PULL;
    if (!stuck && state.rnd() > pull) return false;                        // из тупика тянем всегда

    var to = Math.min(state.belt.length, stuck ? state.belt.length : n + DEMAND_DEPTH);
    for (var i = n; i < to; i++) {
      if (!wanted(state.belt[i])) continue;
      var t = state.belt[i]; state.belt[i] = state.belt[n - 1]; state.belt[n - 1] = t;
      return true;
    }
    return false;
  }

  /* --------------------------------------------------------- покупатели */

  // Набор заказа: три позиции в любой комбинации — тройка одного товара, 2+1
  // или три разных. Собирается только из того, что реально осталось на завозе
  // и полке, иначе очередь сама создавала бы тупики.
  function pickOrder(counts, taken, shape) {
    var left = {}, k;
    for (k in counts) if (Object.prototype.hasOwnProperty.call(counts, k)) left[k] = counts[k];
    var out = [], used = {};
    for (var i = 0; i < shape.length; i++) {
      var need = shape[i];
      var cand = Object.keys(left).filter(function (id) { return !used[id] && left[id] >= need; });
      var free = cand.filter(function (id) { return !taken[id]; });   // чужой заказ дублируем в последнюю очередь
      if (free.length) cand = free;
      if (!cand.length) return null;
      // выбор взвешен по остатку на завозе: спрос идёт за поставкой, и товар,
      // которого привезли много, не оседает на полке до просрочки
      var total = 0;
      cand.forEach(function (x) { total += left[x]; });
      var roll = state.rnd() * total, id = cand[cand.length - 1];
      for (var j = 0; j < cand.length; j++) {
        roll -= left[cand[j]];
        if (roll <= 0) { id = cand[j]; break; }
      }
      used[id] = true;
      left[id] -= need;
      out.push({ id: id, n: need });
    }
    return out;
  }

  function spawnCustomer() {
    var counts = {};
    state.belt.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    state.tray.forEach(function (id) { if (id) counts[id] = (counts[id] || 0) + 1; });
    var taken = {};
    state.customers.forEach(function (c) {
      c.order.forEach(function (l) { taken[l.id] = true; });
    });

    var roll = state.rnd(), whole = wholeBasketMode();
    var shapes = roll < (whole ? 0.5 : 0.4) ? [[3], [2, 1], [1, 1, 1]]
               : roll < (whole ? 0.9 : 0.75) ? [[2, 1], [3], [1, 1, 1]]
                                             : [[1, 1, 1], [2, 1], [3]];
    var order = null;
    for (var s = 0; s < shapes.length && !order; s++) order = pickOrder(counts, taken, shapes[s]);
    if (!order) return null;

    // в режиме целой корзины набор собирается дольше — и терпения нужно больше
    var patience = state.cfg.patience + meta.up.sign * 5;
    if (wholeBasketMode()) patience = Math.round(patience * 1.7);
    // типаж покупателя: стараемся не ставить рядом два одинаковых лица
    var used = state.customers.map(function (q) { return q.face; });
    var face = Math.floor(state.rnd() * PEOPLE.length);
    for (var t = 0; t < PEOPLE.length && used.indexOf(face) !== -1; t++) face = (face + 1) % PEOPLE.length;
    var c = { order: order, patience: patience, max: patience, face: face,
              got: {}, value: 0, cheer: 0 };
    state.customers.push(c);
    return c;
  }

  function orderTotal(c) {
    var n = 0;
    c.order.forEach(function (l) { n += l.n; });
    return n;
  }

  // Сколько ещё этого товара нужно покупателю, чтобы его набор закрылся.
  function stillNeeded(c, productId, counts) {
    var whole = wholeBasketMode();
    if (whole && !counts) counts = trayCounts();
    var need = 0;
    c.order.forEach(function (l) {
      if (l.id !== productId) return;
      var have = whole ? (counts[l.id] || 0) : (c.got[l.id] || 0);
      need = Math.max(0, l.n - have);
    });
    return need;
  }

  // Сколько позиций набора уже закрыто — для галочек в карточке очереди.
  function gotCount(c, line, counts) {
    return wholeBasketMode() ? Math.min(line.n, counts[line.id] || 0)
                             : (c.got[line.id] || 0);
  }

  function orderReady(c, counts) {
    for (var i = 0; i < c.order.length; i++) {
      if ((counts[c.order[i].id] || 0) < c.order[i].n) return false;
    }
    return true;
  }

  function orderDone(c) {
    for (var i = 0; i < c.order.length; i++) {
      if ((c.got[c.order[i].id] || 0) < c.order[i].n) return false;
    }
    return true;
  }

  // Покупатель не ждёт весь набор целиком: он забирает с полки те позиции,
  // которые уже выложены, и уходит, когда корзина собралась. Полка за счёт
  // этого разгружается по ходу, а очередь видно, что движется.
  function collectFromTray() {
    if (wholeBasketMode()) return false;          // теперь только целиком
    var took = false;
    state.customers.slice().forEach(function (c) {
      // одна позиция за ход: покупатель обходит прилавок, а не сметает его
      var taken = [];
      for (var li = 0; li < c.order.length && !taken.length; li++) {
        var l = c.order[li];
        if (stillNeeded(c, l.id) <= 0) continue;
        var slot = state.tray.indexOf(l.id);
        if (slot === -1) continue;
        state.tray[slot] = null;
        state.fresh[slot] = 0;
        c.got[l.id] = (c.got[l.id] || 0) + 1;
        c.value += priceOf(productById(l.id));
        taken.push({ slot: slot, id: l.id });
        took = true;
      }
      if (taken.length) {
        c.cheer = 2;                       // пару ходов покупатель доволен
        compactTray();
        pickupFx(c, taken);
      }
      if (orderDone(c)) completeOrder(c);
    });
    return took;
  }

  // Нужный товар появился на полке — тот, кто его ждёт, приободрился.
  function cheerNearby(product) {
    state.customers.forEach(function (c) {
      c.order.forEach(function (l) { if (l.id === product.id) c.cheer = 2; });
    });
  }

  function completeOrder(c) {
    var mult = ZONE_MULT * comboMult();
    var gain = c.value * mult * ORDER_MULT;
    state.revenue += gain;
    state.combo += 1;
    if (state.combo > bestCombo) bestCombo = state.combo;
    serveCustomer(c);
    orderPaidFx(gain, mult);
  }

  function tickPatience() {
    state.customers.forEach(function (c) { if (c.cheer > 0) c.cheer -= 1; });
    var left = [];
    state.customers.forEach(function (c) {
      c.patience -= 1;
      if (c.patience <= 0) left.push(c);
    });
    left.forEach(function (c) {
      state.customers.splice(state.customers.indexOf(c), 1);
      state.lastFace = c.face;
      state.lost += 1;
      state.combo = 0;                       // ушедший покупатель рвёт серию
      customerLeftFx();
      spawnCustomer();
    });
    if (left.length) { toast('Покупатель ушёл не дождавшись'); sfx('wrong'); }
  }

  // Срок годности: каждый ход товар на полке стареет. Просрочку списывают —
  // себестоимость уходит из выручки смены, а серия рвётся: держать товар
  // «на всякий случай» теперь стоит денег.
  function tickFresh() {
    var gone = [];
    for (var i = 0; i < state.tray.length; i++) {
      if (!state.tray[i]) continue;
      state.fresh[i] -= 1;
      if (state.fresh[i] <= 0) gone.push(i);
    }
    if (!gone.length) return;

    var loss = 0;
    gone.forEach(function (i) {
      var p = productById(state.tray[i]);
      loss += costOf(p);
      spoilFx(i, p);
      state.tray[i] = null;
      state.fresh[i] = 0;
    });
    state.revenue = Math.max(0, state.revenue - loss);
    state.spoiled += gone.length;
    state.writeOff += loss;
    state.combo = 0;
    if (shiftStat) { shiftStat.spoiled += gone.length; shiftStat.writeOff += loss; }
    compactTray();
    toast('Просрочка: списано на ' + money(loss));
    sfx('wrong');
  }

  function trayCounts() {
    var m = {};
    state.tray.forEach(function (id) { if (id) m[id] = (m[id] || 0) + 1; });
    return m;
  }

  function takeSlots(productId, n) {
    var out = [];
    for (var i = 0; i < state.tray.length && out.length < n; i++) {
      if (state.tray[i] === productId) out.push(i);
    }
    return out;
  }

  function serveCustomer(c) {
    var i = state.customers.indexOf(c);
    if (i === -1) return null;
    state.customers.splice(i, 1);
    state.lastFace = c.face;
    state.served += 1;
    spawnCustomer();
    return c;
  }

  /* ------------------------------------------------------------- механика */

  function select(from, index) {
    if (state.status !== 'playing') return false;
    var src = from === 'belt' ? state.belt.slice(0, beltVisible()) : state.fridge;
    if (index < 0 || index >= src.length) return false;
    if (state.selected && state.selected.from === from && state.selected.index === index) {
      state.selected = null;
    } else {
      state.selected = { from: from, index: index };
      sfx('select');
    }
    render();
    return true;
  }

  // Положить выбранный товар в его зону: молочка — к молочке, бакалея — к
  // бакалее, овощи — к овощам. Чужая зона товар не принимает.
  function place(zoneId) {
    if (state.status !== 'playing') return false;
    if (!state.selected) { toast('Сначала возьмите товар с завоза'); sfx('deny'); return false; }

    var sel = state.selected;
    var productId = sel.from === 'belt' ? state.belt[sel.index] : state.fridge[sel.index];
    if (!productId) return false;
    var product = productById(productId);

    if (product.section !== zoneId) {
      if (shiftStat) shiftStat.denyZone++;
      toast(product.name + ' — в зону «' + zoneById(product.section).name + '»');
      shakeZone(zoneId); sfx('deny');
      return false;
    }

    var range = zoneRange(zoneId);
    var slot = -1;
    for (var i = range.from; i < range.to; i++) if (state.tray[i] === null) { slot = i; break; }
    if (slot === -1) {
      if (shiftStat) shiftStat.denyFull++;
      toast('В зоне «' + zoneById(zoneId).name + '» нет места'); shakeZone(zoneId); sfx('deny'); return false;
    }

    var from = sel.from === 'belt' ? beltSlotPos(sel.index) : fridgeSlotPos(sel.index);

    if (sel.from === 'belt') state.belt.splice(sel.index, 1);
    else state.fridge.splice(sel.index, 1);

    state.tray[slot] = productId;
    state.fresh[slot] = lifeOf(product);
    state.selected = null;
    state.lastPlacement = { slot: slot, productId: productId, from: sel.from };
    if (shiftStat) {
      shiftStat.moves++;
      if (productById(productId).section === zoneId) shiftStat.home++;
    }

    if (!collectFromTray()) cheerNearby(product);   // разбор по позициям или ожидание целого набора
    var sale = resolveSale();
    tickPatience();
    tickFresh();
    pullDemanded();

    var key = 'slot:' + slot;
    if (!sale) hiddenSlots[key] = true;
    render();

    flyGhost(productById(productId), from, { x: slotX(slot), y: slotY(slot) }, function () {
      delete hiddenSlots[key];
      sfx('place');
      if (sale) runSaleFx(); else render({ pop: slot });
    });

    if (state.served >= state.goal) finish('won');
    else if (state.lost >= state.cfg.lives) finish('lost', 'Слишком много ушедших покупателей');
    else if (trayIsFull()) finish('lost', 'Прилавок забит — смена сорвана');
    else if (state.belt.length === 0 && state.fridge.length === 0) finish('lost', 'Завоз кончился, план не выполнен');
    else checkStuck();
    return true;
  }

  // Товар ложится только в свою зону, поэтому возможен тупик: зона забита, а
  // в руках только её товар. Смена не должна зависать — это проигрыш.
  function placeableNow() {
    var ids = state.belt.slice(0, beltVisible()).concat(state.fridge);
    for (var i = 0; i < ids.length; i++) {
      var r = zoneRange(productById(ids[i]).section);
      for (var k = r.from; k < r.to; k++) if (state.tray[k] === null) return true;
    }
    return false;
  }

  // Выход из тупика: отменить ход, перемешать завоз или убрать товар в холодильник.
  function escapeLeft() {
    if (state.boosters.undo && state.lastPlacement) return true;
    if (state.boosters.shuffle && state.belt.length > beltVisible()) return true;
    if (state.boosters.fridge && state.fridge.length < fridgeSize() && state.belt.length) return true;
    return false;
  }

  function checkStuck() {
    if (state.status !== 'playing') return;
    if (!placeableNow() && !escapeLeft()) finish('lost', 'Некуда выложить товар — зоны забиты');
  }

  // Любые три одинаковых на прилавке продаются. Бонусы: своя зона и заказ.
  // В режиме целой корзины сначала закрывается собранный набор покупателя;
  // всё остальное — привычная тройка одинаковых «с полки», без заказа.
  function resolveSale() {
    var counts = trayCounts();

    var cust = null;
    if (wholeBasketMode()) {
      for (var q = 0; q < state.customers.length && !cust; q++) {
        if (orderReady(state.customers[q], counts)) cust = state.customers[q];
      }
    }

    var product = null, chosen = [];
    if (cust) {
      cust.order.forEach(function (l) { chosen = chosen.concat(takeSlots(l.id, l.n)); });
      product = productById(cust.order[0].id);
    } else {
      var hit = Object.keys(counts).filter(function (k) { return counts[k] >= 3; })[0];
      if (!hit) return false;
      product = productById(hit);
      chosen = takeSlots(hit, 3);
    }
    var perfect = chosen.every(function (i) { return zoneOfSlot(i) === productById(state.tray[i]).section; });

    var sum = 0;
    chosen.forEach(function (i) { sum += priceOf(productById(state.tray[i])); });
    var order = cust ? serveCustomer(cust) : null;
    var mult = perfect ? ZONE_MULT * comboMult() : 1;
    var gain = sum * mult * (order ? ORDER_MULT : 1);

    state.revenue += gain;
    state.combo = perfect ? state.combo + 1 : 0;
    if (state.combo > bestCombo) bestCombo = state.combo;

    chosen.forEach(function (i) { state.tray[i] = null; state.fresh[i] = 0; });
    compactTray();
    state.lastPlacement = null;

    pendingSaleFx = { slots: chosen, product: product, gain: gain,
                      perfect: perfect, order: !!order, mult: mult, combo: state.combo };
    render();
    return true;
  }

  // Товар сдвигается к началу своей зоны — дырки посреди зоны не копятся.
  function compactTray() {
    activeZones().forEach(function (z) {
      var r = zoneRange(z.id);
      var items = [], life = [];
      for (var i = r.from; i < r.to; i++) if (state.tray[i]) { items.push(state.tray[i]); life.push(state.fresh[i]); }
      for (var j = r.from; j < r.to; j++) {
        state.tray[j] = items[j - r.from] || null;
        state.fresh[j] = life[j - r.from] || 0;
      }
    });
  }

  /* -------------------------------------------------------------- бустеры */

  function boosterUndo() {
    if (state.status !== 'playing' || !state.boosters.undo) return false;
    var lp = state.lastPlacement;
    if (!lp) { toast('Нечего возвращать'); sfx('deny'); return false; }
    state.tray[lp.slot] = null;
    state.fresh[lp.slot] = 0;
    compactTray();
    if (lp.from === 'fridge' && state.fridge.length < fridgeSize()) state.fridge.push(lp.productId);
    else state.belt.unshift(lp.productId);
    state.lastPlacement = null;
    state.boosters.undo--;
    logBooster('undo');
    toast('Товар возвращён');
    sfx('booster');
    render();
    checkStuck();
    return true;
  }

  function boosterFridge() {
    if (state.status !== 'playing' || !state.boosters.fridge) return false;
    if (state.fridge.length >= fridgeSize()) { toast('Холодильник полон'); sfx('deny'); return false; }
    if (!state.selected || state.selected.from !== 'belt') {
      pendingFridge = true;                       // ждём тап по товару из завоза
      toast('Выберите товар для холодильника');
      sfx('select');
      return false;
    }
    if (state.fridge.length >= fridgeSize()) { toast('Холодильник полон'); sfx('deny'); return false; }
    state.fridge.push(state.belt.splice(state.selected.index, 1)[0]);
    state.selected = null;
    state.boosters.fridge--;
    logBooster('fridge');
    toast('Товар отложен в холодильник');
    sfx('booster');
    render();
    checkStuck();
    return true;
  }

  function boosterShuffle() {
    if (state.status !== 'playing' || !state.boosters.shuffle) return false;
    var rnd = mulberry32(Date.now() & 0xffff);
    for (var i = state.belt.length - 1; i > 0; i--) {
      var k = Math.floor(rnd() * (i + 1));
      var t = state.belt[i]; state.belt[i] = state.belt[k]; state.belt[k] = t;
    }
    state.selected = null;
    state.boosters.shuffle--;
    logBooster('shuffle');
    toast('Завоз перемешан');
    sfx('booster');
    render();
    checkStuck();
    return true;
  }

  /* ---------------------------------------------------------- конец смены */

  function finish(status, reason) {
    cancelDrag();
    state.status = status;
    if (status === 'won') {
      streak += 1;
      totalRevenue += state.revenue;
      meta.wallet += state.revenue;
      meta.total += state.revenue;
      meta.shiftIdx = state.shiftIdx + 1;
    } else {
      streak = 0;
    }
    meta.streak = streak;
    saveMeta();
    var stat = shiftStat || { started: Date.now(), moves: 0, home: 0, denyFull: 0, denyZone: 0, spoiled: 0, writeOff: 0 };
    logEvent('shift_end', { shift: state.shiftIdx + 1, status: status, reason: reason || null,
      revenue: Math.round(state.revenue), served: state.served, goal: state.goal,
      lost: state.lost, combo: bestCombo, streak: streak, moves: stat.moves, home: stat.home,
      denyFull: stat.denyFull, denyZone: stat.denyZone,
      spoiled: stat.spoiled, writeOff: stat.writeOff,
      sec: Math.round((Date.now() - stat.started) / 1000) });
    shiftStat = null;
    if (window.console) console.log('[playtest] shift', state.shiftIdx + 1, status,
      'revenue', Math.round(state.revenue), 'served', state.served, 'streak', streak);
    render();
    sfx(status === 'won' ? 'win' : 'lose');
    showOverlay(status, reason);
  }

  function nextShift() {
    hideOverlay();
    startShift(state.shiftIdx + 1);
    rebuildBoard();
    render();
  }

  function retryShift() {
    logEvent('retry', { shift: state.shiftIdx + 1 });
    hideOverlay();
    startShift(state.shiftIdx, Date.now() & 0xffff);
    rebuildBoard();
    render();
  }

  /* -------------------------------------------------------------- геометрия */

  /* Раскладка считается от размера окна, а не от фиксированных 1280×720.
     В горизонте очередь идёт колонкой слева, стеллаж и коробка завоза справа,
     бустеры — колонкой у края. В портрете очередь переезжает наверх в две
     колонки, стеллаж занимает всю ширину, а бустеры становятся рядом внизу. */
  var PORTRAIT = false, lastFit = '';
  var HUD_H, SIGN_Y, SIGN_H;
  var HUD_PLAN_X, HUD_PLAN_W, HUD_SEG_W, HUD_COMBO_X;
  var QUEUE_X0, QUEUE_Y, QUEUE_AREA_W, QUEUE_AREA_H, QUEUE_COLS, QUEUE_CARD_W, QUEUE_CARD_H, QUEUE_GAP = 8;
  var TRAY_PANEL_Y, TRAY_PANEL_H, TRAY_GAP = 6, ZONE_GAP = 14;
  var PANEL_X, PANEL_W;
  var BELT_PANEL_Y, BELT_Y, BELT_H, BELT_X, BELT_W, BELT_GAP = 8;
  var FRIDGE_Y, FRIDGE_SLOT_W = 92, FRIDGE_SLOT_H;
  var BTN_SIZE, BTN_GAP = 8, BTN_X0, BTN_Y, BTN_ROW = false;

  // Логический размер холста повторяет пропорции окна в разумных пределах:
  // так не остаётся чёрных полей ни на «квадратном» планшете, ни на 20:9.
  function measure() {
    var vw = Math.max(320, window.innerWidth || 1280);
    var vh = Math.max(320, window.innerHeight || 720);
    var a = vw / vh, portrait = a < 0.95, w, h;
    if (portrait) {
      w = 720;
      h = Math.round(Math.max(920, Math.min(w * 1.85, w / a)));
    } else {
      h = 720;
      w = Math.round(Math.max(980, Math.min(1640, h * a)));
    }
    var key = w + 'x' + h + (portrait ? 'p' : 'l');
    var changed = key !== lastFit;
    lastFit = key;
    W = w; H = h; PORTRAIT = portrait;
    return changed;
  }

  // Панели пересчитываются от холста, числа отделов и длины очереди.
  function layout() {
    HUD_H = 84;
    SIGN_H = PORTRAIT ? 36 : 42;
    SIGN_Y = HUD_H + 10;
    BELT_H = PORTRAIT ? 106 : 116;
    FRIDGE_SLOT_H = PORTRAIT ? 68 : 72;
    QUEUE_X0 = 14;
    QUEUE_COLS = PORTRAIT ? 2 : 1;

    if (PORTRAIT) layoutPortrait(); else layoutLandscape();

    BELT_Y = BELT_PANEL_Y + 42;
    FRIDGE_Y = BELT_PANEL_Y + BELT_H + 64;
    layoutHud();
  }

  // Горизонт: очередь — колонкой слева, всё остальное справа от неё.
  function layoutLandscape() {
    BTN_ROW = false;
    BTN_SIZE = 86;
    BELT_PANEL_Y = H - 8 - BELT_H - 150;
    QUEUE_Y = SIGN_Y;
    QUEUE_AREA_W = Math.max(258, Math.min(330, Math.round(W * 0.24)));
    QUEUE_AREA_H = H - QUEUE_Y - 14;
    QUEUE_CARD_W = QUEUE_AREA_W;
    PANEL_X = QUEUE_X0 + QUEUE_AREA_W + 14;
    PANEL_W = W - PANEL_X - 14;
    BELT_X = PANEL_X;
    BELT_W = PANEL_W - (BTN_SIZE + 70);
    BTN_X0 = BELT_X + BELT_W + 35;
    BTN_Y = Math.min(BELT_PANEL_Y - 8, H - 10 - (BTN_SIZE * 3 + BTN_GAP * 2));
    TRAY_PANEL_Y = SIGN_Y + SIGN_H + 10;
    TRAY_PANEL_H = BELT_PANEL_Y - TRAY_PANEL_Y - 18;
    QUEUE_CARD_H = Math.min(168,
      Math.floor((QUEUE_AREA_H - QUEUE_GAP * (queueSize() - 1)) / queueSize()));
  }

  /* Портрет: сверху очередь в две колонки, под ней стеллаж во всю ширину,
     ниже коробка завоза с холодильником и ряд бустеров. Блоки укладываются
     сверху вниз, а лишняя высота расходится по промежуткам — так экран не
     разрывает пустой полкой ни на вытянутом телефоне, ни на планшете 3:4. */
  function layoutPortrait() {
    BTN_ROW = true;
    var qRows = queueRows(), zRows = trayRows();
    var topY = SIGN_Y + SIGN_H + 10;
    var trayFixed = (zRows > 1 ? 78 : 104) + 42 * (zRows - 1) + 24;
    var qMin = qRows * 98 + QUEUE_GAP * (qRows - 1);
    var trayMin = trayFixed + zRows * 62;
    var beltBlock = BELT_H + 150;                 // коробка завоза и холодильник
    var btnMin = 72;

    // «Короткий» портрет (планшет 3:4): холст тянем выше окна, поля уйдут вбок.
    var need = topY + qMin + trayMin + beltBlock + btnMin + 14 * 4 + 12;
    if (need > H) {
      var a = W / H;
      H = need;
      W = Math.round(Math.max(720, Math.min(1180, H * a)));
    }

    PANEL_X = 14; PANEL_W = W - 28;
    BELT_X = 14; BELT_W = W - 28;
    QUEUE_Y = topY; QUEUE_AREA_W = W - 28;
    // карточку шире 400 некуда наполнять — держим ряд по центру
    QUEUE_CARD_W = Math.min(400, Math.floor((QUEUE_AREA_W - QUEUE_GAP * (QUEUE_COLS - 1)) / QUEUE_COLS));
    QUEUE_X0 = Math.round((W - (QUEUE_CARD_W * QUEUE_COLS + QUEUE_GAP * (QUEUE_COLS - 1))) / 2);
    BTN_SIZE = Math.min(86, Math.floor((W - 40 - BTN_GAP * 2) / 3));
    BTN_X0 = Math.round((W - (BTN_SIZE * 3 + BTN_GAP * 2)) / 2);

    var qWant = qRows * 190 + QUEUE_GAP * (qRows - 1);
    var trayWant = trayFixed + zRows * idealSlotH();
    var space = H - 12 - topY - beltBlock - BTN_SIZE - 14 * 4;
    var over = (qWant + trayWant) - space;
    if (over > 0) {                               // не влезает — ужимаем оба блока
      var slackQ = qWant - qMin, slackT = trayWant - trayMin;
      var cutQ = Math.min(slackQ, Math.round(over * slackQ / Math.max(1, slackQ + slackT)));
      if (over - cutQ > slackT) cutQ = Math.min(slackQ, over - slackT);
      qWant -= cutQ;
      trayWant -= Math.min(slackT, over - cutQ);
    }
    var gap = Math.min(30, 14 + Math.max(0, space - qWant - trayWant) / 4);

    QUEUE_CARD_H = Math.floor((qWant - QUEUE_GAP * (qRows - 1)) / qRows);
    QUEUE_AREA_H = qRows * (QUEUE_CARD_H + QUEUE_GAP) - QUEUE_GAP;
    TRAY_PANEL_Y = Math.round(QUEUE_Y + QUEUE_AREA_H + gap);
    TRAY_PANEL_H = Math.round(trayWant);
    BELT_PANEL_Y = Math.round(TRAY_PANEL_Y + TRAY_PANEL_H + gap);
    BTN_Y = Math.round(BELT_PANEL_Y + beltBlock + gap - 6);
  }

  // Верхняя панель ужимается на узком холсте: план, комбо и «жизни» в один ряд.
  function layoutHud() {
    var narrow = W < 1040;
    HUD_SEG_W = narrow ? 22 : 38;
    HUD_PLAN_X = narrow ? 160 : 220;
    var end = W - 206, segs = 4 * (HUD_SEG_W + 5) + 58;
    HUD_PLAN_W = Math.max(120, Math.min(300, end - HUD_PLAN_X - segs - 18));
    HUD_COMBO_X = HUD_PLAN_X + HUD_PLAN_W + 18;
  }

  function queueGap() { return QUEUE_GAP; }
  function queueCols() { return QUEUE_COLS; }
  function queueRows() { return Math.ceil(queueSize() / QUEUE_COLS); }
  function queueW() { return QUEUE_CARD_W; }
  function queueH() { return QUEUE_CARD_H; }
  function queueX(i) { return QUEUE_X0 + ((i || 0) % QUEUE_COLS) * (queueW() + QUEUE_GAP); }
  function queueY(i) { return QUEUE_Y + Math.floor((i || 0) / QUEUE_COLS) * (queueH() + QUEUE_GAP); }

  // Прилавок: в горизонте до трёх отделов в ряд, в портрете — по два.
  function trayRows() {
    var n = activeZones().length;
    return PORTRAIT ? Math.ceil(n / 2) : (n > 3 ? 2 : 1);
  }
  function zonesPerRow() { return Math.ceil(activeZones().length / trayRows()); }
  // Высота ячейки — сколько влезает в стеллаж, но не выше полутора ширин,
  // иначе на высоком экране полка растягивается в пустоту.
  function idealSlotH() { return Math.round(traySlotW() * (PORTRAIT ? 2 : 1.45)); }
  function trayH() {
    var rows = trayRows(), top = rows > 1 ? 78 : 104, bm = rows > 1 ? 16 : 36;
    var fit = Math.floor((TRAY_PANEL_H - top - 42 * (rows - 1) - bm) / rows);
    return Math.max(58, Math.min(fit, idealSlotH()));
  }
  function trayPanelY() { return TRAY_PANEL_Y; }
  function trayRowH() { return trayH() + 42; }
  function trayPanelH() { return TRAY_PANEL_H; }
  function trayTop() { return trayPanelY() + (trayRows() > 1 ? 78 : 104); }
  function trayRowY(row) { return trayTop() + row * trayRowH(); }
  function btnY(i) { return BTN_ROW ? BTN_Y : BTN_Y + i * (BTN_SIZE + BTN_GAP); }
  function btnX(i) { return BTN_ROW ? BTN_X0 + i * (BTN_SIZE + BTN_GAP) : BTN_X0; }

  // Ширина ряда отделов: неполный ряд центрируется по стеллажу.
  function rowOffset(row) {
    var zs = activeZones(), per = zonesPerRow(), w = traySlotW(), used = 0, count = 0;
    for (var q = row * per; q < Math.min(zs.length, (row + 1) * per); q++) {
      used += zoneSlots(zs[q]) * (w + TRAY_GAP) - TRAY_GAP;
      count++;
    }
    used += ZONE_GAP * Math.max(0, count - 1);
    return PANEL_X + 8 + Math.max(0, Math.round((PANEL_W - 16 - used) / 2));
  }

  function slotPos(i) {
    var zs = activeZones(), per = zonesPerRow(), w = traySlotW(), idx = 0;
    for (var z = 0; z < zs.length; z++) {
      var n = zoneSlots(zs[z]);
      if (i < idx + n) {
        var row = Math.floor(z / per), x = rowOffset(row);
        for (var q = row * per; q < z; q++) x += zoneSlots(zs[q]) * (w + TRAY_GAP) - TRAY_GAP + ZONE_GAP;
        return { x: x + (i - idx) * (w + TRAY_GAP), y: trayRowY(row) };
      }
      idx += n;
    }
    return { x: PANEL_X + 8, y: trayRowY(0) };
  }
  function slotY(i) { return slotPos(i).y; }

  // Ширина ячейки считается по самому плотному ряду, чтобы ряды были ровными.
  function traySlotW() {
    var zs = activeZones(), per = zonesPerRow(), maxSlots = 0, maxZones = 1;
    for (var r = 0; r * per < zs.length; r++) {
      var row = zs.slice(r * per, r * per + per), s = 0;
      row.forEach(function (z) { s += zoneSlots(z); });
      if (s > maxSlots) { maxSlots = s; maxZones = row.length; }
    }
    return Math.floor((PANEL_W - 16 - TRAY_GAP * (maxSlots - 1) - ZONE_GAP * (maxZones - 1)) / maxSlots);
  }

  function slotX(i) { return slotPos(i).x; }

  function zoneBox(zoneId) {
    var r = zoneRange(zoneId), w = traySlotW();
    var n = r.to - r.from;
    return { x: slotX(r.from) - 8, y: slotY(r.from) - 10,
             w: n * (w + TRAY_GAP) - TRAY_GAP + 16, h: trayH() + 20 };
  }

  function beltVisible() { return ((state && state.cfg.visible) || BELT_VISIBLE_MAX) + meta.up.cart; }
  function beltCellW() { var n = beltVisible(); return Math.floor((BELT_W - 40 - BELT_GAP * (n - 1)) / n); }
  function beltX0() { var n = beltVisible(); return BELT_X + (BELT_W - (beltCellW() * n + BELT_GAP * (n - 1))) / 2; }
  function beltSlotPos(i) { return { x: beltX0() + i * (beltCellW() + BELT_GAP), y: BELT_Y }; }

  function fridgeSlotW() {
    var n = fridgeSize();
    return Math.min(FRIDGE_SLOT_W, Math.floor((BELT_W - 190 - BELT_GAP * (n - 1)) / n));
  }
  function fridgeSlotPos(i) { return { x: BELT_X + 178 + i * (fridgeSlotW() + BELT_GAP), y: FRIDGE_Y }; }


  /* -------------------------------------------------------- примитивы сцены */

  var app, root, layers = {}, hud = {}, zoneNodes = {}, beltNodes = [];
  var toastBox, overlay, TEXTURES = {};
  var hiddenSlots = {}, pendingSaleFx = null, shownRevenue = 0, selectedNode = null, signNode = null;

  function label(text, size, color, weight) {
    return new PIXI.Text({
      text: text,
      style: {
        fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        fontSize: size, fill: color, fontWeight: weight || '600', align: 'center'
      }
    });
  }

  function labelWrap(text, size, color, weight, width) {
    return new PIXI.Text({
      text: text,
      style: {
        fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        fontSize: size, fill: color, fontWeight: weight || '600',
        wordWrap: true, wordWrapWidth: width, lineHeight: size * 1.25
      }
    });
  }

  function glyphText(ch, size) {
    return new PIXI.Text({
      text: ch,
      style: {
        fontFamily: '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif',
        fontSize: size, align: 'center'
      }
    });
  }

  function vGradient(g, x, y, w, h, top, bottom, steps) {
    steps = steps || 24;
    for (var i = 0; i < steps; i++) {
      g.rect(x, y + h * i / steps, w, h / steps + 1).fill(mix(top, bottom, i / (steps - 1)));
    }
  }

  function loadArt() {
    var art = window.SHOP_ART || {};
    var ids = Object.keys(art);
    if (!ids.length) return Promise.resolve();
    return Promise.all(ids.map(function (id) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          try { TEXTURES[id] = PIXI.Texture.from(img); } catch (e) {}
          resolve();
        };
        img.onerror = function () { resolve(); };
        img.src = art[id];
      });
    }));
  }

  function productIcon(product, size) {
    var art = TEXTURES[product.id];
    if (art) {
      var sp = new PIXI.Sprite(art);
      sp.width = size; sp.height = size;
      sp.anchor.set(0.5);
      return sp;
    }
    var gl = glyphText(product.glyph, size * 0.8);
    gl.anchor.set(0.5);
    return gl;
  }

  // Товар рисуется как сам продукт: никакой карточки-рамки, только предмет,
  // его тень и, на завозе, ценник.
  function productPiece(product, w, h, opts) {
    opts = opts || {};
    var wrap = new PIXI.Container();
    var c = new PIXI.Container();
    wrap.addChild(c);

    // область нажатия во весь слот — по маленькой картинке попадать неудобно
    var hit = new PIXI.Graphics();
    hit.roundRect(0, 0, w, h, 14).fill({ color: 0xFFFFFF, alpha: 0.001 });
    c.addChild(hit);

    if (opts.selected) {
      var halo = new PIXI.Graphics();
      halo.circle(w / 2, h * 0.44, Math.min(w, h) * 0.52).fill({ color: C.gold, alpha: 0.25 });
      halo.circle(w / 2, h * 0.44, Math.min(w, h) * 0.52).stroke({ width: 5, color: C.gold });
      c.addChild(halo);
    }

    var shadow = new PIXI.Graphics();
    shadow.ellipse(w / 2, h * (opts.price ? 0.68 : 0.76), w * 0.3, h * 0.055)
          .fill({ color: 0x24313B, alpha: 0.2 });
    c.addChild(shadow);

    // на прилавке слот узкий, но высокий: тянемся по высоте, иначе товар мельчает
    var iconY = opts.price ? h * 0.36 : h * 0.40;
    var icon = productIcon(product, opts.price
      ? Math.min(w, h * 0.68) * 1.02
      : Math.min(w * 1.62, h * 0.92));
    icon.x = w / 2; icon.y = iconY;
    c.addChild(icon);

    if (opts.price) {
      var tag = new PIXI.Graphics();
      tag.roundRect(w / 2 - 38, h * 0.78, 76, 30, 3).fill(0xFFFFFF);
      tag.rect(w / 2 - 38, h * 0.78, 76, 7).fill(C.gold);
      tag.roundRect(w / 2 - 38, h * 0.78, 76, 30, 3).stroke({ width: 2.5, color: C.steelDark });
      c.addChild(tag);
      var pr = label(money(priceOf(product)), 16, C.ink, '800');
      pr.anchor.set(0.5);
      pr.x = w / 2; pr.y = h * 0.78 + 18;
      c.addChild(pr);
    }

    if (state.saleProduct === product.id) {
      var badge = new PIXI.Graphics();
      badge.roundRect(w - 40, 2, 38, 24, 10).fill(C.red);
      badge.roundRect(w - 40, 2, 38, 24, 10).stroke({ width: 4, color: C.ink, alpha: 1 });
      badge.rotation = -0.12;
      c.addChild(badge);
      var bt = label('×2', 15, 0xFFFFFF, '800');
      bt.anchor.set(0.5); bt.x = w - 21; bt.y = 14; bt.rotation = -0.12;
      c.addChild(bt);
    }

    if (opts.tilt) {
      c.pivot.set(w / 2, h / 2);
      c.x = w / 2; c.y = h / 2;
      c.rotation = opts.tilt;
    }
    if (opts.alpha != null) c.alpha = opts.alpha;
    wrap.cardW = w; wrap.cardH = h;
    return wrap;
  }

  function button(x, y, w, h, text, sub, enabled, onTap) {
    var c = new PIXI.Container();
    var g = new PIXI.Graphics();
    var base = enabled ? 0x5FBF46 : 0xCFC4B2, lightTop = enabled ? 0x8FDC6A : 0xE2D9C9;
    g.roundRect(2, 6, w, h, 18).fill({ color: 0x3A2717, alpha: enabled ? 0.32 : 0.12 });
    g.roundRect(0, 0, w, h, 18).fill(base);
    g.roundRect(5, 5, w - 10, h * 0.46, 13).fill({ color: lightTop, alpha: 0.95 });
    g.roundRect(9, 8, w - 18, h * 0.24, 9).fill({ color: 0xFFFFFF, alpha: enabled ? 0.45 : 0.2 });
    g.roundRect(0, 0, w, h, 18).stroke({ width: 5, color: 0xFFFFFF, alpha: enabled ? 0.92 : 0.5 });
    g.roundRect(-2, -2, w + 4, h + 4, 20).stroke({ width: 3.5, color: enabled ? 0x3F6E2F : 0x9A907E });
    c.addChild(g);

    var t = label(text, 22, enabled ? 0xFFFFFF : 0x8C8375, '800');
    t.anchor.set(0.5); t.x = w / 2; t.y = h / 2 - (sub ? 13 : 0);
    c.addChild(t);
    if (sub) {
      var s = label(sub, 14, enabled ? 0xEAFBE2 : 0x8C8375, '700');
      s.anchor.set(0.5); s.x = w / 2; s.y = h / 2 + 17;
      c.addChild(s);
    }
    c.x = x; c.y = y;
    if (enabled) {
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointerdown', function () { c.scale.set(0.96); });
      c.on('pointerupoutside', function () { c.scale.set(1); });
      c.on('pointertap', function () { c.scale.set(1); sfx('button'); onTap(); });
    }
    return c;
  }

  // Наконечник стрелки: рисуется вправо и разворачивается поворотом.
  function arrowHead(x, y, rot, size, color) {
    var h = new PIXI.Graphics();
    h.moveTo(-size, -size * 0.85).lineTo(size * 0.95, 0).lineTo(-size, size * 0.85).closePath().fill(color);
    h.x = x; h.y = y; h.rotation = rot;
    return h;
  }

  // Значки бустеров: вернуть товар, отложить в холодильник, перемешать завоз.
  function boosterIcon(id, s) {
    var box = new PIXI.Container();
    if (id === 'fridge') {                       // холодильник и стрелка внутрь
      var f = new PIXI.Graphics();
      f.roundRect(s * 0.08, s * 0.06, s * 0.5, s * 0.88, s * 0.12).fill(0xFFFFFF);
      f.roundRect(s * 0.08, s * 0.06, s * 0.5, s * 0.88, s * 0.12)
       .stroke({ width: s * 0.08, color: C.ink });
      f.moveTo(s * 0.08, s * 0.4).lineTo(s * 0.58, s * 0.4)
       .stroke({ width: s * 0.07, color: C.ink });
      f.roundRect(s * 0.46, s * 0.14, s * 0.06, s * 0.18, s * 0.03).fill(C.ink);
      f.roundRect(s * 0.46, s * 0.48, s * 0.06, s * 0.18, s * 0.03).fill(C.ink);
      f.moveTo(s * 0.96, s * 0.66).lineTo(s * 0.78, s * 0.66)
       .stroke({ width: s * 0.11, color: 0xFFFFFF, cap: 'round' });
      box.addChild(f);
      box.addChild(arrowHead(s * 0.7, s * 0.66, Math.PI, s * 0.15, 0xFFFFFF));
      return box;
    }
    if (id === 'undo') {
      var cx = s * 0.52, cy = s * 0.56, R = s * 0.3, a0 = Math.PI * 0.3, a1 = Math.PI * 1.92;
      var sh = new PIXI.Graphics();
      sh.arc(cx, cy + s * 0.05, R, a0, a1).stroke({ width: s * 0.18, color: 0x2E4A22, alpha: 0.35, cap: 'round' });
      box.addChild(sh);
      var arc = new PIXI.Graphics();
      arc.arc(cx, cy, R, a0, a1).stroke({ width: s * 0.17, color: 0xFFFFFF, cap: 'round' });
      box.addChild(arc);
      box.addChild(arrowHead(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, a1 + Math.PI / 2, s * 0.19, 0xFFFFFF));
      return box;
    }
    var g = new PIXI.Graphics();                 // перемешать: две стрелки крест-накрест
    [[0.26, 0.74], [0.74, 0.26]].forEach(function (pair) {
      g.moveTo(s * 0.06, s * pair[0])
       .bezierCurveTo(s * 0.42, s * pair[0], s * 0.44, s * pair[1], s * 0.74, s * pair[1])
       .stroke({ width: s * 0.14, color: 0xFFFFFF, cap: 'round' });
    });
    box.addChild(g);
    box.addChild(arrowHead(s * 0.86, s * 0.74, 0, s * 0.17, 0xFFFFFF));
    box.addChild(arrowHead(s * 0.86, s * 0.26, 0, s * 0.17, 0xFFFFFF));
    return box;
  }

  // Квадратная кнопка-значок: картинка и счётчик применений в углу.
  function iconButton(x, y, id, count, enabled, onTap) {
    var c = new PIXI.Container(), s = BTN_SIZE;
    var g = new PIXI.Graphics();
    var base = enabled ? 0x5FBF46 : 0xCFC4B2, lightTop = enabled ? 0x8FDC6A : 0xE2D9C9;
    g.roundRect(2, 6, s, s, 22).fill({ color: 0x3A2717, alpha: enabled ? 0.32 : 0.12 });
    g.roundRect(0, 0, s, s, 22).fill(base);
    g.roundRect(5, 5, s - 10, s * 0.4, 16).fill({ color: lightTop, alpha: 0.95 });
    g.roundRect(0, 0, s, s, 22).stroke({ width: 5, color: 0xFFFFFF, alpha: enabled ? 0.92 : 0.5 });
    g.roundRect(-2, -2, s + 4, s + 4, 24).stroke({ width: 3.5, color: enabled ? 0x3F6E2F : 0x9A907E });
    c.addChild(g);

    var ic = boosterIcon(id, s * 0.64);
    ic.x = s * 0.18; ic.y = s * 0.18;
    ic.alpha = enabled ? 1 : 0.55;
    c.addChild(ic);

    var badge = new PIXI.Graphics();
    badge.circle(s - 9, 9, 16).fill(enabled ? C.gold : 0xB6AC9A);
    badge.circle(s - 9, 9, 16).stroke({ width: 3.5, color: C.ink, alpha: 0.9 });
    c.addChild(badge);
    var bt = label(String(count), 19, enabled ? C.ink : 0x6F675B, '800');
    bt.anchor.set(0.5); bt.x = s - 9; bt.y = 9;
    c.addChild(bt);

    c.x = x; c.y = y;
    if (enabled) {
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointerdown', function () { c.scale.set(0.94); });
      c.on('pointerupoutside', function () { c.scale.set(1); });
      c.on('pointertap', function () { c.scale.set(1); sfx('button'); onTap(); });
    }
    return c;
  }

  // Лицо покупателя рисуется примитивами: настроение = сколько осталось терпения.
  // Покупатели: восемь характеров разных возрастов — у каждого свой силуэт
  // (шляпа, кепка, причёска), аксессуар и мимика. Рисуются примитивами, но с
  // проработкой: двойная светотень на лице, блик в волосах, ресницы, губы.
  var PEOPLE = [
    { id: 'rancher', age: 'old',   skin: 0xE2AE7C, hair: 0xD8DCE2, cloth: 0x5E7A4A,
      hat: 'cowboy',  style: 'short',    beard: 'moustache', wrinkles: true },
    { id: 'worker',  age: 'adult', skin: 0xF0B888, hair: 0x4A3520, cloth: 0x3E7FB8,
      hat: 'cap',     style: 'short',    beard: 'stubble', collar: 'hoodie' },
    { id: 'grandpa', age: 'old',   skin: 0xE8BB90, hair: 0xDDE0E6, cloth: 0x7A6A55,
      hat: 'flatcap', style: 'short',    beard: 'full', glasses: true, wrinkles: true, collar: 'shirt' },
    { id: 'ponytail',age: 'young', skin: 0xE8B98C, hair: 0x241F1B, cloth: 0x2FA07E,
      style: 'ponytail', lashes: true, earring: true, band: 0x4FC3E8, lips: 0xC85B72, collar: 'tee' },
    { id: 'diva',    age: 'adult', skin: 0xF6D9BC, hair: 0x201A18, cloth: 0xC02A3E,
      style: 'waves',    lashes: true, lips: 0xD32F4A, pearls: true, collar: 'dress' },
    { id: 'redhead', age: 'young', skin: 0xFFDCBC, hair: 0xC4551F, cloth: 0xE8639C,
      style: 'curly',    lashes: true, freckles: true, band: 0x4FA3F5, lips: 0xCF6076, collar: 'tee' },
    { id: 'hipster', age: 'adult', skin: 0xD79A6A, hair: 0x1F1A17, cloth: 0x8C6BD6,
      style: 'quiff',    beard: 'full', shades: true, collar: 'shirt' },
    { id: 'kid',     age: 'kid',   skin: 0xFFD3A8, hair: 0x6B4A2A, cloth: 0xF0A32A,
      style: 'streak',   freckles: true, goggles: true, collar: 'hoodie' }
  ];

  function personById(idx) {
    var n = PEOPLE.length;
    return PEOPLE[((idx | 0) % n + n) % n];
  }

  // r — радиус головы; контейнер отцентрован по лицу.
  function personGraphic(r, idx, mood) {
    var p = personById(idx);
    var kid = p.age === 'kid', old = p.age === 'old';
    var k = r * (kid ? 0.98 : 1);
    var lw = Math.max(2, k * 0.095);          // контур мягче и тоньше
    var ink = C.ink;
    var shade = mix(p.skin, ink, 0.22);
    var deep = mix(p.skin, ink, 0.4);
    var hairDark = mix(p.hair, 0x000000, 0.35);
    var hairLight = mix(p.hair, 0xFFFFFF, 0.4);
    var clothDark = mix(p.cloth, 0x000000, 0.28);
    var clothLight = mix(p.cloth, 0xFFFFFF, 0.3);

    var c = new PIXI.Container();
    var back = new PIXI.Graphics(), body = new PIXI.Graphics();
    var head = new PIXI.Graphics(), top = new PIXI.Graphics();
    c.addChild(back, body, head, top);

    var faceRx = kid ? 1.06 : (p.id === 'worker' ? 1.08 : 1.03);
    var faceRy = kid ? 1.04 : (old ? 1.14 : 1.1);

    /* ---- волосы за головой --------------------------------------------- */
    if (p.style === 'waves') {
      back.ellipse(0, k * 0.26, k * 1.32, k * 1.46).fill(p.hair);
      back.ellipse(0, k * 0.26, k * 1.32, k * 1.46).stroke({ width: lw, color: ink });
      [-1, 1].forEach(function (s) {
        back.circle(s * k * 1.05, k * 0.72, k * 0.34).fill(p.hair);
        back.circle(s * k * 1.05, k * 0.72, k * 0.34).stroke({ width: lw * 0.8, color: ink });
      });
    } else if (p.style === 'curly') {
      [[-1.05, -0.25], [1.05, -0.25], [-0.95, 0.35], [0.95, 0.35], [0, -1.1], [-0.65, -0.95], [0.65, -0.95]]
        .forEach(function (d) {
          back.circle(d[0] * k, d[1] * k, k * 0.42).fill(p.hair);
          back.circle(d[0] * k, d[1] * k, k * 0.42).stroke({ width: lw * 0.75, color: ink });
        });
    } else if (p.style === 'ponytail') {
      back.circle(k * 1.15, -k * 0.2, k * 0.3).fill(p.hair);
      back.circle(k * 1.15, -k * 0.2, k * 0.3).stroke({ width: lw, color: ink });
      back.ellipse(k * 1.3, k * 0.42, k * 0.26, k * 0.55).fill(p.hair);
      back.ellipse(k * 1.3, k * 0.42, k * 0.26, k * 0.55).stroke({ width: lw, color: ink });
      back.ellipse(0, -k * 0.2, k * 1.16, k * 1.1).fill(p.hair);
    } else if (p.style === 'streak') {
      back.ellipse(0, -k * 0.35, k * 1.14, k * 0.95).fill(p.hair);
      back.ellipse(0, -k * 0.35, k * 1.14, k * 0.95).stroke({ width: lw, color: ink });
    }

    /* ---- плечи, воротник, шея ------------------------------------------ */
    body.roundRect(-k * 1.14, k * 1.02, k * 2.28, k * 1.0, k * 0.4).fill(p.cloth);
    body.roundRect(-k * 1.14, k * 1.02, k * 2.28, k * 1.0, k * 0.4).stroke({ width: lw, color: ink });
    body.roundRect(-k * 1.14, k * 1.02, k * 0.9, k * 1.0, k * 0.4).fill({ color: clothLight, alpha: 0.32 });
    body.rect(-k * 0.3, k * 0.6, k * 0.6, k * 0.5).fill(p.skin);
    body.ellipse(0, k * 0.74, k * 0.35, k * 0.2).fill({ color: deep, alpha: 0.6 });

    if (p.collar === 'shirt') {
      [-1, 1].forEach(function (s) {
        body.moveTo(s * k * 0.1, k * 1.0).lineTo(s * k * 0.62, k * 1.06).lineTo(s * k * 0.16, k * 1.56)
            .closePath().fill(clothLight);
        body.moveTo(s * k * 0.1, k * 1.0).lineTo(s * k * 0.62, k * 1.06).lineTo(s * k * 0.16, k * 1.56)
            .closePath().stroke({ width: lw * 0.7, color: ink });
      });
    } else if (p.collar === 'dress') {
      body.moveTo(-k * 0.52, k * 0.98).quadraticCurveTo(0, k * 1.52, k * 0.52, k * 0.98).fill(p.skin);
      body.moveTo(-k * 0.52, k * 0.98).quadraticCurveTo(0, k * 1.52, k * 0.52, k * 0.98)
          .stroke({ width: lw * 0.7, color: ink });
    } else if (p.collar === 'hoodie') {
      body.moveTo(-k * 0.62, k * 0.96).quadraticCurveTo(0, k * 1.46, k * 0.62, k * 0.96)
          .stroke({ width: lw * 1.5, color: clothDark, cap: 'round' });
      [-1, 1].forEach(function (s) {
        body.moveTo(s * k * 0.2, k * 1.26).lineTo(s * k * 0.27, k * 1.82)
            .stroke({ width: lw * 0.7, color: 0xF2F5F8, cap: 'round' });
      });
    } else {
      body.moveTo(-k * 0.44, k * 0.96).quadraticCurveTo(0, k * 1.34, k * 0.44, k * 0.96)
          .stroke({ width: lw * 1.2, color: clothDark, cap: 'round' });
    }
    if (p.pearls) {
      for (var b = -3; b <= 3; b++) {
        body.circle(b * k * 0.16, k * 1.12 + Math.abs(b) * k * 0.05, k * 0.075).fill(0xFFF6E8);
        body.circle(b * k * 0.16, k * 1.12 + Math.abs(b) * k * 0.05, k * 0.075)
            .stroke({ width: lw * 0.35, color: ink, alpha: 0.5 });
      }
    }

    /* ---- лицо: база, тень справа, румянец ------------------------------ */
    head.ellipse(0, 0, k * faceRx, k * faceRy).fill(p.skin);
    head.ellipse(k * 0.44, k * 0.06, k * 0.6, k * faceRy * 0.88).fill({ color: shade, alpha: 0.18 });
    head.ellipse(0, k * faceRy * 0.62, k * 0.42, k * 0.3).fill({ color: shade, alpha: 0.12 });
    head.ellipse(-k * 0.34, -k * 0.42, k * 0.42, k * 0.26).fill({ color: 0xFFFFFF, alpha: 0.22 });
    head.ellipse(0, 0, k * faceRx, k * faceRy).stroke({ width: lw, color: ink });
    [-1, 1].forEach(function (s) {
      head.circle(s * k * 0.99, k * 0.1, k * 0.18).fill(p.skin);
      head.circle(s * k * 0.99, k * 0.1, k * 0.18).stroke({ width: lw * 0.8, color: ink });
      head.moveTo(s * k * 1.02, k * 0.04).quadraticCurveTo(s * k * 0.93, k * 0.12, s * k * 1.0, k * 0.18)
          .stroke({ width: lw * 0.5, color: shade, alpha: 0.8 });
    });

    /* ---- волосы и головные уборы --------------------------------------- */
    var hy = -k * 0.95, hrx = k * 1.04, hry = k * 0.54;
    if (p.style === 'quiff') { hy = -k * 1.06; hry = k * 0.62; }
    if (p.style === 'waves') { hrx = k * 1.1; }
    top.ellipse(0, hy, hrx, hry).fill(p.hair);
    top.ellipse(0, hy, hrx, hry).stroke({ width: lw, color: ink });
    top.ellipse(-k * 0.34, hy - k * 0.1, k * 0.44, k * 0.15).fill({ color: hairLight, alpha: 0.55 });
    if (p.style === 'quiff') {
      top.moveTo(-k * 0.5, -k * 1.2).quadraticCurveTo(k * 0.1, -k * 1.75, k * 0.62, -k * 1.15)
         .quadraticCurveTo(k * 0.1, -k * 1.4, -k * 0.5, -k * 1.2).fill(p.hair);
      top.moveTo(-k * 0.5, -k * 1.2).quadraticCurveTo(k * 0.1, -k * 1.75, k * 0.62, -k * 1.15)
         .stroke({ width: lw * 0.9, color: ink, cap: 'round' });
    }
    if (p.style === 'streak') {
      top.ellipse(k * 0.46, -k * 0.9, k * 0.22, k * 0.5).fill(0xE0574A);
      top.ellipse(k * 0.46, -k * 0.9, k * 0.22, k * 0.5).stroke({ width: lw * 0.6, color: ink, alpha: 0.6 });
    }
    if (p.band) {
      top.roundRect(-k * 1.06, -k * 1.0, k * 2.12, k * 0.24, k * 0.1).fill(p.band);
      top.roundRect(-k * 1.06, -k * 1.0, k * 2.12, k * 0.24, k * 0.1).stroke({ width: lw * 0.7, color: ink });
    }
    if (p.hat === 'cowboy') {
      top.ellipse(0, -k * 0.86, k * 1.9, k * 0.34).fill(mix(p.cloth, 0x7A5A2E, 0.7));
      top.ellipse(0, -k * 0.86, k * 1.9, k * 0.34).stroke({ width: lw, color: ink });
      top.ellipse(0, -k * 1.24, k * 0.8, k * 0.52).fill(mix(p.cloth, 0x8A6A36, 0.7));
      top.ellipse(0, -k * 1.24, k * 0.8, k * 0.52).stroke({ width: lw, color: ink });
      top.roundRect(-k * 0.82, -k * 1.02, k * 1.64, k * 0.2, k * 0.08).fill(0x5C4326);
    } else if (p.hat === 'cap') {
      top.ellipse(0, -k * 1.02, k * 1.04, k * 0.52).fill(p.cloth);
      top.ellipse(0, -k * 1.02, k * 1.04, k * 0.52).stroke({ width: lw, color: ink });
      top.ellipse(-k * 0.3, -k * 1.2, k * 0.44, k * 0.16).fill({ color: clothLight, alpha: 0.6 });
      top.ellipse(-k * 0.62, -k * 0.78, k * 0.95, k * 0.18).fill(clothDark);
      top.ellipse(-k * 0.62, -k * 0.78, k * 0.95, k * 0.18).stroke({ width: lw * 0.8, color: ink });
      top.circle(0, -k * 1.42, k * 0.1).fill(clothLight);
    } else if (p.hat === 'flatcap') {
      top.ellipse(0, -k * 1.02, k * 1.1, k * 0.44).fill(mix(p.cloth, 0x6E6154, 0.6));
      top.ellipse(0, -k * 1.02, k * 1.1, k * 0.44).stroke({ width: lw, color: ink });
      top.ellipse(-k * 0.66, -k * 0.82, k * 0.86, k * 0.16).fill(mix(p.cloth, 0x4E4438, 0.6));
      top.ellipse(-k * 0.66, -k * 0.82, k * 0.86, k * 0.16).stroke({ width: lw * 0.8, color: ink });
    }
    if (p.goggles) {
      top.roundRect(-k * 1.0, -k * 1.05, k * 2.0, k * 0.34, k * 0.14).fill(0x3B4650);
      top.roundRect(-k * 1.0, -k * 1.05, k * 2.0, k * 0.34, k * 0.14).stroke({ width: lw * 0.7, color: ink });
      [-1, 1].forEach(function (s) {
        top.circle(s * k * 0.45, -k * 0.88, k * 0.26).fill(0x9FD8F0);
        top.circle(s * k * 0.45, -k * 0.88, k * 0.26).stroke({ width: lw * 0.7, color: ink });
      });
    }

    /* ---- глаза ---------------------------------------------------------- */
    var eyeY = k * 0.06, eyeX = k * 0.36, eyeR = k * (kid ? 0.3 : 0.26);
    if (!p.shades) {
      [-1, 1].forEach(function (s) {
        top.ellipse(s * eyeX, eyeY, eyeR * 0.8, eyeR * 0.94).fill(0xFFFFFF);
        top.ellipse(s * eyeX, eyeY - eyeR * 0.45, eyeR * 0.8, eyeR * 0.4).fill({ color: shade, alpha: 0.16 });
        top.circle(s * eyeX, eyeY + eyeR * 0.08, eyeR * 0.52).fill(mix(p.hair, 0x2E6B9E, 0.55));
        top.circle(s * eyeX, eyeY + eyeR * 0.08, eyeR * 0.34).fill(mix(p.hair, 0x123448, 0.45));
        top.circle(s * eyeX, eyeY + eyeR * 0.08, eyeR * 0.18).fill(0x140F0C);
        top.circle(s * eyeX - eyeR * 0.26, eyeY - eyeR * 0.3, eyeR * 0.2).fill(0xFFFFFF);
        top.circle(s * eyeX + eyeR * 0.24, eyeY + eyeR * 0.3, eyeR * 0.1).fill({ color: 0xFFFFFF, alpha: 0.7 });
        top.moveTo(s * (eyeX - eyeR * 0.82), eyeY - eyeR * 0.45)
           .quadraticCurveTo(s * eyeX, eyeY - eyeR * 1.2, s * (eyeX + eyeR * 0.82), eyeY - eyeR * 0.45)
           .stroke({ width: lw * (p.lashes ? 0.95 : 0.72), color: ink, cap: 'round' });
        if (p.lashes) {
          top.moveTo(s * (eyeX + eyeR * 0.78), eyeY - eyeR * 0.5)
             .lineTo(s * (eyeX + eyeR * 1.08), eyeY - eyeR * 0.74)
             .stroke({ width: lw * 0.5, color: ink, cap: 'round' });
        }
      });
    } else {
      top.roundRect(-k * 0.82, eyeY - eyeR * 0.9, k * 1.64, eyeR * 1.9, eyeR * 0.5).fill(0x1E242A);
      top.roundRect(-k * 0.82, eyeY - eyeR * 0.9, k * 1.64, eyeR * 1.9, eyeR * 0.5)
         .stroke({ width: lw * 0.8, color: ink });
      [-1, 1].forEach(function (s) {
        top.moveTo(s * (eyeX - eyeR * 0.5), eyeY - eyeR * 0.5).lineTo(s * (eyeX + eyeR * 0.3), eyeY + eyeR * 0.5)
           .stroke({ width: lw * 0.8, color: 0xFFFFFF, alpha: 0.35, cap: 'round' });
      });
    }

    /* ---- брови: настроение ---------------------------------------------- */
    if (!p.shades) {
      var browY = eyeY - eyeR * 1.9;
      var inner = mood === 'angry' ? eyeR * 0.8 : (mood === 'worry' ? -eyeR * 0.45 :
                  (mood === 'wait' ? 0 : -eyeR * 0.3));
      [-1, 1].forEach(function (s) {
        top.moveTo(s * (eyeX - eyeR * 0.9), browY + (mood === 'angry' ? -eyeR * 0.3 : 0))
           .quadraticCurveTo(s * eyeX, browY - eyeR * 0.4, s * (eyeX + eyeR * 0.9), browY + inner)
           .stroke({ width: lw * (old ? 0.8 : 1), color: old ? mix(p.hair, ink, 0.3) : hairDark, cap: 'round' });
      });
    }

    /* ---- нос, рот ------------------------------------------------------- */
    top.moveTo(k * 0.02, eyeY + eyeR * 0.7).quadraticCurveTo(k * 0.17, k * 0.38, -k * 0.02, k * 0.4)
       .stroke({ width: lw * 0.7, color: shade, cap: 'round' });
    top.ellipse(-k * 0.1, k * 0.42, k * 0.05, k * 0.03).fill({ color: deep, alpha: 0.6 });

    var lip = p.lips || 0x9B4034;
    if (mood === 'angry') {
      top.moveTo(-k * 0.3, k * 0.78).quadraticCurveTo(0, k * 0.5, k * 0.3, k * 0.78)
         .stroke({ width: lw * 1.05, color: lip, cap: 'round' });
    } else if (mood === 'worry') {
      top.moveTo(-k * 0.26, k * 0.72).quadraticCurveTo(0, k * 0.58, k * 0.26, k * 0.72)
         .stroke({ width: lw * 0.95, color: lip, cap: 'round' });
      top.circle(k * 0.86, -k * 0.2, k * 0.1).fill({ color: 0x6FC0EC, alpha: 0.9 });
    } else if (mood === 'wait') {
      top.moveTo(-k * 0.24, k * 0.66).quadraticCurveTo(0, k * 0.73, k * 0.24, k * 0.66)
         .stroke({ width: lw * 0.95, color: lip, cap: 'round' });
    } else {
      top.moveTo(-k * 0.32, k * 0.58).quadraticCurveTo(0, k * 1.0, k * 0.32, k * 0.58)
         .quadraticCurveTo(0, k * 0.74, -k * 0.32, k * 0.58).fill(mix(lip, 0x000000, 0.2));
      top.moveTo(-k * 0.26, k * 0.62).quadraticCurveTo(0, k * 0.71, k * 0.26, k * 0.62)
         .stroke({ width: lw * 0.5, color: 0xFFFFFF, alpha: 0.8 });
      top.moveTo(-k * 0.32, k * 0.58).quadraticCurveTo(0, k * 1.0, k * 0.32, k * 0.58)
         .stroke({ width: lw * 0.75, color: ink, cap: 'round' });
    }

    /* ---- борода, морщины, мелочи ---------------------------------------- */
    if (p.beard === 'full') {
      top.moveTo(-k * 0.92, k * 0.1).quadraticCurveTo(-k * 0.8, k * 1.42, 0, k * 1.5)
         .quadraticCurveTo(k * 0.8, k * 1.42, k * 0.92, k * 0.1)
         .quadraticCurveTo(k * 0.5, k * 0.86, 0, k * 0.86)
         .quadraticCurveTo(-k * 0.5, k * 0.86, -k * 0.92, k * 0.1).fill(p.hair);
      top.moveTo(-k * 0.92, k * 0.1).quadraticCurveTo(-k * 0.8, k * 1.42, 0, k * 1.5)
         .quadraticCurveTo(k * 0.8, k * 1.42, k * 0.92, k * 0.1)
         .stroke({ width: lw * 0.9, color: ink, cap: 'round' });
      top.ellipse(0, k * 0.44, k * 0.34, k * 0.11).fill(p.hair);
    } else if (p.beard === 'moustache') {
      top.ellipse(0, k * 0.44, k * 0.36, k * 0.12).fill(p.hair);
      top.ellipse(0, k * 0.44, k * 0.36, k * 0.12).stroke({ width: lw * 0.5, color: ink, alpha: 0.45 });
    } else if (p.beard === 'stubble') {
      top.ellipse(0, k * 0.68, k * 0.72, k * 0.45).fill({ color: hairDark, alpha: 0.2 });
    }
    if (p.wrinkles) {
      [-1, 1].forEach(function (s) {
        top.moveTo(s * k * 0.72, eyeY - eyeR * 0.1).lineTo(s * k * 0.88, eyeY - eyeR * 0.5)
           .stroke({ width: lw * 0.45, color: shade, alpha: 0.85, cap: 'round' });
        top.moveTo(s * k * 0.72, eyeY + eyeR * 0.35).lineTo(s * k * 0.9, eyeY + eyeR * 0.3)
           .stroke({ width: lw * 0.45, color: shade, alpha: 0.6, cap: 'round' });
      });
    }
    if (p.glasses) {
      [-1, 1].forEach(function (s) {
        top.circle(s * eyeX, eyeY, eyeR * 1.34).fill({ color: 0xBFE0F0, alpha: 0.18 });
        top.circle(s * eyeX, eyeY, eyeR * 1.34).stroke({ width: lw * 0.75, color: 0x37424C });
        top.moveTo(s * (eyeX + eyeR * 1.34), eyeY).lineTo(s * k * 1.0, eyeY - eyeR * 0.2)
           .stroke({ width: lw * 0.6, color: 0x37424C });
      });
      top.moveTo(-eyeX + eyeR * 1.34, eyeY).lineTo(eyeX - eyeR * 1.34, eyeY)
         .stroke({ width: lw * 0.65, color: 0x37424C });
    }
    if (p.earring) {
      [-1, 1].forEach(function (s) {
        top.circle(s * k * 1.0, k * 0.3, k * 0.11).stroke({ width: lw * 0.6, color: C.gold });
      });
    }
    if (kid || p.lips) {
      [-1, 1].forEach(function (s) {
        top.ellipse(s * k * 0.64, k * 0.34, k * 0.2, k * 0.13)
           .fill({ color: 0xFF7A63, alpha: kid ? 0.32 : 0.2 });
      });
    }
    if (p.freckles) {
      [-1, 1].forEach(function (s) {
        [0, 1, 2].forEach(function (j) {
          top.circle(s * (k * 0.5 + j * k * 0.11), k * 0.26 + (j % 2) * k * 0.07, k * 0.033)
             .fill({ color: mix(p.skin, 0x8A4B24, 0.55), alpha: 0.8 });
        });
      });
    }
    return c;
  }

  // Старое имя оставлено для эффектов, где типаж не важен.
  function faceGraphic(r, mood, idx) { return personGraphic(r, idx || 0, mood); }

  /* ------------------------------------------------------------- статика */

  function buildStatic() {
    var bg = new PIXI.Graphics();
    vGradient(bg, 0, 0, W, H, C.wallTop, C.wallBot, 28);
    // потолочные лампы зала: холодная засветка сверху
    bg.ellipse(W / 2, 20, W * 0.7, 70).fill({ color: 0xFFF6DF, alpha: 0.7 });
    // дальние стеллажи зала — чуть намеченные вертикали, чтобы был объём помещения
    for (var wx = PANEL_X; wx < W; wx += 132) {
      bg.rect(wx, SIGN_Y + 10, 78, 200).fill({ color: C.steel, alpha: 0.08 });
      bg.rect(wx, SIGN_Y + 10, 78, 6).fill({ color: C.steelDark, alpha: 0.09 });
    }
    // пол виден узкой полосой снизу
    var floorY = PORTRAIT ? Math.min(H - 28, BTN_Y + BTN_SIZE + 22) : H - 28;
    bg.rect(0, floorY, W, H - floorY).fill(C.floor);
    bg.rect(0, floorY, W, 6).fill({ color: 0xFFFFFF, alpha: 0.35 });
    for (var fx2 = 30; fx2 < W; fx2 += 150) {
      bg.rect(fx2, floorY + 6, 3, H - floorY - 6).fill({ color: 0x6E4318, alpha: 0.22 });
    }
    root.addChild(bg);

    buildHud();
    buildSign();

    layers.trayStatic = new PIXI.Container();
    root.addChild(layers.trayStatic);
    buildTray();
    root.addChild(hud.sale);              // строка акции — поверх планки стеллажа

    buildBeltTray();

    layers.fridgeStatic = new PIXI.Container();
    root.addChild(layers.fridgeStatic);
    buildFridge();

    layers.queue = new PIXI.Container();
    layers.trayItems = new PIXI.Container();
    layers.fridgeItems = new PIXI.Container();
    layers.beltItems = new PIXI.Container();
    layers.buttons = new PIXI.Container();
    layers.fx = new PIXI.Container();
    root.addChild(layers.queue, layers.trayItems, layers.fridgeItems, layers.beltItems, layers.buttons, layers.fx);

    buildToast();

    overlay = new PIXI.Container();
    overlay.visible = false;
    root.addChild(overlay);
  }

  // Прилавок, очередь и холодильник меняются от апгрейдов — пересчитываем
  // раскладку и собираем сцену заново.
  function rebuildBoard() {
    if (!layers.trayStatic) return;
    layout();
    fitScale();                        // портрет может растянуть холст под контент
    rebuildScene();
  }

  var overlayKind = null;              // что показать заново после пересборки

  // Смена ориентации или размера окна: старую сцену выбрасываем целиком —
  // статика нарисована под конкретную геометрию.
  function rebuildScene() {
    if (!root) return;
    cancelDrag();
    anims.length = 0;
    root.removeChildren().forEach(function (k) {
      try { k.destroy({ children: true }); } catch (e) {}
    });
    layers = {}; hud = {}; zoneNodes = {}; beltNodes = [];
    selectedNode = null; signNode = null; toastBox = null; overlay = null;
    buildStatic();
    render();
    if (overlayKind === 'shop') showShop();
    else if (overlayKind) showOverlay(overlayKind.status, overlayKind.reason);
  }

  function buildHud() {
    var g = new PIXI.Graphics();
    vGradient(g, 0, 0, W, HUD_H, 0x53381F, C.hudBg, 12);
    g.roundRect(12, 8, W - 24, 42, 14).fill({ color: 0xFFFFFF, alpha: 0.06 });
    g.rect(0, HUD_H - 9, W, 4).fill(C.gold);
    g.rect(0, HUD_H - 5, W, 5).fill(C.steelDark);
    g.rect(0, HUD_H - 5, W, 2).fill({ color: 0xFFFFFF, alpha: 0.12 });
    root.addChild(g);

    hud.revenue = label('0 ₽', 34, C.green, '800');
    hud.revenue.x = 22; hud.revenue.y = 10;
    root.addChild(hud.revenue);

    var cap = label('ВЫРУЧКА СМЕНЫ', 12, C.hudInkSoft, '700');
    cap.x = 24; cap.y = 52;
    root.addChild(cap);

    hud.shift = label('', 15, C.hudInk, '700');
    hud.shift.anchor.set(1, 0);
    hud.shift.x = W - 86; hud.shift.y = 10;
    root.addChild(hud.shift);

    hud.streak = label('', 13, C.hudInkSoft, '600');
    hud.streak.anchor.set(1, 0);
    hud.streak.x = W - 86; hud.streak.y = 32;
    root.addChild(hud.streak);

    hud.planBar = new PIXI.Graphics();
    root.addChild(hud.planBar);
    hud.planText = label('', 16, C.hudInk, '700');
    hud.planText.anchor.set(0.5);
    hud.planText.x = HUD_PLAN_X + HUD_PLAN_W / 2; hud.planText.y = 42;
    root.addChild(hud.planText);

    hud.comboBar = new PIXI.Graphics();
    root.addChild(hud.comboBar);
    hud.comboText = label('', 18, C.hudInkSoft, '800');
    hud.comboText.anchor.set(0, 0.5);
    hud.comboText.x = HUD_COMBO_X + 4 * (HUD_SEG_W + 5) + 6; hud.comboText.y = 42;
    root.addChild(hud.comboText);

    hud.lives = new PIXI.Graphics();
    root.addChild(hud.lives);

    hud.sale = label('', 16, C.gold, '800');
    hud.sale.anchor.set(0.5);
    // «Акция дня» занимает планку стеллажа: там её видно в любой раскладке
    hud.sale.x = PANEL_X + PANEL_W / 2;
    hud.sale.y = TRAY_PANEL_Y + 22;
    hud.sale.visible = false;
    root.addChild(hud.sale);

    var mute = new PIXI.Container();
    mute.x = W - 66; mute.y = 16;
    hud.muteIcon = new PIXI.Graphics();
    mute.addChild(hud.muteIcon);
    mute.eventMode = 'static';
    mute.cursor = 'pointer';
    mute.on('pointertap', function () {
      if (window.ShopAudio) { window.ShopAudio.unlock(); window.ShopAudio.toggle(); }
      drawMute();
    });
    root.addChild(mute);
    drawMute();
  }

  function drawMute() {
    var g = hud.muteIcon;
    var muted = window.ShopAudio ? window.ShopAudio.isMuted() : true;
    g.clear();
    g.roundRect(0, 0, 50, 50, 8).fill(muted ? C.hudTrack : C.gold);
    g.roundRect(0, 0, 50, 50, 8).stroke({ width: 3, color: muted ? C.steel : 0xB4750B });
    g.moveTo(13, 19).lineTo(21, 19).lineTo(30, 11).lineTo(30, 39).lineTo(21, 31).lineTo(13, 31).closePath()
     .fill(muted ? C.hudInkSoft : 0xFFFFFF);
    if (muted) {
      g.moveTo(35, 17).lineTo(44, 33).stroke({ width: 5, color: C.hudInkSoft, cap: 'round' });
      g.moveTo(44, 17).lineTo(35, 33).stroke({ width: 5, color: C.hudInkSoft, cap: 'round' });
    } else {
      g.moveTo(36, 16).quadraticCurveTo(42, 25, 36, 34).stroke({ width: 5, color: 0xFFFFFF, cap: 'round' });
    }
  }

  // Подвесной указатель отдела: в зале супермаркета он висит на тросах над рядом.
  function buildSign() {
    var g = new PIXI.Graphics();
    var x = PANEL_X - 10, w = PANEL_W + 20, y = SIGN_Y, h = SIGN_H;
    g.rect(x + 140, y - 14, 5, 14).fill(C.steelDark);
    g.rect(x + w - 145, y - 14, 5, 14).fill(C.steelDark);
    g.roundRect(x + 4, y + 5, w, h, 8).fill({ color: 0x4A1109, alpha: 0.25 });
    g.roundRect(x, y, w, h, 12).fill(C.sign);
    g.roundRect(x, y, w, h, 14).stroke({ width: 5, color: 0x7E2517 });
    g.roundRect(x + 5, y + 5, w - 10, h - 10, 10).stroke({ width: 3, color: C.gold, alpha: 0.9 });
    g.roundRect(x + 10, y + 6, w - 20, 7, 4).fill({ color: 0xFFFFFF, alpha: 0.28 });
    signNode = new PIXI.Container();
    signNode.addChild(g);

    var t = label('ПРОДУКТЫ · ТОРГОВЫЙ ЗАЛ', 18, C.signAlt, '800');
    t.anchor.set(0.5); t.x = x + w / 2; t.y = y + h / 2;
    signNode.addChild(t);
    root.addChild(signNode);
  }

  function buildTray() {
    layers.trayStatic.removeChildren();
    zoneNodes = {};

    var g = new PIXI.Graphics();
    // корпус торгового стеллажа: боковые стойки, задняя стенка, планка-фриз
    var py = trayPanelY(), ph = trayPanelH();
    vGradient(g, PANEL_X - 10, py, PANEL_W + 20, ph, C.steelLight, C.steel, 10);
    g.roundRect(PANEL_X - 10, py, PANEL_W + 20, ph, 14).fill(C.steel);
    g.roundRect(PANEL_X - 10, py + 2, PANEL_W + 20, 26, 12).fill({ color: 0xFFFFFF, alpha: 0.22 });
    g.roundRect(PANEL_X - 2, py + 40, PANEL_W + 4, ph - 48, 10).fill(C.shelf);
    g.roundRect(PANEL_X - 2, py + 40, PANEL_W + 4, 10, 6).fill({ color: 0x8A5A29, alpha: 0.14 });
    if (trayRows() > 1) {                                   // полка второго ряда
      g.roundRect(PANEL_X - 2, trayRowY(1) - 16, PANEL_W + 4, 10, 6).fill({ color: 0x8A5A29, alpha: 0.14 });
    }
    g.roundRect(PANEL_X - 2, py + 6, PANEL_W + 4, 32, 10).fill(C.steelDark);
    g.roundRect(PANEL_X - 10, py, PANEL_W + 20, ph, 18).stroke({ width: 6, color: C.steelDark });
    g.roundRect(PANEL_X - 5, py + 5, PANEL_W + 10, ph - 10, 14).stroke({ width: 3, color: C.gold, alpha: 0.75 });
    g.rect(PANEL_X - 10, py + 4, PANEL_W + 20, 3).fill({ color: 0xFFFFFF, alpha: 0.4 });
    layers.trayStatic.addChild(g);

    var cap = label(PORTRAIT ? 'КАЖДЫЙ ТОВАР В СВОЙ ОТДЕЛ' :
      'КАЖДЫЙ ТОВАР В СВОЙ ОТДЕЛ · ТРИ ОДИНАКОВЫХ = ПРОДАЖА', 15, 0xE7EFF5, '800');
    cap.anchor.set(0.5); cap.x = PANEL_X + PANEL_W / 2; cap.y = trayPanelY() + 22;
    layers.trayStatic.addChild(cap);
    hud.trayCap = cap;

    var w = traySlotW();
    activeZones().forEach(function (z) {
      var node = new PIXI.Container();
      var box = zoneBox(z.id);

      var back = new PIXI.Graphics();
      back.roundRect(box.x, box.y, box.w, box.h, 5).fill(z.tint);
      back.roundRect(box.x, box.y, box.w, box.h, 5).stroke({ width: 3, color: C.steelDark, alpha: 0.55 });
      // передний рейлинг полки — он и держит ценники
      back.roundRect(box.x + 2, box.y + box.h - 9, box.w - 4, 9, 3).fill(C.steelLight);
      back.roundRect(box.x + 2, box.y + box.h - 9, box.w - 4, 9, 3).stroke({ width: 2, color: C.steelDark, alpha: 0.6 });
      node.addChild(back);

      // указатель отдела — пластиковая табличка на фризе стеллажа
      var tag = new PIXI.Graphics();
      tag.roundRect(box.x + 2, box.y - 33, box.w - 4, 28, 4).fill(z.color);
      tag.roundRect(box.x + 2, box.y - 33, box.w - 4, 28, 4).stroke({ width: 3, color: C.ink, alpha: 0.45 });
      tag.roundRect(box.x + 6, box.y - 30, box.w - 12, 6, 3).fill({ color: 0xFFFFFF, alpha: 0.22 });
      node.addChild(tag);
      var tl = label(z.name.toUpperCase(), 16, 0xFFFFFF, '800');
      tl.anchor.set(0.5); tl.x = box.x + box.w / 2; tl.y = box.y - 19;
      node.addChild(tl);

      var r = zoneRange(z.id);
      for (var i = r.from; i < r.to; i++) {
        var slot = new PIXI.Graphics();
        var sx = slotX(i), sy = slotY(i), sh = trayH();
        slot.roundRect(sx, sy, w, sh, 4).fill({ color: 0xFFFFFF, alpha: 0.5 });
        slot.roundRect(sx, sy, w, sh, 4).stroke({ width: 2, color: C.steel, alpha: 0.45 });
        slot.rect(sx, sy, w, 5).fill({ color: C.steelDark, alpha: 0.10 });
        // ценникодержатель под ячейкой — фирменная деталь торгового зала
        slot.roundRect(sx + 3, sy + sh - 20, w - 6, 13, 2).fill(0xFFFFFF);
        slot.roundRect(sx + 3, sy + sh - 20, w - 6, 13, 2).stroke({ width: 1.5, color: C.steel, alpha: 0.8 });
        slot.rect(sx + 6, sy + sh - 16, (w - 12) * 0.55, 3).fill({ color: C.ink, alpha: 0.35 });
        slot.rect(sx + 6, sy + sh - 12, (w - 12) * 0.32, 3).fill({ color: C.ink, alpha: 0.2 });
        node.addChild(slot);
      }

      var hint = new PIXI.Graphics();
      hint.roundRect(box.x, box.y, box.w, box.h, 5).stroke({ width: 6, color: C.gold });
      hint.alpha = 0;
      node.addChild(hint);
      node.hint = hint;

      var hit = new PIXI.Graphics();
      hit.roundRect(box.x, box.y - 36, box.w, box.h + 36, 16).fill({ color: 0xFFFFFF, alpha: 0.001 });
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointertap', function (id) { return function () { place(id); }; }(z.id));
      node.addChild(hit);

      zoneNodes[z.id] = node;
      layers.trayStatic.addChild(node);
    });
  }

  function buildBeltTray() {
    var g = new PIXI.Graphics();
    var bh = BELT_H + 70;
    // коробка поставки: картон, отогнутые клапаны и полоса скотча
    g.roundRect(BELT_X, BELT_PANEL_Y, BELT_W, bh, 14).fill(C.cardboard);
    g.roundRect(BELT_X + 7, BELT_PANEL_Y + 30, BELT_W - 14, bh - 37, 10).fill(C.cardboardLight);
    g.rect(BELT_X + 7, BELT_PANEL_Y + 30, BELT_W - 14, 6).fill({ color: 0x8A5A29, alpha: 0.2 });
    g.roundRect(BELT_X, BELT_PANEL_Y, BELT_W, bh, 14).stroke({ width: 5, color: 0x8A5A29 });
    g.rect(BELT_X + BELT_W / 2 - 34, BELT_PANEL_Y, 68, 30).fill({ color: 0xF2E2C4, alpha: 0.75 });
    g.rect(BELT_X + BELT_W / 2 - 34, BELT_PANEL_Y, 68, 30).stroke({ width: 2, color: 0x8A5A29, alpha: 0.35 });
    g.roundRect(BELT_X + 14, BELT_Y + BELT_H - 10, BELT_W - 28, 14, 4).fill({ color: 0x8A5A29, alpha: 0.28 });
    root.addChild(g);

    var t = label('ПОСТАВКА', 18, 0x6B4218, '800');
    t.x = BELT_X + 20; t.y = BELT_PANEL_Y + 7;
    root.addChild(t);

    hud.beltCount = label('', 18, 0x6B4218, '700');
    hud.beltCount.anchor.set(1, 0);
    hud.beltCount.x = BELT_X + BELT_W - 20; hud.beltCount.y = BELT_PANEL_Y + 8;
    root.addChild(hud.beltCount);
  }

  function buildFridge() {
    layers.fridgeStatic.removeChildren();
    var g = new PIXI.Graphics();
    var fh = FRIDGE_SLOT_H + 28;
    g.roundRect(BELT_X, FRIDGE_Y - 14, BELT_W, fh, 14).fill(C.chill);
    g.roundRect(BELT_X, FRIDGE_Y - 14, BELT_W, fh, 14).stroke({ width: 4, color: C.steelDark, alpha: 0.75 });
    g.roundRect(BELT_X + 4, FRIDGE_Y - 10, BELT_W - 8, 8, 3).fill({ color: 0xFFFFFF, alpha: 0.7 });
    // блик стекла витрины
    g.moveTo(BELT_X + 150, FRIDGE_Y - 14).lineTo(BELT_X + 196, FRIDGE_Y - 14)
     .lineTo(BELT_X + 138, FRIDGE_Y - 14 + fh).lineTo(BELT_X + 92, FRIDGE_Y - 14 + fh)
     .closePath().fill({ color: 0xFFFFFF, alpha: 0.28 });
    layers.fridgeStatic.addChild(g);

    var t = label('ХОЛОДИЛЬНИК', 16, 0x2B5A74, '800');
    t.anchor.set(0, 0.5);
    t.x = BELT_X + 18; t.y = FRIDGE_Y + FRIDGE_SLOT_H / 2;
    layers.fridgeStatic.addChild(t);

    var w = fridgeSlotW();
    for (var f = 0; f < fridgeSize(); f++) {
      var fs = new PIXI.Graphics();
      var p = fridgeSlotPos(f);
      fs.roundRect(p.x, p.y, w, FRIDGE_SLOT_H, 4).fill({ color: 0xFFFFFF, alpha: 0.6 });
      fs.roundRect(p.x, p.y, w, FRIDGE_SLOT_H, 4).stroke({ width: 3, color: C.steel });
      layers.fridgeStatic.addChild(fs);
    }
  }

  function buildToast() {
    toastBox = new PIXI.Container();
    toastBox.alpha = 0;
    var bg = new PIXI.Graphics();
    bg.roundRect(-215, -26, 430, 52, 8).fill({ color: 0x16202A, alpha: 0.94 });
    bg.roundRect(-215, -26, 430, 52, 8).stroke({ width: 3, color: C.steel, alpha: 0.8 });
    toastBox.addChild(bg);
    toastBox.text = label('', 20, C.hudInk, '700');
    toastBox.text.anchor.set(0.5);
    toastBox.addChild(toastBox.text);
    toastBox.x = W / 2; toastBox.y = BELT_PANEL_Y - 28;
    root.addChild(toastBox);
  }

  /* ------------------------------------------------------------ отрисовка */

  function render(fx) {
    if (!app || !layers.trayItems) return;
    layers.queue.removeChildren();
    layers.trayItems.removeChildren();
    layers.fridgeItems.removeChildren();
    layers.beltItems.removeChildren();
    layers.buttons.removeChildren();
    beltNodes = [];
    selectedNode = null;

    renderHud();
    renderQueue();

    var w = traySlotW();
    state.tray.forEach(function (pid, i) {
      if (!pid || hiddenSlots['slot:' + i]) return;
      var c = productPiece(productById(pid), w, trayH(), { tilt: ((i % 2) ? 1 : -1) * 0.03 });
      c.x = slotX(i); c.y = slotY(i);
      if (fx && fx.pop === i) squashIn(c, w, trayH());
      layers.trayItems.addChild(c);
      layers.trayItems.addChild(freshBadge(i, productById(pid)));
    });

    var sel = selectedProduct();
    activeZones().forEach(function (z) {
      var r = zoneRange(z.id), free = false;
      for (var i = r.from; i < r.to; i++) if (state.tray[i] === null) free = true;
      zoneNodes[z.id].hint.alpha = (sel && sel.section === z.id && free) ? 0.9 : 0;
      zoneNodes[z.id].alpha = free ? 1 : 0.75;
    });

    var fw = fridgeSlotW();
    state.fridge.forEach(function (pid, k) {
      var p = fridgeSlotPos(k);
      var c = productPiece(productById(pid), fw, FRIDGE_SLOT_H, {
        selected: state.selected && state.selected.from === 'fridge' && state.selected.index === k
      });
      c.x = p.x; c.y = p.y;
      c.eventMode = 'static'; c.cursor = 'pointer';
      c.on('pointerdown', function (ev) { beginDrag('fridge', k, productById(pid), ev); });
      layers.fridgeItems.addChild(c);
    });

    var bw = beltCellW();
    state.belt.slice(0, beltVisible()).forEach(function (pid, k) {
      var selected = state.selected && state.selected.from === 'belt' && state.selected.index === k;
      var c = productPiece(productById(pid), bw, BELT_H, { selected: selected, price: true, alpha: dragging(k) ? 0.3 : 1 });
      var p = beltSlotPos(k);
      c.x = p.x; c.y = p.y - (selected ? 12 : 0);
      c.baseY = p.y - (selected ? 12 : 0);
      c.phase = k * 0.7;
      if (selected) {
        c.pivot.set(bw / 2, BELT_H / 2);
        c.x += bw / 2; c.y += BELT_H / 2; c.baseY += BELT_H / 2;
        c.scale.set(1.06);
        selectedNode = c;
      }
      c.eventMode = 'static'; c.cursor = 'pointer';
      c.on('pointerdown', function (ev) { beginDrag('belt', k, productById(pid), ev); });
      layers.beltItems.addChild(c);
      beltNodes.push(c);
    });
    hud.beltCount.text = 'осталось ' + state.belt.length;

    var b = state.boosters, playing = state.status === 'playing';
    layers.buttons.addChild(
      iconButton(btnX(0), btnY(0), 'undo', b.undo, b.undo > 0 && playing, boosterUndo),
      iconButton(btnX(1), btnY(1), 'fridge', b.fridge, b.fridge > 0 && playing, boosterFridge),
      iconButton(btnX(2), btnY(2), 'shuffle', b.shuffle, b.shuffle > 0 && playing, boosterShuffle)
    );
  }

  /* ------------------------------------------------------- перетаскивание */

  var drag = null;

  // Срок годности показан циферблатом: сектор тает по ходам, стрелка идёт по
  // кругу, цвет предупреждает заранее. Цифра на мелкой ячейке не читалась.
  function freshBadge(i, product) {
    var left = Math.max(0, state.fresh[i]), full = lifeOf(product);
    var frac = Math.max(0, Math.min(1, left / full));
    var w = traySlotW(), r = 12, x = slotX(i) + w - r - 3, y = slotY(i) + r + 3;
    var col = left <= 2 ? C.red : (left <= Math.ceil(full * 0.4) ? C.gold : C.green);
    var start = -Math.PI / 2, end = start + Math.PI * 2 * frac;

    var box = new PIXI.Container();
    var g = new PIXI.Graphics();
    g.circle(x, y, r).fill(0xFFFFFF);
    if (frac > 0) {
      g.moveTo(x, y).arc(x, y, r - 2.5, start, end).closePath().fill({ color: col, alpha: 0.95 });
    }
    g.circle(x, y, r).stroke({ width: 2.5, color: C.ink, alpha: 0.85 });
    for (var m = 0; m < 4; m++) {                 // деления циферблата
      var a = start + m * Math.PI / 2;
      g.moveTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4))
       .lineTo(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1))
       .stroke({ width: 1.5, color: C.ink, alpha: 0.5 });
    }
    g.moveTo(x, y).lineTo(x + Math.cos(end) * (r - 4), y + Math.sin(end) * (r - 4))
     .stroke({ width: 2.5, color: C.ink, cap: 'round' });
    g.circle(x, y, 2).fill(C.ink);
    box.addChild(g);
    if (left <= 2) box.alpha = 0.72 + 0.28 * Math.abs(Math.sin(Date.now() / 220));
    return box;
  }

  // Списание просрочки: минус себестоимость прямо над ячейкой.
  function spoilFx(i, product) {
    var x = slotX(i) + traySlotW() / 2;
    floatText(x, slotY(i) + 20, '−' + money(costOf(product)), C.red);
    flashArea(x, slotY(i) + trayH() / 2, false);
  }

  function dragging(index) {
    return !!(drag && drag.active && drag.from === 'belt' && drag.index === index);
  }

  function zoneUnder(pt) {
    var zs = activeZones();
    for (var i = 0; i < zs.length; i++) {
      var b = zoneBox(zs[i].id);
      if (pt.x >= b.x - 6 && pt.x <= b.x + b.w + 6 && pt.y >= b.y - 40 && pt.y <= b.y + b.h + 10) {
        return zs[i].id;
      }
    }
    return null;
  }

  function beginDrag(from, index, product, ev) {
    if (state.status !== 'playing') return;
    dropGhost(drag);                              // прошлый жест мог оборваться
    var p = root.toLocal(ev.global);
    drag = { from: from, index: index, product: product, startX: p.x, startY: p.y,
             active: false, ghost: null, last: p };
  }

  function dropGhost(d) {
    if (d && d.ghost && !d.ghost.destroyed) d.ghost.destroy();
  }

  // Палец «потерялся» (свернули игру, системный жест, второе касание) — снимаем
  // призрак и ничего не кладём: иначе картинка зависает над залом.
  function cancelDrag() {
    if (!drag) return;
    dropGhost(drag);
    drag = null;
    render();
  }

  function moveDrag(ev) {
    if (!drag) return;
    var p = root.toLocal(ev.global);
    if (!drag.active) {
      var dx = p.x - drag.startX, dy = p.y - drag.startY;
      if (dx * dx + dy * dy < 144) return;        // короткое движение — это тап
      drag.active = true;
      state.selected = { from: drag.from, index: drag.index };
      sfx('select');
      render();
      var w = traySlotW();
      drag.ghost = productPiece(drag.product, w * 1.25, trayH() * 1.25, {});
      drag.ghost.pivot.set(w * 0.62, trayH() * 0.62);
      layers.fx.addChild(drag.ghost);
      drag.ghost.__drag = true;
    }
    drag.last = p;
    drag.ghost.x = p.x; drag.ghost.y = p.y;
    drag.ghost.rotation = Math.max(-0.2, Math.min(0.2, (p.x - drag.startX) / 900));

    var over = zoneUnder(p);
    activeZones().forEach(function (z) {
      var r = zoneRange(z.id), free = false;
      for (var i = r.from; i < r.to; i++) if (state.tray[i] === null) free = true;
      var own = drag.product.section === z.id;
      zoneNodes[z.id].hint.alpha = own && free ? (over === z.id ? 1 : 0.6) : 0;
    });
  }

  function endDrag(ev) {
    if (!drag) return;
    var d = drag;
    drag = null;
    dropGhost(d);

    if (!d.active) {                              // обычный тап — сразу в свой отдел
      tapItem(d.from, d.index);
      return;
    }
    var p = (ev && ev.global) ? root.toLocal(ev.global) : d.last;
    var zone = p ? zoneUnder(p) : null;
    state.selected = { from: d.from, index: d.index };
    if (zone) place(zone);
    else place(d.product.section);                 // бросок мимо — товар всё равно знает свой отдел
  }

  var pendingFridge = false;          // «Отложить» ждёт, какой товар убрать

  // Зона у товара всегда одна, второй тап не нужен: берём и сразу кладём.
  function tapItem(from, index) {
    if (!state || state.status !== 'playing') return false;
    var src = from === 'belt' ? state.belt.slice(0, beltVisible()) : state.fridge;
    var id = src[index];
    if (!id) return false;
    state.selected = { from: from, index: index };
    if (pendingFridge && from === 'belt') {
      pendingFridge = false;
      return boosterFridge();
    }
    return place(productById(id).section);
  }

  function selectedProduct() {
    if (!state.selected) return null;
    var id = state.selected.from === 'belt'
      ? state.belt[state.selected.index]
      : state.fridge[state.selected.index];
    return id ? productById(id) : null;
  }

  // Очередь покупателей: кто, что просит и сколько ещё подождёт.
  function renderQueue() {
    var qw = queueW(), qh = queueH();
    for (var i = 0; i < queueSize(); i++) {
      var c = state.customers[i];
      var box = new PIXI.Container();
      box.x = queueX(i); box.y = queueY(i);

      var g = new PIXI.Graphics();
      g.roundRect(3, 6, qw, qh, 20).fill({ color: 0x3A2717, alpha: 0.22 });
      g.roundRect(0, 0, qw, qh, 20).fill(c ? C.panel : 0xEDE2CE);
      g.roundRect(4, 4, qw - 8, qh - 8, 16).stroke({ width: 3, color: 0xFFFFFF, alpha: 0.9 });
      g.roundRect(0, 0, qw, qh, 20).stroke({ width: 4, color: c ? C.steelDark : C.steel });
      g.roundRect(0, 0, 10, qh, 20).fill({ color: c ? C.sign : C.steel, alpha: c ? 0.95 : 0.5 });
      box.addChild(g);

      if (!c) {
        var wait = label('ждём покупателя', 15, C.inkSoft, '600');
        wait.anchor.set(0.5); wait.x = qw / 2; wait.y = qh / 2;
        box.addChild(wait);
        layers.queue.addChild(box);
        continue;
      }

      var ratio = c.patience / c.max;
      var mood = customerMood(c);
      var counts = trayCounts();

      var face = personGraphic(Math.min(28, qh * 0.24), c.face, mood);
      face.x = 48; face.y = qh * 0.44;
      box.addChild(face);

      // Корзина: значки крупные — на телефоне видно, что именно просят.
      // Радиус берём по свободной ширине карточки и числу позиций в заказе.
      var lines = c.order;
      // Радиус — максимум, который влезает и по ширине карточки, и по высоте:
      // под корзиной остаются строка настроения и полоса терпения.
      var r = Math.min(30, Math.floor((qh - 57) / 2.25),
                       Math.floor((qw - 100 - 10 * (lines.length - 1)) / (2 * lines.length)));
      var step = r * 2 + 10;
      var x0 = 94 + r, top = 8 + r;
      var infoY = Math.max(top + r * 1.25 + 12, qh - 44);
      var cy = (top + (infoY - 12 - r * 1.25)) / 2;   // корзина по центру свободного места
      lines.forEach(function (l, li) {
        var lp = productById(l.id);
        var cx = x0 + li * step;
        var got = gotCount(c, l, counts), done = got >= l.n;

        var disc = new PIXI.Graphics();
        disc.circle(cx, cy, r).fill(done ? mix(C.green, 0xFFFFFF, 0.78) : mix(lp.accent, 0xFFFFFF, 0.45));
        disc.circle(cx, cy, r).stroke({ width: 3, color: done ? C.green : mix(lp.accent, C.ink, 0.45) });
        box.addChild(disc);

        var ic = productIcon(lp, r * 1.55);
        ic.x = cx; ic.y = cy;
        ic.alpha = done ? 0.55 : 1;
        box.addChild(ic);

        if (done) {
          var tick = new PIXI.Graphics();
          tick.circle(cx + r * 0.72, cy + r * 0.72, r * 0.46).fill(C.green);
          tick.circle(cx + r * 0.72, cy + r * 0.72, r * 0.46).stroke({ width: 2, color: 0xFFFFFF });
          tick.moveTo(cx + r * 0.72 - r * 0.22, cy + r * 0.72)
              .lineTo(cx + r * 0.72 - r * 0.04, cy + r * 0.72 + r * 0.18)
              .lineTo(cx + r * 0.72 + r * 0.24, cy + r * 0.72 - r * 0.2)
              .stroke({ width: 3, color: 0xFFFFFF, cap: 'round', join: 'round' });
          box.addChild(tick);
        } else if (l.n > 1) {
          var badge = new PIXI.Graphics();
          badge.circle(cx + r * 0.75, cy + r * 0.75, r * 0.5).fill(C.ink);
          box.addChild(badge);
          var bt = label(got + '/' + l.n, Math.max(10, r * 0.5), 0xFFFFFF, '800');
          bt.anchor.set(0.5); bt.x = cx + r * 0.75; bt.y = cy + r * 0.75;
          box.addChild(bt);
        }
      });

      var reward = label('+50%', 14, C.green, '800');
      reward.anchor.set(1, 0.5); reward.x = qw - 14; reward.y = infoY;
      box.addChild(reward);

      // настроение подписью: покупателю видно, что он вот-вот уйдёт
      var note = label(moodWord(mood), 12, mood === 'angry' ? C.red : C.inkSoft, '700');
      note.anchor.set(0, 0.5); note.x = 100; note.y = infoY;
      box.addChild(note);

      var by = qh - 28, bx = 100, bw = qw - bx - 14;
      var bar = new PIXI.Graphics();
      bar.roundRect(bx, by, bw, 20, 5).fill(0xE2E9EE);
      bar.roundRect(bx, by, Math.max(12, bw * ratio), 20, 10)
         .fill(ratio > 0.5 ? 0x5CCA65 : (ratio > 0.25 ? C.gold : C.red));
      bar.roundRect(bx, by, bw, 20, 10).stroke({ width: 3, color: C.ink, alpha: 0.8 });
      box.addChild(bar);

      var pt = label('ждёт ещё ' + c.patience, 13, C.ink, '700');
      pt.anchor.set(0.5); pt.x = bx + bw / 2; pt.y = by + 10;
      box.addChild(pt);

      if (c.cheer > 0) box.addChild(emotionBubble(82, 18, 'cheer'));
      else if (mood === 'angry') box.addChild(emotionBubble(82, 18, 'angry'));
      else if (mood === 'worry') box.addChild(emotionBubble(82, 18, 'worry'));

      layers.queue.addChild(box);
    }
  }

  // Настроение покупателя: свежий заказ, ожидание, беспокойство, злость.
  // Только что забранная позиция на пару ходов поднимает настроение.
  function customerMood(c) {
    var ratio = c.patience / c.max;
    if (c.cheer > 0) return 'happy';
    if (ratio > 0.6) return 'happy';
    if (ratio > 0.35) return 'wait';
    if (ratio > 0.15) return 'worry';
    return 'angry';
  }

  function moodWord(mood) {
    return mood === 'happy' ? 'доволен' : mood === 'wait' ? 'ждёт'
         : mood === 'worry' ? 'нервничает' : 'вот-вот уйдёт';
  }

  // Пузырь эмоции рядом с лицом — сердечко, капля или знак раздражения.
  function emotionBubble(x, y, kind) {
    var g = new PIXI.Graphics();
    g.circle(x, y, 15).fill(kind === 'cheer' ? 0xFFEFF3 : (kind === 'angry' ? 0xFFE6E2 : 0xEAF2F8));
    g.circle(x, y, 15).stroke({ width: 2.5, color: C.ink, alpha: 0.75 });
    if (kind === 'cheer') {
      g.moveTo(x, y + 6)
       .quadraticCurveTo(x - 10, y - 2, x - 4, y - 7)
       .quadraticCurveTo(x, y - 10, x, y - 4)
       .quadraticCurveTo(x, y - 10, x + 4, y - 7)
       .quadraticCurveTo(x + 10, y - 2, x, y + 6)
       .fill(0xE2456A);
    } else if (kind === 'angry') {
      [[-1, -1], [1, -1]].forEach(function (d) {
        g.moveTo(x + d[0] * 7, y + d[1] * 7).lineTo(x + d[0] * 1, y + d[1] * 1)
         .stroke({ width: 3, color: C.red, cap: 'round' });
      });
      g.moveTo(x - 7, y + 2).lineTo(x - 1, y + 8).stroke({ width: 3, color: C.red, cap: 'round' });
      g.moveTo(x + 7, y + 2).lineTo(x + 1, y + 8).stroke({ width: 3, color: C.red, cap: 'round' });
    } else {
      g.moveTo(x, y - 8).quadraticCurveTo(x + 7, y + 2, x, y + 8)
       .quadraticCurveTo(x - 7, y + 2, x, y - 8).fill(0x5AA8DC);
    }
    return g;
  }

  function renderHud() {
    hud.revenue.text = money(shownRevenue);
    hud.shift.text = 'Смена ' + (state.shiftIdx + 1);
    hud.streak.text = 'смен подряд: ' + streak;

    var bx = HUD_PLAN_X, by = 30, bw = HUD_PLAN_W, bh = 24;
    var p = Math.min(state.served / state.goal, 1);
    hud.planBar.clear();
    hud.planBar.roundRect(bx, by, bw, bh, 5).fill(C.hudTrack);
    if (p > 0) hud.planBar.roundRect(bx, by, Math.max(bh, bw * p), bh, 5).fill(C.green);
    hud.planBar.roundRect(bx, by, bw, bh, 5).stroke({ width: 3, color: C.steel, alpha: 0.8 });
    hud.planText.text = 'Обслужено  ' + state.served + ' / ' + state.goal;

    var cx = HUD_COMBO_X, segs = 4, sw = HUD_SEG_W, gap = 5;
    hud.comboBar.clear();
    for (var i = 0; i < segs; i++) {
      var on = state.combo > i;
      hud.comboBar.roundRect(cx + i * (sw + gap), by, sw, bh, 4)
        .fill(on ? mix(C.gold, C.red, i / (segs - 1)) : C.hudTrack);
      hud.comboBar.roundRect(cx + i * (sw + gap), by, sw, bh, 4)
        .stroke({ width: 2, color: C.steel, alpha: on ? 0.9 : 0.45 });
    }
    hud.comboText.text = state.combo > 0 ? '×' + comboMult().toFixed(1) : 'комбо';
    hud.comboText.style.fill = state.combo > 0 ? C.gold : C.hudInkSoft;

    // «жизни»: сколько покупателей ещё можно упустить
    hud.lives.clear();
    var lives = state.cfg.lives, left = Math.max(0, lives - state.lost);
    for (var L = 0; L < lives; L++) {
      var lx = W - 86 - L * 24, on = L < left;
      hud.lives.circle(lx, 62, 8).fill(on ? C.red : C.hudTrack);
      hud.lives.circle(lx, 62, 8).stroke({ width: 2.5, color: C.steel, alpha: on ? 0.9 : 0.5 });
    }

    if (state.saleProduct) {
      hud.sale.visible = true;
      hud.sale.text = 'Акция дня: ' + productById(state.saleProduct).name + ' ×2';
    } else {
      hud.sale.visible = false;
    }
    if (hud.trayCap) hud.trayCap.visible = !hud.sale.visible;
  }

  /* ---------------------------------------------------------------- эффекты */

  var anims = [];

  function anim(dur, step, done) { anims.push({ t: 0, d: dur, step: step, done: done }); }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function easeBack(p) { var c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

  function squashIn(node, w, h) {
    node.pivot.set(w / 2, h / 2);
    node.x += w / 2; node.y += h / 2;
    anim(360, function (p) {
      var k = (1 - p) * Math.cos(p * Math.PI * 2.4) * 0.28;
      node.scale.set(1 + k, 1 - k);
    }, function () { node.scale.set(1); });
  }

  function flyGhost(product, from, to, done) {
    var w = beltCellW(), tw = traySlotW();
    var ghost = productPiece(product, w, BELT_H, {});
    ghost.x = from.x; ghost.y = from.y;
    layers.fx.addChild(ghost);
    var arc = 90 + Math.random() * 30;
    var sx = tw / w, sy = trayH() / BELT_H;
    anim(200, function (p) {
      var e = easeOut(p);
      ghost.x = from.x + (to.x - from.x) * e;
      ghost.y = from.y + (to.y - from.y) * e - Math.sin(p * Math.PI) * arc;
      ghost.scale.set(1 + (sx - 1) * e, 1 + (sy - 1) * e);
      ghost.rotation = Math.sin(p * Math.PI) * 0.12;
    }, function () { ghost.destroy(); if (done) done(); });
  }

  function runSaleFx() {
    var fx = pendingSaleFx;
    pendingSaleFx = null;
    if (!fx) return;

    var w = traySlotW();
    fx.slots.forEach(function (slot) {
      var ghost = productPiece(fx.product, w, trayH(), {});
      ghost.x = slotX(slot) + w / 2; ghost.y = slotY(slot) + trayH() / 2;
      ghost.pivot.set(w / 2, trayH() / 2);
      layers.fx.addChild(ghost);
      anim(300, function (p) {
        ghost.scale.set(1 + 0.3 * p);
        ghost.alpha = 1 - p;
        ghost.y -= 0.7;
      }, function () { ghost.destroy(); });
    });

    var cx = slotX(fx.slots[Math.floor(fx.slots.length / 2)]) + w / 2;
    var cy = slotY(fx.slots[0]) + trayH() / 2;
    flashArea(cx, cy, fx.perfect);
    if (fx.perfect) confetti(cx, cy);
    if (fx.order) orderServedFx();
    if (fx.perfect && fx.combo >= 2) comboSticker(fx.mult);
    sfx(fx.perfect ? 'sale' : 'wrong', fx.combo);

    var note = fx.order ? 'заказ!' : (fx.perfect ? '×' + fx.mult.toFixed(1) : 'не своя зона');
    floatText(cx, cy - trayH() / 2 + 20, '+' + money(fx.gain) + '  ' + note,
      fx.perfect || fx.order ? C.green : C.red);
    spawnCoins(cx, cy, fx.perfect ? 8 : 4);
    countRevenueTo(state.revenue);
  }

  // Товар улетает с полки к покупателю: видно, кто именно что забрал.
  function pickupFx(c, taken) {
    var idx = Math.max(0, state.customers.indexOf(c));
    var to = { x: queueX(idx) + 30, y: queueY(idx) + queueH() / 2 - 24 };
    taken.forEach(function (t) {
      flyGhost(productById(t.id), { x: slotX(t.slot), y: slotY(t.slot) }, to, function () {});
    });
    sfx('select');
  }

  // Корзина собрана: покупатель платит и уходит.
  function orderPaidFx(gain, mult) {
    orderServedFx();
    if (state.combo >= 2) comboSticker(mult);
    var cx = PANEL_X + PANEL_W / 2, cy = trayPanelY() - 24;
    floatText(cx, cy, '+' + money(gain) + '  заказ!', C.green);
    spawnCoins(cx, cy, 8);
    confetti(cx, cy);
    sfx('sale', state.combo);
    countRevenueTo(state.revenue);
  }

  function orderServedFx() {
    var box = new PIXI.Container();
    var g = new PIXI.Graphics();
    g.roundRect(-140, -34, 280, 68, 20).fill(C.green);
    g.roundRect(-140, -34, 280, 68, 20).stroke({ width: 5, color: C.ink, alpha: 1 });
    box.addChild(g);
    var t = label('ЗАКАЗ ГОТОВ!', 24, 0xFFFFFF, '800');
    t.anchor.set(0.5); t.x = 24;
    box.addChild(t);
    var face = personGraphic(20, state.lastFace || 0, 'happy');
    face.x = -96; face.y = 0;
    box.addChild(face);
    box.x = W / 2; box.y = trayPanelY() - 28;
    box.rotation = 0.05;
    box.scale.set(0.3);
    layers.fx.addChild(box);
    anim(1100, function (p) {
      box.scale.set(0.3 + 0.7 * easeBack(Math.min(p * 2.4, 1)));
      box.y = trayPanelY() - 28 - 22 * easeOut(p);
      box.alpha = p > 0.7 ? (1 - p) * 3.3 : 1;
    }, function () { box.destroy(); });
  }

  function customerLeftFx() {
    var face = personGraphic(28, state.lastFace || 0, 'sad');
    face.x = W / 2; face.y = QUEUE_Y + 60;
    layers.fx.addChild(face);
    anim(800, function (p) {
      face.y = QUEUE_Y + 60 - 50 * easeOut(p);
      face.rotation = Math.sin(p * Math.PI * 2) * 0.2;
      face.alpha = 1 - p;
    }, function () { face.destroy(); });
  }

  function confetti(x, y) {
    var colors = [C.gold, C.red, 0x47A340, 0x2575CE, 0xF19DC4];
    for (var i = 0; i < 16; i++) {
      (function () {
        var g = new PIXI.Graphics();
        var col = colors[Math.floor(Math.random() * colors.length)];
        g.roundRect(-7, -4, 14, 8, 3).fill(col);
        g.roundRect(-7, -4, 14, 8, 3).stroke({ width: 2.5, color: C.ink, alpha: 0.7 });
        g.x = x; g.y = y;
        layers.fx.addChild(g);
        var vx = (Math.random() - 0.5) * 520, vy = -240 - Math.random() * 260;
        var spin = (Math.random() - 0.5) * 18;
        anim(900, function (p) {
          var t = p * 0.9;
          g.x = x + vx * t;
          g.y = y + vy * t + 900 * t * t;
          g.rotation = spin * t;
          g.alpha = p > 0.6 ? (1 - p) * 2.5 : 1;
        }, function () { g.destroy(); });
      })();
    }
  }

  function comboSticker(mult) {
    var box = new PIXI.Container();
    var g = new PIXI.Graphics();
    g.roundRect(-96, -30, 192, 60, 18).fill(C.gold);
    g.roundRect(-96, -30, 192, 60, 18).stroke({ width: 5, color: C.ink, alpha: 1 });
    box.addChild(g);
    var t = label('КОМБО ×' + mult.toFixed(1), 25, 0xFFFFFF, '800');
    t.anchor.set(0.5);
    box.addChild(t);
    box.x = W / 2; box.y = trayTop() + 40;
    box.rotation = -0.09;
    box.scale.set(0.3);
    layers.fx.addChild(box);
    anim(1000, function (p) {
      box.scale.set(0.3 + 0.7 * easeBack(Math.min(p * 2.5, 1)));
      box.y = trayTop() + 40 - 20 * easeOut(p);
      box.alpha = p > 0.65 ? (1 - p) * 2.9 : 1;
    }, function () { box.destroy(); });
  }

  function spawnCoins(x, y, n) {
    var tx = 70, ty = 38;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var coin = new PIXI.Graphics();
        coin.circle(0, 0, 15).fill(C.gold);
        coin.circle(0, 0, 9).fill({ color: 0xFFCE44, alpha: 0.9 });
        coin.circle(-4, -5, 4).fill({ color: 0xFFFFFF, alpha: 0.7 });
        coin.circle(0, 0, 15).stroke({ width: 4, color: C.ink, alpha: 0.95 });
        coin.x = x; coin.y = y;
        layers.fx.addChild(coin);
        var cx = x + (Math.random() - 0.5) * 260, cy = y - 150 - Math.random() * 120;
        anim(520 + i * 40, function (p) {
          var e = easeOut(p), q = 1 - e;
          coin.x = q * q * x + 2 * q * e * cx + e * e * tx;
          coin.y = q * q * y + 2 * q * e * cy + e * e * ty;
          coin.scale.set(Math.cos(p * 14) * (1 - 0.3 * e), 1 - 0.3 * e);
          coin.alpha = p > 0.8 ? (1 - p) * 5 : 1;
        }, function () {
          coin.destroy();
          if (i < 2) sfx('coin');
          pulse(hud.revenue);
        });
      })(i);
    }
  }

  function countRevenueTo(target) {
    var from = shownRevenue;
    anim(600, function (p) {
      shownRevenue = from + (target - from) * easeOut(p);
      hud.revenue.text = money(shownRevenue);
    }, function () { shownRevenue = target; hud.revenue.text = money(shownRevenue); });
  }

  function pulse(node) {
    if (node.__pulsing) return;
    node.__pulsing = true;
    var base = node.scale.x;
    anim(220, function (p) { node.scale.set(base * (1 + 0.12 * Math.sin(p * Math.PI))); },
      function () { node.scale.set(base); node.__pulsing = false; });
  }

  function flashArea(x, y, ok) {
    var g = new PIXI.Graphics();
    g.roundRect(x - 130, y - trayH() / 2 - 8, 260, trayH() + 16, 16).fill(ok ? 0x6CE163 : 0xEF7A7A);
    g.alpha = 0.7;
    layers.fx.addChild(g);
    anim(340, function (p) { g.alpha = 0.7 * (1 - p); }, function () { g.destroy(); });
  }

  function shakeZone(zoneId) {
    var node = zoneNodes[zoneId];
    if (!node) return;
    var base = node.x;
    anim(260, function (p) { node.x = base + Math.sin(p * Math.PI * 6) * 9 * (1 - p); },
      function () { node.x = base; });
  }

  function floatText(x, y, text, color) {
    var t = label(text, 27, color, '800');
    t.anchor.set(0.5);
    t.x = Math.max(150, Math.min(W - 150, x)); t.y = y;
    layers.fx.addChild(t);
    anim(950, function (p) { t.y = y - 70 * easeOut(p); t.alpha = 1 - p * p; },
      function () { t.destroy(); });
  }

  // Страховка от залипших спрайтов: эффект живёт не дольше пары секунд, а
  // призрак перетаскивания исчезает вместе с самим жестом.
  function sweepFx() {
    if (!layers.fx) return;
    var now = performance.now();
    for (var i = layers.fx.children.length - 1; i >= 0; i--) {
      var n = layers.fx.children[i];
      if (n.__drag) { if (!drag) n.destroy(); continue; }
      if (n.__born == null) n.__born = now;
      else if (now - n.__born > 2500) n.destroy();
    }
  }

  function toast(msg) {
    toastBox.text.text = msg;
    toastBox.alpha = 1;
    anim(1400, function (p) {
      toastBox.alpha = p < 0.75 ? 1 : (1 - p) * 4;
      toastBox.y = BELT_PANEL_Y - 28 - 10 * easeOut(Math.min(p * 4, 1));
    });
  }

  /* ------------------------------------------------------ экран магазина */

  function upgradeIcon(id, size) {
    var g = new PIXI.Graphics(), s = size;
    if (id === 'fridge') {
      g.roundRect(s * 0.22, s * 0.1, s * 0.56, s * 0.8, s * 0.1).fill(0xC8E3F5);
      g.roundRect(s * 0.22, s * 0.1, s * 0.56, s * 0.8, s * 0.1).stroke({ width: 4, color: 0x5F9DC1 });
      g.rect(s * 0.22, s * 0.44, s * 0.56, 4).fill(0x5F9DC1);
    } else if (id === 'cart') {
      g.moveTo(s * 0.18, s * 0.28).lineTo(s * 0.84, s * 0.28).lineTo(s * 0.72, s * 0.62)
       .lineTo(s * 0.3, s * 0.62).closePath().fill(0xFF9F32);
      g.moveTo(s * 0.18, s * 0.28).lineTo(s * 0.84, s * 0.28).lineTo(s * 0.72, s * 0.62)
       .lineTo(s * 0.3, s * 0.62).closePath().stroke({ width: 4, color: C.ink });
      g.circle(s * 0.36, s * 0.76, s * 0.09).fill(C.ink);
      g.circle(s * 0.66, s * 0.76, s * 0.09).fill(C.ink);
    } else if (id === 'cash') {
      g.roundRect(s * 0.16, s * 0.3, s * 0.68, s * 0.5, s * 0.08).fill(0xD3B88D);
      g.roundRect(s * 0.16, s * 0.3, s * 0.68, s * 0.5, s * 0.08).stroke({ width: 4, color: C.ink });
      g.roundRect(s * 0.26, s * 0.52, s * 0.48, s * 0.12, 4).fill(0xFFF1DA);
      g.circle(s * 0.5, s * 0.22, s * 0.12).fill(C.gold);
      g.circle(s * 0.5, s * 0.22, s * 0.12).stroke({ width: 4, color: C.ink });
    } else if (id === 'counter') {
      g.roundRect(s * 0.1, s * 0.34, s * 0.8, s * 0.2, 6).fill(C.steelLight);
      g.roundRect(s * 0.1, s * 0.34, s * 0.8, s * 0.2, 6).stroke({ width: 4, color: C.ink });
      g.roundRect(s * 0.18, s * 0.54, s * 0.64, s * 0.28, 6).fill(0xF6DCAB);
      g.roundRect(s * 0.18, s * 0.54, s * 0.64, s * 0.28, 6).stroke({ width: 4, color: C.ink });
      g.circle(s * 0.34, s * 0.24, s * 0.09).fill(C.gold);
      g.circle(s * 0.62, s * 0.24, s * 0.09).fill(0xFF675B);
    } else if (id === 'chem') {
      g.roundRect(s * 0.3, s * 0.32, s * 0.4, s * 0.5, s * 0.08).fill(0x4FA9CE);
      g.roundRect(s * 0.3, s * 0.32, s * 0.4, s * 0.5, s * 0.08).stroke({ width: 4, color: C.ink });
      g.roundRect(s * 0.38, s * 0.16, s * 0.24, s * 0.18, s * 0.05).fill(C.steelLight);
      g.roundRect(s * 0.38, s * 0.16, s * 0.24, s * 0.18, s * 0.05).stroke({ width: 4, color: C.ink });
      g.roundRect(s * 0.36, s * 0.46, s * 0.28, s * 0.2, 4).fill(0xFFFFFF);
      g.circle(s * 0.74, s * 0.2, s * 0.05).fill(0x9FE3C6);
      g.circle(s * 0.84, s * 0.3, s * 0.035).fill(0x9FE3C6);
    } else if (id === 'produce') {
      g.circle(s * 0.42, s * 0.6, s * 0.22).fill(0xD94436);
      g.circle(s * 0.42, s * 0.6, s * 0.22).stroke({ width: 4, color: C.ink });
      g.moveTo(s * 0.42, s * 0.38).quadraticCurveTo(s * 0.5, s * 0.22, s * 0.66, s * 0.24)
       .quadraticCurveTo(s * 0.56, s * 0.4, s * 0.42, s * 0.38).fill(0x4E9B43);
      g.ellipse(s * 0.7, s * 0.66, s * 0.16, s * 0.1).fill(0xE8A030);
      g.ellipse(s * 0.7, s * 0.66, s * 0.16, s * 0.1).stroke({ width: 3.5, color: C.ink });
    } else if (id === 'meat') {
      g.ellipse(s * 0.5, s * 0.52, s * 0.34, s * 0.26).fill(0xB0372A);
      g.ellipse(s * 0.5, s * 0.52, s * 0.34, s * 0.26).stroke({ width: 4, color: C.ink });
      g.ellipse(s * 0.42, s * 0.46, s * 0.12, s * 0.08).fill({ color: 0xE4867A, alpha: 0.9 });
      g.roundRect(s * 0.28, s * 0.66, s * 0.44, s * 0.1, 5).fill(0xFFF3DE);
      g.roundRect(s * 0.28, s * 0.66, s * 0.44, s * 0.1, 5).stroke({ width: 3, color: C.ink });
    } else if (id === 'ads') {
      g.moveTo(s * 0.2, s * 0.36).lineTo(s * 0.5, s * 0.2).lineTo(s * 0.5, s * 0.76)
       .lineTo(s * 0.2, s * 0.6).closePath().fill(C.gold);
      g.moveTo(s * 0.2, s * 0.36).lineTo(s * 0.5, s * 0.2).lineTo(s * 0.5, s * 0.76)
       .lineTo(s * 0.2, s * 0.6).closePath().stroke({ width: 4, color: C.ink });
      g.roundRect(s * 0.08, s * 0.38, s * 0.14, s * 0.2, 4).fill(C.steelLight);
      g.roundRect(s * 0.08, s * 0.38, s * 0.14, s * 0.2, 4).stroke({ width: 4, color: C.ink });
      [0.58, 0.72, 0.86].forEach(function (r, i) {
        g.moveTo(s * r, s * (0.34 - i * 0.02)).quadraticCurveTo(s * (r + 0.08), s * 0.48, s * r, s * (0.62 + i * 0.02))
         .stroke({ width: 4 - i, color: C.ink, alpha: 0.9 - i * 0.2, cap: 'round' });
      });
    } else {
      g.roundRect(s * 0.12, s * 0.24, s * 0.76, s * 0.4, 8).fill(C.red);
      g.roundRect(s * 0.12, s * 0.24, s * 0.76, s * 0.4, 8).stroke({ width: 4, color: C.ink });
      g.rect(s * 0.3, s * 0.64, 5, s * 0.18).fill(C.ink);
      g.rect(s * 0.66, s * 0.64, 5, s * 0.18).fill(C.ink);
      g.circle(s * 0.5, s * 0.44, s * 0.1).fill(0xFFF1DA);
    }
    return g;
  }

  function showShop() {
    overlayKind = 'shop';
    overlay.removeChildren();
    overlay.visible = true;

    var dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x0E1820, alpha: 0.74 });
    overlay.addChild(dim);

    // на узком экране апгрейды выстраиваются в две колонки
    var cols = W < 940 ? 2 : 3, ch = 126, gap = 12;
    var shopRows = Math.ceil(UPGRADES.length / cols);
    var pw = Math.min(1020, W - 40);
    var ph = Math.min(H - 40, 84 + shopRows * (ch + gap) + 96);
    var px = (W - pw) / 2, py = (H - ph) / 2;
    var panel = new PIXI.Graphics();
    panel.roundRect(px + 6, py + 8, pw, ph, 18).fill({ color: 0x000000, alpha: 0.3 });
    panel.roundRect(px, py, pw, ph, 18).fill(C.panel);
    panel.roundRect(px, py, pw, 68, 18).fill(C.steel);
    panel.roundRect(px, py + 44, pw, 24).fill(C.steel);
    panel.roundRect(px, py, pw, ph, 18).stroke({ width: 4, color: C.steelDark });
    overlay.addChild(panel);

    var title = label('Ваш магазин', 27, 0xFFFFFF, '800');
    title.anchor.set(0, 0.5); title.x = px + 24; title.y = py + 34;
    overlay.addChild(title);

    var wallet = label(money(meta.wallet), 26, 0xFFF3D0, '800');
    wallet.anchor.set(1, 0.5); wallet.x = px + pw - 24; wallet.y = py + 34;
    overlay.addChild(wallet);

    var cw = (pw - 20 * (cols + 1)) / cols;
    UPGRADES.forEach(function (u, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var x = px + 20 + col * (cw + 20), y = py + 84 + row * (ch + gap);
      var lvl = meta.up[u.id], price = upgradePrice(u);

      var card = new PIXI.Graphics();
      card.roundRect(x, y, cw, ch, 14).fill(row % 2 ? 0xFDF4E4 : 0xFFFFFF);
      card.roundRect(x, y, cw, ch, 14).stroke({ width: 3, color: C.steel });
      overlay.addChild(card);

      var disc = new PIXI.Graphics();
      disc.circle(x + 44, y + 42, 28).fill(0xF6EAD6);
      disc.circle(x + 44, y + 42, 28).stroke({ width: 3, color: C.ink, alpha: 0.45 });
      overlay.addChild(disc);
      var icon = upgradeIcon(u.id, 46);
      icon.x = x + 21; icon.y = y + 19;
      overlay.addChild(icon);

      var name = label(u.name, 17, C.ink, '800');
      name.x = x + 80; name.y = y + 16;
      overlay.addChild(name);

      var eff = labelWrap(lvl > 0 ? u.effect(lvl) : u.hint, 12,
        lvl > 0 ? C.green : C.inkSoft, '600', cw - 92);
      eff.x = x + 80; eff.y = y + 40;
      overlay.addChild(eff);

      for (var k = 0; k < u.max; k++) {
        var pip = new PIXI.Graphics();
        pip.circle(x + 20 + k * 18, y + ch - 18, 6).fill(k < lvl ? C.gold : 0xE0D6C4);
        pip.circle(x + 20 + k * 18, y + ch - 18, 6).stroke({ width: 2, color: C.ink, alpha: 0.4 });
        overlay.addChild(pip);
      }

      if (price == null) {
        var maxed = label('Максимум', 15, C.green, '800');
        maxed.anchor.set(1, 0.5); maxed.x = x + cw - 18; maxed.y = y + ch - 22;
        overlay.addChild(maxed);
      } else {
        var can = meta.wallet >= price;
        overlay.addChild(button(x + cw - 132, y + ch - 46, 116, 40, money(price),
          null, can, function (id) { return function () { buyUpgrade(id); }; }(u.id)));
      }
    });

    var next = meta.shiftIdx;
    overlay.addChild(button(px + pw / 2 - 190, py + ph - 90, 380, 58,
      'Открыть смену ' + (next + 1), null, true, function () {
        hideOverlay();
        startShift(next);
        rebuildBoard();
        render();
      }));

    var journal = label('журнал плейтеста', 14, C.inkSoft, '600');
    journal.anchor.set(0, 0.5); journal.x = px + 24; journal.y = py + ph - 16;
    journal.eventMode = 'static'; journal.cursor = 'pointer';
    journal.on('pointertap', showLogPanel);
    overlay.addChild(journal);

    var reset = label('сбросить прогресс', 14, C.inkSoft, '600');
    reset.anchor.set(1, 0.5); reset.x = px + pw - 24; reset.y = py + ph - 16;
    reset.eventMode = 'static'; reset.cursor = 'pointer';
    reset.on('pointertap', function () {
      meta = defaultMeta(); streak = 0; totalRevenue = 0;
      saveMeta();
      logEvent('reset', {});
      sfx('deny');
      showShop();
    });
    overlay.addChild(reset);
  }

  /* ---------------------------------------------------------------- итоги */

  function showOverlay(status, reason) {
    overlayKind = { status: status, reason: reason };
    overlay.removeChildren();
    overlay.visible = true;

    var dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x0E1820, alpha: 0.74 });
    overlay.addChild(dim);

    var won = status === 'won';
    var pw = Math.min(620, W - 40), ph = Math.min(470, H - 60);
    var px = (W - pw) / 2, py = (H - ph) / 2;

    var panel = new PIXI.Graphics();
    panel.roundRect(px + 6, py + 8, pw, ph, 18).fill({ color: 0x000000, alpha: 0.3 });
    panel.roundRect(px, py, pw, ph, 18).fill(C.panel);
    panel.roundRect(px, py, pw, 74, 18).fill(won ? C.green : C.red);
    panel.roundRect(px, py + 50, pw, 24).fill(won ? C.green : C.red);
    panel.roundRect(px, py, pw, ph, 18).stroke({ width: 5, color: C.ink, alpha: 0.9 });
    overlay.addChild(panel);

    var title = label(won ? 'Смена закрыта!' : 'Смена сорвана', 30, 0xFFFFFF, '800');
    title.anchor.set(0.5); title.x = W / 2; title.y = py + 37;
    overlay.addChild(title);

    var rows = [
      ['Выручка', money(state.revenue)],
      ['Обслужено', state.served + ' / ' + state.goal],
      ['Ушли не дождавшись', String(state.lost)],
      ['Списано просрочки', state.spoiled + ' шт · ' + money(state.writeOff)],
      ['Лучшее комбо', '×' + Math.min(1 + 0.5 * bestCombo, COMBO_MAX_MULT).toFixed(1)],
      ['Смен подряд', String(streak)]
    ];
    rows.forEach(function (r, i) {
      var y = py + 104 + i * 42;
      var line = new PIXI.Graphics();
      line.roundRect(px + 26, y - 16, pw - 52, 34, 6).fill(i % 2 ? 0xF1F5F8 : 0xFFFFFF);
      overlay.addChild(line);
      var k = label(r[0], 17, C.inkSoft, '600');
      k.anchor.set(0, 0.5); k.x = px + 40; k.y = y;
      var v = label(r[1], 18, C.ink, '800');
      v.anchor.set(1, 0.5); v.x = px + pw - 40; v.y = y;
      overlay.addChild(k, v);
    });

    if (reason) {
      var why = label(reason, 15, C.inkSoft, '600');
      why.anchor.set(0.5); why.x = W / 2; why.y = py + ph - 100;
      overlay.addChild(why);
    }

    if (won) {
      overlay.addChild(button(px + 30, py + ph - 84, pw - 60, 66,
        'В магазин  ·  ' + money(state.revenue), 'выручка ушла в кассу', true, showShop));
    } else {
      overlay.addChild(button(px + 30, py + ph - 84, (pw - 76) / 2, 66, 'Переиграть', null, true, retryShift));
      overlay.addChild(button(px + 46 + (pw - 76) / 2, py + ph - 84, (pw - 76) / 2, 66, 'В магазин', null, true, showShop));
    }
  }

  function hideOverlay() { overlayKind = null; overlay.visible = false; overlay.removeChildren(); }

  /* ------------------------------------------------------------------ boot */

  function fitScale() {
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    app.renderer.resize(Math.ceil(W * s), Math.ceil(H * s));
    root.scale.set(s);
  }

  // Окно поменяло размер или ориентацию: пересчитываем холст и, если раскладка
  // сменилась, собираем сцену под неё заново.
  function fit() {
    var changed = measure();
    if (changed) layout();
    fitScale();
    if (changed && layers.trayStatic) rebuildScene();
  }

  // Жадный бот для смоук-теста и замеров: добить тройку, попасть в свою зону,
  // не занимать последний слот зря, отдать предпочтение заказу покупателя.
  function autoStep() {
    if (!state || state.status !== 'playing') return false;
    var visible = state.belt.slice(0, beltVisible());
    var counts = trayCounts();
    var orderFor = function (id) {
      var found = null;
      state.customers.forEach(function (c) {
        if (stillNeeded(c, id) > 0 && (!found || c.patience < found.patience)) found = c;
      });
      return found;
    };
    var best = null;

    for (var i = 0; i < visible.length; i++) {
      var p = productById(visible[i]);
      var onTray = state.tray.filter(function (c) { return c === p.id; }).length;
      var zone = zoneById(p.section), r = zoneRange(zone.id);
      var free = 0;
      for (var k = r.from; k < r.to; k++) if (state.tray[k] === null) free++;
      if (!free) continue;

      var score = onTray * 18 + free * 3;
      if (onTray === 2) score += 40;                          // добиваем тройку
      var ord = orderFor(p.id);
      if (ord) score += 30 + Math.round(60 / Math.max(1, ord.patience));  // срочный заказ важнее
      if (free === 1 && onTray < 2) score -= 22;              // не забивать зону зря
      if (!best || score > best.score) best = { i: i, zone: zone.id, score: score };
    }
    if (!best) return unblock();
    state.selected = null;
    select('belt', best.i);
    return place(best.zone);
  }

  // Выложить нечего: с жёсткими зонами это нормальный ход игры, и выход из него
  // — бустеры. Бот без них занижал бы винрейт, поэтому ходит ими в том же
  // порядке, что и человек: перемешать завоз, убрать лишнее, отменить ход.
  function unblock() {
    if (state.boosters.shuffle && state.belt.length > beltVisible() && boosterShuffle()) return true;
    if (state.boosters.fridge && state.fridge.length < fridgeSize() && state.belt.length) {
      state.selected = null;
      select('belt', 0);
      if (boosterFridge()) return true;
      state.selected = null;
    }
    if (state.boosters.undo && state.lastPlacement && boosterUndo()) return true;
    return false;
  }

  function boot() {
    measure();
    layout();
    app = new PIXI.Application();
    app.init({
      width: W, height: H, background: C.wallBot,
      antialias: true, autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    }).then(function () {
      var bootEl = document.getElementById('boot');
      if (bootEl) bootEl.remove();
      document.body.appendChild(app.canvas);

      root = new PIXI.Container();
      app.stage.addChild(root);

      if (metaResetFrom) {
        saveMeta();                              // закрепляем отметку новой сборки
        logEvent('build_reset', { from: metaResetFrom, to: BUILD });
      }
      logEvent('boot', { build: BUILD, w: window.innerWidth, h: window.innerHeight,
        dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
        ua: (navigator.userAgent || '').slice(0, 120) });
      startShift(meta.shiftIdx);
      buildStatic();
      fit();
      loadArt().then(function () { render(); });
      var resizeTimer = null;
      var onResize = function () {
        fitScale();                            // масштаб подгоняем сразу
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fit, 140);    // а пересборку — когда окно замерло
      };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);

      app.stage.eventMode = 'static';
      app.stage.hitArea = { contains: function () { return true; } };
      app.stage.on('pointermove', moveDrag);
      app.stage.on('pointerup', endDrag);
      app.stage.on('pointerupoutside', endDrag);
      app.stage.on('pointercancel', cancelDrag);
      // Браузер может не отдать pointerup (системный жест, уход со страницы) —
      // страхуемся окном, иначе товар остаётся висеть над залом.
      window.addEventListener('pointerup', function () { if (drag) endDrag(null); });
      window.addEventListener('pointercancel', cancelDrag);
      window.addEventListener('blur', cancelDrag);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) cancelDrag();
      });

      var unlock = function () { if (window.ShopAudio) window.ShopAudio.unlock(); };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });

      var clock = 0;
      app.ticker.add(function (ticker) {
        clock += ticker.deltaMS / 1000;
        for (var i = anims.length - 1; i >= 0; i--) {
          var a = anims[i];
          a.t += ticker.deltaMS;
          var p = Math.min(a.t / a.d, 1);
          var broken = false;
          try { a.step(p); } catch (err) { broken = true; }
          if (p >= 1 || broken) {                 // упавший шаг не должен морозить остальные
            anims.splice(i, 1);
            if (a.done) { try { a.done(); } catch (err2) {} }
          }
        }
        sweepFx();
        for (var k = 0; k < beltNodes.length; k++) {
          var n = beltNodes[k];
          if (n.baseY != null && n !== selectedNode) n.y = n.baseY + Math.sin(clock * 1.8 + n.phase) * 3;
        }
        if (selectedNode && !selectedNode.destroyed) {
          selectedNode.scale.set(1.06 + Math.sin(clock * 7) * 0.035);
          selectedNode.rotation = Math.sin(clock * 3.5) * 0.03;
        }
        if (signNode) signNode.y = Math.sin(clock * 1.1) * 2.5;
      });

      window.__proto = {
        get state() { return state; },
        get streak() { return streak; },
        get meta() { return meta; },
        select: select, place: place, tapItem: tapItem, autoStep: autoStep,
        booster: { undo: boosterUndo, fridge: boosterFridge, shuffle: boosterShuffle },
        nextShift: nextShift, retryShift: retryShift,
        shop: showShop, buy: buyUpgrade, zoneUnder: zoneUnder,
        fridgeSize: fridgeSize, beltVisible: beltVisible, traySize: traySize,
        zoneRange: zoneRange, zoneOfSlot: zoneOfSlot, pullDemanded: pullDemanded,
        section: function (id) { return productById(id).section; },
        products: function () { return PRODUCTS.map(function (x) { return x.id; }); },
        build: BUILD, metaResetFrom: function () { return metaResetFrom; },
        // для смоука: сколько спрайтов эффектов висит и где лежит коробка завоза
        fxCount: function () { return layers.fx ? layers.fx.children.length : 0; },
        layout: function () {
          return { w: W, h: H, portrait: PORTRAIT, cols: QUEUE_COLS,
                   panelW: PANEL_W, trayRows: trayRows(), btnRow: BTN_ROW,
                   canvas: app ? app.renderer.width : 0 };
        },
        beltPos: function (i) { return beltSlotPos(i); },
        pagePoint: function (pt) {
          var r = app.canvas.getBoundingClientRect(), k = r.width / app.renderer.width;
          return { x: r.left + pt.x * root.scale.x * k, y: r.top + pt.y * root.scale.y * k };
        },
        // лист типажей для визуальной проверки набора покупателей
        faceSheet: function () {
          overlay.removeChildren(); overlay.visible = true;
          var dim = new PIXI.Graphics();
          dim.rect(0, 0, W, H).fill(0xF2F6F9);
          overlay.addChild(dim);
          ['happy', 'wait', 'worry', 'angry'].forEach(function (mood, row) {
            PEOPLE.forEach(function (p, i) {
              var n = personGraphic(38, i, mood);
              n.x = 84 + i * 146; n.y = 92 + row * 158;
              overlay.addChild(n);
            });
          });
        },
        // ручка для замеров баланса: 0 — завоз как есть, 0.7 — рабочее значение
        demandPull: function (v) { if (v != null) DEMAND_PULL = v; return DEMAND_PULL; },
        startShift: function (i, seed) { hideOverlay(); startShift(i, seed); rebuildBoard(); render(); },
        log: {
          get events() { return logEvents.slice(); },
          summary: logSummary, text: logText, clear: clearLog,
          panel: showLogPanel, hidePanel: hideLogPanel
        }
      };
    });
  }

  boot();
})();
