/*
 * Скриншоты для карточки игры на Яндекс Играх.
 *   node tools/shots.mjs
 *
 * Снимаются с настоящей сборки dist/yandex/index.html, а не рисуются: этого
 * прямо требует docs/art-assets.md (строка E2), и это же страхует от карточки,
 * которая обещает не то, что игрок увидит.
 *
 * Размер 720x1280 — портретная сцена игры. Точные требования площадки к числу
 * и размеру кадров сверяются в консоли разработчика, здесь даётся набор,
 * который покрывает типовой запрос «5–8 штук».
 *
 * Результат: dist/store/shot-1..5.png
 */
import { mkdir, rm } from 'node:fs/promises';

const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const out = new URL('../dist/store/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(new URL('../dist/yandex/index.html', import.meta.url).href);
await page.waitForFunction(() => window.__proto, null, { timeout: 20000 });
await page.waitForTimeout(1800);

const shot = async (n, note) => {
  await page.screenshot({ path: new URL('shot-' + n + '.png', out).pathname });
  console.log('shot-' + n + '.png —', note);
};

// 1. Начало смены: видно прилавок, очередь и завоз
await shot(1, 'старт смены: прилавок, очередь, завоз');

// 2. Разгар: товар разложен по отделам, заказы частично собраны
await page.evaluate(async () => {
  const P = window.__proto, s = P.state;
  for (let n = 0; n < 6; n++) {
    const id = s.belt[0];
    if (!id) break;
    P.select('belt', 0);
    P.place(P.section(id));
    await new Promise((r) => setTimeout(r, 260));
  }
});
await page.waitForTimeout(900);
await shot(2, 'разгар смены: товар по отделам, заказы собираются');

// 3. Акция дня на конкретном товаре — видно механику бонуса
await page.evaluate(async () => {
  const P = window.__proto, s = P.state;
  if (s.belt[0]) s.saleProduct = s.belt[0];
  for (let n = 0; n < 4; n++) {
    const id = s.belt[0];
    if (!id) break;
    P.select('belt', 0);
    P.place(P.section(id));
    await new Promise((r) => setTimeout(r, 260));
  }
});
await page.waitForTimeout(900);
await shot(3, 'акция дня и бустеры');

// 4. Магазин апгрейдов — показывает мета-слой
await page.evaluate(() => { window.__proto.meta.wallet = 5000; window.__proto.shop(); });
await page.waitForTimeout(900);
await shot(4, 'магазин: апгрейды точки');

// 5. Итог смены — выручка и план
await page.evaluate(async () => {
  const P = window.__proto, s = P.state;
  for (let n = 0; n < 60 && s.status === 'playing'; n++) {
    try { P.autoStep(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 90));
  }
});
await page.waitForTimeout(1200);
await shot(5, 'итог смены: выручка и план');

await browser.close();
console.log(errors.length ? 'ОШИБКИ: ' + errors.join(' | ') : 'ошибок нет');
console.log('готово: dist/store/ — загружать в карточку игры в консоли разработчика');
