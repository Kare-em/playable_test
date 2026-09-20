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

// Режем лист и вырезаем фон в браузере: Chromium здесь единственный доступный
// растровый движок, сторонних библиотек в окружении нет.
const SLICE = async (dataUri, cell) => page.evaluate(async ({ dataUri, cell }) => {
  const img = new Image();
  img.src = dataUri;
  await img.decode();
  const w = img.width, h = img.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  // 1. фон в прозрачность заливкой от краёв
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const bg = [0, 1, 2].map((c) => {
    const v = corners.map((p) => p[c]).sort((a, b) => a - b);
    return (v[1] + v[2]) / 2;
  });
  const TOL = 34, SOFT = 58;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (sp > 0) {
    const p = stack[--sp];
    const i = p * 4;
    const dd = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    if (dd > SOFT) continue;
    d[i + 3] = dd <= TOL ? 0 : Math.round(255 * (dd - TOL) / (SOFT - TOL));
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  ctx.putImageData(im, 0, 0);

  // 2. предметы как связные области непрозрачного — раскладка модели больше не важна
  const solid = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) solid[p] = d[p * 4 + 3] > 24 ? 1 : 0;
  const label = new Int32Array(w * h).fill(-1);
  const boxes = [];
  const q = new Int32Array(w * h);
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!solid[p0] || label[p0] >= 0) continue;
    const id = boxes.length;
    let qs = 0, qe = 0;
    q[qe++] = p0; label[p0] = id;
    let minX = w, minY = h, maxX = -1, maxY = -1, area = 0;
    while (qs < qe) {
      const p = q[qs++];
      const x = p % w, y = (p / w) | 0;
      area++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (solid[np] && label[np] < 0) { label[np] = id; q[qe++] = np; }
        }
      }
    }
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }

  // 3. мусор долой, близкие куски склеить: лист у винограда или крышка могут
  //    отделиться от тела и без склейки уедут отдельной «иконкой»
  const minArea = w * h * 0.0015;
  let parts = boxes.filter((b) => b.area >= minArea);
  const near = Math.round(w * 0.012);
  let merged = true;
  while (merged) {
    merged = false;
    outer:
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i], b = parts[j];
        const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
        const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        if (gapX <= near && gapY <= near) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
          const x2 = Math.max(a.x + a.w, b.x + b.w), y2 = Math.max(a.y + a.h, b.y + b.h);
          parts.splice(j, 1);
          parts[i] = { x, y, w: x2 - x, h: y2 - y, area: a.area + b.area };
          merged = true;
          break outer;
        }
      }
    }
  }

  // 4. порядок чтения: сперва по рядам, внутри ряда слева направо
  const band = h * 0.25;
  parts.sort((a, b) => {
    const ay = a.y + a.h / 2, by = b.y + b.h / 2;
    if (Math.abs(ay - by) > band) return ay - by;
    return a.x - b.x;
  });

  // 5. каждый предмет кадрируется и ужимается половинными шагами
  const out = parts.map((box) => {
    const k = Math.min(cell / box.w, cell / box.h, 1);
    const trimmed = document.createElement('canvas');
    trimmed.width = box.w; trimmed.height = box.h;
    trimmed.getContext('2d').drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    let cur = trimmed, cw = box.w, ch = box.h;
    while (cw * 0.5 > box.w * k) {
      cw = Math.max(Math.round(cw * 0.5), Math.round(box.w * k));
      ch = Math.max(Math.round(ch * 0.5), Math.round(box.h * k));
      const step = document.createElement('canvas');
      step.width = cw; step.height = ch;
      const sc = step.getContext('2d');
      sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = 'high';
      sc.drawImage(cur, 0, 0, cw, ch);
      cur = step;
    }
    const fin = document.createElement('canvas');
    fin.width = Math.max(1, Math.round(box.w * k));
    fin.height = Math.max(1, Math.round(box.h * k));
    const fc = fin.getContext('2d');
    fc.imageSmoothingEnabled = true; fc.imageSmoothingQuality = 'high';
    fc.drawImage(cur, 0, 0, fin.width, fin.height);
    return { uri: fin.toDataURL('image/webp', 0.9), w: fin.width, h: fin.height };
  });
  return out;
}, { dataUri, cell });

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
  await writeFile(new URL(`atlas-${i + 1}.jpg`, rawDir), bytes);
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
