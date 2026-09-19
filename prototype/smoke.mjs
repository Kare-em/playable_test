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

// 3. заказ покупателя закрывается продажей и двигает план
const order = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 777);
  const st = P.state;
  const want = st.customers[0].productId;
  const zone = { milk:'dairy',cheese:'dairy',yogurt:'dairy',butter:'dairy',
                 bread:'grocery',grain:'grocery',cookie:'grocery',can:'grocery',
                 apple:'produce',carrot:'produce',tomato:'produce',grape:'produce' }[want];
  const before = st.served;
  // подкладываем нужный товар в начало завоза — тест про заказ, а не про удачу
  st.belt.unshift(want, want, want);
  for (let n = 0; n < 3; n++) { P.select('belt', 0); P.place(zone); }
  return { want, servedBefore: before, servedAfter: st.served, revenue: Math.round(st.revenue) };
});
console.log('заказ', JSON.stringify(order));
if (order.servedAfter <= order.servedBefore) fail('заказ покупателя не засчитался');

// 4. терпение: покупатель уходит, серия рвётся
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

// 5. проигрыш по забитому прилавку: последний свободный слот закрывает смену
const lose = await page.evaluate(() => {
  const P = window.__proto; P.startShift(2, 12345);
  const st = P.state;
  st.customers.forEach(c => { c.patience = 9999; });   // проверяем именно забитый прилавок
  const uniq = [...new Set(st.belt)];
  const zones = ['dairy','grocery','produce'];
  const zone = zones.find(z => uniq.some(id => P.section(id) === z));
  const spare = uniq.find(id => P.section(id) === zone);
  const rest = uniq.filter(id => id !== spare);
  if (!spare || !rest.length) return { skipped: true };
  // забиваем все слоты кроме последнего в зоне запасного товара, троек не собираем
  const r = P.zoneRange(zone);
  const freeSlot = r.to - 1;
  for (let i = 0, k = 0; i < st.tray.length; i++) {
    if (i === freeSlot) continue;
    st.tray[i] = rest[k % rest.length]; k++;
  }
  const triples = uniq.some(id => st.tray.filter(t => t === id).length >= 3);
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

// 6. товар не ложится в чужую зону
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

// 7. тупик: своя зона забита, выложить нечего и нечем — смена закрывается
const stuck = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 4242);
  const st = P.state;
  st.customers.forEach(c => { c.patience = 9999; });
  st.boosters.undo = 0; st.boosters.fridge = 0; st.boosters.shuffle = 0;
  const zones = ['dairy','grocery','produce'];
  const byZone = z => [...new Set(st.belt)].filter(id => P.section(id) === z);
  const zone = zones.find(z => byZone(z).length >= 2);
  if (!zone) return { skipped: true };
  const ids = byZone(zone);
  const r = P.zoneRange(zone);
  // забиваем зону, оставляя один слот и не собирая тройку
  for (let i = r.from, k = 0; i < r.to - 1; i++, k++) st.tray[i] = ids[k % 2];
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

// 8. бот проходит первую смену на большинстве сидов
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

// 9. мета: выручка в кассе, апгрейд прилавка расширяет его
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

// 10. поздние смены остаются решаемыми
const endless = await page.evaluate(() => {
  const P = window.__proto;
  P.startShift(19);
  const c = P.state.cfg;
  return { crates: c.crates, goal: c.goal, patience: c.patience,
           solvable: Math.floor(c.crates / 3) >= c.goal, mod3: c.crates % 3 === 0 };
});
console.log('бесконечные смены', JSON.stringify(endless));
if (!endless.solvable || !endless.mod3) fail('поздние смены нерешаемы');

// 11. нужный товар подтягивается из глубины завоза, состав завоза не меняется
const demand = await page.evaluate(() => {
  const P = window.__proto; P.startShift(1, 9001);
  const st = P.state;
  const need = st.customers.map(c => c.productId);
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

// 12. журнал плейтеста: события смены, сводка, выгрузка и панель
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

// 13. журнал переживает перезагрузку — плейтест идёт в несколько заходов
await page.reload();
await page.waitForFunction(() => window.__proto, null, { timeout: 15000 });
const persisted = await page.evaluate(() => {
  const P = window.__proto;
  return { shifts: P.log.summary().shifts, boot: P.log.events.some(e => e.type === 'boot') };
});
console.log('журнал после перезагрузки', JSON.stringify(persisted));
if (persisted.shifts !== 1 || !persisted.boot) fail('журнал не пережил перезагрузку');

await page.screenshot({ path: '/tmp/smoke-final.png' });
await browser.close();
console.log('ошибки в консоли:', errors.length ? errors : 'нет');
if (errors.length) fail('есть ошибки в консоли');
if (!process.exitCode) console.log('ALL CHECKS PASSED');
