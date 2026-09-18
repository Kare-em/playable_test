/*
 * Однофайловая сборка прототипа: движок, графика и код игры внутри одного HTML.
 *   node tools/build-single.mjs
 * Результат: dist/shop-sort-test.html — открывается двойным кликом, без сервера.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const [pixi, art, game] = await Promise.all([
  read('prototype/vendor/pixi.min.js'),
  read('prototype/src/art.js'),
  read('prototype/src/game.js')
]);

// иначе браузер закроет <script> на первом же вхождении внутри кода
const safe = (js) => js.replace(/\/\/# sourceMappingURL=.*$/m, '').replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Магазин у дома — тестовая сборка</title>
<meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="description" content="Прототип кор-лупа казуальной игры: разбираем завоз и раскладываем товар по секциям стеллажа.">
<style>
  html,body{margin:0;padding:0;height:100%;background:#2b2118;overflow:hidden;
    display:flex;align-items:center;justify-content:center;
    -webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:manipulation}
  canvas{display:block}
  #boot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    color:#e8d9c3;font:16px/1.4 -apple-system,Segoe UI,Roboto,sans-serif}
</style>
</head>
<body>
<div id="boot">Загрузка…</div>
<script>${safe(pixi)}</script>
<script>${safe(art)}</script>
<script>${safe(game)}</script>
</body>
</html>
`;

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/shop-sort-test.html', root), html);
console.log('dist/shop-sort-test.html:', (Buffer.byteLength(html) / 1024).toFixed(0), 'КБ');
