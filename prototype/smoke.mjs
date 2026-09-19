/*
 * Смоук-тест прототипа.
 *   npx http-server -p 8777 .        (из корня репозитория)
 *   node prototype/smoke.mjs http://127.0.0.1:8777
 */
const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const base = process.argv[2] || 'http://127.0.0.1:8777';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const fail = (msg) => { console.log('FAIL: ' + msg); process.exitCode = 1; };

await page.goto(base + '/prototype/index.html');
await page.waitForFunction(() => window.__proto, null, { timeout: 15000 });
console.log('boot ok');

// 1. стартовое состояние: прилавок на 7 слотов, очередь из 3 покупателей
const start = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 4242);
  const st = P.state;
  return { belt: st.belt.length, goal: st.goal, tray: P.traySize(),
           customers: st.customers.length, status: st.status };
});
console.log('shift1', JSON.stringify(start));
if (start.tray !== 12 || start.customers !== 3) fail('прилавок или очередь собраны неверно');

// 2. три одинаковых в своей зоне: продажа, бонус зоны, комбо
const triple = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 4242);
  const st = P.state;
  const home = { milk:'dairy',cheese:'dairy',yogurt:'dairy',butter:'dairy',
                 bread:'grocery',grain:'grocery',cookie:'grocery',can:'grocery',
                 apple:'produce',carrot:'produce',tomato:'produce',grape:'produce' };
  const target = st.belt[0];
  st.belt.unshift(target, target, target);     // тест про правило, а не про удачу
  let placed = 0;
  for (let n = 0; n < 3; n++) { P.select('belt', 0); if (P.place(home[target])) placed++; }
  return { target, placed, revenue: Math.round(st.revenue), combo: st.combo, tray: st.tray.filter(Boolean).length };
});
console.log('тройка в своей зоне', JSON.stringify(triple));
if (triple.revenue <= 0 || triple.combo < 1) fail('продажа в своей зоне не сработала');

// 3. заказ покупателя закрывается набором и двигает план
const order = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 777);
  const st = P.state;
  const c = st.customers[0];
  const before = st.served;
  // подкладываем весь набор в начало завоза — тест про заказ, а не про удачу
  const items = [];
  c.order.forEach(l => { for (let k = 0; k < l.n; k++) items.push(l.id); });
  st.belt.unshift(...items);
  for (let k = 0; k < items.length; k++) {
    const id = st.belt[0];
    P.select('belt', 0);
    P.place(P.section(id));
  }
  return { shape: c.order.map(l => l.id + '×' + l.n), servedBefore: before,
           servedAfter: st.served, revenue: Math.round(st.revenue) };
});
console.log('заказ', JSON.stringify(order));
if (order.servedAfter <= order.servedBefore) fail('набор покупателя не засчитался');
if (order.revenue <= 0) fail('заказ не принёс выручки');

// 4. смешанный набор (2+1) продаётся, хотя трёх одинаковых на полке нет
const mixed = await page.evaluate(() => {
  const P = window.__proto; P.startShift(1, 20260919);
  const st = P.state;
  const uniq = [...new Set(st.belt)];
  const a = uniq[0], b = uniq.find(id => id !== a);
  st.customers[0].order = [{ id: a, n: 2 }, { id: b, n: 1 }];
  st.customers.slice(1).forEach(c => { c.order = [{ id: a, n: 3 }]; c.patience = 9999; });
  const before = st.served;
  [a, a, b].forEach(id => { st.belt.unshift(id); P.select('belt', 0); P.place(P.section(id)); });
  return { a, b, servedBefore: before, servedAfter: st.served,
           onTray: st.tray.filter(Boolean).length, revenue: Math.round(st.revenue) };
});
console.log('смешанный набор', JSON.stringify(mixed));
if (mixed.servedAfter <= mixed.servedBefore) fail('набор 2+1 не продался');
if (mixed.onTray !== 0) fail('после продажи набора товар остался на полке');

// 5. срок годности: товар списывается, себестоимость уходит из выручки
const spoil = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 4242);
  const st = P.state;
  st.customers.forEach(c => { c.patience = 9999; });
  const first = st.belt[0];
  P.select('belt', 0); P.place(P.section(first));
  const slot = st.tray.findIndex(Boolean);
  const lifeStart = st.fresh[slot];
  st.revenue = 500;
  st.fresh[slot] = 1;                    // на следующем ходу этот товар просрочен
  const second = st.belt.find(id => id !== first && P.section(id) !== P.section(first));
  const idx = st.belt.indexOf(second);
  st.belt.unshift(st.belt.splice(idx, 1)[0]);
  P.select('belt', 0); P.place(P.section(second));
  return { lifeStart, spoiled: st.spoiled, writeOff: st.writeOff,
           revenue: Math.round(st.revenue), combo: st.combo };
});
console.log('срок годности', JSON.stringify(spoil));
if (!(spoil.lifeStart > 0)) fail('у выложенного товара нет срока годности');
if (spoil.spoiled !== 1 || spoil.writeOff <= 0) fail('просрочка не списалась');
if (spoil.revenue !== 500 - spoil.writeOff) fail('себестоимость не вычлась из выручки');

