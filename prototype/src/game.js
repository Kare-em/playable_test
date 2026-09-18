/*
 * «Магазин у дома» — прототип кор-лупа (PixiJS 8).
 * Проверяемая гипотеза: тап «что взять» + тап «куда положить» даёт решение,
 * ради которого игрок добровольно играет 3+ смены подряд.
 * Метрика плейтеста — счётчик смен подряд, см. HUD и экран результата.
 */
(function () {
  'use strict';

  var W = 720, H = 1280;

  /* ---------------------------------------------------------------- контент */

  var SECTIONS = [
    { id: 'dairy',   name: 'Молочка', color: 0x4E82BC, tint: 0xE6EFF8 },
    { id: 'grocery', name: 'Бакалея', color: 0xC08329, tint: 0xF9EEDA },
    { id: 'produce', name: 'Овощи',   color: 0x55954F, tint: 0xE7F3E4 }
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

  // Смены усложняются числом типов товара и целью. Завоз всегда кратен 3 — смена решаема.
  var SHIFTS = [
    { types: 6,  crates: 24, goal: 6,  sale: false, visible: 5 },
    { types: 9,  crates: 39, goal: 8,  sale: false, visible: 6 },
    { types: 12, crates: 48, goal: 10, sale: true,  visible: 6 }
  ];

  var SLOTS_PER_SECTION = 4;
  var BELT_VISIBLE_MAX = 6;   // окно завоза расширяется к сложным сменам
  var FRIDGE_SIZE = 3;
  var COMBO_MAX_MULT = 3;

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

  /* ------------------------------------------------------------- состояние */

  var state = null;
  var streak = 0;          // смен подряд за сессию — главная метрика плейтеста
  var totalRevenue = 0;
  var bestCombo = 0;

  try {
    streak = parseInt(localStorage.getItem('shopsort.streak') || '0', 10) || 0;
  } catch (e) { streak = 0; }

  function buildBelt(cfg, rnd) {
    var pool = PRODUCTS.slice(0, cfg.types);
    var triples = cfg.crates / 3;
    var belt = [];
    for (var i = 0; i < triples; i++) {
      var p = pool[Math.floor(rnd() * pool.length)];
      belt.push(p.id, p.id, p.id);
    }
    for (var j = belt.length - 1; j > 0; j--) { // тасовка Фишера — Йетса
      var k = Math.floor(rnd() * (j + 1));
      var t = belt[j]; belt[j] = belt[k]; belt[k] = t;
    }
    return belt;
  }

  function startShift(shiftIdx, seed) {
    var cfg = SHIFTS[Math.min(shiftIdx, SHIFTS.length - 1)];
    var rnd = mulberry32(seed == null ? (shiftIdx + 1) * 7919 : seed);
    var shelf = {};
    SECTIONS.forEach(function (s) { shelf[s.id] = new Array(SLOTS_PER_SECTION).fill(null); });

    var saleProduct = null;
    if (cfg.sale) saleProduct = PRODUCTS[Math.floor(rnd() * cfg.types)].id;

    state = {
      shiftIdx: shiftIdx,
      cfg: cfg,
      belt: buildBelt(cfg, rnd),
      shelf: shelf,
      fridge: [],
      selected: null,           // {from:'belt'|'fridge', index:int}
      revenue: 0,
      sold: 0,
      goal: cfg.goal,
      combo: 0,
      boosters: { undo: 1, fridge: 1, shuffle: 1 },
      lastPlacement: null,
      saleProduct: saleProduct,
      status: 'playing'
    };
    bestCombo = 0;
    shownRevenue = 0;
    hiddenSlots = {};
    return state;
  }

  function comboMult() { return Math.min(1 + 0.5 * state.combo, COMBO_MAX_MULT); }

  function priceOf(product) {
    return product.price * (state.saleProduct === product.id ? 2 : 1);
  }

  function shelfIsFull() {
    return SECTIONS.every(function (s) {
      return state.shelf[s.id].every(function (c) { return c !== null; });
    });
  }

  /* ------------------------------------------------------------- механика */

  // Взять товар с ленты завоза или из холодильника.
  function select(from, index) {
    if (state.status !== 'playing') return false;
    var src = from === 'belt' ? state.belt.slice(0, beltVisible()) : state.fridge;
    if (index < 0 || index >= src.length) return false;
    if (state.selected && state.selected.from === from && state.selected.index === index) {
      state.selected = null;                       // повторный тап снимает выбор
    } else {
      state.selected = { from: from, index: index };
      sfx('select');
    }
    render();
    return true;
  }

  // Положить выбранный товар в секцию стеллажа.
  function place(sectionId) {
    if (state.status !== 'playing') return false;
    if (!state.selected) { toast('Сначала возьмите товар с завоза'); sfx('deny'); return false; }

    var row = state.shelf[sectionId];
    var slot = row.indexOf(null);
    if (slot === -1) { toast('Секция заполнена'); shakeSection(sectionId); sfx('deny'); return false; }

    var sel = state.selected;
    var productId = sel.from === 'belt' ? state.belt[sel.index] : state.fridge[sel.index];
    if (!productId) return false;

    var from = sel.from === 'belt' ? beltSlotPos(sel.index) : fridgeSlotPos(sel.index);

    if (sel.from === 'belt') state.belt.splice(sel.index, 1);
    else state.fridge.splice(sel.index, 1);

    row[slot] = productId;
    state.selected = null;
    state.lastPlacement = { section: sectionId, slot: slot, productId: productId, from: sel.from };

    var sale = resolveSale(sectionId);
    var key = sectionId + ':' + slot;
    if (!sale) hiddenSlots[key] = true;           // карточку покажем, когда долетит
    render();

    flyGhost(productById(productId), from, { x: slotX(slot), y: ROW_Y[sectionIndex(sectionId)] + 16 },
      function () {
        delete hiddenSlots[key];
        sfx('place');
        if (sale) runSaleFx(); else render({ pop: { section: sectionId, slot: slot } });
      });

    if (state.sold >= state.goal) finish('won');
    else if (shelfIsFull()) finish('lost', 'Стеллаж забит — смена сорвана');
    else if (state.belt.length === 0 && state.fridge.length === 0) finish('lost', 'Завоз кончился, план не выполнен');
    return true;
  }

  // Любые три одинаковых в одной секции — продажа. В «своей» секции дороже и растит комбо.
  function resolveSale(sectionId) {
    var row = state.shelf[sectionId];
    var counts = {};
    row.forEach(function (c) { if (c) counts[c] = (counts[c] || 0) + 1; });
    var hit = Object.keys(counts).filter(function (k) { return counts[k] >= 3; })[0];
    if (!hit) return false;

    var product = productById(hit);
    var correct = product.section === sectionId;
    var mult = correct ? comboMult() : 1;
    var gain = priceOf(product) * 3 * (correct ? 1.5 : 1) * mult;

    // позиции проданных карточек нужны для анимации до того, как полки очистятся
    var soldSlots = [];
    var seen = 0;
    row.forEach(function (c, i) { if (c === hit && seen < 3) { soldSlots.push(i); seen++; } });

    state.revenue += gain;
    state.sold += 1;
    state.combo = correct ? state.combo + 1 : 0;
    if (state.combo > bestCombo) bestCombo = state.combo;

    var removed = 0;
    var rest = row.filter(function (c) {
      if (c === hit && removed < 3) { removed++; return false; }
      return c !== null;
    });
    while (rest.length < SLOTS_PER_SECTION) rest.push(null);
    state.shelf[sectionId] = rest;
    state.lastPlacement = null;

    pendingSaleFx = { sectionId: sectionId, slots: soldSlots, product: product,
                      gain: gain, correct: correct, mult: mult, combo: state.combo };
    render();
    return true;
  }

  /* -------------------------------------------------------------- бустеры */

  function boosterUndo() {
    if (state.status !== 'playing' || !state.boosters.undo) return false;
    var lp = state.lastPlacement;
    if (!lp) { toast('Нечего отменять'); sfx('deny'); return false; }
    state.shelf[lp.section][lp.slot] = null;
    if (lp.from === 'fridge' && state.fridge.length < FRIDGE_SIZE) state.fridge.push(lp.productId);
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
    if (state.fridge.length >= FRIDGE_SIZE) { toast('Холодильник полон'); sfx('deny'); return false; }
    state.fridge.push(state.belt.splice(state.selected.index, 1)[0]);
    state.selected = null;
    state.boosters.fridge--;
    toast('Отложено в холодильник');
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
    toast('Завоз пересортирован');
    sfx('booster');
    render();
    return true;
  }

  /* ---------------------------------------------------------- конец смены */

  function finish(status, reason) {
    state.status = status;
    if (status === 'won') { streak += 1; totalRevenue += state.revenue; }
    else { streak = 0; }
    try { localStorage.setItem('shopsort.streak', String(streak)); } catch (e) {}
    if (window.console) console.log('[playtest] shift', state.shiftIdx + 1, status,
      'revenue', Math.round(state.revenue), 'streak', streak);
    render();
    sfx(status === 'won' ? 'win' : 'lose');
    showOverlay(status, reason);
  }

  function nextShift() {
    hideOverlay();
    startShift(Math.min(state.shiftIdx + 1, SHIFTS.length - 1));
    render();
  }

  function retryShift() {
    hideOverlay();
    startShift(state.shiftIdx, Date.now() & 0xffff);
    render();
  }

  /* -------------------------------------------------------------- геометрия */

  var SHELF_X = 24, SHELF_W = 672;
  var ROW_Y = [242, 418, 594], ROW_H = 156;
  var SLOT_X0 = 186, SLOT_W = 116, SLOT_GAP = 10, SLOT_H = 124;
  var CHIP_X = 40, CHIP_W = 130;
  var FRIDGE_Y = 792, FRIDGE_SLOT_W = 118, FRIDGE_SLOT_H = 98;
  var BELT_PANEL_Y = 912, BELT_Y = 950, BELT_H = 136, BELT_GAP = 10;
  var BTN_Y = 1122, BTN_W = 200, BTN_H = 96, BTN_GAP = 20, BTN_X0 = 40;
  var HUD_H = 156, AWNING_Y = 156, AWNING_H = 60;

  function sectionIndex(id) { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id) return i; return 0; }
  function sectionCX() { return SLOT_X0 + (SLOT_W * SLOTS_PER_SECTION + SLOT_GAP * (SLOTS_PER_SECTION - 1)) / 2; }
  function sectionCY(id) { return ROW_Y[sectionIndex(id)] + ROW_H / 2; }
  function slotX(i) { return SLOT_X0 + i * (SLOT_W + SLOT_GAP); }

  function beltVisible() { return (state && state.cfg.visible) || BELT_VISIBLE_MAX; }
  function beltCellW() { var n = beltVisible(); return Math.floor((SHELF_W - 40 - BELT_GAP * (n - 1)) / n); }
  function beltX0() { var n = beltVisible(); return SHELF_X + (SHELF_W - (beltCellW() * n + BELT_GAP * (n - 1))) / 2; }
  function beltSlotPos(i) { return { x: beltX0() + i * (beltCellW() + BELT_GAP), y: BELT_Y }; }
  function fridgeSlotPos(i) { return { x: SLOT_X0 + i * (FRIDGE_SLOT_W + SLOT_GAP), y: FRIDGE_Y }; }

  /* -------------------------------------------------------- примитивы сцены */

  var app, root, layers = {}, hud = {}, sectionNodes = {}, beltNodes = [];
  var toastBox, overlay, TEXTURES = {};
  var hiddenSlots = {}, pendingSaleFx = null, shownRevenue = 0;

  function label(text, size, color, weight) {
    return new PIXI.Text({
      text: text,
      style: {
        fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        fontSize: size, fill: color, fontWeight: weight || '600', align: 'center'
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

  // Вертикальная заливка полосами: дешевле текстурного градиента и без сюрпризов API.
  function vGradient(g, x, y, w, h, top, bottom, steps) {
    steps = steps || 24;
    for (var i = 0; i < steps; i++) {
      g.rect(x, y + h * i / steps, w, h / steps + 1).fill(mix(top, bottom, i / (steps - 1)));
    }
  }

  function panel(x, y, w, h, fill, radius, stroke) {
    var g = new PIXI.Graphics();
    g.roundRect(x, y, w, h, radius == null ? 18 : radius).fill(fill);
    if (stroke) g.roundRect(x, y, w, h, radius == null ? 18 : radius).stroke({ width: 3, color: stroke });
    return g;
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
        img.onerror = function () { resolve(); };   // нет картинки — останется эмодзи
        img.src = art[id];
      });
    }));
  }

  // Карточка товара: тень, тело с бликом, иконка, подпись, ценник на завозе.
  function card(product, w, h, opts) {
    opts = opts || {};
    var c = new PIXI.Container();

    var shadow = new PIXI.Graphics();
    shadow.roundRect(3, 6, w, h, 16).fill({ color: 0x4A3B2A, alpha: 0.16 });
    c.addChild(shadow);

    var body = new PIXI.Graphics();
    body.roundRect(0, 0, w, h, 16).fill(0xFFFDF8);
    body.roundRect(2, 2, w - 4, h * 0.36, 14).fill({ color: product.accent, alpha: 0.32 });
    body.roundRect(0, 0, w, h, 16).stroke({ width: opts.selected ? 5 : 2.5,
      color: opts.selected ? C.gold : mix(product.accent, C.ink, 0.35) });
    c.addChild(body);

    // цветной круг под иконкой: товары различимы боковым зрением
    var iconY = opts.price ? h * 0.36 : h * 0.40;
    var disc = new PIXI.Graphics();
    disc.circle(w / 2, iconY, h * (opts.price ? 0.24 : 0.28)).fill(product.accent);
    disc.circle(w / 2, iconY, h * (opts.price ? 0.24 : 0.28))
        .stroke({ width: 2, color: mix(product.accent, C.ink, 0.3) });
    c.addChild(disc);

    var art = TEXTURES[product.id];
    if (art) {
      var sp = new PIXI.Sprite(art);
      var side = Math.round(h * (opts.price ? 0.44 : 0.52));
      sp.width = side; sp.height = side;
      sp.anchor.set(0.5);
      sp.x = w / 2; sp.y = iconY;
      c.addChild(sp);
    } else {
      var gl = glyphText(product.glyph, Math.round(h * 0.30));
      gl.anchor.set(0.5);
      gl.x = w / 2; gl.y = iconY;
      c.addChild(gl);
    }

    var nm = label(product.name, Math.max(13, Math.round(h * 0.115)), C.ink, '700');
    nm.anchor.set(0.5);
    nm.x = w / 2; nm.y = opts.price ? h * 0.70 : h * 0.82;
    c.addChild(nm);

    if (opts.price) {
      var pr = label(money(priceOf(product)), Math.max(12, Math.round(h * 0.105)), C.inkSoft, '600');
      pr.anchor.set(0.5);
      pr.x = w / 2; pr.y = h * 0.87;
      c.addChild(pr);
    }

    if (state.saleProduct === product.id) {
      var badge = new PIXI.Graphics();
      badge.roundRect(w - 42, 6, 36, 24, 9).fill(C.red);
      c.addChild(badge);
      var bt = label('×2', 15, 0xFFFFFF, '800');
      bt.anchor.set(0.5); bt.x = w - 24; bt.y = 18;
      c.addChild(bt);
    }
    return c;
  }

  function button(x, y, w, h, text, sub, enabled, onTap) {
    var c = new PIXI.Container();
    var g = new PIXI.Graphics();
    g.roundRect(3, 5, w, h, 18).fill({ color: 0x4A3B2A, alpha: enabled ? 0.18 : 0.08 });
    g.roundRect(0, 0, w, h, 18).fill(enabled ? C.cream : 0xEADFCC);
    g.roundRect(2, 2, w - 4, h * 0.45, 16).fill({ color: 0xFFFFFF, alpha: enabled ? 0.6 : 0.25 });
    g.roundRect(0, 0, w, h, 18).stroke({ width: 3, color: enabled ? C.gold : 0xCFC3AE });
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

  /* ------------------------------------------------------------- статика */

  function buildStatic() {
    var bg = new PIXI.Graphics();
    vGradient(bg, 0, 0, W, H, C.wallTop, C.wallBot, 28);
    root.addChild(bg);

    buildHud();
    buildAwning();
    buildShelf();
    buildFridge();
    buildBeltTray();

    layers.shelfItems = new PIXI.Container();
    layers.fridgeItems = new PIXI.Container();
    layers.beltItems = new PIXI.Container();
    layers.buttons = new PIXI.Container();
    layers.fx = new PIXI.Container();
    root.addChild(layers.shelfItems, layers.fridgeItems, layers.beltItems, layers.buttons, layers.fx);

    buildToast();

    overlay = new PIXI.Container();
    overlay.visible = false;
    root.addChild(overlay);
  }

  function buildHud() {
    var g = new PIXI.Graphics();
    g.rect(0, 0, W, HUD_H).fill(C.cream);
    g.rect(0, HUD_H - 4, W, 4).fill({ color: C.woodDark, alpha: 0.25 });
    root.addChild(g);

    hud.revenue = label('0 ₽', 46, C.green, '800');
    hud.revenue.x = 28; hud.revenue.y = 18;
    root.addChild(hud.revenue);

    var cap = label('выручка смены', 16, C.inkSoft, '500');
    cap.x = 30; cap.y = 70;
    root.addChild(cap);

    hud.shift = label('', 16, C.inkSoft, '600');
    hud.shift.anchor.set(1, 0);
    hud.shift.x = W - 96; hud.shift.y = 30;
    root.addChild(hud.shift);

    hud.streak = label('', 16, C.inkSoft, '600');
    hud.streak.anchor.set(1, 0);
    hud.streak.x = W - 96; hud.streak.y = 54;
    root.addChild(hud.streak);

    // индикатор плана
    hud.planBar = new PIXI.Graphics();
    root.addChild(hud.planBar);
    hud.planText = label('', 17, C.ink, '700');
    hud.planText.anchor.set(0.5);
    hud.planText.x = 28 + 186; hud.planText.y = 117;
    root.addChild(hud.planText);

    // комбо-метр
    hud.comboBar = new PIXI.Graphics();
    root.addChild(hud.comboBar);
    hud.comboText = label('', 20, C.inkSoft, '800');
    hud.comboText.anchor.set(0, 0.5);
    hud.comboText.x = 628; hud.comboText.y = 117;
    root.addChild(hud.comboText);

    hud.sale = label('', 17, C.red, '700');
    hud.sale.anchor.set(0.5);
    hud.sale.x = W / 2; hud.sale.y = AWNING_Y + AWNING_H + 6;
    hud.sale.visible = false;
    root.addChild(hud.sale);

    // выключатель звука
    var mute = new PIXI.Container();
    mute.x = W - 76; mute.y = 22;
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
    g.roundRect(0, 0, 52, 52, 16).fill(muted ? 0xEADFCC : C.gold);
    g.moveTo(14, 20).lineTo(22, 20).lineTo(31, 12).lineTo(31, 40).lineTo(22, 32).lineTo(14, 32).closePath()
     .fill(muted ? 0x9E9080 : 0xFFFFFF);
    if (muted) {
      g.moveTo(36, 18).lineTo(46, 34).stroke({ width: 4, color: 0x9E9080, cap: 'round' });
      g.moveTo(46, 18).lineTo(36, 34).stroke({ width: 4, color: 0x9E9080, cap: 'round' });
    } else {
      g.moveTo(37, 17).quadraticCurveTo(43, 26, 37, 35).stroke({ width: 4, color: 0xFFFFFF, cap: 'round' });
      g.moveTo(44, 12).quadraticCurveTo(52, 26, 44, 40).stroke({ width: 4, color: 0xFFFFFF, cap: 'round' });
    }
  }

  // Полосатая маркиза: главная узнаваемая деталь «магазина у дома».
  function buildAwning() {
    var g = new PIXI.Graphics();
    var stripes = 9, sw = W / stripes, bandH = 34, scallopR = 20;

    // карниз, на котором держится маркиза
    g.roundRect(0, AWNING_Y - 10, W, 14, 4).fill(C.woodDark);
    g.rect(0, AWNING_Y - 10, W, 4).fill({ color: 0xFFFFFF, alpha: 0.18 });

    for (var i = 0; i < stripes; i++) {
      var col = i % 2 ? C.awningAlt : C.awning;
      g.rect(i * sw, AWNING_Y, sw, bandH).fill(col);
      g.ellipse(i * sw + sw / 2, AWNING_Y + bandH, sw / 2, scallopR).fill(col);
      // складка ткани по шву
      g.rect(i * sw, AWNING_Y, 2, bandH).fill({ color: 0x000000, alpha: 0.08 });
    }
    g.rect(0, AWNING_Y, W, 8).fill({ color: 0x000000, alpha: 0.16 });
    root.addChild(g);

    // мягкая тень маркизы на стену под ней
    var sh = new PIXI.Graphics();
    for (var k = 0; k < 10; k++) {
      sh.rect(0, AWNING_Y + bandH + scallopR + k * 2, W, 2)
        .fill({ color: 0x8A5A29, alpha: 0.06 * (1 - k / 10) });
    }
    root.addChild(sh);
  }

  function buildShelf() {
    var frameY = ROW_Y[0] - 16, frameH = ROW_Y[2] + ROW_H + 16 - frameY;
    var frame = new PIXI.Graphics();
    frame.roundRect(SHELF_X, frameY, SHELF_W, frameH, 24).fill(C.wood);
    frame.roundRect(SHELF_X + 6, frameY + 6, SHELF_W - 12, frameH - 12, 20).fill(mix(C.wood, C.woodDark, 0.35));
    frame.roundRect(SHELF_X, frameY, SHELF_W, frameH, 24).stroke({ width: 4, color: C.woodDark });
    root.addChild(frame);

    SECTIONS.forEach(function (s, i) {
      var node = new PIXI.Container();
      var y = ROW_Y[i];

      var back = new PIXI.Graphics();
      back.roundRect(SHELF_X + 16, y, SHELF_W - 32, ROW_H - 16, 16).fill(s.tint);
      back.roundRect(SHELF_X + 16, y, SHELF_W - 32, 10, 8).fill({ color: 0x000000, alpha: 0.07 });
      node.addChild(back);

      // деревянная полка под товаром
      var plank = new PIXI.Graphics();
      plank.roundRect(SHELF_X + 14, y + ROW_H - 26, SHELF_W - 28, 18, 7).fill(C.woodLight);
      plank.roundRect(SHELF_X + 14, y + ROW_H - 26, SHELF_W - 28, 6, 5).fill({ color: 0xFFFFFF, alpha: 0.3 });
      plank.roundRect(SHELF_X + 14, y + ROW_H - 14, SHELF_W - 28, 6, 5).fill({ color: C.woodDark, alpha: 0.5 });
      node.addChild(plank);

      // табличка секции
      var chip = new PIXI.Graphics();
      chip.roundRect(CHIP_X + 3, y + 25, CHIP_W, ROW_H - 62, 14).fill({ color: 0x4A3B2A, alpha: 0.18 });
      chip.roundRect(CHIP_X, y + 22, CHIP_W, ROW_H - 62, 14).fill(s.color);
      chip.roundRect(CHIP_X + 4, y + 26, CHIP_W - 8, (ROW_H - 62) * 0.4, 10).fill({ color: 0xFFFFFF, alpha: 0.22 });
      chip.circle(CHIP_X + 12, y + 32, 3).fill({ color: 0xFFFFFF, alpha: 0.5 });
      chip.circle(CHIP_X + CHIP_W - 12, y + 32, 3).fill({ color: 0xFFFFFF, alpha: 0.5 });
      node.addChild(chip);

      var name = label(s.name, 23, 0xFFFFFF, '800');
      name.anchor.set(0.5);
      name.x = CHIP_X + CHIP_W / 2; name.y = y + 22 + (ROW_H - 62) / 2;
      node.addChild(name);

      for (var k = 0; k < SLOTS_PER_SECTION; k++) {
        var slot = new PIXI.Graphics();
        slot.roundRect(slotX(k), y + 16, SLOT_W, SLOT_H, 14).fill({ color: 0x8A5A29, alpha: 0.08 });
        slot.roundRect(slotX(k), y + 16, SLOT_W, 8, 6).fill({ color: 0x8A5A29, alpha: 0.12 });
        node.addChild(slot);
      }

      // подсветка «своей» секции, когда товар выбран
      var hint = new PIXI.Graphics();
      hint.roundRect(SHELF_X + 16, y, SHELF_W - 32, ROW_H - 16, 16).stroke({ width: 5, color: C.gold });
      hint.alpha = 0;
      node.addChild(hint);
      node.hint = hint;

      // вся полка — одна большая цель для пальца
      var hit = new PIXI.Graphics();
      hit.roundRect(SHELF_X + 16, y, SHELF_W - 32, ROW_H - 16, 16).fill({ color: 0xFFFFFF, alpha: 0.001 });
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointertap', function (id) { return function () { place(id); }; }(s.id));
      node.addChild(hit);

      sectionNodes[s.id] = node;
      root.addChild(node);
    });
  }

  function buildFridge() {
    var g = new PIXI.Graphics();
    g.roundRect(SHELF_X, FRIDGE_Y - 16, SHELF_W, FRIDGE_SLOT_H + 32, 20).fill(0xD6E6EF);
    g.roundRect(SHELF_X, FRIDGE_Y - 16, SHELF_W, FRIDGE_SLOT_H + 32, 20).stroke({ width: 3, color: 0xA8C4D4 });
    g.roundRect(SHELF_X + 8, FRIDGE_Y - 8, SHELF_W - 16, 14, 8).fill({ color: 0xFFFFFF, alpha: 0.5 });
    root.addChild(g);

    var t = label('Холодильник', 18, 0x46697C, '700');
    t.anchor.set(0, 0.5);
    t.x = SHELF_X + 22; t.y = FRIDGE_Y + FRIDGE_SLOT_H / 2;
    root.addChild(t);

    for (var f = 0; f < FRIDGE_SIZE; f++) {
      var fs = new PIXI.Graphics();
      var p = fridgeSlotPos(f);
      fs.roundRect(p.x, p.y, FRIDGE_SLOT_W, FRIDGE_SLOT_H, 13).fill({ color: 0xFFFFFF, alpha: 0.45 });
      fs.roundRect(p.x, p.y, FRIDGE_SLOT_W, FRIDGE_SLOT_H, 13).stroke({ width: 2, color: 0xA8C4D4 });
      root.addChild(fs);
    }
  }

  function buildBeltTray() {
    var g = new PIXI.Graphics();
    g.roundRect(SHELF_X, BELT_PANEL_Y, SHELF_W, BELT_H + 74, 22).fill(C.cream);
    g.roundRect(SHELF_X, BELT_PANEL_Y, SHELF_W, BELT_H + 74, 22).stroke({ width: 3, color: 0xE0CFB2 });
    // «лента» под карточками
    g.roundRect(SHELF_X + 14, BELT_Y + BELT_H - 10, SHELF_W - 28, 16, 8).fill(0xC9B48A);
    root.addChild(g);

    var t = label('Завоз', 20, C.inkSoft, '800');
    t.x = SHELF_X + 24; t.y = BELT_PANEL_Y + 14;
    root.addChild(t);

    hud.beltCount = label('', 19, C.inkSoft, '600');
    hud.beltCount.anchor.set(1, 0);
    hud.beltCount.x = SHELF_X + SHELF_W - 24; hud.beltCount.y = BELT_PANEL_Y + 14;
    root.addChild(hud.beltCount);
  }

  function buildToast() {
    toastBox = new PIXI.Container();
    toastBox.alpha = 0;
    var bg = new PIXI.Graphics();
    bg.roundRect(-190, -26, 380, 52, 26).fill({ color: 0x4A3B2A, alpha: 0.9 });
    toastBox.addChild(bg);
    toastBox.text = label('', 21, 0xFFF8EC, '700');
    toastBox.text.anchor.set(0.5);
    toastBox.addChild(toastBox.text);
    toastBox.x = W / 2; toastBox.y = BELT_PANEL_Y - 26;
    root.addChild(toastBox);
  }

  /* ------------------------------------------------------------ отрисовка */

  function render(fx) {
    if (!app || !layers.shelfItems) return;
    layers.shelfItems.removeChildren();
    layers.fridgeItems.removeChildren();
    layers.beltItems.removeChildren();
    layers.buttons.removeChildren();
    beltNodes = [];

    renderHud();

    // товары на стеллаже
    SECTIONS.forEach(function (s, i) {
      state.shelf[s.id].forEach(function (pid, k) {
        if (!pid || hiddenSlots[s.id + ':' + k]) return;
        var c = card(productById(pid), SLOT_W, SLOT_H, {});
        c.x = slotX(k); c.y = ROW_Y[i] + 16;
        if (fx && fx.pop && fx.pop.section === s.id && fx.pop.slot === k) popIn(c, SLOT_W, SLOT_H);
        layers.shelfItems.addChild(c);
      });

      // подсветка «своей» секции выбранного товара
      var sel = selectedProduct();
      var full = state.shelf[s.id].indexOf(null) === -1;
      sectionNodes[s.id].hint.alpha = (sel && sel.section === s.id && !full) ? 0.9 : 0;
      sectionNodes[s.id].alpha = full ? 0.72 : 1;
    });

    // холодильник
    state.fridge.forEach(function (pid, k) {
      var p = fridgeSlotPos(k);
      var c = card(productById(pid), FRIDGE_SLOT_W, FRIDGE_SLOT_H, {
        selected: state.selected && state.selected.from === 'fridge' && state.selected.index === k
      });
      c.x = p.x; c.y = p.y;
      c.eventMode = 'static'; c.cursor = 'pointer';
      c.on('pointertap', function () { select('fridge', k); });
      layers.fridgeItems.addChild(c);
    });

    // лента завоза
    var bw = beltCellW();
    state.belt.slice(0, beltVisible()).forEach(function (pid, k) {
      var selected = state.selected && state.selected.from === 'belt' && state.selected.index === k;
      var c = card(productById(pid), bw, BELT_H, { selected: selected, price: true });
      var p = beltSlotPos(k);
      c.x = p.x; c.y = p.y - (selected ? 12 : 0);
      c.baseY = p.y - (selected ? 12 : 0);
      c.phase = k * 0.7;
      if (selected) c.scale.set(1.04);
      c.eventMode = 'static'; c.cursor = 'pointer';
      c.on('pointertap', function () { select('belt', k); });
      layers.beltItems.addChild(c);
      beltNodes.push(c);
    });
    hud.beltCount.text = 'осталось ' + state.belt.length;

    // бустеры
    var b = state.boosters, playing = state.status === 'playing';
    layers.buttons.addChild(
      button(BTN_X0, BTN_Y, BTN_W, BTN_H, 'Отмена', 'осталось ' + b.undo, b.undo > 0 && playing, boosterUndo),
      button(BTN_X0 + BTN_W + BTN_GAP, BTN_Y, BTN_W, BTN_H, 'В холодильник', 'осталось ' + b.fridge, b.fridge > 0 && playing, boosterFridge),
      button(BTN_X0 + (BTN_W + BTN_GAP) * 2, BTN_Y, BTN_W, BTN_H, 'Пересортица', 'осталось ' + b.shuffle, b.shuffle > 0 && playing, boosterShuffle)
    );
  }

  function selectedProduct() {
    if (!state.selected) return null;
    var id = state.selected.from === 'belt'
      ? state.belt[state.selected.index]
      : state.fridge[state.selected.index];
    return id ? productById(id) : null;
  }

  function renderHud() {
    hud.revenue.text = money(shownRevenue);
    hud.shift.text = 'Смена ' + (state.shiftIdx + 1) + ' из ' + SHIFTS.length;
    hud.streak.text = 'смен подряд: ' + streak;

    var bx = 28, by = 104, bw = 372, bh = 27;
    var p = Math.min(state.sold / state.goal, 1);
    hud.planBar.clear();
    hud.planBar.roundRect(bx, by, bw, bh, 14).fill(0xEADFCC);
    if (p > 0) hud.planBar.roundRect(bx, by, Math.max(bh, bw * p), bh, 14).fill(0x7FBE84);
    hud.planBar.roundRect(bx, by, bw, bh, 14).stroke({ width: 2, color: 0xD6C7AC });
    hud.planText.text = 'План  ' + state.sold + ' / ' + state.goal;

    var cx = 432, segs = 4, sw = 42, gap = 6;
    hud.comboBar.clear();
    for (var i = 0; i < segs; i++) {
      var on = state.combo > i;
      hud.comboBar.roundRect(cx + i * (sw + gap), by, sw, bh, 9)
        .fill(on ? mix(C.gold, C.red, i / (segs - 1)) : 0xEADFCC);
      if (!on) hud.comboBar.roundRect(cx + i * (sw + gap), by, sw, bh, 9).stroke({ width: 2, color: 0xD6C7AC });
    }
    hud.comboText.text = state.combo > 0 ? '×' + comboMult().toFixed(1) : 'комбо';
    hud.comboText.style.fill = state.combo > 0 ? C.gold : C.inkSoft;

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

  function popIn(node, w, h) {
    node.pivot.set(w / 2, h / 2);
    node.x += w / 2; node.y += h / 2;
    node.scale.set(0.65);
    anim(200, function (p) { node.scale.set(0.65 + 0.35 * easeOut(p)); });
  }

  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

  // Товар летит с завоза на полку по дуге — связывает выбор и результат.
  function flyGhost(product, from, to, done) {
    var w = beltCellW();
    var ghost = card(product, w, BELT_H, {});
    ghost.x = from.x; ghost.y = from.y;
    layers.fx.addChild(ghost);
    var arc = 90 + Math.random() * 30;
    var sx = SLOT_W / w, sy = SLOT_H / BELT_H;
    anim(190, function (p) {
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

    var i = sectionIndex(fx.sectionId);
    fx.slots.forEach(function (slot, n) {
      var ghost = card(fx.product, SLOT_W, SLOT_H, {});
      ghost.x = slotX(slot); ghost.y = ROW_Y[i] + 16;
      ghost.pivot.set(SLOT_W / 2, SLOT_H / 2);
      ghost.x += SLOT_W / 2; ghost.y += SLOT_H / 2;
      layers.fx.addChild(ghost);
      anim(280, function (p) {
        ghost.scale.set(1 + 0.25 * p);
        ghost.alpha = 1 - p;
        ghost.y -= 0.6;
      }, function () { ghost.destroy(); });
    });

    flashSection(fx.sectionId, fx.correct);
    sfx(fx.correct ? 'sale' : 'wrong', fx.combo);
    floatText(sectionCX(), sectionCY(fx.sectionId),
      '+' + money(fx.gain) + (fx.correct ? '  ×' + fx.mult.toFixed(1) : '  не своя секция'),
      fx.correct ? C.green : C.red);
    spawnCoins(sectionCX(), sectionCY(fx.sectionId), fx.correct ? 8 : 4);
    countRevenueTo(state.revenue);
  }

  // Монеты летят в счётчик выручки: видно, откуда взялись деньги.
  function spawnCoins(x, y, n) {
    var tx = 70, ty = 42;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var coin = new PIXI.Graphics();
        coin.circle(0, 0, 11).fill(C.gold);
        coin.circle(-3, -3, 4).fill({ color: 0xFFFFFF, alpha: 0.6 });
        coin.circle(0, 0, 11).stroke({ width: 2, color: 0xB8801A });
        coin.x = x; coin.y = y;
        layers.fx.addChild(coin);
        var cx = x + (Math.random() - 0.5) * 260, cy = y - 150 - Math.random() * 120;
        anim(520 + i * 40, function (p) {
          var e = easeOut(p);
          // квадратичная кривая: вверх с разбросом, потом в счётчик
          var q = 1 - e;
          coin.x = q * q * x + 2 * q * e * cx + e * e * tx;
          coin.y = q * q * y + 2 * q * e * cy + e * e * ty;
          coin.scale.set(1 - 0.35 * e);
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
    anim(600, function (p) { shownRevenue = from + (target - from) * easeOut(p); hud.revenue.text = money(shownRevenue); },
      function () { shownRevenue = target; hud.revenue.text = money(shownRevenue); });
  }

  function pulse(node) {
    if (node.__pulsing) return;
    node.__pulsing = true;
    var base = node.scale.x;
    anim(220, function (p) { node.scale.set(base * (1 + 0.12 * Math.sin(p * Math.PI))); },
      function () { node.scale.set(base); node.__pulsing = false; });
  }

  function flashSection(sectionId, ok) {
    var i = sectionIndex(sectionId);
    var g = new PIXI.Graphics();
    g.roundRect(SHELF_X + 16, ROW_Y[i], SHELF_W - 32, ROW_H - 16, 16).fill(ok ? 0x8FD18A : 0xE0A0A0);
    g.alpha = 0.8;
    layers.fx.addChild(g);
    anim(340, function (p) { g.alpha = 0.8 * (1 - p); }, function () { g.destroy(); });
  }

  function shakeSection(sectionId) {
    var node = sectionNodes[sectionId];
    var base = node.x;
    anim(260, function (p) { node.x = base + Math.sin(p * Math.PI * 6) * 9 * (1 - p); },
      function () { node.x = base; });
  }

  function floatText(x, y, text, color) {
    var t = label(text, 28, color, '800');
    t.anchor.set(0.5);
    t.x = x; t.y = y;
    layers.fx.addChild(t);
    anim(950, function (p) { t.y = y - 70 * easeOut(p); t.alpha = 1 - p * p; },
      function () { t.destroy(); });
  }

  function toast(msg) {
    toastBox.text.text = msg;
    toastBox.alpha = 1;
    toastBox.y = BELT_PANEL_Y - 26;
    anim(1300, function (p) {
      toastBox.alpha = p < 0.75 ? 1 : (1 - p) * 4;
      toastBox.y = BELT_PANEL_Y - 26 - 10 * easeOut(Math.min(p * 4, 1));
    });
  }

  /* ---------------------------------------------------------------- оверлей */

  function showOverlay(status, reason) {
    overlay.removeChildren();
    overlay.visible = true;

    var dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x2B2118, alpha: 0.72 });
    overlay.addChild(dim);

    var won = status === 'won';
    var px = 60, py = 356, pw = W - 120, ph = 524;

    var card = new PIXI.Graphics();
    card.roundRect(px + 6, py + 10, pw, ph, 30).fill({ color: 0x000000, alpha: 0.3 });
    card.roundRect(px, py, pw, ph, 30).fill(C.cream);
    card.roundRect(px, py, pw, 92, 30).fill(won ? C.green : C.red);
    card.roundRect(px, py + 62, pw, 30).fill(won ? C.green : C.red);
    card.roundRect(px, py, pw, ph, 30).stroke({ width: 4, color: won ? 0x246127 : 0x93362E });
    overlay.addChild(card);

    var title = label(won ? 'Смена закрыта!' : 'Смена сорвана', 38, 0xFFFFFF, '800');
    title.anchor.set(0.5); title.x = W / 2; title.y = py + 46;
    overlay.addChild(title);

    var rows = [
      ['Выручка', money(state.revenue)],
      ['Продано наборов', state.sold + ' / ' + state.goal],
      ['Лучшее комбо', '×' + Math.min(1 + 0.5 * bestCombo, COMBO_MAX_MULT).toFixed(1)],
      ['Смен подряд', String(streak)],
      ['Всего заработано', money(totalRevenue)]
    ];
    rows.forEach(function (r, i) {
      var y = py + 130 + i * 52;
      var line = new PIXI.Graphics();
      line.roundRect(px + 34, y - 20, pw - 68, 44, 12).fill(i % 2 ? 0xF6ECDC : 0xFFFFFF);
      overlay.addChild(line);
      var k = label(r[0], 21, C.inkSoft, '600');
      k.anchor.set(0, 0.5); k.x = px + 50; k.y = y;
      var v = label(r[1], 22, C.ink, '800');
      v.anchor.set(1, 0.5); v.x = px + pw - 50; v.y = y;
      overlay.addChild(k, v);
    });

    if (reason) {
      var why = label(reason, 18, C.inkSoft, '600');
      why.anchor.set(0.5); why.x = W / 2; why.y = py + ph - 142;
      overlay.addChild(why);
    } else if (streak >= 3) {
      var ok = label('Три смены подряд — гипотеза подтверждается', 18, C.green, '700');
      ok.anchor.set(0.5); ok.x = W / 2; ok.y = py + ph - 142;
      overlay.addChild(ok);
    }

    var last = state.shiftIdx >= SHIFTS.length - 1;
    overlay.addChild(button(px + 40, py + ph - 116, pw - 80, 88,
      won ? (last ? 'Ещё смена' : 'Следующая смена') : 'Переиграть смену',
      null, true, won ? nextShift : retryShift));
  }

  function hideOverlay() { overlay.visible = false; overlay.removeChildren(); }

  /* ------------------------------------------------------------------ boot */

  function fit() {
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    app.renderer.resize(Math.ceil(W * s), Math.ceil(H * s));
    root.scale.set(s);
  }

  function autoStep() {
    // Жадный бот: добивает тройки, иначе кладёт в «свою» секцию. Для смоук-теста.
    if (!state || state.status !== 'playing') return false;
    var visible = state.belt.slice(0, beltVisible());
    var best = null;
    for (var i = 0; i < visible.length; i++) {
      var p = productById(visible[i]);
      for (var si = 0; si < SECTIONS.length; si++) {
        var sec = SECTIONS[si];
        var row = state.shelf[sec.id];
        var same = row.filter(function (c) { return c === p.id; }).length;
        var freeCount = row.filter(function (c) { return c === null; }).length;
        if (freeCount === 0) continue;
        var score = same * 20 + (p.section === sec.id ? 6 : 0) + freeCount * 2;
        if (freeCount === 1 && same < 2) score -= 25;   // не убивать секцию последним слотом
        if (!best || score > best.score) best = { i: i, section: sec.id, score: score };
      }
    }
    if (!best) return false;
    state.selected = null;          // select() — переключатель, боту нужен детерминизм
    select('belt', best.i);
    return place(best.section);
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

      startShift(0);
      buildStatic();
      fit();
      loadArt().then(function () { render(); });
      window.addEventListener('resize', fit);

      // звук стартует только после первого касания — политика браузеров
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
        // лёгкое покачивание товара на завозе — сцена не выглядит замершей
        for (var k = 0; k < beltNodes.length; k++) {
          var n = beltNodes[k];
          if (n.baseY != null) n.y = n.baseY + Math.sin(clock * 1.8 + n.phase) * 3;
        }
      });

      // Хук для плейтестов и автотестов
      window.__proto = {
        get state() { return state; },
        get streak() { return streak; },
        select: select, place: place, autoStep: autoStep,
        booster: { undo: boosterUndo, fridge: boosterFridge, shuffle: boosterShuffle },
        nextShift: nextShift, retryShift: retryShift,
        startShift: function (i, seed) { hideOverlay(); startShift(i, seed); render(); }
      };
    });
  }

  boot();
})();
