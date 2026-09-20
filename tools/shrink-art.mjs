/*
 * Ужимает сырой арт из art/raw/ до размеров из docs/art-assets.md.
 *   node tools/shrink-art.mjs [--scale=2] [--quality=0.82] [--format=webp]
 *
 * Генератор отдаёт 2048x2048 по 2 МБ независимо от запрошенного size — в игру
 * такое не кладут. Здесь картинка пересобирается под реальный размер на экране
 * (сцена 720x1280) и переупаковывается в WebP: для плоского мультяшного арта
 * это десятки килобайт вместо мегабайт.
 *
 * Флаги:
 *   --scale=2         множитель под retina (1 — ровно по спецификации)
 *   --quality=0.82    качество для webp/jpeg
 *   --format=webp     webp | png | jpeg
 *   --only=a,b,c      конкретные id
 *   --force           пересобрать уже готовые
 *
 * Результат: art/ready/<id>.<ext>, размеры дописываются в art/raw/manifest.json.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';

const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const flag = (name, def = null) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};

// Целевые габариты — из docs/art-assets.md. Картинка вписывается в рамку
// с сохранением пропорций, поля не добавляются.
const TARGETS = [
  [/^bust-/, 256, 256],            // B1: бюст в бабл заказа
  [/^full-/, 300, 600],            // B2: полный рост в очереди
  [/^interior-/, 720, 900],        // C1: интерьер точки
  [/^upgrade-/, 400, 400],         // C2: апгрейды поверх интерьера
  [/^bg-/, 720, 1280],             // A9: фон игрового экрана
  [/^iap-/, 256, 256],             // D5: иконки паков
  [/^loading-screen$/, 720, 1280], // D6: экран загрузки
  [/^game-icon$/, 512, 512],       // E1: иконка для платформы
  [/^cover$/, 1200, 630]           // E1: обложка
];
const targetFor = (id) => (TARGETS.find(([re]) => re.test(id)) || [null, 512, 512]).slice(1);

const scale = Number(flag('scale', 2)) || 2;
const quality = Number(flag('quality', 0.82)) || 0.82;
const format = String(flag('format', 'webp'));
if (!['webp', 'png', 'jpeg'].includes(format)) {
  console.error('ОШИБКА: --format принимает webp | png | jpeg');
  process.exit(1);
}

const rawDir = new URL('../art/raw/', import.meta.url);
const outDir = new URL('../art/ready/', import.meta.url);
const manifestPath = new URL('manifest.json', rawDir);

const manifest = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => null);
if (!manifest) {
  console.error('ОШИБКА: нет art/raw/manifest.json — сначала сгенерируйте арт (tools/gen-art.mjs)');
  process.exit(1);
}

let ids = Object.keys(manifest);
const only = flag('only');
if (typeof only === 'string') ids = only.split(',').map((s) => s.trim()).filter(Boolean);

const exists = async (u) => access(u).then(() => true, () => false);
const force = !!flag('force');

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
const MIME = { webp: 'image/webp', png: 'image/png', jpeg: 'image/jpeg' };

let before = 0, after = 0, done = 0, skipped = 0;
for (const id of ids) {
  const entry = manifest[id];
  if (!entry?.file) { console.log(`${id}: нет записи в манифесте, пропуск`); continue; }
  const src = new URL(entry.file, rawDir);
  if (!await exists(src)) { console.log(`${id}: нет ${entry.file}, пропуск`); continue; }

  const outFile = `${id}.${format === 'jpeg' ? 'jpg' : format}`;
  if (!force && await exists(new URL(outFile, outDir))) { skipped++; continue; }

  const [tw, th] = targetFor(id);
  const raw = await readFile(src);
  const dataUri = `data:image/${entry.file.endsWith('.png') ? 'png' : 'jpeg'};base64,${raw.toString('base64')}`;

  // Пересэмплинг в два прохода: при уменьшении сразу в 4+ раза Chromium
  // заметно мылит, половинное деление держит контур чётким.
  const out = await page.evaluate(async ({ dataUri, tw, th, scale, mime, quality }) => {
    const img = new Image();
    img.src = dataUri;
    await img.decode();
    const box = { w: tw * scale, h: th * scale };
    const k = Math.min(box.w / img.width, box.h / img.height, 1);
    let w = img.width, h = img.height;
    let canvas = document.createElement('canvas');
    let ctx;
    let cur = img;
    while (w * 0.5 > img.width * k) {
      w = Math.max(Math.round(w * 0.5), Math.round(img.width * k));
      h = Math.max(Math.round(h * 0.5), Math.round(img.height * k));
      const step = document.createElement('canvas');
      step.width = w; step.height = h;
      ctx = step.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cur, 0, 0, w, h);
      cur = step;
    }
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, canvas.width, canvas.height);
    return { uri: canvas.toDataURL(mime, quality), w: canvas.width, h: canvas.height };
  }, { dataUri, tw, th, scale, mime: MIME[format], quality });

  const bytes = Buffer.from(out.uri.split(',')[1], 'base64');
  await writeFile(new URL(outFile, outDir), bytes);
  entry.ready = { file: outFile, size: `${out.w}x${out.h}`, bytes: bytes.length };
  before += entry.bytes;
  after += bytes.length;
  done++;
  console.log(`${id}: ${entry.actual || '?'} ${(entry.bytes / 1024).toFixed(0)} КБ `
    + `-> ${out.w}x${out.h} ${(bytes.length / 1024).toFixed(0)} КБ`);
}

await browser.close();
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\nготово: ${done}${skipped ? `, пропущено готовых: ${skipped}` : ''}. Файлы в art/ready/`);
if (done) {
  console.log(`было ${(before / 1024 / 1024).toFixed(1)} МБ -> стало ${(after / 1024).toFixed(0)} КБ `
    + `(в ${(before / after).toFixed(0)} раз меньше)`);
}
