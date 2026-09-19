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

  /* ---------------------------------------------------------------- контент */

  // Зоны прилавка. Вместимость зоны меньше, чем хочется, — в этом весь конфликт.
  var ZONES = [
    // ровно три слота: меньше — и тройку в своей зоне не собрать в принципе
    { id: 'dairy',   name: 'Молочка', slots: 3, color: 0x4E82BC, tint: 0xE6EFF8 },
    { id: 'grocery', name: 'Бакалея', slots: 3, color: 0xC08329, tint: 0xF9EEDA },
    { id: 'produce', name: 'Овощи',   slots: 3, color: 0x55954F, tint: 0xE7F3E4 }
  ];

  var PRODUCTS = [
    { id: 'milk',   name: 'Молоко',   glyph: '🥛', section: 'dairy',   price: 40, color: 0xDCEAF7, accent: 0xA8CBEA },
    { id: 'cheese', name: 'Сыр',      glyph: '🧀', section: 'dairy',   price: 55, color: 0xF7E9C8, accent: 0xF3C33F },
    { id: 'yogurt', name: 'Йогурт',   glyph: '🍶', section: 'dairy',   price: 35, color: 0xE8EEF6, accent: 0xE9B7CE },
    { id: 'butter', name: 'Масло',    glyph: '🧈', section: 'dairy',   price: 60, color: 0xF6EDD2, accent: 0xF0D98A },
    { id: 'bread',  name: 'Хлеб',     glyph: '🍞', section: 'grocery', price: 30, color: 0xF3E0C0, accent: 0xE0A868 },
    { id: 'grain',  name: 'Крупа',    glyph: '🍚', section: 'grocery', price: 45, color: 0xF1EADC, accent: 0xD8C79A },
    { id: 'cookie', name: 'Печенье',  glyph: '🍪', section: 'grocery', price: 50, color: 0xEED9BC, accent: 0xC98F5A },
    { id: 'can',    name: 'Консервы', glyph: '🥫', section: 'grocery', price: 65, color: 0xEFD6CE, accent: 0xD98D7B },
    { id: 'apple',  name: 'Яблоко',   glyph: '🍎', section: 'produce', price: 35, color: 0xF6D8D6, accent: 0xEF8A82 },
    { id: 'carrot', name: 'Морковь',  glyph: '🥕', section: 'produce', price: 25, color: 0xF8E0C8, accent: 0xF2A65A },
    { id: 'tomato', name: 'Помидор',  glyph: '🍅', section: 'produce', price: 40, color: 0xF7D6CF, accent: 0xE8756A },
    { id: 'grape',  name: 'Виноград', glyph: '🍇', section: 'produce', price: 70, color: 0xE6DCF2, accent: 0xB79BD6 }
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
  var ORDER_MULT = 1.5;        // бонус за заказ покупателя
  var ZONE_MULT = 1.5;         // бонус за выкладку в свою зону

  /* ------------------------------------------------------------- палитра */

  var C = {
    wallTop: 0xFBF2E2, wallBot: 0xEBD5B4,
    wood: 0xB9803F, woodDark: 0x8A5A29, woodLight: 0xD3A061,
    ink: 0x4A3B2A, inkSoft: 0x8A7A64,
    cream: 0xFFF8EC, gold: 0xE0A21B,
    green: 0x2F7D32, red: 0xC0463C,
    awning: 0xC0463C, awningAlt: 0xFFFFFF
  };

  /* -------------------------------------------------------------- утилиты */

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
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
  var meta = loadMeta();

  function defaultMeta() {
    return { wallet: 0, shiftIdx: 0, streak: 0, total: 0,
             up: { counter: 0, fridge: 0, cart: 0, cash: 0, sign: 0 } };
  }

  function loadMeta() {
    try {
      var raw = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return defaultMeta();
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

  function buildBelt(cfg, rnd) {
    var pool = PRODUCTS.slice(0, cfg.types);
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

    var saleProduct = null;
    if (cfg.sale) saleProduct = PRODUCTS[Math.floor(rnd() * cfg.types)].id;

    state = {
      shiftIdx: shiftIdx,
      cfg: cfg,
      rnd: rnd,
      belt: buildBelt(cfg, rnd),
      tray: new Array(traySize()).fill(null),
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
      saleProduct: saleProduct,
      status: 'playing'
    };
    bestCombo = 0;
    shownRevenue = 0;
    hiddenSlots = {};
    for (var i = 0; i < QUEUE_SIZE; i++) spawnCustomer();
    return state;
  }

  function comboMult() { return Math.min(1 + 0.5 * state.combo, COMBO_MAX_MULT); }

  function priceOf(product) {
    return product.price * (state.saleProduct === product.id ? 2 : 1);
  }

  function trayIsFull() { return state.tray.indexOf(null) === -1; }

  /* --------------------------------------------------------- покупатели */

  // Заказывают только то, что ещё реально собрать, — тупиков по вине очереди нет.
  function spawnCustomer() {
    var counts = {};
    state.belt.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    state.tray.forEach(function (id) { if (id) counts[id] = (counts[id] || 0) + 1; });
    var taken = state.customers.map(function (c) { return c.productId; });
    var pool = Object.keys(counts).filter(function (id) {
      return counts[id] >= 3 && taken.indexOf(id) === -1;
    });
    if (!pool.length) return null;

    var id = pool[Math.floor(state.rnd() * pool.length)];
    var patience = state.cfg.patience + meta.up.sign * 5;
    var c = { productId: id, patience: patience, max: patience };
    state.customers.push(c);
    return c;
  }

  function tickPatience() {
    var left = [];
    state.customers.forEach(function (c) {
      c.patience -= 1;
      if (c.patience <= 0) left.push(c);
    });
    left.forEach(function (c) {
      state.customers.splice(state.customers.indexOf(c), 1);
      state.lost += 1;
      state.combo = 0;                       // ушедший покупатель рвёт серию
      customerLeftFx();
      spawnCustomer();
    });
    if (left.length) { toast('Покупатель ушёл не дождавшись'); sfx('wrong'); }
  }

  function serveCustomer(productId) {
    for (var i = 0; i < state.customers.length; i++) {
      if (state.customers[i].productId === productId) {
        var c = state.customers.splice(i, 1)[0];
        state.served += 1;
        spawnCustomer();
        return c;
      }
    }
    return null;
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

  // Положить выбранный товар в зону прилавка.
  function place(zoneId) {
    if (state.status !== 'playing') return false;
    if (!state.selected) { toast('Сначала возьмите товар с завоза'); sfx('deny'); return false; }

    var range = zoneRange(zoneId);
    var slot = -1;
    for (var i = range.from; i < range.to; i++) if (state.tray[i] === null) { slot = i; break; }
    if (slot === -1) { toast('В этой зоне нет места'); shakeZone(zoneId); sfx('deny'); return false; }

    var sel = state.selected;
    var productId = sel.from === 'belt' ? state.belt[sel.index] : state.fridge[sel.index];
    if (!productId) return false;

    var from = sel.from === 'belt' ? beltSlotPos(sel.index) : fridgeSlotPos(sel.index);

    if (sel.from === 'belt') state.belt.splice(sel.index, 1);
    else state.fridge.splice(sel.index, 1);

    state.tray[slot] = productId;
    state.selected = null;
    state.lastPlacement = { slot: slot, productId: productId, from: sel.from };

    var sale = resolveSale();
    tickPatience();

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
    return true;
  }

  // Любые три одинаковых на прилавке продаются. Бонусы: своя зона и заказ.
  function resolveSale() {
    var counts = {};
    state.tray.forEach(function (id) { if (id) counts[id] = (counts[id] || 0) + 1; });
    var hit = Object.keys(counts).filter(function (k) { return counts[k] >= 3; })[0];
    if (!hit) return false;

    var product = productById(hit);

    // сначала берём те три, что лежат в своей зоне, — игрок не теряет бонус случайно
    var home = [], other = [];
    state.tray.forEach(function (id, i) {
      if (id !== hit) return;
      (zoneOfSlot(i) === product.section ? home : other).push(i);
    });
    var chosen = home.concat(other).slice(0, 3);
    var perfect = chosen.every(function (i) { return zoneOfSlot(i) === product.section; });

    var order = serveCustomer(hit);
    var mult = perfect ? ZONE_MULT * comboMult() : 1;
    var gain = priceOf(product) * 3 * mult * (order ? ORDER_MULT : 1);

    state.revenue += gain;
    state.combo = perfect ? state.combo + 1 : 0;
    if (state.combo > bestCombo) bestCombo = state.combo;

    chosen.forEach(function (i) { state.tray[i] = null; });
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
      var items = [];
      for (var i = r.from; i < r.to; i++) if (state.tray[i]) items.push(state.tray[i]);
      for (var j = r.from; j < r.to; j++) state.tray[j] = items[j - r.from] || null;
    });
  }

  /* -------------------------------------------------------------- бустеры */

  function boosterUndo() {
    if (state.status !== 'playing' || !state.boosters.undo) return false;
    var lp = state.lastPlacement;
    if (!lp) { toast('Нечего возвращать'); sfx('deny'); return false; }
    state.tray[lp.slot] = null;
    compactTray();
    if (lp.from === 'fridge' && state.fridge.length < fridgeSize()) state.fridge.push(lp.productId);
    else state.belt.unshift(lp.productId);
    state.lastPlacement = null;
    state.boosters.undo--;
    toast('Товар возвращён');
    sfx('booster');
    render();
    return true;
  }

  function boosterFridge() {
    if (state.status !== 'playing' || !state.boosters.fridge) return false;
    if (!state.selected || state.selected.from !== 'belt') { toast('Возьмите товар с завоза'); sfx('deny'); return false; }
    if (state.fridge.length >= fridgeSize()) { toast('Холодильник полон'); sfx('deny'); return false; }
    state.fridge.push(state.belt.splice(state.selected.index, 1)[0]);
    state.selected = null;
    state.boosters.fridge--;
    toast('Товар отложен в холодильник');
    sfx('booster');
    render();
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
    toast('Завоз перемешан');
    sfx('booster');
    render();
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
    hideOverlay();
    startShift(state.shiftIdx, Date.now() & 0xffff);
    rebuildBoard();
    render();
  }

  /* -------------------------------------------------------------- геометрия */

  var HUD_H = 150, AWNING_Y = 150, AWNING_H = 58;
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
  var hiddenSlots = {}, pendingSaleFx = null, shownRevenue = 0, selectedNode = null, awningNode = null;

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
      halo.circle(w / 2, h * 0.44, Math.min(w, h) * 0.52).stroke({ width: 4, color: C.gold });
      c.addChild(halo);
    }

    var shadow = new PIXI.Graphics();
    shadow.ellipse(w / 2, h * (opts.price ? 0.68 : 0.88), w * 0.3, h * 0.06)
          .fill({ color: 0x4A3B2A, alpha: 0.22 });
    c.addChild(shadow);

    var icon = productIcon(product, Math.min(w, h * (opts.price ? 0.68 : 0.96)) * 1.02);
    icon.x = w / 2; icon.y = h * (opts.price ? 0.36 : 0.46);
    c.addChild(icon);

    if (opts.price) {
      var tag = new PIXI.Graphics();
      tag.roundRect(w / 2 - 36, h * 0.78, 72, 30, 15).fill(C.cream);
      tag.roundRect(w / 2 - 36, h * 0.78, 72, 30, 15).stroke({ width: 3, color: C.ink, alpha: 0.75 });
      c.addChild(tag);
      var pr = label(money(priceOf(product)), 16, C.ink, '800');
      pr.anchor.set(0.5);
      pr.x = w / 2; pr.y = h * 0.78 + 15;
      c.addChild(pr);
    }

    if (state.saleProduct === product.id) {
      var badge = new PIXI.Graphics();
      badge.roundRect(w - 40, 2, 38, 24, 10).fill(C.red);
      badge.roundRect(w - 40, 2, 38, 24, 10).stroke({ width: 3, color: C.ink, alpha: 0.8 });
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
    g.roundRect(4, 7, w, h, 22).fill({ color: 0x4A3B2A, alpha: enabled ? 0.22 : 0.08 });
    g.roundRect(0, 0, w, h, 22).fill(enabled ? C.cream : 0xEADFCC);
    g.roundRect(3, 3, w - 6, h * 0.45, 19).fill({ color: 0xFFFFFF, alpha: enabled ? 0.7 : 0.25 });
    g.roundRect(0, 0, w, h, 22).stroke({ width: 4, color: enabled ? C.ink : 0xCFC3AE, alpha: enabled ? 0.85 : 1 });
    c.addChild(g);

    var t = label(text, 23, enabled ? C.ink : 0x9E9080, '800');
    t.anchor.set(0.5); t.x = w / 2; t.y = h / 2 - (sub ? 13 : 0);
    c.addChild(t);
    if (sub) {
      var s = label(sub, 16, enabled ? C.inkSoft : 0x9E9080, '500');
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
  function faceGraphic(r, mood) {
    var g = new PIXI.Graphics();
    g.circle(0, 0, r).fill(0xFFE0BD);
    g.circle(0, 0, r).stroke({ width: 4, color: C.ink, alpha: 0.85 });
    g.circle(-r * 0.33, -r * 0.2, r * 0.13).fill(C.ink);
    g.circle(r * 0.33, -r * 0.2, r * 0.13).fill(C.ink);
    g.circle(-r * 0.62, r * 0.2, r * 0.2).fill({ color: 0xE8756A, alpha: 0.3 });
    g.circle(r * 0.62, r * 0.2, r * 0.2).fill({ color: 0xE8756A, alpha: 0.3 });
    if (mood === 'sad') {
      g.moveTo(-r * 0.4, r * 0.5).quadraticCurveTo(0, r * 0.18, r * 0.4, r * 0.5)
       .stroke({ width: 4, color: C.ink, cap: 'round' });
    } else if (mood === 'wait') {
      g.moveTo(-r * 0.32, r * 0.35).lineTo(r * 0.32, r * 0.35)
       .stroke({ width: 4, color: C.ink, cap: 'round' });
    } else {
      g.moveTo(-r * 0.4, r * 0.25).quadraticCurveTo(0, r * 0.64, r * 0.4, r * 0.25)
       .stroke({ width: 4, color: C.ink, cap: 'round' });
    }
    return g;
  }

  /* ------------------------------------------------------------- статика */

  function buildStatic() {
    var bg = new PIXI.Graphics();
    vGradient(bg, 0, 0, W, H, C.wallTop, C.wallBot, 28);
    for (var wx = 0; wx < W; wx += 48) bg.rect(wx, 0, 22, H).fill({ color: 0xFFFFFF, alpha: 0.38 });
    for (var dy = 250; dy < H; dy += 96) {
      for (var dx = 24; dx < W; dx += 96) bg.circle(dx, dy, 4).fill({ color: 0xC9A876, alpha: 0.18 });
    }
    bg.rect(0, 1226, W, H - 1226).fill(C.wood);
    bg.rect(0, 1226, W, 8).fill({ color: 0xFFFFFF, alpha: 0.25 });
    for (var fx2 = 0; fx2 < W; fx2 += 90) bg.rect(fx2, 1234, 3, H - 1234).fill({ color: C.woodDark, alpha: 0.35 });
    root.addChild(bg);

    buildHud();
    buildAwning();

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
    g.rect(0, 0, W, HUD_H).fill(C.cream);
    g.rect(0, HUD_H - 4, W, 4).fill({ color: C.woodDark, alpha: 0.25 });
    root.addChild(g);

    hud.revenue = label('0 ₽', 44, C.green, '800');
    hud.revenue.x = 26; hud.revenue.y = 14;
    root.addChild(hud.revenue);

    var cap = label('выручка смены', 15, C.inkSoft, '500');
    cap.x = 28; cap.y = 62;
    root.addChild(cap);

    hud.shift = label('', 15, C.inkSoft, '600');
    hud.shift.anchor.set(1, 0);
    hud.shift.x = W - 92; hud.shift.y = 22;
    root.addChild(hud.shift);

    hud.streak = label('', 15, C.inkSoft, '600');
    hud.streak.anchor.set(1, 0);
    hud.streak.x = W - 92; hud.streak.y = 44;
    root.addChild(hud.streak);

    hud.planBar = new PIXI.Graphics();
    root.addChild(hud.planBar);
    hud.planText = label('', 17, C.ink, '700');
    hud.planText.anchor.set(0.5);
    hud.planText.x = 26 + 186; hud.planText.y = 112;
    root.addChild(hud.planText);

    hud.comboBar = new PIXI.Graphics();
    root.addChild(hud.comboBar);
    hud.comboText = label('', 20, C.inkSoft, '800');
    hud.comboText.anchor.set(0, 0.5);
    hud.comboText.x = 628; hud.comboText.y = 112;
    root.addChild(hud.comboText);

    hud.lives = new PIXI.Graphics();
    root.addChild(hud.lives);

    hud.sale = label('', 16, C.red, '700');
    hud.sale.anchor.set(0.5);
    hud.sale.x = W / 2; hud.sale.y = AWNING_Y + AWNING_H + 2;
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
    g.roundRect(0, 0, 50, 50, 16).fill(muted ? 0xEADFCC : C.gold);
    g.roundRect(0, 0, 50, 50, 16).stroke({ width: 3, color: C.ink, alpha: 0.7 });
    g.moveTo(13, 19).lineTo(21, 19).lineTo(30, 11).lineTo(30, 39).lineTo(21, 31).lineTo(13, 31).closePath()
     .fill(muted ? 0x9E9080 : 0xFFFFFF);
    if (muted) {
      g.moveTo(35, 17).lineTo(44, 33).stroke({ width: 4, color: 0x9E9080, cap: 'round' });
      g.moveTo(44, 17).lineTo(35, 33).stroke({ width: 4, color: 0x9E9080, cap: 'round' });
    } else {
      g.moveTo(36, 16).quadraticCurveTo(42, 25, 36, 34).stroke({ width: 4, color: 0xFFFFFF, cap: 'round' });
    }
  }

  function buildAwning() {
    var g = new PIXI.Graphics();
    var stripes = 9, sw = W / stripes, bandH = 32, scallopR = 19;
    g.roundRect(0, AWNING_Y - 10, W, 14, 4).fill(C.woodDark);
    g.rect(0, AWNING_Y - 10, W, 4).fill({ color: 0xFFFFFF, alpha: 0.18 });
    for (var i = 0; i < stripes; i++) {
      var col = i % 2 ? C.awningAlt : C.awning;
      g.rect(i * sw, AWNING_Y, sw, bandH).fill(col);
      g.ellipse(i * sw + sw / 2, AWNING_Y + bandH, sw / 2, scallopR).fill(col);
      g.rect(i * sw, AWNING_Y, 2, bandH).fill({ color: 0x000000, alpha: 0.08 });
    }
    g.rect(0, AWNING_Y, W, 8).fill({ color: 0x000000, alpha: 0.16 });
    awningNode = new PIXI.Container();
    awningNode.addChild(g);
    root.addChild(awningNode);
  }

  function buildTray() {
    layers.trayStatic.removeChildren();
    zoneNodes = {};

    var g = new PIXI.Graphics();
    g.roundRect(PANEL_X - 6, TRAY_PANEL_Y, PANEL_W + 12, 206, 26).fill(C.wood);
    g.roundRect(PANEL_X, TRAY_PANEL_Y + 6, PANEL_W, 194, 22).fill(mix(C.wood, C.woodDark, 0.3));
    g.roundRect(PANEL_X - 6, TRAY_PANEL_Y, PANEL_W + 12, 206, 26).stroke({ width: 4, color: C.woodDark });
    layers.trayStatic.addChild(g);

    var cap = label('ПРИЛАВОК · три одинаковых = продажа', 17, 0xFFF0D6, '800');
    cap.anchor.set(0.5); cap.x = W / 2; cap.y = TRAY_PANEL_Y + 24;
    layers.trayStatic.addChild(cap);

    var w = traySlotW();
    ZONES.forEach(function (z) {
      var node = new PIXI.Container();
      var box = zoneBox(z.id);

      var back = new PIXI.Graphics();
      back.roundRect(box.x, box.y, box.w, box.h, 16).fill(z.tint);
      back.roundRect(box.x, box.y, box.w, box.h, 16).stroke({ width: 3, color: z.color });
      node.addChild(back);

      var tag = new PIXI.Graphics();
      tag.roundRect(box.x + 4, box.y - 34, box.w - 8, 32, 12).fill(z.color);
      tag.roundRect(box.x + 4, box.y - 34, box.w - 8, 32, 12).stroke({ width: 3, color: C.ink, alpha: 0.7 });
      node.addChild(tag);
      var tl = label(z.name, 18, 0xFFFFFF, '800');
      tl.anchor.set(0.5); tl.x = box.x + box.w / 2; tl.y = box.y - 18;
      node.addChild(tl);

      var r = zoneRange(z.id);
      for (var i = r.from; i < r.to; i++) {
        var slot = new PIXI.Graphics();
        slot.roundRect(slotX(i), TRAY_Y, w, TRAY_H, 14).fill({ color: 0x8A5A29, alpha: 0.1 });
        slot.roundRect(slotX(i), TRAY_Y, w, 8, 6).fill({ color: 0x8A5A29, alpha: 0.12 });
        node.addChild(slot);
      }

      var hint = new PIXI.Graphics();
      hint.roundRect(box.x, box.y, box.w, box.h, 16).stroke({ width: 5, color: C.gold });
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
    g.roundRect(PANEL_X, BELT_PANEL_Y, PANEL_W, BELT_H + 70, 22).fill(C.cream);
    g.roundRect(PANEL_X, BELT_PANEL_Y, PANEL_W, BELT_H + 70, 22).stroke({ width: 4, color: C.ink, alpha: 0.45 });
    g.roundRect(PANEL_X + 14, BELT_Y + BELT_H - 10, PANEL_W - 28, 16, 8).fill(0xC9B48A);
    root.addChild(g);

    var t = label('Завоз', 20, C.inkSoft, '800');
    t.x = PANEL_X + 24; t.y = BELT_PANEL_Y + 12;
    root.addChild(t);

    hud.beltCount = label('', 19, C.inkSoft, '600');
    hud.beltCount.anchor.set(1, 0);
    hud.beltCount.x = PANEL_X + PANEL_W - 24; hud.beltCount.y = BELT_PANEL_Y + 12;
    root.addChild(hud.beltCount);
  }

  function buildFridge() {
    layers.fridgeStatic.removeChildren();
    var g = new PIXI.Graphics();
    g.roundRect(PANEL_X, FRIDGE_Y - 14, PANEL_W, FRIDGE_SLOT_H + 28, 20).fill(0xD6E6EF);
    g.roundRect(PANEL_X, FRIDGE_Y - 14, PANEL_W, FRIDGE_SLOT_H + 28, 20).stroke({ width: 3, color: 0x8FB0C4 });
    layers.fridgeStatic.addChild(g);

    var t = label('Холодильник', 18, 0x46697C, '800');
    t.anchor.set(0, 0.5);
    t.x = PANEL_X + 20; t.y = FRIDGE_Y + FRIDGE_SLOT_H / 2;
    layers.fridgeStatic.addChild(t);

    var w = fridgeSlotW();
    for (var f = 0; f < fridgeSize(); f++) {
      var fs = new PIXI.Graphics();
      var p = fridgeSlotPos(f);
      fs.roundRect(p.x, p.y, w, FRIDGE_SLOT_H, 13).fill({ color: 0xFFFFFF, alpha: 0.45 });
      fs.roundRect(p.x, p.y, w, FRIDGE_SLOT_H, 13).stroke({ width: 2, color: 0x8FB0C4 });
      layers.fridgeStatic.addChild(fs);
    }
  }

  function buildToast() {
    toastBox = new PIXI.Container();
    toastBox.alpha = 0;
    var bg = new PIXI.Graphics();
    bg.roundRect(-215, -28, 430, 56, 28).fill({ color: 0x4A3B2A, alpha: 0.92 });
    bg.roundRect(-215, -28, 430, 56, 28).stroke({ width: 3, color: 0xFFF3D0, alpha: 0.5 });
    toastBox.addChild(bg);
    toastBox.text = label('', 21, 0xFFF8EC, '700');
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
      zoneNodes[z.id].hint.alpha = (over === z.id && free) ? 1 : (own && free ? 0.55 : 0);
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
      g.roundRect(4, 8, QUEUE_W, QUEUE_H, 22).fill({ color: 0x4A3B2A, alpha: 0.18 });
      g.roundRect(0, 0, QUEUE_W, QUEUE_H, 22).fill(c ? C.cream : 0xEFE4D0);
      g.roundRect(0, 0, QUEUE_W, QUEUE_H, 22).stroke({ width: 4, color: C.ink, alpha: c ? 0.85 : 0.3 });
      box.addChild(g);

      if (!c) {
        var wait = label('нет покупателя', 16, C.inkSoft, '600');
        wait.anchor.set(0.5); wait.x = QUEUE_W / 2; wait.y = QUEUE_H / 2;
        box.addChild(wait);
        layers.queue.addChild(box);
        continue;
      }

      var p = productById(c.productId);
      var ratio = c.patience / c.max;

      var face = faceGraphic(32, ratio > 0.5 ? 'happy' : (ratio > 0.25 ? 'wait' : 'sad'));
      face.x = 46; face.y = 50;
      box.addChild(face);

      var disc = new PIXI.Graphics();
      disc.circle(142, 50, 36).fill(mix(p.accent, 0xFFFFFF, 0.45));
      disc.circle(142, 50, 36).stroke({ width: 3, color: mix(p.accent, C.ink, 0.45) });
      box.addChild(disc);
      var icon = productIcon(p, 50);
      icon.x = 142; icon.y = 50;
      box.addChild(icon);

      var want = label(p.name + ' ×3', 18, C.ink, '800');
      want.anchor.set(0.5); want.x = QUEUE_W / 2; want.y = 108;
      box.addChild(want);

      var reward = label('+50% к продаже', 14, C.green, '700');
      reward.anchor.set(0.5); reward.x = QUEUE_W / 2; reward.y = 134;
      box.addChild(reward);

      var bar = new PIXI.Graphics();
      bar.roundRect(20, 158, QUEUE_W - 40, 24, 12).fill(0xEADFCC);
      bar.roundRect(20, 158, Math.max(14, (QUEUE_W - 40) * ratio), 24, 12)
         .fill(ratio > 0.5 ? 0x7FBE84 : (ratio > 0.25 ? C.gold : C.red));
      bar.roundRect(20, 158, QUEUE_W - 40, 24, 12).stroke({ width: 3, color: C.ink, alpha: 0.6 });
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
    hud.planBar.roundRect(bx, by, bw, bh, 14).fill(0xEADFCC);
    if (p > 0) hud.planBar.roundRect(bx, by, Math.max(bh, bw * p), bh, 14).fill(0x7FBE84);
    hud.planBar.roundRect(bx, by, bw, bh, 14).stroke({ width: 3, color: C.ink, alpha: 0.5 });
    hud.planText.text = 'Обслужено  ' + state.served + ' / ' + state.goal;

    var cx = 432, segs = 4, sw = 42, gap = 6;
    hud.comboBar.clear();
    for (var i = 0; i < segs; i++) {
      var on = state.combo > i;
      hud.comboBar.roundRect(cx + i * (sw + gap), by, sw, bh, 9)
        .fill(on ? mix(C.gold, C.red, i / (segs - 1)) : 0xEADFCC);
      hud.comboBar.roundRect(cx + i * (sw + gap), by, sw, bh, 9)
        .stroke({ width: 2, color: C.ink, alpha: on ? 0.6 : 0.25 });
    }
    hud.comboText.text = state.combo > 0 ? '×' + comboMult().toFixed(1) : 'комбо';
    hud.comboText.style.fill = state.combo > 0 ? C.gold : C.inkSoft;

    // «жизни»: сколько покупателей ещё можно упустить
    hud.lives.clear();
    var lives = state.cfg.lives, left = Math.max(0, lives - state.lost);
    for (var L = 0; L < lives; L++) {
      var lx = W - 92 - L * 26, on = L < left;
      hud.lives.circle(lx, 76, 9).fill(on ? 0xE8756A : 0xE2D5BC);
      hud.lives.circle(lx, 76, 9).stroke({ width: 2, color: C.ink, alpha: on ? 0.7 : 0.3 });
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
    g.roundRect(-140, -34, 280, 68, 20).stroke({ width: 4, color: C.ink, alpha: 0.85 });
    box.addChild(g);
    var t = label('ЗАКАЗ ГОТОВ!', 24, 0xFFFFFF, '800');
    t.anchor.set(0.5); t.x = 24;
    box.addChild(t);
    var face = faceGraphic(24, 'happy');
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
    var face = faceGraphic(34, 'sad');
    face.x = W / 2; face.y = QUEUE_Y + 60;
    layers.fx.addChild(face);
    anim(800, function (p) {
      face.y = QUEUE_Y + 60 - 50 * easeOut(p);
      face.rotation = Math.sin(p * Math.PI * 2) * 0.2;
      face.alpha = 1 - p;
    }, function () { face.destroy(); });
  }

  function confetti(x, y) {
    var colors = [C.gold, C.red, 0x5FA05A, 0x4E82BC, 0xE9B7CE];
    for (var i = 0; i < 16; i++) {
      (function () {
        var g = new PIXI.Graphics();
        var col = colors[Math.floor(Math.random() * colors.length)];
        g.roundRect(-7, -4, 14, 8, 3).fill(col);
        g.roundRect(-7, -4, 14, 8, 3).stroke({ width: 1.5, color: C.ink, alpha: 0.5 });
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
    g.roundRect(-96, -30, 192, 60, 18).stroke({ width: 4, color: C.ink, alpha: 0.85 });
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
        coin.circle(0, 0, 9).fill({ color: 0xF6D064, alpha: 0.9 });
        coin.circle(-4, -5, 4).fill({ color: 0xFFFFFF, alpha: 0.7 });
        coin.circle(0, 0, 15).stroke({ width: 3, color: C.ink, alpha: 0.75 });
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
    g.roundRect(x - 130, y - TRAY_H / 2 - 8, 260, TRAY_H + 16, 16).fill(ok ? 0x8FD18A : 0xE0A0A0);
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
      g.roundRect(s * 0.22, s * 0.1, s * 0.56, s * 0.8, s * 0.1).fill(0xDCEAF3);
      g.roundRect(s * 0.22, s * 0.1, s * 0.56, s * 0.8, s * 0.1).stroke({ width: 3, color: 0x7FA3B8 });
      g.rect(s * 0.22, s * 0.44, s * 0.56, 4).fill(0x7FA3B8);
    } else if (id === 'cart') {
      g.moveTo(s * 0.18, s * 0.28).lineTo(s * 0.84, s * 0.28).lineTo(s * 0.72, s * 0.62)
       .lineTo(s * 0.3, s * 0.62).closePath().fill(0xE0A868);
      g.moveTo(s * 0.18, s * 0.28).lineTo(s * 0.84, s * 0.28).lineTo(s * 0.72, s * 0.62)
       .lineTo(s * 0.3, s * 0.62).closePath().stroke({ width: 3, color: C.ink });
      g.circle(s * 0.36, s * 0.76, s * 0.09).fill(C.ink);
      g.circle(s * 0.66, s * 0.76, s * 0.09).fill(C.ink);
    } else if (id === 'cash') {
      g.roundRect(s * 0.16, s * 0.3, s * 0.68, s * 0.5, s * 0.08).fill(0xCFC0A8);
      g.roundRect(s * 0.16, s * 0.3, s * 0.68, s * 0.5, s * 0.08).stroke({ width: 3, color: C.ink });
      g.roundRect(s * 0.26, s * 0.52, s * 0.48, s * 0.12, 4).fill(0xFFF8EC);
      g.circle(s * 0.5, s * 0.22, s * 0.12).fill(C.gold);
      g.circle(s * 0.5, s * 0.22, s * 0.12).stroke({ width: 3, color: C.ink });
    } else if (id === 'counter') {
      g.roundRect(s * 0.1, s * 0.34, s * 0.8, s * 0.2, 6).fill(C.woodLight);
      g.roundRect(s * 0.1, s * 0.34, s * 0.8, s * 0.2, 6).stroke({ width: 3, color: C.ink });
      g.roundRect(s * 0.18, s * 0.54, s * 0.64, s * 0.28, 6).fill(0xEFE0C4);
      g.roundRect(s * 0.18, s * 0.54, s * 0.64, s * 0.28, 6).stroke({ width: 3, color: C.ink });
      g.circle(s * 0.34, s * 0.24, s * 0.09).fill(C.gold);
      g.circle(s * 0.62, s * 0.24, s * 0.09).fill(0xEF8A82);
    } else {
      g.roundRect(s * 0.12, s * 0.24, s * 0.76, s * 0.4, 8).fill(C.red);
      g.roundRect(s * 0.12, s * 0.24, s * 0.76, s * 0.4, 8).stroke({ width: 3, color: C.ink });
      g.rect(s * 0.3, s * 0.64, 5, s * 0.18).fill(C.ink);
      g.rect(s * 0.66, s * 0.64, 5, s * 0.18).fill(C.ink);
      g.circle(s * 0.5, s * 0.44, s * 0.1).fill(0xFFF8EC);
    }
    return g;
  }

  function showShop() {
    overlay.removeChildren();
    overlay.visible = true;

    var dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x2B2118, alpha: 0.72 });
    overlay.addChild(dim);

    var px = 32, py = 92, pw = W - 64, ph = 1096;
    var panel = new PIXI.Graphics();
    panel.roundRect(px + 6, py + 10, pw, ph, 30).fill({ color: 0x000000, alpha: 0.3 });
    panel.roundRect(px, py, pw, ph, 30).fill(C.cream);
    panel.roundRect(px, py, pw, 100, 30).fill(C.wood);
    panel.roundRect(px, py + 66, pw, 34).fill(C.wood);
    panel.roundRect(px, py, pw, ph, 30).stroke({ width: 4, color: C.woodDark });
    overlay.addChild(panel);

    var title = label('Ваш магазин', 32, 0xFFFFFF, '800');
    title.anchor.set(0, 0.5); title.x = px + 30; title.y = py + 50;
    overlay.addChild(title);

    var wallet = label(money(meta.wallet), 30, 0xFFF3D0, '800');
    wallet.anchor.set(1, 0.5); wallet.x = px + pw - 30; wallet.y = py + 50;
    overlay.addChild(wallet);

    var rowY = py + 122, rowH = 152;
    UPGRADES.forEach(function (u, i) {
      var y = rowY + i * rowH;
      var lvl = meta.up[u.id], price = upgradePrice(u);

      var row = new PIXI.Graphics();
      row.roundRect(px + 20, y, pw - 40, rowH - 14, 20).fill(i % 2 ? 0xF7EEDF : 0xFFFFFF);
      row.roundRect(px + 20, y, pw - 40, rowH - 14, 20).stroke({ width: 3, color: C.ink, alpha: 0.35 });
      overlay.addChild(row);

      var disc = new PIXI.Graphics();
      disc.circle(px + 78, y + 58, 40).fill(0xF3E7D3);
      disc.circle(px + 78, y + 58, 40).stroke({ width: 3, color: C.ink, alpha: 0.5 });
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
        pip.circle(px + 142 + k * 22, y + 110, 8).fill(k < lvl ? C.gold : 0xE2D5BC);
        pip.circle(px + 142 + k * 22, y + 110, 8).stroke({ width: 2, color: C.ink, alpha: 0.45 });
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

    var reset = label('сбросить прогресс', 16, C.inkSoft, '600');
    reset.anchor.set(0.5); reset.x = W / 2; reset.y = py + ph - 20;
    reset.eventMode = 'static'; reset.cursor = 'pointer';
    reset.on('pointertap', function () {
      meta = defaultMeta(); streak = 0; totalRevenue = 0;
      saveMeta();
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
    dim.rect(0, 0, W, H).fill({ color: 0x2B2118, alpha: 0.72 });
    overlay.addChild(dim);

    var won = status === 'won';
    var px = 60, py = 340, pw = W - 120, ph = 540;

    var panel = new PIXI.Graphics();
    panel.roundRect(px + 6, py + 10, pw, ph, 30).fill({ color: 0x000000, alpha: 0.3 });
    panel.roundRect(px, py, pw, ph, 30).fill(C.cream);
    panel.roundRect(px, py, pw, 92, 30).fill(won ? C.green : C.red);
    panel.roundRect(px, py + 62, pw, 30).fill(won ? C.green : C.red);
    panel.roundRect(px, py, pw, ph, 30).stroke({ width: 4, color: C.ink, alpha: 0.7 });
    overlay.addChild(panel);

    var title = label(won ? 'Смена закрыта!' : 'Смена сорвана', 36, 0xFFFFFF, '800');
    title.anchor.set(0.5); title.x = W / 2; title.y = py + 46;
    overlay.addChild(title);

    var rows = [
      ['Выручка', money(state.revenue)],
      ['Обслужено', state.served + ' / ' + state.goal],
      ['Ушли не дождавшись', String(state.lost)],
      ['Лучшее комбо', '×' + Math.min(1 + 0.5 * bestCombo, COMBO_MAX_MULT).toFixed(1)],
      ['Смен подряд', String(streak)]
    ];
    rows.forEach(function (r, i) {
      var y = py + 126 + i * 50;
      var line = new PIXI.Graphics();
      line.roundRect(px + 30, y - 19, pw - 60, 42, 12).fill(i % 2 ? 0xF6ECDC : 0xFFFFFF);
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
    var orderFor = function (id) {
      var found = null;
      state.customers.forEach(function (c) {
        if (c.productId === id && (!found || c.patience < found.patience)) found = c;
      });
      return found;
    };
    var best = null;

    for (var i = 0; i < visible.length; i++) {
      var p = productById(visible[i]);
      var onTray = state.tray.filter(function (c) { return c === p.id; }).length;
      for (var z = 0; z < ZONES.length; z++) {
        var zone = ZONES[z], r = zoneRange(zone.id);
        var free = 0;
        for (var k = r.from; k < r.to; k++) if (state.tray[k] === null) free++;
        if (!free) continue;

        var score = onTray * 18 + free * 3;
        if (onTray === 2) score += 40;                        // добиваем тройку
        if (p.section === zone.id) score += 12;               // своя зона
        var ord = orderFor(p.id);
        if (ord) score += 30 + Math.round(60 / Math.max(1, ord.patience));  // срочный заказ важнее
        if (free === 1 && onTray < 2) score -= 22;            // не забивать зону зря
        if (!best || score > best.score) best = { i: i, zone: zone.id, score: score };
      }
    }
    if (!best) return false;
    state.selected = null;
    select('belt', best.i);
    return place(best.zone);
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
        if (awningNode) awningNode.y = Math.sin(clock * 1.1) * 2.5;
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
        zoneRange: zoneRange, zoneOfSlot: zoneOfSlot,
        startShift: function (i, seed) { hideOverlay(); startShift(i, seed); rebuildBoard(); render(); }
      };
    });
  }

  boot();
})();