// 6. терпение: покупатель уходит, серия рвётся
const patience = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 31337);
  const st = P.state;
  st.customers.forEach(c => { c.patience = 1; });
  P.select('belt', 0);
  P.place(P.section(st.belt[0]));
  return { lost: st.lost, combo: st.combo, queue: st.customers.length };
});
console.log('терпение', JSON.stringify(patience));
if (patience.lost < 1) fail('покупатель не ушёл по истечении терпения');

// 7. проигрыш по забитому прилавку: последний свободный слот закрывает смену
const lose = await page.evaluate(() => {
  const P = window.__proto; P.startShift(2, 12345);
  const st = P.state;
  st.customers = [];                                  // проверяем именно забитый прилавок, без заказов
  const all = P.products();
  const zones = ['dairy','grocery','produce'];
  const zone = zones[0];
  const spare = all.find(id => P.section(id) === zone);
  const rest = all.filter(id => id !== spare);
  if (!spare || !rest.length) return { skipped: true };
  // забиваем все слоты кроме последнего в зоне запасного товара, троек не собираем
  const r = P.zoneRange(zone);
  const freeSlot = r.to - 1;
  // пары, без троек: тройка продалась бы сама и освободила полку
  const fill = [];
  rest.forEach(id => { fill.push(id, id); });
  for (let i = 0, k = 0; i < st.tray.length; i++) {
    if (i === freeSlot) continue;
    st.tray[i] = fill[k]; st.fresh[i] = 99; k++;                 // тест не про просрочку
  }
  const triples = all.some(id => st.tray.filter(t => t === id).length >= 3);
  const before = { status: st.status, free: st.tray.filter(c => c === null).length, triples };
  st.belt[0] = spare;
  P.select('belt', 0);
  P.place(zone);
  return { before, zone, spare, status: st.status,
           filled: st.tray.filter(Boolean).length, slots: st.tray.length };
});
console.log('проигрыш', JSON.stringify(lose));
if (lose.skipped) fail('тест собран неверно: не нашлось запасного товара');
if (lose.before.free !== 1 || lose.before.triples) fail('тест собран неверно: прилавок собран с тройкой или не полон');
if (lose.status !== 'lost' || lose.filled !== lose.slots) fail('смена не проигрывается при забитом прилавке');

// 8. товар не ложится в чужую зону
const zoning = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 4242);
  const st = P.state;
  const id = st.belt[0];
  const own = P.section(id);
  const alien = ['dairy','grocery','produce'].find(z => z !== own);
  P.select('belt', 0);
  const refused = P.place(alien);
  const afterAlien = st.tray.filter(Boolean).length;
  const accepted = P.place(own);
  return { id, own, alien, refused, afterAlien, accepted,
           afterOwn: st.tray.filter(Boolean).length,
           inOwnZone: P.section(st.tray.find(Boolean)) === own,
           selectionKept: afterAlien === 0 };
});
console.log('зоны', JSON.stringify(zoning));
if (zoning.refused !== false || zoning.afterAlien !== 0) fail('товар лёг в чужую зону');
if (zoning.accepted !== true || zoning.afterOwn !== 1 || !zoning.inOwnZone) fail('товар не лёг в свою зону');

// 9. тупик: своя зона забита, выложить нечего и нечем — смена закрывается
const stuck = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 4242);
  const st = P.state;
  st.customers = [];                                  // тупик проверяем без заказов
  st.boosters.undo = 0; st.boosters.fridge = 0; st.boosters.shuffle = 0;
  const zones = ['dairy','grocery','produce'];
  const byZone = z => [...new Set(st.belt)].filter(id => P.section(id) === z);
  const zone = zones.find(z => byZone(z).length >= 2);
  if (!zone) return { skipped: true };
  const ids = byZone(zone);
  const r = P.zoneRange(zone);
  // забиваем зону, оставляя один слот и не собирая тройку
  for (let i = r.from, k = 0; i < r.to - 1; i++, k++) { st.tray[i] = ids[k % 2]; st.fresh[i] = 99; }
  const last = ids.find(id => st.tray.filter(t => t === id).length < 2);
  if (!last) return { skipped: true };
  st.belt = st.belt.filter(id => P.section(id) === zone);   // на завозе только эта зона
  st.belt.unshift(last);
  const before = { free: st.tray.filter(c => c === null).length, status: st.status };
  P.select('belt', 0);
  P.place(zone);                                            // последний слот зоны закрывается
  return { zone, last, before, status: st.status, free: st.tray.filter(c => c === null).length };
});
console.log('тупик', JSON.stringify(stuck));
if (stuck.skipped) fail('тест собран неверно: не нашлось зоны с двумя типами товара');
if (stuck.before.status !== 'playing') fail('тест собран неверно: смена уже кончилась');
if (stuck.status !== 'lost') fail('смена зависла: выложить нечего, но проигрыша нет');

