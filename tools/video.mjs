/*
 * Игровое видео для карточки.
 *   node tools/video.mjs [--layout=desktop,mobile] [--lang=ru,en]
 *                        [--fps=25] [--seconds=20] [--ffmpeg=<путь>]
 *
 * Снимается с настоящей сборки dist/yandex/index.html и играется скриптом:
 * кадры — то же, что увидит игрок, а не монтаж из картинок.
 *
 * Почему покадрово, а не записью экрана. Видеокарты в сборочном окружении
 * нет, WebGL идёт через программный SwiftShader, и сцена игры тянет на нём
 * около 3 кадров в секунду (пустая страница и голый канвас при этом дают 60 —
 * дело именно в стоимости кадра игры). Обычная запись честно снимает эти 3
 * кадра, и видео выходит слайд-шоу. Поэтому часы страницы подменяются,
 * время двигается ровно на 1/fps за кадр, кадр снимается, и ролик собирается
 * из кадров: плавность больше не зависит от того, как медленно рисует
 * контейнер. На машине с видеокартой инструмент работает так же, просто
 * быстрее.
 *
 * Снимок берётся через CDP напрямую: page.screenshot() здесь стоит ~2000 мс
 * против ~60 мс у Page.captureScreenshot, а кадров нужны сотни.
 *
 * Звука нет: Playwright пишет только картинку, а под музыку и голос видео
 * всё равно перемонтируют.
 *
 * Форматы: MP4 (H.264) и WebM (VP9). Нужен ffmpeg с libx264 — если такого
 * нет, инструмент говорит, чего не хватило (npm i ffmpeg-static даст его).
 *
 * Результат: dist/store/video/<раскладка>-<язык>.mp4 и .webm
 */
