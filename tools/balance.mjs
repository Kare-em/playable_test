/*
 * Замер баланса жадным ботом: 40 сидов на смену, без бустеров и апгрейдов.
 *   npx http-server -p 8777 .
 *   node tools/balance.mjs http://127.0.0.1:8777
 * Печатает таблицу для prototype/README.md — с подтягиванием нужного товара
 * и без него, чтобы видеть вклад самого правила.
 */
const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const base = process.argv[2] || 'http://127.0.0.1:8777';
const seeds = 40;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
await page.goto(base + '/prototype/index.html');
await page.waitForFunction(() => window.__proto, null, { timeout: 15000 });

const run = async (pull, buyAll) => page.evaluate(([pull, seeds, buyAll]) => {
  const P = window.__proto;
  P.demandPull(pull);
  P.log.clear();
  const rows = [];
  for (let shift = 0; shift < 3; shift++) {
    let wins = 0, freeSum = 0, tight = 0, moves = 0, lost = 0, spoiled = 0, writeOff = 0, revenue = 0;
    const reasons = {};
    for (let s = 0; s < seeds; s++) {
      Object.keys(P.meta.up).forEach(k => { P.meta.up[k] = 0; });   // баланс без апгрейдов
      if (buyAll) { P.meta.wallet = 999999; P.buy('produce'); P.buy('meat'); P.buy('chem'); }
      P.startShift(shift, 1000 + s * 37);
      const st = P.state;
      let guard = 0;
      while (st.status === 'playing' && guard++ < 400) {
        if (!P.autoStep()) break;
        const free = st.tray.filter(c => c === null).length;
        freeSum += free; moves++;
        if (free <= 1) tight++;                                      // ходы «в тесноте»
      }
      lost += st.lost;
      spoiled += st.spoiled; writeOff += st.writeOff; revenue += st.revenue;
      if (st.status === 'won') wins++;
      else {
        // причину знает сама игра — берём её из журнала, а не угадываем по состоянию
        const ends = P.log.events.filter(e => e.type === 'shift_end');
        const why = (ends[ends.length - 1] || {}).reason || 'план не выполнен';
        reasons[why] = (reasons[why] || 0) + 1;
      }
    }
    rows.push({ shift: shift + 1, slots: P.traySize(), wins: Math.round(wins / seeds * 100),
                free: +(freeSum / Math.max(1, moves)).toFixed(1),
                tight: Math.round(tight / Math.max(1, moves) * 100),
                lost: +(lost / seeds).toFixed(1),
                spoiled: +(spoiled / seeds).toFixed(1),
                writeOff: Math.round(writeOff / seeds),
                revenue: Math.round(revenue / seeds), reasons });
  }
  return rows;
}, [pull, seeds, buyAll]);

for (const [name, pull, buyAll] of [
  ['два отдела, разбор по позициям', 0.35, false],
  ['все отделы, только целая корзина', 0.35, true],
  ['два отдела без подтягивания', 0, false]
]) {
  const rows = await run(pull, buyAll);
  console.log('\n### ' + name);
  console.log('| Смена | Побед бота | Свободно слотов | Ушло покупателей | Списано | Выручка |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.shift} | ${r.wins}% | ${r.free} из ${r.slots} | ${r.lost} | ${r.spoiled} шт · ${r.writeOff} ₽ | ${r.revenue} ₽ |`);
  }
  console.log('причины поражений:', JSON.stringify(rows.map(r => r.reasons)));
}

await browser.close();
