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

const run = async (pull) => page.evaluate(([pull, seeds]) => {
  const P = window.__proto;
  P.demandPull(pull);
  const rows = [];
  for (let shift = 0; shift < 3; shift++) {
    let wins = 0, freeSum = 0, tight = 0, moves = 0, lost = 0;
    const reasons = {};
    for (let s = 0; s < seeds; s++) {
      Object.keys(P.meta.up).forEach(k => { P.meta.up[k] = 0; });   // баланс без апгрейдов
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
      if (st.status === 'won') wins++;
      else {
        const why = st.tray.filter(Boolean).length === st.tray.length ? 'прилавок забит'
          : st.lost >= st.cfg.lives ? 'ушли покупатели' : 'завоз кончился';
        reasons[why] = (reasons[why] || 0) + 1;
      }
    }
    rows.push({ shift: shift + 1, slots: P.traySize(), wins: Math.round(wins / seeds * 100),
                free: +(freeSum / Math.max(1, moves)).toFixed(1),
                tight: Math.round(tight / Math.max(1, moves) * 100),
                lost: +(lost / seeds).toFixed(1), reasons });
  }
  return rows;
}, [pull, seeds]);

for (const [name, pull] of [['с подтягиванием (0.7)', 0.7], ['без подтягивания (0)', 0]]) {
  const rows = await run(pull);
  console.log('\n### ' + name);
  console.log('| Смена | Побед бота | Свободно слотов | Ходов «в тесноте» | Ушло покупателей |');
  console.log('|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.shift} | ${r.wins}% | ${r.free} из ${r.slots} | ${r.tight}% | ${r.lost} |`);
  }
  console.log('причины поражений:', JSON.stringify(rows.map(r => r.reasons)));
}

await browser.close();