// 10. бот проходит первую смену на большинстве сидов
const auto = await page.evaluate(() => {
  const P = window.__proto;
  const runs = [];
  for (const seed of [4242, 77, 1234, 909, 31337]) {
    P.startShift(0, seed);
    let steps = 0;
    while (P.state.status === 'playing' && steps < 400) { if (!P.autoStep()) break; steps++; }
    runs.push({ seed, steps, status: P.state.status, served: P.state.served, goal: P.state.goal });
  }
  P.startShift(0, 4242);
  let steps = 0;
  while (P.state.status === 'playing' && steps < 400) { if (!P.autoStep()) break; steps++; }
  return { runs, wins: runs.filter(r => r.status === 'won').length,
           lastRevenue: Math.round(P.state.revenue), streak: P.streak };
});
console.log('автопрохождение', JSON.stringify({ wins: auto.wins, runs: auto.runs.map(r => r.status) }));
if (auto.wins < 3) fail('бот закрывает первую смену реже чем на трёх сидах из пяти');

// 11. мета: выручка в кассе, апгрейд прилавка расширяет его
const metaCheck = await page.evaluate(() => {
  const P = window.__proto;
  const walletAfterWin = Math.round(P.meta.wallet);
  P.meta.wallet = 99999;
  const before = { tray: P.traySize(), belt: P.beltVisible(), fridge: P.fridgeSize() };
  const bought = [P.buy('counter'), P.buy('cart'), P.buy('fridge'), P.buy('cash')];
  P.startShift(1);
  return { walletAfterWin, bought,
           trayGrew: P.traySize() > before.tray,
           beltGrew: P.beltVisible() > before.belt,
           fridgeGrew: P.fridgeSize() > before.fridge,
           boosters: P.state.boosters };
});
console.log('мета', JSON.stringify(metaCheck));
if (metaCheck.walletAfterWin <= 0) fail('выручка не попала в кассу');
if (!metaCheck.trayGrew || !metaCheck.beltGrew || !metaCheck.fridgeGrew || metaCheck.boosters.undo !== 2)
  fail('апгрейды не применились к смене');

// 12. поздние смены остаются решаемыми
const endless = await page.evaluate(() => {
  const P = window.__proto;
  P.startShift(19);
  const c = P.state.cfg;
  return { crates: c.crates, goal: c.goal, patience: c.patience,
           solvable: Math.floor(c.crates / 3) >= c.goal, mod3: c.crates % 3 === 0 };
});
console.log('бесконечные смены', JSON.stringify(endless));
if (!endless.solvable || !endless.mod3) fail('поздние смены нерешаемы');

// 13. нужный товар подтягивается из глубины завоза, состав завоза не меняется
const demand = await page.evaluate(() => {
  const P = window.__proto; P.startShift(1, 9001);
  const st = P.state;
  // один покупатель с одной позицией — так видно, что подтянулся именно нужный товар
  const want = [...new Set(st.belt)][0];
  st.customers = [{ order: [{ id: want, n: 3 }], patience: 99, max: 99, face: 0 }];
  const need = [want];
  const n = P.beltVisible();
  // прячем всё заказанное сразу за видимым окном — под рукой нужного не осталось
  const deep = st.belt.filter(id => need.includes(id));
  const rest = st.belt.filter(id => !need.includes(id));
  st.belt.length = 0;
  rest.slice(0, n).forEach(id => st.belt.push(id));
  deep.forEach(id => st.belt.push(id));
  rest.slice(n).forEach(id => st.belt.push(id));
  const before = st.belt.slice().sort().join(',');
  const seen = () => st.belt.slice(0, n).some(id => need.includes(id));
  const visibleBefore = seen();
  let pulls = 0;
  for (let k = 0; k < 8; k++) if (P.pullDemanded()) pulls++;
  return { need, visibleBefore, pulls, visibleAfter: seen(),
           sameComposition: before === st.belt.slice().sort().join(','), len: st.belt.length };
});
console.log('подтягивание нужного', JSON.stringify(demand));
if (demand.visibleBefore) fail('тест собран неверно: заказанное и так было видно');
if (!demand.visibleAfter || demand.pulls < 1) fail('нужный товар не подтянулся к началу завоза');
if (demand.pulls > 1) fail('подтягивание сработало повторно, хотя нужное уже под рукой');
if (!demand.sameComposition) fail('состав завоза изменился — смена может стать нерешаемой');

