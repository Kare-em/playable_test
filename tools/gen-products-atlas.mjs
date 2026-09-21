/*
 * Генерация иконок товара атласами: девять предметов одним запросом.
 *   node tools/gen-products-atlas.mjs [--sheets=1,2] [--only=sourcream] [--dry-run]
 *
 * Почему атласом: 36 отдельных запросов — это 36 x $0.0076 и полчаса ожидания,
 * четыре листа 3x3 — четыре запроса и пара минут. Побочная выгода важнее
 * экономии: предметы с одного листа нарисованы одним светом и в одном масштабе,
 * то есть набор гарантированно не разъезжается по стилю.
 *
 * Лист не режется по сетке: модель сама выбирает раскладку под свой холст, и
 * жёсткая сетка резала мимо. Вместо этого фон выбивается в прозрачность, а
 * предметы находятся как связные области непрозрачного и кадрируются по своим
 * границам — тогда раскладка перестаёт иметь значение. Результат: art/ready/product-<id>.webp
 * и запись в art/raw/products.json (отдельно от manifest.json, чтобы не драться
 * за файл с параллельным прогоном gen-art).
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { STYLE, GOODS } from '../art/prompts.mjs';
// нарезка общая с gen-bubble-atlas: две копии одного алгоритма разошлись бы
import { sliceSheet } from './lib/sheet.mjs';

const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const BASE = (process.env.IMAGE_API_BASE || 'https://nordrouter.com/v1').replace(/\/+$/, '');
const KEY = process.env.image_generator_api || process.env.IMAGE_API_KEY || '';
const MODEL = process.env.IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';

const flag = (name, def = null) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};
const dryRun = !!flag('dry-run');
const scrub = (s) => (KEY ? String(s).split(KEY).join('sk-***') : String(s));
const fail = (m) => { console.error('ОШИБКА:', m); process.exit(1); };
if (!KEY && !dryRun) fail('не задан ключ: ожидается image_generator_api в окружении');

const PER_SHEET = 8;                               // 2 ряда по 4 — ложится на широкий холст модели
const CELL = 256;                                  // сторона готовой иконки

// Листы собраны по отделам: соседи по листу делят свет и масштаб, поэтому
// товары одной секции стеллажа лучше держать вместе.
const ids = Object.keys(GOODS);
const SHEETS = [];
for (let i = 0; i < ids.length; i += PER_SHEET) SHEETS.push(ids.slice(i, i + PER_SHEET));

const sheetPrompt = (sheet) => {
  const list = sheet.map((id, i) => `${i + 1}) ${GOODS[id]}`).join('; ');
  const rows = sheet.length > 4 ? 2 : 1;
  const cols = Math.ceil(sheet.length / rows);
  // Счёт проговаривается трижды и запрещается добор дубликатами: на первой
  // попытке модель растянула девять предметов на сетку 4x3 и забила лишние
  // клетки повторами йогурта, сметаны и батона.
  return `${STYLE}. Exactly ${sheet.length} separate product icons on one single uniform flat cream `
    + `background, laid out in ${rows} row${rows > 1 ? 's' : ''} of ${cols}. `
    + `There must be exactly ${sheet.length} objects in the whole image — do NOT repeat any object, `
    + `do NOT add any extra object, and do NOT duplicate anything to fill empty space; leave the `
    + `spare background empty instead. Every object stands alone, drawn at a consistent scale and lit `
    + `identically from the upper left, with wide even gaps; nothing touches or overlaps. `
    + `NO grid lines, NO frames, NO labels, NO captions, NO numbers. `
    + `NO drop shadow and NO contact shadow on the background. Reading left to right, top to bottom, `
    + `the ${sheet.length} objects are: ${list}.`;
};

// --only собирает из перечисленных id отдельный лист: брак чинится одним
// запросом, а не перегенерацией всей восьмёрки, где заодно поедут соседи
const only = String(flag('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (only.length) {
  const bad = only.filter((id) => !GOODS[id]);
  if (bad.length) fail(`неизвестные товары: ${bad.join(', ')}`);
  SHEETS.length = 0;
  SHEETS.push(only);
}
const want = String(flag('sheets', '') || '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);
const chosen = want.length ? want.map((n) => n - 1) : SHEETS.map((_, i) => i);

console.log(`листов: ${chosen.length} из ${SHEETS.length}, модель ${MODEL}`);
if (dryRun) {
  for (const i of chosen) console.log(`\n--- лист ${i + 1}: ${SHEETS[i].join(', ')}\n${sheetPrompt(SHEETS[i])}`);
  process.exit(0);
}

const rawDir = new URL('../art/raw/', import.meta.url);
const readyDir = new URL('../art/ready/', import.meta.url);
const recordPath = new URL('products.json', rawDir);
await mkdir(rawDir, { recursive: true });
await mkdir(readyDir, { recursive: true });

const record = await readFile(recordPath, 'utf8').then(JSON.parse).catch(() => ({}));

const browser = await chromium.launch();
const page = await browser.newPage();

const SLICE = (dataUri, cell) => sliceSheet(page, dataUri, cell);

let spent = 0, saved = 0, suspect = [];
for (const i of chosen) {
  const sheet = SHEETS[i];
  process.stdout.write(`лист ${i + 1} (${sheet.length} шт.) ... `);
  const res = await fetch(`${BASE}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: sheetPrompt(sheet), n: 1 })
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) { console.log(`HTTP ${res.status}: ${scrub(JSON.stringify(body)).slice(0, 200)}`); continue; }
  const item = body?.data?.[0];
  const bytes = item?.b64_json
    ? Buffer.from(item.b64_json, 'base64')
    : Buffer.from(await (await fetch(item.url)).arrayBuffer());
  // Ремонтный лист пишется под своим именем: иначе он лёг бы на atlas-1.jpg
  // и затёр исходник настоящего первого листа — так уже случилось однажды.
  await writeFile(new URL(only.length ? `atlas-fix-${only.join('-')}.jpg` : `atlas-${i + 1}.jpg`, rawDir), bytes);
  spent += 0.0075852;

  const cells = await SLICE(`data:image/jpeg;base64,${bytes.toString('base64')}`, CELL);
  if (cells.length !== sheet.length) {
    // Несовпадение — значит модель добрала дубликатами или слепила предметы.
    // Пишем что есть, но помечаем весь лист: порядок мог сдвинуться.
    console.log(`\n  ВНИМАНИЕ: предметов на листе ${cells.length}, ожидалось ${sheet.length} — сверьте глазами`);
    suspect.push(...sheet);
  }
  for (let n = 0; n < sheet.length; n++) {
    const id = sheet[n], cellOut = cells[n];
    if (!cellOut) { console.log(`\n  ${id}: предмет не найден`); suspect.push(id); continue; }
    const file = `product-${id}.webp`;
    const png = Buffer.from(cellOut.uri.split(',')[1], 'base64');
    await writeFile(new URL(file, readyDir), png);
    record[`product-${id}`] = {
      file, sheet: i + 1, cell: n + 1, model: MODEL,
      size: `${cellOut.w}x${cellOut.h}`, bytes: png.length,
      createdAt: new Date().toISOString()
    };
    saved++;
  }
  await writeFile(recordPath, JSON.stringify(record, null, 2) + '\n');
  console.log(`нарезано ${sheet.length}`);
}

await browser.close();
console.log(`\nготово иконок: ${saved}, потрачено примерно $${spent.toFixed(4)}`);
if (suspect.length) console.log(`проверить глазами: ${[...new Set(suspect)].join(', ')}`);
