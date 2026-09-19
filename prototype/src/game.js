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

  var W = 720, H = 1280;

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
    { id: 'produce', name: 'Овощи',   slots: 4, color: 0x2A8F3B, tint: 0xE6F4E8 }
  ];

  var PRODUCTS = [
    { id: 'milk',   name: 'Молоко',   glyph: '🥛', section: 'dairy',   price: 40, color: 0xC6E2FB, accent: 0x80C1FC },
    { id: 'cheese', name: 'Сыр',      glyph: '🧀', section: 'dairy',   price: 55, color: 0xFFE7AE, accent: 0xFFC21C },
    { id: 'yogurt', name: 'Йогурт',   glyph: '🍶', section: 'dairy',   price: 35, color: 0xD7E4F5, accent: 0xF19DC4 },
    { id: 'butter', name: 'Масло',    glyph: '🧈', section: 'dairy',   price: 60, color: 0xFDECBA, accent: 0xFFDC64 },
    { id: 'bread',  name: 'Хлеб',     glyph: '🍞', section: 'grocery', price: 30, color: 0xFDDCA4, accent: 0xFF9F32 },
    { id: 'grain',  name: 'Крупа',    glyph: '🍚', section: 'grocery', price: 45, color: 0xF2E4CA, accent: 0xE5C776 },
    { id: 'cookie', name: 'Печенье',  glyph: '🍪', section: 'grocery', price: 50, color: 0xF7D3A2, accent: 0xE58227 },
    { id: 'can',    name: 'Консервы', glyph: '🥫', section: 'grocery', price: 65, color: 0xF3C6B8, accent: 0xF16C4C },
    { id: 'apple',  name: 'Яблоко',   glyph: '🍎', section: 'produce', price: 35, color: 0xFBC2BF, accent: 0xFF675B },
    { id: 'carrot', name: 'Морковь',  glyph: '🥕', section: 'produce', price: 25, color: 0xFFD7AF, accent: 0xFF9B36 },
    { id: 'tomato', name: 'Помидор',  glyph: '🍅', section: 'produce', price: 40, color: 0xFFC2B5, accent: 0xFF4D3C },
    { id: 'grape',  name: 'Виноград', glyph: '🍇', section: 'produce', price: 70, color: 0xDCC9F3, accent: 0xAA78E2 }
  ];

  // План смены — обслуженные покупатели, а не просто проданные тройки.
  var SHIFTS = [
    { types: 6,  crates: 27, goal: 4, patience: 14, visible: 5, lives: 4, sale: false },
    { types: 9,  crates: 39, goal: 6, patience: 18, visible: 6, lives: 3, sale: false },
    { types: 10, crates: 48, goal: 7, patience: 22, visible: 6, lives: 3, sale: true  }
  ];

  var QUEUE_SIZE = 3;
  var BELT_VISIBLE_MAX = 6;
  var FRIDGE_BASE = 3;
  var COMBO_MAX_MULT = 3;
  var COST_RATE = 0.4;         // себестоимость товара — доля от цены
  var LIFE = { dairy: 7, grocery: 12, produce: 6 };   // срок годности в ходах
  var DEMAND_PULL = 0.7;       // как часто нужный товар подтягивается из глубины завоза
  var DEMAND_DEPTH = 12;       // насколько глубоко за ним лезем
  var ORDER_MULT = 1.5;        // бонус за заказ покупателя
  var ZONE_MULT = 1.5;         // бонус за выкладку в свою зону

  /* ------------------------------------------------------------- палитра */

  var C = {
    wallTop: 0xF7FAFC, wallBot: 0xD9E2E8, floor: 0xD9D3C6,
    steel: 0x92A0AA, steelDark: 0x5C6872, steelLight: 0xC4CFD7, shelf: 0xEDF2F5,
    ink: 0x1B2731, inkSoft: 0x5E6D78,
    panel: 0xFFFFFF, gold: 0xF5A623,
    green: 0x18A54B, red: 0xE23B2E,
    sign: 0x123B63, signAlt: 0xFFFFFF,
    hudBg: 0x16202A, hudInk: 0xEAF1F6, hudInkSoft: 0x93A3AE, hudTrack: 0x2B3A47,
    cardboard: 0xC98D4E, cardboardLight: 0xE6B87A, chill: 0xDCEEF7
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
    { id: 'sign',    name: 'Вывеска', max: 3, prices: [2000, 4500, 9000],
      effect: function (l) { return '+' + (l * 5) + ' к терпению покупателей'; },
      hint: 'Покупатели ждут дольше' }
  ];

  var META_KEY = 'shopsort.meta';
  var metaResetFrom = null;          // сборка, чей прогресс обнулили при старте
  var meta = loadMeta();             // объявление выше: loadMeta пишет в metaResetFrom

  function defaultMeta() {
    return { build: BUILD, wallet: 0, shiftIdx: 0, streak: 0, total: 0,
             up: { counter: 0, fridge: 0, cart: 0, cash: 0, sign: 0 } };
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
    meta.wallet -= price;
    meta.up[u.id] += 1;
    saveMeta();
    logEvent('upgrade', { id: u.id, level: meta.up[u.id], price: price, wallet: meta.wallet });
    sfx('booster');
    showShop();
    return true;
  }

  function fridgeSize() { return FRIDGE_BASE + meta.up.fridge; }
  function zoneSlots(zone) { return zone.slots + (zone.id === 'grocery' ? meta.up.counter : 0); }
  function traySize() {
    var n = 0;
    ZONES.forEach(function (z) { n += zoneSlots(z); });
    return n;
  }

  function zoneById(id) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].id === id) return ZONES[i];
    return null;
  }

  function zoneRange(zoneId) {
    var from = 0;
    for (var i = 0; i < ZONES.length; i++) {
      var n = zoneSlots(ZONES[i]);
      if (ZONES[i].id === zoneId) return { from: from, to: from + n };
      from += n;
    }
    return { from: 0, to: 0 };
  }

  function zoneOfSlot(i) {
    var from = 0;
    for (var z = 0; z < ZONES.length; z++) {
      var n = zoneSlots(ZONES[z]);
      if (i < from + n) return ZONES[z].id;
      from += n;
    }
    return ZONES[ZONES.length - 1].id;
  }

  function shiftConfig(idx) {
    if (idx < SHIFTS.length) return SHIFTS[idx];
    var crates = 48 + (idx - 2) * 6;
    crates -= crates % 3;
    return {
      types: 12,
      crates: crates,
      goal: Math.min(7 + (idx - 2), Math.floor(crates / 3) - 4),
      patience: Math.max(16, 22 - Math.floor((idx - 2) / 2)),
      visible: 6,
      lives: 3,
      sale: true
    };
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
  function poolFor(types) {
    var pool = [];
    ZONES.forEach(function (z, i) {
      var n = Math.floor(types / ZONES.length) + (i < types % ZONES.length ? 1 : 0);
      pool = pool.concat(PRODUCTS.filter(function (p) { return p.section === z.id; }).slice(0, n));
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

    var pool = poolFor(cfg.types);
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
    for (var i = 0; i < QUEUE_SIZE; i++) spawnCustomer();
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
      c.order.forEach(function (l) { if (stillNeeded(c, l.id, counts) > 0) need[l.id] = true; });
    });

    var n = Math.min(beltVisible(), state.belt.length);
    if (!n) return false;

    var stuck = !placeableNow();          // в окне вообще нечего выложить
    var wanted = function (id) { return stuck ? fits(id) : (need[id] && fits(id)); };
    for (var v = 0; v < n; v++) if (wanted(state.belt[v])) return false;   // и так под рукой
    if (!stuck && state.rnd() > DEMAND_PULL) return false;                 // из тупика тянем всегда

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
      var id = cand[Math.floor(state.rnd() * cand.length)];
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

    var roll = state.rnd();
    var shapes = roll < 0.4 ? [[3], [2, 1], [1, 1, 1]]
               : roll < 0.75 ? [[2, 1], [1, 1, 1], [3]]
                             : [[1, 1, 1], [2, 1], [3]];
    var order = null;
    for (var s = 0; s < shapes.length && !order; s++) order = pickOrder(counts, taken, shapes[s]);
    if (!order) return null;

    var patience = state.cfg.patience + meta.up.sign * 5;
    // типаж покупателя: стараемся не ставить рядом два одинаковых лица
    var used = state.customers.map(function (q) { return q.face; });
    var face = Math.floor(state.rnd() * PEOPLE.length);
    for (var t = 0; t < PEOPLE.length && used.indexOf(face) !== -1; t++) face = (face + 1) % PEOPLE.length;
    var c = { order: order, patience: patience, max: patience, face: face };
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
    var need = 0;
    c.order.forEach(function (l) {
      if (l.id === productId) need = Math.max(0, l.n - (counts[l.id] || 0));
    });
    return need;
  }

  function tickPatience() {
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

  function orderReady(c, counts) {
    for (var i = 0; i < c.order.length; i++) {
      if ((counts[c.order[i].id] || 0) < c.order[i].n) return false;
    }
    return true;
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

    var sale = resolveSale();
    tickPatience();
    tickFresh();
    pullDemanded();

    var key = 'slot:' + slot;
    if (!sale) hiddenSlots[key] = true;
    render();

    flyGhost(productById(productId), from, { x: slotX(slot), y: TRAY_Y }, function () {
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
  function resolveSale() {
    var counts = trayCounts();

    // сперва — собранный набор покупателя, ради него товар и держат на полке
    var cust = null;
    for (var q = 0; q < state.customers.length && !cust; q++) {
      if (orderReady(state.customers[q], counts)) cust = state.customers[q];
    }

    var chosen = [], product = null;
    if (cust) {
      cust.order.forEach(function (l) { chosen = chosen.concat(takeSlots(l.id, l.n)); });
      product = productById(cust.order[0].id);
    } else {
      // без заказа продаётся привычная тройка одинаковых — «с полки»
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
    ZONES.forEach(function (z) {
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
    if (!state.selected || state.selected.from !== 'belt') { toast('Возьмите товар с завоза'); sfx('deny'); return false; }
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

  var HUD_H = 150, SIGN_Y = 150, SIGN_H = 58;
  var QUEUE_Y = 236, QUEUE_W = 208, QUEUE_H = 208, QUEUE_GAP = 24, QUEUE_X0 = 24;
  var TRAY_PANEL_Y = 486, TRAY_Y = 578, TRAY_H = 88, TRAY_GAP = 6, ZONE_GAP = 16;
  var BELT_PANEL_Y = 790, BELT_Y = 832, BELT_H = 138, BELT_GAP = 10;
  var FRIDGE_Y = 1006, FRIDGE_SLOT_W = 108, FRIDGE_SLOT_H = 84;
  var BTN_Y = 1124, BTN_W = 200, BTN_H = 90, BTN_GAP = 20, BTN_X0 = 40;
  var PANEL_X = 24, PANEL_W = 672;

  function traySlotW() {
    var n = traySize();
    return Math.floor((PANEL_W - 16 - TRAY_GAP * (n - 1) - ZONE_GAP * (ZONES.length - 1)) / n);
  }

  function slotX(i) {
    var w = traySlotW(), x = PANEL_X + 8, idx = 0;
    for (var z = 0; z < ZONES.length; z++) {
      var n = zoneSlots(ZONES[z]);
      if (i < idx + n) return x + (i - idx) * (w + TRAY_GAP);
      x += n * (w + TRAY_GAP) - TRAY_GAP + ZONE_GAP;
      idx += n;
    }
    return x;
  }

  function zoneBox(zoneId) {
    var r = zoneRange(zoneId), w = traySlotW();
    var n = r.to - r.from;
    var x = slotX(r.from);
    return { x: x - 8, y: TRAY_Y - 10, w: n * (w + TRAY_GAP) - TRAY_GAP + 16, h: TRAY_H + 20 };
  }

  function beltVisible() { return ((state && state.cfg.visible) || BELT_VISIBLE_MAX) + meta.up.cart; }
  function beltCellW() { var n = beltVisible(); return Math.floor((PANEL_W - 40 - BELT_GAP * (n - 1)) / n); }
  function beltX0() { var n = beltVisible(); return PANEL_X + (PANEL_W - (beltCellW() * n + BELT_GAP * (n - 1))) / 2; }
  function beltSlotPos(i) { return { x: beltX0() + i * (beltCellW() + BELT_GAP), y: BELT_Y }; }

  function fridgeSlotW() {
    var n = fridgeSize();
    return Math.min(FRIDGE_SLOT_W, Math.floor((PANEL_W - 200 - BELT_GAP * (n - 1)) / n));
  }
  function fridgeSlotPos(i) { return { x: PANEL_X + 188 + i * (fridgeSlotW() + BELT_GAP), y: FRIDGE_Y }; }

  function queueX(i) { return QUEUE_X0 + i * (QUEUE_W + QUEUE_GAP); }

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
    g.roundRect(3, 5, w, h, 16).fill({ color: 0x0F1A22, alpha: enabled ? 0.18 : 0.06 });
    g.roundRect(0, 0, w, h, 16).fill(enabled ? C.panel : 0xDDE4E9);
    g.roundRect(2, 2, w - 4, h * 0.42, 14).fill({ color: 0xFFFFFF, alpha: enabled ? 0.85 : 0.3 });
    g.roundRect(0, 0, w, h, 16).stroke({ width: 4, color: enabled ? C.steelDark : C.steel });
    c.addChild(g);

    var t = label(text, 22, enabled ? C.ink : 0x94A2AB, '800');
    t.anchor.set(0.5); t.x = w / 2; t.y = h / 2 - (sub ? 13 : 0);
    c.addChild(t);
    if (sub) {
      var s = label(sub, 15, enabled ? C.inkSoft : 0x94A2AB, '600');
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

  // Лицо покупателя рисуется примитивами: настроение = сколько осталось терпения.
  // Покупатели: восемь типажей — дети, молодые, взрослые и пожилые. Рисуются
  // примитивами, как и товар: ноль ассетов, но лицо, а не смайлик.
  var PEOPLE = [
    { id: 'boy',     skin: 0xFFD2A4, hair: 0x6B4A2A, cloth: 0x3E9BD8, style: 'cap',    kid: true },
    { id: 'girl',    skin: 0xFFDBBA, hair: 0xC2632A, cloth: 0xE5679B, style: 'tails',  kid: true },
    { id: 'lady',    skin: 0xFFD6AE, hair: 0xE9C35A, cloth: 0xD8464A, style: 'long',   earring: true },
    { id: 'guy',     skin: 0xE2A97A, hair: 0x2F2A26, cloth: 0x41B08A, style: 'short' },
    { id: 'woman',   skin: 0xC98B5E, hair: 0x3B2A1E, cloth: 0x8C6BD6, style: 'bob' },
    { id: 'man',     skin: 0xF0BB8B, hair: 0x4A3520, cloth: 0x4A6FB8, style: 'part',   beard: 'stubble' },
    { id: 'granny',  skin: 0xF6CFAB, hair: 0xDADCE2, cloth: 0xC96FA0, style: 'bun',    glasses: true },
    { id: 'grandpa', skin: 0xE9BA8E, hair: 0xD2D5DB, cloth: 0x6E8494, style: 'bald',   glasses: true, beard: 'moustache' }
  ];

  function personById(idx) {
    var n = PEOPLE.length;
    return PEOPLE[((idx | 0) % n + n) % n];
  }

  // r — радиус головы; контейнер отцентрован по лицу, как раньше faceGraphic.
  function personGraphic(r, idx, mood) {
    var p = personById(idx);
    var k = p.kid ? r * 0.94 : r;
    var lw = Math.max(2.5, k * 0.13);
    var c = new PIXI.Container();
    var back = new PIXI.Graphics();
    var g = new PIXI.Graphics();
    var top = new PIXI.Graphics();
    c.addChild(back, g, top);

    var hairDark = mix(p.hair, 0x000000, 0.25);

    // затылок и длинные волосы — за головой
    if (p.style === 'long') {
      back.ellipse(0, k * 0.15, k * 1.22, k * 1.35).fill(p.hair);
      back.ellipse(0, k * 0.15, k * 1.22, k * 1.35).stroke({ width: lw, color: C.ink });
    } else if (p.style === 'bob') {
      back.ellipse(0, k * 0.05, k * 1.18, k * 1.2).fill(p.hair);
      back.ellipse(0, k * 0.05, k * 1.18, k * 1.2).stroke({ width: lw, color: C.ink });
    } else if (p.style === 'tails') {
      [-1, 1].forEach(function (s) {
        back.circle(s * k * 1.05, k * 0.25, k * 0.33).fill(p.hair);
        back.circle(s * k * 1.05, k * 0.25, k * 0.33).stroke({ width: lw, color: C.ink });
      });
    } else if (p.style === 'bun') {
      back.circle(0, -k * 1.12, k * 0.34).fill(p.hair);
      back.circle(0, -k * 1.12, k * 0.34).stroke({ width: lw, color: C.ink });
    }

    // плечи и шея
    g.roundRect(-k * 1.18, k * 0.92, k * 2.36, k * 0.9, k * 0.34).fill(p.cloth);
    g.roundRect(-k * 1.18, k * 0.92, k * 2.36, k * 0.9, k * 0.34).stroke({ width: lw, color: C.ink });
    g.rect(-k * 0.26, k * 0.62, k * 0.52, k * 0.42).fill(mix(p.skin, C.ink, 0.12));

    // голова
    g.ellipse(0, 0, k, k * 1.06).fill(p.skin);
    g.ellipse(0, 0, k, k * 1.06).stroke({ width: lw, color: C.ink });
    [-1, 1].forEach(function (s) {
      g.circle(s * k * 0.97, k * 0.08, k * 0.17).fill(p.skin);
      g.circle(s * k * 0.97, k * 0.08, k * 0.17).stroke({ width: lw * 0.8, color: C.ink });
    });

    // причёска поверх головы
    if (p.style === 'cap') {
      top.ellipse(0, -k * 0.92, k * 0.98, k * 0.48).fill(p.cloth);
      top.ellipse(0, -k * 0.92, k * 0.98, k * 0.48).stroke({ width: lw, color: C.ink });
      top.ellipse(-k * 0.5, -k * 0.72, k * 0.9, k * 0.17).fill(mix(p.cloth, 0x000000, 0.25));
      top.ellipse(-k * 0.5, -k * 0.72, k * 0.9, k * 0.17).stroke({ width: lw * 0.8, color: C.ink });
      top.circle(0, -k * 1.3, k * 0.1).fill(mix(p.cloth, 0xFFFFFF, 0.4));
    } else if (p.style === 'bald') {
      [-1, 1].forEach(function (s) {
        top.ellipse(s * k * 0.78, -k * 0.35, k * 0.3, k * 0.42).fill(p.hair);
        top.ellipse(s * k * 0.78, -k * 0.35, k * 0.3, k * 0.42).stroke({ width: lw * 0.8, color: C.ink });
      });
    } else {
      // шапка волос закрывает макушку и виски, но не лоб
      top.ellipse(0, -k * 0.95, k * 1.02, k * 0.52).fill(p.hair);
      top.ellipse(0, -k * 0.95, k * 1.02, k * 0.52).stroke({ width: lw, color: C.ink });
      if (p.style === 'part') {
        top.moveTo(-k * 0.2, -k * 1.2).quadraticCurveTo(k * 0.1, -k * 0.85, k * 0.55, -k * 0.75)
           .stroke({ width: lw * 0.8, color: hairDark, cap: 'round' });
      }
      if (p.style === 'long' || p.style === 'bob') {
        [-1, 1].forEach(function (s) {
          top.ellipse(s * k * 0.92, -k * 0.3, k * 0.26, k * 0.5).fill(p.hair);
          top.ellipse(s * k * 0.92, -k * 0.3, k * 0.26, k * 0.5).stroke({ width: lw * 0.8, color: C.ink });
        });
      }
    }
    if (p.style === 'tails') {
      top.circle(-k * 1.05, -k * 0.1, k * 0.16).fill(0xFFFFFF);
      top.circle(k * 1.05, -k * 0.1, k * 0.16).fill(0xFFFFFF);
    }

    // глаза: белок, радужка, зрачок и блик
    var eyeY = k * 0.02, eyeX = k * 0.36, eyeR = k * (p.kid ? 0.26 : 0.22);
    [-1, 1].forEach(function (s) {
      top.ellipse(s * eyeX, eyeY, eyeR * 0.78, eyeR * 0.92).fill(0xFFFFFF);
      top.circle(s * eyeX, eyeY + eyeR * 0.08, eyeR * 0.5).fill(mix(p.hair, 0x2A4A6A, 0.55));
      top.circle(s * eyeX, eyeY + eyeR * 0.08, eyeR * 0.26).fill(C.ink);
      top.circle(s * eyeX - eyeR * 0.24, eyeY - eyeR * 0.28, eyeR * 0.18).fill(0xFFFFFF);
      // верхнее веко даёт взгляд, а не «пуговицу»
      top.moveTo(s * (eyeX - eyeR * 0.78), eyeY - eyeR * 0.5)
         .quadraticCurveTo(s * eyeX, eyeY - eyeR * 1.15, s * (eyeX + eyeR * 0.78), eyeY - eyeR * 0.5)
         .stroke({ width: lw * 0.7, color: C.ink, cap: 'round' });
    });

    // брови задают настроение вместе со ртом
    var browY = eyeY - eyeR * 1.85;
    var inner = mood === 'sad' ? eyeR * 0.5 : (mood === 'wait' ? 0 : -eyeR * 0.28);
    [-1, 1].forEach(function (s) {
      top.moveTo(s * (eyeX - eyeR * 0.85), browY + (mood === 'sad' ? -eyeR * 0.2 : 0))
         .quadraticCurveTo(s * eyeX, browY - eyeR * 0.35, s * (eyeX + eyeR * 0.85), browY + inner)
         .stroke({ width: lw * 0.85, color: hairDark, cap: 'round' });
    });

    // нос
    top.moveTo(0, eyeY + eyeR * 0.5).quadraticCurveTo(k * 0.12, k * 0.36, -k * 0.04, k * 0.38)
       .stroke({ width: lw * 0.7, color: mix(p.skin, C.ink, 0.45), cap: 'round' });

    // рот
    if (mood === 'sad') {
      top.moveTo(-k * 0.3, k * 0.72).quadraticCurveTo(0, k * 0.5, k * 0.3, k * 0.72)
         .stroke({ width: lw * 0.9, color: 0x9B3A2E, cap: 'round' });
    } else if (mood === 'wait') {
      top.moveTo(-k * 0.26, k * 0.62).lineTo(k * 0.26, k * 0.62)
         .stroke({ width: lw * 0.9, color: 0x9B3A2E, cap: 'round' });
    } else {
      top.moveTo(-k * 0.3, k * 0.56).quadraticCurveTo(0, k * 0.92, k * 0.3, k * 0.56)
         .stroke({ width: lw * 0.95, color: 0x9B3A2E, cap: 'round' });
    }

    if (p.beard === 'moustache') {
      top.ellipse(0, k * 0.4, k * 0.32, k * 0.1).fill(p.hair);
      top.ellipse(0, k * 0.4, k * 0.32, k * 0.1).stroke({ width: lw * 0.5, color: C.ink, alpha: 0.45 });
    } else if (p.beard === 'stubble') {
      top.ellipse(0, k * 0.62, k * 0.66, k * 0.42).fill({ color: hairDark, alpha: 0.22 });
    }

    if (p.glasses) {
      [-1, 1].forEach(function (s) {
        top.circle(s * eyeX, eyeY, eyeR * 1.25).stroke({ width: lw * 0.8, color: 0x394651 });
      });
      top.moveTo(-eyeX + eyeR * 1.25, eyeY).lineTo(eyeX - eyeR * 1.25, eyeY)
         .stroke({ width: lw * 0.7, color: 0x394651 });
    }
    if (p.earring) {
      [-1, 1].forEach(function (s) { top.circle(s * k * 0.99, k * 0.26, k * 0.09).fill(C.gold); });
    }
    if (p.kid) {
      [-1, 1].forEach(function (s) {
        top.ellipse(s * k * 0.66, k * 0.34, k * 0.2, k * 0.14).fill({ color: 0xFF6E5A, alpha: 0.35 });
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
    bg.ellipse(W / 2, 30, W * 0.8, 96).fill({ color: 0xFFFFFF, alpha: 0.55 });
    // дальние стеллажи зала — чуть намеченные вертикали, чтобы был объём помещения
    for (var wx = 16; wx < W; wx += 118) {
      bg.rect(wx, SIGN_Y + 40, 70, 300).fill({ color: C.steel, alpha: 0.09 });
      bg.rect(wx, SIGN_Y + 40, 70, 6).fill({ color: C.steelDark, alpha: 0.10 });
    }
    // пол: светлая плитка с расшивкой по диагонали
    bg.rect(0, 1206, W, H - 1206).fill(C.floor);
    bg.rect(0, 1206, W, 26).fill({ color: 0xFFFFFF, alpha: 0.18 });
    bg.rect(0, 1206, W, 7).fill({ color: 0xFFFFFF, alpha: 0.55 });
    for (var fx2 = -60; fx2 < W + 90; fx2 += 74) {
      bg.moveTo(fx2, H).lineTo(fx2 + 30, 1213).stroke({ width: 3, color: 0xFFFFFF, alpha: 0.5 });
    }
    bg.rect(0, 1206, W, 12).fill({ color: C.steelDark, alpha: 0.12 });
    root.addChild(bg);

    buildHud();
    buildSign();

    layers.trayStatic = new PIXI.Container();
    root.addChild(layers.trayStatic);
    buildTray();

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

  // Прилавок и холодильник меняют размер от апгрейдов — перестраиваем на старте смены.
  function rebuildBoard() {
    if (!layers.trayStatic) return;
    buildTray();
    buildFridge();
  }

  function buildHud() {
    var g = new PIXI.Graphics();
    vGradient(g, 0, 0, W, HUD_H, 0x21303E, C.hudBg, 12);
    g.roundRect(14, 8, W - 28, 44, 12).fill({ color: 0xFFFFFF, alpha: 0.05 });
    g.rect(0, HUD_H - 5, W, 5).fill(C.steelDark);
    g.rect(0, HUD_H - 5, W, 2).fill({ color: 0xFFFFFF, alpha: 0.12 });
    root.addChild(g);

    hud.revenue = label('0 ₽', 44, C.green, '800');
    hud.revenue.x = 26; hud.revenue.y = 14;
    root.addChild(hud.revenue);

    var cap = label('ВЫРУЧКА СМЕНЫ', 13, C.hudInkSoft, '700');
    cap.x = 28; cap.y = 62;
    root.addChild(cap);

    hud.shift = label('', 15, C.hudInk, '700');
    hud.shift.anchor.set(1, 0);
    hud.shift.x = W - 92; hud.shift.y = 22;
    root.addChild(hud.shift);

    hud.streak = label('', 14, C.hudInkSoft, '600');
    hud.streak.anchor.set(1, 0);
    hud.streak.x = W - 92; hud.streak.y = 44;
    root.addChild(hud.streak);

    hud.planBar = new PIXI.Graphics();
    root.addChild(hud.planBar);
    hud.planText = label('', 17, C.hudInk, '700');
    hud.planText.anchor.set(0.5);
    hud.planText.x = 26 + 186; hud.planText.y = 112;
    root.addChild(hud.planText);

    hud.comboBar = new PIXI.Graphics();
    root.addChild(hud.comboBar);
    hud.comboText = label('', 20, C.hudInkSoft, '800');
    hud.comboText.anchor.set(0, 0.5);
    hud.comboText.x = 628; hud.comboText.y = 112;
    root.addChild(hud.comboText);

    hud.lives = new PIXI.Graphics();
    root.addChild(hud.lives);

    hud.sale = label('', 16, C.gold, '800');
    hud.sale.anchor.set(0.5);
    hud.sale.x = W / 2; hud.sale.y = SIGN_Y + SIGN_H + 2;
    hud.sale.visible = false;
    root.addChild(hud.sale);

    var mute = new PIXI.Container();
    mute.x = W - 74; mute.y = 16;
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
    var y = SIGN_Y - 6, h = SIGN_H - 14;
    g.rect(168, y - 22, 5, 22).fill(C.steelDark);
    g.rect(W - 173, y - 22, 5, 22).fill(C.steelDark);
    g.roundRect(26, y + 6, W - 52, h, 8).fill({ color: 0x0B1D30, alpha: 0.22 });
    g.roundRect(22, y, W - 44, h, 14).fill(C.sign);
    g.roundRect(22, y, W - 44, h, 14).stroke({ width: 4, color: 0x0B2540 });
    g.roundRect(30, y + 5, W - 60, 7, 3).fill({ color: 0xFFFFFF, alpha: 0.2 });
    signNode = new PIXI.Container();
    signNode.addChild(g);

    var t = label('ПРОДУКТЫ · ТОРГОВЫЙ ЗАЛ', 21, C.signAlt, '800');
    t.anchor.set(0.5); t.x = W / 2; t.y = y + h / 2;
    signNode.addChild(t);
    root.addChild(signNode);
  }

  function buildTray() {
    layers.trayStatic.removeChildren();
    zoneNodes = {};

    var g = new PIXI.Graphics();
    // корпус торгового стеллажа: боковые стойки, задняя стенка, планка-фриз
    vGradient(g, PANEL_X - 10, TRAY_PANEL_Y, PANEL_W + 20, 208, C.steelLight, C.steel, 10);
    g.roundRect(PANEL_X - 10, TRAY_PANEL_Y, PANEL_W + 20, 208, 14).fill(C.steel);
    g.roundRect(PANEL_X - 10, TRAY_PANEL_Y + 2, PANEL_W + 20, 26, 12).fill({ color: 0xFFFFFF, alpha: 0.22 });
    g.roundRect(PANEL_X - 2, TRAY_PANEL_Y + 40, PANEL_W + 4, 160, 10).fill(C.shelf);
    g.roundRect(PANEL_X - 2, TRAY_PANEL_Y + 6, PANEL_W + 4, 32, 10).fill(C.steelDark);
    g.roundRect(PANEL_X - 10, TRAY_PANEL_Y, PANEL_W + 20, 208, 14).stroke({ width: 5, color: C.steelDark });
    g.rect(PANEL_X - 10, TRAY_PANEL_Y + 4, PANEL_W + 20, 3).fill({ color: 0xFFFFFF, alpha: 0.35 });
    layers.trayStatic.addChild(g);

    var cap = label('КАЖДЫЙ ТОВАР В СВОЙ ОТДЕЛ · ТРИ ОДИНАКОВЫХ = ПРОДАЖА', 15, 0xE7EFF5, '800');
    cap.anchor.set(0.5); cap.x = W / 2; cap.y = TRAY_PANEL_Y + 22;
    layers.trayStatic.addChild(cap);

    var w = traySlotW();
    ZONES.forEach(function (z) {
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
        var sx = slotX(i);
        slot.roundRect(sx, TRAY_Y, w, TRAY_H, 4).fill({ color: 0xFFFFFF, alpha: 0.5 });
        slot.roundRect(sx, TRAY_Y, w, TRAY_H, 4).stroke({ width: 2, color: C.steel, alpha: 0.45 });
        slot.rect(sx, TRAY_Y, w, 5).fill({ color: C.steelDark, alpha: 0.10 });
        // ценникодержатель под ячейкой — фирменная деталь торгового зала
        slot.roundRect(sx + 3, TRAY_Y + TRAY_H - 20, w - 6, 13, 2).fill(0xFFFFFF);
        slot.roundRect(sx + 3, TRAY_Y + TRAY_H - 20, w - 6, 13, 2).stroke({ width: 1.5, color: C.steel, alpha: 0.8 });
        slot.rect(sx + 6, TRAY_Y + TRAY_H - 16, (w - 12) * 0.55, 3).fill({ color: C.ink, alpha: 0.35 });
        slot.rect(sx + 6, TRAY_Y + TRAY_H - 12, (w - 12) * 0.32, 3).fill({ color: C.ink, alpha: 0.2 });
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
    g.roundRect(PANEL_X, BELT_PANEL_Y, PANEL_W, bh, 14).fill(C.cardboard);
    g.roundRect(PANEL_X + 7, BELT_PANEL_Y + 34, PANEL_W - 14, bh - 41, 10).fill(C.cardboardLight);
    g.rect(PANEL_X + 7, BELT_PANEL_Y + 34, PANEL_W - 14, 6).fill({ color: 0x8A5A29, alpha: 0.2 });
    g.roundRect(PANEL_X, BELT_PANEL_Y, PANEL_W, bh, 14).stroke({ width: 5, color: 0x8A5A29 });
    g.rect(PANEL_X + PANEL_W / 2 - 34, BELT_PANEL_Y, 68, 34).fill({ color: 0xF2E2C4, alpha: 0.75 });
    g.rect(PANEL_X + PANEL_W / 2 - 34, BELT_PANEL_Y, 68, 34).stroke({ width: 2, color: 0x8A5A29, alpha: 0.35 });
    g.roundRect(PANEL_X + 14, BELT_Y + BELT_H - 10, PANEL_W - 28, 14, 4).fill({ color: 0x8A5A29, alpha: 0.28 });
    root.addChild(g);

    var t = label('ПОСТАВКА', 18, 0x6B4218, '800');
    t.x = PANEL_X + 22; t.y = BELT_PANEL_Y + 9;
    root.addChild(t);

    hud.beltCount = label('', 18, 0x6B4218, '700');
    hud.beltCount.anchor.set(1, 0);
    hud.beltCount.x = PANEL_X + PANEL_W - 24; hud.beltCount.y = BELT_PANEL_Y + 12;
    root.addChild(hud.beltCount);
  }

  function buildFridge() {
    layers.fridgeStatic.removeChildren();
    var g = new PIXI.Graphics();
    var fh = FRIDGE_SLOT_H + 28;
    g.roundRect(PANEL_X, FRIDGE_Y - 14, PANEL_W, fh, 14).fill(C.chill);
    g.roundRect(PANEL_X, FRIDGE_Y - 14, PANEL_W, fh, 14).stroke({ width: 4, color: C.steelDark, alpha: 0.75 });
    g.roundRect(PANEL_X + 4, FRIDGE_Y - 10, PANEL_W - 8, 8, 3).fill({ color: 0xFFFFFF, alpha: 0.7 });
    // блик стекла витрины
    g.moveTo(PANEL_X + 150, FRIDGE_Y - 14).lineTo(PANEL_X + 196, FRIDGE_Y - 14)
     .lineTo(PANEL_X + 138, FRIDGE_Y - 14 + fh).lineTo(PANEL_X + 92, FRIDGE_Y - 14 + fh)
     .closePath().fill({ color: 0xFFFFFF, alpha: 0.28 });
    layers.fridgeStatic.addChild(g);

    var t = label('ХОЛОДИЛЬНИК', 16, 0x2B5A74, '800');
    t.anchor.set(0, 0.5);
    t.x = PANEL_X + 20; t.y = FRIDGE_Y + FRIDGE_SLOT_H / 2;
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
      var c = productPiece(productById(pid), w, TRAY_H, { tilt: ((i % 2) ? 1 : -1) * 0.03 });
      c.x = slotX(i); c.y = TRAY_Y;
      if (fx && fx.pop === i) squashIn(c, w, TRAY_H);
      layers.trayItems.addChild(c);
      layers.trayItems.addChild(freshBadge(i, productById(pid)));
    });

    var sel = selectedProduct();
    ZONES.forEach(function (z) {
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
      button(BTN_X0, BTN_Y, BTN_W, BTN_H, 'Вернуть', 'ещё ' + b.undo, b.undo > 0 && playing, boosterUndo),
      button(BTN_X0 + BTN_W + BTN_GAP, BTN_Y, BTN_W, BTN_H, 'Отложить', 'ещё ' + b.fridge, b.fridge > 0 && playing, boosterFridge),
      button(BTN_X0 + (BTN_W + BTN_GAP) * 2, BTN_Y, BTN_W, BTN_H, 'Перемешать', 'ещё ' + b.shuffle, b.shuffle > 0 && playing, boosterShuffle)
    );
  }

  /* ------------------------------------------------------- перетаскивание */

  var drag = null;

  // Отсчёт срока годности: число ходов до списания прямо на товаре.
  function freshBadge(i, product) {
    var left = state.fresh[i], full = lifeOf(product);
    var w = traySlotW(), x = slotX(i) + w - 13, y = TRAY_Y + 12;
    var col = left <= 2 ? C.red : (left <= Math.ceil(full * 0.4) ? C.gold : C.green);

    var box = new PIXI.Container();
    var g = new PIXI.Graphics();
    g.circle(x, y, 12).fill(col);
    g.circle(x, y, 12).stroke({ width: 2.5, color: C.ink, alpha: 0.85 });
    box.addChild(g);
    var t = label(String(Math.max(0, left)), 13, 0xFFFFFF, '800');
    t.anchor.set(0.5); t.x = x; t.y = y;
    box.addChild(t);
    if (left <= 2) box.alpha = 0.7 + 0.3 * Math.abs(Math.sin(Date.now() / 220));
    return box;
  }

  // Списание просрочки: минус себестоимость прямо над ячейкой.
  function spoilFx(i, product) {
    var x = slotX(i) + traySlotW() / 2;
    floatText(x, TRAY_Y + 20, '−' + money(costOf(product)), C.red);
    flashArea(x, TRAY_Y + TRAY_H / 2, false);
  }

  function dragging(index) {
    return !!(drag && drag.active && drag.from === 'belt' && drag.index === index);
  }

  function zoneUnder(pt) {
    for (var i = 0; i < ZONES.length; i++) {
      var b = zoneBox(ZONES[i].id);
      if (pt.x >= b.x - 6 && pt.x <= b.x + b.w + 6 && pt.y >= b.y - 40 && pt.y <= b.y + b.h + 10) {
        return ZONES[i].id;
      }
    }
    return null;
  }

  function beginDrag(from, index, product, ev) {
    if (state.status !== 'playing') return;
    var p = root.toLocal(ev.global);
    drag = { from: from, index: index, product: product, startX: p.x, startY: p.y, active: false, ghost: null };
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
      drag.ghost = productPiece(drag.product, w * 1.25, TRAY_H * 1.25, {});
      drag.ghost.pivot.set(w * 0.62, TRAY_H * 0.62);
      layers.fx.addChild(drag.ghost);
    }
    drag.ghost.x = p.x; drag.ghost.y = p.y;
    drag.ghost.rotation = Math.max(-0.2, Math.min(0.2, (p.x - drag.startX) / 900));

    var over = zoneUnder(p);
    ZONES.forEach(function (z) {
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
    if (d.ghost) d.ghost.destroy();

    if (!d.active) {                              // обычный тап — старое поведение
      select(d.from, d.index);
      return;
    }
    var p = root.toLocal(ev.global);
    var zone = zoneUnder(p);
    state.selected = { from: d.from, index: d.index };
    if (zone) place(zone);
    else { state.selected = null; toast('Товар кладут на прилавок'); render(); }
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
    for (var i = 0; i < QUEUE_SIZE; i++) {
      var c = state.customers[i];
      var box = new PIXI.Container();
      box.x = queueX(i); box.y = QUEUE_Y;

      var g = new PIXI.Graphics();
      g.roundRect(3, 6, QUEUE_W, QUEUE_H, 16).fill({ color: 0x0F1A22, alpha: 0.16 });
      g.roundRect(0, 0, QUEUE_W, QUEUE_H, 16).fill(c ? C.panel : 0xE4EAEF);
      g.roundRect(0, 0, QUEUE_W, QUEUE_H, 16).stroke({ width: 4, color: c ? C.steelDark : C.steel });
      g.rect(0, 0, QUEUE_W, 6).fill({ color: c ? C.sign : C.steel, alpha: c ? 0.9 : 0.5 });
      box.addChild(g);

      if (!c) {
        var wait = label('нет покупателя', 16, C.inkSoft, '600');
        wait.anchor.set(0.5); wait.x = QUEUE_W / 2; wait.y = QUEUE_H / 2;
        box.addChild(wait);
        layers.queue.addChild(box);
        continue;
      }

      var ratio = c.patience / c.max;
      var counts = trayCounts();

      var face = personGraphic(26, c.face, ratio > 0.5 ? 'happy' : (ratio > 0.25 ? 'wait' : 'sad'));
      face.x = 44; face.y = 48;
      box.addChild(face);

      // набор покупателя: сколько позиций, столько кружков, собранное гаснет
      var lines = c.order, cw = lines.length > 1 ? 44 : 64;
      var x0 = QUEUE_W - 16 - lines.length * cw + cw / 2;
      lines.forEach(function (l, li) {
        var lp = productById(l.id);
        var r = lines.length > 1 ? 20 : 32;
        var cx = x0 + li * cw, cy = 44;
        var done = (counts[l.id] || 0) >= l.n;

        var disc = new PIXI.Graphics();
        disc.circle(cx, cy, r).fill(done ? mix(C.green, 0xFFFFFF, 0.72) : mix(lp.accent, 0xFFFFFF, 0.45));
        disc.circle(cx, cy, r).stroke({ width: 3, color: done ? C.green : mix(lp.accent, C.ink, 0.45) });
        box.addChild(disc);

        var ic = productIcon(lp, r * 1.5);
        ic.x = cx; ic.y = cy;
        box.addChild(ic);

        if (l.n > 1) {
          var badge = new PIXI.Graphics();
          badge.circle(cx + r * 0.8, cy + r * 0.8, 13).fill(C.ink);
          box.addChild(badge);
          var bt = label('×' + l.n, 14, 0xFFFFFF, '800');
          bt.anchor.set(0.5); bt.x = cx + r * 0.8; bt.y = cy + r * 0.8;
          box.addChild(bt);
        }
      });

      var title = lines.length === 1
        ? productById(lines[0].id).name + ' ×' + lines[0].n
        : 'Набор · ' + orderTotal(c) + ' товара';
      var want = label(title, 17, C.ink, '800');
      want.anchor.set(0.5); want.x = QUEUE_W / 2; want.y = 108;
      box.addChild(want);

      var reward = label('+50% к продаже', 14, C.green, '700');
      reward.anchor.set(0.5); reward.x = QUEUE_W / 2; reward.y = 134;
      box.addChild(reward);

      var bar = new PIXI.Graphics();
      bar.roundRect(20, 158, QUEUE_W - 40, 24, 5).fill(0xE2E9EE);
      bar.roundRect(20, 158, Math.max(14, (QUEUE_W - 40) * ratio), 24, 12)
         .fill(ratio > 0.5 ? 0x5CCA65 : (ratio > 0.25 ? C.gold : C.red));
      bar.roundRect(20, 158, QUEUE_W - 40, 24, 12).stroke({ width: 4, color: C.ink, alpha: 0.8 });
      box.addChild(bar);

      var pt = label('ждёт ещё ' + c.patience, 14, C.ink, '700');
      pt.anchor.set(0.5); pt.x = QUEUE_W / 2; pt.y = 170;
      box.addChild(pt);

      layers.queue.addChild(box);
    }
  }

  function renderHud() {
    hud.revenue.text = money(shownRevenue);
    hud.shift.text = 'Смена ' + (state.shiftIdx + 1);
    hud.streak.text = 'смен подряд: ' + streak;

    var bx = 26, by = 99, bw = 372, bh = 27;
    var p = Math.min(state.served / state.goal, 1);
    hud.planBar.clear();
    hud.planBar.roundRect(bx, by, bw, bh, 5).fill(C.hudTrack);
    if (p > 0) hud.planBar.roundRect(bx, by, Math.max(bh, bw * p), bh, 5).fill(C.green);
    hud.planBar.roundRect(bx, by, bw, bh, 5).stroke({ width: 3, color: C.steel, alpha: 0.8 });
    hud.planText.text = 'Обслужено  ' + state.served + ' / ' + state.goal;

    var cx = 432, segs = 4, sw = 42, gap = 6;
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
      var lx = W - 92 - L * 26, on = L < left;
      hud.lives.circle(lx, 76, 9).fill(on ? C.red : C.hudTrack);
      hud.lives.circle(lx, 76, 9).stroke({ width: 2.5, color: C.steel, alpha: on ? 0.9 : 0.5 });
    }

    if (state.saleProduct) {
      hud.sale.visible = true;
      hud.sale.text = 'Акция дня: ' + productById(state.saleProduct).name + ' ×2';
    } else {
      hud.sale.visible = false;
    }
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
    var sx = tw / w, sy = TRAY_H / BELT_H;
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
      var ghost = productPiece(fx.product, w, TRAY_H, {});
      ghost.x = slotX(slot) + w / 2; ghost.y = TRAY_Y + TRAY_H / 2;
      ghost.pivot.set(w / 2, TRAY_H / 2);
      layers.fx.addChild(ghost);
      anim(300, function (p) {
        ghost.scale.set(1 + 0.3 * p);
        ghost.alpha = 1 - p;
        ghost.y -= 0.7;
      }, function () { ghost.destroy(); });
    });

    var cx = slotX(fx.slots[Math.floor(fx.slots.length / 2)]) + w / 2;
    flashArea(cx, TRAY_Y + TRAY_H / 2, fx.perfect);
    if (fx.perfect) confetti(cx, TRAY_Y + TRAY_H / 2);
    if (fx.order) orderServedFx();
    if (fx.perfect && fx.combo >= 2) comboSticker(fx.mult);
    sfx(fx.perfect ? 'sale' : 'wrong', fx.combo);

    var note = fx.order ? 'заказ!' : (fx.perfect ? '×' + fx.mult.toFixed(1) : 'не своя зона');
    floatText(cx, TRAY_Y + 20, '+' + money(fx.gain) + '  ' + note,
      fx.perfect || fx.order ? C.green : C.red);
    spawnCoins(cx, TRAY_Y + TRAY_H / 2, fx.perfect ? 8 : 4);
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
    box.x = W / 2; box.y = TRAY_PANEL_Y - 28;
    box.rotation = 0.05;
    box.scale.set(0.3);
    layers.fx.addChild(box);
    anim(1100, function (p) {
      box.scale.set(0.3 + 0.7 * easeBack(Math.min(p * 2.4, 1)));
      box.y = TRAY_PANEL_Y - 28 - 22 * easeOut(p);
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
    box.x = W / 2; box.y = TRAY_Y + 40;
    box.rotation = -0.09;
    box.scale.set(0.3);
    layers.fx.addChild(box);
    anim(1000, function (p) {
      box.scale.set(0.3 + 0.7 * easeBack(Math.min(p * 2.5, 1)));
      box.y = TRAY_Y + 40 - 20 * easeOut(p);
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
    g.roundRect(x - 130, y - TRAY_H / 2 - 8, 260, TRAY_H + 16, 16).fill(ok ? 0x6CE163 : 0xEF7A7A);
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
    overlay.removeChildren();
    overlay.visible = true;

    var dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x0E1820, alpha: 0.74 });
    overlay.addChild(dim);

    var px = 32, py = 92, pw = W - 64, ph = 1096;
    var panel = new PIXI.Graphics();
    panel.roundRect(px + 6, py + 10, pw, ph, 30).fill({ color: 0x000000, alpha: 0.3 });
    panel.roundRect(px, py, pw, ph, 30).fill(C.panel);
    panel.roundRect(px, py, pw, 100, 30).fill(C.steel);
    panel.roundRect(px, py + 66, pw, 34).fill(C.steel);
    panel.roundRect(px, py, pw, ph, 30).stroke({ width: 5, color: C.steelDark });
    overlay.addChild(panel);

    var title = label('Ваш магазин', 32, 0xFFFFFF, '800');
    title.anchor.set(0, 0.5); title.x = px + 30; title.y = py + 50;
    overlay.addChild(title);

    var wallet = label(money(meta.wallet), 30, 0xFFEEBE, '800');
    wallet.anchor.set(1, 0.5); wallet.x = px + pw - 30; wallet.y = py + 50;
    overlay.addChild(wallet);

    var rowY = py + 122, rowH = 152;
    UPGRADES.forEach(function (u, i) {
      var y = rowY + i * rowH;
      var lvl = meta.up[u.id], price = upgradePrice(u);

      var row = new PIXI.Graphics();
      row.roundRect(px + 20, y, pw - 40, rowH - 14, 8).fill(i % 2 ? 0xF1F5F8 : 0xFFFFFF);
      row.roundRect(px + 20, y, pw - 40, rowH - 14, 20).stroke({ width: 4, color: C.ink, alpha: 0.55 });
      overlay.addChild(row);

      var disc = new PIXI.Graphics();
      disc.circle(px + 78, y + 58, 40).fill(0xEDF2F5);
      disc.circle(px + 78, y + 58, 40).stroke({ width: 4, color: C.ink, alpha: 0.7 });
      overlay.addChild(disc);
      var icon = upgradeIcon(u.id, 62);
      icon.x = px + 47; icon.y = y + 27;
      overlay.addChild(icon);

      var name = label(u.name, 24, C.ink, '800');
      name.x = px + 134; name.y = y + 12;
      overlay.addChild(name);

      var eff = labelWrap(lvl > 0 ? u.effect(lvl) : u.hint, 16,
        lvl > 0 ? C.green : C.inkSoft, '600', 228);
      eff.x = px + 134; eff.y = y + 44;
      overlay.addChild(eff);

      for (var k = 0; k < u.max; k++) {
        var pip = new PIXI.Graphics();
        pip.circle(px + 142 + k * 22, y + 110, 8).fill(k < lvl ? C.gold : 0xD7DFE5);
        pip.circle(px + 142 + k * 22, y + 110, 8).stroke({ width: 3, color: C.ink, alpha: 0.6 });
        overlay.addChild(pip);
      }

      if (price == null) {
        var maxed = label('Максимум', 19, C.green, '800');
        maxed.anchor.set(1, 0.5); maxed.x = px + pw - 46; maxed.y = y + 62;
        overlay.addChild(maxed);
      } else {
        var can = meta.wallet >= price;
        overlay.addChild(button(px + pw - 208, y + 26, 162, 72, money(price), can ? 'купить' : 'мало денег',
          can, function (id) { return function () { buyUpgrade(id); }; }(u.id)));
      }
    });

    var next = meta.shiftIdx;
    overlay.addChild(button(px + 36, py + ph - 122, pw - 72, 86,
      'Открыть смену ' + (next + 1), null, true, function () {
        hideOverlay();
        startShift(next);
        rebuildBoard();
        render();
      }));

    var journal = label('журнал плейтеста', 16, C.inkSoft, '600');
    journal.anchor.set(0, 0.5); journal.x = px + 30; journal.y = py + ph - 20;
    journal.eventMode = 'static'; journal.cursor = 'pointer';
    journal.on('pointertap', showLogPanel);
    overlay.addChild(journal);

    var reset = label('сбросить прогресс', 16, C.inkSoft, '600');
    reset.anchor.set(1, 0.5); reset.x = px + pw - 30; reset.y = py + ph - 20;
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
    overlay.removeChildren();
    overlay.visible = true;

    var dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x0E1820, alpha: 0.74 });
    overlay.addChild(dim);

    var won = status === 'won';
    var px = 60, py = 340, pw = W - 120, ph = 540;

    var panel = new PIXI.Graphics();
    panel.roundRect(px + 6, py + 10, pw, ph, 30).fill({ color: 0x000000, alpha: 0.3 });
    panel.roundRect(px, py, pw, ph, 30).fill(C.panel);
    panel.roundRect(px, py, pw, 92, 30).fill(won ? C.green : C.red);
    panel.roundRect(px, py + 62, pw, 30).fill(won ? C.green : C.red);
    panel.roundRect(px, py, pw, ph, 30).stroke({ width: 5, color: C.ink, alpha: 0.9 });
    overlay.addChild(panel);

    var title = label(won ? 'Смена закрыта!' : 'Смена сорвана', 36, 0xFFFFFF, '800');
    title.anchor.set(0.5); title.x = W / 2; title.y = py + 46;
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
      var y = py + 126 + i * 50;
      var line = new PIXI.Graphics();
      line.roundRect(px + 30, y - 19, pw - 60, 42, 6).fill(i % 2 ? 0xF1F5F8 : 0xFFFFFF);
      overlay.addChild(line);
      var k = label(r[0], 20, C.inkSoft, '600');
      k.anchor.set(0, 0.5); k.x = px + 46; k.y = y;
      var v = label(r[1], 21, C.ink, '800');
      v.anchor.set(1, 0.5); v.x = px + pw - 46; v.y = y;
      overlay.addChild(k, v);
    });

    if (reason) {
      var why = label(reason, 17, C.inkSoft, '600');
      why.anchor.set(0.5); why.x = W / 2; why.y = py + ph - 136;
      overlay.addChild(why);
    }

    if (won) {
      overlay.addChild(button(px + 36, py + ph - 112, pw - 72, 86,
        'В магазин  ·  ' + money(state.revenue), 'выручка ушла в кассу', true, showShop));
    } else {
      overlay.addChild(button(px + 36, py + ph - 112, (pw - 92) / 2, 86, 'Переиграть', null, true, retryShift));
      overlay.addChild(button(px + 56 + (pw - 92) / 2, py + ph - 112, (pw - 92) / 2, 86, 'В магазин', null, true, showShop));
    }
  }

  function hideOverlay() { overlay.visible = false; overlay.removeChildren(); }

  /* ------------------------------------------------------------------ boot */

  function fit() {
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    app.renderer.resize(Math.ceil(W * s), Math.ceil(H * s));
    root.scale.set(s);
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
        if (stillNeeded(c, id, counts) > 0 && (!found || c.patience < found.patience)) found = c;
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
      window.addEventListener('resize', fit);

      app.stage.eventMode = 'static';
      app.stage.hitArea = { contains: function () { return true; } };
      app.stage.on('pointermove', moveDrag);
      app.stage.on('pointerup', endDrag);
      app.stage.on('pointerupoutside', endDrag);

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
          a.step(p);
          if (p >= 1) { if (a.done) a.done(); anims.splice(i, 1); }
        }
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
        select: select, place: place, autoStep: autoStep,
        booster: { undo: boosterUndo, fridge: boosterFridge, shuffle: boosterShuffle },
        nextShift: nextShift, retryShift: retryShift,
        shop: showShop, buy: buyUpgrade, zoneUnder: zoneUnder,
        fridgeSize: fridgeSize, beltVisible: beltVisible, traySize: traySize,
        zoneRange: zoneRange, zoneOfSlot: zoneOfSlot, pullDemanded: pullDemanded,
        section: function (id) { return productById(id).section; },
        build: BUILD, metaResetFrom: function () { return metaResetFrom; },
        // лист типажей для визуальной проверки набора покупателей
        faceSheet: function () {
          overlay.removeChildren(); overlay.visible = true;
          var dim = new PIXI.Graphics();
          dim.rect(0, 0, W, H).fill(0xF2F6F9);
          overlay.addChild(dim);
          ['happy', 'wait', 'sad'].forEach(function (mood, row) {
            PEOPLE.forEach(function (p, i) {
              var n = personGraphic(52, i, mood);
              n.x = 92 + (i % 4) * 180; n.y = 150 + row * 400 + Math.floor(i / 4) * 190;
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