// 14. журнал плейтеста: события смены, сводка, выгрузка и панель
const journal = await page.evaluate(() => {
  const P = window.__proto;
  P.log.clear();
  P.startShift(0, 4242);
  let steps = 0;
  let undone = false;
  while (P.state.status === 'playing' && steps < 400) {
    // «Вернуть» должно попасть в журнал; после продажи возвращать нечего, поэтому пробуем до успеха
    if (!undone && steps > 2 && P.booster.undo()) undone = true;
    if (!P.autoStep()) break;
    steps++;
  }
  const ev = P.log.events;
  const end = ev.filter(e => e.type === 'shift_end')[0] || null;
  const booster = ev.filter(e => e.type === 'booster')[0] || null;
  let parsed = null;
  try { parsed = JSON.parse(P.log.text()); } catch (e) {}
  P.log.panel();
  const panelOpen = !!document.querySelector('textarea');
  P.log.hidePanel();
  return { start: ev.some(e => e.type === 'shift_start'), end, booster,
           summary: P.log.summary(), panelOpen, panelClosed: !document.querySelector('textarea'),
           textOk: !!(parsed && parsed.summary && Array.isArray(parsed.events)) };
});
console.log('журнал', JSON.stringify({ shifts: journal.summary.shifts, moves: journal.end && journal.end.moves,
  home: journal.end && journal.end.home, homeRate: journal.summary.homeRate, undo: journal.summary.undo }));
if (!journal.start || !journal.end) fail('смена не попала в журнал плейтеста');
if (!(journal.end.moves > 0) || journal.end.home > journal.end.moves) fail('выкладки посчитаны неверно');
if (journal.summary.shifts !== 1 || journal.summary.undo !== 1) fail('сводка журнала не сходится');
if (!journal.booster || journal.booster.kind !== 'undo' || typeof journal.booster.filled !== 'number')
  fail('бустер записан без контекста');
if (!journal.textOk) fail('выгрузка журнала не разбирается как JSON');
if (!journal.panelOpen || !journal.panelClosed) fail('панель журнала не открывается или не закрывается');

// 15. журнал переживает перезагрузку — плейтест идёт в несколько заходов
await page.reload();
await page.waitForFunction(() => window.__proto, null, { timeout: 15000 });
const persisted = await page.evaluate(() => {
  const P = window.__proto;
  return { shifts: P.log.summary().shifts, boot: P.log.events.some(e => e.type === 'boot') };
});
console.log('журнал после перезагрузки', JSON.stringify(persisted));
if (persisted.shifts !== 1 || !persisted.boot) fail('журнал не пережил перезагрузку');

// 16. новая сборка сносит прогресс, та же сборка — сохраняет
const build = await page.evaluate(() => window.__proto.build);
await page.evaluate(() => {
  localStorage.setItem('shopsort.meta', JSON.stringify({
    build: 'прошлая-сборка', wallet: 5000, shiftIdx: 4, streak: 3, total: 9000,
    up: { counter: 2, fridge: 1, cart: 1, cash: 1, sign: 1 }
  }));
});
await page.reload();
await page.waitForFunction(() => window.__proto, null, { timeout: 15000 });
const reset = await page.evaluate(() => {
  const P = window.__proto;
  return { wallet: P.meta.wallet, shiftIdx: P.meta.shiftIdx, counter: P.meta.up.counter,
           streak: P.streak, stored: JSON.parse(localStorage.getItem('shopsort.meta')).build,
           logged: P.log.events.some(e => e.type === 'build_reset') };
});
console.log('сброс по сборке', JSON.stringify(reset));
if (reset.wallet !== 0 || reset.shiftIdx !== 0 || reset.counter !== 0 || reset.streak !== 0)
  fail('прогресс прошлой сборки не сброшен');
if (reset.stored !== build) fail('отметка новой сборки не сохранена');
if (!reset.logged) fail('сброс по сборке не попал в журнал');

await page.evaluate(() => { window.__proto.meta.wallet = 9999; window.__proto.buy('counter'); });
await page.reload();
await page.waitForFunction(() => window.__proto, null, { timeout: 15000 });
const kept = await page.evaluate(() => ({ counter: window.__proto.meta.up.counter }));
console.log('та же сборка', JSON.stringify(kept));
if (kept.counter !== 1) fail('прогресс той же сборки не пережил перезагрузку');

await page.screenshot({ path: '/tmp/smoke-final.png' });
await browser.close();
console.log('ошибки в консоли:', errors.length ? errors : 'нет');
if (errors.length) fail('есть ошибки в консоли');
if (!process.exitCode) console.log('ALL CHECKS PASSED');
