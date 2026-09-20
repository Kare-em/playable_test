/*
 * Иконка и обложка для карточки игры.
 *   node tools/store-art.mjs
 *
 * Источник — сгенерированный арт art/ready/game-icon.webp и cover.webp.
 * Скриншотом иконку и обложку делать нельзя, это прямо запрещено
 * требованиями площадки, поэтому берём именно рисованные ассеты.
 *
 * Почему не простой ресайз: у обоих исходников широкие кремовые поля, и при
 * подгонке «как есть» предмет становится мелким, а на маленькой иконке в
 * каталоге это решает всё. Здесь кадрируем по содержимому (границы находим
 * заливкой от краёв, как при вырезании фона) и собираем заново на тёплом
 * фоне под нужную пропорцию.
 *
 * Точные размеры площадка указывает в форме черновика, а не в документации,
 * поэтому выдаём набор с запасом по разрешению: любой требуемый размер
 * получается уменьшением, а не растягиванием.
 *
 * Результат: dist/store/icon-*.png и dist/store/cover-*.png
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const out = new URL('../dist/store/', import.meta.url);
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

/** Кадрирует по содержимому и рисует на тёплом фоне в заданной рамке. */
const compose = (dataUri, w, h, pad) => page.evaluate(async ({ dataUri, w, h, pad }) => {
  const img = new Image();
  img.src = dataUri;
  await img.decode();

  const src = document.createElement('canvas');
  src.width = img.width; src.height = img.height;
  const sx = src.getContext('2d', { willReadFrequently: true });
  sx.drawImage(img, 0, 0);

  // Фон исходника выбиваем в прозрачность заливкой от краёв, а не просто
  // кадрируем: иначе кремовый прямоугольник исходника ложится поверх нашего
  // градиента видимой заплаткой, а это ровно тот артефакт, который
  // требования площадки запрещают.
  const W = img.width, H = img.height;
  const im = sx.getImageData(0, 0, W, H), d = im.data;
  const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const corners = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)];
  const bg = [0, 1, 2].map((c) => {
    const v = corners.map((p) => p[c]).sort((a, b) => a - b);
    return (v[1] + v[2]) / 2;
  });
  const TOL = 30, SOFT = 56;
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let sp = 0;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (seen[p]) return;
    seen[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (sp > 0) {
    const p = stack[--sp], i = p * 4;
    const dd = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    if (dd > SOFT) continue;
    d[i + 3] = dd <= TOL ? 0 : Math.round(255 * (dd - TOL) / (SOFT - TOL));
    const x = p % W, y = (p / W) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  sx.putImageData(im, 0, 0);

  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) { minX = 0; minY = 0; maxX = W - 1; maxY = H - 1; }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  // фон — тёплый градиент в палитре игры, чтобы карточка не выглядела вырезкой
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#F7EBD6');
  g.addColorStop(1, '#E8D3B2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const box = { w: w * (1 - pad * 2), h: h * (1 - pad * 2) };
  const k = Math.min(box.w / bw, box.h / bh);
  const dw = Math.round(bw * k), dh = Math.round(bh * k);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, minX, minY, bw, bh, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  return { uri: cv.toDataURL('image/png'), crop: bw + 'x' + bh };
}, { dataUri, w, h, pad });

const load = async (name) => {
  const b = await readFile(new URL('../art/ready/' + name, import.meta.url));
  return 'data:image/webp;base64,' + b.toString('base64');
};

const icon = await load('game-icon.webp');
const cover = await load('cover.webp');

const jobs = [
  ['icon-1024.png', icon, 1024, 1024, 0.06],
  ['icon-512.png', icon, 512, 512, 0.06],
  ['icon-256.png', icon, 256, 256, 0.06],
  ['cover-16x9-1920.png', cover, 1920, 1080, 0.05],
  ['cover-3x2-1800.png', cover, 1800, 1200, 0.05],
  ['cover-2x1-1600.png', cover, 1600, 800, 0.05]
];

for (const [name, srcUri, w, h, pad] of jobs) {
  const r = await compose(srcUri, w, h, pad);
  const bytes = Buffer.from(r.uri.split(',')[1], 'base64');
  await writeFile(new URL(name, out), bytes);
  console.log(`${name}: ${w}x${h}, из кадра ${r.crop}, ${(bytes.length / 1024).toFixed(0)} КБ`);
}

await browser.close();
console.log('\nготово: dist/store/ — точный размер берите из формы черновика и уменьшайте от большего');
