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
if (start.tray !== 9 || start.customers !== 3) fail('прилавок или очередь собраны неверно');

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
  P.place('grocery');
  return { lost: st.lost, combo: st.combo, queue: st.customers.length };
});
console.log('терпение', JSON.stringify(patience));
if (patience.lost < 1) fail('покупатель не ушёл по истечении терпения');

// 5. проигрыш: прилавок забит разными товарами
const lose = await page.evaluate(() => {
  const P = window.__proto; P.startShift(2, 12345);
  const st = P.state;
  let guard = 0;
  while (st.status === 'playing' && guard++ < 60) {
    const zones = ['dairy','grocery','produce'];
    let done = false;
    for (const z of zones) {
      const r = P.zoneRange(z);
      let free = false;
      for (let i = r.from; i < r.to; i++) if (st.tray[i] === null) free = true;
      if (!free) continue;
      const vis = st.belt.slice(0, P.beltVisible());
      let idx = vis.findIndex(p => !st.tray.includes(p));
      if (idx === -1) idx = 0;
      P.select('belt', idx);
      done = P.place(z);
      break;
    }
    if (!done) break;
  }
  return { status: st.status, filled: st.tray.filter(Boolean).length };
});
console.log('проигрыш', JSON.stringify(lose));
if (lose.status !== 'lost') fail('смена не проигрывается при забитом прилавке');

// 6. бот проходит смену целиком
const auto = await page.evaluate(() => {
  const P = window.__proto; P.startShift(0, 4242);
  let steps = 0;
  while (P.state.status === 'playing' && steps < 400) { if (!P.autoStep()) break; steps++; }
  return { steps, status: P.state.status, served: P.state.served, goal: P.state.goal,
           revenue: Math.round(P.state.revenue), streak: P.streak };
});
console.log('автопрохождение', JSON.stringify(auto));
if (auto.status !== 'won') fail('бот не смог закрыть первую смену');

// 7. мета: выручка в кассе, апгрейд прилавка расширяет его
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

// 8. поздние смены остаются решаемыми
const endless = await page.evaluate(() => {
  const P = window.__proto;
  P.startShift(19);
  const c = P.state.cfg;
  return { crates: c.crates, goal: c.goal, patience: c.patience,
           solvable: Math.floor(c.crates / 3) >= c.goal, mod3: c.crates % 3 === 0 };
});
console.log('бесконечные смены', JSON.stringify(endless));
if (!endless.solvable || !endless.mod3) fail('поздние смены нерешаемы');

// 9. журнал плейтеста: события смены, сводка, выгрузка и панель
const journal = await page.evaluate(() => {
  const P = window.__proto;
  P.log.clear();
  P.startShift(0, 4242);
  let steps = 0;
  while (P.state.status === 'playing' && steps < 400) {
    if (steps === 3) P.booster.undo();          // тяга к «Вернуть» должна попасть в журнал
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

// 10. журнал переживает перезагрузку — плейтест идёт в несколько заходов
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
