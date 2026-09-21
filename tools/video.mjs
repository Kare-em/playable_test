/*
 * Игровое видео для карточки.
 *   node tools/video.mjs [--layout=desktop,mobile] [--lang=ru,en] [--ffmpeg=<путь>]
 *
 * Снимается с настоящей сборки dist/yandex/index.html и играется скриптом:
 * кадры — то же, что увидит игрок, а не монтаж из картинок. Смена идёт своим
 * ходом, товар раскладывается по отделам, очередь обслуживается.
 *
 * Звука нет: Playwright пишет только картинку. Под музыку и голос видео
 * всё равно перемонтируют, поэтому дорожка здесь была бы лишней.
 *
 * Форматы. WebM (VP8) пишет сам Playwright — он получается всегда. MP4
 * (H.264) нужен там, где WebM не принимают, и требует ffmpeg с libx264:
 * тот, что лежит внутри Playwright, собран без него — только VP8. Если
 * подходящего ffmpeg нет, инструмент честно оставляет один WebM и говорит,
 * чего не хватило (npm i ffmpeg-static даст нужный бинарник).
 *
 * Результат: dist/store/video/<раскладка>-<язык>.webm и .mp4
 */
import { mkdir, rm, rename, readdir, stat, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = new URL('../', import.meta.url);
const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const LAYOUTS = [
  { id: 'desktop', w: 1280, h: 720,  note: 'десктоп и телевизор, 16:9' },
  { id: 'mobile',  w: 720,  h: 1280, note: 'телефон, 9:16' }
];
const LANGS = [['ru-RU', 'ru'], ['en-US', 'en']];

const flag = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};
const pickLayouts = flag('layout')?.split(',');
const pickLangs = flag('lang')?.split(',');

/* ------------------------------------------------------------------- ffmpeg */
// Нужен не любой ffmpeg, а умеющий H.264: сборка внутри Playwright обрезана
// до VP8, и молчаливый откат на неё дал бы webm с расширением mp4.
const exists = async (p) => access(p).then(() => true, () => false);
const candidates = [
  flag('ffmpeg'),
  process.env.FFMPEG,
  'ffmpeg',
  new URL('node_modules/ffmpeg-static/ffmpeg', root).pathname,
  '/opt/node22/lib/node_modules/ffmpeg-static/ffmpeg'
].filter(Boolean);

let ffmpeg = null;
for (const c of candidates) {
  if (c.includes('/') && !await exists(c)) continue;
  const encoders = await run(c, ['-hide_banner', '-encoders']).then((r) => r.stdout, () => null);
  if (encoders && /\blibx264\b/.test(encoders)) { ffmpeg = c; break; }
}

/* ------------------------------------------------------------------- съёмка */
const out = new URL('dist/store/video/', root);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

async function record(layout, locale, lang) {
  const name = `${layout.id}-${lang}`;
  const raw = new URL('raw-' + name + '/', out);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: layout.w, height: layout.h },
    deviceScaleFactor: 1,
    locale,
    recordVideo: { dir: raw.pathname, size: { width: layout.w, height: layout.h } }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(new URL('dist/yandex/index.html', root).href);
  await page.waitForFunction(() => window.__proto, null, { timeout: 20000 });
  await page.waitForTimeout(1800);           // пусть проявится стартовый экран

  // Один проход смены: берём товар с завоза и ставим в его отдел. Пауза между
  // ходами держит темп читаемым — на ускоренной раскладке зритель не успевает
  // понять правило, а оно и есть то, что продаёт игру.
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

  await play(14, 900);                        // обычная смена
  await page.evaluate(() => {                 // акция дня — товар с множителем
    const s = window.__proto.state;
    if (s.belt[0]) s.saleProduct = s.belt[0];
  });
  await play(6, 900);
  await page.evaluate(async () => {           // прокачанная точка: больше отделов
    const P = window.__proto;
    P.meta.up.produce = 1; P.meta.up.meat = 1; P.meta.up.counter = 1;
    P.startShift(2);
    await new Promise((r) => setTimeout(r, 600));
  });
  await play(12, 850);
  await page.waitForTimeout(1200);

  if (errors.length) console.log(`  ОШИБКИ: ${errors.join(' | ')}`);
  await ctx.close();                          // видео дописывается именно здесь
  await browser.close();

  const files = await readdir(raw);
  const webm = new URL(name + '.webm', out);
  await rename(new URL(files[0], raw), webm);
  await rm(raw, { recursive: true, force: true });
  return webm;
}

const made = [];
for (const layout of LAYOUTS) {
  if (pickLayouts && !pickLayouts.includes(layout.id)) continue;
  for (const [locale, lang] of LANGS) {
    if (pickLangs && !pickLangs.includes(lang)) continue;
    console.log(`${layout.id} ${layout.w}x${layout.h} (${layout.note}), ${lang}`);
    const webm = await record(layout, locale, lang);
    const size = (await stat(webm)).size;
    console.log(`  ${webm.pathname.split('/').pop()} — ${(size / 1024 / 1024).toFixed(2)} МБ`);
    made.push(webm);

    if (ffmpeg) {
      const mp4 = new URL(webm.pathname.replace(/\.webm$/, '.mp4'), out);
      // yuv420p и faststart — иначе часть плееров и соцсетей не откроют файл
      await run(ffmpeg, ['-y', '-i', webm.pathname, '-r', '30',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', '-an', mp4.pathname]);
      const m = (await stat(mp4)).size;
      console.log(`  ${mp4.pathname.split('/').pop()} — ${(m / 1024 / 1024).toFixed(2)} МБ`);
      made.push(mp4);
    }
  }
}

if (!ffmpeg) {
  console.log('\nMP4 не сделан: не нашёлся ffmpeg с libx264.');
  console.log('Тот, что внутри Playwright, собран только под VP8.');
  console.log('Поставьте любой полный ffmpeg или npm i ffmpeg-static и повторите,');
  console.log('либо передайте путь: node tools/video.mjs --ffmpeg=/путь/к/ffmpeg');
}
console.log(`\nготово: ${made.length} файлов в dist/store/video/`);
