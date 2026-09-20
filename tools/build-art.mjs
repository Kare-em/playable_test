/*
 * Вшивает растровый арт в игру как data-URI: ни одного внешнего запроса
 * (требование модерации Яндекс Игр) и работает даже с file://.
 *   node tools/build-art.mjs
 *
 * Источник — art/ready/ (сгенерированное и ужатое), а не векторные примитивы
 * из art/products.mjs: те остались для растеризации карточки игры в PNG
 * (tools/render-art.mjs) и как запасной вариант, если ассет не собрался.
 *
 * Размеры под экран, а не под исходник: иконка товара живёт на сетке ~100x100,
 * бюст покупателя рисуется радиусом максимум 28 px. Класть в сборку 512-пиксельные
 * текстуры — это лишние сотни килобайт в файле, который грузится по мобильной сети.
 */
import { writeFile, readFile, access } from 'node:fs/promises';
import { ORDER } from '../art/products.mjs';

const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const readyDir = new URL('../art/ready/', import.meta.url);
const exists = async (u) => access(u).then(() => true, () => false);

// Типажи покупателей из PEOPLE в game.js и подходящие им бюсты. Ключ здесь —
// id типажа, чтобы соответствие читалось в одном месте, а не угадывалось.
const BUSTS = ['dacha', 'handyman', 'pensioner', 'student', 'neighbor', 'mom', 'taxi', 'schoolboy'];

const PLAN = [
  ...ORDER.map((id) => ({ key: id, file: `product-${id}.webp`, max: 256 })),
  ...BUSTS.map((who) => ({ key: `bust-${who}`, file: `bust-${who}.webp`, max: 192 }))
];

const browser = await chromium.launch();
const page = await browser.newPage();

/** Ужимает под экранный размер и переупаковывает; половинные шаги берегут контур. */
const fit = (dataUri, max) => page.evaluate(async ({ dataUri, max }) => {
  const img = new Image();
  img.src = dataUri;
  await img.decode();
  const k = Math.min(max / Math.max(img.width, img.height), 1);
  let w = img.width, h = img.height, cur = img;
  while (w * 0.5 > img.width * k) {
    w = Math.max(Math.round(w * 0.5), Math.round(img.width * k));
    h = Math.max(Math.round(h * 0.5), Math.round(img.height * k));
    const step = document.createElement('canvas');
    step.width = w; step.height = h;
    const c = step.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(cur, 0, 0, w, h);
    cur = step;
  }
  const out = document.createElement('canvas');
  out.width = Math.round(img.width * k); out.height = Math.round(img.height * k);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, out.width, out.height);
  return out.toDataURL('image/webp', 0.86);
}, { dataUri, max });

const entries = [];
const missing = [];
for (const { key, file, max } of PLAN) {
  const src = new URL(file, readyDir);
  if (!await exists(src)) { missing.push(file); continue; }
  const raw = await readFile(src);
  const uri = await fit(`data:image/webp;base64,${raw.toString('base64')}`, max);
  entries.push([key, uri]);
}
await browser.close();

const body = entries.map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n');
const out = `/* Сгенерировано tools/build-art.mjs из art/ready/ — не править руками. */\n`
  + `window.SHOP_ART = {\n${body}\n};\n`;

await writeFile(new URL('../prototype/src/art.js', import.meta.url), out);
console.log(`prototype/src/art.js: ${(out.length / 1024).toFixed(0)} КБ, ${entries.length} текстур`);
if (missing.length) console.log(`не найдено в art/ready/: ${missing.join(', ')}`);
