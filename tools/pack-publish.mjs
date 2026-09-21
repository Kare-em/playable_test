/*
 * Один архив со всем, что нужно для публикации на Яндекс Играх.
 *   node tools/pack-publish.mjs [--force]
 *
 * Собирает dist/yandex-publish.zip из того, что уже сделано другими
 * инструментами, и ничего не генерирует сам: сборку делает build-yandex.mjs,
 * иконку и обложку — store-art.mjs, скриншоты — shots.mjs. Здесь только
 * проверка комплектности, свежести и раскладка по папкам.
 *
 * Свежесть проверяется по времени файлов, а не на глаз: архив, собранный до
 * последней правки кода, выглядит точно так же, как свежий, и уедет в консоль
 * незамеченным. Если что-то отстало — инструмент называет команду и падает;
 * --force пропускает проверку, когда отставание осознанное.
 *
 * Имена файлов внутри архива — латиница без пробелов: кириллица в zip
 * разъезжается при распаковке на Windows.
 *
 * Результат: dist/yandex-publish.zip
 */
import { readFile, writeFile, mkdir, rm, stat, cp, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = new URL('../', import.meta.url);
const at = (p) => new URL(p, root);
const path = (p) => at(p).pathname;
const force = process.argv.includes('--force');

const mtime = async (p) => stat(at(p)).then((s) => s.mtimeMs, () => null);
const newestIn = async (dir, re) => {
  const names = await readdir(at(dir)).catch(() => []);
  let best = 0, who = null;
  for (const n of names) {
    if (re && !re.test(n)) continue;
    const t = await mtime(dir + n);
    if (t > best) { best = t; who = dir + n; }
  }
  return { t: best, who };
};

/* ------------------------------------------------------------- комплектность */
// Что кладём, куда и чем это делается, если файла нет.
const SHOTS = [1, 2, 3, 4, 5];
const SHOT_LAYOUTS = ['mobile', 'desktop', 'tablet'];
const VIDEO = ['desktop-ru', 'desktop-en', 'mobile-ru', 'mobile-en'];
const ITEMS = [
  ['dist/yandex.zip',              'game/yandex.zip',             'node tools/build-yandex.mjs'],
  ['dist/store/icon-1024.png',     'icon/icon-1024.png',          'node tools/store-art.mjs'],
  ['dist/store/icon-512.png',      'icon/icon-512.png',           'node tools/store-art.mjs'],
  ['dist/store/icon-256.png',      'icon/icon-256.png',           'node tools/store-art.mjs'],
  ['dist/store/cover-16x9-1920.png', 'cover/cover-16x9-1920.png', 'node tools/store-art.mjs'],
  ['dist/store/cover-3x2-1800.png',  'cover/cover-3x2-1800.png',  'node tools/store-art.mjs'],
  ['dist/store/cover-2x1-1600.png',  'cover/cover-2x1-1600.png',  'node tools/store-art.mjs'],
  ...SHOT_LAYOUTS.flatMap((L) => ['ru', 'en'].flatMap((lang) => SHOTS.map((i) =>
    [`dist/store/shots/${L}/${lang}/shot-${i}.png`, `screenshots/${L}/${lang}/shot-${i}.png`, 'node tools/shots.mjs']))),
  ['docs/store-card.md',           'texts/store-card.md',         null],
  ['docs/yandex-publish.md',       'texts/checklist.md',          null]
];

// Видео для первой публикации не обязательно, поэтому его отсутствие не
// валит сборку архива — только отмечается в отчёте.
const OPTIONAL = [];
for (const name of VIDEO) {
  for (const ext of ['webm', 'mp4']) {
    OPTIONAL.push([`dist/store/video/${name}.${ext}`, `video/${name}.${ext}`, 'node tools/video.mjs']);
  }
}

const missing = [];
for (const [src, , how] of ITEMS) {
  if (await mtime(src) === null) missing.push(how ? `${src} — ${how}` : src);
}
const haveVideo = [];
for (const item of OPTIONAL) if (await mtime(item[0]) !== null) haveVideo.push(item);
if (missing.length) {
  console.error('ОШИБКА: не хватает материалов:');
  missing.forEach((m) => console.error('  - ' + m));
  process.exit(1);
}

/* ----------------------------------------------------------------- свежесть */
const stale = [];
const code = [
  await newestIn('prototype/src/', /\.js$/),
  await newestIn('prototype/vendor/', /\.js$/)
].sort((a, b) => b.t - a.t)[0];
const buildT = await mtime('dist/yandex.zip');
if (code.t > buildT) stale.push(`dist/yandex.zip старее ${code.who} — node tools/build-yandex.mjs`);

// Скриншоты снимаются с готовой сборки, значит должны быть не старее её.
const pageT = await mtime('dist/yandex/index.html');
for (const L of SHOT_LAYOUTS) {
  let old = false;
  for (const lang of ['ru', 'en']) {
    for (const i of SHOTS) {
      if (await mtime(`dist/store/shots/${L}/${lang}/shot-${i}.png`) < pageT) { old = true; break; }
    }
  }
  if (old) stale.push(`скриншоты ${L} сняты до текущей сборки — node tools/shots.mjs`);
}
for (const [src] of haveVideo) {
  if (await mtime(src) < pageT) { stale.push('видео снято до текущей сборки — node tools/video.mjs'); break; }
}

// Иконка и обложка режутся из арта — если арт переснят, их надо пересобрать.
const artT = Math.max(await mtime('art/ready/game-icon.webp') || 0, await mtime('art/ready/cover.webp') || 0);
if (artT > (await mtime('dist/store/icon-1024.png'))) {
  stale.push('иконка и обложка старее арта — node tools/store-art.mjs');
}

if (stale.length) {
  console.error(force ? 'ВНИМАНИЕ (--force, продолжаю):' : 'ОШИБКА: материалы разъехались во времени:');
  stale.forEach((m) => console.error('  - ' + m));
  if (!force) process.exit(1);
}

/* ------------------------------------------------------------------ раскладка */
const out = 'dist/publish/';
await rm(at(out), { recursive: true, force: true });
for (const [src, dst] of [...ITEMS, ...haveVideo]) {
  await mkdir(new URL(out + dst.slice(0, dst.lastIndexOf('/') + 1), root), { recursive: true });
  await cp(at(src), at(out + dst));
}

const README = `Магазин у дома — материалы для публикации на Яндекс Играх
Сборка: ${(await readFile(path('dist/yandex/index.html'), 'utf8')).match(/var BUILD = '([^']+)'/)?.[1] || '?'}

Что куда в форме черновика:

  game/yandex.zip          загрузить как архив игры (index.html лежит в корне)
  icon/icon-1024.png       иконка игры; 512 и 256 — если форма попросит меньше
  cover/cover-16x9-1920    обложка; рядом 3x2 и 2x1 под другие пропорции

  screenshots/mobile/      720x1280, телефон (9:16)
  screenshots/desktop/     1920x1080, десктоп и телевизор (16:9)
  screenshots/tablet/      1600x1200, планшет (4:3)
                           внутри каждой — ru/ и en/, по пять кадров
${haveVideo.length ? `
  video/                   игровое видео, <раскладка>-<язык>; webm и mp4,
                           без звука — дорожку кладут при монтаже
` : ''}

  texts/store-card.md      названия, описания, теги, возрастной рейтинг,
                           переключатели рекламы и облачных сохранений —
                           всё готово к копированию, на двух языках
  texts/checklist.md       чеклист требований площадки со ссылками на пункты

Размеры даны с запасом: нужный получается уменьшением от большего.
Точные лимиты площадка показывает в самой форме.

Возрастной рейтинг: 0+. Языки: русский и английский.
Реклама: полноэкранная между сменами и вознаграждаемое видео на итогах,
только через SDK площадки. Облачные сохранения включены.
`;
await writeFile(at(out + 'README.txt'), '﻿' + README);   // BOM — иначе блокнот на Windows покажет кракозябры

/* --------------------------------------------------------------------- архив */
const zipPath = 'dist/yandex-publish.zip';
await rm(at(zipPath), { force: true });
await run('zip', ['-q', '-r', '../yandex-publish.zip', '.'], { cwd: path(out) });

const listed = (await run('unzip', ['-Z1', path(zipPath)])).stdout.trim().split('\n');
const bad = listed.filter((n) => /[\sЀ-ӿ]/.test(n));
if (bad.length) {
  console.error('ОШИБКА: пробелы или кириллица в именах:', bad.join(', '));
  process.exit(1);
}
const size = (await stat(at(zipPath))).size;
console.log(`${zipPath}: ${(size / 1024 / 1024).toFixed(2)} МБ, ${listed.filter((n) => !n.endsWith('/')).length} файлов`);
listed.filter((n) => !n.endsWith('/')).forEach((n) => console.log('  ' + n));
