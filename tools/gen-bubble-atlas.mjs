/*
 * Пузырь эмоции и реакции к нему — одним листом.
 *   node tools/gen-bubble-atlas.mjs [--dry-run] [--keep]
 *
 * Один запрос вместо четырёх: пузырь и три реакции нарисованы одним светом и
 * в одном масштабе, то есть гарантированно не разъедутся между собой. Это
 * важнее экономии — знаки живут вплотную друг к другу в одной карточке.
 *
 * Пузырь генерится ПУСТЫМ, реакции — отдельно, и складываются здесь же.
 * Почему не попросить сразу три готовых пузыря: тогда у каждого свой контур,
 * своя форма и свой наклон хвоста, и при смене настроения покупателя пузырь
 * дёргается. Один контур на все три состояния — меняется только начинка.
 *
 * Полость пузыря не задаётся числом, а измеряется: заливкой от центра по
 * однородному светлому полю. Модель каждый раз рисует балон чуть иначе, и
 * вбитые вручную координаты разъехались бы на первой же перегенерации.
 *
 * Готовый спрайт дополняется полями так, чтобы ЦЕНТР ТЕЛА пузыря совпал с
 * центром холста. Тогда игре достаточно anchor 0.5 и ширины — хвост сам
 * свисает вниз, и не нужно ни одной магической константы в game.js.
 *
 * Результат: art/ready/bubble-<реакция>.webp (идут в сборку) и части
 * art/ready/bubblepart-*.webp (остаются исходником, в сборку не идут).
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { STYLE_UI, BUBBLE_PARTS } from '../art/prompts.mjs';
import { sliceSheet } from './lib/sheet.mjs';

const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const BASE = (process.env.IMAGE_API_BASE || 'https://nordrouter.com/v1').replace(/\/+$/, '');
const KEY = process.env.image_generator_api || process.env.IMAGE_API_KEY || '';
const MODEL = process.env.IMAGE_MODEL || 'google/gemini-3.1-flash-image-preview';

const flag = (n) => process.argv.some((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const dryRun = flag('dry-run');
// Пересборка из сохранённого листа: подгонка начинки правится без нового
// запроса — лист уже оплачен и лежит в art/raw.
const recompose = flag('recompose');
const scrub = (s) => (KEY ? String(s).split(KEY).join('sk-***') : String(s));
if (!KEY && !dryRun && !recompose) { console.error('ОШИБКА: не задан ключ image_generator_api'); process.exit(1); }

const CELL = 320;                 // сторона нарезанной части до сборки
// Доля радиуса полости, которую занимает ОПИСАННАЯ вокруг реакции окружность.
// Вписывать по стороне нельзя: полость круглая, и у квадратного знака злости
// диагональ вылезала за контур, хотя по ширине он помещался.
const ICON_IN_CAVITY = 0.92;

const prompt = `${STYLE_UI}. Exactly ${BUBBLE_PARTS.length} separate objects on one single uniform flat `
  + `cream background, laid out in one row of ${BUBBLE_PARTS.length}. There must be exactly `
  + `${BUBBLE_PARTS.length} objects in the whole image — do NOT repeat anything and do NOT add anything `
  + `extra. Every object stands alone at a similar size with wide even gaps; nothing touches or overlaps. `
  + `NO grid lines, NO frames, NO labels, NO captions. Reading left to right, the ${BUBBLE_PARTS.length} `
  + `objects are: ${BUBBLE_PARTS.map(([, d], i) => `${i + 1}) ${d}`).join('; ')}.`;

if (dryRun) { console.log(prompt); process.exit(0); }

const rawDir = new URL('../art/raw/', import.meta.url);
const readyDir = new URL('../art/ready/', import.meta.url);
await mkdir(rawDir, { recursive: true });
await mkdir(readyDir, { recursive: true });

const sheetFile = new URL('bubble-sheet.jpg', rawDir);
let bytes;
if (recompose) {
  bytes = await readFile(sheetFile).catch(() => null);
  if (!bytes) { console.error('ОШИБКА: нет art/raw/bubble-sheet.jpg — сперва прогон без --recompose'); process.exit(1); }
  console.log('пересборка из сохранённого листа, запрос не делается');
} else {
  console.log(`лист: ${BUBBLE_PARTS.map(([id]) => id).join(', ')}, модель ${MODEL}`);
  const res = await fetch(`${BASE}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, n: 1 })
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) { console.error(`ОШИБКА HTTP ${res.status}: ${scrub(JSON.stringify(body)).slice(0, 300)}`); process.exit(1); }
  const item = body?.data?.[0];
  bytes = item?.b64_json
    ? Buffer.from(item.b64_json, 'base64')
    : Buffer.from(await (await fetch(item.url)).arrayBuffer());
  await writeFile(sheetFile, bytes);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const cells = await sliceSheet(page, `data:image/jpeg;base64,${bytes.toString('base64')}`, CELL);
console.log(`нарезано частей: ${cells.length}, ожидалось ${BUBBLE_PARTS.length}`);
if (cells.length !== BUBBLE_PARTS.length) {
  console.log('ВНИМАНИЕ: счёт не сошёлся — порядок мог сдвинуться, сверьте art/raw/bubble-sheet.jpg');
}

/* Складываем: реакция ложится в измеренную полость пузыря, готовый спрайт
   центрируется по телу. Всё в странице — другого растрового движка нет. */
