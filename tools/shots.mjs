/*
 * Скриншоты для карточки игры на Яндекс Играх.
 *   node tools/shots.mjs
 *
 * Снимаются с настоящей сборки dist/yandex/index.html, а не рисуются: этого
 * требует docs/art-assets.md (строка E2), и это же страхует от карточки,
 * которая обещает не то, что игрок увидит.
 *
 * Два набора, русский и английский: карточка заполняется на обоих языках,
 * и скриншоты с чужими подписями там смотрятся браком.
 *
 * Все кадры — игровой экран. Требования площадки просят, чтобы скриншот
 * показывал геймплей не менее чем на 70% изображения, поэтому магазин
 * апгрейдов и окно итогов сюда не попадают: они закрывают поле панелью.
 * Перед каждым кадром выдерживается пауза, чтобы всплывающие эффекты и
 * тосты успели погаснуть — иначе они лезут в кадр случайным мусором.
 *
 * Размер 720x1280 — портретная сцена игры. Точное число и размер кадров
 * сверяются в форме черновика.
 *
 * Результат: dist/store/ru/shot-1..5.png и dist/store/en/shot-1..5.png
 */
import { mkdir, rm } from 'node:fs/promises';

const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const SETTLE = 2600;          // столько живут попап заказа и тост списания

async function series(locale, dir) {
  const out = new URL('../dist/store/' + dir + '/', import.meta.url);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1, locale });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(new URL('../dist/yandex/index.html', import.meta.url).href);
  await page.waitForFunction(() => window.__proto, null, { timeout: 20000 });
  await page.waitForTimeout(2000);

  const lang = await page.evaluate(() => window.I18N.get());
  const shot = async (n, note) => {
    await page.waitForTimeout(SETTLE);
    await page.screenshot({ path: new URL('shot-' + n + '.png', out).pathname });
    console.log(`  ${dir}/shot-${n}.png — ${note}`);
  };
  // Обычная игра: кладём первый товар с завоза и обслуживаем очередь, чтобы
  // смена шла своим ходом и не сорвалась прямо в кадре.
  const play = (n, gap) => page.evaluate(async ({ n, gap }) => {
    const P = window.__proto, s = P.state;
    for (let i = 0; i < n; i++) {
      const id = s.belt[0];
      if (!id || s.status !== 'playing') break;
      P.select('belt', 0);
      P.place(P.section(id));
      await new Promise((r) => setTimeout(r, gap));
    }
  }, { n, gap });

  // Витрина: прилавок должен выглядеть рабочим, а покупатели разбирают товар
  // быстрее, чем он копится, — доиграть до полной полки нельзя. Раскладываем
  // товар по своим отделам напрямую: состояние настоящее и отрисовано игрой,
  // просто поставлено, а не достигнуто игрой.
  const stock = () => page.evaluate(() => {
    const P = window.__proto, s = P.state;
    ['dairy', 'grocery', 'produce', 'meat', 'chem'].forEach((z) => {
      var r;
      try { r = P.zoneRange(z); } catch (e) { return; }
      if (!r || r.to <= r.from) return;
      const pool = P.products().filter((id) => P.section(id) === z);
      if (!pool.length) return;
      for (let i = r.from; i < r.to - 1; i++) {      // одну ячейку оставляем свободной
        s.tray[i] = pool[(i - r.from) % pool.length];
        s.fresh[i] = 6;
      }
    });
    P.select('belt', 0); P.select('belt', 0);        // перерисовка без изменения хода
  });

  console.log(`локаль ${locale} -> язык игры ${lang}`);
  await shot(1, 'старт смены: прилавок, очередь, завоз');

  await play(5, 260);
  await stock();
  await shot(2, 'разгар смены: товар по отделам, заказы собираются');

  await page.evaluate(() => { const s = window.__proto.state; if (s.belt[0]) s.saleProduct = s.belt[0]; });
  await play(3, 260);
  await stock();
  await shot(3, 'акция дня на полке и бустеры смены');

  // прокачанная точка: открыты овощи и мясо, отделов на прилавке больше
  await page.evaluate(async () => {
    const P = window.__proto;
    P.meta.up.produce = 1; P.meta.up.meat = 1; P.meta.up.counter = 1;
    P.startShift(2);
    await new Promise((r) => setTimeout(r, 400));
  });
  await play(4, 220);
  await stock();
  await shot(4, 'прокачанная точка: больше отделов на прилавке');

  await play(3, 220);
  await stock();
  await shot(5, 'плотная смена: очередь и заполненный прилавок');

  if (errors.length) console.log('  ОШИБКИ: ' + errors.join(' | '));
  await browser.close();
}

await series('ru-RU', 'ru');
await series('en-US', 'en');
console.log('\nготово: dist/store/ru и dist/store/en — загружать в карточку игры');
