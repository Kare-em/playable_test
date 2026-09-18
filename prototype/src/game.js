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
    { id: 'dairy',   name: 'Молочка', color: 0x5B8FC7, tint: 0xE9F1F9 },
    { id: 'grocery', name: 'Бакалея', color: 0xC98B2E, tint: 0xFAF0DC },
    { id: 'produce', name: 'Овощи',   color: 0x5FA05A, tint: 0xEAF4E7 }
  ];

  var PRODUCTS = [
    { id: 'milk',   name: 'Молоко',   glyph: '🥛', section: 'dairy',   price: 40, color: 0xDCEAF7 },
    { id: 'cheese', name: 'Сыр',      glyph: '🧀', section: 'dairy',   price: 55, color: 0xF7E9C8 },
    { id: 'yogurt', name: 'Йогурт',   glyph: '🍶', section: 'dairy',   price: 35, color: 0xE8EEF6 },
    { id: 'butter', name: 'Масло',    glyph: '🧈', section: 'dairy',   price: 60, color: 0xF6EDD2 },
    { id: 'bread',  name: 'Хлеб',     glyph: '🍞', section: 'grocery', price: 30, color: 0xF3E0C0 },
    { id: 'grain',  name: 'Крупа',    glyph: '🍚', section: 'grocery', price: 45, color: 0xF1EADC },
    { id: 'cookie', name: 'Печенье',  glyph: '🍪', section: 'grocery', price: 50, color: 0xEED9BC },
    { id: 'can',    name: 'Консервы', glyph: '🥫', section: 'grocery', price: 65, color: 0xEFD6CE },
    { id: 'apple',  name: 'Яблоко',   glyph: '🍎', section: 'produce', price: 35, color: 0xF6D8D6 },
    { id: 'carrot', name: 'Морковь',  glyph: '🥕', section: 'produce', price: 25, color: 0xF8E0C8 },
    { id: 'tomato', name: 'Помидор',  glyph: '🍅', section: 'produce', price: 40, color: 0xF7D6CF },
    { id: 'grape',  name: 'Виноград', glyph: '🍇', section: 'produce', price: 70, color: 0xE6DCF2 }
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

  /* ------------------------------------------------------------- состояние */

  var state = null;
  var streak = 0;          // смен подряд за сессию — главная метрика плейтеста
  var totalRevenue = 0;

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
    }
    render();
    return true;
  }

  // Положить выбранный товар в секцию стеллажа.
  function place(sectionId) {
    if (state.status !== 'playing') return false;
    if (!state.selected) { toast('Сначала возьмите товар с завоза'); return false; }

    var row = state.shelf[sectionId];
    var slot = row.indexOf(null);
    if (slot === -1) { toast('Секция заполнена'); shakeSection(sectionId); return false; }

    var sel = state.selected;
    var productId = sel.from === 'belt' ? state.belt[sel.index] : state.fridge[sel.index];
    if (!productId) return false;

    if (sel.from === 'belt') state.belt.splice(sel.index, 1);
    else state.fridge.splice(sel.index, 1);

    row[slot] = productId;
    state.selected = null;
    state.lastPlacement = { section: sectionId, slot: slot, productId: productId, from: sel.from };

    var sale = resolveSale(sectionId);
    render(sale ? null : { pop: { section: sectionId, slot: slot } });

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

    state.revenue += gain;
    state.sold += 1;
    state.combo = correct ? state.combo + 1 : 0;

    var removed = 0;
    var rest = row.filter(function (c) {
      if (c === hit && removed < 3) { removed++; return false; }
      return c !== null;
    });
    while (rest.length < SLOTS_PER_SECTION) rest.push(null);
    state.shelf[sectionId] = rest;
    state.lastPlacement = null;

    render();
    flashSection(sectionId, correct);
    floatText(sectionX(sectionId), sectionY(sectionId),
      '+' + money(gain) + (correct ? '  ×' + mult.toFixed(1) : '  не своя секция'),
      correct ? 0x2F7D32 : 0xA8452F);
    return true;
  }

  /* -------------------------------------------------------------- бустеры */

  function boosterUndo() {
    if (state.status !== 'playing' || !state.boosters.undo) return false;
    var lp = state.lastPlacement;
    if (!lp) { toast('Нечего отменять'); return false; }
    state.shelf[lp.section][lp.slot] = null;
    if (lp.from === 'fridge' && state.fridge.length < FRIDGE_SIZE) state.fridge.push(lp.productId);
    else state.belt.unshift(lp.productId);
    state.lastPlacement = null;
    state.boosters.undo--;
    toast('Товар возвращён');
    render();
    return true;
  }

  function boosterFridge() {
    if (state.status !== 'playing' || !state.boosters.fridge) return false;
    if (!state.selected || state.selected.from !== 'belt') { toast('Возьмите товар с завоза'); return false; }
    if (state.fridge.length >= FRIDGE_SIZE) { toast('Холодильник полон'); return false; }
    state.fridge.push(state.belt.splice(state.selected.index, 1)[0]);
    state.selected = null;
    state.boosters.fridge--;
    toast('Отложено в холодильник');
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

  /* ------------------------------------------------------------ отрисовка */

  var app, root, layers = {}, toastText, overlay, sectionNodes = {};

  function panel(x, y, w, h, fill, radius, stroke) {
    var g = new PIXI.Graphics();
    g.roundRect(x, y, w, h, radius == null ? 18 : radius).fill(fill);
    if (stroke) g.roundRect(x, y, w, h, radius == null ? 18 : radius).stroke({ width: 3, color: stroke });
    return g;
  }

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

  // Геометрия
  var SHELF_X = 30, SHELF_W = 660;
  var ROW_Y = [220, 400, 580], ROW_H = 160;
  var SLOT_X0 = 200, SLOT_W = 108, SLOT_GAP = 10, SLOT_H = 128;
  var FRIDGE_Y = 768, FRIDGE_SLOT_W = 120, FRIDGE_SLOT_H = 104;
  var BELT_Y = 940, BELT_GAP = 10, BELT_H = 132;
  var BTN_Y = 1130, BTN_W = 200, BTN_H = 92, BTN_GAP = 20, BTN_X0 = 40;

  function beltVisible() { return (state && state.cfg.visible) || BELT_VISIBLE_MAX; }
  function beltCellW() { var n = beltVisible(); return Math.floor((SHELF_W - 40 - BELT_GAP * (n - 1)) / n); }
  function beltX0() { var n = beltVisible(); return SHELF_X + (SHELF_W - (beltCellW() * n + BELT_GAP * (n - 1))) / 2; }

  function sectionIndex(id) { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id) return i; return 0; }
  function sectionX(id) { return SLOT_X0 + (SLOT_W * SLOTS_PER_SECTION + SLOT_GAP * (SLOTS_PER_SECTION - 1)) / 2; }
  function sectionY(id) { return ROW_Y[sectionIndex(id)] + ROW_H / 2; }
  function slotX(i) { return SLOT_X0 + i * (SLOT_W + SLOT_GAP); }

  function buildStatic() {
    var bg = new PIXI.Graphics();
    bg.rect(0, 0, W, H).fill(0xF3E7D3);
    root.addChild(bg);

    // шапка
    root.addChild(panel(0, 0, W, 190, 0xFFFFFF, 0));
    layers.hud = new PIXI.Container();
    root.addChild(layers.hud);

    // стеллаж
    root.addChild(panel(SHELF_X, ROW_Y[0] - 20, SHELF_W, ROW_Y[2] + ROW_H + 20 - (ROW_Y[0] - 20), 0xE4D2B6, 22));

    SECTIONS.forEach(function (s, i) {
      var node = new PIXI.Container();
      node.y = 0;
      var frame = panel(SHELF_X + 15, ROW_Y[i], SHELF_W - 30, ROW_H - 14, s.tint, 16, s.color);
      node.addChild(frame);

      var chip = panel(SHELF_X + 30, ROW_Y[i] + 20, 130, ROW_H - 54, s.color, 14);
      node.addChild(chip);
      var chipLabel = label(s.name, 24, 0xFFFFFF, '700');
      chipLabel.anchor.set(0.5);
      chipLabel.x = SHELF_X + 30 + 65; chipLabel.y = ROW_Y[i] + 20 + (ROW_H - 54) / 2;
      node.addChild(chipLabel);

      for (var k = 0; k < SLOTS_PER_SECTION; k++) {
        var slot = new PIXI.Graphics();
        slot.roundRect(slotX(k), ROW_Y[i] + 16, SLOT_W, SLOT_H, 14)
            .fill({ color: 0xFFFFFF, alpha: 0.55 })
            .stroke({ width: 2, color: s.color, alpha: 0.5 });
        node.addChild(slot);
      }

      // вся полка — одна большая цель для пальца
      var hit = new PIXI.Graphics();
      hit.roundRect(SHELF_X + 15, ROW_Y[i], SHELF_W - 30, ROW_H - 14, 16).fill({ color: 0xFFFFFF, alpha: 0.001 });
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointertap', function (id) { return function () { place(id); }; }(s.id));
      node.addChild(hit);

      sectionNodes[s.id] = node;
      root.addChild(node);
    });

    // холодильник
    root.addChild(panel(SHELF_X, FRIDGE_Y - 14, SHELF_W, FRIDGE_SLOT_H + 28, 0xDCE9F0, 18));
    var fl = label('Холодильник', 18, 0x4A6B7C, '700');
    fl.anchor.set(0, 0.5); fl.x = SHELF_X + 22; fl.y = FRIDGE_Y + FRIDGE_SLOT_H / 2;
    root.addChild(fl);
    for (var f = 0; f < FRIDGE_SIZE; f++) {
      var fs = new PIXI.Graphics();
      fs.roundRect(SLOT_X0 + f * (FRIDGE_SLOT_W + SLOT_GAP), FRIDGE_Y, FRIDGE_SLOT_W, FRIDGE_SLOT_H, 12)
        .fill({ color: 0xFFFFFF, alpha: 0.5 }).stroke({ width: 2, color: 0x9DBACB, alpha: 0.6 });
      root.addChild(fs);
    }

    // лента завоза
    root.addChild(panel(SHELF_X, BELT_Y - 46, SHELF_W, BELT_H + 60, 0xFFFFFF, 18));
    var bl = label('Завоз', 20, 0x7A6A55, '700');
    bl.x = SHELF_X + 22; bl.y = BELT_Y - 38;
    root.addChild(bl);
    layers.beltCount = label('', 20, 0x7A6A55, '600');
    layers.beltCount.anchor.set(1, 0);
    layers.beltCount.x = SHELF_X + SHELF_W - 22; layers.beltCount.y = BELT_Y - 38;
    root.addChild(layers.beltCount);

    layers.shelfItems = new PIXI.Container();
    layers.fridgeItems = new PIXI.Container();
    layers.beltItems = new PIXI.Container();
    layers.buttons = new PIXI.Container();
    layers.fx = new PIXI.Container();
    root.addChild(layers.shelfItems, layers.fridgeItems, layers.beltItems, layers.buttons, layers.fx);

    toastText = label('', 22, 0x4A3B2A, '700');
    toastText.anchor.set(0.5);
    toastText.x = W / 2; toastText.y = BELT_Y - 70;
    toastText.alpha = 0;
    root.addChild(toastText);

    overlay = new PIXI.Container();
    overlay.visible = false;
    root.addChild(overlay);
  }

  function card(product, w, h, opts) {
    opts = opts || {};
    var c = new PIXI.Container();
    var g = new PIXI.Graphics();
    g.roundRect(0, 0, w, h, 14).fill(product.color)
     .roundRect(0, 0, w, h, 14).stroke({ width: opts.selected ? 5 : 2, color: opts.selected ? 0xE0A21B : 0xB9A483 });
    c.addChild(g);

    var gl = glyphText(product.glyph, Math.round(h * 0.40));
    gl.anchor.set(0.5);
    gl.x = w / 2; gl.y = h * 0.40;
    c.addChild(gl);

    var nm = label(product.name, Math.max(13, Math.round(h * 0.125)), 0x4A3B2A, '600');
    nm.anchor.set(0.5);
    nm.x = w / 2; nm.y = h * 0.80;
    c.addChild(nm);

    if (state.saleProduct === product.id) {
      var badge = new PIXI.Graphics();
      badge.roundRect(w - 40, 6, 34, 22, 8).fill(0xD1453B);
      c.addChild(badge);
      var bt = label('×2', 14, 0xFFFFFF, '700');
      bt.anchor.set(0.5); bt.x = w - 23; bt.y = 17;
      c.addChild(bt);
    }
    return c;
  }

  function button(x, y, w, h, text, sub, enabled, onTap) {
    var c = new PIXI.Container();
    var g = new PIXI.Graphics();
    g.roundRect(0, 0, w, h, 16).fill(enabled ? 0xFFFFFF : 0xEBE2D3)
     .roundRect(0, 0, w, h, 16).stroke({ width: 3, color: enabled ? 0xC98B2E : 0xCFC3AE });
    c.addChild(g);
    var t = label(text, 22, enabled ? 0x4A3B2A : 0x9E9080, '700');
    t.anchor.set(0.5); t.x = w / 2; t.y = h / 2 - (sub ? 12 : 0);
    c.addChild(t);
    if (sub) {
      var s = label(sub, 16, enabled ? 0x8A7A64 : 0x9E9080, '500');
      s.anchor.set(0.5); s.x = w / 2; s.y = h / 2 + 16;
      c.addChild(s);
    }
    c.x = x; c.y = y;
    if (enabled) { c.eventMode = 'static'; c.cursor = 'pointer'; c.on('pointertap', onTap); }
    return c;
  }

  function render(fx) {
    if (!app) return;
    layers.hud.removeChildren();
    layers.shelfItems.removeChildren();
    layers.fridgeItems.removeChildren();
    layers.beltItems.removeChildren();
    layers.buttons.removeChildren();

    // HUD
    var rev = label(money(state.revenue), 42, 0x2F7D32, '800');
    rev.x = 28; rev.y = 22;
    layers.hud.addChild(rev);
    var revCap = label('выручка смены', 16, 0x8A7A64, '500');
    revCap.x = 30; revCap.y = 72;
    layers.hud.addChild(revCap);

    var goal = label('План: ' + state.sold + ' / ' + state.goal, 26, 0x4A3B2A, '700');
    goal.anchor.set(1, 0); goal.x = W - 28; goal.y = 24;
    layers.hud.addChild(goal);
    var shift = label('Смена ' + (state.shiftIdx + 1) + ' · смен подряд: ' + streak, 16, 0x8A7A64, '500');
    shift.anchor.set(1, 0); shift.x = W - 28; shift.y = 60;
    layers.hud.addChild(shift);

    var mult = comboMult();
    var combo = label(state.combo > 0 ? ('Комбо ×' + mult.toFixed(1)) : 'Комбо не собрано', 22,
      state.combo > 0 ? 0xC98B2E : 0xA99B8A, '700');
    combo.anchor.set(0.5, 0); combo.x = W / 2; combo.y = 112;
    layers.hud.addChild(combo);

    if (state.saleProduct) {
      var sp = productById(state.saleProduct);
      var sale = label('Акция дня: ' + sp.name + ' ×2', 18, 0xD1453B, '700');
      sale.anchor.set(0.5, 0); sale.x = W / 2; sale.y = 150;
      layers.hud.addChild(sale);
    }

    // товары на стеллаже
    SECTIONS.forEach(function (s, i) {
      state.shelf[s.id].forEach(function (pid, k) {
        if (!pid) return;
        var c = card(productById(pid), SLOT_W, SLOT_H, {});
        c.x = slotX(k); c.y = ROW_Y[i] + 16;
        if (fx && fx.pop && fx.pop.section === s.id && fx.pop.slot === k) popIn(c);
        layers.shelfItems.addChild(c);
      });
    });

    // холодильник
    state.fridge.forEach(function (pid, k) {
      var c = card(productById(pid), FRIDGE_SLOT_W, FRIDGE_SLOT_H, {
        selected: state.selected && state.selected.from === 'fridge' && state.selected.index === k
      });
      c.x = SLOT_X0 + k * (FRIDGE_SLOT_W + SLOT_GAP); c.y = FRIDGE_Y;
      c.eventMode = 'static'; c.cursor = 'pointer';
      c.on('pointertap', function () { select('fridge', k); });
      layers.fridgeItems.addChild(c);
    });

    // лента завоза
    var bw = beltCellW(), bx0 = beltX0();
    state.belt.slice(0, beltVisible()).forEach(function (pid, k) {
      var selected = state.selected && state.selected.from === 'belt' && state.selected.index === k;
      var c = card(productById(pid), bw, BELT_H, { selected: selected });
      c.x = bx0 + k * (bw + BELT_GAP); c.y = BELT_Y - (selected ? 10 : 0);
      c.eventMode = 'static'; c.cursor = 'pointer';
      c.on('pointertap', function () { select('belt', k); });
      layers.beltItems.addChild(c);
    });
    layers.beltCount.text = 'осталось ' + state.belt.length;

    // бустеры
    var b = state.boosters;
    layers.buttons.addChild(
      button(BTN_X0, BTN_Y, BTN_W, BTN_H, 'Отмена', 'осталось ' + b.undo, b.undo > 0 && state.status === 'playing', boosterUndo),
      button(BTN_X0 + BTN_W + BTN_GAP, BTN_Y, BTN_W, BTN_H, 'В холодильник', 'осталось ' + b.fridge, b.fridge > 0 && state.status === 'playing', boosterFridge),
      button(BTN_X0 + (BTN_W + BTN_GAP) * 2, BTN_Y, BTN_W, BTN_H, 'Пересортица', 'осталось ' + b.shuffle, b.shuffle > 0 && state.status === 'playing', boosterShuffle)
    );
  }

  /* ---------------------------------------------------------------- эффекты */

  var anims = [];

  function popIn(node) {
    node.pivot.set(SLOT_W / 2, SLOT_H / 2);
    node.x += SLOT_W / 2; node.y += SLOT_H / 2;
    node.scale.set(0.7);
    anims.push({ t: 0, d: 180, step: function (p) { node.scale.set(0.7 + 0.3 * p); } });
  }

  function flashSection(sectionId, ok) {
    var i = sectionIndex(sectionId);
    var g = new PIXI.Graphics();
    g.roundRect(SHELF_X + 15, ROW_Y[i], SHELF_W - 30, ROW_H - 14, 16).fill(ok ? 0x8FD18A : 0xE0A0A0);
    g.alpha = 0.75;
    layers.fx.addChild(g);
    anims.push({ t: 0, d: 320, step: function (p) { g.alpha = 0.75 * (1 - p); }, done: function () { g.destroy(); } });
  }

  function shakeSection(sectionId) {
    var node = sectionNodes[sectionId];
    var base = node.x;
    anims.push({
      t: 0, d: 260,
      step: function (p) { node.x = base + Math.sin(p * Math.PI * 6) * 8 * (1 - p); },
      done: function () { node.x = base; }
    });
  }

  function floatText(x, y, text, color) {
    var t = label(text, 26, color, '800');
    t.anchor.set(0.5);
    t.x = x; t.y = y;
    layers.fx.addChild(t);
    anims.push({
      t: 0, d: 900,
      step: function (p) { t.y = y - 60 * p; t.alpha = 1 - p * p; },
      done: function () { t.destroy(); }
    });
  }

  function toast(msg) {
    toastText.text = msg;
    toastText.alpha = 1;
    anims.push({ t: 0, d: 1100, step: function (p) { toastText.alpha = 1 - p; } });
  }

  /* ---------------------------------------------------------------- оверлей */

  function showOverlay(status, reason) {
    overlay.removeChildren();
    overlay.visible = true;

    var dim = new PIXI.Graphics();
    dim.rect(0, 0, W, H).fill({ color: 0x2B2118, alpha: 0.7 });
    overlay.addChild(dim);

    var px = 70, py = 380, pw = W - 140, ph = 520;
    overlay.addChild(panel(px, py, pw, ph, 0xFFF7EA, 26, 0xC98B2E));

    var won = status === 'won';
    var title = label(won ? 'Смена закрыта!' : 'Смена сорвана', 40, won ? 0x2F7D32 : 0xA8452F, '800');
    title.anchor.set(0.5); title.x = W / 2; title.y = py + 70;
    overlay.addChild(title);

    var lines = [
      'Выручка: ' + money(state.revenue),
      'Продано наборов: ' + state.sold + ' / ' + state.goal,
      reason ? reason : 'Комбо-множитель дошёл до ×' + comboMult().toFixed(1),
      '',
      'Смен подряд: ' + streak + (streak >= 3 ? '  ← гипотеза подтверждается' : ''),
      'Всего заработано: ' + money(totalRevenue)
    ];
    lines.forEach(function (line, i) {
      var t = label(line, 22, 0x4A3B2A, i === 4 ? '800' : '500');
      t.anchor.set(0.5); t.x = W / 2; t.y = py + 140 + i * 38;
      overlay.addChild(t);
    });

    var last = state.shiftIdx >= SHIFTS.length - 1;
    overlay.addChild(button(px + 40, py + ph - 130, pw - 80, 88,
      won ? (last ? 'Ещё смена (сложность максимум)' : 'Следующая смена') : 'Переиграть смену',
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
      width: W, height: H, background: 0x2B2118,
      antialias: true, autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    }).then(function () {
      var boot = document.getElementById('boot');
      if (boot) boot.remove();
      document.body.appendChild(app.canvas);

      root = new PIXI.Container();
      app.stage.addChild(root);

      startShift(0);
      buildStatic();
      render();
      fit();
      window.addEventListener('resize', fit);

      app.ticker.add(function (ticker) {
        for (var i = anims.length - 1; i >= 0; i--) {
          var a = anims[i];
          a.t += ticker.deltaMS;
          var p = Math.min(a.t / a.d, 1);
          a.step(p);
          if (p >= 1) { if (a.done) a.done(); anims.splice(i, 1); }
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
