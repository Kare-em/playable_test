/*
 * Сборка для Яндекс Игр: dist/yandex/index.html + dist/yandex.zip.
 *   node tools/build-yandex.mjs
 *
 * Отличия от обычной однофайловой сборки (tools/build-single.mjs):
 *   - подключён /sdk.js площадки, и подключён ДО кода игры: документация
 *     требует, чтобы скрипт был загружен раньше вызова YaGames.init();
 *   - добавлен prototype/src/ysdk.js — прослойка, через которую игра
 *     разговаривает с площадкой;
 *   - архив собирается сразу, потому что в консоль загружают именно zip.
 *
 * Проверки по «Требованиям к игре»:
 *   1.21 распакованный размер не больше 100 МБ;
 *   1.22 index.html в корне архива, в именах файлов нет пробелов и кириллицы;
 *   1.7  в коде нет абсолютных ссылок на серверы S3 Яндекса.
 */
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const [pixi, audio, art, ysdk, i18n, game] = await Promise.all([
  read('prototype/vendor/pixi.min.js'),
  read('prototype/src/audio.js'),
  read('prototype/src/art.js'),
  read('prototype/src/ysdk.js'),
  read('prototype/src/i18n.js'),
  read('prototype/src/game.js')
]);

// иначе браузер закроет <script> на первом же вхождении внутри кода
const safe = (js) => js.replace(/\/\/# sourceMappingURL=.*$/m, '').replace(/<\/script/gi, '<\\/script');

const build = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
// Кроме метки сборки снимаем флаг плейтеста: на площадке обновление игры не
// должно стирать прогресс игрока, а журнал плейтеста и «сбросить прогресс» —
// отладочный интерфейс, которому в рознице не место.
const stamp = (js) => js
  .replace("var BUILD = 'dev';", "var BUILD = '" + build + "';")
  .replace('var PLAYTEST = true;', 'var PLAYTEST = false;');

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Магазин у дома</title>
<meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="description" content="Разбираем завоз и раскладываем товар по отделам, пока покупатели ждут свои заказы.">
<style>
  html,body{margin:0;padding:0;height:100%;background:#2b2118;overflow:hidden;
    display:flex;align-items:center;justify-content:center;
    -webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:manipulation}
  canvas{display:block}
  #boot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    color:#e8d9c3;font:16px/1.4 -apple-system,Segoe UI,Roboto,sans-serif}
</style>
<script src="/sdk.js"></script>
</head>
<body>
<div id="boot">Загрузка…</div>
<script>${safe(pixi)}</script>
<script>${safe(audio)}</script>
<script>${safe(art)}</script>
<script>${safe(ysdk)}</script>
<script>${safe(i18n)}</script>
<script>${stamp(safe(game))}</script>
</body>
</html>
`;

const outDir = new URL('dist/yandex/', root);
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await writeFile(new URL('index.html', outDir), html);

const bytes = Buffer.byteLength(html);
console.log('сборка', build);
console.log('dist/yandex/index.html:', (bytes / 1024 / 1024).toFixed(2), 'МБ');

/* ----------------------------------------------------------- самопроверки */
const problems = [];
if (bytes > 100 * 1024 * 1024) problems.push('1.21: распакованный размер больше 100 МБ');
// 1.7 — абсолютные ссылки на хранилище Яндекса. Лицензионные комментарии
// движка и пространства имён XML под запрет не подпадают: это не запросы.
const s3 = html.match(/https?:\/\/[^"'\s)]*(storage\.yandexcloud|s3\.mds\.yandex|yandex[^"'\s)]*\.s3)[^"'\s)]*/gi);
if (s3) problems.push('1.7: абсолютные ссылки на S3 Яндекса: ' + s3.slice(0, 3).join(', '));
if (!/^[\x20-\x7e]*$/.test('index.html')) problems.push('1.22: кириллица в имени файла');

await rm(new URL('dist/yandex.zip', root), { force: true });
await run('zip', ['-q', '-r', '../yandex.zip', 'index.html'], { cwd: new URL('dist/yandex/', root).pathname });
const zip = await stat(new URL('dist/yandex.zip', root));
console.log('dist/yandex.zip:', (zip.size / 1024 / 1024).toFixed(2), 'МБ — этот файл грузится в консоль');

const listed = (await run('unzip', ['-Z1', new URL('dist/yandex.zip', root).pathname])).stdout.trim().split('\n');
console.log('в архиве:', listed.join(', '));
if (listed[0] !== 'index.html') problems.push('1.22: index.html не в корне архива');
if (listed.some((n) => /[\sЀ-ӿ]/.test(n))) problems.push('1.22: пробелы или кириллица в именах файлов');

if (problems.length) {
  console.log('\nПРОБЛЕМЫ:');
  problems.forEach((p) => console.log('  - ' + p));
  process.exitCode = 1;
} else {
  console.log('\nсамопроверки 1.7, 1.21, 1.22 пройдены');
}