const compose = (bubbleUri, iconUri, ratio) => page.evaluate(async ({ bubbleUri, iconUri, ratio }) => {
  const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
  const bub = await load(bubbleUri), ic = await load(iconUri);
  const W = bub.width, H = bub.height;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bub, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;

  // 1. полость: заливка от центра по пикселям, близким к центральному по цвету
  const at = (p) => [d[p * 4], d[p * 4 + 1], d[p * 4 + 2], d[p * 4 + 3]];
  const c0 = at(((H >> 1) * W) + (W >> 1));
  if (c0[3] < 200) return null;                   // в центре дырка — пузырь не распознан
  const TOL = 60;
  const seen = new Uint8Array(W * H);
  const st = new Int32Array(W * H);
  let sp = 0, minX = W, minY = H, maxX = -1, maxY = -1;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (seen[p]) return;
    const c = at(p);
    if (c[3] < 200) { seen[p] = 1; return; }
    if (Math.hypot(c[0] - c0[0], c[1] - c0[1], c[2] - c0[2]) > TOL) { seen[p] = 1; return; }
    seen[p] = 1; st[sp++] = p;
  };
  push(W >> 1, H >> 1);
  while (sp > 0) {
    const p = st[--sp];
    const x = p % W, y = (p / W) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  if (maxX < 0) return null;
  const cav = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };

  // 2. реакция по центру полости, вписанная по описанной окружности
  const R = Math.min(cav.w, cav.h) / 2 * ratio;
  const k = R / (Math.hypot(ic.width, ic.height) / 2);
  const iw = ic.width * k, ih = ic.height * k;
  ctx.drawImage(ic, cav.x + (cav.w - iw) / 2, cav.y + (cav.h - ih) / 2, iw, ih);

  // 3. тело пузыря — самая широкая часть; хвост уже неё. Дополняем поля так,
  //    чтобы центр тела встал в центр холста: игре хватит anchor 0.5
  const d2 = ctx.getImageData(0, 0, W, H).data;
  const rowW = [];
  let wide = 0;
  for (let y = 0; y < H; y++) {
    let lo = -1, hi = -1;
    for (let x = 0; x < W; x++) if (d2[(y * W + x) * 4 + 3] > 24) { if (lo < 0) lo = x; hi = x; }
    const ww = lo < 0 ? 0 : hi - lo + 1;
    rowW.push(ww);
    if (ww > wide) wide = ww;
  }
  let bodyTop = -1, bodyBot = -1;
  for (let y = 0; y < H; y++) if (rowW[y] >= wide * 0.82) { if (bodyTop < 0) bodyTop = y; bodyBot = y; }
  const bodyMid = (bodyTop + bodyBot) / 2;
  const half = Math.max(bodyMid, H - bodyMid);    // поля с той стороны, где короче
  const out = document.createElement('canvas');
  out.width = W; out.height = Math.ceil(half * 2);
  out.getContext('2d').drawImage(cv, 0, Math.round(half - bodyMid));
  return { uri: out.toDataURL('image/webp', 0.92), w: out.width, h: out.height,
           cavity: cav, body: { top: bodyTop, bottom: bodyBot, width: wide } };
}, { bubbleUri, iconUri, ratio });

const record = { sheet: 'bubble-sheet.jpg', model: MODEL, createdAt: new Date().toISOString(), parts: {} };
const save = async (name, uri) => {
  const buf = Buffer.from(uri.split(',')[1], 'base64');
  await writeFile(new URL(name, readyDir), buf);
  return buf.length;
};

// части остаются исходником: перегенерация одной реакции не трогает контур
for (let i = 0; i < BUBBLE_PARTS.length && i < cells.length; i++) {
  const id = BUBBLE_PARTS[i][0];
  const bytesOut = await save(`bubblepart-${id}.webp`, cells[i].uri);
  record.parts[id] = { file: `bubblepart-${id}.webp`, size: `${cells[i].w}x${cells[i].h}`, bytes: bytesOut };
}

let made = 0;
for (let i = 1; i < BUBBLE_PARTS.length && i < cells.length; i++) {
  const id = BUBBLE_PARTS[i][0];
  const composed = await compose(cells[0].uri, cells[i].uri, ICON_IN_CAVITY);
  if (!composed) { console.log(`  ${id}: полость пузыря не нашлась — пропуск`); continue; }
  const bytesOut = await save(`bubble-${id}.webp`, composed.uri);
  record[`bubble-${id}`] = {
    file: `bubble-${id}.webp`, size: `${composed.w}x${composed.h}`, bytes: bytesOut,
    cavity: composed.cavity, body: composed.body
  };
  console.log(`  bubble-${id}.webp — ${composed.w}x${composed.h}, ${(bytesOut / 1024).toFixed(1)} КБ`);
  made++;
}

await writeFile(new URL('bubble.json', rawDir), JSON.stringify(record, null, 2) + '\n');
await browser.close();
console.log(`\nготово пузырей: ${made}` + (recompose ? ', запрос не делался' : ', потрачено примерно $0.0076'));
