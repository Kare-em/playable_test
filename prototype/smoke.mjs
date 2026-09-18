/*
 * Смоук-тест прототипа: npx playwright нужен локально.
 *   npx http-server -p 8777 .   (из корня репозитория)
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

await page.goto(base + '/prototype/index.html');
await page.waitForFunction(() => window.__proto, null, { timeout: 15000 });
console.log('boot ok');

// 1. базовое состояние
let s = await page.evaluate(() => {
  const st = window.__proto.state;
  return { belt: st.belt.length, goal: st.goal, types: st.cfg.types, status: st.status };
});
console.log('shift1 state', JSON.stringify(s));

// 2. ручной сценарий: собрать тройку в «своей» секции
const manual = await page.evaluate(() => {
  const P = window.__proto, st = P.state;
  const target = st.belt[0];
  const home = { milk:'dairy', cheese:'dairy', yogurt:'dairy', butter:'dairy',
                 bread:'grocery', grain:'grocery', cookie:'grocery', can:'grocery',
                 apple:'produce', carrot:'produce', tomato:'produce', grape:'produce' }[target];
  let placed = 0, guard = 0;
  while (placed < 3 && guard++ < 60) {
    const idx = st.belt.slice(0, 5).indexOf(target);
    if (idx === -1) { // сдвигаем ленту нейтральной выкладкой
      P.select('belt', 0);
      const other = ['dairy','grocery','produce'].find(x => x !== home && st.shelf[x].includes(null));
      if (!other || !P.place(other)) break;
      continue;
    }
    P.select('belt', idx);
    if (!P.place(home)) break;
    placed++;
  }
  return { target, home, placed, revenue: Math.round(st.revenue), sold: st.sold, combo: st.combo };
});
console.log('manual triple', JSON.stringify(manual));
await page.screenshot({ path: '/tmp/shot-mid.png' });

// 3. автобот добивает смену
const auto = await page.evaluate(async () => {
  const P = window.__proto;
  P.startShift(0, 4242);           // чистая смена: проверяем именно путь к победе
  let steps = 0;
  while (P.state.status === 'playing' && steps < 400) { if (!P.autoStep()) break; steps++; }
  return { steps, status: P.state.status, sold: P.state.sold, goal: P.state.goal,
           revenue: Math.round(P.state.revenue), streak: P.streak };
});
console.log('autoplay', JSON.stringify(auto));
await page.screenshot({ path: '/tmp/shot-result.png' });

// 4. переход на следующую смену
const next = await page.evaluate(() => {
  window.__proto.nextShift();
  const st = window.__proto.state;
  return { shift: st.shiftIdx + 1, types: st.cfg.types, goal: st.goal, sale: st.saleProduct, status: st.status };
});
console.log('next shift', JSON.stringify(next));

// 5. бустеры
const boosters = await page.evaluate(() => {
  const P = window.__proto, st = P.state;
  P.select('belt', 0); const toFridge = P.booster.fridge();
  const fridgeLen = st.fridge.length;
  P.select('belt', 0); P.place('dairy');
  const undone = P.booster.undo();
  const shuffled = P.booster.shuffle();
  return { toFridge, fridgeLen, undone, shuffled, left: st.boosters };
});
console.log('boosters', JSON.stringify(boosters));

// 6. проигрыш: забиваем стеллаж заведомо разными товарами
const lose = await page.evaluate(() => {
  const P = window.__proto;
  P.startShift(2, 12345);
  const st = P.state;
  let guard = 0;
  while (st.status === 'playing' && guard++ < 40) {
    const sec = ['dairy','grocery','produce'].find(x => st.shelf[x].includes(null));
    if (!sec) break;
    // кладём первый попавшийся товар, не совпадающий с уже лежащими в секции
    const visible = st.belt.slice(0, 5);
    let idx = visible.findIndex(p => !st.shelf[sec].includes(p));
    if (idx === -1) idx = 0;
    P.select('belt', idx);
    if (!P.place(sec)) break;
  }
  return { status: st.status, filled: ['dairy','grocery','produce'].map(x => st.shelf[x].filter(Boolean).length) };
});
console.log('lose path', JSON.stringify(lose));
await page.screenshot({ path: '/tmp/shot-lose.png' });

await browser.close();
console.log('console errors:', errors.length ? errors : 'none');
if (errors.length) process.exit(1);
if (auto.status !== 'won') { console.log('FAIL: autoplay did not win'); process.exit(1); }
if (manual.sold < 1) { console.log('FAIL: manual triple did not sell'); process.exit(1); }
if (lose.status !== 'lost') { console.log('FAIL: lose condition not reached'); process.exit(1); }
console.log('ALL CHECKS PASSED');