import { mkdir, rm, writeFile, stat, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';            // на Windows URL.pathname даёт /D:/... — fs такой путь не понимает

const run = promisify(execFile);
const root = new URL('../', import.meta.url);
const { chromium } = await import('playwright').catch(() =>
  import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const flag = (name, def = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};
const FPS = Number(flag('fps', 25));
const SECONDS = Number(flag('seconds', 20));
const FRAMES = Math.round(FPS * SECONDS);
const STEP = 1000 / FPS;
// Часы подменены, поэтому кадр рисуется внутри runFor, но композитору нужен
// настоящий тик, чтобы отдать его в снимок. Без этой паузы в ролик попадают
// повторы предыдущего кадра.
const SETTLE = 45;

const LAYOUTS = [
  { id: 'desktop', w: 1280, h: 720,  note: 'десктоп и телевизор, 16:9' },
  { id: 'mobile',  w: 720,  h: 1280, note: 'телефон, 9:16' }
];
const LANGS = [['ru-RU', 'ru'], ['en-US', 'en']];
const pickLayouts = flag('layout')?.split(',');
const pickLangs = flag('lang')?.split(',');

/* ------------------------------------------------------------------- ffmpeg */
// Нужен не любой ffmpeg, а умеющий H.264: сборка внутри Playwright обрезана
// до VP8, и молчаливый откат на неё дал бы webm с расширением mp4.
const exists = async (p) => access(p).then(() => true, () => false);
let ffmpeg = null;
for (const c of [flag('ffmpeg'), process.env.FFMPEG, 'ffmpeg',
                 fileURLToPath(new URL('node_modules/ffmpeg-static/ffmpeg', root))].filter(Boolean)) {
  if (c.includes('/') && !await exists(c)) continue;
  const enc = await run(c, ['-hide_banner', '-encoders']).then((r) => r.stdout, () => null);
  if (enc && /\blibx264\b/.test(enc)) { ffmpeg = c; break; }
}
if (!ffmpeg) {
  console.error('ОШИБКА: не нашёлся ffmpeg с libx264 — из кадров нечем собрать ролик.');
  console.error('Тот, что внутри Playwright, собран только под VP8.');
  console.error('npm i ffmpeg-static, либо node tools/video.mjs --ffmpeg=/путь/к/ffmpeg');
  process.exit(1);
}

/* ------------------------------------------------------------------- сценарий */
// Что происходит на какой секунде. Раскладка товара идёт ровным шагом: на
// ускоренной зритель не успевает понять правило, а оно и есть то, что
// продаёт игру.
const PLACE_EVERY = Math.round(FPS * 0.8);
const SALE_AT = Math.round(FRAMES * 0.42);      // акция дня
const UPGRADE_AT = Math.round(FRAMES * 0.62);   // прокачанная точка, больше отделов
const START_AT = Math.round(FPS * 1.2);         // сначала дать разглядеть поле

const out = new URL('dist/store/video/', root);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

async function record(layout, locale, lang) {
  const name = `${layout.id}-${lang}`;
  const frames = new URL('frames-' + name + '/', out);
  await mkdir(frames, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: layout.w, height: layout.h }, deviceScaleFactor: 1, locale
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();                    // до goto: иначе игра возьмёт настоящие часы
  await page.goto(new URL('dist/yandex/index.html', root).href);

  // Загрузка идёт частью на таймерах, частью на декодировании картинок:
  // двигаем часы, пока не появится ручка игры.
  for (let i = 0; i < 300; i++) {
    if (await page.evaluate(() => !!window.__proto).catch(() => false)) break;
    await page.clock.runFor(100);
  }
  if (!await page.evaluate(() => !!window.__proto)) throw new Error(`${name}: игра не загрузилась`);
  await page.clock.runFor(1200);

  const cdp = await page.context().newCDPSession(page);
  const act = (fn) => page.evaluate(fn).catch(() => {});
  let dup = 0, prev = null;

  for (let f = 0; f < FRAMES; f++) {
    if (f === SALE_AT) await act(() => { const s = window.__proto.state; if (s.belt[0]) s.saleProduct = s.belt[0]; });
    if (f === UPGRADE_AT) await act(() => {
      const P = window.__proto;
      P.meta.up.produce = 1; P.meta.up.meat = 1; P.meta.up.counter = 1;
      P.startShift(2);
    });
    if (f >= START_AT && f % PLACE_EVERY === 0) await act(() => {
      const P = window.__proto, s = P.state;
      if (s.status !== 'playing' || !s.belt[0]) return;
      P.select('belt', 0);
      P.place(P.section(s.belt[0]));
    });

    await page.clock.runFor(STEP);
    await new Promise((r) => setTimeout(r, SETTLE));
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    if (shot.data === prev) dup++;
    prev = shot.data;
    await writeFile(new URL(String(f).padStart(5, '0') + '.jpg', frames), Buffer.from(shot.data, 'base64'));
  }

  if (errors.length) console.log(`  ОШИБКИ: ${errors.slice(0, 3).join(' | ')}`);
  console.log(`  ${FRAMES} кадров, повторов подряд: ${dup} (${(dup / FRAMES * 100).toFixed(0)}%)`);
  await browser.close();

  const src = ['-framerate', String(FPS), '-i', fileURLToPath(new URL('%05d.jpg', frames))];
  const mp4 = new URL(name + '.mp4', out);
  await run(ffmpeg, ['-y', '-loglevel', 'error', ...src,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', fileURLToPath(mp4)]);
  const webm = new URL(name + '.webm', out);
  await run(ffmpeg, ['-y', '-loglevel', 'error', ...src,
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-row-mt', '1', '-pix_fmt', 'yuv420p',
    fileURLToPath(webm)]);
  await rm(frames, { recursive: true, force: true });

  for (const f of [mp4, webm]) {
    const nm = fileURLToPath(f).split(/[\\/]/).pop();
    console.log(`  ${nm} — ${((await stat(f)).size / 1024 / 1024).toFixed(2)} МБ`);
  }
  return 2;
}

let made = 0;
for (const layout of LAYOUTS) {
  if (pickLayouts && !pickLayouts.includes(layout.id)) continue;
  for (const [locale, lang] of LANGS) {
    if (pickLangs && !pickLangs.includes(lang)) continue;
    console.log(`${layout.id} ${layout.w}x${layout.h} (${layout.note}), ${lang}: ${SECONDS} с при ${FPS} к/с`);
    made += await record(layout, locale, lang);
  }
}
console.log(`\nготово: ${made} файлов в dist/store/video/`);
